# 标签体验闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让已存在但「死」的 `tags` 字段在 Web（列表筛选 + 列表/文章编辑）与 CLI（`amber tag ls/add/rm`）全链路可用。

**Architecture:** 不动存储层与数据契约。core 新增 `normalizeTags` 纯函数并在 `ReadService.updateTags` 单点收口归一化；web 层在 `render.ts` 渲染顶部标签栏、卡片标签、文章标签编辑区，在 `scripts.ts` 扩展筛选脚本（精确成员 OR + 搜索子串 AND）并新增共用编辑脚本；CLI 新增 `tag` 子命令，逻辑抽成可注入假 service 的纯 helper。

**Tech Stack:** TypeScript, Vitest, Hono, citty, @clack/prompts。

关联设计：[2026-06-06-tag-experience-design.md](../specs/2026-06-06-tag-experience-design.md)

---

## File Structure

| 文件 | 变更 | 职责 |
|------|------|------|
| `packages/core/src/tags.ts` | Create | `normalizeTags` 纯函数 |
| `packages/core/src/tags.test.ts` | Create | `normalizeTags` 单测 |
| `packages/core/src/index.ts` | Modify | barrel 导出 `normalizeTags` |
| `packages/core/src/read-service.ts` | Modify | `updateTags` 调用 `normalizeTags` |
| `packages/core/src/read-service.test.ts` | Modify | 归一化断言 |
| `packages/web/src/scripts.ts` | Modify | `tagFilterMatch`、扩展筛选脚本、`getTagEditorScriptHtml` |
| `packages/web/src/scripts.test.ts` | Modify | `tagFilterMatch` 单测 + 脚本断言 |
| `packages/web/src/render.ts` | Modify | 标签栏、卡片标签、文章编辑区、`renderTagEditor` |
| `packages/web/src/render.test.ts` | Modify | 标签渲染断言 |
| `packages/web/src/styles.ts` | Modify | 标签相关样式 |
| `packages/cli/src/commands/tag.ts` | Create | `amber tag` 命令 + 纯 helper |
| `packages/cli/src/commands/tag.test.ts` | Create | helper 单测 |
| `packages/cli/src/main.ts` | Modify | `subCommands` 注册 `tag` |

---

## Task 1: core `normalizeTags` 纯函数

**Files:**
- Create: `packages/core/src/tags.ts`
- Create: `packages/core/src/tags.test.ts`
- Modify: `packages/core/src/index.ts`

- [x] **Step 1: 写失败测试** — Create `packages/core/src/tags.test.ts`

```typescript
import { describe, expect, it } from "vitest";
import { normalizeTags } from "./tags.js";

describe("normalizeTags", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeTags(["  react  ", "vue"])).toEqual(["react", "vue"]);
  });

  it("drops empty and whitespace-only entries", () => {
    expect(normalizeTags(["a", "", "   ", "b"])).toEqual(["a", "b"]);
  });

  it("dedups keeping first occurrence", () => {
    expect(normalizeTags(["a", "b", "a"])).toEqual(["a", "b"]);
  });

  it("is case-sensitive (React and react are distinct)", () => {
    expect(normalizeTags(["React", "react"])).toEqual(["React", "react"]);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeTags([])).toEqual([]);
  });
});
```

- [x] **Step 2: 运行确认失败**

Run: `pnpm test -- tags`
Expected: FAIL，报 `normalizeTags` 无法从 `./tags.js` 解析 / 模块不存在。

- [x] **Step 3: 实现** — Create `packages/core/src/tags.ts`

```typescript
/** 归一化标签数组：去首尾空格、丢弃空串、去重（保留首次出现、区分大小写）。 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (t === "" || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
```

- [x] **Step 4: 导出** — Modify `packages/core/src/index.ts`，在末尾追加一行：

```typescript
export { normalizeTags } from "./tags.js";
```

- [x] **Step 5: 运行确认通过**

Run: `pnpm test -- tags`
Expected: PASS（5 个用例）。

- [x] **Step 6: 提交**

```bash
git add packages/core/src/tags.ts packages/core/src/tags.test.ts packages/core/src/index.ts
git commit -m "feat(core): add normalizeTags helper"
```

---

## Task 2: `ReadService.updateTags` 单点归一化

**Files:**
- Modify: `packages/core/src/read-service.ts`
- Modify: `packages/core/src/read-service.test.ts:53-58`

- [x] **Step 1: 改测试** — 将 `packages/core/src/read-service.test.ts` 中现有的 `"delegates updateTags to the store"` 用例（第 53–58 行）整体替换为：

```typescript
  it("normalizes tags before delegating updateTags to the store", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    await svc.updateTags("c1", [" a ", "a", "", "b"]);
    expect(store.updateTags).toHaveBeenCalledWith("c1", ["a", "b"]);
  });
```

- [x] **Step 2: 运行确认失败**

Run: `pnpm test -- read-service`
Expected: FAIL — 当前实现直接透传，store.updateTags 收到 `[" a ", "a", "", "b"]` 而非 `["a", "b"]`。

- [x] **Step 3: 实现** — Modify `packages/core/src/read-service.ts`

将顶部 import 改为同时引入 `normalizeTags`：

```typescript
import type { Capture, CaptureSummary, Store } from "@amber/domain";
import { normalizeTags } from "./tags.js";
```

将 `updateTags` 方法体改为：

```typescript
  updateTags(id: string, tags: string[]): Promise<void> {
    return this.store.updateTags(id, normalizeTags(tags));
  }
```

- [x] **Step 4: 运行确认通过**

Run: `pnpm test -- read-service`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add packages/core/src/read-service.ts packages/core/src/read-service.test.ts
git commit -m "feat(core): normalize tags in ReadService.updateTags"
```

---

## Task 3: web `tagFilterMatch` 纯函数

**Files:**
- Modify: `packages/web/src/scripts.ts`
- Modify: `packages/web/src/scripts.test.ts`

- [x] **Step 1: 写失败测试** — 在 `packages/web/src/scripts.test.ts` 顶部 import 块加入 `tagFilterMatch`，并在文件末尾追加 describe 块。

把第 1–13 行的 import 块替换为（仅新增 `tagFilterMatch` 一项）：

```typescript
import { describe, expect, it } from "vitest";
import {
  getThemeSwitcherHtml,
  getThemeScriptHtml,
  getSearchBarHtml,
  getListFilterScriptHtml,
  getReaderHeaderScriptHtml,
  getDeleteConfirmScriptHtml,
  calcReadProgress,
  calcRemainingMinutes,
  getReaderEnhancementsScriptHtml,
  getReadIndicatorScriptHtml,
  tagFilterMatch,
} from "./scripts.js";
```

在文件末尾追加：

```typescript
describe("tagFilterMatch", () => {
  it("passes when no query and no active tags", () => {
    expect(tagFilterMatch(["react"], [], "", "Some Title", "example.com")).toBe(true);
  });

  it("matches active tag by exact membership (OR)", () => {
    expect(tagFilterMatch(["react", "ui"], ["ai", "ui"], "", "T", "h")).toBe(true);
    expect(tagFilterMatch(["react"], ["ai", "ui"], "", "T", "h")).toBe(false);
  });

  it("does not substring-match tags (re does not match react)", () => {
    expect(tagFilterMatch(["react"], ["re"], "", "T", "h")).toBe(false);
  });

  it("matches query as substring of title or host (case-insensitive)", () => {
    expect(tagFilterMatch([], [], "wiki", "A Wikipedia Page", "x.com")).toBe(true);
    expect(tagFilterMatch([], [], "example", "T", "example.com")).toBe(true);
    expect(tagFilterMatch([], [], "zzz", "T", "h")).toBe(false);
  });

  it("requires BOTH query and active tag to pass (AND)", () => {
    expect(tagFilterMatch(["react"], ["react"], "nomatch", "T", "h")).toBe(false);
    expect(tagFilterMatch(["react"], ["react"], "title", "Title", "h")).toBe(true);
  });
});
```

- [x] **Step 2: 运行确认失败**

Run: `pnpm test -- scripts`
Expected: FAIL — `tagFilterMatch` 未导出。

- [x] **Step 3: 实现** — 在 `packages/web/src/scripts.ts` 末尾追加（与 `calcReadProgress` 等纯函数并列）：

```typescript
/** 列表筛选判定：标签按精确成员 OR，搜索文本按标题/来源子串，二者 AND。 */
export function tagFilterMatch(
  itemTags: string[],
  activeTags: string[],
  query: string,
  title: string,
  host: string,
): boolean {
  const q = query.trim().toLowerCase();
  const textOk =
    q === "" ||
    title.toLowerCase().includes(q) ||
    host.toLowerCase().includes(q);
  const tagOk =
    activeTags.length === 0 || activeTags.some((t) => itemTags.includes(t));
  return textOk && tagOk;
}
```

- [x] **Step 4: 运行确认通过**

Run: `pnpm test -- scripts`
Expected: PASS。

- [x] **Step 5: 提交**

```bash
git add packages/web/src/scripts.ts packages/web/src/scripts.test.ts
git commit -m "feat(web): add tagFilterMatch pure helper"
```

---

## Task 4: web 筛选脚本扩展 + 共用标签编辑脚本

**Files:**
- Modify: `packages/web/src/scripts.ts`
- Modify: `packages/web/src/scripts.test.ts`

- [x] **Step 1: 写失败测试** — 在 `packages/web/src/scripts.test.ts` 末尾追加。先把 import 块再加一项 `getTagEditorScriptHtml`（紧跟上一 task 加的 `tagFilterMatch` 之后）：

```typescript
  tagFilterMatch,
  getTagEditorScriptHtml,
} from "./scripts.js";
```

再追加：

```typescript
describe("getListFilterScriptHtml", () => {
  it("reads item tags and tag-filter chips", () => {
    const html = getListFilterScriptHtml();
    expect(html).toContain("data-tags");
    expect(html).toContain("tag-filter");
  });
});

describe("getTagEditorScriptHtml", () => {
  it("PATCHes the tags endpoint", () => {
    const html = getTagEditorScriptHtml();
    expect(html).toContain("/tags");
    expect(html).toContain("PATCH");
  });
  it("handles add and remove controls", () => {
    const html = getTagEditorScriptHtml();
    expect(html).toContain("tag-add");
    expect(html).toContain("tag-remove");
  });
});
```

- [x] **Step 2: 运行确认失败**

Run: `pnpm test -- scripts`
Expected: FAIL — `getTagEditorScriptHtml` 未导出，且 `getListFilterScriptHtml` 不含 `data-tags`/`tag-filter`。

- [x] **Step 3: 实现筛选脚本** — 将 `packages/web/src/scripts.ts` 中现有 `getListFilterScriptHtml`（第 26–48 行）整体替换为：

```typescript
export function getListFilterScriptHtml(): string {
  return `<script>
(function(){
  var inp=document.getElementById('search');
  var chips=document.querySelectorAll('.tag-filter[data-tag]');
  var allChip=document.querySelector('.tag-filter-all');
  var active=new Set();
  function itemTags(item){try{return JSON.parse(item.getAttribute('data-tags')||'[]');}catch(e){return [];}}
  function apply(){
    var q=((inp&&inp.value)||'').trim().toLowerCase();
    document.querySelectorAll('.item[data-title]').forEach(function(item){
      var title=item.getAttribute('data-title')||'';
      var host=item.getAttribute('data-host')||'';
      var tags=itemTags(item);
      var textOk=!q||title.indexOf(q)>=0||host.indexOf(q)>=0;
      var tagOk=active.size===0||tags.some(function(t){return active.has(t);});
      item.style.display=(textOk&&tagOk)?'':'none';
    });
    document.querySelectorAll('[data-group]').forEach(function(group){
      var items=group.querySelectorAll('.item[data-title]');
      var n=0;items.forEach(function(i){if(i.style.display!=='none')n++;});
      group.style.display=n===0?'none':'';
      var el=group.querySelector('.count');
      if(el)el.textContent=n;
    });
  }
  if(inp)inp.addEventListener('input',apply);
  chips.forEach(function(chip){
    chip.addEventListener('click',function(){
      var t=chip.getAttribute('data-tag');
      if(active.has(t)){active.delete(t);chip.classList.remove('active');}
      else{active.add(t);chip.classList.add('active');}
      if(allChip)allChip.classList.toggle('active',active.size===0);
      apply();
    });
  });
  if(allChip){
    allChip.classList.add('active');
    allChip.addEventListener('click',function(){
      active.clear();
      chips.forEach(function(c){c.classList.remove('active');});
      allChip.classList.add('active');
      apply();
    });
  }
})();
</script>`;
}
```

- [x] **Step 4: 实现编辑脚本** — 在 `packages/web/src/scripts.ts` 末尾追加（`tagFilterMatch` 之后）：

```typescript
export function getTagEditorScriptHtml(): string {
  return `<script>
(function(){
  function tagsOf(editor){
    return Array.prototype.map.call(
      editor.querySelectorAll('.tag-chip[data-tag]'),
      function(c){return c.getAttribute('data-tag');}
    );
  }
  function save(id,tags){
    return fetch('/captures/'+encodeURIComponent(id)+'/tags',{
      method:'PATCH',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({tags:tags})
    });
  }
  function makeChip(tag){
    var span=document.createElement('span');
    span.className='tag-chip';
    span.setAttribute('data-tag',tag);
    span.textContent=tag;
    var btn=document.createElement('button');
    btn.className='tag-remove';
    btn.type='button';
    btn.title='移除';
    btn.textContent='×';
    span.appendChild(btn);
    return span;
  }
  document.querySelectorAll('.tag-editor[data-capture-id]').forEach(function(editor){
    var id=editor.getAttribute('data-capture-id');
    editor.addEventListener('click',function(ev){
      var t=ev.target;
      if(t.classList&&t.classList.contains('tag-remove')){
        var chip=t.parentNode;
        chip.parentNode.removeChild(chip);
        save(id,tagsOf(editor));
        return;
      }
      if(t.classList&&t.classList.contains('tag-add')){
        var name=window.prompt('新标签');
        if(!name)return;
        name=name.trim();
        if(!name||tagsOf(editor).indexOf(name)>=0)return;
        editor.insertBefore(makeChip(name),t);
        save(id,tagsOf(editor));
      }
    });
  });
})();
</script>`;
}
```

- [x] **Step 5: 运行确认通过**

Run: `pnpm test -- scripts`
Expected: PASS。

- [x] **Step 6: 提交**

```bash
git add packages/web/src/scripts.ts packages/web/src/scripts.test.ts
git commit -m "feat(web): tag filter + shared tag editor scripts"
```

---

## Task 5: web render — 标签栏、卡片标签、文章编辑区

**Files:**
- Modify: `packages/web/src/render.ts`
- Modify: `packages/web/src/render.test.ts`

- [x] **Step 1: 写失败测试** — 在 `packages/web/src/render.test.ts` 末尾追加：

```typescript
describe("renderList tags", () => {
  it("renders a top tag bar with distinct tags from all items", () => {
    const items: CaptureSummary[] = [
      { id: "a", title: "A", sourceUrl: "https://a.com", capturedAt: "2026-06-08T00:00:00.000Z", tags: ["react", "ui"] },
      { id: "b", title: "B", sourceUrl: "https://b.com", capturedAt: "2026-06-08T00:00:00.000Z", tags: ["react", "ai"] },
    ];
    const html = renderList(items);
    expect(html).toContain("tag-bar");
    expect(html).toContain('class="tag-filter-all"');
    expect(html).toContain('data-tag="react"');
    expect(html).toContain('data-tag="ui"');
    expect(html).toContain('data-tag="ai"');
    // 去重：react 作为筛选胶囊只出现一次
    expect(html.match(/<button class="tag-filter" type="button" data-tag="react">/g)?.length).toBe(1);
  });

  it("omits the tag bar when no item has tags", () => {
    const items: CaptureSummary[] = [
      { id: "a", title: "A", sourceUrl: "https://a.com", capturedAt: "2026-06-08T00:00:00.000Z" },
    ];
    expect(renderList(items)).not.toContain("tag-bar");
  });

  it("puts each item's tags into data-tags as JSON and renders an editor", () => {
    const items: CaptureSummary[] = [
      { id: "a", title: "A", sourceUrl: "https://a.com", capturedAt: "2026-06-08T00:00:00.000Z", tags: ["react"] },
    ];
    const html = renderList(items);
    expect(html).toContain('data-tags="[&quot;react&quot;]"');
    expect(html).toContain('class="tag-editor" data-capture-id="a"');
    expect(html).toContain('class="tag-add"');
  });
});

describe("renderArticle tags", () => {
  it("renders an editable tag region for the capture", async () => {
    const html = await renderArticle({ ...CAPTURE, tags: ["react", "ui"] });
    expect(html).toContain(`class="tag-editor" data-capture-id="${CAPTURE.id}"`);
    expect(html).toContain('data-tag="react"');
    expect(html).toContain('data-tag="ui"');
    expect(html).toContain('class="tag-add"');
  });

  it("renders an empty tag editor (just the add button) when no tags", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="tag-editor"');
    expect(html).toContain('class="tag-add"');
  });
});
```

- [x] **Step 2: 运行确认失败**

Run: `pnpm test -- render`
Expected: FAIL — 标签栏/编辑区尚未渲染。

- [x] **Step 3: 实现 render 辅助函数与导入** — Modify `packages/web/src/render.ts`

将第 3–12 行的 scripts import 块改为追加 `getTagEditorScriptHtml`：

```typescript
import {
  getThemeSwitcherHtml,
  getThemeScriptHtml,
  getSearchBarHtml,
  getListFilterScriptHtml,
  getReaderHeaderScriptHtml,
  getDeleteConfirmScriptHtml,
  getReaderEnhancementsScriptHtml,
  getReadIndicatorScriptHtml,
  getTagEditorScriptHtml,
} from "./scripts.js";
```

在 `escapeHtml` 函数（第 45 行 `}` 之后）下方新增三个辅助函数：

```typescript
function collectTags(items: CaptureSummary[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    for (const t of item.tags ?? []) {
      if (!seen.has(t)) {
        seen.add(t);
        out.push(t);
      }
    }
  }
  return out;
}

function renderTagBar(allTags: string[]): string {
  if (allTags.length === 0) return "";
  const chips = allTags
    .map((t) => `<button class="tag-filter" type="button" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
    .join("");
  return `<div class="tag-bar"><button class="tag-filter-all" type="button">全部</button>${chips}</div>`;
}

function renderTagEditor(captureId: string, tags: string[]): string {
  const chips = tags
    .map(
      (t) =>
        `<span class="tag-chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}<button class="tag-remove" type="button" title="移除">×</button></span>`
    )
    .join("");
  return `<div class="tag-editor" data-capture-id="${escapeHtml(captureId)}">${chips}<button class="tag-add" type="button" title="添加标签">+</button></div>`;
}
```

- [x] **Step 4: 在 `renderList` 中接入标签栏、卡片标签、data-tags、编辑脚本** — Modify `packages/web/src/render.ts`

将 `renderList` 中 `rowsHtml` 的 `.map` 回调（现第 78–95 行那段，从 `const hostname` 到 return 结束）替换为：

```typescript
        .map((i) => {
          const hostname = new URL(i.sourceUrl).hostname;
          const date = i.capturedAt.slice(0, 10);
          const rp = escapeHtml(String(i.readProgress ?? ""));
          const ra = escapeHtml(i.readAt ?? "");
          const tags = i.tags ?? [];
          const tagsAttr = escapeHtml(JSON.stringify(tags));
          const excerptHtml = i.excerpt
            ? `<div class="excerpt">${escapeHtml(i.excerpt)}</div>`
            : "";
          return (
            `<div class="item" data-title="${escapeHtml(i.title.toLowerCase())}" data-host="${escapeHtml(hostname)}" data-tags="${tagsAttr}" data-read-progress="${rp}" data-read-at="${ra}">` +
            `<div class="item-main"><a href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>` +
            `<div class="muted">${escapeHtml(hostname)} · ${date}</div>` +
            excerptHtml +
            renderTagEditor(i.id, tags) +
            `</div>` +
            `<form class="delete-form" method="post" action="/captures/${escapeHtml(i.id)}/delete" data-title="${escapeHtml(i.title)}">` +
            `<button class="delete-btn" type="submit" title="删除">删除</button>` +
            `</form></div>`
          );
        })
```

将 `renderList` 中组装 `header` 之后、`if (items.length === 0)` 之前，新增标签栏变量；即把现第 64–67 行：

```typescript
export function renderList(items: CaptureSummary[]): string {
  const searchBar = getSearchBarHtml();
  const switcher = getThemeSwitcherHtml();
  const header = `<div class="header"><h1>Amber</h1><div class="header-right">${searchBar}${switcher}</div></div>`;
```

改为：

```typescript
export function renderList(items: CaptureSummary[]): string {
  const searchBar = getSearchBarHtml();
  const switcher = getThemeSwitcherHtml();
  const header = `<div class="header"><h1>Amber</h1><div class="header-right">${searchBar}${switcher}</div></div>`;
  const tagBar = renderTagBar(collectTags(items));
```

并将非空分支的 body 组装（现第 107 行）：

```typescript
  const body = header + sectionsHtml + getListFilterScriptHtml() + getDeleteConfirmScriptHtml() + getReadIndicatorScriptHtml();
```

改为：

```typescript
  const body = header + tagBar + sectionsHtml + getListFilterScriptHtml() + getDeleteConfirmScriptHtml() + getReadIndicatorScriptHtml() + getTagEditorScriptHtml();
```

（空状态分支保持不变——无内容即无标签栏。）

- [x] **Step 5: 在 `renderArticle` 中接入编辑区与脚本** — Modify `packages/web/src/render.ts`

将 `renderArticle` 中 `meta` 模板（现第 186–191 行）之后、`const toc =` 之前，不改 meta，仅在组装 body 时插入编辑区。具体把 body 模板（现第 199–216 行）中这一段：

```typescript
    `<h1 class="article-title-anchor">${title}</h1>` +
    meta +
    (hasToc ? renderMobileToc(toc) : "") +
```

替换为：

```typescript
    `<h1 class="article-title-anchor">${title}</h1>` +
    meta +
    renderTagEditor(capture.id, capture.tags ?? []) +
    (hasToc ? renderMobileToc(toc) : "") +
```

并把 body 末尾的脚本拼接（现第 215–216 行）：

```typescript
    getReaderHeaderScriptHtml() +
    getReaderEnhancementsScriptHtml({ hasPrev: !!neighbors.prev, hasNext: !!neighbors.next });
```

改为：

```typescript
    getReaderHeaderScriptHtml() +
    getReaderEnhancementsScriptHtml({ hasPrev: !!neighbors.prev, hasNext: !!neighbors.next }) +
    getTagEditorScriptHtml();
```

- [x] **Step 6: 运行确认通过**

Run: `pnpm test -- render`
Expected: PASS。

- [x] **Step 7: 提交**

```bash
git add packages/web/src/render.ts packages/web/src/render.test.ts
git commit -m "feat(web): render tag bar, card tags, and article tag editor"
```

---

## Task 6: web 标签样式

**Files:**
- Modify: `packages/web/src/styles.ts`

- [x] **Step 1: 加样式** — 在 `packages/web/src/styles.ts` 中现有 `.search-bar input:focus` 规则（第 76 行）之后追加以下规则（同一模板字符串内）：

```css
.tag-bar { display: flex; flex-wrap: wrap; gap: .4rem; margin: .6rem 0 1rem; }
.tag-filter, .tag-filter-all { border: 1px solid var(--border); border-radius: 999px; padding: .15rem .6rem; font-size: .78rem; background: var(--bg); color: var(--text-muted); cursor: pointer; }
.tag-filter.active, .tag-filter-all.active { background: var(--link); border-color: var(--link); color: #fff; }
.tag-editor { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .35rem; align-items: center; }
.tag-chip { display: inline-flex; align-items: center; gap: .2rem; border: 1px solid var(--border); border-radius: 999px; padding: .1rem .5rem; font-size: .75rem; color: var(--text-muted); }
.tag-remove { border: none; background: none; color: var(--text-muted); cursor: pointer; font-size: .85rem; line-height: 1; padding: 0; }
.tag-remove:hover { color: var(--link); }
.tag-add { border: 1px dashed var(--border); border-radius: 999px; background: none; color: var(--text-muted); cursor: pointer; font-size: .8rem; line-height: 1; padding: .1rem .45rem; }
.tag-add:hover { color: var(--link); border-color: var(--link); }
```

- [x] **Step 2: 运行确认全套测试通过**

Run: `pnpm test`
Expected: PASS（含 styles.test 现有断言不受影响）。

- [x] **Step 3: 提交**

```bash
git add packages/web/src/styles.ts
git commit -m "style(web): add tag bar, chip, and editor styles"
```

---

## Task 7: CLI `amber tag` 命令

**Files:**
- Create: `packages/cli/src/commands/tag.ts`
- Create: `packages/cli/src/commands/tag.test.ts`
- Modify: `packages/cli/src/main.ts`

- [x] **Step 1: 写失败测试** — Create `packages/cli/src/commands/tag.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest";
import type { Capture } from "@amber/domain";
import { runTagAdd, runTagLs, runTagRm } from "./tag.js";

const cap: Capture = {
  id: "c1", title: "T", content: "body", sourceUrl: "https://x/a",
  sourceType: "url", capturedAt: "2026-01-01T00:00:00.000Z", tags: ["react", "ui"],
};

function fakeReadService(found = true) {
  return {
    get: vi.fn(async (id: string) => (found && id === "c1" ? cap : null)),
    updateTags: vi.fn(async () => {}),
  };
}

describe("runTagLs", () => {
  it("returns current tags", async () => {
    const svc = fakeReadService();
    expect(await runTagLs(svc as never, "c1")).toEqual({ ok: true, tags: ["react", "ui"] });
  });
  it("errors on unknown id", async () => {
    const svc = fakeReadService(false);
    const res = await runTagLs(svc as never, "nope");
    expect(res.ok).toBe(false);
  });
});

describe("runTagAdd", () => {
  it("appends new tags and dedups via normalize", async () => {
    const svc = fakeReadService();
    const res = await runTagAdd(svc as never, "c1", ["ai", "react"]);
    expect(svc.updateTags).toHaveBeenCalledWith("c1", ["react", "ui", "ai"]);
    expect(res).toEqual({ ok: true, tags: ["react", "ui", "ai"] });
  });
  it("errors on unknown id without writing", async () => {
    const svc = fakeReadService(false);
    const res = await runTagAdd(svc as never, "nope", ["x"]);
    expect(res.ok).toBe(false);
    expect(svc.updateTags).not.toHaveBeenCalled();
  });
});

describe("runTagRm", () => {
  it("removes the given tags", async () => {
    const svc = fakeReadService();
    const res = await runTagRm(svc as never, "c1", ["ui"]);
    expect(svc.updateTags).toHaveBeenCalledWith("c1", ["react"]);
    expect(res).toEqual({ ok: true, tags: ["react"] });
  });
  it("errors on unknown id without writing", async () => {
    const svc = fakeReadService(false);
    const res = await runTagRm(svc as never, "nope", ["x"]);
    expect(res.ok).toBe(false);
    expect(svc.updateTags).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: 运行确认失败**

Run: `pnpm test -- commands/tag`
Expected: FAIL — `./tag.js` 不存在 / helper 未导出。

- [x] **Step 3: 实现** — Create `packages/cli/src/commands/tag.ts`

```typescript
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { normalizeTags, type ReadService } from "@amber/core";
import { buildServices } from "../wiring.js";

export type TagResult =
  | { ok: true; tags: string[] }
  | { ok: false; error: string };

/** 读取某条 capture 的标签。 */
export async function runTagLs(readService: ReadService, id: string): Promise<TagResult> {
  const cap = await readService.get(id);
  if (!cap) return { ok: false, error: `Capture not found: ${id}` };
  return { ok: true, tags: cap.tags ?? [] };
}

/** 追加标签（归一化去重）。 */
export async function runTagAdd(readService: ReadService, id: string, add: string[]): Promise<TagResult> {
  const cap = await readService.get(id);
  if (!cap) return { ok: false, error: `Capture not found: ${id}` };
  const next = normalizeTags([...(cap.tags ?? []), ...add]);
  await readService.updateTags(id, next);
  return { ok: true, tags: next };
}

/** 移除标签（区分大小写精确匹配）。 */
export async function runTagRm(readService: ReadService, id: string, remove: string[]): Promise<TagResult> {
  const cap = await readService.get(id);
  if (!cap) return { ok: false, error: `Capture not found: ${id}` };
  const toRemove = new Set(remove);
  const next = (cap.tags ?? []).filter((t) => !toRemove.has(t));
  await readService.updateTags(id, next);
  return { ok: true, tags: next };
}

function report(res: TagResult): void {
  if (!res.ok) {
    p.log.error(res.error);
    process.exitCode = 1;
    return;
  }
  if (res.tags.length === 0) {
    p.log.info("No tags.");
    return;
  }
  p.log.message(res.tags.join(", "));
}

function positionals(args: { _: string[] }): string[] {
  return (args._ ?? []).map(String);
}

export const tagCommand = defineCommand({
  meta: { name: "tag", description: "Manage tags on a capture" },
  subCommands: {
    ls: defineCommand({
      meta: { name: "ls", description: "List tags of a capture" },
      args: { id: { type: "positional", description: "Capture id", required: true } },
      async run(ctx) {
        const [id] = positionals(ctx.args);
        const { readService } = buildServices();
        report(await runTagLs(readService, id));
      },
    }),
    add: defineCommand({
      meta: { name: "add", description: "Add tags to a capture" },
      args: {
        id: { type: "positional", description: "Capture id", required: true },
        tags: { type: "positional", description: "Tags to add", required: true },
      },
      async run(ctx) {
        const [id, ...tags] = positionals(ctx.args);
        if (tags.length === 0) {
          p.log.error("Provide at least one tag.");
          process.exitCode = 1;
          return;
        }
        const { readService } = buildServices();
        report(await runTagAdd(readService, id, tags));
      },
    }),
    rm: defineCommand({
      meta: { name: "rm", description: "Remove tags from a capture" },
      args: {
        id: { type: "positional", description: "Capture id", required: true },
        tags: { type: "positional", description: "Tags to remove", required: true },
      },
      async run(ctx) {
        const [id, ...tags] = positionals(ctx.args);
        if (tags.length === 0) {
          p.log.error("Provide at least one tag.");
          process.exitCode = 1;
          return;
        }
        const { readService } = buildServices();
        report(await runTagRm(readService, id, tags));
      },
    }),
  },
});
```

> 说明：用 `ctx.args._`（citty 收集的位置参数数组）解析 `<id>` 与可变数量标签，避免命名 positional 在变长场景下的绑定差异。`args` 里仍声明 positional 仅用于 `--help` 文案。

- [x] **Step 4: 运行确认通过**

Run: `pnpm test -- commands/tag`
Expected: PASS（6 个用例）。

- [x] **Step 5: 注册命令** — Modify `packages/cli/src/main.ts`

在第 9 行 `import { migrateCommand }` 之后追加：

```typescript
import { tagCommand } from "./commands/tag.js";
```

在 `subCommands` 对象中 `migrate: migrateCommand,` 之后追加一行：

```typescript
    tag: tagCommand,
```

- [x] **Step 6: 验证 CLI 实跑** — 用文件存储跑一遍冒烟（不依赖数据库）：

Run:
```bash
ID=$(ls amber-data/captures 2>/dev/null | head -1 | sed 's/\.json//')
if [ -n "$ID" ]; then
  pnpm amber tag add "$ID" demo-tag
  pnpm amber tag ls "$ID"
  pnpm amber tag rm "$ID" demo-tag
  pnpm amber tag ls "$ID"
fi
```
Expected: `add` 后 `ls` 含 `demo-tag`；`rm` 后 `ls` 不含。若 `amber-data/captures` 为空则跳过（无现成数据），不视为失败。

- [x] **Step 7: 提交**

```bash
git add packages/cli/src/commands/tag.ts packages/cli/src/commands/tag.test.ts packages/cli/src/main.ts
git commit -m "feat(cli): add amber tag ls/add/rm command"
```

---

## Task 8: 全量校验

**Files:** 无（验证关口）

- [x] **Step 1: 类型检查**

Run: `pnpm typecheck`
Expected: 无输出、退出码 0。

- [x] **Step 2: 全量测试**

Run: `pnpm test`
Expected: 全部 PASS（Postgres 集成测试仍按现状 skipped）。

- [x] **Step 3: 如有任一失败** — 用 superpowers:systematic-debugging 定位修复，再重跑直至全绿；不留 `.only`、不注释失败用例。

---

## Self-Review 记录

- **Spec 覆盖**：归一化(Task1/2)、列表标签栏筛选(Task3/4/5)、卡片+文章编辑(Task4/5)、样式(Task6)、CLI ls/add/rm(Task7)、OR+精确成员+搜索 AND(Task3)、乐观更新(Task4)、未知 id 报错(Task7)——逐条有对应任务。
- **类型一致**：`tagFilterMatch(itemTags, activeTags, query, title, host)`、`normalizeTags(tags)`、`getTagEditorScriptHtml()`、`renderTagEditor(captureId, tags)`、`TagResult`/`runTagLs|Add|Rm` 在定义处与引用处签名一致。
- **无占位符**：每个改动步骤均给出完整代码或精确命令。
