# Capture Metadata Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 丰富 Capture 的元数据——存储 dino 全部返回字段、导入时计算摘要/字数/是否含代码、修复 createdAt/capturedAt 语义混乱问题、新增标签和阅读行为追踪字段。

**Architecture:** Domain 层先做全量类型变更（去掉 `createdAt`，以 `capturedAt` 为标准时间戳，新增 10 个字段）；core 层新增 `content-stats.ts` 提供纯函数计算，ImportService 和 DinoSource 消费新字段；FileStore 实现两个新 Store 方法；Web 层补充 `/tags` 端点并在 GET 详情时自动记录访问。

**Tech Stack:** TypeScript, Vitest, Hono.

---

## File Structure

| 文件 | 变更 | 职责 |
|------|------|------|
| `packages/domain/src/index.ts` | Modify | 重写 Capture / CaptureSummary / RawCapture / Store 接口 |
| `packages/core/src/content-stats.ts` | **Create** | 纯函数：computeExcerpt / computeWordCount / computeHasCode |
| `packages/core/src/content-stats.test.ts` | **Create** | 以上纯函数的单元测试 |
| `packages/core/src/index.ts` | Modify | barrel 导出 content-stats |
| `packages/adapters/src/dino-source.ts` | Modify | toRawCapture 传递 coverImage |
| `packages/adapters/src/dino-source.test.ts` | Modify | 更新 fixture 含 coverImage |
| `packages/core/src/import-service.ts` | Modify | 计算新字段，修复 capturedAt/publishedAt |
| `packages/core/src/import-service.test.ts` | Modify | 更新 fakeStore / fixture / 断言 |
| `packages/adapters/src/file-store.ts` | Modify | 更新 list() 映射、排序；实现 updateTags / recordVisit |
| `packages/adapters/src/file-store.test.ts` | Modify | 更新 fixture；新增 updateTags / recordVisit 测试 |
| `packages/core/src/read-service.ts` | Modify | 委托 updateTags / recordVisit |
| `packages/core/src/read-service.test.ts` | Modify | 更新 fakeStore；新增委托测试 |
| `packages/web/src/render.ts` | Modify | groupByWeek 用 capturedAt；列表展示 excerpt；文章 meta 展示 publishedAt |
| `packages/web/src/render.test.ts` | Modify | 更新 fixture（capturedAt 替换 createdAt）；新增断言 |
| `packages/web/src/index.ts` | Modify | GET /:id 记录访问；新增 PATCH /:id/tags |
| `packages/web/src/index.test.ts` | Modify | 更新 fakeReadService；新增 PATCH tags 测试；新增访问记录测试 |

---

## Task 1: Domain 类型全量更新

**Files:**
- Modify: `packages/domain/src/index.ts`

- [x] **Step 1: 将 `packages/domain/src/index.ts` 完整替换为以下内容**

```typescript
/** 一份被收藏的内容，是跨所有版本被存储与阅读的基本单元。 */
export interface Capture {
  id: string;
  title: string;
  content: string;
  sourceUrl: string;
  sourceType: "url";
  author?: string;
  capturedAt: string;      // 用户保存的时间（ISO 8601，始终有值）
  publishedAt?: string;    // 原文发布时间（ISO 8601，可选）
  coverImage?: string;     // 封面图 URL（来自 dino）
  excerpt?: string;        // 导入时计算的纯文字摘要（≤150字）
  wordCount?: number;      // 导入时计算的字符数（不含代码块和空白）
  hasCode?: boolean;       // 导入时计算：正文是否含代码块
  tags?: string[];         // 用户自定义标签
  readProgress?: number;   // 0–100，滚动百分比整数
  readAt?: string;         // ISO 8601，首次读完时写入，不随进度回退
  lastOpenedAt?: string;   // ISO 8601，最近一次打开时间
  readCount?: number;      // 打开次数（每次访问 /captures/:id 自增）
}

export type CaptureSummary = Pick<
  Capture,
  | "id" | "title" | "sourceUrl" | "capturedAt" | "publishedAt"
  | "coverImage" | "excerpt" | "wordCount" | "hasCode"
  | "tags" | "readProgress" | "readAt"
>;

/** 一个二进制资源（图片），由 markdown 中的占位符引用。 */
export interface Asset {
  placeholder: string;
  data: Uint8Array;
  contentType?: string;
}

/** 由 Source 返回的、尚未入库的原始素材。 */
export interface RawCapture {
  title: string;
  markdown: string;
  author?: string;
  publishedAt?: string;
  coverImage?: string;
  assets: Asset[];
}

/** 采集来源：给定输入，返回原始素材。 */
export interface Source {
  capture(input: string): Promise<RawCapture>;
}

/** Capture 行的结构化存储。 */
export interface Store {
  insert(capture: Capture): Promise<void>;
  list(): Promise<CaptureSummary[]>;
  get(id: string): Promise<Capture | null>;
  findBySourceUrl(url: string): Promise<Capture | null>;
  delete(id: string): Promise<void>;
  updateReadStatus(id: string, status: { readProgress: number; readAt?: string }): Promise<void>;
  updateTags(id: string, tags: string[]): Promise<void>;
  recordVisit(id: string, visitedAt: string): Promise<void>;
}

/** 二进制/对象存储。`put` 返回公开 URL。 */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType?: string): Promise<string>;
}
```

- [x] **Step 2: 确认 typecheck 有预期错误**

运行：`pnpm run typecheck`

Expected: 多个错误（FileStore / ReadService / ImportService 尚未更新），说明类型变更生效。后续任务逐步修复。

---

## Task 2: content-stats 纯函数

**Files:**
- Create: `packages/core/src/content-stats.ts`
- Create: `packages/core/src/content-stats.test.ts`
- Modify: `packages/core/src/index.ts`

- [x] **Step 1: 写失败测试 `packages/core/src/content-stats.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { computeExcerpt, computeHasCode, computeWordCount } from "./content-stats.js";

describe("computeWordCount", () => {
  it("counts non-whitespace chars excluding fenced code blocks", () => {
    expect(computeWordCount("hello world")).toBe(10);
  });

  it("excludes fenced code blocks", () => {
    const md = "intro\n\n```js\nconst x = 1;\n```\n\noutro";
    expect(computeWordCount(md)).toBe(10); // "intro" + "outro" = 10 chars
  });

  it("returns 0 for empty string", () => {
    expect(computeWordCount("")).toBe(0);
  });
});

describe("computeHasCode", () => {
  it("returns true for fenced code blocks with backticks", () => {
    expect(computeHasCode("text\n\n```js\ncode\n```")).toBe(true);
  });

  it("returns true for fenced code blocks with tildes", () => {
    expect(computeHasCode("~~~\ncode\n~~~")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(computeHasCode("just some text")).toBe(false);
  });

  it("returns false for inline code only", () => {
    expect(computeHasCode("use `foo` inline")).toBe(false);
  });
});

describe("computeExcerpt", () => {
  it("returns first paragraph text with markdown stripped", () => {
    const md = "# Heading\n\nFirst paragraph text here.\n\nSecond paragraph.";
    expect(computeExcerpt(md)).toBe("First paragraph text here.");
  });

  it("truncates long text to maxLen with ellipsis", () => {
    const long = "A".repeat(200);
    const result = computeExcerpt(long, 150);
    expect(result.length).toBe(151); // 150 chars + "…"
    expect(result.endsWith("…")).toBe(true);
  });

  it("strips markdown images", () => {
    expect(computeExcerpt("![alt](url) text")).toBe("text");
  });

  it("strips markdown links but keeps text", () => {
    expect(computeExcerpt("[click here](https://x.com) text")).toBe("click here text");
  });

  it("strips bold and italic markers", () => {
    expect(computeExcerpt("**bold** and _italic_")).toBe("bold and italic");
  });

  it("returns empty string for content-less input", () => {
    expect(computeExcerpt("```js\ncode only\n```")).toBe("");
  });
});
```

- [x] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/core/src/content-stats.test.ts`

Expected: FAIL（模块不存在）。

- [x] **Step 3: 创建 `packages/core/src/content-stats.ts`**

```typescript
export function computeWordCount(markdown: string): number {
  return markdown.replace(/```[\s\S]*?```/g, "").replace(/\s/g, "").length;
}

export function computeHasCode(markdown: string): boolean {
  return /^```|^~~~/m.test(markdown);
}

export function computeExcerpt(markdown: string, maxLen = 150): string {
  let text = markdown
    .replace(/```[\s\S]*?```/g, "")    // fenced code blocks
    .replace(/`[^`\n]+`/g, "")          // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^#{1,6}\s+/gm, "")        // headings
    .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, "$1") // bold/italic
    .replace(/^\s*[-*+]\s+/gm, "")      // list markers
    .replace(/^\s*\d+\.\s+/gm, "")      // ordered list markers
    .trim();

  const first = text.split(/\n\n+/).map((s) => s.replace(/\s+/g, " ").trim()).find((s) => s.length > 0) ?? "";
  return first.length <= maxLen ? first : first.slice(0, maxLen) + "…";
}
```

- [x] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/core/src/content-stats.test.ts`

Expected: PASS。

- [x] **Step 5: 在 `packages/core/src/index.ts` 追加导出**

读取当前文件，在末尾追加：
```typescript
export { computeExcerpt, computeHasCode, computeWordCount } from "./content-stats.js";
```

- [x] **Step 6: Commit**

```bash
git add packages/core/src/content-stats.ts packages/core/src/content-stats.test.ts packages/core/src/index.ts
git commit -m "feat(core): add content-stats pure functions (excerpt, wordCount, hasCode)"
```

---

## Task 3: DinoSource 传递 coverImage

**Files:**
- Modify: `packages/adapters/src/dino-source.ts`
- Modify: `packages/adapters/src/dino-source.test.ts`

- [x] **Step 1: 更新 `packages/adapters/src/dino-source.test.ts` 的 fixture 和断言**

找到 `toRawCapture` 的测试，在现有断言后追加对 `coverImage` 的断言：

找到 mock CaptureResult（大约在第 20 行附近），在对象里添加 `coverImage: "https://img.example.com/cover.jpg"`：

将整个 describe("toRawCapture") 测试替换为：

```typescript
describe("toRawCapture", () => {
  const result: CaptureResult = {
    url: "https://example.com",
    title: "Test",
    markdown: "hi\n\n![x](assets/a.png)\n\n![y](assets/b.jpg)",
    assets: [
      { path: "assets/a.png", data: new Uint8Array([1]), contentType: "image/png" },
      { path: "assets/b.jpg", data: new Uint8Array([2]), contentType: "image/jpeg" },
    ],
    coverImage: "https://img.example.com/cover.jpg",
  };

  it("rewrites asset paths to amber-asset placeholders", () => {
    const raw = toRawCapture(result);
    expect(raw.markdown).toBe("hi\n\n![x](amber-asset:0)\n\n![y](amber-asset:1)");
  });

  it("passes through coverImage", () => {
    const raw = toRawCapture(result);
    expect(raw.coverImage).toBe("https://img.example.com/cover.jpg");
  });

  it("passes through author and publishedAt when present", () => {
    const withMeta: CaptureResult = { ...result, author: "Alice", publishedAt: "2024-01-01" };
    const raw = toRawCapture(withMeta);
    expect(raw.author).toBe("Alice");
    expect(raw.publishedAt).toBe("2024-01-01");
  });

  it("coverImage is undefined when not provided", () => {
    const noCover: CaptureResult = { ...result, coverImage: undefined };
    const raw = toRawCapture(noCover);
    expect(raw.coverImage).toBeUndefined();
  });
});
```

- [x] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/adapters/src/dino-source.test.ts`

Expected: FAIL（coverImage 未传递）。

- [x] **Step 3: 更新 `packages/adapters/src/dino-source.ts`**

将 `toRawCapture` 返回值中追加 `coverImage` 字段：

```typescript
export function toRawCapture(result: CaptureResult): RawCapture {
  let markdown = result.markdown;
  const assets: Asset[] = result.assets.map((a, i) => {
    const placeholder = `amber-asset:${i}`;
    markdown = markdown.split(`](${a.path})`).join(`](${placeholder})`);
    return { placeholder, data: a.data, contentType: a.contentType };
  });
  return {
    title: result.title,
    markdown,
    author: result.author,
    publishedAt: result.publishedAt,
    coverImage: result.coverImage,
    assets,
  };
}
```

- [x] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/adapters/src/dino-source.test.ts`

Expected: PASS。

- [x] **Step 5: Commit**

```bash
git add packages/adapters/src/dino-source.ts packages/adapters/src/dino-source.test.ts
git commit -m "feat(adapters): pass coverImage through DinoSource"
```

---

## Task 4: ImportService 计算新字段并修复 schema

**Files:**
- Modify: `packages/core/src/import-service.ts`
- Modify: `packages/core/src/import-service.test.ts`

- [x] **Step 1: 更新 `packages/core/src/import-service.test.ts`**

将文件完整替换为：

```typescript
import { describe, expect, it, vi } from "vitest";
import type { BlobStore, Capture, Store } from "@amber/domain";
import { ImportService } from "./import-service.js";

const cap: Capture = {
  id: "c1",
  title: "T",
  content: "body",
  sourceUrl: "https://x/a",
  sourceType: "url",
  capturedAt: "2026-01-01T00:00:00.000Z",
};

function fakeStore(rows: Capture[] = []): Store {
  const saved: Capture[] = [...rows];
  return {
    insert: vi.fn(async (c) => { saved.push(c); }),
    list: vi.fn(async () =>
      saved.map((r) => ({ id: r.id, title: r.title, sourceUrl: r.sourceUrl, capturedAt: r.capturedAt }))
    ),
    get: vi.fn(async (id) => saved.find((r) => r.id === id) ?? null),
    findBySourceUrl: vi.fn(async (url) => saved.find((r) => r.sourceUrl === url) ?? null),
    delete: vi.fn(),
    updateReadStatus: vi.fn(),
    updateTags: vi.fn(),
    recordVisit: vi.fn(),
  };
}

function fakeBlob(): BlobStore {
  return { put: vi.fn(async (key) => `https://cdn.example.com/${key}`) };
}

describe("ImportService.run", () => {
  it("calls source.capture with the given url", async () => {
    const source = { capture: vi.fn(async () => ({ title: "T", markdown: "body", assets: [] })) };
    const svc = new ImportService(source, fakeStore(), fakeBlob());
    await svc.run("https://x/a");
    expect(source.capture).toHaveBeenCalledWith("https://x/a");
  });

  it("stores the capture with capturedAt from deps.now", async () => {
    const source = { capture: vi.fn(async () => ({ title: "T", markdown: "body", assets: [] })) };
    const store = fakeStore();
    const svc = new ImportService(source, store, fakeBlob(), {
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      newId: () => "fixed-id",
    });
    await svc.run("https://x/a");
    const saved = await store.get("fixed-id");
    expect(saved?.capturedAt).toBe("2026-05-31T00:00:00.000Z");
  });

  it("stores publishedAt from raw when provided", async () => {
    const source = { capture: vi.fn(async () => ({ title: "T", markdown: "body", publishedAt: "2024-03-15", assets: [] })) };
    const store = fakeStore();
    const svc = new ImportService(source, store, fakeBlob(), {
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      newId: () => "fixed-id",
    });
    await svc.run("https://x/a");
    const saved = await store.get("fixed-id");
    expect(saved?.publishedAt).toBe("2024-03-15");
    expect(saved?.capturedAt).toBe("2026-05-31T00:00:00.000Z");
  });

  it("stores coverImage from raw when provided", async () => {
    const source = { capture: vi.fn(async () => ({ title: "T", markdown: "body", coverImage: "https://img/cover.jpg", assets: [] })) };
    const store = fakeStore();
    const svc = new ImportService(source, store, fakeBlob(), { newId: () => "cov1" });
    await svc.run("https://x/a");
    const saved = await store.get("cov1");
    expect(saved?.coverImage).toBe("https://img/cover.jpg");
  });

  it("computes wordCount, hasCode, and excerpt at import time", async () => {
    const source = {
      capture: vi.fn(async () => ({
        title: "T",
        markdown: "First paragraph content here.\n\n```js\ncode\n```",
        assets: [],
      })),
    };
    const store = fakeStore();
    const svc = new ImportService(source, store, fakeBlob(), { newId: () => "stats1" });
    await svc.run("https://x/a");
    const saved = await store.get("stats1");
    expect(saved?.wordCount).toBeGreaterThan(0);
    expect(saved?.hasCode).toBe(true);
    expect(saved?.excerpt).toBe("First paragraph content here.");
  });

  it("deduplicates: returns existing id without re-importing", async () => {
    const source = { capture: vi.fn(async () => ({ title: "T", markdown: "body", assets: [] })) };
    const store = fakeStore([cap]);
    const svc = new ImportService(source, store, fakeBlob());
    const id = await svc.run("https://x/a");
    expect(id).toBe("c1");
    expect(source.capture).not.toHaveBeenCalled();
  });

  it("uploads assets and rewrites placeholders in content", async () => {
    const source = {
      capture: vi.fn(async () => ({
        title: "T",
        markdown: "![img](amber-asset:0)",
        assets: [{ placeholder: "amber-asset:0", data: new Uint8Array([1]), contentType: "image/png" }],
      })),
    };
    const blob = fakeBlob();
    const store = fakeStore();
    const svc = new ImportService(source, store, blob, { newId: () => "u1" });
    await svc.run("https://x/a");
    const saved = await store.get("u1");
    expect(saved?.content).toContain("https://cdn.example.com/");
    expect(blob.put).toHaveBeenCalled();
  });

  it("forceId skips dedup and overwrites", async () => {
    const source = { capture: vi.fn(async () => ({ title: "New", markdown: "new body", assets: [] })) };
    const store = fakeStore([cap]);
    const svc = new ImportService(source, store, fakeBlob());
    await svc.run("https://x/a", { forceId: "c1" });
    expect(source.capture).toHaveBeenCalled();
    const saved = await store.get("c1");
    expect(saved?.title).toBe("New");
  });
});
```

- [x] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/core/src/import-service.test.ts`

Expected: FAIL（`capturedAt` / `publishedAt` / `coverImage` / `wordCount` / `hasCode` / `excerpt` 断言失败）。

- [x] **Step 3: 更新 `packages/core/src/import-service.ts`**

```typescript
import type { BlobStore, Capture, Source, Store } from "@amber/domain";
import { assetKey } from "./asset-key.js";
import { computeExcerpt, computeHasCode, computeWordCount } from "./content-stats.js";

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

    const capturedAt = this.now().toISOString();
    const capture: Capture = {
      id,
      title: raw.title,
      content,
      sourceUrl: url,
      sourceType: "url",
      author: raw.author,
      capturedAt,
      publishedAt: raw.publishedAt,
      coverImage: raw.coverImage,
      excerpt: computeExcerpt(content),
      wordCount: computeWordCount(content),
      hasCode: computeHasCode(content),
    };
    await this.store.insert(capture);
    return id;
  }
}
```

- [x] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/core/src/import-service.test.ts`

Expected: PASS。

- [x] **Step 5: Commit**

```bash
git add packages/core/src/import-service.ts packages/core/src/import-service.test.ts
git commit -m "feat(core): compute excerpt/wordCount/hasCode at import; fix capturedAt/publishedAt schema"
```

---

## Task 5: FileStore 更新

**Files:**
- Modify: `packages/adapters/src/file-store.ts`
- Modify: `packages/adapters/src/file-store.test.ts`

- [x] **Step 1: 更新 `packages/adapters/src/file-store.test.ts`**

将文件完整替换为：

```typescript
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Capture } from "@amber/domain";
import { FileStore } from "./file-store.js";

function cap(over: Partial<Capture>): Capture {
  return {
    id: "c1", title: "T", content: "body", sourceUrl: "https://x/a",
    sourceType: "url", capturedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("FileStore", () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "amber-filestore-")); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it("insert then get round-trips a capture", async () => {
    const store = new FileStore(dir);
    const c = cap({ id: "abc", title: "Hello" });
    await store.insert(c);
    expect(await store.get("abc")).toEqual(c);
  });

  it("get returns null for unknown id", async () => {
    const store = new FileStore(dir);
    expect(await store.get("nope")).toBeNull();
  });

  it("list returns summaries sorted by capturedAt desc", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "old", capturedAt: "2026-01-01T00:00:00.000Z" }));
    await store.insert(cap({ id: "new", capturedAt: "2026-02-01T00:00:00.000Z" }));
    const list = await store.list();
    expect(list.map((s) => s.id)).toEqual(["new", "old"]);
    expect(list[0]).toMatchObject({ id: "new", title: "T", sourceUrl: "https://x/a", capturedAt: "2026-02-01T00:00:00.000Z" });
  });

  it("list includes new optional fields when present", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({
      id: "rich",
      coverImage: "https://img/cover.jpg",
      excerpt: "First para.",
      wordCount: 42,
      hasCode: true,
      tags: ["tech", "js"],
    }));
    const list = await store.list();
    expect(list[0].coverImage).toBe("https://img/cover.jpg");
    expect(list[0].excerpt).toBe("First para.");
    expect(list[0].wordCount).toBe(42);
    expect(list[0].hasCode).toBe(true);
    expect(list[0].tags).toEqual(["tech", "js"]);
  });

  it("findBySourceUrl finds a matching capture or null", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "a", sourceUrl: "https://x/one" }));
    expect((await store.findBySourceUrl("https://x/one"))?.id).toBe("a");
    expect(await store.findBySourceUrl("https://x/missing")).toBeNull();
  });

  it("list returns empty when nothing imported yet", async () => {
    const store = new FileStore(dir);
    expect(await store.list()).toEqual([]);
  });

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

  it("updateReadStatus merges readProgress into the stored capture", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "r1" }));
    await store.updateReadStatus("r1", { readProgress: 42 });
    const updated = await store.get("r1");
    expect(updated?.readProgress).toBe(42);
    expect(updated?.readAt).toBeUndefined();
  });

  it("updateReadStatus sets readAt when provided", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "r2" }));
    await store.updateReadStatus("r2", { readProgress: 100, readAt: "2026-06-04T10:00:00.000Z" });
    const updated = await store.get("r2");
    expect(updated?.readAt).toBe("2026-06-04T10:00:00.000Z");
  });

  it("updateReadStatus does not overwrite an existing readAt", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "r3", readAt: "2026-05-01T00:00:00.000Z" }));
    await store.updateReadStatus("r3", { readProgress: 100, readAt: "2026-06-04T10:00:00.000Z" });
    const updated = await store.get("r3");
    expect(updated?.readAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("updateReadStatus is a no-op for unknown ids", async () => {
    const store = new FileStore(dir);
    await expect(store.updateReadStatus("ghost", { readProgress: 50 })).resolves.toBeUndefined();
  });

  it("list includes readProgress and readAt when present", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "rp1", readProgress: 55, readAt: "2026-06-04T00:00:00.000Z" }));
    const list = await store.list();
    expect(list[0].readProgress).toBe(55);
    expect(list[0].readAt).toBe("2026-06-04T00:00:00.000Z");
  });

  it("updateTags replaces tags on the capture", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "t1" }));
    await store.updateTags("t1", ["a", "b"]);
    expect((await store.get("t1"))?.tags).toEqual(["a", "b"]);
  });

  it("updateTags accepts empty array to clear tags", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "t2", tags: ["x"] }));
    await store.updateTags("t2", []);
    expect((await store.get("t2"))?.tags).toEqual([]);
  });

  it("updateTags is a no-op for unknown ids", async () => {
    const store = new FileStore(dir);
    await expect(store.updateTags("ghost", ["a"])).resolves.toBeUndefined();
  });

  it("recordVisit sets lastOpenedAt and increments readCount", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "v1" }));
    await store.recordVisit("v1", "2026-06-05T10:00:00.000Z");
    const updated = await store.get("v1");
    expect(updated?.lastOpenedAt).toBe("2026-06-05T10:00:00.000Z");
    expect(updated?.readCount).toBe(1);
  });

  it("recordVisit increments readCount on each call", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "v2" }));
    await store.recordVisit("v2", "2026-06-05T10:00:00.000Z");
    await store.recordVisit("v2", "2026-06-05T11:00:00.000Z");
    expect((await store.get("v2"))?.readCount).toBe(2);
  });

  it("recordVisit is a no-op for unknown ids", async () => {
    const store = new FileStore(dir);
    await expect(store.recordVisit("ghost", "2026-06-05T10:00:00.000Z")).resolves.toBeUndefined();
  });
});
```

- [x] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/adapters/src/file-store.test.ts`

Expected: FAIL（`capturedAt` 字段缺失、`updateTags` / `recordVisit` 未实现）。

- [x] **Step 3: 将 `packages/adapters/src/file-store.ts` 完整替换为以下内容**

```typescript
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
    all.sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
    return all.map((c) => ({
      id: c.id,
      title: c.title,
      sourceUrl: c.sourceUrl,
      capturedAt: c.capturedAt,
      publishedAt: c.publishedAt,
      coverImage: c.coverImage,
      excerpt: c.excerpt,
      wordCount: c.wordCount,
      hasCode: c.hasCode,
      tags: c.tags,
      readProgress: c.readProgress,
      readAt: c.readAt,
    }));
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

  async updateReadStatus(
    id: string,
    status: { readProgress: number; readAt?: string }
  ): Promise<void> {
    const capture = await this.get(id);
    if (!capture) return;
    capture.readProgress = status.readProgress;
    if (status.readAt && !capture.readAt) {
      capture.readAt = status.readAt;
    }
    await writeFile(this.file(id), JSON.stringify(capture, null, 2), "utf8");
  }

  async updateTags(id: string, tags: string[]): Promise<void> {
    const capture = await this.get(id);
    if (!capture) return;
    capture.tags = tags;
    await writeFile(this.file(id), JSON.stringify(capture, null, 2), "utf8");
  }

  async recordVisit(id: string, visitedAt: string): Promise<void> {
    const capture = await this.get(id);
    if (!capture) return;
    capture.lastOpenedAt = visitedAt;
    capture.readCount = (capture.readCount ?? 0) + 1;
    await writeFile(this.file(id), JSON.stringify(capture, null, 2), "utf8");
  }
}
```

- [x] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/adapters/src/file-store.test.ts`

Expected: PASS。

- [x] **Step 5: Commit**

```bash
git add packages/adapters/src/file-store.ts packages/adapters/src/file-store.test.ts
git commit -m "feat(adapters): update FileStore for new schema; add updateTags and recordVisit"
```

---

## Task 6: ReadService 委托新方法

**Files:**
- Modify: `packages/core/src/read-service.ts`
- Modify: `packages/core/src/read-service.test.ts`

- [x] **Step 1: 更新 `packages/core/src/read-service.test.ts`**

将文件完整替换为：

```typescript
import { describe, expect, it, vi } from "vitest";
import type { Store } from "@amber/domain";
import { ReadService } from "./read-service.js";

const cap = {
  id: "c1", title: "T", content: "body", sourceUrl: "https://x/a",
  sourceType: "url" as const, capturedAt: "2026-01-01T00:00:00.000Z",
};

function fakeStore(): Store {
  return {
    insert: vi.fn(),
    list: vi.fn(async () => [{ id: cap.id, title: cap.title, sourceUrl: cap.sourceUrl, capturedAt: cap.capturedAt }]),
    get: vi.fn(async (id: string) => (id === "c1" ? cap : null)),
    findBySourceUrl: vi.fn(async (url: string) => (url === "https://x/a" ? cap : null)),
    delete: vi.fn(),
    updateReadStatus: vi.fn(),
    updateTags: vi.fn(),
    recordVisit: vi.fn(),
  };
}

describe("ReadService", () => {
  it("list delegates to store.list", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    const result = await svc.list();
    expect(store.list).toHaveBeenCalled();
    expect(result[0].id).toBe("c1");
  });

  it("get delegates to store.get", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    expect(await svc.get("c1")).toEqual(cap);
    expect(await svc.get("x")).toBeNull();
  });

  it("findBySourceUrl delegates to store.findBySourceUrl", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    expect(await svc.findBySourceUrl("https://x/a")).toEqual(cap);
    expect(await svc.findBySourceUrl("https://other")).toBeNull();
  });

  it("delegates updateReadStatus to the store", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    await svc.updateReadStatus("c1", { readProgress: 70 });
    expect(store.updateReadStatus).toHaveBeenCalledWith("c1", { readProgress: 70 });
  });

  it("delegates updateTags to the store", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    await svc.updateTags("c1", ["a", "b"]);
    expect(store.updateTags).toHaveBeenCalledWith("c1", ["a", "b"]);
  });

  it("delegates recordVisit to the store", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    await svc.recordVisit("c1", "2026-06-05T10:00:00.000Z");
    expect(store.recordVisit).toHaveBeenCalledWith("c1", "2026-06-05T10:00:00.000Z");
  });
});
```

- [x] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/core/src/read-service.test.ts`

Expected: FAIL（`updateTags` / `recordVisit` 未定义）。

- [x] **Step 3: 将 `packages/core/src/read-service.ts` 完整替换**

```typescript
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

  updateReadStatus(
    id: string,
    status: { readProgress: number; readAt?: string }
  ): Promise<void> {
    return this.store.updateReadStatus(id, status);
  }

  updateTags(id: string, tags: string[]): Promise<void> {
    return this.store.updateTags(id, tags);
  }

  recordVisit(id: string, visitedAt: string): Promise<void> {
    return this.store.recordVisit(id, visitedAt);
  }
}
```

- [x] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/core/src/read-service.test.ts`

Expected: PASS。

- [x] **Step 5: Commit**

```bash
git add packages/core/src/read-service.ts packages/core/src/read-service.test.ts
git commit -m "feat(core): add updateTags and recordVisit to ReadService"
```

---

## Task 7: Web 路由 — 访问记录 + tags 端点

**Files:**
- Modify: `packages/web/src/index.ts`
- Modify: `packages/web/src/index.test.ts`

- [x] **Step 1: 将 `packages/web/src/index.test.ts` 完整替换为以下内容**

```typescript
import { describe, expect, it, vi } from "vitest";
import type { ReadService } from "@amber/core";
import type { Capture } from "@amber/domain";
import { contentTypeForPath, createApp } from "./index.js";

const captures: Capture[] = [
  {
    id: "c1",
    title: "First",
    content: "# First Body\n\n## Intro\n\ntext\n\n### Detail\n\nmore",
    sourceUrl: "https://example.com/a",
    sourceType: "url",
    capturedAt: "2026-06-02T00:00:00.000Z",
  },
  {
    id: "c2",
    title: "Second",
    content: "# Second Body\n\n## Section\n\ntext\n\n### Notes\n\nmore",
    sourceUrl: "https://example.org/b",
    sourceType: "url",
    capturedAt: "2026-06-01T00:00:00.000Z",
  },
];

function fakeReadService(): ReadService {
  return {
    list: async () =>
      captures.map(({ id, title, sourceUrl, capturedAt }) => ({ id, title, sourceUrl, capturedAt })),
    get: async (id: string) => captures.find((c) => c.id === id) ?? null,
    findBySourceUrl: async (sourceUrl: string) =>
      captures.find((c) => c.sourceUrl === sourceUrl) ?? null,
    updateReadStatus: vi.fn(),
    updateTags: vi.fn(),
    recordVisit: vi.fn(),
  } as unknown as ReadService;
}

describe("createApp", () => {
  it("renders the list page on / without the article shell", async () => {
    const app = createApp(fakeReadService(), { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/");
    const html = await res.text();
    expect(html).toContain('<input id="search"');
    expect(html).toContain('href="/captures/c1"');
    expect(html).toContain('href="/captures/c2"');
    expect(html).toContain('action="/captures/c1/delete"');
    expect(html).not.toContain('class="article-shell"');
  });

  it("renders the selected capture on /captures/:id as a focused article", async () => {
    const app = createApp(fakeReadService(), { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/c2");
    const html = await res.text();
    expect(html).toContain('class="article-shell"');
    expect(html).toContain('class="toc"');
    expect(html).toContain('<h1 class="article-title-anchor">Second</h1>');
    expect(html).toContain('href="#section"');
    expect(html).toContain('data-capture-id="c2"');
    expect(html).not.toContain('action="/captures/c2/delete"');
    expect(html).not.toContain('class="group"');
  });

  it("article page includes link to adjacent capture via data-nav", async () => {
    const app = createApp(fakeReadService(), { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/c2");
    const html = await res.text();
    expect(html).toContain('data-nav="prev"');
    expect(html).toContain('href="/captures/c1"');
  });

  it("first article has no prev neighbor but has next", async () => {
    const app = createApp(fakeReadService(), { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/c1");
    const html = await res.text();
    expect(html).not.toContain('data-nav="prev"');
    expect(html).toContain('data-nav="next"');
    expect(html).toContain('href="/captures/c2"');
  });

  it("GET /captures/:id calls recordVisit", async () => {
    const svc = fakeReadService();
    const app = createApp(svc, { blobsDir: "/tmp", deleteCapture: async () => {} });
    await app.request("/captures/c1");
    expect(svc.recordVisit).toHaveBeenCalledWith("c1", expect.any(String));
  });

  it("PATCH /captures/:id/read calls updateReadStatus and returns 204", async () => {
    const svc = fakeReadService();
    const app = createApp(svc, { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/c1/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readProgress: 55 }),
    });
    expect(res.status).toBe(204);
    expect(svc.updateReadStatus).toHaveBeenCalledWith("c1", { readProgress: 55 });
  });

  it("PATCH /captures/:id/tags calls updateTags and returns 204", async () => {
    const svc = fakeReadService();
    const app = createApp(svc, { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/c1/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["reading", "tech"] }),
    });
    expect(res.status).toBe(204);
    expect(svc.updateTags).toHaveBeenCalledWith("c1", ["reading", "tech"]);
  });

  it("deletes a capture and redirects back to the list", async () => {
    const deleted: string[] = [];
    const app = createApp(fakeReadService(), {
      blobsDir: "/tmp",
      deleteCapture: async (id) => { deleted.push(id); },
    });
    const res = await app.request("/captures/c2/delete", { method: "POST" });
    expect(deleted).toEqual(["c2"]);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  });
});

describe("contentTypeForPath", () => {
  it("returns video MIME types for local video blobs", () => {
    expect(contentTypeForPath("captures/c1/2.mp4")).toBe("video/mp4");
    expect(contentTypeForPath("captures/c1/2.webm")).toBe("video/webm");
    expect(contentTypeForPath("captures/c1/2.ogv")).toBe("video/ogg");
    expect(contentTypeForPath("captures/c1/2.mov")).toBe("video/quicktime");
  });
});
```

- [x] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/web/src/index.test.ts`

Expected: FAIL（recordVisit 未调用，/tags 路由不存在）。

- [x] **Step 3: 将 `packages/web/src/index.ts` 完整替换**

```typescript
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { ReadService } from "@amber/core";
import { renderArticle, renderList } from "./render.js";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg",
  ".mov": "video/quicktime",
};

export function contentTypeForPath(path: string): string {
  return MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
}

export interface WebOptions {
  blobsDir: string;
  deleteCapture: (id: string) => Promise<void>;
  onReady?: () => void;
}

export function createApp(readService: ReadService, options: WebOptions): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const items = await readService.list();
    return c.html(renderList(items));
  });

  app.get("/captures/:id", async (c) => {
    const id = c.req.param("id");
    const [capture, all] = await Promise.all([readService.get(id), readService.list()]);
    if (!capture) return c.html("<p>Not found. <a href='/'>back</a></p>", 404);
    void readService.recordVisit(id, new Date().toISOString());
    const idx = all.findIndex((s) => s.id === id);
    const neighbors = idx === -1
      ? { prev: null, next: null }
      : {
          prev: idx > 0 ? all[idx - 1] : null,
          next: idx < all.length - 1 ? all[idx + 1] : null,
        };
    return c.html(await renderArticle(capture, neighbors));
  });

  app.post("/captures/:id/delete", async (c) => {
    await options.deleteCapture(c.req.param("id"));
    return c.redirect("/", 303);
  });

  app.patch("/captures/:id/read", async (c) => {
    const body = await c.req.json<{ readProgress: number; readAt?: string }>();
    await readService.updateReadStatus(c.req.param("id"), body);
    return c.body(null, 204);
  });

  app.patch("/captures/:id/tags", async (c) => {
    const body = await c.req.json<{ tags: string[] }>();
    await readService.updateTags(c.req.param("id"), body.tags ?? []);
    return c.body(null, 204);
  });

  app.get("/blobs/*", async (c) => {
    const rel = normalize(c.req.path.slice("/blobs/".length));
    if (rel.startsWith("..")) return c.notFound();
    const file = join(options.blobsDir, rel);
    try {
      const info = await stat(file);
      if (!info.isFile()) return c.notFound();
    } catch {
      return c.notFound();
    }
    const stream = createReadStream(file) as unknown as ReadableStream;
    return new Response(stream, { headers: { "content-type": contentTypeForPath(rel) } });
  });

  return app;
}

export function startServer(readService: ReadService, options: WebOptions & { port: number }): void {
  const app = createApp(readService, { blobsDir: options.blobsDir, deleteCapture: options.deleteCapture });
  serve({ fetch: app.fetch, port: options.port }, () => options.onReady?.());
}
```

- [x] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/web/src/index.test.ts`

Expected: PASS。

- [x] **Step 5: Commit**

```bash
git add packages/web/src/index.ts packages/web/src/index.test.ts
git commit -m "feat(web): record visits on GET /:id; add PATCH /:id/tags endpoint"
```

---

## Task 8: Render 更新

**Files:**
- Modify: `packages/web/src/render.ts`
- Modify: `packages/web/src/render.test.ts`

- [x] **Step 1: 更新 `packages/web/src/render.test.ts`**

将文件开头的 `CAPTURE` fixture 和 `CaptureSummary` fixture 中的 `createdAt` 全部改为 `capturedAt`（`createdAt` 字段已从 domain 中移除）。

具体改动点：
1. `CAPTURE` 对象：去掉 `createdAt`，保留 `capturedAt`。
2. `NEIGHBORS` 中的两个对象：把 `createdAt` 改为 `capturedAt`。
3. `describe("renderList")` 中的内联 fixture：把 `createdAt` 改为 `capturedAt`。
4. 新增测试：`renderList` 展示 excerpt（若有）。
5. 新增测试：`renderArticle` meta 行展示 publishedAt（若有）。

将 `packages/web/src/render.test.ts` 完整替换为：

```typescript
import { describe, expect, it } from "vitest";
import type { Capture, CaptureSummary } from "@amber/domain";
import { escapeHtml, groupByWeek, readingStats, renderArticle, renderList } from "./render.js";

const CAPTURE: Capture = {
  id: "c1",
  title: "Hello World",
  content: "# Hello\n\n## Section A\n\nsome text here\n\n### Sub A\n\nmore text\n\n## Section B\n\nfinal text",
  sourceUrl: "https://example.com/article",
  sourceType: "url",
  capturedAt: "2026-06-01T00:00:00.000Z",
};

describe("escapeHtml", () => {
  it("escapes &, <, >, and quotes", () => {
    expect(escapeHtml('a & <b> "c"')).toBe("a &amp; &lt;b&gt; &quot;c&quot;");
  });
  it("returns the same string when no special chars", () => {
    expect(escapeHtml("hello")).toBe("hello");
  });
});

describe("readingStats", () => {
  it("counts non-whitespace chars excluding fenced code blocks", () => {
    const { chars } = readingStats("hello world");
    expect(chars).toBe(10);
  });
  it("returns at least 1 minute", () => {
    expect(readingStats("x").minutes).toBe(1);
  });
});

describe("groupByWeek", () => {
  it("puts items into this week, last week, and earlier buckets", () => {
    const now = new Date("2026-06-08T00:00:00.000Z"); // Monday
    const items: CaptureSummary[] = [
      { id: "a", title: "A", sourceUrl: "https://a.com", capturedAt: "2026-06-08T00:00:00.000Z" },
      { id: "b", title: "B", sourceUrl: "https://b.com", capturedAt: "2026-06-01T00:00:00.000Z" },
      { id: "c", title: "C", sourceUrl: "https://c.com", capturedAt: "2026-05-01T00:00:00.000Z" },
    ];
    const groups = groupByWeek(items, now);
    expect(groups[0].label).toBe("本周");
    expect(groups[0].items[0].id).toBe("a");
    expect(groups[1].label).toBe("上周");
    expect(groups[1].items[0].id).toBe("b");
    expect(groups[2].label).toBe("更早");
    expect(groups[2].items[0].id).toBe("c");
  });

  it("omits empty groups", () => {
    const now = new Date("2026-06-08T00:00:00.000Z");
    const items: CaptureSummary[] = [
      { id: "a", title: "A", sourceUrl: "https://a.com", capturedAt: "2026-06-08T00:00:00.000Z" },
    ];
    const groups = groupByWeek(items, now);
    expect(groups.length).toBe(1);
  });
});

describe("renderList", () => {
  it("renders list items with links and delete buttons", () => {
    const items: CaptureSummary[] = [
      { id: "c1", title: "First", sourceUrl: "https://example.com/a", capturedAt: "2020-01-15T00:00:00.000Z" },
    ];
    const html = renderList(items);
    expect(html).toContain('href="/captures/c1"');
    expect(html).toContain("First");
    expect(html).toContain('action="/captures/c1/delete"');
  });

  it("escapes HTML in title and URL", () => {
    const items: CaptureSummary[] = [
      { id: "s1", title: 'Hello "World"', sourceUrl: "https://example.com/a", capturedAt: "2020-01-15T00:00:00.000Z" },
    ];
    const html = renderList(items);
    expect(html).toContain("Hello &quot;World&quot;");
    expect(html).not.toContain('"Hello "World""');
  });

  it("shows empty-state message when no items", () => {
    expect(renderList([])).toContain("No captures yet");
  });

  it("includes search bar", () => {
    expect(renderList([])).toContain('<input id="search"');
  });

  it("injects data-read-progress and data-read-at on items with read status", () => {
    const items: CaptureSummary[] = [
      { id: "r1", title: "Read Article", sourceUrl: "https://example.com/r", capturedAt: "2026-06-04T00:00:00.000Z", readProgress: 55, readAt: "2026-06-04T12:00:00.000Z" },
    ];
    const html = renderList(items);
    expect(html).toContain('data-read-progress="55"');
    expect(html).toContain('data-read-at="2026-06-04T12:00:00.000Z"');
  });

  it("renders excerpt when available", () => {
    const items: CaptureSummary[] = [
      { id: "e1", title: "With Excerpt", sourceUrl: "https://example.com/e", capturedAt: "2026-06-04T00:00:00.000Z", excerpt: "This is the excerpt text." },
    ];
    const html = renderList(items);
    expect(html).toContain("This is the excerpt text.");
  });
});

describe("renderArticle", () => {
  it("renders the article title and content", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain("Hello World");
    expect(html).toContain("some text here");
  });

  it("renders table of contents for articles with 2+ h2/h3", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="toc"');
    expect(html).toContain('href="#section-a"');
    expect(html).toContain('href="#section-b"');
  });

  it("omits table of contents for articles with fewer than 2 headings", async () => {
    const html = await renderArticle({ ...CAPTURE, content: "# Heading\n\n## Only one\n\ntext" });
    expect(html).not.toContain('class="toc"');
  });

  it("renders source link in meta", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('href="https://example.com/article"');
    expect(html).toContain("example.com");
  });

  const NEIGHBORS = {
    prev: { id: "p1", title: "Prev Article", sourceUrl: "https://prev.com/a", capturedAt: "2026-06-02T00:00:00.000Z" },
    next: { id: "n1", title: "Next Article", sourceUrl: "https://next.com/a", capturedAt: "2026-05-30T00:00:00.000Z" },
  };

  it("injects data-capture-id and data-read-progress on article-shell", async () => {
    const cap = { ...CAPTURE, readProgress: 42 };
    const html = await renderArticle(cap);
    expect(html).toContain('data-capture-id="c1"');
    expect(html).toContain('data-read-progress="42"');
  });

  it("data-read-progress defaults to 0 when readProgress is absent", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('data-read-progress="0"');
  });

  it("injects data-total-chars on article-shell", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toMatch(/data-total-chars="\d+"/);
  });

  it("renders prev/next footer with data-nav attributes when neighbors provided", async () => {
    const html = await renderArticle(CAPTURE, NEIGHBORS);
    expect(html).toContain('data-nav="prev"');
    expect(html).toContain('data-nav="next"');
    expect(html).toContain('href="/captures/p1"');
    expect(html).toContain('href="/captures/n1"');
    expect(html).toContain("Prev Article");
    expect(html).toContain("Next Article");
  });

  it("omits footer when no neighbors", async () => {
    const html = await renderArticle(CAPTURE, { prev: null, next: null });
    expect(html).not.toContain('data-nav="prev"');
    expect(html).not.toContain('data-nav="next"');
    expect(html).not.toContain('class="article-footer"');
  });

  it("renders prev card only when only prev neighbor exists", async () => {
    const html = await renderArticle(CAPTURE, { prev: NEIGHBORS.prev, next: null });
    expect(html).toContain('data-nav="prev"');
    expect(html).not.toContain('data-nav="next"');
  });

  it("renders next card only when only next neighbor exists", async () => {
    const html = await renderArticle(CAPTURE, { prev: null, next: NEIGHBORS.next });
    expect(html).not.toContain('data-nav="prev"');
    expect(html).toContain('data-nav="next"');
  });

  it("renders meta-remaining span in meta line", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="meta-remaining"');
  });

  it("renders font control buttons in topbar", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="font-ctrl"');
    expect(html).toContain('data-dir="down"');
    expect(html).toContain('data-dir="up"');
  });

  it("renders progress bar and scroll-to-top elements", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="read-progress-bar"');
    expect(html).toContain('class="scroll-top-btn"');
  });

  it("shows publishedAt in meta when provided", async () => {
    const html = await renderArticle({ ...CAPTURE, publishedAt: "2024-03-15" });
    expect(html).toContain("2024-03-15");
  });
});
```

- [x] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/web/src/render.test.ts`

Expected: FAIL（`createdAt` 字段不存在；publishedAt 测试失败）。

- [x] **Step 3: 更新 `packages/web/src/render.ts`**

需要修改三处：

**a. `groupByWeek`：把 `item.createdAt` 改为 `item.capturedAt`**

```typescript
export function groupByWeek(items: CaptureSummary[], now = new Date()): Group[] {
  const daysToMonday = (now.getUTCDay() + 6) % 7;
  const thisMonday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday);
  const lastMonday = thisMonday - 7 * 24 * 60 * 60 * 1000;
  const groups: Group[] = [
    { label: "本周", items: [] },
    { label: "上周", items: [] },
    { label: "更早", items: [] },
  ];
  for (const item of items) {
    const ts = new Date(item.capturedAt).getTime();
    if (ts >= thisMonday) groups[0].items.push(item);
    else if (ts >= lastMonday) groups[1].items.push(item);
    else groups[2].items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}
```

**b. `renderList`：日期用 `capturedAt`；追加 excerpt 展示**

在 `renderList` 的列表行生成部分（`const rowsHtml = g.items.map((i) => {` 内）：
- 把 `const date = i.createdAt.slice(0, 10);` 改为 `const date = i.capturedAt.slice(0, 10);`
- 在 `.muted` div 之后、form 之前，加入 excerpt：

```typescript
const excerptHtml = i.excerpt
  ? `<div class="excerpt">${escapeHtml(i.excerpt)}</div>`
  : "";
```

然后把 `item-main` 的内容改为：
```typescript
`<div class="item-main"><a href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>` +
`<div class="muted">${escapeHtml(hostname)} · ${date}</div>` +
excerptHtml +
`</div>` +
```

**c. `renderArticle`：在 meta 行加上 publishedAt**

找到 meta 构建部分，改为：

```typescript
const publishedLine = capture.publishedAt
  ? ` · 发布于 ${escapeHtml(capture.publishedAt.slice(0, 10))}`
  : "";
const meta =
  `<p class="meta">${chars} 字 · ` +
  `<span class="meta-remaining">约 ${minutes} 分钟</span> · ` +
  `<a href="${escapeHtml(capture.sourceUrl)}">${escapeHtml(hostname)} ↗</a>` +
  publishedLine +
  `</p>`;
```

**d. `data-total-chars`：优先用 `capture.wordCount`**

找到 `const { chars, minutes } = readingStats(capture.content);`，改为：

```typescript
const { chars: computedChars, minutes: computedMinutes } = readingStats(capture.content);
const chars = capture.wordCount ?? computedChars;
const minutes = Math.max(1, Math.round(chars / 300));
```

（注意：保持 `chars` 和 `minutes` 变量名不变，下面的代码可以零改动）

- [x] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/web/src/render.test.ts`

Expected: PASS。

- [x] **Step 5: 给 excerpt 加一行样式**

在 `packages/web/src/styles.ts` 的 `.item-main a` 附近追加（`.code-block` 之前）：

```css
.excerpt { font-size: .8rem; color: var(--text-muted); margin-top: .15rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
```

- [x] **Step 6: Commit**

```bash
git add packages/web/src/render.ts packages/web/src/render.test.ts packages/web/src/styles.ts
git commit -m "feat(web): use capturedAt for sorting; show excerpt and publishedAt in render"
```

---

## Task 9: 全面验证

**Files:** 无新增文件。

- [x] **Step 1: 运行全部测试**

```bash
pnpm exec vitest run
```

Expected: 全部 PASS，0 failures。

- [x] **Step 2: 类型检查**

```bash
pnpm run typecheck
```

Expected: 0 errors。

- [x] **Step 3: 检查文件行数**

```bash
wc -l packages/domain/src/index.ts \
       packages/core/src/content-stats.ts \
       packages/core/src/import-service.ts \
       packages/core/src/read-service.ts \
       packages/adapters/src/file-store.ts \
       packages/web/src/render.ts \
       packages/web/src/index.ts
```

Expected: 每个文件 ≤ 500 行。
