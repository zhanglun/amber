# Amber Web UI 阅读体验设计

## 背景

模块二目标：将现有占位 CSS（约 4 行内联样式）升级为完整的阅读体验，包括多主题切换、中文排版优化、代码块语法高亮、字数统计。

---

## 功能范围

- 四套可切换主题：极简 / 温暖 / 现代 / 暗色
- 中文排版：行高 1.8、最大宽度 680px、段落间距
- 代码块语法高亮（shiki，服务端渲染）
- 文章页字数统计 + 预计阅读时间（中文 300 字/分钟）
- 列表页显示抓取日期 + 来源域名

**不在范围内：**
- 列表页字数统计（避免改 domain 接口）
- 搜索 / 过滤（模块三）
- `CaptureSummary` 结构变更

---

## 架构

`packages/web/src/` 文件拆分：

```
styles.ts     新建  4 套主题 CSS variables + 排版 + 组件样式
scripts.ts    新建  主题切换按钮 HTML + localStorage JS
highlight.ts  新建  shiki 单例初始化 + markdown-it fence hook
render.ts     重写  调用以上三个模块，组装 HTML 页面
render.test.ts 更新  补充渲染测试
```

数据流：

```
renderArticle(capture)
  ├── highlight.ts  处理代码块 → shiki 高亮 HTML
  ├── styles.ts     输出 <style> 字符串
  ├── scripts.ts    输出 <script> + 主题切换按钮 HTML
  └── render.ts     组装完整页面
```

依赖变化：`@amber/web` 新增 `shiki`。

---

## 主题系统

通过 CSS Custom Properties 实现。`:root` 定义默认值（极简），其余三套用 `[data-theme="X"]` 覆盖。

```css
:root {
  --bg:          #ffffff;
  --bg-code:     #f5f5f5;
  --text:        #222222;
  --text-muted:  #888888;
  --border:      #eeeeee;
  --link:        #0066cc;
  --font-body:   system-ui, sans-serif;
  --font-mono:   ui-monospace, monospace;
  --line-height: 1.8;
  --max-width:   680px;
}

[data-theme="warm"] {
  --bg:         #faf8f3;
  --bg-code:    #f0ece2;
  --text:       #2c1a0e;
  --text-muted: #a89880;
  --border:     #e8e0d0;
  --link:       #8b4513;
  --font-body:  Georgia, serif;
}

[data-theme="modern"] {
  --bg:         #f6f7f9;
  --bg-code:    #eceef2;
  --text:       #1a2030;
  --text-muted: #8892a0;
  --border:     #e2e5ea;
  --link:       #3b82f6;
  --font-body:  system-ui, sans-serif;
}

[data-theme="dark"] {
  --bg:         #18181b;
  --bg-code:    #27272a;
  --text:       #e4e4e7;
  --text-muted: #71717a;
  --border:     #3f3f46;
  --link:       #60a5fa;
  --font-body:  system-ui, sans-serif;
}
```

**主题切换器：** 页面右上角 4 个小圆点按钮，点击切换。主题 key 存入 `localStorage("amber-theme")`，读取逻辑放在 `<head>` 末尾（inline script），避免页面闪烁。

**代码块双主题：** shiki 同时渲染 `github-light` 和 `github-dark` 两套输出，CSS 控制显隐：

```css
.shiki.github-dark               { display: none; }
[data-theme="dark"] .shiki.github-light { display: none; }
[data-theme="dark"] .shiki.github-dark  { display: block; }
```

---

## Shiki 集成

`highlight.ts` 维护模块级单例，只初始化一次：

```ts
let highlighter: Highlighter | null = null;

export async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["typescript", "javascript", "python", "bash",
              "json", "css", "html", "markdown"],
    });
  }
  return highlighter;
}
```

通过 markdown-it 的 `options.highlight` hook 拦截代码块，调用 shiki 渲染。未识别语言 fallback 为纯文本，不抛错。

`renderArticle` 因此变为 `async`。

---

## 字数统计

```ts
function readingStats(markdown: string): { chars: number; minutes: number } {
  const chars = markdown.replace(/```[\s\S]*?```/g, "").replace(/\s/g, "").length;
  const minutes = Math.max(1, Math.round(chars / 300));
  return { chars, minutes };
}
```

文章页标题下方显示：`2680 字 · 约 9 分钟`

---

## 页面布局

**列表页**

```
Amber                         [● ○ ○ ○]
─────────────────────────────────────────
文章标题
example.com · 2026-06-01

另一篇标题
mp.weixin.qq.com · 2026-05-28
```

- sourceUrl 只取 `hostname`
- 日期取 `createdAt`，格式化为 `YYYY-MM-DD`

**文章页**

```
← 返回                        [● ○ ○ ○]
─────────────────────────────────────────
文章标题

2680 字 · 约 9 分钟 · example.com ↗

正文内容……（max-width: 680px，居中）
```

- meta 行：字数 + 阅读时间 + 来源域名（链接到原文）

---

## 测试要点

- `renderList` 输出包含 hostname 和格式化日期
- `renderArticle` 输出包含字数/分钟 meta
- `renderArticle` 输出包含主题切换按钮
- `readingStats` 边界：空内容返回 `{ chars: 0, minutes: 1 }`
- shiki highlight：有语言标记的代码块输出包含 `<pre class="shiki"`
- shiki highlight：未知语言不抛错，fallback 为 `<pre><code>`

---

## 实现注意事项

### render.ts async 连锁变更

`renderArticle` 因调用 shiki 变为 `async`，`renderList` 保持同步。调用方 `packages/web/src/server.ts`（或等效 HTTP handler）中所有 `renderArticle(...)` 调用需改为 `await renderArticle(...)`。实现计划须覆盖此改动。

### shiki 版本

`@amber/web` 新增 `shiki` 依赖，版本锁定在 `package.json` 中写死为当前最新稳定版（安装时确认）。不使用 `^` 范围，避免 shiki 大版本 breaking change 静默升级。

### 测试中 shiki 初始化性能

`getHighlighter()` 首次调用耗时约 200–500 ms（加载语言语法文件）。测试文件共享模块级单例（模块缓存在 Vitest worker 内复用），无需额外 mock。如测试套件整体超时，可在 `vitest.config` 中对该测试文件单独调高 `testTimeout`。
