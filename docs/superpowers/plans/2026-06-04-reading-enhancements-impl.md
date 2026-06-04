# Reading Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Amber Web UI 的阅读页和列表页增加进度条、TOC 高亮、复制按钮、字体控制、键盘快捷键、回到顶部、动态剩余时间、阅读进度服务端持久化、已读状态列表展示、上一篇/下一篇导航。

**Architecture:** Domain 层新增 `readProgress` / `readAt` 字段和 `updateReadStatus` Store 方法；FileStore 实现该方法；Web 层新增 `PATCH /captures/:id/read` 端点并在 detail 路由取相邻 capture；所有客户端交互以脚本函数形式注入 HTML，共用单一 rAF 节流 scroll 监听器。

**Tech Stack:** TypeScript, Hono, Vitest, markdown-it, shiki.

---

## File Structure

| 文件 | 变更类型 | 职责 |
|------|---------|------|
| `packages/domain/src/index.ts` | Modify | 新增 `readProgress?`/`readAt?` 字段；更新 `CaptureSummary` Pick；新增 `updateReadStatus` Store 方法 |
| `packages/adapters/src/file-store.ts` | Modify | 实现 `updateReadStatus`；更新 `list()` 返回新字段 |
| `packages/adapters/src/file-store.test.ts` | Modify | 新增 `updateReadStatus` 测试 |
| `packages/core/src/read-service.ts` | Modify | 新增 `updateReadStatus` 方法 |
| `packages/core/src/read-service.test.ts` | Modify | 更新 fakeStore；新增测试 |
| `packages/web/src/render.ts` | Modify | `renderArticle` 接收 neighbors；注入 data 属性；prev/next footer；renderList data 属性 |
| `packages/web/src/render.test.ts` | Modify | 更新 `renderArticle` 调用签名；新增 neighbors/data 断言 |
| `packages/web/src/index.ts` | Modify | `PATCH /captures/:id/read`；detail 路由查询相邻 capture |
| `packages/web/src/index.test.ts` | Modify | 更新 fakeReadService；新增 PATCH 测试；修正已失效断言 |
| `packages/web/src/styles.ts` | Modify | 新增进度条、复制按钮、字体控件、回顶按钮、footer、已读指示器样式 |
| `packages/web/src/styles.test.ts` | Modify | 新增样式选择器断言 |
| `packages/web/src/scripts.ts` | Modify | 新增 `calcReadProgress`、`calcRemainingMinutes`（纯函数）；`getReaderEnhancementsScriptHtml`；`getReadIndicatorScriptHtml` |
| `packages/web/src/scripts.test.ts` | Modify | 新增纯函数单元测试和 HTML 断言 |

---

## Task 1: Domain 类型更新

**Files:**
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: 更新 domain 类型**

将 `packages/domain/src/index.ts` 替换为：

```typescript
/** 一份被收藏的内容，是跨所有版本被存储与阅读的基本单元。 */
export interface Capture {
  id: string;
  title: string;
  content: string;
  sourceUrl: string;
  sourceType: "url";
  author?: string;
  createdAt: string;
  capturedAt: string;
  readProgress?: number; // 0–100，滚动百分比整数
  readAt?: string;       // ISO 8601，首次读完时写入，不随进度回退
}

export type CaptureSummary = Pick<
  Capture,
  "id" | "title" | "sourceUrl" | "createdAt" | "readProgress" | "readAt"
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
}

/** 二进制/对象存储。`put` 返回公开 URL。 */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType?: string): Promise<string>;
}
```

- [ ] **Step 2: 确认 typecheck 通过**

运行：`pnpm run typecheck`

Expected: 报错（FileStore 和 ReadService 尚未实现 `updateReadStatus`），说明类型变更生效。这些错误在后续 Task 中修复。

---

## Task 2: FileStore 实现 updateReadStatus

**Files:**
- Modify: `packages/adapters/src/file-store.ts`
- Modify: `packages/adapters/src/file-store.test.ts`

- [ ] **Step 1: 写失败测试**

在 `packages/adapters/src/file-store.test.ts` 的 `describe("FileStore")` 块末尾追加：

```typescript
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
    await store.insert(cap({ id: "r3", readAt: "2026-05-01T00:00:00.000Z" } as Capture));
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
    await store.insert(cap({ id: "rp1", readProgress: 55, readAt: "2026-06-04T00:00:00.000Z" } as Capture));
    const list = await store.list();
    expect(list[0].readProgress).toBe(55);
    expect(list[0].readAt).toBe("2026-06-04T00:00:00.000Z");
  });
```

- [ ] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/adapters/src/file-store.test.ts`

Expected: FAIL（`updateReadStatus is not a function`）。

- [ ] **Step 3: 实现 updateReadStatus 并更新 list()**

将 `packages/adapters/src/file-store.ts` 中的 `list()` 和 `delete()` 之间插入，并替换 `list()` 实现：

```typescript
  async list(): Promise<CaptureSummary[]> {
    const all = await this.readAll();
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return all.map((c) => ({
      id: c.id,
      title: c.title,
      sourceUrl: c.sourceUrl,
      createdAt: c.createdAt,
      readProgress: c.readProgress,
      readAt: c.readAt,
    }));
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
```

- [ ] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/adapters/src/file-store.test.ts`

Expected: PASS（全部测试）。

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/index.ts packages/adapters/src/file-store.ts packages/adapters/src/file-store.test.ts
git commit -m "feat(domain,adapters): add readProgress/readAt fields and updateReadStatus"
```

---

## Task 3: ReadService.updateReadStatus

**Files:**
- Modify: `packages/core/src/read-service.ts`
- Modify: `packages/core/src/read-service.test.ts`

- [ ] **Step 1: 写失败测试**

在 `packages/core/src/read-service.test.ts` 中：

1. 将 `fakeStore()` 更新为实现完整 Store 接口（新增 `updateReadStatus`）：

```typescript
function fakeStore(): Store {
  return {
    insert: vi.fn(),
    list: vi.fn(async () => [{ id: cap.id, title: cap.title, sourceUrl: cap.sourceUrl, createdAt: cap.createdAt }]),
    get: vi.fn(async (id: string) => (id === "c1" ? cap : null)),
    findBySourceUrl: vi.fn(async (url: string) => (url === "https://x/a" ? cap : null)),
    delete: vi.fn(),
    updateReadStatus: vi.fn(),
  };
}
```

2. 在 `describe("ReadService")` 块末尾追加：

```typescript
  it("delegates updateReadStatus to the store", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    await svc.updateReadStatus("c1", { readProgress: 70 });
    expect(store.updateReadStatus).toHaveBeenCalledWith("c1", { readProgress: 70 });
  });
```

- [ ] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/core/src/read-service.test.ts`

Expected: FAIL（`svc.updateReadStatus is not a function`）。

- [ ] **Step 3: 实现 ReadService.updateReadStatus**

将 `packages/core/src/read-service.ts` 替换为：

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
}
```

- [ ] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/core/src/read-service.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/read-service.ts packages/core/src/read-service.test.ts
git commit -m "feat(core): add updateReadStatus to ReadService"
```

---

## Task 4: renderArticle — neighbors、data 属性、footer

**Files:**
- Modify: `packages/web/src/render.ts`
- Modify: `packages/web/src/render.test.ts`

- [ ] **Step 1: 写失败测试**

在 `packages/web/src/render.test.ts` 的 `describe("renderArticle")` 块末尾追加：

```typescript
  const NEIGHBORS = {
    prev: { id: "p1", title: "Prev Article", sourceUrl: "https://prev.com/a", createdAt: "2026-06-02T00:00:00.000Z" },
    next: { id: "n1", title: "Next Article", sourceUrl: "https://next.com/a", createdAt: "2026-05-30T00:00:00.000Z" },
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
```

- [ ] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/web/src/render.test.ts`

Expected: FAIL（新断言失败）。

- [ ] **Step 3a: 在 scripts.ts 末尾添加 stub（Task 7 会替换为完整实现）**

在 `packages/web/src/scripts.ts` 末尾追加（两个空实现，让 render.ts 的 import 可以解析）：

```typescript
export function calcReadProgress(_scrollTop: number, _scrollHeight: number, _clientHeight: number): number { return 0; }
export function calcRemainingMinutes(_totalChars: number, _progress: number): number { return 0; }
export function getReaderEnhancementsScriptHtml(): string { return ''; }
export function getReadIndicatorScriptHtml(): string { return ''; }
```

- [ ] **Step 3b: 实现 render.ts 变更**

将 `packages/web/src/render.ts` 完整替换为：

```typescript
import type { Capture, CaptureSummary } from "@amber/domain";
import { getStyles } from "./styles.js";
import {
  getThemeSwitcherHtml,
  getThemeScriptHtml,
  getSearchBarHtml,
  getListFilterScriptHtml,
  getReaderHeaderScriptHtml,
  getDeleteConfirmScriptHtml,
  getReaderEnhancementsScriptHtml,
  getReadIndicatorScriptHtml,
} from "./scripts.js";
import { renderMarkdown } from "./highlight.js";
import { extractToc, type TocItem } from "./toc.js";

export interface Group {
  label: string;
  items: CaptureSummary[];
}

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
    const ts = new Date(item.createdAt).getTime();
    if (ts >= thisMonday) groups[0].items.push(item);
    else if (ts >= lastMonday) groups[1].items.push(item);
    else groups[2].items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function readingStats(markdown: string): { chars: number; minutes: number } {
  const chars = markdown.replace(/```[\s\S]*?```/g, "").replace(/\s/g, "").length;
  const minutes = Math.max(1, Math.round(chars / 300));
  return { chars, minutes };
}

function page(title: string, body: string, bodyClass = ""): string {
  const classAttr = bodyClass ? ` class="${escapeHtml(bodyClass)}"` : "";
  return `<!doctype html><html lang="zh" data-theme="minimal"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${getStyles()}
${getThemeScriptHtml()}
</head><body${classAttr}>${body}</body></html>`;
}

export function renderList(items: CaptureSummary[]): string {
  const searchBar = getSearchBarHtml();
  const switcher = getThemeSwitcherHtml();
  const header = `<div class="header"><h1>Amber</h1><div class="header-right">${searchBar}${switcher}</div></div>`;

  if (items.length === 0) {
    const body = header + "<p class='muted'>No captures yet. Run: amber import &lt;url&gt;</p>";
    return page("Amber", body);
  }

  const groups = groupByWeek(items);
  const sectionsHtml = groups
    .map((g) => {
      const rowsHtml = g.items
        .map((i) => {
          const hostname = new URL(i.sourceUrl).hostname;
          const date = i.createdAt.slice(0, 10);
          const rp = escapeHtml(String(i.readProgress ?? ""));
          const ra = escapeHtml(i.readAt ?? "");
          return (
            `<div class="item" data-title="${escapeHtml(i.title.toLowerCase())}" data-host="${escapeHtml(hostname)}" data-read-progress="${rp}" data-read-at="${ra}">` +
            `<div class="item-main"><a href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>` +
            `<div class="muted">${escapeHtml(hostname)} · ${date}</div></div>` +
            `<form class="delete-form" method="post" action="/captures/${escapeHtml(i.id)}/delete" data-title="${escapeHtml(i.title)}">` +
            `<button class="delete-btn" type="submit" title="删除">删除</button>` +
            `</form></div>`
          );
        })
        .join("");
      return (
        `<section class="group" data-group>` +
        `<h2 class="group-label">${escapeHtml(g.label)} <span class="count">${g.items.length}</span></h2>` +
        rowsHtml +
        `</section>`
      );
    })
    .join("");

  const body = header + sectionsHtml + getListFilterScriptHtml() + getDeleteConfirmScriptHtml() + getReadIndicatorScriptHtml();
  return page("Amber", body);
}

function renderTocList(toc: TocItem[]): string {
  return toc
    .map((item) => {
      const id = escapeHtml(item.id);
      return `<li class="toc-item level-${item.level}"><a href="#${id}">${escapeHtml(item.text)}</a></li>`;
    })
    .join("");
}

function renderDesktopToc(toc: TocItem[]): string {
  return (
    `<nav class="toc" aria-label="目录">` +
    `<div class="toc-title">目录</div>` +
    `<ol class="toc-list">${renderTocList(toc)}</ol>` +
    `</nav>`
  );
}

function renderMobileToc(toc: TocItem[]): string {
  return (
    `<details class="toc-mobile">` +
    `<summary>目录</summary>` +
    `<ol class="toc-list">${renderTocList(toc)}</ol>` +
    `</details>`
  );
}

function renderArticleFooter(
  prev: CaptureSummary | null,
  next: CaptureSummary | null
): string {
  if (!prev && !next) return "";
  const prevCard = prev
    ? `<a class="nav-card" href="/captures/${escapeHtml(prev.id)}" data-nav="prev">` +
      `<span class="nav-dir">← 上一篇</span>` +
      `<span class="nav-title">${escapeHtml(prev.title)}</span></a>`
    : `<span></span>`;
  const nextCard = next
    ? `<a class="nav-card nav-card-next" href="/captures/${escapeHtml(next.id)}" data-nav="next">` +
      `<span class="nav-dir">下一篇 →</span>` +
      `<span class="nav-title">${escapeHtml(next.title)}</span></a>`
    : `<span></span>`;
  return `<footer class="article-footer">${prevCard}${nextCard}</footer>`;
}

export async function renderArticle(
  capture: Capture,
  neighbors: { prev: CaptureSummary | null; next: CaptureSummary | null } = { prev: null, next: null }
): Promise<string> {
  const switcher = getThemeSwitcherHtml();
  const fontCtrl =
    `<div class="font-ctrl">` +
    `<button class="font-btn" data-dir="down" title="缩小字体">A−</button>` +
    `<button class="font-btn" data-dir="up" title="放大字体">A+</button>` +
    `</div>`;
  const title = escapeHtml(capture.title);
  const header =
    `<header class="article-topbar">` +
    `<a class="muted" href="/">← 返回列表</a>` +
    `<span class="article-topbar-title" aria-hidden="true">${title}</span>` +
    `<div class="topbar-right">${fontCtrl}${switcher}</div>` +
    `</header>`;

  const { chars, minutes } = readingStats(capture.content);
  const hostname = new URL(capture.sourceUrl).hostname;
  const meta =
    `<p class="meta">${chars} 字 · ` +
    `<span class="meta-remaining">约 ${minutes} 分钟</span> · ` +
    `<a href="${escapeHtml(capture.sourceUrl)}">${escapeHtml(hostname)} ↗</a></p>`;

  const toc = extractToc(capture.content);
  const hasToc = toc.length >= 2;
  const content = await renderMarkdown(capture.content, { toc });
  const readProgress = capture.readProgress ?? 0;
  const footer = renderArticleFooter(neighbors.prev, neighbors.next);

  const body =
    `<div class="article-shell" data-capture-id="${escapeHtml(capture.id)}" data-read-progress="${readProgress}" data-total-chars="${chars}">` +
    `<div class="read-progress-bar"><div class="read-progress-fill"></div></div>` +
    header +
    `<div class="article-layout">` +
    `<main class="article-main"><article class="article-content">` +
    `<h1 class="article-title-anchor">${title}</h1>` +
    meta +
    (hasToc ? renderMobileToc(toc) : "") +
    content +
    footer +
    `</article></main>` +
    (hasToc ? renderDesktopToc(toc) : "") +
    `</div>` +
    `<button class="scroll-top-btn" title="回到顶部" aria-label="回到顶部">↑</button>` +
    `</div>` +
    getReaderHeaderScriptHtml() +
    getReaderEnhancementsScriptHtml();
  return page(capture.title, body, "article-body");
}
```

- [ ] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/web/src/render.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/render.ts packages/web/src/render.test.ts
git commit -m "feat(web): update renderArticle with neighbors, data attrs, and footer"
```

---

## Task 5: Web 路由 — PATCH 端点 + 相邻 capture 查询

**Files:**
- Modify: `packages/web/src/index.ts`
- Modify: `packages/web/src/index.test.ts`

- [ ] **Step 1: 写失败测试**

将 `packages/web/src/index.test.ts` 中的 `fakeReadService()` 和测试更新为：

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
    createdAt: "2026-06-02T00:00:00.000Z",
    capturedAt: "2026-06-02T00:00:00.000Z",
  },
  {
    id: "c2",
    title: "Second",
    content: "# Second Body\n\n## Section\n\ntext\n\n### Notes\n\nmore",
    sourceUrl: "https://example.org/b",
    sourceType: "url",
    createdAt: "2026-06-01T00:00:00.000Z",
    capturedAt: "2026-06-01T00:00:00.000Z",
  },
];

function fakeReadService(): ReadService {
  return {
    list: async () =>
      captures.map(({ id, title, sourceUrl, createdAt }) => ({ id, title, sourceUrl, createdAt })),
    get: async (id: string) => captures.find((c) => c.id === id) ?? null,
    findBySourceUrl: async (sourceUrl: string) =>
      captures.find((c) => c.sourceUrl === sourceUrl) ?? null,
    updateReadStatus: vi.fn(),
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

- [ ] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/web/src/index.test.ts`

Expected: FAIL（PATCH 路由不存在，neighbors 逻辑未实现）。

- [ ] **Step 3: 更新 index.ts**

将 `packages/web/src/index.ts` 替换为：

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
    const idx = all.findIndex((s) => s.id === id);
    const neighbors = {
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

- [ ] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/web/src/index.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/index.ts packages/web/src/index.test.ts
git commit -m "feat(web): add PATCH read endpoint and neighbor navigation in detail route"
```

---

## Task 6: Styles

**Files:**
- Modify: `packages/web/src/styles.ts`
- Modify: `packages/web/src/styles.test.ts`

- [ ] **Step 1: 写失败测试**

在 `packages/web/src/styles.test.ts` 末尾追加：

```typescript
describe("reading enhancement styles", () => {
  it("includes read progress bar styles", () => {
    expect(getStyles()).toContain(".read-progress-bar");
    expect(getStyles()).toContain(".read-progress-fill");
  });

  it("includes copy button styles", () => {
    expect(getStyles()).toContain(".copy-btn");
    expect(getStyles()).toContain(".code-lang");
    expect(getStyles()).toContain(".code-block");
  });

  it("includes font control styles", () => {
    expect(getStyles()).toContain(".font-ctrl");
    expect(getStyles()).toContain(".font-btn");
  });

  it("includes scroll-to-top button styles", () => {
    expect(getStyles()).toContain(".scroll-top-btn");
  });

  it("includes article footer nav styles", () => {
    expect(getStyles()).toContain(".article-footer");
    expect(getStyles()).toContain(".nav-card");
  });

  it("includes read indicator styles for list page", () => {
    expect(getStyles()).toContain(".read-indicator");
  });

  it("includes meta-remaining style", () => {
    expect(getStyles()).toContain(".meta-remaining");
  });

  it("includes toc active item style", () => {
    expect(getStyles()).toContain(".toc-item.active");
  });
});
```

- [ ] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/web/src/styles.test.ts`

Expected: FAIL（新选择器不存在）。

- [ ] **Step 3: 在 styles.ts 中追加新样式**

在 `packages/web/src/styles.ts` 的 `</style>` 之前插入：

```css
.topbar-right { display: flex; align-items: center; gap: .6rem; }
.font-ctrl { display: flex; gap: .2rem; }
.font-btn { width: 26px; height: 26px; border-radius: 5px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-size: .78rem; display: flex; align-items: center; justify-content: center; }
.font-btn:hover { background: var(--border); color: var(--text); }
.read-progress-bar { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 200; background: transparent; pointer-events: none; }
.read-progress-fill { height: 100%; width: 0; background: linear-gradient(90deg, var(--link), #818cf8); transition: width .1s linear; }
.code-block { position: relative; margin: 1.2rem 0; }
.code-block pre { margin: 0; }
.code-lang { position: absolute; top: .45rem; left: .9rem; font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); pointer-events: none; }
.copy-btn { position: absolute; top: .45rem; right: .6rem; padding: .18rem .5rem; border-radius: 4px; background: var(--border); border: 1px solid var(--border); color: var(--text-muted); font-size: .7rem; cursor: pointer; transition: all .12s; }
.copy-btn:hover { color: var(--text); }
.copy-btn.copied { color: #4ade80; border-color: #4ade80; }
.scroll-top-btn { position: fixed; bottom: 1.5rem; right: 1.5rem; width: 36px; height: 36px; border-radius: 50%; background: var(--border); border: 1px solid var(--border); color: var(--text-muted); font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .2s; z-index: 50; }
.scroll-top-btn:hover { color: var(--text); }
.article-footer { border-top: 1px solid var(--border); margin-top: 2.5rem; padding-top: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.nav-card { display: flex; flex-direction: column; gap: .2rem; background: var(--bg-code); border: 1px solid var(--border); border-radius: 8px; padding: .75rem 1rem; text-decoration: none; color: inherit; transition: border-color .15s; }
.nav-card:hover { border-color: var(--link); text-decoration: none; }
.nav-card-next { text-align: right; }
.nav-dir { font-size: .7rem; color: var(--text-muted); }
.nav-title { font-size: .85rem; color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.read-indicator { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; margin-right: .5rem; margin-top: .35rem; }
.read-indicator.unread { background: var(--link); }
.read-indicator.in-progress { width: auto; height: auto; border-radius: 3px; background: transparent; color: #f59e0b; font-size: .7rem; font-weight: 600; padding: .05rem .25rem; margin-top: .3rem; }
.read-indicator.read { background: var(--border); }
.item { align-items: flex-start; }
.title-read { color: var(--text-muted); }
.meta-remaining { transition: color .2s; }
.toc-item.active > a { color: var(--link); font-weight: 500; }
.toc-item.active > a::before { content: ''; display: inline-block; width: 5px; height: 5px; background: var(--link); border-radius: 50%; margin-right: .35rem; vertical-align: middle; margin-bottom: 1px; }
```

- [ ] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/web/src/styles.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/styles.ts packages/web/src/styles.test.ts
git commit -m "feat(web): add reading enhancement styles"
```

---

## Task 7: 脚本纯函数 + getReaderEnhancementsScriptHtml

**Files:**
- Modify: `packages/web/src/scripts.ts`
- Modify: `packages/web/src/scripts.test.ts`

- [ ] **Step 1: 写纯函数失败测试**

在 `packages/web/src/scripts.test.ts` 末尾追加：

```typescript
import {
  calcReadProgress,
  calcRemainingMinutes,
  getReaderEnhancementsScriptHtml,
  getReadIndicatorScriptHtml,
} from "./scripts.js";

describe("calcReadProgress", () => {
  it("returns 0 at the top", () => {
    expect(calcReadProgress(0, 1000, 500)).toBe(0);
  });

  it("returns 100 at the bottom", () => {
    expect(calcReadProgress(500, 1000, 500)).toBe(100);
  });

  it("returns 50 at midpoint", () => {
    expect(calcReadProgress(250, 1000, 500)).toBe(50);
  });

  it("returns 0 when page fits in viewport", () => {
    expect(calcReadProgress(0, 400, 500)).toBe(0);
  });
});

describe("calcRemainingMinutes", () => {
  it("returns full time at 0 progress", () => {
    expect(calcRemainingMinutes(600, 0)).toBe(2);
  });

  it("returns 0 at 100 progress", () => {
    expect(calcRemainingMinutes(600, 100)).toBe(0);
  });

  it("returns half at 50 progress", () => {
    expect(calcRemainingMinutes(600, 50)).toBe(1);
  });

  it("returns 0 for empty content", () => {
    expect(calcRemainingMinutes(0, 0)).toBe(0);
  });
});

describe("getReaderEnhancementsScriptHtml", () => {
  it("contains progress bar logic", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("read-progress-fill");
  });

  it("uses requestAnimationFrame for scroll throttle", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("requestAnimationFrame");
  });

  it("handles font size via localStorage", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("amber-font-size");
  });

  it("injects copy buttons into pre elements", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("copy-btn");
  });

  it("saves progress to PATCH endpoint", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("/read");
    expect(getReaderEnhancementsScriptHtml()).toContain("PATCH");
  });

  it("reads data-nav attributes for keyboard shortcuts", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain('data-nav="prev"');
    expect(getReaderEnhancementsScriptHtml()).toContain('data-nav="next"');
  });

  it("updates meta-remaining element", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("meta-remaining");
  });

  it("shows scroll-top-btn after threshold", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("scroll-top-btn");
  });

  it("updates toc active class on scroll", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("toc-item");
    expect(getReaderEnhancementsScriptHtml()).toContain("active");
  });
});

describe("getReadIndicatorScriptHtml", () => {
  it("reads data-read-progress from list items", () => {
    expect(getReadIndicatorScriptHtml()).toContain("data-read-progress");
  });

  it("reads data-read-at from list items", () => {
    expect(getReadIndicatorScriptHtml()).toContain("data-read-at");
  });

  it("adds read-indicator element", () => {
    expect(getReadIndicatorScriptHtml()).toContain("read-indicator");
  });

  it("applies title-read class for read captures", () => {
    expect(getReadIndicatorScriptHtml()).toContain("title-read");
  });
});
```

- [ ] **Step 2: 确认测试失败**

运行：`pnpm exec vitest run packages/web/src/scripts.test.ts`

Expected: FAIL（新导出不存在）。

- [ ] **Step 3: 实现脚本函数**

将 `packages/web/src/scripts.ts` 末尾由 Task 4 Step 3a 添加的四个 stub 替换为完整实现：

```typescript
export function calcReadProgress(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const max = scrollHeight - clientHeight;
  return max > 0 ? Math.round((scrollTop / max) * 100) : 0;
}

export function calcRemainingMinutes(totalChars: number, progress: number): number {
  if (totalChars === 0) return 0;
  return Math.max(0, Math.round((totalChars * (1 - progress / 100)) / 300));
}

export function getReaderEnhancementsScriptHtml(): string {
  return `<script>
(function(){
  var shell=document.querySelector('.article-shell');
  if(!shell)return;
  var captureId=shell.dataset.captureId||'';
  var savedProgress=parseInt(shell.dataset.readProgress||'0',10);
  var totalChars=parseInt(shell.dataset.totalChars||'0',10);

  if(savedProgress>0&&savedProgress<95){
    requestAnimationFrame(function(){
      var max=document.documentElement.scrollHeight-window.innerHeight;
      window.scrollTo({top:max*savedProgress/100,behavior:'instant'});
    });
  }

  var FONT_KEY='amber-font-size';
  var initSize=parseInt(localStorage.getItem(FONT_KEY)||'16',10);
  function applyFontSize(size){
    document.documentElement.style.setProperty('--font-size-article',size+'px');
    localStorage.setItem(FONT_KEY,String(size));
  }
  if([14,16,18,20].indexOf(initSize)!==-1)applyFontSize(initSize);
  document.querySelectorAll('.font-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      var cur=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--font-size-article')||'16',10);
      applyFontSize(Math.min(20,Math.max(14,cur+(btn.dataset.dir==='up'?2:-2))));
    });
  });

  document.querySelectorAll('pre').forEach(function(pre){
    var wrap=document.createElement('div');
    wrap.className='code-block';
    pre.parentNode.insertBefore(wrap,pre);
    wrap.appendChild(pre);
    var lang=pre.dataset.language;
    if(lang){var sp=document.createElement('span');sp.className='code-lang';sp.textContent=lang;wrap.insertBefore(sp,pre);}
    var btn=document.createElement('button');
    btn.className='copy-btn';btn.textContent='Copy';
    btn.addEventListener('click',function(){
      navigator.clipboard.writeText(pre.textContent||'').then(function(){
        btn.textContent='Copied!';btn.classList.add('copied');
        setTimeout(function(){btn.textContent='Copy';btn.classList.remove('copied');},1500);
      });
    });
    wrap.appendChild(btn);
  });

  var headings=Array.from(document.querySelectorAll('h2[id],h3[id]'));
  var tocItems={};
  document.querySelectorAll('.toc .toc-item').forEach(function(item){
    var a=item.querySelector('a');
    var href=a&&a.getAttribute('href');
    if(href&&href.startsWith('#'))tocItems[href.slice(1)]=item;
  });
  var activeId=null;
  function updateTocActive(){
    var threshold=window.scrollY+window.innerHeight*0.3;
    var cur=null;
    headings.forEach(function(h){if(h.getBoundingClientRect().top+window.scrollY<=threshold)cur=h.id;});
    if(cur!==null&&cur!==activeId){
      if(activeId&&tocItems[activeId])tocItems[activeId].classList.remove('active');
      activeId=cur;
      var item=tocItems[activeId];
      if(item){item.classList.add('active');item.scrollIntoView({behavior:'smooth',block:'nearest'});}
    }
  }

  var progressFill=document.querySelector('.read-progress-fill');
  var remainingEl=document.querySelector('.meta-remaining');
  var scrollTopBtn=document.querySelector('.scroll-top-btn');
  var rafPending=false;
  var saveTimer=null;

  window.addEventListener('scroll',function(){
    if(rafPending)return;
    rafPending=true;
    requestAnimationFrame(function(){
      rafPending=false;
      var max=document.documentElement.scrollHeight-window.innerHeight;
      var p=max>0?Math.round(window.scrollY/max*100):0;
      if(progressFill)progressFill.style.width=p+'%';
      if(remainingEl&&totalChars>0){
        var mins=Math.max(0,Math.round(totalChars*(1-p/100)/300));
        remainingEl.textContent=p<5?('约'+Math.round(totalChars/300)+'分钟'):mins===0?'快读完了':('还剩约'+mins+'分钟');
      }
      if(scrollTopBtn){var show=window.scrollY>300;scrollTopBtn.style.opacity=show?'1':'0';scrollTopBtn.style.pointerEvents=show?'':'none';}
      updateTocActive();
      if(captureId){
        clearTimeout(saveTimer);
        saveTimer=setTimeout(function(){
          var body={readProgress:p};
          if(p>=95)body.readAt=new Date().toISOString();
          fetch('/captures/'+captureId+'/read',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        },2000);
      }
    });
  },{passive:true});

  if(scrollTopBtn)scrollTopBtn.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});

  var prevLink=document.querySelector('a[data-nav="prev"]');
  var nextLink=document.querySelector('a[data-nav="next"]');
  document.addEventListener('keydown',function(e){
    var tag=(document.activeElement||{}).tagName;
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    if(e.key==='j')window.scrollBy({top:200,behavior:'smooth'});
    else if(e.key==='k')window.scrollBy({top:-200,behavior:'smooth'});
    else if(e.key==='Escape')window.location.href='/';
    else if(e.key==='['&&prevLink)window.location.href=prevLink.href;
    else if(e.key===']'&&nextLink)window.location.href=nextLink.href;
  });
})();
</script>`;
}

export function getReadIndicatorScriptHtml(): string {
  return `<script>
(function(){
  document.querySelectorAll('.item[data-read-progress]').forEach(function(item){
    var progress=parseInt(item.dataset.readProgress||'0',10);
    var readAt=item.dataset.readAt||'';
    var dot=document.createElement('span');
    dot.className='read-indicator';
    if(readAt){dot.classList.add('read');}
    else if(progress>0){dot.classList.add('in-progress');dot.textContent=progress+'%';}
    else{dot.classList.add('unread');}
    var main=item.querySelector('.item-main');
    if(main)item.insertBefore(dot,main);
    if(readAt){var link=main&&main.querySelector('a');if(link)link.classList.add('title-read');}
  });
})();
</script>`;
}
```

- [ ] **Step 4: 确认测试通过**

运行：`pnpm exec vitest run packages/web/src/scripts.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/scripts.ts packages/web/src/scripts.test.ts
git commit -m "feat(web): add reader enhancement scripts and read indicator script"
```

---

## Task 8: 全面验证

**Files:**
- No additional files.

- [ ] **Step 1: 运行全部测试**

```bash
pnpm exec vitest run
```

Expected: 全部 PASS，0 failures。

- [ ] **Step 2: 类型检查**

```bash
pnpm run typecheck
```

Expected: PASS，无类型错误。

- [ ] **Step 3: 检查文件行数**

```bash
wc -l packages/domain/src/index.ts packages/adapters/src/file-store.ts packages/core/src/read-service.ts packages/web/src/scripts.ts packages/web/src/styles.ts packages/web/src/render.ts packages/web/src/index.ts
```

Expected: 每个文件 ≤ 500 行。
