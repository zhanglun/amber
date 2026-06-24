# Amber

Personal Knowledge Pipeline — 把网页文章保存到本地，离线阅读、长期存档。

## 功能

- `amber import <url>` — 抓取网页正文、图片，保存到本地
- `amber web` — 启动本地阅读界面（含目录、阅读进度、主题切换）
- `amber list` — 命令行列出已保存的内容
- `amber delete <id>` — 删除一条记录
- `amber reimport <id>` — 重新抓取某条内容（更新正文）
- `amber migrate` — 将文件存储数据迁移到 PostgreSQL
- `amber doctor` — 检查（缺失时自动安装）抓取动态站点所需的浏览器

## 快速开始（文件存储，零配置）

```bash
# 安装依赖
pnpm install

# 保存一篇文章
pnpm amber import https://example.com/article

# 启动阅读界面（默认 http://localhost:7788）
pnpm amber web
```

所有数据默认写入 `./amber-data/`，无需数据库。

### 抓取动态站点（浏览器）

静态博客/新闻站开箱即用。对依赖 JavaScript 渲染的站点，抓取会自动尝试用无头浏览器（Chromium），首次使用前需安装一次：

```bash
pnpm amber doctor   # 检查并按需安装 Chromium（约 150MB）
```

未安装时，抓取这类站点会失败并提示运行 `amber doctor`。

## 存储模式

Amber 默认使用本地文件存储，零配置。两种存储后端可按需启用，通过环境变量自动切换，彼此独立：

| 变量 | 未设置 | 已设置 |
|------|--------|--------|
| `DATABASE_URL` | 文件存储（JSON 文件） | PostgreSQL（如 Supabase） |
| `R2_*`（4 个必需 + 1 个推荐） | 本地文件 blobs | Cloudflare R2 |

两者可以任意组合——只设 `DATABASE_URL`、只设 `R2_*`、或两个都设（PostgreSQL + R2，生产推荐）。

### 从本地切到云端（Supabase + R2）

1. **建表**：在 Supabase 创建项目，复制连接串（Session Pooler，端口 5432；密码含特殊字符需 URL 编码）填入 `.env` 的 `DATABASE_URL`，然后 `pnpm db:push` 建表
2. **配 R2**：在 Cloudflare 创建 R2 bucket 并获取凭证，把 5 个 `R2_*` 变量填入 `.env`
3. **迁移存量数据**（如有）：`pnpm amber migrate`（capture → Postgres）、blob 文件上传到 R2、`pnpm amber migrate-blob-refs`（修正正文链接）

完整步骤、Supabase 连接串模板、R2 变量说明见 [docs/configuration.md](./docs/configuration.md)。

## 开发

```bash
pnpm test          # 运行所有测试
pnpm typecheck     # TypeScript 类型检查
```

### 集成测试（PostgreSQL）

```bash
# 启动测试数据库
docker compose -f packages/adapters/docker-compose.test.yml up -d

# 运行 PostgresStore 集成测试
TEST_DATABASE_URL=postgres://amber:amber@localhost:5433/amber_test pnpm test -- postgres-store
```

## 项目结构

```
packages/
  domain/    — 核心类型（Capture、Store、BlobStore 接口）
  core/      — 业务逻辑（ImportService、ReadService）
  adapters/  — 存储实现（FileStore、PostgresStore、FileBlobStore、R2BlobStore）
  web/       — Hono HTTP 服务 + HTML 渲染
  cli/       — 命令行入口
```
