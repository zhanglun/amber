# Web UI Split Reader + Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dense split-reader Web UI with native video rendering for local video blobs.

**Architecture:** Keep the Web UI server-rendered with TypeScript string templates. Replace separate list/article page rendering with a single `renderLibrary(items, selectedCapture)` shell, and add video-link rendering inside the existing Markdown renderer.

**Tech Stack:** TypeScript, Hono, markdown-it, shiki, Vitest.

---

## File Structure

- Modify `packages/web/src/render.ts`: add `renderLibrary`, sidebar helpers, reader helpers, and keep small compatibility exports where useful.
- Modify `packages/web/src/index.ts`: fetch list data for `/` and `/captures/:id`; export a MIME helper for tests.
- Modify `packages/web/src/highlight.ts`: customize Markdown-it link rendering for local video links.
- Modify `packages/web/src/styles.ts`: add split-reader and video styles.
- Modify `packages/web/src/render.test.ts`: update expectations for split layout.
- Modify `packages/web/src/highlight.test.ts`: add video-link rendering test.
- Add `packages/web/src/index.test.ts`: test route rendering and MIME behavior.

All modified Web source files must stay below 500 lines.

## Task 1: Split Reader Shell

**Files:**
- Modify: `packages/web/src/render.ts`
- Modify: `packages/web/src/styles.ts`
- Modify: `packages/web/src/render.test.ts`

- [ ] **Step 1: Write failing render tests**

Add tests asserting:

```ts
const selected = {
  id: "c1",
  title: "First",
  content: "# Heading\n\ntext",
  sourceUrl: "https://example.com/a",
  sourceType: "url" as const,
  createdAt: "2026-06-01T00:00:00.000Z",
  capturedAt: "2026-06-01T00:00:00.000Z",
};

const items = [
  { id: "c1", title: "First", sourceUrl: "https://example.com/a", createdAt: "2026-06-01T00:00:00.000Z" },
  { id: "c2", title: "Second", sourceUrl: "https://example.org/b", createdAt: "2026-05-25T00:00:00.000Z" },
];

it("renders a split app shell with sidebar and reader", async () => {
  const html = await renderLibrary(items, selected);
  expect(html).toContain('class="app-shell"');
  expect(html).toContain('class="sidebar"');
  expect(html).toContain('class="reader"');
  expect(html).toContain("<h1>First</h1>");
});

it("marks the selected sidebar item active", async () => {
  const html = await renderLibrary(items, selected);
  expect(html).toContain('class="item sidebar-item active"');
  expect(html).toContain('href="/captures/c1"');
});

it("renders an empty reader state when no capture is selected", async () => {
  const html = await renderLibrary([], null);
  expect(html).toContain("No captures yet");
});
```

- [ ] **Step 2: Verify tests fail**

Run: `pnpm exec vitest run packages/web/src/render.test.ts`

Expected: FAIL because `renderLibrary` is not exported and split classes do not exist.

- [ ] **Step 3: Implement split shell**

Implement `renderLibrary(items, selectedCapture)` in `render.ts`, move list rendering into `renderSidebar`, and render the selected article in `renderReader`.

- [ ] **Step 4: Add split layout styles**

Add `.app-shell`, `.sidebar`, `.reader`, `.reader-inner`, `.sidebar-header`, `.sidebar-item`, and `.sidebar-item.active` styles in `styles.ts`.

- [ ] **Step 5: Verify render tests pass**

Run: `pnpm exec vitest run packages/web/src/render.test.ts packages/web/src/styles.test.ts`

Expected: PASS.

## Task 2: Route Shell Integration

**Files:**
- Modify: `packages/web/src/index.ts`
- Add: `packages/web/src/index.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `packages/web/src/index.test.ts` with tests using `createApp` and a fake `ReadService`:

```ts
it("renders the newest capture on /", async () => {
  const app = createApp(fakeReadService, { blobsDir: "/tmp" });
  const res = await app.request("/");
  const html = await res.text();
  expect(html).toContain('class="app-shell"');
  expect(html).toContain("<h1>First</h1>");
});

it("renders the selected capture on /captures/:id", async () => {
  const app = createApp(fakeReadService, { blobsDir: "/tmp" });
  const res = await app.request("/captures/c2");
  const html = await res.text();
  expect(html).toContain("<h1>Second</h1>");
  expect(html).toContain('href="/captures/c2"');
  expect(html).toContain("active");
});
```

- [ ] **Step 2: Verify route tests fail**

Run: `pnpm exec vitest run packages/web/src/index.test.ts`

Expected: FAIL because routes still call separate render functions.

- [ ] **Step 3: Implement route integration**

Update `/` and `/captures/:id` to call `renderLibrary(items, selectedCapture)`.

- [ ] **Step 4: Verify route tests pass**

Run: `pnpm exec vitest run packages/web/src/index.test.ts packages/web/src/render.test.ts`

Expected: PASS.

## Task 3: Native Video Rendering and MIME Types

**Files:**
- Modify: `packages/web/src/highlight.ts`
- Modify: `packages/web/src/highlight.test.ts`
- Modify: `packages/web/src/index.ts`
- Modify: `packages/web/src/index.test.ts`
- Modify: `packages/web/src/styles.ts`
- Modify: `packages/web/src/styles.test.ts`

- [ ] **Step 1: Write failing Markdown video test**

Add to `packages/web/src/highlight.test.ts`:

```ts
it("renders local video links as native video embeds", async () => {
  const html = await renderMarkdown("[▶ video](/blobs/captures/c1/2.mp4)");
  expect(html).toContain('<figure class="video-embed">');
  expect(html).toContain("<video");
  expect(html).toContain('controls');
  expect(html).toContain('preload="metadata"');
  expect(html).toContain('src="/blobs/captures/c1/2.mp4"');
});
```

- [ ] **Step 2: Write failing MIME test**

Add to `packages/web/src/index.test.ts`:

```ts
expect(contentTypeForPath("captures/c1/2.mp4")).toBe("video/mp4");
expect(contentTypeForPath("captures/c1/2.webm")).toBe("video/webm");
expect(contentTypeForPath("captures/c1/2.ogv")).toBe("video/ogg");
expect(contentTypeForPath("captures/c1/2.mov")).toBe("video/quicktime");
```

- [ ] **Step 3: Verify video tests fail**

Run: `pnpm exec vitest run packages/web/src/highlight.test.ts packages/web/src/index.test.ts`

Expected: FAIL because video links render as normal anchors and MIME helper is not exported yet.

- [ ] **Step 4: Implement video rendering**

Customize Markdown-it `link_open` / `link_close` renderer in `highlight.ts` for local video extensions.

- [ ] **Step 5: Implement MIME helper and styles**

Export `contentTypeForPath(path)` from `index.ts`, use it in the blob route, and add `.video-embed` styles.

- [ ] **Step 6: Verify video tests pass**

Run: `pnpm exec vitest run packages/web/src/highlight.test.ts packages/web/src/index.test.ts packages/web/src/styles.test.ts`

Expected: PASS.

## Task 4: Full Verification

**Files:**
- No additional files.

- [ ] **Step 1: Run Web package tests**

Run: `pnpm exec vitest run packages/web`

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 3: Check file lengths**

Run: `wc -l packages/web/src/*.ts packages/web/src/*.test.ts`

Expected: each source/render/component file remains below 500 lines.
