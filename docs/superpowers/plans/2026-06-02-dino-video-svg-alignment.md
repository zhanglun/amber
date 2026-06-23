# Dino 视频 + SVG 能力对齐实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `collectImages()` 支持内联 SVG 和 `<video>` 资产采集，与 CLI 的 `localizeImages()` 完全对齐，同时更新 amber 的 `asset-key.ts` 补充视频 MIME 类型映射。

**Architecture:** 三个文件、两个 repo。`dino/src/collect-images.ts` 新增 SVG 辅助函数和视频辅助函数（从 `assets.ts` 移植），修复早返回条件和数组捕获顺序，增加 SVG 和视频处理循环；`amber/packages/core/src/asset-key.ts` 补充 `video/*` MIME 映射。`capture.ts`、`dino-source.ts`、domain 类型均不需要改动。

**Tech Stack:** TypeScript ESM，linkedom（HTML 解析），vitest，pnpm。

---

## 文件结构

```
/Users/zhanglun/Documents/mine/dino/src/collect-images.ts   ← 主要修改
/Users/zhanglun/Documents/mine/dino/tests/collect-images.test.ts ← 补充测试
/Users/zhanglun/Documents/mine/amber/packages/core/src/asset-key.ts ← video MIME 映射
/Users/zhanglun/Documents/mine/amber/packages/core/src/asset-key.test.ts ← 补充测试
```

---

### Task 1：amber — asset-key.ts 补充 video MIME 类型

**Files:**
- Modify: `/Users/zhanglun/Documents/mine/amber/packages/core/src/asset-key.ts:1-8`
- Test: `/Users/zhanglun/Documents/mine/amber/packages/core/src/asset-key.test.ts`

- [x] **Step 1：写失败测试**

在 `/Users/zhanglun/Documents/mine/amber/packages/core/src/asset-key.test.ts` 的 `describe("assetKey", ...)` 末尾追加：

```ts
it("maps video/mp4 to mp4", () => {
  expect(assetKey("cap", 0, "video/mp4")).toBe("captures/cap/0.mp4");
});

it("maps video/webm to webm", () => {
  expect(assetKey("cap", 0, "video/webm")).toBe("captures/cap/0.webm");
});

it("maps video/quicktime to mov", () => {
  expect(assetKey("cap", 0, "video/quicktime")).toBe("captures/cap/0.mov");
});
```

- [x] **Step 2：验证失败**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm vitest run packages/core/src/asset-key.test.ts 2>&1 | tail -15
```

Expected: 3 tests FAIL，提示 `"captures/cap/0.bin"` 不等于 `"captures/cap/0.mp4"` 等。

- [x] **Step 3：修改 asset-key.ts**

将 `/Users/zhanglun/Documents/mine/amber/packages/core/src/asset-key.ts` 改为：

```ts
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
};

export function assetKey(
  captureId: string,
  index: number,
  contentType?: string,
): string {
  const ext = (contentType && EXT_BY_TYPE[contentType]) || "bin";
  return `captures/${captureId}/${index}.${ext}`;
}

export function captureAssetPrefix(captureId: string): string {
  return `captures/${captureId}`;
}
```

- [x] **Step 4：验证通过**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm vitest run packages/core/src/asset-key.test.ts 2>&1 | tail -10
```

Expected: 6 tests pass（含原有 3 个）。

- [x] **Step 5：typecheck**

```bash
cd /Users/zhanglun/Documents/mine/amber && pnpm typecheck 2>&1 | grep -c error || true
```

Expected: 0

- [x] **Step 6：commit**

```bash
cd /Users/zhanglun/Documents/mine/amber
git add packages/core/src/asset-key.ts packages/core/src/asset-key.test.ts
git commit -m "feat(core): add video MIME type mappings to asset-key"
```

---

### Task 2：dino — collect-images.ts SVG 处理 + 结构修复

**Context:** `collect-images.ts` 需要三处结构性修复：① 早返回条件只检查了 `images`；② 数组必须在 DOM 变更前一次性捕获；③ 缺少 SVG 处理循环。本任务一并处理。

**Files:**
- Modify: `/Users/zhanglun/Documents/mine/dino/src/collect-images.ts`
- Test: `/Users/zhanglun/Documents/mine/dino/tests/collect-images.test.ts`

- [x] **Step 1：写 SVG 失败测试**

在 `/Users/zhanglun/Documents/mine/dino/tests/collect-images.test.ts` 末尾追加：

```ts
it("extracts inline SVG as asset and replaces with img", async () => {
  const result = await collectImages(
    '<p><svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg></p>',
    { baseUrl: "https://example.com/post" },
  );

  expect(result.assets).toHaveLength(1);
  expect(result.assets[0].path).toBe("assets/image-001.svg");
  expect(result.assets[0].contentType).toBe("image/svg+xml");
  expect(result.html).toContain('src="assets/image-001.svg"');
  expect(result.html).not.toContain("<svg");
});

it("processes SVG and image together, sharing index counter", async () => {
  const result = await collectImages(
    '<p><svg xmlns="http://www.w3.org/2000/svg"><rect/></svg><img src="/photo.png"></p>',
    {
      baseUrl: "https://example.com/post",
      fetchImage: async () =>
        new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/png" } }),
    },
  );

  expect(result.assets).toHaveLength(2);
  expect(result.assets[0].path).toBe("assets/image-001.svg");
  expect(result.assets[1].path).toBe("assets/image-002.png");
});
```

- [x] **Step 2：验证失败**

```bash
cd /Users/zhanglun/Documents/mine/dino && pnpm test -- tests/collect-images.test.ts 2>&1 | tail -20
```

Expected: 2 new tests FAIL（`assets` 为空，无 SVG 处理）。

- [x] **Step 3：在 collect-images.ts 中添加 SVG 辅助函数**

在现有 `imageSource` 函数之后（`collectImages` 函数之前）插入：

```ts
function svgImageAlt(svg: Element): string {
  return svg.getAttribute("aria-label")?.trim()
    || svg.getAttribute("alt")?.trim()
    || svg.querySelector("title")?.textContent?.trim()
    || "formula";
}

function ensureSvgNamespace(svg: Element): string {
  const html = svg.outerHTML;
  return /\sxmlns=/.test(html) ? html : html.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
}
```

- [x] **Step 4：修改 collectImages 函数主体**

将 `collectImages` 函数内部从开头到 `const fetchImage` 这段替换为（修复早返回 + 三数组捕获 + SVG 循环）：

```ts
export async function collectImages(
  html: string,
  options: CollectImagesOptions,
): Promise<CollectImagesResult> {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const images = Array.from(document.querySelectorAll("img"));
  const inlineSvgs = Array.from(document.querySelectorAll("svg"));
  const videos = Array.from(document.querySelectorAll("video")) as unknown as Element[];
  if (images.length === 0 && inlineSvgs.length === 0 && videos.length === 0) return { html, assets: [] };

  const fetchImage = options.fetchImage ?? ((url: string) => fetch(url, { headers: { Referer: options.baseUrl } }));
  const seen = new Map<string, string>();
  const assets: CollectedAsset[] = [];
  let index = 1;

  for (const svg of inlineSvgs) {
    if (!svg.parentNode) continue;
    const filename = `image-${String(index).padStart(3, "0")}.svg`;
    index += 1;
    const data = new TextEncoder().encode(ensureSvgNamespace(svg));
    const rel = `assets/${filename}`;
    assets.push({ path: rel, data, contentType: "image/svg+xml" });
    const img = document.createElement("img");
    img.setAttribute("src", rel);
    img.setAttribute("alt", svgImageAlt(svg));
    const mathContainer = svg.parentElement?.tagName.toLowerCase() === "mjx-container" ? svg.parentElement : null;
    if (mathContainer) {
      mathContainer.replaceWith(img);
    } else {
      svg.replaceWith(img);
    }
  }

  // 图片循环保持不变，从这里开始
  for (const img of images) {
```

图片循环内部（`for (const img of images)` 到函数末尾的 `return`）**保持原样不动**，只把它们的闭合大括号之后、`return` 语句之前留空（供 Task 3 插入视频循环）。

- [x] **Step 5：验证测试通过**

```bash
cd /Users/zhanglun/Documents/mine/dino && pnpm test -- tests/collect-images.test.ts 2>&1 | tail -20
```

Expected: 全部 6 tests pass（原 4 个 + 新 2 个）。

- [x] **Step 6：typecheck**

```bash
cd /Users/zhanglun/Documents/mine/dino && pnpm typecheck 2>&1 | grep -c error || true
```

Expected: 0

- [x] **Step 7：commit**

```bash
cd /Users/zhanglun/Documents/mine/dino
git add src/collect-images.ts tests/collect-images.test.ts
git commit -m "feat(collect-images): add inline SVG extraction and fix early-return condition"
```

---

### Task 3：dino — collect-images.ts 视频处理

**Context:** `videos` 数组已在 Task 2 声明，现在只需添加辅助函数和视频循环。视频不做 URL 去重（与 CLI 的 `localizeImages` 一致）。

**Files:**
- Modify: `/Users/zhanglun/Documents/mine/dino/src/collect-images.ts`
- Test: `/Users/zhanglun/Documents/mine/dino/tests/collect-images.test.ts`

- [x] **Step 1：写视频失败测试**

在 `/Users/zhanglun/Documents/mine/dino/tests/collect-images.test.ts` 末尾追加：

```ts
it("downloads video and replaces with link", async () => {
  const result = await collectImages(
    '<p><video src="https://example.com/clip.mp4"></video></p>',
    {
      baseUrl: "https://example.com/post",
      fetchImage: async () =>
        new Response(new Uint8Array([10, 20, 30]), { headers: { "content-type": "video/mp4" } }),
    },
  );

  expect(result.assets).toHaveLength(1);
  expect(result.assets[0].path).toBe("assets/video-001.mp4");
  expect(result.assets[0].contentType).toBe("video/mp4");
  expect(Array.from(result.assets[0].data)).toEqual([10, 20, 30]);
  expect(result.html).toContain('href="assets/video-001.mp4"');
  expect(result.html).toContain("▶ video");
  expect(result.html).not.toContain("<video");
});

it("extracts video URL from <source> child element", async () => {
  const result = await collectImages(
    '<video><source src="https://example.com/clip.webm" type="video/webm"></video>',
    {
      baseUrl: "https://example.com/post",
      fetchImage: async () =>
        new Response(new Uint8Array([1]), { headers: { "content-type": "video/webm" } }),
    },
  );

  expect(result.assets[0].path).toBe("assets/video-001.webm");
});

it("skips HLS streaming video (.m3u8)", async () => {
  let called = false;
  const result = await collectImages(
    '<video src="https://example.com/stream.m3u8"></video>',
    {
      baseUrl: "https://example.com/post",
      fetchImage: async () => { called = true; return new Response(""); },
    },
  );

  expect(called).toBe(false);
  expect(result.assets).toHaveLength(0);
});

it("processes video on page with no img elements (no early return)", async () => {
  const result = await collectImages(
    '<p>text</p><video src="https://example.com/clip.mp4"></video>',
    {
      baseUrl: "https://example.com/post",
      fetchImage: async () =>
        new Response(new Uint8Array([1]), { headers: { "content-type": "video/mp4" } }),
    },
  );

  expect(result.assets).toHaveLength(1);
  expect(result.assets[0].path).toBe("assets/video-001.mp4");
});
```

- [x] **Step 2：验证失败**

```bash
cd /Users/zhanglun/Documents/mine/dino && pnpm test -- tests/collect-images.test.ts 2>&1 | tail -20
```

Expected: 4 new tests FAIL（无视频处理逻辑）。

- [x] **Step 3：添加视频辅助函数**

在 `ensureSvgNamespace` 函数之后、`collectImages` 函数之前插入：

```ts
function videoSource(video: Element): string | null {
  const isStream = (s: string) => /\.m3u8|\.mpd|\bblob:\b|\bdata:/i.test(s);
  const src = video.getAttribute("src") ?? "";
  if (src && !isStream(src)) return src;
  for (const source of Array.from(video.querySelectorAll("source")) as unknown as Element[]) {
    const s = source.getAttribute("src") ?? "";
    if (s && !isStream(s)) return s;
  }
  return null;
}

function videoExtension(contentType: string, url: string): string {
  const pathExt = extname(new URL(url).pathname).replace(/[^.a-z0-9]/gi, "");
  if (pathExt && pathExt.length <= 8) return pathExt;
  if (contentType.includes("webm")) return ".webm";
  if (contentType.includes("ogg") || contentType.includes("ogv")) return ".ogv";
  return ".mp4";
}
```

- [x] **Step 4：在 collectImages 中添加视频循环**

在图片循环（`for (const img of images) { ... }`）之后、`return { html: document.body.innerHTML, assets };` 之前插入：

```ts
  for (const video of videos) {
    const raw = videoSource(video);
    if (!raw) continue;
    let absolute: string;
    try {
      absolute = new URL(raw, options.baseUrl).toString();
    } catch { continue; }
    let response: Response;
    try {
      response = await fetchImage(absolute);
    } catch (err) {
      console.error(`Video fetch error: ${absolute.slice(0, 80)} — ${(err as Error).message}`);
      continue;
    }
    if (!response.ok) {
      console.error(`Video fetch ${response.status}: ${absolute.slice(0, 80)}`);
      continue;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.startsWith("video/") && contentType !== "application/octet-stream") {
      console.error(`Video skipped (content-type: ${contentType}): ${absolute.slice(0, 80)}`);
      continue;
    }
    const ext = videoExtension(contentType, absolute);
    const filename = `video-${String(index).padStart(3, "0")}${ext}`;
    index += 1;
    const data = new Uint8Array(await response.arrayBuffer());
    const rel = `assets/${filename}`;
    assets.push({ path: rel, data, contentType: contentType || "video/mp4" });
    const link = document.createElement("a");
    link.setAttribute("href", rel);
    link.textContent = "▶ video";
    video.replaceWith(link);
  }
```

- [x] **Step 5：验证全部测试通过**

```bash
cd /Users/zhanglun/Documents/mine/dino && pnpm test -- tests/collect-images.test.ts 2>&1 | tail -20
```

Expected: 10 tests pass（原 4 个 + Task 2 的 2 个 + 本任务 4 个）。

- [x] **Step 6：typecheck**

```bash
cd /Users/zhanglun/Documents/mine/dino && pnpm typecheck 2>&1 | grep -c error || true
```

Expected: 0

- [x] **Step 7：commit**

```bash
cd /Users/zhanglun/Documents/mine/dino
git add src/collect-images.ts tests/collect-images.test.ts
git commit -m "feat(collect-images): add video download support aligned with CLI localizeImages"
```
