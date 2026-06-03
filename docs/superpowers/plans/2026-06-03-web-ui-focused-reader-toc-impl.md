# Web UI Focused Reader TOC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split-reader detail page with a focused article page that has desktop sticky TOC and mobile folded TOC.

**Architecture:** Keep `/` as the existing compact list page and make `/captures/:id` render a standalone article page again. Add `toc.ts` for heading extraction and slug generation, pass TOC data into Markdown rendering so heading ids and TOC links use the same sequence.

**Tech Stack:** TypeScript, Hono, markdown-it, shiki, Vitest.

---

## File Structure

- Create `packages/web/src/toc.ts`: TOC extraction, inline heading text cleanup, slug dedupe.
- Create `packages/web/src/toc.test.ts`: pure TOC extraction tests.
- Modify `packages/web/src/highlight.ts`: accept optional TOC data and add heading ids by occurrence order.
- Modify `packages/web/src/highlight.test.ts`: heading id tests while preserving video tests.
- Modify `packages/web/src/render.ts`: remove split-reader detail helpers, add focused reader TOC rendering.
- Modify `packages/web/src/render.test.ts`: delete `renderLibrary` tests and add focused reader TOC assertions.
- Modify `packages/web/src/index.ts`: make `/` render list and `/captures/:id` render focused article.
- Modify `packages/web/src/index.test.ts`: update route assertions for list/detail separation.
- Modify `packages/web/src/styles.ts`: add focused reader + TOC styles and keep video styles.
- Modify `packages/web/src/styles.test.ts`: update style assertions.

All Web source files must remain under 500 lines.

## Task 1: TOC Extraction

**Files:**
- Create: `packages/web/src/toc.ts`
- Create: `packages/web/src/toc.test.ts`

- [ ] **Step 1: Write failing TOC tests**

Create tests for:

```ts
import { describe, expect, it } from "vitest";
import { extractToc } from "./toc.js";

describe("extractToc", () => {
  it("extracts h2 and h3 headings but ignores h1", () => {
    expect(extractToc("# Title\n\n## Intro\n\n### Detail")).toEqual([
      { level: 2, text: "Intro", id: "intro" },
      { level: 3, text: "Detail", id: "detail" },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    expect(extractToc("## Real\n\n```md\n## Fake\n```\n\n### More")).toEqual([
      { level: 2, text: "Real", id: "real" },
      { level: 3, text: "More", id: "more" },
    ]);
  });

  it("deduplicates repeated heading ids by occurrence order", () => {
    expect(extractToc("## Repeat\n\n## Repeat\n\n### Repeat")).toEqual([
      { level: 2, text: "Repeat", id: "repeat" },
      { level: 2, text: "Repeat", id: "repeat-2" },
      { level: 3, text: "Repeat", id: "repeat-3" },
    ]);
  });

  it("cleans common inline markdown before slugging", () => {
    expect(extractToc("## **重点** [链接](https://example.com) `code`")).toEqual([
      { level: 2, text: "重点 链接 code", id: "重点-链接-code" },
    ]);
  });
});
```

- [ ] **Step 2: Verify TOC tests fail**

Run: `pnpm exec vitest run packages/web/src/toc.test.ts`

Expected: FAIL because `toc.ts` does not exist.

- [ ] **Step 3: Implement `toc.ts`**

Implement:

- `export interface TocItem { level: 2 | 3; text: string; id: string }`
- `export function extractToc(markdown: string): TocItem[]`
- fenced code tracking
- lightweight inline markdown cleanup
- slug generation and duplicate suffixes

- [ ] **Step 4: Verify TOC tests pass**

Run: `pnpm exec vitest run packages/web/src/toc.test.ts`

Expected: PASS.

## Task 2: Markdown Heading IDs

**Files:**
- Modify: `packages/web/src/highlight.ts`
- Modify: `packages/web/src/highlight.test.ts`

- [ ] **Step 1: Write failing heading id test**

Add tests:

```ts
import type { TocItem } from "./toc.js";

it("adds toc ids to h2 and h3 headings by order", async () => {
  const toc: TocItem[] = [
    { level: 2, text: "Repeat", id: "repeat" },
    { level: 2, text: "Repeat", id: "repeat-2" },
  ];
  const html = await renderMarkdown("## Repeat\n\n## Repeat", { toc });
  expect(html).toContain('<h2 id="repeat">Repeat</h2>');
  expect(html).toContain('<h2 id="repeat-2">Repeat</h2>');
});
```

- [ ] **Step 2: Verify heading id test fails**

Run: `pnpm exec vitest run packages/web/src/highlight.test.ts`

Expected: FAIL because `renderMarkdown` does not accept an options object yet.

- [ ] **Step 3: Implement heading renderer**

Update `renderMarkdown(content, options?: { toc?: TocItem[] })`. Install a Markdown-it heading renderer that consumes `options.toc` by occurrence order for h2/h3.

- [ ] **Step 4: Verify highlight tests pass**

Run: `pnpm exec vitest run packages/web/src/highlight.test.ts`

Expected: PASS.

## Task 3: Focused Article Renderer

**Files:**
- Modify: `packages/web/src/render.ts`
- Modify: `packages/web/src/render.test.ts`
- Modify: `packages/web/src/styles.ts`
- Modify: `packages/web/src/styles.test.ts`

- [ ] **Step 1: Write failing render tests**

Update tests so:

- `renderArticle` with two headings contains `.article-shell`, `.toc`, `.toc-mobile`, and `href="#..."`.
- `renderArticle` with fewer than two TOC headings does not contain `class="toc"`.
- `renderLibrary` tests are removed.

- [ ] **Step 2: Verify render tests fail**

Run: `pnpm exec vitest run packages/web/src/render.test.ts packages/web/src/styles.test.ts`

Expected: FAIL because focused TOC article shell does not exist yet and old split-reader styles are still asserted.

- [ ] **Step 3: Implement focused article renderer**

In `render.ts`:

- import `extractToc`
- add `renderToc(toc)` and `renderMobileToc(toc)`
- update `renderArticle(capture)` to render focused article shell
- call `renderMarkdown(capture.content, { toc })`
- remove `renderLibrary`, `renderSidebar`, and `renderReader`

- [ ] **Step 4: Implement focused reader styles**

In `styles.ts`:

- add `.article-shell`, `.article-topbar`, `.article-layout`, `.article-main`
- add `.toc`, `.toc-title`, `.toc-list`, `.toc-item`, `.toc-item.level-3`, `.toc-mobile`
- remove unused split-reader-specific styles if no longer used

- [ ] **Step 5: Verify render/style tests pass**

Run: `pnpm exec vitest run packages/web/src/render.test.ts packages/web/src/styles.test.ts`

Expected: PASS.

## Task 4: Route Behavior

**Files:**
- Modify: `packages/web/src/index.ts`
- Modify: `packages/web/src/index.test.ts`

- [ ] **Step 1: Write failing route tests**

Update tests so:

- `/` contains list/search content and does not contain `.article-shell`.
- `/captures/:id` contains `.article-shell`, selected title, and `.toc`.

- [ ] **Step 2: Verify route tests fail**

Run: `pnpm exec vitest run packages/web/src/index.test.ts`

Expected: FAIL because routes still use `renderLibrary`.

- [ ] **Step 3: Implement route changes**

Update `index.ts`:

- import `renderArticle` and `renderList`
- `/` calls `renderList(await readService.list())`
- `/captures/:id` only fetches selected capture and calls `renderArticle(capture)`

- [ ] **Step 4: Verify route tests pass**

Run: `pnpm exec vitest run packages/web/src/index.test.ts`

Expected: PASS.

## Task 5: Full Verification

**Files:**
- No additional files.

- [ ] **Step 1: Run Web tests**

Run: `pnpm exec vitest run packages/web`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 3: Check file lengths**

Run: `wc -l packages/web/src/*.ts packages/web/src/*.test.ts`

Expected: every listed file remains below 500 lines.
