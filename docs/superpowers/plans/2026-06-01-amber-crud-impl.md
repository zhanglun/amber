# Amber CRUD 实现计划

> **致自动化执行器：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 技能逐任务执行本计划。步骤使用复选框（`- [ ]`）语法追踪进度。

**目标：** 实现 `amber import --force`、`amber delete`、`amber reimport`，使 capture 可以被覆盖和删除，无需手动操作文件。

**架构：** 按 domain → core → adapters → CLI 的自底向上顺序逐层修改，每个任务完成后都能独立编译和测试。不新建任何包，改动全部落在现有文件中。CLI 的 wiring 模块将 `store.delete` 和 blob 目录清理封装为单一的 `deleteCapture` 辅助函数，保持各命令文件精简。

**技术栈：** TypeScript、Vitest（单元测试）、`@clack/prompts`（CLI 交互）、`citty`（命令路由）、Node.js `fs/promises`。

---

## 文件清单

| 操作 | 文件 |
|------|------|
| 修改 | `packages/domain/src/index.ts` |
| 修改 | `packages/core/src/asset-key.ts` |
| 修改 | `packages/core/src/asset-key.test.ts` |
| 修改 | `packages/core/src/import-service.ts` |
| 修改 | `packages/core/src/import-service.test.ts` |
| 修改 | `packages/core/src/read-service.ts` |
| 修改 | `packages/core/src/read-service.test.ts` |
| 修改 | `packages/core/src/index.ts` |
| 修改 | `packages/adapters/src/file-store.ts` |
| 修改 | `packages/adapters/src/file-store.test.ts` |
| 修改 | `packages/cli/src/wiring.ts` |
| 新建 | `packages/cli/src/commands/delete.ts` |
| 新建 | `packages/cli/src/commands/reimport.ts` |
| 修改 | `packages/cli/src/commands/import.ts` |
| 修改 | `packages/cli/src/main.ts` |

---

### 任务 1：Domain — 在 `Store` 接口中添加 `delete`

**涉及文件：**
- 修改：`packages/domain/src/index.ts`
- 修改：`packages/core/src/import-service.test.ts`（fake store 需同步更新）
- 修改：`packages/core/src/read-service.test.ts`（同上）

- [x] **步骤 1：向 Store 接口添加 `delete`**

在 `packages/domain/src/index.ts` 中，替换 `Store` 接口块：

```ts
/** Capture 行的结构化存储。 */
export interface Store {
  insert(capture: Capture): Promise<void>;
  list(): Promise<CaptureSummary[]>;
  get(id: string): Promise<Capture | null>;
  findBySourceUrl(url: string): Promise<Capture | null>;
  delete(id: string): Promise<void>;
}
```

- [x] **步骤 2：更新 `import-service.test.ts` 中的 fake store**

在 `packages/core/src/import-service.test.ts` 中，向 `fakeStore` 工厂函数添加 `delete`。替换 `const store: Store = {` 块：

```ts
const store: Store = {
  insert: vi.fn(async (c: Capture) => {
    rows.push(c);
  }),
  list: vi.fn(async () => rows.map((r) => ({ id: r.id, title: r.title, sourceUrl: r.sourceUrl, createdAt: r.createdAt }))),
  get: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
  findBySourceUrl: vi.fn(async (url: string) => rows.find((r) => r.sourceUrl === url) ?? null),
  delete: vi.fn(async (id: string) => {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx !== -1) rows.splice(idx, 1);
  }),
};
```

- [x] **步骤 3：更新 `read-service.test.ts` 中的 fake store**

在 `packages/core/src/read-service.test.ts` 中，向 `fakeStore` 工厂函数添加 `delete`。替换 `return {` 块：

```ts
return {
  insert: vi.fn(),
  list: vi.fn(async () => [{ id: cap.id, title: cap.title, sourceUrl: cap.sourceUrl, createdAt: cap.createdAt }]),
  get: vi.fn(async (id: string) => (id === "c1" ? cap : null)),
  findBySourceUrl: vi.fn(),
  delete: vi.fn(),
};
```

- [x] **步骤 4：运行范围限定的类型检查（仅 domain + core）**

`FileStore` 直到任务 5 才实现 `delete`，此时运行全量 typecheck 会在 adapters 报错。只检查已改动的两个包：

```bash
cd /Users/zhanglun/Documents/mine/amber && \
  pnpm exec tsc --noEmit -p packages/domain/tsconfig.json && \
  pnpm exec tsc --noEmit -p packages/core/tsconfig.json
```

预期：退出码 0，无报错。

- [x] **步骤 5：运行测试**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm test
```

预期：所有现有测试通过（本任务尚未新增行为）。

- [x] **步骤 6：提交**

```bash
git add packages/domain/src/index.ts packages/core/src/import-service.test.ts packages/core/src/read-service.test.ts
git commit -m "feat(domain): add delete to Store interface"
```

---

### 任务 2：Core — 向 asset-key 添加 `captureAssetPrefix`

**涉及文件：**
- 修改：`packages/core/src/asset-key.test.ts`
- 修改：`packages/core/src/asset-key.ts`
- 修改：`packages/core/src/index.ts`

- [x] **步骤 1：编写失败测试**

完整替换 `packages/core/src/asset-key.test.ts`（import 行也需要更新）：

```ts
import { describe, expect, it } from "vitest";
import { assetKey, captureAssetPrefix } from "./asset-key.js";

describe("assetKey", () => {
  it("namespaces the key by capture id and asset index", () => {
    expect(assetKey("cap123", 0, "image/png")).toBe("captures/cap123/0.png");
  });

  it("falls back to bin when contentType is unknown", () => {
    expect(assetKey("cap123", 2, undefined)).toBe("captures/cap123/2.bin");
  });

  it("maps jpeg content type to jpg", () => {
    expect(assetKey("cap123", 1, "image/jpeg")).toBe("captures/cap123/1.jpg");
  });
});

describe("captureAssetPrefix", () => {
  it("returns the captures/<id> prefix used for blob directory cleanup", () => {
    expect(captureAssetPrefix("cap123")).toBe("captures/cap123");
  });
});
```

- [x] **步骤 2：运行测试，确认失败**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/asset-key.test.ts
```

预期：FAIL — `captureAssetPrefix` 未导出。

- [x] **步骤 3：实现 `captureAssetPrefix`**

在 `packages/core/src/asset-key.ts` 中，在现有 `assetKey` 函数后追加：

```ts
export function captureAssetPrefix(captureId: string): string {
  return `captures/${captureId}`;
}
```

- [x] **步骤 4：从 core index 导出**

在 `packages/core/src/index.ts` 中，更新 asset-key 的导出行：

```ts
export { assetKey, captureAssetPrefix } from "./asset-key.js";
```

- [x] **步骤 5：运行测试，确认通过**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/asset-key.test.ts
```

预期：4 条测试全部通过。

- [x] **步骤 6：提交**

```bash
git add packages/core/src/asset-key.ts packages/core/src/asset-key.test.ts packages/core/src/index.ts
git commit -m "feat(core): add captureAssetPrefix for blob directory cleanup"
```

---

### 任务 3：Core — 为 `ReadService` 添加 `findBySourceUrl`

**涉及文件：**
- 修改：`packages/core/src/read-service.test.ts`
- 修改：`packages/core/src/read-service.ts`

- [x] **步骤 1：编写失败测试**

完整替换 `packages/core/src/read-service.test.ts`——`fakeStore` 中的 `findBySourceUrl` 需要从 `vi.fn()` 升级为有真实返回值的 stub，才能验证新测试的委托逻辑：

```ts
import { describe, expect, it, vi } from "vitest";
import type { Capture, Store } from "@amber/domain";
import { ReadService } from "./read-service.js";

const cap: Capture = {
  id: "c1", title: "T", content: "body", sourceUrl: "https://x/a",
  sourceType: "url", createdAt: "2026-01-01T00:00:00.000Z", capturedAt: "2026-01-01T00:00:00.000Z",
};

function fakeStore(): Store {
  return {
    insert: vi.fn(),
    list: vi.fn(async () => [{ id: cap.id, title: cap.title, sourceUrl: cap.sourceUrl, createdAt: cap.createdAt }]),
    get: vi.fn(async (id: string) => (id === "c1" ? cap : null)),
    findBySourceUrl: vi.fn(async (url: string) => (url === "https://x/a" ? cap : null)),
    delete: vi.fn(),
  };
}

describe("ReadService", () => {
  it("lists capture summaries", async () => {
    const svc = new ReadService(fakeStore());
    const items = await svc.list();
    expect(items).toEqual([{ id: "c1", title: "T", sourceUrl: "https://x/a", createdAt: "2026-01-01T00:00:00.000Z" }]);
  });

  it("gets a capture by id, or null", async () => {
    const svc = new ReadService(fakeStore());
    expect(await svc.get("c1")).toEqual(cap);
    expect(await svc.get("nope")).toBeNull();
  });

  it("finds a capture by source URL, or null", async () => {
    const svc = new ReadService(fakeStore());
    expect(await svc.findBySourceUrl("https://x/a")).toEqual(cap);
    expect(await svc.findBySourceUrl("https://x/missing")).toBeNull();
  });
});
```

- [x] **步骤 2：运行测试，确认失败**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/read-service.test.ts
```

预期：FAIL — `svc.findBySourceUrl is not a function`。

- [x] **步骤 3：实现 `findBySourceUrl`**

完整替换 `packages/core/src/read-service.ts`：

```ts
import type { Capture, CaptureSummary, Store } from "@amber/domain";

export class ReadService {
  constructor(private readonly store: Store) {}

  list(): Promise<CaptureSummary[]> {
    return this.store.list();
  }

  get(id: string): Promise<Capture | null> {
    return this.store.get(id);
  }

  findBySourceUrl(url: string): Promise<Capture | null> {
    return this.store.findBySourceUrl(url);
  }
}
```

- [x] **步骤 4：运行测试，确认通过**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/read-service.test.ts
```

预期：3 条测试全部通过。

- [x] **步骤 5：提交**

```bash
git add packages/core/src/read-service.ts packages/core/src/read-service.test.ts
git commit -m "feat(core): expose findBySourceUrl on ReadService"
```

---

### 任务 4：Core — 为 `ImportService.run` 添加 `forceId` 选项

**涉及文件：**
- 修改：`packages/core/src/import-service.test.ts`
- 修改：`packages/core/src/import-service.ts`

- [x] **步骤 1：编写失败测试**

在 `packages/core/src/import-service.test.ts` 中，在 `describe("ImportService", ...)` 块内（现有两条测试之后）追加两条新测试：

```ts
it("uses forceId and skips dedup when options.forceId is provided", async () => {
  // store 为空——CLI 在调用 run() 之前已经调用过 deleteCapture
  const source = fakeSource(raw);
  const { store, rows } = fakeStore();
  const blob = fakeBlob();
  const service = new ImportService(source, store, blob, {
    now: () => new Date("2026-05-31T00:00:00.000Z"),
  });

  const id = await service.run("https://example.com/a", { forceId: "forced-id" });

  expect(id).toBe("forced-id");
  expect(source.capture).toHaveBeenCalledOnce();
  expect(store.findBySourceUrl).not.toHaveBeenCalled();
  expect(rows).toHaveLength(1);
  expect(rows[0].id).toBe("forced-id");
  expect(rows[0].title).toBe("Hello");
});

it("generates a new id when forceId is not provided (normal dedupe path)", async () => {
  const source = fakeSource(raw);
  const { store } = fakeStore();
  const blob = fakeBlob();
  const service = new ImportService(source, store, blob, {
    now: () => new Date("2026-05-31T00:00:00.000Z"),
    newId: () => "fresh-id",
  });

  const id = await service.run("https://example.com/b");

  expect(id).toBe("fresh-id");
  expect(store.findBySourceUrl).toHaveBeenCalledWith("https://example.com/b");
});
```

- [x] **步骤 2：运行测试，确认失败**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/import-service.test.ts
```

预期：FAIL — `run` 不接受第二个参数。

- [x] **步骤 3：实现 `options` 参数**

完整替换 `packages/core/src/import-service.ts`：

```ts
import type { BlobStore, Capture, Source, Store } from "@amber/domain";
import { assetKey } from "./asset-key.js";

export interface ImportDeps {
  now?: () => Date;
  newId?: () => string;
}

export interface ImportOptions {
  forceId?: string;
}

export class ImportService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(
    private readonly source: Source,
    private readonly store: Store,
    private readonly blob: BlobStore,
    deps: ImportDeps = {},
  ) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  /** 导入一个 URL。返回 capture id（若已导入则返回既有 id）。
   *  传入 options.forceId 时跳过去重检查，用指定 id 覆盖写入。 */
  async run(url: string, options?: ImportOptions): Promise<string> {
    if (!options?.forceId) {
      const existing = await this.store.findBySourceUrl(url);
      if (existing) return existing.id;
    }

    const raw = await this.source.capture(url);

    const id = options?.forceId ?? this.newId();
    let content = raw.markdown;
    for (let i = 0; i < raw.assets.length; i++) {
      const asset = raw.assets[i];
      const key = assetKey(id, i, asset.contentType);
      const publicUrl = await this.blob.put(key, asset.data, asset.contentType);
      content = content.replaceAll(asset.placeholder, publicUrl);
    }

    const nowIso = this.now().toISOString();
    const capture: Capture = {
      id,
      title: raw.title,
      content,
      sourceUrl: url,
      sourceType: "url",
      author: raw.author,
      createdAt: raw.publishedAt ?? nowIso,
      capturedAt: nowIso,
    };
    await this.store.insert(capture);
    return id;
  }
}
```

- [x] **步骤 4：运行测试，确认全部通过**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/import-service.test.ts
```

预期：4 条测试全部通过。

- [x] **步骤 5：提交**

```bash
git add packages/core/src/import-service.ts packages/core/src/import-service.test.ts
git commit -m "feat(core): add forceId option to ImportService.run"
```

---

### 任务 5：Adapters — 实现 `FileStore.delete`

**涉及文件：**
- 修改：`packages/adapters/src/file-store.test.ts`
- 修改：`packages/adapters/src/file-store.ts`

- [x] **步骤 1：编写失败测试**

在 `packages/adapters/src/file-store.test.ts` 的 `describe("FileStore", ...)` 块内追加：

```ts
it("delete removes the capture file, then get returns null", async () => {
  const store = new FileStore(dir);
  await store.insert(cap({ id: "del1" }));
  expect(await store.get("del1")).not.toBeNull();
  await store.delete("del1");
  expect(await store.get("del1")).toBeNull();
});

it("delete is a no-op for unknown ids", async () => {
  const store = new FileStore(dir);
  await expect(store.delete("ghost")).resolves.toBeUndefined();
});
```

- [x] **步骤 2：运行测试，确认失败**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/adapters/src/file-store.test.ts
```

预期：FAIL — `store.delete is not a function`。

- [x] **步骤 3：实现 `delete`**

完整替换 `packages/adapters/src/file-store.ts`（更新 import 行并添加方法）：

```ts
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Capture, CaptureSummary, Store } from "@amber/domain";

/** 基于本地文件的 Store 实现（无数据库模式）：每条 Capture 存一个 JSON 文件。 */
export class FileStore implements Store {
  private readonly dir: string;

  constructor(dataDir: string) {
    this.dir = join(dataDir, "captures");
  }

  private file(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  private async readAll(): Promise<Capture[]> {
    let names: string[] = [];
    try {
      names = await readdir(this.dir);
    } catch {
      return [];
    }
    const captures: Capture[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const text = await readFile(join(this.dir, name), "utf8");
      captures.push(JSON.parse(text) as Capture);
    }
    return captures;
  }

  async insert(capture: Capture): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(capture.id), JSON.stringify(capture, null, 2), "utf8");
  }

  async list(): Promise<CaptureSummary[]> {
    const all = await this.readAll();
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return all.map((c) => ({ id: c.id, title: c.title, sourceUrl: c.sourceUrl, createdAt: c.createdAt }));
  }

  async get(id: string): Promise<Capture | null> {
    try {
      const text = await readFile(this.file(id), "utf8");
      return JSON.parse(text) as Capture;
    } catch {
      return null;
    }
  }

  async findBySourceUrl(url: string): Promise<Capture | null> {
    const all = await this.readAll();
    return all.find((c) => c.sourceUrl === url) ?? null;
  }

  async delete(id: string): Promise<void> {
    await unlink(this.file(id)).catch(() => {});
  }
}
```

- [x] **步骤 4：运行测试，确认通过**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/adapters/src/file-store.test.ts
```

预期：7 条测试全部通过。

- [x] **步骤 5：提交**

```bash
git add packages/adapters/src/file-store.ts packages/adapters/src/file-store.test.ts
git commit -m "feat(adapters): implement FileStore.delete"
```

---

### 任务 6：CLI wiring — 添加 `deleteCapture`

**涉及文件：**
- 修改：`packages/cli/src/wiring.ts`

- [x] **步骤 1：更新 `wiring.ts`**

完整替换 `packages/cli/src/wiring.ts`：

```ts
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DinoSource, FileBlobStore, FileStore } from "@amber/adapters";
import { ImportService, ReadService, captureAssetPrefix } from "@amber/core";

/** 无数据库模式：所有数据落到本地目录（默认 ./amber-data）。 */
export function buildServices() {
  const dataDir = resolve(process.env.AMBER_DATA_DIR ?? "./amber-data");
  const source = new DinoSource();
  const store = new FileStore(dataDir);
  const blob = new FileBlobStore(dataDir);
  const blobsDir = join(dataDir, "blobs");

  async function deleteCapture(id: string): Promise<void> {
    await store.delete(id);
    await rm(join(blobsDir, captureAssetPrefix(id)), { recursive: true, force: true });
  }

  return {
    dataDir,
    blobsDir,
    importService: new ImportService(source, store, blob),
    readService: new ReadService(store),
    deleteCapture,
  };
}
```

- [x] **步骤 2：运行全量类型检查**

全部实现到位，可以跑全量 typecheck 了：

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm typecheck
```

预期：退出码 0。

- [x] **步骤 3：运行完整测试套件**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm test
```

预期：所有测试通过。

- [x] **步骤 4：提交**

```bash
git add packages/cli/src/wiring.ts
git commit -m "feat(cli): add deleteCapture helper to wiring"
```

---

### 任务 7：CLI — `amber delete` 命令

**涉及文件：**
- 新建：`packages/cli/src/commands/delete.ts`
- 修改：`packages/cli/src/main.ts`

- [x] **步骤 1：创建 delete 命令**

新建 `packages/cli/src/commands/delete.ts`：

```ts
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { buildServices } from "../wiring.js";

export const deleteCommand = defineCommand({
  meta: { name: "delete", description: "Delete a capture and its blobs" },
  args: {
    id: { type: "positional", description: "Capture id to delete", required: true },
    yes: { type: "boolean", description: "Skip confirmation prompt", default: false },
  },
  async run({ args }) {
    const { readService, deleteCapture } = buildServices();

    const capture = await readService.get(args.id);
    if (!capture) {
      p.log.error(`Capture not found: ${args.id}`);
      process.exitCode = 1;
      return;
    }

    if (!args.yes) {
      const confirmed = await p.confirm({
        message: `Delete "${capture.title}" (${args.id})?`,
      });
      if (p.isCancel(confirmed) || !confirmed) {
        p.log.info("Cancelled.");
        return;
      }
    }

    await deleteCapture(args.id);
    p.log.success(`Deleted ${args.id}`);
  },
});
```

- [x] **步骤 2：在 `main.ts` 中注册命令**

在 `packages/cli/src/main.ts` 中添加 import 并注册命令：

```ts
#!/usr/bin/env -S node --import tsx
import { defineCommand, runMain } from "citty";
import { importCommand } from "./commands/import.js";
import { listCommand } from "./commands/list.js";
import { webCommand } from "./commands/web.js";
import { deleteCommand } from "./commands/delete.js";

const main = defineCommand({
  meta: { name: "amber", description: "Personal Knowledge Pipeline" },
  subCommands: {
    import: importCommand,
    list: listCommand,
    web: webCommand,
    delete: deleteCommand,
  },
});

runMain(main);
```

- [x] **步骤 3：运行类型检查**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm typecheck
```

预期：退出码 0。

- [x] **步骤 4：冒烟测试——验证错误路径**

用一个不存在的 id 运行，验证错误处理：

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm amber delete nonexistent-id
```

预期：输出错误信息 "Capture not found: nonexistent-id"，退出码 1。

- [x] **步骤 5：提交**

```bash
git add packages/cli/src/commands/delete.ts packages/cli/src/main.ts
git commit -m "feat(cli): add amber delete command"
```

---

### 任务 8：CLI — `amber reimport` 命令

**涉及文件：**
- 新建：`packages/cli/src/commands/reimport.ts`
- 修改：`packages/cli/src/main.ts`

- [x] **步骤 1：创建 reimport 命令**

新建 `packages/cli/src/commands/reimport.ts`：

```ts
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { buildServices } from "../wiring.js";

export const reimportCommand = defineCommand({
  meta: { name: "reimport", description: "Re-capture a URL by capture id, keeping the original id" },
  args: {
    id: { type: "positional", description: "Capture id to re-import", required: true },
  },
  async run({ args }) {
    const { readService, importService, deleteCapture, dataDir } = buildServices();

    const capture = await readService.get(args.id);
    if (!capture) {
      p.log.error(`Capture not found: ${args.id}`);
      process.exitCode = 1;
      return;
    }

    const spin = p.spinner();
    spin.start(`Re-importing "${capture.title}" from ${capture.sourceUrl}`);
    try {
      await deleteCapture(args.id);
      await importService.run(capture.sourceUrl, { forceId: args.id });
      spin.stop(`Re-imported as ${args.id}`);
      p.log.info(`Saved to ${dataDir}/captures/${args.id}.json`);
    } catch (err) {
      spin.stop("Re-import failed");
      p.log.error((err as Error).message);
      process.exitCode = 1;
    }
  },
});
```

- [x] **步骤 2：在 `main.ts` 中注册命令**

在 `packages/cli/src/main.ts` 中添加 import 并注册（包含任务 7 已添加的 deleteCommand）：

```ts
#!/usr/bin/env -S node --import tsx
import { defineCommand, runMain } from "citty";
import { importCommand } from "./commands/import.js";
import { listCommand } from "./commands/list.js";
import { webCommand } from "./commands/web.js";
import { deleteCommand } from "./commands/delete.js";
import { reimportCommand } from "./commands/reimport.js";

const main = defineCommand({
  meta: { name: "amber", description: "Personal Knowledge Pipeline" },
  subCommands: {
    import: importCommand,
    list: listCommand,
    web: webCommand,
    delete: deleteCommand,
    reimport: reimportCommand,
  },
});

runMain(main);
```

- [x] **步骤 3：运行类型检查**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm typecheck
```

预期：退出码 0。

- [x] **步骤 4：冒烟测试——验证错误路径**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm amber reimport nonexistent-id
```

预期：输出错误信息 "Capture not found: nonexistent-id"，退出码 1。

- [x] **步骤 5：提交**

```bash
git add packages/cli/src/commands/reimport.ts packages/cli/src/main.ts
git commit -m "feat(cli): add amber reimport command"
```

---

### 任务 9：CLI — `amber import --force`

**涉及文件：**
- 修改：`packages/cli/src/commands/import.ts`

- [x] **步骤 1：更新 import 命令**

完整替换 `packages/cli/src/commands/import.ts`：

```ts
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { buildServices } from "../wiring.js";

export const importCommand = defineCommand({
  meta: { name: "import", description: "Import a URL into Amber" },
  args: {
    url: { type: "positional", description: "Web page URL to capture", required: true },
    force: { type: "boolean", description: "Skip dedup and re-capture, keeping original id if it exists", default: false },
  },
  async run({ args }) {
    const { importService, readService, deleteCapture, dataDir } = buildServices();
    const spin = p.spinner();
    spin.start(`Importing ${args.url}`);
    try {
      let id: string;
      if (args.force) {
        const existing = await readService.findBySourceUrl(args.url);
        if (existing) {
          await deleteCapture(existing.id);
          id = await importService.run(args.url, { forceId: existing.id });
        } else {
          id = await importService.run(args.url);
        }
      } else {
        id = await importService.run(args.url);
      }

      spin.stop(`Imported as ${id}`);
      p.log.info(`Saved to ${dataDir}/captures/${id}.json`);

      const saved = await readService.get(id);
      if (saved && saved.content.trim().length === 0) {
        p.log.warn("Content is empty — the page may block bots, require login, or be behind a paywall.");
        p.log.info("Tip: try dino with browser mode (patchright) for gated pages.");
      }
    } catch (err) {
      spin.stop("Import failed");
      p.log.error((err as Error).message);
      process.exitCode = 1;
    }
  },
});
```

- [x] **步骤 2：运行类型检查**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm typecheck
```

预期：退出码 0。

- [x] **步骤 3：运行完整测试套件**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm test
```

预期：所有测试通过。

- [x] **步骤 4：冒烟测试——对未导入的 URL 使用 `--force`**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm amber import --force https://example.com
```

预期：正常运行（无旧记录 → 不触发删除，走普通导入流程）。

- [x] **步骤 5：提交**

```bash
git add packages/cli/src/commands/import.ts
git commit -m "feat(cli): add --force flag to amber import"
```

---

## 需求覆盖确认

| Spec 需求 | 对应任务 |
|-----------|---------|
| `amber import --force <url>` 保留原 id | 任务 9（CLI）、任务 4（forceId 选项） |
| `--force` 对新 URL 等同普通导入 | 任务 9（else 分支） |
| `amber delete <id>` 删除 JSON + blobs | 任务 5、6、7 |
| `amber delete <id> --yes` 跳过确认 | 任务 7（`args.yes`） |
| `amber delete` 找不到 id → exitCode 1 | 任务 7（错误路径） |
| `amber reimport <id>` 用原 id 重新抓取 | 任务 8 |
| `amber reimport` 找不到 id → exitCode 1 | 任务 8（错误路径） |
| `Store.delete` 接口方法 | 任务 1 |
| `FileStore.delete` 静默忽略文件不存在 | 任务 5（`catch(() => {})`） |
| `captureAssetPrefix` 从 `@amber/core` 导出 | 任务 2 |
| `ImportService.run(url, { forceId? })` | 任务 4 |
| `ReadService.findBySourceUrl` | 任务 3 |
| `deleteCapture` 封装 JSON + blobs 清理 | 任务 6 |
| blob 目录不存在 → `rm({ force: true })` 静默跳过 | 任务 6 |
| `delete` 用户取消 → exitCode 0 | 任务 7（`isCancel` 检查） |
