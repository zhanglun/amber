# 存储配置

Amber 默认使用本地文件存储，无需任何配置即可运行。如需接入 PostgreSQL 或 Cloudflare R2，按本文操作。

所有环境变量的说明见根目录 [`.env.example`](../.env.example)。

---

## PostgreSQL

### 1. 准备数据库

任意 PostgreSQL 实例均可。本地开发推荐 Docker：

```bash
docker run -d \
  --name amber-pg \
  -e POSTGRES_DB=amber \
  -e POSTGRES_USER=amber \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件（已在 `.gitignore` 中，不会提交到 git）：

```bash
DATABASE_URL=postgres://amber:yourpassword@localhost:5432/amber
```

### 3. 初始化表结构

Prisma schema 在 `packages/adapters/prisma/schema.prisma`，在根目录推送到数据库：

```bash
pnpm db:push
```

成功输出：`Your database is now in sync with your Prisma schema.`

> `db:push` 会先加载根目录 `.env` 再执行 `prisma db push`（`prisma` CLI 自身不会读根目录 `.env`，故由脚本注入环境变量）。后续 schema 变更同样用此命令同步。生产环境建议改用 `prisma migrate deploy`（有迁移历史记录）。

### 4. 启动

```bash
pnpm amber web
```

`DATABASE_URL` 存在时，Amber 自动使用 PostgresStore，否则回退到文件存储。

### 使用 Supabase

Supabase 提供托管 PostgreSQL，按上面的步骤接入即可，但有两个坑要注意。

**1. 密码必须 URL 编码**

数据库密码若含特殊字符（`@ : / ? # & ,` 等），直接写进连接串会被解析错误（典型报错是 `Can't reach database server at` 后面跟一段乱码主机名）。两种处理方式：

- 编码密码：`node -e "console.log(encodeURIComponent('你的密码'))"`，把输出填进连接串；
- 或在 Dashboard「Reset database password」重置成只含字母数字的密码，省去编码。

**2. 统一用 Session Pooler（5432）**

Supabase 提供 Session pooler（5432）和 Transaction pooler（6543）。Amber 是常驻单进程，**统一用 Session pooler 即可，一个连接串同时满足建表和运行时**：

```bash
DATABASE_URL=postgresql://postgres.<project-ref>:<编码后的密码>@aws-1-<region>.pooler.supabase.com:5432/postgres
```

> Transaction pooler（6543）面向 serverless 大量瞬时连接，不支持 DDL 和 prepared statements，Prisma 需额外加 `?pgbouncer=true`，且无法用于 `prisma db push`。常驻进程没必要用它。

`<project-ref>`、`<region>` 从 Dashboard 的 Connect 面板复制。配好后照常 `pnpm db:push` 建表、`pnpm amber web` 启动。

---

## 从文件存储迁移数据

如果之前用文件存储积累了数据，可以一键迁移到 PostgreSQL：

```bash
# 先预览（不写入数据库）
pnpm amber migrate --dryRun

# 实际迁移
pnpm amber migrate
```

迁移逻辑：逐条读取 `amber-data/captures/*.json`，按 ID 检查是否已存在，跳过重复，写入新记录。**迁移可重复执行，已存在的记录不会被覆盖。**

迁移完成后图片/视频 blob 仍在本地 `amber-data/blobs/`，web 服务会继续通过 `/blobs/` 路径提供服务。

---

## Cloudflare R2（图片/视频存储）

R2 仅影响新导入内容的 blob 存储。已有本地 blob 不会自动上传。

### 1. 获取 R2 凭证

在 Cloudflare Dashboard：
1. 创建一个 R2 存储桶（例如 `amber-blobs`）
2. 进入「管理 API 令牌」→ 创建 R2 专用 token（权限：Object Read & Write）
3. 记录 Account ID、Access Key ID、Secret Access Key

### 2. 配置公开访问

在存储桶设置中开启「公开访问」或绑定自定义域名，获得公开 URL 前缀（例如 `https://pub-xxx.r2.dev` 或 `https://assets.yourdomain.com`）。

### 3. 设置环境变量

在项目根目录的 `.env` 文件中追加（与 `DATABASE_URL` 共用同一个文件）：

```bash
R2_ACCOUNT_ID=你的_cloudflare_account_id
R2_ACCESS_KEY_ID=你的_access_key_id
R2_SECRET_ACCESS_KEY=你的_secret_access_key
R2_BUCKET=amber-blobs
R2_PUBLIC_BASE_URL=https://assets.yourdomain.com
```

四个 `R2_*` 变量同时设置时启用 R2BlobStore，缺少任何一个则回退到本地文件。

---

## 组合使用

PostgreSQL + R2 是推荐的生产配置，两者独立，可以单独启用：

| 场景 | DATABASE_URL | R2_* |
|------|-------------|------|
| 纯本地（默认） | ✗ | ✗ |
| Postgres + 本地 blob | ✓ | ✗ |
| 文件存储 + R2 blob | ✗ | ✓ |
| Postgres + R2（生产推荐） | ✓ | ✓ |

---

## 已知限制

- **删除时 R2 对象不清理**：`amber delete` 删除 Postgres 记录和本地 blob，但不删除 R2 中的对象（`BlobStore` 接口目前没有 `delete` 方法）。
- **blob 迁移需手动完成**：`amber migrate` 只迁移 capture 元数据，blob 文件需手动上传到 R2（可用 `rclone` 或 Cloudflare Dashboard）。

---

## 生产部署（Node.js）

生产环境用前台命令运行，交给进程管理器守护：

```bash
amber web serve --port=7788
```

`amber web serve` 与本地 `amber web` 的区别：前台运行、不自动开浏览器，但日志写入**同一个文件** `<AMBER_DATA_DIR>/logs/web-YYYY-MM-DD.log`，同时输出到 stdout。

查看日志两种方式都可用：

- `amber web logs [--lines=N] [--follow]` —— 读日志文件，跨环境一致
- 进程管理器自带的 stdout 捕获，如 `journalctl -u amber -f`、`docker logs -f <container>`、`pm2 logs amber`

systemd unit 示例：

```ini
[Service]
WorkingDirectory=/opt/amber
Environment=AMBER_DATA_DIR=/var/lib/amber
Environment=DATABASE_URL=postgresql://...
ExecStart=/usr/bin/pnpm amber web serve --port=7788
Restart=always
```

日志按日期拆分、默认保留 7 天（`serve` 启动时清理过期文件）。
