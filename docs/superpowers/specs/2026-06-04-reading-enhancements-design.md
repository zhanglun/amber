# Reading Enhancements Design

**Date:** 2026-06-04
**Scope:** Web UI 阅读体验全面增强，包含客户端交互优化与服务端阅读状态持久化。

---

## Overview

在现有专注阅读页（`/captures/:id`）和列表页（`/`）基础上，新增以下能力：

**阅读页客户端增强**
- 顶部阅读进度条
- TOC 当前章节高亮 + 自动跟随滚动
- 代码块语言标签 + 一键复制按钮
- 字体大小调节（A− / A+）
- 键盘快捷键（j/k 滚动，ESC 返回，[ / ] 切换文章）
- 回到顶部浮动按钮
- 动态剩余阅读时间

**阅读状态持久化**
- 滚动时自动保存阅读进度（0–100 整数）到服务端
- 进度 ≥ 95% 时写入 `readAt` 时间戳（标记已读）
- 打开文章时自动恢复上次滚动位置

**列表页增强**
- 每条 capture 显示已读 / 未读 / 进行中状态指示器

**文章导航**
- 文章底部展示上一篇 / 下一篇，标题可点击跳转

---

## Domain 变更

### `Capture` 新增字段

```typescript
// packages/domain/src/index.ts
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
```

### `CaptureSummary` 新增字段

```typescript
export type CaptureSummary = Pick<
  Capture,
  "id" | "title" | "sourceUrl" | "createdAt" | "readProgress" | "readAt"
>;
```

### `Store` 接口新增方法

```typescript
export interface Store {
  insert(capture: Capture): Promise<void>;
  list(): Promise<CaptureSummary[]>;
  get(id: string): Promise<Capture | null>;
  findBySourceUrl(url: string): Promise<Capture | null>;
  delete(id: string): Promise<void>;
  updateReadStatus(id: string, status: { readProgress: number; readAt?: string }): Promise<void>;
}
```

---

## FileStore 变更

### `list()` 补充新字段

```typescript
return all.map((c) => ({
  id: c.id,
  title: c.title,
  sourceUrl: c.sourceUrl,
  createdAt: c.createdAt,
  readProgress: c.readProgress,
  readAt: c.readAt,
}));
```

### 新增 `updateReadStatus()`

读取对应 JSON 文件，合并字段后写回。`readAt` 一旦写入不覆盖（已读不退回未读）：

```typescript
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

---

## ReadService 变更

新增 `updateReadStatus` 直接委托给 Store：

```typescript
updateReadStatus(
  id: string,
  status: { readProgress: number; readAt?: string }
): Promise<void> {
  return this.store.updateReadStatus(id, status);
}
```

---

## Web 层变更

### 新增 API 端点

```
PATCH /captures/:id/read
Content-Type: application/json
Body: { readProgress: number, readAt?: string }
Response: 204 No Content
```

### `renderArticle` 签名变更

```typescript
export async function renderArticle(
  capture: Capture,
  neighbors: { prev: CaptureSummary | null; next: CaptureSummary | null }
): Promise<string>
```

文章底部新增 prev/next footer：
- 两栏布局，左侧上一篇（更新的），右侧下一篇（更早的）
- 无相邻项时对应格隐藏
- nav 锚标签带 `data-nav="prev"` / `data-nav="next"` 属性，供键盘快捷键脚本选取

`.article-shell` 注入 `data-capture-id="${capture.id}"` 和 `data-read-progress="${capture.readProgress ?? 0}"`，供客户端 JS 使用。

### `/captures/:id` 路由变更

```typescript
app.get("/captures/:id", async (c) => {
  const [capture, all] = await Promise.all([
    readService.get(c.req.param("id")),
    readService.list(),
  ]);
  if (!capture) return c.html("<p>Not found. <a href='/'>back</a></p>", 404);
  const idx = all.findIndex((s) => s.id === capture.id);
  const neighbors = {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  };
  return c.html(await renderArticle(capture, neighbors));
});
```

> **已知取舍**：`list()` 在 FileStore 中读取目录所有 JSON。v1 数据量小可接受；接入 Postgres 后自然消除。

### `PATCH /captures/:id/read` 路由

```typescript
app.patch("/captures/:id/read", async (c) => {
  const body = await c.req.json<{ readProgress: number; readAt?: string }>();
  await readService.updateReadStatus(c.req.param("id"), body);
  return c.body(null, 204);
});
```

---

## 客户端行为

所有逻辑以新的脚本函数形式加入 `scripts.ts`，在 `renderArticle` 中注入。

### 滚动监听器（共用）

所有依赖滚动位置的功能挂在同一个 `scroll` 事件上，用 `requestAnimationFrame` 节流：

```
scroll event
  └─ rAF throttle
       ├─ updateProgressBar()
       ├─ updateRemainingTime()
       ├─ updateScrollTopButton()
       └─ debounce 2s → saveReadProgress()
```

### 进度条

- `<div class="read-progress-bar"><div class="read-progress-fill"></div></div>` 置于 `.article-shell` 顶部
- `fill` 宽度 = `scrollTop / (scrollHeight - clientHeight) * 100`%

### TOC 高亮 + 自动跟随

- `IntersectionObserver` 监听所有带 `id` 的 `h2` / `h3`
- 最后一个 `isIntersecting` 的标题对应的 TOC 项加 `active` class
- 切换 active 项时调用 `tocItem.scrollIntoView({ behavior: "smooth", block: "nearest" })`

### 代码块复制按钮

- 页面加载后遍历所有 `pre`，用 `<div class="code-block">` 包裹，注入 `<button class="copy-btn">Copy</button>`
- 若 `pre.dataset.language` 存在（Shiki 注入），同时注入 `<span class="code-lang">${lang}</span>`
- 点击后 `navigator.clipboard.writeText(pre.textContent)`，按钮文字切为 `Copied!`，1.5s 后还原

### 字体大小控制

- `localStorage` key：`amber-font-size`，值为 `14 | 16 | 18 | 20`，默认 `16`
- 初始化时设置 `document.documentElement.style.setProperty('--font-size-article', val + 'px')`
- A− / A+ 按钮步进 ±2，范围 14–20

### 键盘快捷键

| 按键 | 行为 | 条件 |
|------|------|------|
| `j` | 滚动 +200px | 焦点不在输入框 |
| `k` | 滚动 -200px | 焦点不在输入框 |
| `Escape` | 跳转 `/` | 焦点不在输入框 |
| `[` | 跳转上一篇 | prev 链接存在 |
| `]` | 跳转下一篇 | next 链接存在 |

prev / next URL 从 `a[data-nav="prev"]` / `a[data-nav="next"]` 的 `href` 属性读取。

### 回到顶部按钮

- `scrollTop > 300` 时显示（`opacity: 1`），否则隐藏（`opacity: 0; pointer-events: none`）
- 点击调用 `window.scrollTo({ top: 0, behavior: 'smooth' })`

### 动态剩余阅读时间

- 按 300 字/分钟估算
- 滚动时重新计算视口以下的文字字符数，更新 `.meta-remaining` 元素文本
- 初始显示「约 N 分钟」；滚动开始后改为「还剩约 N 分钟」；N = 0 时显示「快读完了」

### 阅读进度保存与恢复

**保存**（debounce 2s）：
```
progress = round(scrollTop / (scrollHeight - clientHeight) * 100)
body = { readProgress: progress }
if progress >= 95: body.readAt = new Date().toISOString()
fetch(`/captures/${id}/read`, { method: 'PATCH', body: JSON.stringify(body) })
```

**恢复**（页面加载）：
```typescript
// capture.readProgress 由服务端渲染时注入 data 属性
const savedProgress = parseInt(articleEl.dataset.readProgress ?? "0", 10);
if (savedProgress > 0 && savedProgress < 95) {
  requestAnimationFrame(() => {
    const target = (scrollHeight - clientHeight) * savedProgress / 100;
    window.scrollTo({ top: target, behavior: "instant" });
  });
}
```

`readProgress` 通过 `data-read-progress` 属性从服务端注入 `.article-shell`。

---

## 列表页已读状态

`CaptureSummary` 已包含 `readProgress` / `readAt`，`renderList` 在每个 `.item` 上注入 `data-read-progress` 和 `data-read-at` 属性。客户端 JS 读取后：

| 状态 | 条件 | 样式 |
|------|------|------|
| 未读 | `readProgress` 为空或 0 | 蓝色圆点 |
| 进行中 | `readProgress` 1–94 | 黄色进度文字「42%」 |
| 已读 | `readAt` 存在 | 灰色圆点，标题降色 |

圆点 `.read-indicator` 置于 `.item-main` 左侧。

---

## 样式新增（`styles.ts`）

| 选择器 | 用途 |
|--------|------|
| `.read-progress-bar` / `.read-progress-fill` | 顶部进度条（高 3px，fixed） |
| `.copy-btn` | 代码块右上角复制按钮 |
| `.code-lang` | 代码块左上角语言标签 |
| `.font-ctrl` / `.font-btn` | topbar 字体大小控件 |
| `.scroll-top-btn` | 右下角回到顶部浮动按钮 |
| `.article-footer` / `.nav-card` | 底部上一篇/下一篇 |
| `.read-indicator` | 列表页状态圆点 |
| `.meta-remaining` | 动态剩余时间文字 |

---

## 文件约束

所有变更后文件必须保持 ≤ 500 行：

| 文件 | 当前行数 | 预估增量 |
|------|---------|---------|
| `packages/domain/src/index.ts` | 52 | +10 |
| `packages/adapters/src/file-store.ts` | 61 | +20 |
| `packages/core/src/read-service.ts` | 17 | +8 |
| `packages/web/src/scripts.ts` | 79 | +120 |
| `packages/web/src/styles.ts` | 111 | +60 |
| `packages/web/src/render.ts` | 161 | +40 |
| `packages/web/src/index.ts` | 70 | +15 |

---

## 测试策略

- **domain / adapters / core**：每个新方法写单元测试（FileStore.updateReadStatus、ReadService.updateReadStatus）
- **web/render**：`renderArticle` with/without neighbors 的快照断言；列表页 `data-read-progress` 属性断言
- **web/index**：`PATCH /captures/:id/read` 返回 204；detail 路由正确注入 `data-read-progress`
- **scripts**（纯函数部分）：进度计算、剩余时间计算可提取为纯函数单独测试
