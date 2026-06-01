# Amber CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `amber import --force`, `amber delete`, and `amber reimport` so captures can be overwritten and removed without touching files manually.

**Architecture:** Each layer is touched in bottom-up order (domain → core → adapters → CLI) so each task compiles and tests cleanly before the next one begins. No new packages are created — changes slot into existing files. The CLI wiring module composes `store.delete` + blob directory removal into a single `deleteCapture` helper, keeping the individual commands thin.

**Tech Stack:** TypeScript, Vitest (unit tests), `@clack/prompts` (CLI UX), `citty` (command routing), Node.js `fs/promises`.

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/domain/src/index.ts` |
| Modify | `packages/core/src/asset-key.ts` |
| Modify | `packages/core/src/asset-key.test.ts` |
| Modify | `packages/core/src/import-service.ts` |
| Modify | `packages/core/src/import-service.test.ts` |
| Modify | `packages/core/src/read-service.ts` |
| Modify | `packages/core/src/read-service.test.ts` |
| Modify | `packages/core/src/index.ts` |
| Modify | `packages/adapters/src/file-store.ts` |
| Modify | `packages/adapters/src/file-store.test.ts` |
| Modify | `packages/cli/src/wiring.ts` |
| Create | `packages/cli/src/commands/delete.ts` |
| Create | `packages/cli/src/commands/reimport.ts` |
| Modify | `packages/cli/src/commands/import.ts` |
| Modify | `packages/cli/src/main.ts` |

---

### Task 1: Domain — add `delete` to `Store` interface

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/core/src/import-service.test.ts` (fake store must stay in sync)
- Modify: `packages/core/src/read-service.test.ts` (same)

- [ ] **Step 1: Add `delete` to the Store interface**

In `packages/domain/src/index.ts`, replace the `Store` interface block:

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

- [ ] **Step 2: Update fake store in `import-service.test.ts`**

In `packages/core/src/import-service.test.ts`, add `delete` to the `fakeStore` factory. Replace the `const store: Store = {` block:

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

- [ ] **Step 3: Update fake store in `read-service.test.ts`**

In `packages/core/src/read-service.test.ts`, add `delete` to the `fakeStore` factory. Replace the `return {` block:

```ts
return {
  insert: vi.fn(),
  list: vi.fn(async () => [{ id: cap.id, title: cap.title, sourceUrl: cap.sourceUrl, createdAt: cap.createdAt }]),
  get: vi.fn(async (id: string) => (id === "c1" ? cap : null)),
  findBySourceUrl: vi.fn(),
  delete: vi.fn(),
};
```

- [ ] **Step 4: Run scoped typecheck (domain + core only)**

`FileStore` 直到 Task 5 才实现 `delete`，此时跑全量 typecheck 会报 adapters 错误。只检查已改动的两个包：

```bash
cd /Users/zhanglun/Documents/mine/amber && \
  pnpm exec tsc --noEmit -p packages/domain/tsconfig.json && \
  pnpm exec tsc --noEmit -p packages/core/tsconfig.json
```

Expected: exits 0, no errors.

- [ ] **Step 5: Run tests**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm test
```

Expected: all existing tests pass (no new behavior yet).

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/index.ts packages/core/src/import-service.test.ts packages/core/src/read-service.test.ts
git commit -m "feat(domain): add delete to Store interface"
```

---

### Task 2: Core — add `captureAssetPrefix` to asset-key

**Files:**
- Modify: `packages/core/src/asset-key.test.ts`
- Modify: `packages/core/src/asset-key.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Replace `packages/core/src/asset-key.test.ts` entirely (import line also needs updating):

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

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/asset-key.test.ts
```

Expected: FAIL — `captureAssetPrefix` is not exported.

- [ ] **Step 3: Implement `captureAssetPrefix`**

In `packages/core/src/asset-key.ts`, append after the existing `assetKey` function:

```ts
export function captureAssetPrefix(captureId: string): string {
  return `captures/${captureId}`;
}
```

- [ ] **Step 4: Export from core index**

In `packages/core/src/index.ts`, update the asset-key export line:

```ts
export { assetKey, captureAssetPrefix } from "./asset-key.js";
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/asset-key.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/asset-key.ts packages/core/src/asset-key.test.ts packages/core/src/index.ts
git commit -m "feat(core): add captureAssetPrefix for blob directory cleanup"
```

---

### Task 3: Core — add `ReadService.findBySourceUrl`

**Files:**
- Modify: `packages/core/src/read-service.test.ts`
- Modify: `packages/core/src/read-service.ts`

- [ ] **Step 1: Write the failing test**

Replace `packages/core/src/read-service.test.ts` entirely — `fakeStore` needs its `findBySourceUrl` updated from `vi.fn()` to a real stub so the new test can verify the delegation:

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

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/read-service.test.ts
```

Expected: FAIL — `svc.findBySourceUrl is not a function`.

- [ ] **Step 3: Implement `findBySourceUrl`**

Replace `packages/core/src/read-service.ts` entirely:

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

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/read-service.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/read-service.ts packages/core/src/read-service.test.ts
git commit -m "feat(core): expose findBySourceUrl on ReadService"
```

---

### Task 4: Core — extend `ImportService.run` with `forceId` option

**Files:**
- Modify: `packages/core/src/import-service.test.ts`
- Modify: `packages/core/src/import-service.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/core/src/import-service.test.ts`, add two new tests inside the `describe("ImportService", ...)` block (after the existing two):

```ts
it("uses forceId and skips dedup when options.forceId is provided", async () => {
  // Store is empty — CLI already called deleteCapture before calling run()
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

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/import-service.test.ts
```

Expected: FAIL — `run` does not accept a second argument.

- [ ] **Step 3: Implement the `options` parameter**

Replace `packages/core/src/import-service.ts` entirely:

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

- [ ] **Step 4: Run tests to verify they all pass**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/core/src/import-service.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/import-service.ts packages/core/src/import-service.test.ts
git commit -m "feat(core): add forceId option to ImportService.run"
```

---

### Task 5: Adapters — implement `FileStore.delete`

**Files:**
- Modify: `packages/adapters/src/file-store.test.ts`
- Modify: `packages/adapters/src/file-store.ts`

- [ ] **Step 1: Write the failing test**

In `packages/adapters/src/file-store.test.ts`, add inside the `describe("FileStore", ...)` block:

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

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/adapters/src/file-store.test.ts
```

Expected: FAIL — `store.delete is not a function`.

- [ ] **Step 3: Implement `delete`**

In `packages/adapters/src/file-store.ts`, update the import line and add the method. Replace the file:

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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm exec vitest run packages/adapters/src/file-store.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/file-store.ts packages/adapters/src/file-store.test.ts
git commit -m "feat(adapters): implement FileStore.delete"
```

---

### Task 6: CLI wiring — add `deleteCapture`

**Files:**
- Modify: `packages/cli/src/wiring.ts`

- [ ] **Step 1: Update `wiring.ts`**

Replace `packages/cli/src/wiring.ts` entirely:

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

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/wiring.ts
git commit -m "feat(cli): add deleteCapture helper to wiring"
```

---

### Task 7: CLI — `amber delete` command

**Files:**
- Create: `packages/cli/src/commands/delete.ts`
- Modify: `packages/cli/src/main.ts`

- [ ] **Step 1: Create the delete command**

Create `packages/cli/src/commands/delete.ts`:

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

- [ ] **Step 2: Register in `main.ts`**

In `packages/cli/src/main.ts`, add the import and register the command:

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

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Smoke-test the command manually**

Run against a non-existent id to verify the error path:

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm amber delete nonexistent-id
```

Expected output: error message "Capture not found: nonexistent-id", exit code 1.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/delete.ts packages/cli/src/main.ts
git commit -m "feat(cli): add amber delete command"
```

---

### Task 8: CLI — `amber reimport` command

**Files:**
- Create: `packages/cli/src/commands/reimport.ts`
- Modify: `packages/cli/src/main.ts`

- [ ] **Step 1: Create the reimport command**

Create `packages/cli/src/commands/reimport.ts`:

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

- [ ] **Step 2: Register in `main.ts`**

In `packages/cli/src/main.ts`, add the import and register:

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

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Smoke-test against non-existent id**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm amber reimport nonexistent-id
```

Expected: "Capture not found: nonexistent-id", exit code 1.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/reimport.ts packages/cli/src/main.ts
git commit -m "feat(cli): add amber reimport command"
```

---

### Task 9: CLI — `amber import --force`

**Files:**
- Modify: `packages/cli/src/commands/import.ts`

- [ ] **Step 1: Update the import command**

Replace `packages/cli/src/commands/import.ts` entirely:

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

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Smoke-test `--force` with a non-imported URL**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm amber import --force https://example.com
```

Expected: runs normally (no existing record → no delete, new import).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/import.ts
git commit -m "feat(cli): add --force flag to amber import"
```

---

## Self-Review Checklist

| Spec requirement | Covered by |
|---|---|
| `amber import --force <url>` keeps original id | Task 9 (CLI), Task 4 (forceId option) |
| `--force` on new URL behaves like normal import | Task 9 (else branch) |
| `amber delete <id>` deletes JSON + blobs | Task 5, 6, 7 |
| `amber delete <id> --yes` skips confirmation | Task 7 (`args.yes`) |
| `amber delete` on unknown id → exitCode 1 | Task 7 (error path) |
| `amber reimport <id>` re-captures with same id | Task 8 |
| `amber reimport` on unknown id → exitCode 1 | Task 8 (error path) |
| `Store.delete` interface | Task 1 |
| `FileStore.delete` silently ignores missing file | Task 5 (`catch(() => {})`) |
| `captureAssetPrefix` exported from `@amber/core` | Task 2 |
| `ImportService.run(url, { forceId? })` | Task 4 |
| `ReadService.findBySourceUrl` | Task 3 |
| `deleteCapture` in wiring (JSON + blobs) | Task 6 |
| blob dir missing → `rm({ force: true })` silent | Task 6 (`rm` with `force: true`) |
| user cancel on delete → exitCode 0 | Task 7 (`isCancel` check) |
