# 列表页增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为列表页新增实时搜索（标题 + 域名）和按相对周分组（本周 / 上周 / 更早）。

**Architecture:** 仅修改 `@amber/web` 内三个文件：`scripts.ts` 新增搜索框 HTML + 过滤 JS；`styles.ts` 补充分组和搜索样式；`render.ts` 新增 `groupByWeek()` 纯函数并更新 `renderList` 使用分组结构。`renderList` 签名不变，`index.ts` 无需改动。

**Tech Stack:** TypeScript ESM（`.js` import 解析到 `.ts`，`moduleResolution: "Bundler"`）、Vitest（`vi.useFakeTimers` 用于时间依赖测试）

---

## 文件结构

| 操作 | 路径 | 变更内容 |
|------|------|---------|
| 修改 | `packages/web/src/scripts.ts` | 新增 `getSearchBarHtml()`、`getListFilterScriptHtml()` |
| 修改 | `packages/web/src/scripts.test.ts` | 新增两个函数的测试 |
| 修改 | `packages/web/src/styles.ts` | 补充 `.header-right`、`.search-bar`、`.group-label`、`.count` 样式 |
| 修改 | `packages/web/src/styles.test.ts` | 新增样式覆盖断言 |
| 修改 | `packages/web/src/render.ts` | 新增 `Group` interface、`groupByWeek()`；更新 `renderList` |
| 修改 | `packages/web/src/render.test.ts` | 新增 `groupByWeek` 测试；更新 `renderList` 测试 |

---

## Task 1：scripts.ts — 搜索框 HTML + 过滤 JS

**Files:**
- Modify: `packages/web/src/scripts.ts`
- Modify: `packages/web/src/scripts.test.ts`

- [x] **Step 1：更新 `scripts.test.ts`**

**1a** 将文件顶部已有的 import 改为（添加两个新函数名）：
```ts
import { getThemeSwitcherHtml, getThemeScriptHtml, getSearchBarHtml, getListFilterScriptHtml } from "./scripts.js";
```

**1b** 在文件末尾追加（无需额外 import）：

```ts
describe("getSearchBarHtml", () => {
  it("contains search input with id and type", () => {
    const html = getSearchBarHtml();
    expect(html).toContain('id="search"');
    expect(html).toContain('type="search"');
  });

  it("wraps input in search-bar div", () => {
    expect(getSearchBarHtml()).toContain('class="search-bar"');
  });
});

describe("getListFilterScriptHtml", () => {
  it("filters items by data-title and data-host", () => {
    const script = getListFilterScriptHtml();
    expect(script).toContain("data-title");
    expect(script).toContain("data-host");
  });

  it("toggles group visibility via data-group", () => {
    expect(getListFilterScriptHtml()).toContain("data-group");
  });

  it("updates count element", () => {
    expect(getListFilterScriptHtml()).toContain(".count");
  });
});
```

- [x] **Step 2：运行确认失败**

```bash
pnpm vitest run packages/web/src/scripts.test.ts --reporter verbose
```

预期：新增的 5 个测试 FAIL（`getSearchBarHtml is not a function` 等）

- [x] **Step 3：在 `scripts.ts` 末尾追加两个函数**

```ts
export function getSearchBarHtml(): string {
  return `<div class="search-bar"><input id="search" type="search" placeholder="搜索标题或来源…" autocomplete="off"></div>`;
}

export function getListFilterScriptHtml(): string {
  return `<script>
(function(){
  var inp=document.getElementById('search');
  if(!inp)return;
  inp.addEventListener('input',function(){
    var q=this.value.trim().toLowerCase();
    document.querySelectorAll('.item[data-title]').forEach(function(item){
      var match=!q||item.dataset.title.includes(q)||item.dataset.host.includes(q);
      item.style.display=match?'':'none';
    });
    document.querySelectorAll('[data-group]').forEach(function(group){
      var items=group.querySelectorAll('.item[data-title]');
      var n=0;
      items.forEach(function(i){if(i.style.display!=='none')n++;});
      group.style.display=n===0?'none':'';
      var el=group.querySelector('.count');
      if(el)el.textContent=n;
    });
  });
})();
</script>`;
}
```

- [x] **Step 4：运行确认全部通过**

```bash
pnpm vitest run packages/web/src/scripts.test.ts --reporter verbose
```

预期：所有测试 PASS（原有 4 个 + 新增 5 个，共 9 个）

- [x] **Step 5：提交**

```bash
git add packages/web/src/scripts.ts packages/web/src/scripts.test.ts
git commit -m "feat(web): add search bar and list filter script to scripts module"
```

---

## Task 2：styles.ts — 分组与搜索样式

**Files:**
- Modify: `packages/web/src/styles.ts`
- Modify: `packages/web/src/styles.test.ts`

- [x] **Step 1：在 `styles.test.ts` 中新增断言**

在 `describe("getStyles", ...)` 的 `it` 列表末尾追加：

```ts
  it("includes search bar and group label styles", () => {
    const css = getStyles();
    expect(css).toContain(".header-right");
    expect(css).toContain(".search-bar");
    expect(css).toContain(".group-label");
    expect(css).toContain(".count");
  });
```

- [x] **Step 2：运行确认失败**

```bash
pnpm vitest run packages/web/src/styles.test.ts --reporter verbose
```

预期：新增断言 FAIL

- [x] **Step 3：在 `styles.ts` 的 `getStyles()` 返回字符串中，在 `</style>` 之前追加以下 CSS**

找到 `styles.ts` 中：
```
[data-theme="dark"] .shiki.github-dark { display: block; }
</style>
```

改为：
```
[data-theme="dark"] .shiki.github-dark { display: block; }
.header-right { display: flex; align-items: center; gap: 1rem; }
.search-bar input { border: 1px solid var(--border); border-radius: 6px; padding: .3rem .6rem; font-size: .85rem; background: var(--bg); color: var(--text); width: 180px; }
.search-bar input:focus { outline: none; border-color: var(--link); }
.group { margin-bottom: 1.5rem; }
.group-label { font-size: .8rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid var(--border); padding-bottom: .3rem; margin-bottom: .5rem; }
.group-label .count { font-weight: 400; margin-left: .4rem; }
</style>
```

- [x] **Step 4：运行确认全部通过**

```bash
pnpm vitest run packages/web/src/styles.test.ts --reporter verbose
```

预期：4 个测试全部 PASS

- [x] **Step 5：提交**

```bash
git add packages/web/src/styles.ts packages/web/src/styles.test.ts
git commit -m "feat(web): add search bar and group label styles"
```

---

## Task 3：render.ts — groupByWeek 纯函数

**Files:**
- Modify: `packages/web/src/render.ts`
- Modify: `packages/web/src/render.test.ts`

- [x] **Step 1：在 `render.test.ts` 中添加 `groupByWeek` 测试**

在文件顶部 import 行改为：
```ts
import { describe, expect, it, afterEach, vi } from "vitest";
import { renderArticle, renderList, escapeHtml, readingStats, groupByWeek } from "./render.js";
```

在文件末尾追加：

```ts
describe("groupByWeek", () => {
  afterEach(() => vi.useRealTimers());

  it("returns empty array for empty input", () => {
    expect(groupByWeek([])).toEqual([]);
  });

  it("places this week's item in 本周", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00Z")); // Wednesday; thisMonday=2026-06-01
    const items = [
      { id: "1", title: "A", sourceUrl: "https://x.com", createdAt: "2026-06-02T08:00:00Z" },
    ];
    const groups = groupByWeek(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("本周");
    expect(groups[0].items[0].id).toBe("1");
  });

  it("places last week's item in 上周", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00Z")); // lastMonday=2026-05-25
    const items = [
      { id: "2", title: "B", sourceUrl: "https://x.com", createdAt: "2026-05-26T08:00:00Z" },
    ];
    const groups = groupByWeek(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("上周");
  });

  it("places older item in 更早", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
    const items = [
      { id: "3", title: "C", sourceUrl: "https://x.com", createdAt: "2026-05-01T08:00:00Z" },
    ];
    const groups = groupByWeek(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("更早");
  });

  it("omits empty groups", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
    const items = [
      { id: "3", title: "C", sourceUrl: "https://x.com", createdAt: "2026-05-01T08:00:00Z" },
    ];
    expect(groupByWeek(items)).toHaveLength(1);
  });

  it("returns three groups in order when all ranges have items", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
    const items = [
      { id: "1", title: "A", sourceUrl: "https://x.com", createdAt: "2026-06-02T08:00:00Z" },
      { id: "2", title: "B", sourceUrl: "https://x.com", createdAt: "2026-05-26T08:00:00Z" },
      { id: "3", title: "C", sourceUrl: "https://x.com", createdAt: "2026-05-01T08:00:00Z" },
    ];
    const groups = groupByWeek(items);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.label)).toEqual(["本周", "上周", "更早"]);
  });
});
```

- [x] **Step 2：运行确认失败**

```bash
pnpm vitest run packages/web/src/render.test.ts --reporter verbose
```

预期：`groupByWeek` 相关测试 FAIL（`groupByWeek is not a function`）

- [x] **Step 3：在 `render.ts` 中 `escapeHtml` 之前添加 `Group` interface 和 `groupByWeek`**

在 `render.ts` 顶部 import 之后、`escapeHtml` 之前插入：

```ts
export interface Group {
  label: string;
  items: CaptureSummary[];
}

export function groupByWeek(items: CaptureSummary[]): Group[] {
  const now = new Date();
  const daysToMonday = (now.getUTCDay() + 6) % 7;
  const thisMonday = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysToMonday,
  );
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
```

- [x] **Step 4：运行确认全部通过**

```bash
pnpm vitest run packages/web/src/render.test.ts --reporter verbose
```

预期：所有已有测试 + 新增 `groupByWeek` 测试全部 PASS

- [x] **Step 5：提交**

```bash
git add packages/web/src/render.ts packages/web/src/render.test.ts
git commit -m "feat(web): add groupByWeek utility for relative week grouping"
```

---

## Task 4：render.ts — 更新 renderList 使用分组

**Files:**
- Modify: `packages/web/src/render.ts`
- Modify: `packages/web/src/render.test.ts`

- [x] **Step 1：更新 `render.test.ts` 中 `renderList` 的测试**

将 `describe("renderList", ...)` 整块替换为：

```ts
describe("renderList", () => {
  // 使用远早于当前时间的日期，避免分组依赖执行时间
  const items = [
    {
      id: "c1",
      title: "First Article",
      sourceUrl: "https://example.com/a",
      createdAt: "2020-01-15T00:00:00.000Z",
    },
  ];

  it("links to each capture", () => {
    const html = renderList(items);
    expect(html).toContain('href="/captures/c1"');
    expect(html).toContain("First Article");
  });

  it("shows hostname and formatted date", () => {
    const html = renderList(items);
    expect(html).toContain("example.com");
    expect(html).toContain("2020-01-15");
  });

  it("shows empty hint when no captures", () => {
    expect(renderList([])).toContain("No captures yet");
  });

  it("includes theme switcher", () => {
    expect(renderList(items)).toContain("theme-switcher");
  });

  it("includes search input", () => {
    expect(renderList(items)).toContain('id="search"');
  });

  it("renders grouped sections with data-group attribute", () => {
    expect(renderList(items)).toContain("data-group");
  });

  it("renders items with lowercased data-title and data-host attributes", () => {
    const html = renderList(items);
    expect(html).toContain('data-title="first article"');
    expect(html).toContain('data-host="example.com"');
  });
});
```

- [x] **Step 2：运行确认新增断言失败**

```bash
pnpm vitest run packages/web/src/render.test.ts --reporter verbose
```

预期：`includes search input`、`renders grouped sections`、`data-title` 相关断言 FAIL

- [x] **Step 3：更新 `render.ts` 中的 import 行**

将顶部 import 从：
```ts
import { getThemeSwitcherHtml, getThemeScriptHtml } from "./scripts.js";
```
改为：
```ts
import { getThemeSwitcherHtml, getThemeScriptHtml, getSearchBarHtml, getListFilterScriptHtml } from "./scripts.js";
```

- [x] **Step 4：用以下实现替换 `render.ts` 中的 `renderList` 函数**

```ts
export function renderList(items: CaptureSummary[]): string {
  const switcher = getThemeSwitcherHtml();
  const searchBar = getSearchBarHtml();
  const header = `<div class="header"><h1>Amber</h1><div class="header-right">${searchBar}${switcher}</div></div>`;

  if (items.length === 0) {
    return page("Amber", header + "<p class='muted'>No captures yet. Run: amber import &lt;url&gt;</p>");
  }

  const groups = groupByWeek(items);
  const groupsHtml = groups
    .map((g) => {
      const rowsHtml = g.items
        .map((i) => {
          const hostname = new URL(i.sourceUrl).hostname;
          const date = i.createdAt.slice(0, 10);
          return (
            `<div class="item" data-title="${escapeHtml(i.title.toLowerCase())}" data-host="${escapeHtml(hostname)}">`+
            `<a href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>`+
            `<div class="muted">${escapeHtml(hostname)} · ${date}</div>`+
            `</div>`
          );
        })
        .join("");
      return (
        `<section class="group" data-group>`+
        `<h2 class="group-label">${g.label} <span class="count">${g.items.length}</span></h2>`+
        rowsHtml+
        `</section>`
      );
    })
    .join("");

  return page("Amber", header + groupsHtml + getListFilterScriptHtml());
}
```

- [x] **Step 5：运行全部 render 测试确认通过**

```bash
pnpm vitest run packages/web/src/render.test.ts --reporter verbose
```

预期：所有测试 PASS

- [x] **Step 6：运行全量测试 + typecheck**

```bash
pnpm test && pnpm typecheck
```

预期：全部 PASS，零 typecheck 错误

- [x] **Step 7：提交**

```bash
git add packages/web/src/render.ts packages/web/src/render.test.ts
git commit -m "feat(web): update renderList with weekly grouping and search"
```

---

## 完成验证

```bash
pnpm test
pnpm typecheck
```

全部绿灯即为模块三列表页增强完成。
