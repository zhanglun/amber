# Web UI 阅读体验实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `@amber/web` 的占位 CSS 升级为完整阅读体验，包括 4 套主题切换、中文排版、shiki 代码高亮、字数统计。

**Architecture:** 将现有 `render.ts` 的内联样式拆分为三个独立模块（`styles.ts` / `scripts.ts` / `highlight.ts`），`render.ts` 负责组装。`renderArticle` 因调用 shiki 变为 async，HTTP server（`index.ts`）同步改为 `await`。

**Tech Stack:** shiki（服务端代码高亮）、markdown-it（已有）、CSS Custom Properties（主题系统）、localStorage（主题持久化）、Vitest（测试）

---

## 文件结构

| 操作 | 路径 | 职责 |
|------|------|------|
| 新建 | `packages/web/src/styles.ts` | 4 套主题 CSS variables + 排版 + 组件样式 |
| 新建 | `packages/web/src/styles.test.ts` | styles.ts 单元测试 |
| 新建 | `packages/web/src/scripts.ts` | 主题切换按钮 HTML + localStorage inline script |
| 新建 | `packages/web/src/scripts.test.ts` | scripts.ts 单元测试 |
| 新建 | `packages/web/src/highlight.ts` | shiki 单例 + renderMarkdown（含 fence hook） |
| 新建 | `packages/web/src/highlight.test.ts` | highlight.ts 单元测试 |
| 重写 | `packages/web/src/render.ts` | 使用以上三模块组装页面，renderArticle → async |
| 更新 | `packages/web/src/render.test.ts` | 更新旧测试 + 补充新断言 |
| 更新 | `packages/web/src/index.ts` | `await renderArticle(...)` |
| 更新 | `packages/web/package.json` | 新增 shiki 依赖（exact version） |

---

## Task 1：安装 shiki

**Files:**
- Modify: `packages/web/package.json`

- [x] **Step 1：在 `packages/web` 目录下安装 shiki**

```bash
cd packages/web && pnpm add shiki && cd ../..
```

预期：`packages/web/package.json` 的 `dependencies` 中新增 `"shiki": "^x.y.z"`

- [x] **Step 2：将版本号改为精确版本（去掉 `^`）**

打开 `packages/web/package.json`，找到 shiki 行，将 `"^x.y.z"` 改为 `"x.y.z"`（精确版本号以 Step 1 安装后实际写入的为准）。

- [x] **Step 3：运行现有测试确认无回归**

```bash
pnpm vitest run packages/web/src --reporter verbose
```

预期：4 个已有测试全部 PASS，无新失败。

- [x] **Step 4：提交**

```bash
git add packages/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add shiki dependency"
```

---

## Task 2：创建 styles.ts

**Files:**
- Create: `packages/web/src/styles.ts`
- Create: `packages/web/src/styles.test.ts`

- [x] **Step 1：创建失败测试**

新建 `packages/web/src/styles.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { getStyles } from "./styles.js";

describe("getStyles", () => {
  it("includes CSS custom properties for all four themes", () => {
    const css = getStyles();
    expect(css).toContain("--bg");
    expect(css).toContain('[data-theme="warm"]');
    expect(css).toContain('[data-theme="modern"]');
    expect(css).toContain('[data-theme="dark"]');
  });

  it("includes shiki dual-theme display rules", () => {
    const css = getStyles();
    expect(css).toContain(".shiki.github-dark");
    expect(css).toContain('[data-theme="dark"] .shiki.github-light');
  });

  it("sets max-width for reading layout", () => {
    expect(getStyles()).toContain("--max-width: 680px");
  });
});
```

- [x] **Step 2：运行确认失败**

```bash
pnpm vitest run packages/web/src/styles.test.ts --reporter verbose
```

预期：FAIL — `Cannot find module './styles.js'`

- [x] **Step 3：创建 `packages/web/src/styles.ts`**

```ts
export function getStyles(): string {
  return `<style>
:root {
  --bg: #ffffff;
  --bg-code: #f5f5f5;
  --text: #222222;
  --text-muted: #888888;
  --border: #eeeeee;
  --link: #0066cc;
  --font-body: system-ui, sans-serif;
  --font-mono: ui-monospace, monospace;
  --line-height: 1.8;
  --max-width: 680px;
}
[data-theme="warm"] {
  --bg: #faf8f3;
  --bg-code: #f0ece2;
  --text: #2c1a0e;
  --text-muted: #a89880;
  --border: #e8e0d0;
  --link: #8b4513;
  --font-body: Georgia, serif;
}
[data-theme="modern"] {
  --bg: #f6f7f9;
  --bg-code: #eceef2;
  --text: #1a2030;
  --text-muted: #8892a0;
  --border: #e2e5ea;
  --link: #3b82f6;
  --font-body: system-ui, sans-serif;
}
[data-theme="dark"] {
  --bg: #18181b;
  --bg-code: #27272a;
  --text: #e4e4e7;
  --text-muted: #71717a;
  --border: #3f3f46;
  --link: #60a5fa;
  --font-body: system-ui, sans-serif;
}
html { background: var(--bg); color: var(--text); font-family: var(--font-body); }
body { max-width: var(--max-width); margin: 2rem auto; padding: 0 1rem; font-size: 16px; line-height: var(--line-height); }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
h1 { line-height: 1.3; }
p { margin: 0 0 1em; }
img { max-width: 100%; }
pre, code { font-family: var(--font-mono); background: var(--bg-code); }
pre { padding: 1rem; border-radius: 6px; overflow-x: auto; }
code { padding: .2em .4em; border-radius: 3px; }
pre code { padding: 0; background: none; }
.muted { color: var(--text-muted); font-size: .85rem; }
.header { display: flex; justify-content: space-between; align-items: center; padding: .8rem 0; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.item { padding: .6rem 0; border-bottom: 1px solid var(--border); }
.meta { color: var(--text-muted); font-size: .85rem; margin: .3rem 0 1rem; }
.theme-switcher { display: flex; gap: .4rem; }
.theme-btn { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border); cursor: pointer; padding: 0; }
.theme-btn[data-theme="minimal"] { background: #ffffff; }
.theme-btn[data-theme="warm"]    { background: #faf8f3; }
.theme-btn[data-theme="modern"]  { background: #f6f7f9; }
.theme-btn[data-theme="dark"]    { background: #18181b; }
.theme-btn.active { border-color: var(--link); }
.shiki.github-dark { display: none; }
[data-theme="dark"] .shiki.github-light { display: none; }
[data-theme="dark"] .shiki.github-dark { display: block; }
</style>`;
}
```

- [x] **Step 4：运行确认通过**

```bash
pnpm vitest run packages/web/src/styles.test.ts --reporter verbose
```

预期：3 个测试全部 PASS

- [x] **Step 5：提交**

```bash
git add packages/web/src/styles.ts packages/web/src/styles.test.ts
git commit -m "feat(web): add styles module with 4-theme CSS variables"
```

---

## Task 3：创建 scripts.ts

**Files:**
- Create: `packages/web/src/scripts.ts`
- Create: `packages/web/src/scripts.test.ts`

- [x] **Step 1：创建失败测试**

新建 `packages/web/src/scripts.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { getThemeSwitcherHtml, getThemeScriptHtml } from "./scripts.js";

describe("getThemeSwitcherHtml", () => {
  it("includes buttons for all four themes", () => {
    const html = getThemeSwitcherHtml();
    expect(html).toContain('data-theme="minimal"');
    expect(html).toContain('data-theme="warm"');
    expect(html).toContain('data-theme="modern"');
    expect(html).toContain('data-theme="dark"');
  });

  it("buttons call setTheme on click", () => {
    expect(getThemeSwitcherHtml()).toContain("setTheme");
  });
});

describe("getThemeScriptHtml", () => {
  it("reads and applies theme from localStorage", () => {
    const script = getThemeScriptHtml();
    expect(script).toContain("localStorage");
    expect(script).toContain("amber-theme");
    expect(script).toContain("data-theme");
  });

  it("defines setTheme globally", () => {
    expect(getThemeScriptHtml()).toContain("setTheme");
  });
});
```

- [x] **Step 2：运行确认失败**

```bash
pnpm vitest run packages/web/src/scripts.test.ts --reporter verbose
```

预期：FAIL — `Cannot find module './scripts.js'`

- [x] **Step 3：创建 `packages/web/src/scripts.ts`**

```ts
export function getThemeSwitcherHtml(): string {
  return (
    `<div class="theme-switcher">` +
    `<button class="theme-btn" data-theme="minimal" title="极简" onclick="setTheme('minimal')"></button>` +
    `<button class="theme-btn" data-theme="warm" title="温暖" onclick="setTheme('warm')"></button>` +
    `<button class="theme-btn" data-theme="modern" title="现代" onclick="setTheme('modern')"></button>` +
    `<button class="theme-btn" data-theme="dark" title="暗色" onclick="setTheme('dark')"></button>` +
    `</div>`
  );
}

export function getThemeScriptHtml(): string {
  return `<script>
(function(){
  window.setTheme=function(t){localStorage.setItem('amber-theme',t);document.documentElement.setAttribute('data-theme',t);};
  var t=localStorage.getItem('amber-theme')||'minimal';
  document.documentElement.setAttribute('data-theme',t);
})();
</script>`;
}
```

- [x] **Step 4：运行确认通过**

```bash
pnpm vitest run packages/web/src/scripts.test.ts --reporter verbose
```

预期：4 个测试全部 PASS

- [x] **Step 5：提交**

```bash
git add packages/web/src/scripts.ts packages/web/src/scripts.test.ts
git commit -m "feat(web): add scripts module with theme switcher HTML and localStorage script"
```

---

## Task 4：创建 highlight.ts

**Files:**
- Create: `packages/web/src/highlight.ts`
- Create: `packages/web/src/highlight.test.ts`

- [x] **Step 1：创建失败测试**

新建 `packages/web/src/highlight.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./highlight.js";

describe("renderMarkdown", () => {
  it("renders plain text paragraphs to html", async () => {
    const html = await renderMarkdown("hello world");
    expect(html).toContain("<p>hello world</p>");
  });

  it("highlights known language code blocks with shiki", async () => {
    const html = await renderMarkdown("```typescript\nconst x = 1\n```");
    expect(html).toContain('<pre class="shiki');
  });

  it("falls back to plain pre/code for unknown language without throwing", async () => {
    const html = await renderMarkdown("```unknownlang999\nsome code\n```");
    expect(html).toContain("<pre>");
    expect(html).not.toContain('<pre class="shiki');
  });
});
```

- [x] **Step 2：运行确认失败**

```bash
pnpm vitest run packages/web/src/highlight.test.ts --reporter verbose
```

预期：FAIL — `Cannot find module './highlight.js'`

- [x] **Step 3：创建 `packages/web/src/highlight.ts`**

```ts
import MarkdownIt from "markdown-it";
import { createHighlighter, type Highlighter } from "shiki";

let _highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!_highlighter) {
    _highlighter = await createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: ["typescript", "javascript", "python", "bash", "json", "css", "html", "markdown"],
    });
  }
  return _highlighter;
}

export async function renderMarkdown(content: string): Promise<string> {
  const hl = await getHighlighter();
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    highlight(code, lang) {
      if (lang) {
        try {
          const light = hl.codeToHtml(code, { theme: "github-light", lang });
          const dark = hl.codeToHtml(code, { theme: "github-dark", lang });
          return light + dark;
        } catch {
          // unknown language — fall through to markdown-it default
        }
      }
      return "";
    },
  });
  return md.render(content);
}
```

- [x] **Step 4：运行确认通过**

```bash
pnpm vitest run packages/web/src/highlight.test.ts --reporter verbose
```

预期：3 个测试全部 PASS（shiki 初始化约 200–500 ms，在 5 s 超时内）

- [x] **Step 5：提交**

```bash
git add packages/web/src/highlight.ts packages/web/src/highlight.test.ts
git commit -m "feat(web): add highlight module with shiki server-side rendering"
```

---

## Task 5：重写 render.ts + 更新 render.test.ts

**Files:**
- Rewrite: `packages/web/src/render.ts`
- Update: `packages/web/src/render.test.ts`

- [x] **Step 1：用新的测试替换 `packages/web/src/render.test.ts` 全文**

```ts
import { describe, expect, it } from "vitest";
import { renderArticle, renderList, escapeHtml, readingStats } from "./render.js";

const CAPTURE = {
  id: "c1",
  title: "Title",
  content: "# Heading\n\ntext",
  sourceUrl: "https://example.com/a",
  sourceType: "url" as const,
  createdAt: "2026-06-01T00:00:00.000Z",
  capturedAt: "2026-06-01T00:00:00.000Z",
};

describe("escapeHtml", () => {
  it("escapes html special characters", () => {
    expect(escapeHtml(`a<b>&"c`)).toBe("a&lt;b&gt;&amp;&quot;c");
  });
});

describe("readingStats", () => {
  it("returns zero chars and one minute for empty content", () => {
    expect(readingStats("")).toEqual({ chars: 0, minutes: 1 });
  });

  it("counts non-whitespace non-code-block characters", () => {
    expect(readingStats("你好世界")).toEqual({ chars: 4, minutes: 1 });
  });

  it("excludes fenced code blocks from char count", () => {
    expect(readingStats("```\nconst x = 1\n```")).toEqual({ chars: 0, minutes: 1 });
  });

  it("calculates reading time at 300 chars per minute", () => {
    const result = readingStats("字".repeat(600));
    expect(result.chars).toBe(600);
    expect(result.minutes).toBe(2);
  });
});

describe("renderList", () => {
  const items = [
    { id: "c1", title: "First", sourceUrl: "https://example.com/a", createdAt: "2026-06-01T00:00:00.000Z" },
  ];

  it("links to each capture", () => {
    const html = renderList(items);
    expect(html).toContain('href="/captures/c1"');
    expect(html).toContain("First");
  });

  it("shows hostname and formatted date", () => {
    const html = renderList(items);
    expect(html).toContain("example.com");
    expect(html).toContain("2026-06-01");
  });

  it("shows empty hint when no captures", () => {
    expect(renderList([])).toContain("No captures yet");
  });

  it("includes theme switcher", () => {
    expect(renderList(items)).toContain("theme-switcher");
  });
});

describe("renderArticle", () => {
  it("renders markdown to html", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("text");
  });

  it("includes back link", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('href="/"');
  });

  it("shows word count and reading time", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain("字");
    expect(html).toContain("分钟");
  });

  it("shows source hostname with link to original", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain("example.com");
    expect(html).toContain('href="https://example.com/a"');
  });

  it("includes theme switcher", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain("theme-switcher");
  });
});
```

- [x] **Step 2：运行确认部分测试失败**

```bash
pnpm vitest run packages/web/src/render.test.ts --reporter verbose
```

预期：`escapeHtml` 测试 PASS，其余 `readingStats` / `renderList` 新断言 / `renderArticle` async 相关测试 FAIL

- [x] **Step 3：用以下内容完整替换 `packages/web/src/render.ts`**

```ts
import type { Capture, CaptureSummary } from "@amber/domain";
import { getStyles } from "./styles.js";
import { getThemeSwitcherHtml, getThemeScriptHtml } from "./scripts.js";
import { renderMarkdown } from "./highlight.js";

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

function page(title: string, body: string): string {
  return `<!doctype html><html lang="zh" data-theme="minimal"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${getStyles()}
${getThemeScriptHtml()}
</head><body>${body}</body></html>`;
}

export function renderList(items: CaptureSummary[]): string {
  const switcher = getThemeSwitcherHtml();
  const header = `<div class="header"><h1>Amber</h1>${switcher}</div>`;
  const rows = items
    .map((i) => {
      const hostname = new URL(i.sourceUrl).hostname;
      const date = i.createdAt.slice(0, 10);
      return (
        `<div class="item"><a href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>` +
        `<div class="muted">${escapeHtml(hostname)} · ${date}</div></div>`
      );
    })
    .join("");
  const body =
    header + (rows || "<p class='muted'>No captures yet. Run: amber import &lt;url&gt;</p>");
  return page("Amber", body);
}

export async function renderArticle(capture: Capture): Promise<string> {
  const switcher = getThemeSwitcherHtml();
  const header = `<div class="header"><a class="muted" href="/">← 返回</a>${switcher}</div>`;
  const { chars, minutes } = readingStats(capture.content);
  const hostname = new URL(capture.sourceUrl).hostname;
  const meta =
    `<p class="meta">${chars} 字 · 约 ${minutes} 分钟 · ` +
    `<a href="${escapeHtml(capture.sourceUrl)}">${escapeHtml(hostname)} ↗</a></p>`;
  const content = await renderMarkdown(capture.content);
  const body =
    header + `<h1>${escapeHtml(capture.title)}</h1>` + meta + content;
  return page(capture.title, body);
}
```

- [x] **Step 4：运行确认全部通过**

```bash
pnpm vitest run packages/web/src/render.test.ts --reporter verbose
```

预期：所有测试 PASS

- [x] **Step 5：提交**

```bash
git add packages/web/src/render.ts packages/web/src/render.test.ts
git commit -m "feat(web): rewrite render with 4-theme system, shiki highlight, and reading stats"
```

---

## Task 6：更新 index.ts（async renderArticle）

**Files:**
- Modify: `packages/web/src/index.ts`

- [x] **Step 1：将 `index.ts` 中的 `renderArticle` 调用改为 await**

找到 `packages/web/src/index.ts` 中的这一行：

```ts
return c.html(renderArticle(capture));
```

改为：

```ts
return c.html(await renderArticle(capture));
```

- [x] **Step 2：运行全量类型检查**

```bash
pnpm typecheck
```

预期：无类型错误

- [x] **Step 3：运行全部 web 包测试**

```bash
pnpm vitest run packages/web/src --reporter verbose
```

预期：所有 web 包测试 PASS（styles / scripts / highlight / render 共 ~18 个）

- [x] **Step 4：提交**

```bash
git add packages/web/src/index.ts
git commit -m "feat(web): await async renderArticle in HTTP handler"
```

---

## 完成验证

```bash
pnpm test
pnpm typecheck
```

全部绿灯即为模块二完成。
