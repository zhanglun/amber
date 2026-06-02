# 列表页增强设计：搜索 + 时间分组

## 背景

模块三目标：在现有列表页（hostname + 日期）基础上，增加实时搜索和按相对周分组展示，提升内容导航体验。

---

## 功能范围

**IN：**
- 实时搜索框：按标题或来源域名过滤（大小写不敏感）
- 按相对周分组：本周 / 上周 / 更早
- 分组自动隐藏：组内全部条目被过滤时，整组不显示
- 分组计数：每组标题旁显示当前可见条目数

**OUT：**
- Tag 筛选（无 `tags` 字段，留给后续模块）
- 分组折叠/展开
- 排序切换
- 服务端搜索 / 查询参数
- 空结果提示

---

## 架构

`index.ts` 不改动。仅修改 `@amber/web` 内部三个文件：

```
packages/web/src/
  render.ts    — 新增 groupByWeek()（export），renderList 内部调用，签名不变
  scripts.ts   — 新增 getListScriptHtml()，含搜索框 HTML + 过滤 JS
  styles.ts    — 补充 .search-bar、.group-label、.count 样式
```

数据流：

```
GET /
  → readService.list()              ← 不变
  → renderList(items)               ← 签名不变
      → groupByWeek(items)          ← 内部调用，按周分组
      → 生成含三段 <section> 的 HTML
      → 嵌入搜索框 HTML + 过滤 JS
```

---

## 分组逻辑

```ts
interface Group {
  label: string;          // "本周" | "上周" | "更早"
  items: CaptureSummary[];
}

export function groupByWeek(items: CaptureSummary[]): Group[]
```

分组规则（以服务器执行时的当天 00:00 为基准）：

| 组 | 条件 |
|----|------|
| 本周 | `createdAt >= 本周一 00:00` |
| 上周 | `上周一 00:00 ≤ createdAt < 本周一 00:00` |
| 更早 | `createdAt < 上周一 00:00` |

- 空组不渲染（`items.length === 0` 时跳过）
- 所有 items 均为空时，渲染原有空状态提示 `"No captures yet"`
- 时间比较使用 `Date` 对象，以 UTC 为基准（`createdAt` 是 ISO 8601 字符串）

---

## HTML 结构

```html
<div class="header">
  <h1>Amber</h1>
  <div class="header-right">
    <div class="search-bar">
      <input id="search" type="search" placeholder="搜索标题或来源…" autocomplete="off">
    </div>
    [theme-switcher]
  </div>
</div>

<section class="group" data-group>
  <h2 class="group-label">本周 <span class="count">3</span></h2>
  <div class="item" data-title="文章标题" data-host="example.com">
    <a href="/captures/c1">文章标题</a>
    <div class="muted">example.com · 2026-06-02</div>
  </div>
  …
</section>

<section class="group" data-group>
  <h2 class="group-label">上周 <span class="count">2</span></h2>
  …
</section>

<section class="group" data-group>
  <h2 class="group-label">更早 <span class="count">12</span></h2>
  …
</section>
```

每个 `.item` 上挂 `data-title`（小写标题）和 `data-host`（hostname），供 JS 直接读取，无需解析 DOM 文本。

---

## 客户端搜索逻辑

`getListScriptHtml()` 返回内联 `<script>`，逻辑：

```
document.getElementById('search').addEventListener('input', function() {
  var q = this.value.trim().toLowerCase();

  document.querySelectorAll('.item[data-title]').forEach(function(item) {
    var match = !q || item.dataset.title.includes(q) || item.dataset.host.includes(q);
    item.style.display = match ? '' : 'none';
  });

  document.querySelectorAll('[data-group]').forEach(function(group) {
    var items = group.querySelectorAll('.item[data-title]');
    var n = 0;
    items.forEach(function(i) { if (i.style.display !== 'none') n++; });
    group.style.display = n === 0 ? 'none' : '';
    var el = group.querySelector('.count');
    if (el) el.textContent = n;
  });
});
```

`q` 为空时所有条目显示（恢复初始状态）。

---

## 样式补充（styles.ts）

```css
.header-right { display: flex; align-items: center; gap: 1rem; }
.search-bar input {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: .3rem .6rem;
  font-size: .85rem;
  background: var(--bg);
  color: var(--text);
  width: 180px;
}
.search-bar input:focus { outline: none; border-color: var(--link); }
.group { margin-bottom: 1.5rem; }
.group-label { font-size: .8rem; color: var(--text-muted); font-weight: 600;
               text-transform: uppercase; letter-spacing: .05em;
               border-bottom: 1px solid var(--border); padding-bottom: .3rem;
               margin-bottom: .5rem; }
.group-label .count { font-weight: 400; margin-left: .4rem; }
```

---

## 布局示意

```
Amber        [___搜索标题或来源___]     [● ○ ○ ○]
─────────────────────────────────────────────────

本周  3
─────────────────────────────────────────────────
文章标题一
example.com · 2026-06-02

深度解析某技术
github.com · 2026-06-01

上周  2
─────────────────────────────────────────────────
微信文章标题
mp.weixin.qq.com · 2026-05-28

更早  12
─────────────────────────────────────────────────
...
```

搜索过滤后（输入 `github`）：

```
Amber        [____github_________]     [● ○ ○ ○]
─────────────────────────────────────────────────

本周  1
─────────────────────────────────────────────────
深度解析某技术
github.com · 2026-06-01
```

---

## 测试要点

- `groupByWeek([])` 返回 `[]`
- `groupByWeek(items)` 本周条目进 `"本周"` 组
- `groupByWeek(items)` 上周条目进 `"上周"` 组
- `groupByWeek(items)` 更早条目进 `"更早"` 组
- `groupByWeek(items)` 空组不包含在结果中
- `renderList([])` 输出包含 `"No captures yet"`
- `renderList(items)` 输出包含 `.group` 和 `data-group`
- `renderList(items)` 每个 `.item` 含 `data-title` 和 `data-host`
- `renderList(items)` 输出包含搜索框 `<input id="search"`
