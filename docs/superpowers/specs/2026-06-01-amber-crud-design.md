# Amber 基础 CRUD 设计

## 背景

v1 核心流程已跑通，但缺少基本的数据管理操作：无法强制重新抓取、无法删除错误条目、无法按 id 重新导入。本次新增三个操作，同时修补相关接口。

---

## 新增命令

### `amber import --force <url>`

强制重新抓取一个已存在的 URL，保留原 capture 的 id（web 详情页 URL 不变）。

```
amber import --force https://example.com/article
```

若该 URL 尚未导入过，行为与不加 `--force` 完全相同。

### `amber delete <id>`

删除一条 capture，包括元数据 JSON 和所有关联的 blob 文件。

```
amber delete abc123            # 展示标题，询问确认
amber delete abc123 --yes      # 跳过确认，直接删（适合脚本）
```

找不到 id 时报错退出（exitCode 1）。

### `amber reimport <id>`

按 id 找到已有 capture，用其 `sourceUrl` 重新抓取并覆盖，保留原 id。

```
amber reimport abc123
```

找不到 id 时报错退出（exitCode 1）。

---

## 各层改动

### `@amber/domain` — Store 接口

新增 `delete` 方法：

```ts
export interface Store {
  insert(capture: Capture): Promise<void>;
  list(): Promise<CaptureSummary[]>;
  get(id: string): Promise<Capture | null>;
  findBySourceUrl(url: string): Promise<Capture | null>;
  delete(id: string): Promise<void>;          // 新增
}
```

### `@amber/core` — asset-key.ts

新增 `captureAssetPrefix`，供 blob 清理使用，与 `assetKey` 保持同步：

```ts
export function captureAssetPrefix(captureId: string): string {
  return `captures/${captureId}`;
}
```

### `@amber/core` — ImportService

`run()` 加可选第二参数，传入时跳过去重检查并使用指定 id：

```ts
async run(url: string, options?: { forceId?: string }): Promise<string>
```

内部逻辑：
- `options?.forceId` 存在 → 跳过 `findBySourceUrl`，直接抓取，使用 `forceId` 作为 id
- 无 `forceId` → 原有去重逻辑不变

### `@amber/core` — ReadService

透出 `findBySourceUrl`，供 CLI `--force` 查找旧记录：

```ts
findBySourceUrl(url: string): Promise<Capture | null> {
  return this.store.findBySourceUrl(url);
}
```

### `@amber/adapters` — FileStore

实现 `delete(id)`，静默忽略文件不存在的情况：

```ts
async delete(id: string): Promise<void> {
  await unlink(this.file(id)).catch(() => {});
}
```

### `@amber/cli` — wiring.ts

新增 `deleteCapture(id)` 组合操作，封装"删元数据 + 删 blobs"：

```ts
async function deleteCapture(id: string): Promise<void> {
  await store.delete(id);
  await rm(join(blobsDir, captureAssetPrefix(id)), { recursive: true, force: true });
}
```

`buildServices()` 返回值加入 `deleteCapture`。

---

## 数据流

```
--force:
  readService.findBySourceUrl(url)
    → (若存在) deleteCapture(existing.id)
    → importService.run(url, { forceId: existing.id })

reimport:
  readService.get(id)
    → deleteCapture(id)
    → importService.run(capture.sourceUrl, { forceId: id })

delete:
  readService.get(id)   ← 仅用于展示标题
    → deleteCapture(id)
```

---

## 边界情况

| 场景 | 处理 |
|------|------|
| `delete` / `reimport` 找不到 id | 打印错误，exitCode 1 |
| `--force` URL 无旧记录 | 正常导入，不报错 |
| blob 目录不存在 | `rm({ force: true })` 静默跳过 |
| `delete` 无 `--yes` 时用户取消 | 不删除，正常退出（exitCode 0） |

---

## 不在本次范围内

- `Store.search()`、`tags`、`updatedAt` 等模型扩展（见模块四）
- `--from <file>` 批量导入（见模块五）
- PostgresStore / R2BlobStore 的 `delete` 实现（接数据库时补）
