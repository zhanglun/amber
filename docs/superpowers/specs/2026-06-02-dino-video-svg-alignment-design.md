# Dino 库 API 视频与 SVG 能力对齐设计

## 背景

`dino` CLI 通过 `localizeImages()`（`assets.ts`）支持图片、内联 SVG、视频三类资产的本地化。而 amber 使用的库 API 路径 `capture()` → `collectImages()`（`collect-images.ts`）仅处理图片，内联 SVG 和视频被静默跳过，注释写明 "v1 不处理 svg / video"。

结果：通过 `amber import` 导入含视频的页面（如小红书视频帖）时，视频不会被下载。

---

## 目标

让 `collectImages()` 的能力与 `localizeImages()` 对齐：图片 + 内联 SVG + 视频三类资产全部支持。

---

## 范围

**IN：**
- `<video src="...">` / `<video><source src="...">` — 下载视频文件，替换为 `<a href="assets/video-NNN.ext">▶ video</a>`
- 内联 `<svg>` — 提取 outerHTML 序列化为 UTF-8 bytes，替换为 `<img src="assets/image-NNN.svg" alt="...">`
- `amber/packages/core/src/asset-key.ts` — 补充 video/* MIME 类型映射

**OUT：**
- HLS / DASH 流媒体（`.m3u8`、`.mpd`）— 无法单文件下载，跳过（与 CLI 一致）
- `blob:` / `data:` 视频源 — 跳过（与 CLI 一致）
- `<audio>` — 不在本次范围

---

## 架构

涉及两个 repo、三个文件：

```
dino/src/collect-images.ts       ← 主要修改：加 SVG + 视频处理
dino/src/capture.ts              ← 不变
amber/packages/core/src/asset-key.ts  ← 补充 video/* MIME 映射
```

数据流不变：
```
capture() → collectImages() → CaptureResult.assets[]
  → toRawCapture() → 占位符替换
  → import-service → blob 存储 → URL 替换
```

`CollectedAsset` 类型（`path`, `data`, `contentType`）已满足需求，无需改动。

---

## collect-images.ts 修改细节

### 关键约束

**约束 1 — 早返回条件**：原 `if (images.length === 0) return { html, assets: [] }` 会导致纯视频页面直接返回。改为：
```ts
if (images.length === 0 && inlineSvgs.length === 0 && videos.length === 0) return { html, assets: [] };
```

**约束 2 — 数组在 DOM 变更前全部捕获**：SVG 处理会把 `<svg>` 替换成 `<img>`，必须先捕获三个数组再依次处理，否则新插入的 img 会被重复处理：
```ts
const images = Array.from(document.querySelectorAll("img"));
const inlineSvgs = Array.from(document.querySelectorAll("svg"));
const videos = Array.from(document.querySelectorAll("video"));
```

### 新增辅助函数（从 assets.ts 移植）

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

### 处理顺序

1. **SVG 循环**（先跑，DOM 变更前已捕获数组）：提取 outerHTML → UTF-8 bytes → asset，替换为 `<img>`
2. **图片循环**（不变，index 从 SVG 结束后的值继续）
3. **视频循环**（后跑）：fetch video → bytes → asset，替换为 `<a>▶ video</a>`

`index` 计数器在三个循环中共享，SVG/图片命名 `image-NNN`，视频命名 `video-NNN`。

视频不做 URL 去重（与 CLI 一致）。

---

## asset-key.ts 修改

新增 video MIME 类型映射：

```ts
"video/mp4": "mp4",
"video/webm": "webm",
"video/ogg": "ogv",
"video/quicktime": "mov",
```

`application/octet-stream` 不单独映射，继续 fallback 到 `.bin`（已有行为）。

---

## 测试要点

### dino/tests/collect-images.test.ts

新增：
- 含 `<video src="...">` 的 HTML → 下载视频，替换为 `[▶ video](assets/video-001.mp4)`，asset 含 `path`/`data`/`contentType`
- 含 `<video><source src="...">` 的 HTML → 同上，通过 `<source>` 提取 URL
- 含 `.m3u8` src 的 `<video>` → 跳过，不产生 asset
- 含内联 `<svg>` 的 HTML → 提取为 asset，替换为 `<img src="assets/image-001.svg">`，alt 正确
- 无 img/svg/video 的 HTML → 早返回，html 不变，assets 为空
- 只有 `<video>` 无 `<img>` 的 HTML → 不早返回，视频正常处理

### amber/packages/core/src/asset-key.test.ts

新增：
- `assetKey("cap", 0, "video/mp4")` → `"captures/cap/0.mp4"`
- `assetKey("cap", 0, "video/webm")` → `"captures/cap/0.webm"`
- `assetKey("cap", 0, "video/quicktime")` → `"captures/cap/0.mov"`
