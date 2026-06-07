# 数据库

amber 使用 PostgreSQL 存储收藏的 Capture 数据。默认使用文件存储（`./amber-data`），设置 `DATABASE_URL` 后自动切换到 PostgreSQL（[wiring.ts](../packages/cli/src/wiring.ts)）。

数据库表结构由 [Prisma schema](../packages/adapters/prisma/schema.prisma) 定义，目前只有一张 `Capture` 表。

---

## 首次建表

```bash
# 确保 .env 里的 DATABASE_URL 指向目标数据库
pnpm db:push
```

该命令会：
1. 加载 `.env` 环境变量
2. 用 `prisma db push` 将 schema 推送到数据库，自动创建/同步表结构

无需手写 SQL。

---

## Schema 变更流程（迭代更新）

当需要修改表结构（新增字段、修改类型等）时：

### 1. 修改 schema

编辑 [`packages/adapters/prisma/schema.prisma`](../packages/adapters/prisma/schema.prisma)。

### 2. 推送变更

```bash
pnpm db:push
```

`prisma db push` 会自动 diff 当前 schema 与数据库的差异并应用变更。

### 3. 破坏性变更

如果变更涉及**删除列**或**修改列类型**（可能导致数据丢失），`db push` 会提示确认：

```bash
# 确认接受数据丢失后执行
pnpm --filter @amber/adapters exec prisma db push --schema=prisma/schema.prisma --accept-data-loss
```

> ⚠️ 生产数据库执行破坏性变更前，先备份。Supabase 可在 Dashboard → Database → Backups 查看自动备份。

### 4. 更新代码

schema 变更后，同步更新：
- `packages/domain/src/index.ts` — `Capture` / `CaptureSummary` 类型
- `packages/adapters/src/postgres-store.ts` — `insert` / `rowToCapture` / `rowToSummary` 的字段映射
- 运行 `pnpm typecheck && pnpm test` 确认无回归

---

## Prisma Client 生成

`packages/adapters` 的 `postinstall` 脚本会自动执行 `prisma generate`。如果手动修改了 schema 后 IDE 类型提示没更新：

```bash
pnpm --filter @amber/adapters exec prisma generate --schema=prisma/schema.prisma
```

---

## Supabase 连接注意事项

Supabase 提供两种连接方式：

| 类型 | 端口 | 用途 |
|---|---|---|
| **Direct connection** | 5432 | ✅ `db:push` 必须用这个 |
| Pooled (Transaction mode) | 6543 | 应用运行时可用，但 Prisma migration/db push 会报 shadow schema 错误 |

**`.env` 中始终使用 Direct connection（5432）：**

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

---

## 相关命令速查

| 命令 | 说明 |
|---|---|
| `pnpm db:push` | 推送 schema 到数据库（建表 / 更新表结构） |
| `pnpm amber migrate` | 将文件存储的数据迁移到 PostgreSQL |
| `pnpm amber migrate --dry-run` | 预览迁移，不实际写入 |
| `DATABASE_URL="" pnpm amber web` | 强制使用文件存储（跳过 PostgreSQL） |
