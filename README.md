# Amber

Personal Knowledge Pipeline — 把网页文章保存到本地，离线阅读、长期存档。

## 功能

- `amber import <url>` — 抓取网页正文、图片，保存到本地
- `amber web` — 启动本地阅读界面（含目录、阅读进度、主题切换）
- `amber list` — 命令行列出已保存的内容
- `amber delete <id>` — 删除一条记录
- `amber reimport <id>` — 重新抓取某条内容（更新正文）
- `amber migrate` — 将文件存储数据迁移到 PostgreSQL

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

## 存储模式

Amber 支持两种存储后端，通过环境变量自动切换：

| 变量 | 未设置 | 已设置 |
|------|--------|--------|
| `DATABASE_URL` | 文件存储（JSON 文件） | PostgreSQL |
| `R2_*`（4 个） | 本地文件 blobs | Cloudflare R2 |

详细配置方法见 [docs/configuration.md](./docs/configuration.md)。

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
