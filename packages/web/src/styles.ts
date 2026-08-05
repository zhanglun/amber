export function getStyles(): string {
  return `<style>
/* Hallmark · amber redesign · genre: editorial · design-system: design.md · designed-as-app
   macrostructure: Index-First (list) / Long Document (article)
   themes: light / warm / modern / dark (OKLCH) · fonts: Newsreader + Geist + Geist Mono */

/* ── Token: spacing ── */
:root {
  --space-3xs: 0.125rem;
  --space-2xs: 0.25rem;
  --space-xs:  0.5rem;
  --space-sm:  0.75rem;
  --space-md:  1rem;
  --space-lg:  1.5rem;
  --space-xl:  2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;
  --space-4xl: 6rem;

  /* ── Token: type ── */
  --text-xs:      0.75rem;
  --text-sm:      0.875rem;
  --text-base:    1rem;
  --text-md:      1.125rem;
  --text-lg:      1.25rem;
  --text-xl:      1.5rem;
  --text-2xl:     1.875rem;
  --text-3xl:     2.25rem;
  --text-display: 2.75rem;

  /* ── Token: fonts ── */
  --font-body:    "Newsreader", Georgia, "Songti SC", "STSong", serif;
  --font-ui:      "Geist", "PingFang SC", "Helvetica Neue", sans-serif;
  --font-mono:    "Geist Mono", "JetBrains Mono", ui-monospace, monospace;

  /* ── Token: motion ── */
  --dur-fast:  100ms;
  --dur-base:  150ms;
  --ease-out:  cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:   cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* ── Token: radius ── */
  --radius-sm: 4px;
  --radius-md: 8px;

  /* ── Token: layout ── */
  --measure: 68ch;
  --gutter:  var(--space-xl);
  --max-width: 65ch;
  --font-size-article: var(--text-md);
}

/* ── Theme: light（默认 — 琥珀暖白） ── */
[data-theme="light"] {
  --color-paper:    oklch(97.5% 0.008 85);
  --color-paper-2:  oklch(94.5% 0.010 85);
  --color-ink:      oklch(21% 0.012 55);
  --color-ink-2:    oklch(47% 0.010 55);
  --color-rule:     oklch(89% 0.006 85);
  --color-accent:   oklch(55% 0.13 50);
  --color-focus:    oklch(52% 0.17 50);
}

/* ── Theme: warm（纸张感 sepia） ── */
[data-theme="warm"] {
  --color-paper:    oklch(95% 0.014 80);
  --color-paper-2:  oklch(92% 0.016 80);
  --color-ink:      oklch(24% 0.014 50);
  --color-ink-2:    oklch(50% 0.012 50);
  --color-rule:     oklch(85% 0.010 80);
  --color-accent:   oklch(50% 0.14 35);
  --color-focus:    oklch(48% 0.17 35);
}

/* ── Theme: modern（冷调极简） ── */
[data-theme="modern"] {
  --color-paper:    oklch(98% 0.003 245);
  --color-paper-2:  oklch(95.5% 0.004 245);
  --color-ink:      oklch(22% 0.006 245);
  --color-ink-2:    oklch(49% 0.005 245);
  --color-rule:     oklch(89% 0.003 245);
  --color-accent:   oklch(50% 0.14 235);
  --color-focus:    oklch(48% 0.17 235);
}

/* ── Theme: dark（暖暗夜读） ── */
[data-theme="dark"] {
  --color-paper:    oklch(16% 0.008 60);
  --color-paper-2:  oklch(20% 0.010 60);
  --color-ink:      oklch(92% 0.006 80);
  --color-ink-2:    oklch(67% 0.008 80);
  --color-rule:     oklch(29% 0.008 60);
  --color-accent:   oklch(72% 0.13 55);
  --color-focus:    oklch(74% 0.17 55);
}

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { overflow-x: clip; -webkit-text-size-adjust: 100%; scrollbar-width: thin; scrollbar-color: var(--color-rule) transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-rule); border-radius: 5px; border: 2px solid var(--color-paper); }
::-webkit-scrollbar-thumb:hover { background: var(--color-ink-2); }

body {
  font-family: var(--font-ui);
  background-color: var(--color-paper);
  color: var(--color-ink);
  font-size: var(--text-base);
  line-height: 1.6;
  overflow-x: clip;
  transition: background-color var(--dur-base) var(--ease-out),
              color var(--dur-base) var(--ease-out);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
body.article-body { max-width: none; margin: 0; padding: 0; }

a { color: inherit; text-decoration: none; }
a:hover { text-decoration: none; }

:focus { outline: none; }
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: inherit;
}

img { max-width: 100%; }

/* ── 布局容器 ── */
.page {
  max-width: var(--measure);
  margin: 0 auto;
  padding: 0 var(--gutter);
}

/* ── Header ── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--space-2xl);
  padding-bottom: var(--space-xl);
}
.header h1, .brand {
  font-family: var(--font-ui);
  font-size: var(--text-md);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--color-ink);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin: 0;
}
.brand-mark {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-accent);
  flex-shrink: 0;
}
.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}
.view-nav {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-right: auto;
  margin-left: var(--space-xl);
}
.view-nav a {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--color-ink-2);
  border-bottom: 1px solid transparent;
  padding: var(--space-3xs) 0;
}
.view-nav a:hover { color: var(--color-ink); }
.view-nav a[aria-current="page"] { color: var(--color-ink); border-bottom-color: var(--color-accent); }

/* ── 页面简介 ── */
.page-intro { padding-bottom: var(--space-xl); }
.page-intro p {
  font-family: var(--font-body);
  font-size: var(--text-md);
  font-variation-settings: "opsz" 14;
  color: var(--color-ink-2);
  line-height: 1.5;
}

/* ── 工具栏 ── */
.toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding-bottom: var(--space-lg);
}

/* ── 搜索栏 ── */
.search-bar { position: relative; width: 100%; }
.search-bar input, .search-input {
  width: 100%;
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--color-ink);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-rule);
  padding: var(--space-xs) 0;
  transition: border-color var(--dur-fast) var(--ease-out);
}
.search-bar input::placeholder, .search-input::placeholder { color: var(--color-ink-2); opacity: 0.7; }
.search-bar input:hover, .search-input:hover { border-bottom-color: var(--color-ink-2); }
.search-bar input:focus, .search-input:focus { outline: none; border-bottom-color: var(--color-accent); }
.search-bar input:focus-visible, .search-input:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 4px;
  border-radius: 0;
}

/* ── 过滤行 + 排序组（设计稿：最新 / 最旧 / 未读 三按钮） ── */
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  flex-wrap: wrap;
}
.sort-group {
  display: flex;
  gap: var(--space-md);
}
.sort-toggle {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--color-ink-2);
  padding: var(--space-3xs) 0;
  border-bottom: 1.5px solid transparent;
  transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.sort-toggle:hover { color: var(--color-ink); border-bottom-color: var(--color-ink-2); }
.sort-toggle.active { color: var(--color-accent); border-bottom-color: var(--color-accent); }

/* ── 标签筛选 ── */
.tag-bar {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
  padding-bottom: 0;
}
.tag-filter, .tag-filter-all {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  color: var(--color-ink-2);
  background: transparent;
  border: 1px solid var(--color-rule);
  border-radius: 999px;
  padding: var(--space-3xs) var(--space-sm);
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.tag-filter:hover, .tag-filter-all:hover { border-color: var(--color-ink-2); color: var(--color-ink); }
.tag-filter.active, .tag-filter-all.active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* ── tag 编辑器 ── */
.tag-editor { display: flex; flex-wrap: wrap; gap: var(--space-2xs); margin-top: var(--space-2xs); align-items: center; }
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3xs);
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  color: var(--color-ink-2);
  border: 1px solid var(--color-rule);
  border-radius: 999px;
  padding: var(--space-3xs) var(--space-sm);
}
.tag-remove { border: none; background: none; color: var(--color-ink-2); cursor: pointer; font-size: var(--text-sm); line-height: 1; padding: 0; }
.tag-remove:hover { color: var(--color-accent); }
.tag-add {
  border: 1px dashed var(--color-rule);
  border-radius: 999px;
  background: none;
  color: var(--color-ink-2);
  cursor: pointer;
  font-size: var(--text-sm);
  line-height: 1;
  padding: var(--space-3xs) var(--space-sm);
}
.tag-add:hover { color: var(--color-accent); border-color: var(--color-accent); }

/* ── 列表主体 ── */
.collection { padding-bottom: var(--space-4xl); }

/* ── 长期书架（主题优先，不按保存时间堆叠） ── */
.library-intro { padding: var(--space-xl) 0 var(--space-2xl); max-width: 56ch; }
.library-kicker { font-family: var(--font-mono); font-size: var(--text-xs); letter-spacing: 0.14em; color: var(--color-accent); margin-bottom: var(--space-sm); }
.library-intro h1 { font-family: var(--font-body); font-size: var(--text-3xl); font-variation-settings: "opsz" 60; font-weight: 500; letter-spacing: -0.025em; line-height: 1.15; color: var(--color-ink); text-wrap: balance; }
.library-intro > p:last-child { font-family: var(--font-body); font-size: var(--text-md); color: var(--color-ink-2); line-height: 1.55; margin-top: var(--space-md); }
.library-shelves { display: grid; gap: var(--space-3xl); }
.library-shelf { min-width: 0; }
.library-shelf-heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-md); border-bottom: 1px solid var(--color-rule); padding-bottom: var(--space-sm); }
.library-shelf-heading h2 { font-family: var(--font-ui); font-size: var(--text-sm); font-weight: 600; letter-spacing: -0.01em; color: var(--color-ink); }
.library-shelf-heading span { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-ink-2); }
.library-books { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-left: 1px solid var(--color-rule); }
.library-book { min-width: 0; padding: var(--space-lg); border-right: 1px solid var(--color-rule); border-bottom: 1px solid var(--color-rule); }
.library-book-title { display: block; font-family: var(--font-body); font-size: var(--text-lg); font-variation-settings: "opsz" 24; font-weight: 500; line-height: 1.25; color: var(--color-ink); text-wrap: balance; overflow-wrap: anywhere; }
.library-book:hover .library-book-title { color: var(--color-accent); }
.library-book-meta { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-ink-2); margin-top: var(--space-xs); overflow-wrap: anywhere; }
.library-book-excerpt { font-family: var(--font-body); font-size: var(--text-sm); color: var(--color-ink-2); line-height: 1.5; margin-top: var(--space-sm); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.library-book-tags { display: flex; flex-wrap: wrap; gap: var(--space-2xs); margin-top: var(--space-md); }
.library-book-tag { font-family: var(--font-mono); font-size: 0.6875rem; color: var(--color-ink-2); border: 1px solid var(--color-rule); border-radius: 999px; padding: 1px var(--space-xs); }
.library-empty { font-family: var(--font-body); font-size: var(--text-md); color: var(--color-ink-2); padding: var(--space-3xl) 0; }

/* ── 全库搜索结果 ── */
.search-results { padding-bottom: var(--space-4xl); }
.search-head {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-ink-2);
  margin: var(--space-2xl) 0 var(--space-md);
}
.search-empty { font-family: var(--font-body); font-size: var(--text-md); color: var(--color-ink-2); }
.search-item { padding: var(--space-md) 0; border-bottom: 1px solid var(--color-rule); }
.search-item:first-child { border-top: 1px solid var(--color-rule); }
.search-title { font-family: var(--font-body); font-size: var(--text-md); color: var(--color-ink); line-height: 1.35; }
.search-title:hover { color: var(--color-accent); }
.search-meta { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-ink-2); margin-top: var(--space-2xs); }
.search-snippet { font-family: var(--font-body); font-size: var(--text-sm); color: var(--color-ink-2); margin-top: var(--space-2xs); line-height: 1.5; }
.search-tags { display: flex; flex-wrap: wrap; gap: var(--space-2xs); margin-top: var(--space-sm); }
.search-tag { font-family: var(--font-mono); font-size: 0.6875rem; color: var(--color-ink-2); border: 1px solid var(--color-rule); border-radius: 999px; padding: 1px var(--space-xs); }
.search-title mark, .search-snippet mark, .search-tag mark { background: color-mix(in srgb, var(--color-accent) 22%, transparent); color: inherit; border-radius: 2px; padding: 0 2px; }

.group { margin-bottom: var(--space-3xl); }
.group-label {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-ink-2);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-rule);
  margin: 0;
}
.group-label .count { font-weight: 400; margin-left: var(--space-2xs); opacity: 0.6; }

/* ── 列表行（Index-First hairline） ── */
.item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-rule);
  position: relative;
  transition: background-color var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out);
}
.item:hover { background-color: var(--color-paper-2); }
.item-main { flex: 1; min-width: 0; }
.item-main a {
  font-family: var(--font-body);
  font-size: var(--text-md);
  font-variation-settings: "opsz" 20;
  font-weight: 400;
  line-height: 1.35;
  color: var(--color-ink);
  overflow-wrap: anywhere;
  min-width: 0;
  text-wrap: balance;
}
.item:hover .item-main a { color: var(--color-accent); }

/* ── favicon ── */
.favicon {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-top: var(--space-2xs);
  margin-right: 0;
  object-fit: contain;
  vertical-align: 0;
}
.favicon-failed { display: none; }
.item-date { display: none; }

/* ── 元信息行 ── */
.muted {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: var(--space-2xs);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-ink-2);
  line-height: 1.5;
}
.muted .sep { opacity: 0.4; }
.muted .entry-host { font-family: var(--font-ui); }
.muted .tag { color: var(--color-accent); font-family: var(--font-ui); }

/* ── 摘要 ── */
.excerpt {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-variation-settings: "opsz" 14;
  color: var(--color-ink-2);
  margin-top: var(--space-2xs);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* ── 删除按钮 ── */
.delete-form { flex: 0 0 auto; }
.delete-btn {
  border: none;
  background: transparent;
  color: var(--color-ink-2);
  cursor: pointer;
  font: inherit;
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  padding: var(--space-3xs) var(--space-2xs);
  opacity: 0.4;
  transition: color var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out);
}
.delete-btn:hover, .delete-btn:focus { color: var(--color-accent); opacity: 1; text-decoration: underline; }

/* ── 主题切换 ── */
.theme-switcher {
  display: flex;
  gap: var(--space-2xs);
  padding: var(--space-3xs);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-rule);
}
.theme-btn {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  position: relative;
  transition: opacity var(--dur-fast) var(--ease-out);
  opacity: 0.5;
  padding: 0;
}
.theme-btn:hover { opacity: 0.8; }
.theme-btn[data-theme="light"] { background: oklch(97.5% 0.008 85); border: 1px solid oklch(89% 0.006 85); }
.theme-btn[data-theme="warm"]    { background: oklch(95% 0.014 80); border: 1px solid oklch(85% 0.010 80); }
.theme-btn[data-theme="modern"]  { background: oklch(98% 0.003 245); border: 1px solid oklch(89% 0.003 245); }
.theme-btn[data-theme="dark"]    { background: oklch(16% 0.008 60); border: 1px solid oklch(29% 0.008 60); }
.theme-btn.active { opacity: 1; }
.theme-btn.active::after {
  content: "";
  position: absolute;
  inset: -4px;
  border: 1.5px solid var(--color-accent);
  border-radius: 50%;
}
.theme-btn::before { content: ""; position: absolute; inset: -8px; }

/* ── 列表页 footer ── */
.site-footer {
  padding-top: var(--space-2xl);
  padding-bottom: var(--space-3xl);
  border-top: 1px solid var(--color-rule);
}
.site-footer p {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  color: var(--color-ink-2);
  line-height: 1.5;
}
.site-footer a {
  color: var(--color-accent);
  transition: border-color var(--dur-fast) var(--ease-out);
}
.site-footer a:hover { border-bottom-color: var(--color-accent); }

/* ── 文章页 shell ── */
.article-shell { min-height: 100vh; }

/* ── 文章页 topbar ── */
.article-topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg) clamp(20px, 5vw, 80px);
  border-bottom: 1px solid var(--color-rule);
  background: color-mix(in srgb, var(--color-paper) 75%, transparent);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
}
@supports not ((backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px))) { .article-topbar { background: var(--color-paper); } }
.article-topbar .theme-switcher { justify-self: end; }
.article-topbar .topbar-right { justify-self: end; display: flex; align-items: center; gap: var(--space-md); }
.article-topbar-title {
  max-width: min(44vw, var(--max-width));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-ink);
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: 500;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);
}
.article-topbar.title-visible .article-topbar-title { opacity: 1; transform: translateY(0); }
.article-topbar .back-link {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--color-ink-2);
  transition: color var(--dur-fast) var(--ease-out);
}
.article-topbar .back-link:hover { color: var(--color-ink); }

/* ── 文章页布局 ── */
.article-layout { width: 100%; padding: var(--space-xl) var(--gutter) var(--space-4xl); position: relative; }
.article-main { max-width: var(--max-width); margin: 0 auto; min-width: 0; }
.article-content {
  max-width: var(--max-width);
  font-family: var(--font-body);
  font-size: var(--font-size-article);
  font-variation-settings: "opsz" 14;
  line-height: 1.75;
  color: var(--color-ink);
}
.article-content > h1:first-child { margin-top: 0; }

/* ── 文章标题（Long Document display） ── */
.article-title-anchor {
  font-family: var(--font-body);
  font-size: var(--text-display);
  font-variation-settings: "opsz" 60;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.015em;
  color: var(--color-ink);
  overflow-wrap: anywhere;
  min-width: 0;
  padding-bottom: var(--space-md);
  text-wrap: balance;
}

/* ── 文章元信息 ── */
.meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--color-ink-2);
  margin: 0 0 var(--space-lg);
  line-height: 1.5;
}
.meta .sep { opacity: 0.35; }
.meta a { color: var(--color-accent); }
.meta .author { color: var(--color-ink); font-weight: 500; }
.meta-remaining { font-family: var(--font-mono); font-size: var(--text-xs); transition: color var(--dur-base) var(--ease-out); }

/* ── 封面图 ── */
.article-cover {
  margin: 0 0 var(--space-2xl);
  max-width: 100%;
}
.cover-image {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: var(--radius-sm);
}
.cover-placeholder {
  width: 100%;
  aspect-ratio: 16 / 7;
  border-radius: var(--radius-sm);
  background: var(--color-paper-2);
  border: 1px solid var(--color-rule);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-ink-2);
  opacity: 0.5;
  overflow: hidden;
}
.cover-placeholder svg { width: 100%; height: 100%; display: block; }
.cover-caption {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  color: var(--color-ink-2);
  margin-top: var(--space-xs);
  text-align: center;
}

/* ── 正文排版（prose） ── */
.article-content p { margin-bottom: var(--space-lg); }
.article-content .lede {
  font-size: var(--text-lg);
  line-height: 1.6;
  color: var(--color-ink);
  font-weight: 400;
}
.article-content .lede::first-letter {
  font-variation-settings: "opsz" 72;
  font-size: 3.2em;
  font-weight: 600;
  float: left;
  line-height: 0.85;
  margin-right: var(--space-2xs);
  margin-top: var(--space-2xs);
  color: var(--color-accent);
}
.article-content h2 {
  font-family: var(--font-body);
  font-size: var(--text-xl);
  font-variation-settings: "opsz" 36;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-ink);
  margin-top: var(--space-2xl);
  margin-bottom: var(--space-md);
  text-wrap: balance;
}
.article-content h3 {
  font-family: var(--font-body);
  font-size: var(--text-lg);
  font-variation-settings: "opsz" 24;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-ink);
  margin-top: var(--space-xl);
  margin-bottom: var(--space-sm);
}
.article-content a:not(.nav-card):not(.source-link) {
  color: var(--color-accent);
  border-bottom: 1px solid transparent;
  transition: border-color var(--dur-fast) var(--ease-out);
}
.article-content a:not(.nav-card):not(.source-link):hover { border-bottom-color: var(--color-accent); }
.article-content blockquote {
  margin: var(--space-xl) 0;
  padding-left: var(--space-lg);
  border-left: 2px solid var(--color-accent);
  font-style: italic;
  font-size: var(--text-md);
  line-height: 1.7;
  color: var(--color-ink-2);
}
.article-content blockquote p { margin-bottom: var(--space-sm); }
.article-content blockquote p:last-child { margin-bottom: 0; }
.article-content blockquote cite {
  display: block;
  margin-top: var(--space-sm);
  font-size: var(--text-sm);
  font-style: normal;
  color: var(--color-ink-2);
  opacity: 0.7;
}
.article-content code {
  font-family: var(--font-mono);
  font-size: 0.85em;
  background: var(--color-paper-2);
  padding: var(--space-3xs) var(--space-2xs);
  border-radius: var(--radius-sm);
  color: var(--color-ink);
}
.article-content pre {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.55;
  background: var(--color-paper-2);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-md);
  padding: var(--space-md) var(--space-lg);
  overflow-x: auto;
  margin: var(--space-lg) 0;
}
.article-content pre code { background: none; padding: 0; border-radius: 0; font-size: inherit; }
.article-content ul, .article-content ol { margin: var(--space-lg) 0; padding-left: var(--space-xl); }
.article-content li { margin-bottom: var(--space-xs); line-height: 1.7; }
.article-content ul li::marker { color: var(--color-accent); font-size: 0.9em; }
.article-content ol li::marker { color: var(--color-ink-2); font-family: var(--font-mono); font-size: var(--text-sm); }
.article-content img { border-radius: var(--radius-sm); margin: var(--space-lg) 0; }
.article-content figure { margin: var(--space-xl) 0; }
.article-content figcaption {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  color: var(--color-ink-2);
  margin-top: var(--space-xs);
  text-align: center;
  line-height: 1.5;
}
.article-content hr {
  border: none;
  margin: var(--space-2xl) 0;
  text-align: center;
}
.article-content hr::after {
  content: "* * *";
  font-family: var(--font-body);
  color: var(--color-rule);
  letter-spacing: var(--space-md);
}

/* ── TOC ── */
.toc {
  position: fixed;
  top: 5rem;
  right: var(--toc-right, max(1rem, calc((100vw - var(--max-width)) / 2 - 260px)));
  width: 220px;
  max-height: calc(100vh - 6rem);
  overflow: auto;
  border-left: 1px solid var(--color-rule);
  padding-left: var(--space-md);
  font-size: var(--text-sm);
  line-height: 1.45;
}
.toc-title {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-ink-2);
  margin-bottom: var(--space-xs);
}
.toc-list { list-style: none; margin: 0; padding: 0; }
.toc-item { margin: var(--space-2xs) 0; }
.toc-item.level-3 { padding-left: var(--space-sm); }
.toc a { font-family: var(--font-ui); font-size: var(--text-sm); color: var(--color-ink-2); }
.toc a:hover { color: var(--color-accent); }
.toc-item.active > a { color: var(--color-accent); font-weight: 500; }
.toc-item.active > a::before { content: ''; display: inline-block; width: 5px; height: 5px; background: var(--color-accent); border-radius: 50%; margin-right: var(--space-2xs); vertical-align: middle; margin-bottom: 1px; }

.toc-mobile {
  display: none;
  margin: var(--space-md) 0 var(--space-lg);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
}
.toc-mobile summary { cursor: pointer; font-family: var(--font-ui); font-size: var(--text-sm); color: var(--color-ink-2); }
.toc-mobile .toc-list { margin-top: var(--space-sm); }
.toc-mobile a { color: var(--color-ink-2); }

/* ── 视频嵌入 ── */
.video-embed { margin: var(--space-xl) 0; }
.video-embed video { display: block; width: 100%; max-height: 70vh; background: #000; border-radius: var(--radius-sm); }
.video-embed figcaption { margin-top: var(--space-2xs); font-family: var(--font-ui); font-size: var(--text-xs); color: var(--color-ink-2); }

/* ── 阅读进度条 ── */
.read-progress-bar { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 200; background: transparent; pointer-events: none; }
.read-progress-fill { height: 100%; width: 0; background: var(--color-accent); transition: width .1s linear; }

/* ── 代码块增强 ── */
.code-block { position: relative; margin: var(--space-lg) 0; }
.code-block pre { margin: 0; }
.code-lang { position: absolute; top: var(--space-2xs); left: var(--space-md); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-2); pointer-events: none; }
.copy-btn {
  position: absolute;
  top: var(--space-2xs);
  right: var(--space-sm);
  padding: var(--space-3xs) var(--space-2xs);
  border-radius: var(--radius-sm);
  background: var(--color-paper);
  border: 1px solid var(--color-rule);
  color: var(--color-ink-2);
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.copy-btn:hover { color: var(--color-ink); border-color: var(--color-ink-2); }
.copy-btn.copied { color: var(--color-accent); border-color: var(--color-accent); }

/* ── font controls ── */
.font-ctrl { display: flex; gap: var(--space-2xs); }
.font-btn {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-rule);
  background: transparent;
  color: var(--color-ink-2);
  cursor: pointer;
  font: inherit;
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.font-btn:hover { color: var(--color-ink); border-color: var(--color-ink-2); }

/* ── 回到顶部 ── */
.scroll-top-btn {
  position: fixed;
  bottom: var(--space-lg);
  right: var(--space-lg);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-paper-2);
  border: 1px solid var(--color-rule);
  color: var(--color-ink-2);
  font-size: var(--text-base);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur-base) var(--ease-out), color var(--dur-fast) var(--ease-out);
  z-index: 50;
}
.scroll-top-btn:hover { color: var(--color-ink); }

/* ── 文章底部（设计稿：tags chip + 原文链接） ── */
.article-foot {
  border-top: 1px solid var(--color-rule);
  margin-top: var(--space-2xl);
  padding-top: var(--space-xl);
}
.tags-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
  margin-bottom: var(--space-lg);
}
.tag-label {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-ink-2);
  margin-right: var(--space-2xs);
}
.source-link {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--color-ink-2);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
}
.source-link .link-text {
  color: var(--color-accent);
  border-bottom: 1px solid transparent;
  transition: border-color var(--dur-fast) var(--ease-out);
}
.source-link:hover .link-text { border-bottom-color: var(--color-accent); }

/* ── 文章底部导航 ── */
.article-footer {
  margin-top: var(--space-xl);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}
.nav-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  background: transparent;
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  text-decoration: none;
  color: inherit;
  transition: border-color var(--dur-fast) var(--ease-out);
}
.nav-card:hover { border-color: var(--color-accent); text-decoration: none; }
.nav-card-next { text-align: right; }
.nav-dir { font-family: var(--font-ui); font-size: var(--text-xs); color: var(--color-ink-2); }
.nav-title { font-family: var(--font-body); font-size: var(--text-sm); color: var(--color-ink); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── 阅读状态指示器 ── */
.read-indicator { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; margin-right: var(--space-xs); margin-top: var(--space-2xs); }
.read-indicator.unread { background: var(--color-accent); }
.read-indicator.in-progress { width: auto; height: auto; border-radius: var(--radius-sm); background: transparent; color: var(--color-accent); font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 600; padding: var(--space-3xs) var(--space-2xs); margin-top: var(--space-2xs); }
.read-indicator.read { background: var(--color-rule); }
.title-read { color: var(--color-ink-2); }

/* ── 入场动画 ── */
.item-entering { opacity: 0; transform: translateY(6px); }

/* ── Shiki 双主题 ── */
.shiki.github-dark { display: none; }
[data-theme="dark"] .shiki.github-light { display: none; }
[data-theme="dark"] .shiki.github-dark { display: block; }

/* ── 响应式 ── */
@media (max-width: 900px) {
  .article-layout { display: block; max-width: var(--max-width); padding: var(--space-md) var(--gutter) var(--space-3xl); }
  .toc { display: none; }
  .toc-mobile { display: block; }
}
@media (max-width: 640px) {
  :root { --gutter: var(--space-lg); }
  .header { flex-wrap: wrap; }
  .view-nav { order: 3; width: 100%; margin: 0; }
  .header-right { margin-left: auto; }
  .filter-row { flex-direction: column; align-items: flex-start; }
  .library-intro h1 { font-size: var(--text-2xl); }
  .library-books { grid-template-columns: 1fr; }
  .article-title-anchor { font-size: var(--text-2xl); }
}
@media (max-width: 400px) {
  .header { flex-direction: column; align-items: flex-start; gap: var(--space-md); }
}

/* ── reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  .article-topbar-title { transform: none; }
}

/* ============================================================
   视觉世界（data-style）：在 editorial 之上叠加 ink / archive。
   data-theme 的 4 种情绪（light/warm/modern/dark）被每个世界重新诠释。
   所有覆盖用 [data-style="X"] / [data-style="X"][data-theme="Y"] 提特异性。
   ============================================================ */

/* ── 墨水图书馆（ink）：深色优先夜读，Fraunces 表现型衬线 ── */
[data-style="ink"] {
  --font-body: "Fraunces", Georgia, "Songti SC", serif;
  --font-ui:   "Inter Tight", "PingFang SC", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
[data-style="ink"] .brand { font-family: var(--font-body); font-size: var(--text-lg); font-weight: 500; font-variation-settings: "opsz" 60, "WONK" 1; letter-spacing: -0.01em; }
[data-style="ink"] .brand-mark { background: var(--color-accent); }
[data-style="ink"] .group-label { font-family: var(--font-ui); }
[data-style="ink"] .item-main a { font-variation-settings: "opsz" 24; }
[data-style="ink"] .article-title-anchor { font-variation-settings: "opsz" 144, "WONK" 1; letter-spacing: -0.02em; font-weight: 500; }
[data-style="ink"] .article-content h2 { font-variation-settings: "opsz" 60; font-weight: 500; }
[data-style="ink"] .article-content .lede::first-letter { font-variation-settings: "opsz" 144, "WONK" 1; font-size: 4.4em; font-weight: 500; }
[data-style="ink"] .article-topbar { background: color-mix(in srgb, var(--color-paper) 72%, transparent); }
[data-style="ink"] .read-progress-fill { box-shadow: 0 0 14px color-mix(in srgb, var(--color-accent) 50%, transparent); }
[data-style="ink"] .toc-item.active > a::before { background: var(--color-accent); }

/* ── ink：逐元素对齐 A1 稿件 ── */
[data-style="ink"] { --max-width: 66ch; }
[data-style="ink"] body { font-family: var(--font-body); font-size: 18px; line-height: 1.7; }
[data-style="ink"] .article-main { font-family: var(--font-body); }
[data-style="ink"] .muted { font-family: var(--font-ui); font-size: 12.5px; }
[data-style="ink"] .article-content { line-height: 1.7; }
[data-style="ink"] .article-content p { margin: 1.1em 0; }
[data-style="ink"] .article-content .lede { font-size: var(--text-md); line-height: 1.7; }
[data-style="ink"] .article-content h2 { font-size: 27px; letter-spacing: -0.01em; margin: 2.2em 0 0.5em; line-height: 1.2; }
[data-style="ink"] .meta { font-size: 13px; line-height: 1.7; margin: 14px 0 0; }
[data-style="ink"] .article-foot { padding-top: 22px; }
[data-style="ink"] .article-topbar { padding: 14px 28px; -webkit-backdrop-filter: blur(14px) saturate(1.2); backdrop-filter: blur(14px) saturate(1.2); }
[data-style="ink"] .cover-placeholder { font-family: var(--font-body); color: var(--color-ink-2); }

/* ink · light = 日间犊皮纸（vellum） */
[data-style="ink"][data-theme="light"] {
  --color-paper: oklch(94% 0.02 82); --color-paper-2: oklch(91% 0.022 82);
  --color-ink: oklch(24% 0.02 55);  --color-ink-2: oklch(46% 0.018 50);
  --color-rule: oklch(82% 0.018 80); --color-accent: oklch(48% 0.12 70); --color-focus: oklch(50% 0.16 70);
}
/* ink · warm = 暗厅羊皮 */
[data-style="ink"][data-theme="warm"] {
  --color-paper: oklch(90% 0.03 70); --color-paper-2: oklch(86% 0.032 70);
  --color-ink: oklch(26% 0.025 50); --color-ink-2: oklch(48% 0.02 48);
  --color-rule: oklch(78% 0.025 70); --color-accent: oklch(46% 0.13 55); --color-focus: oklch(48% 0.17 55);
}
/* ink · modern = 冷调墨夜 */
[data-style="ink"][data-theme="modern"] {
  --color-paper: oklch(20% 0.014 250); --color-paper-2: oklch(24% 0.015 250);
  --color-ink: oklch(90% 0.01 240);   --color-ink-2: oklch(66% 0.012 240);
  --color-rule: oklch(30% 0.012 250); --color-accent: oklch(72% 0.12 220); --color-focus: oklch(74% 0.16 220);
}
/* ink · dark = 午夜琥珀金（标志夜读） */
[data-style="ink"][data-theme="dark"] {
  --color-paper: oklch(17% 0.012 60); --color-paper-2: oklch(21% 0.014 60);
  --color-ink: oklch(90% 0.015 80);  --color-ink-2: oklch(66% 0.02 75);
  --color-rule: oklch(29% 0.013 60); --color-accent: oklch(80% 0.13 75); --color-focus: oklch(82% 0.16 75);
}
/* ink 冷调墨夜同为深底，代码块走暗主题 */
[data-style="ink"][data-theme="modern"] .shiki.github-light { display: none; }
[data-style="ink"][data-theme="modern"] .shiki.github-dark { display: block; }

/* ── 瑞士档案（archive）：全 grotesque + 等宽数据列，瑞士红极度克制 ── */
[data-style="archive"] {
  --font-body: "Inter", "PingFang SC", system-ui, sans-serif;
  --font-ui:   "Inter", "PingFang SC", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
}
[data-style="archive"] .brand { font-family: var(--font-ui); font-weight: 600; letter-spacing: -0.03em; text-transform: lowercase; }
[data-style="archive"] .brand-mark { border-radius: 0; width: 10px; height: 10px; }
[data-style="archive"] .group-label { font-family: var(--font-mono); letter-spacing: 0.14em; font-weight: 500; border-bottom: 1px solid var(--color-ink); }
[data-style="archive"] .group-label .count { font-family: var(--font-mono); color: var(--color-accent); }
[data-style="archive"] .item { display: grid; grid-template-columns: auto 1fr auto auto; gap: var(--space-md); align-items: baseline; }
[data-style="archive"] .item-main { display: contents; }
[data-style="archive"] .excerpt, [data-style="archive"] .tag-editor, [data-style="archive"] .read-indicator { display: none; }
[data-style="archive"] .favicon { display: none; }
[data-style="archive"] .item-date { display: block; font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-ink-2); letter-spacing: 0.02em; white-space: nowrap; }
[data-style="archive"] .meta-rel { display: none; }
[data-style="archive"] .item-main a { font-family: var(--font-ui); font-weight: 500; font-size: var(--text-base); letter-spacing: -0.01em; }
[data-style="archive"] .muted { font-family: var(--font-mono); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.04em; }
[data-style="archive"] .muted .entry-host { font-family: var(--font-mono); }
[data-style="archive"] .sort-toggle { font-family: var(--font-mono); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.06em; }
[data-style="archive"] .tag-filter, [data-style="archive"] .tag-filter-all { font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.04em; border-radius: 0; }
[data-style="archive"] .article-title-anchor { font-family: var(--font-ui); font-variation-settings: normal; letter-spacing: -0.035em; font-weight: 600; }
[data-style="archive"] .meta { font-family: var(--font-mono); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: 0.06em; }
[data-style="archive"] .article-content { font-family: var(--font-body); }
[data-style="archive"] .article-content h2 { font-family: var(--font-ui); font-weight: 600; letter-spacing: -0.02em; padding-top: var(--space-xl); border-top: 1px solid var(--color-rule); }
[data-style="archive"] .article-content .lede { font-size: var(--text-md); }
[data-style="archive"] .article-content .lede::first-letter { font-size: 1em; float: none; margin: 0; color: var(--color-ink); font-weight: 600; font-variation-settings: normal; }
[data-style="archive"] .article-content blockquote { font-style: normal; }
[data-style="archive"] .article-content ul li::marker { content: "+  "; color: var(--color-accent); font-family: var(--font-mono); }
[data-style="archive"] .article-content pre { border-left: 2px solid var(--color-ink); border-radius: 0; }
[data-style="archive"] .toc-title { font-family: var(--font-mono); }
[data-style="archive"] .tag-label { font-family: var(--font-mono); }

/* ── ink/archive 文章页结构深度还原（对齐 A1/A2 稿件）── */
[data-style="archive"] .article-topbar { background: var(--color-paper); border-bottom: 1px solid var(--color-ink); }
[data-style="archive"] .header { border-bottom: 2px solid var(--color-ink); }
[data-style="archive"] .meta { border-bottom: 1px solid var(--color-rule); padding-bottom: var(--space-lg); }
[data-style="ink"] .item:hover { background: linear-gradient(90deg, var(--color-paper-2), transparent 80%); }
[data-style="ink"] .group-label .count { font-family: var(--font-mono); color: var(--color-accent); opacity: 1; }

/* archive · light = 冷纸（标志） */
[data-style="archive"][data-theme="light"] {
  --color-paper: oklch(98.5% 0.002 250); --color-paper-2: oklch(95.5% 0.003 250);
  --color-ink: oklch(22% 0.005 250);    --color-ink-2: oklch(46% 0.005 250);
  --color-rule: oklch(90% 0.003 250);   --color-accent: oklch(52% 0.19 25); --color-focus: oklch(50% 0.17 25);
}
/* archive · warm = 牛皮纸归档 */
[data-style="archive"][data-theme="warm"] {
  --color-paper: oklch(95% 0.012 75); --color-paper-2: oklch(92% 0.014 75);
  --color-ink: oklch(24% 0.012 60);   --color-ink-2: oklch(46% 0.01 55);
  --color-rule: oklch(85% 0.012 75);  --color-accent: oklch(50% 0.16 25); --color-focus: oklch(48% 0.16 25);
}
/* archive · modern = 蓝图 */
[data-style="archive"][data-theme="modern"] {
  --color-paper: oklch(96% 0.02 230); --color-paper-2: oklch(92% 0.024 230);
  --color-ink: oklch(28% 0.04 235);  --color-ink-2: oklch(42% 0.03 235);
  --color-rule: oklch(86% 0.025 230); --color-accent: oklch(50% 0.16 230); --color-focus: oklch(50% 0.17 230);
}
/* archive · dark = 碳黑 */
[data-style="archive"][data-theme="dark"] {
  --color-paper: oklch(15% 0.004 250); --color-paper-2: oklch(19% 0.005 250);
  --color-ink: oklch(92% 0.004 240);  --color-ink-2: oklch(66% 0.005 240);
  --color-rule: oklch(28% 0.005 250); --color-accent: oklch(66% 0.18 25); --color-focus: oklch(68% 0.17 25);
}

/* ── archive：逐元素对齐 A2 稿件 ── */
[data-style="archive"] { --max-width: 68ch; }
[data-style="archive"] .article-content { font-size: 16px; line-height: 1.6; }
[data-style="archive"] .article-content p { font-size: 17px; margin: 1.15em 0; }
[data-style="archive"] .article-content .lede { font-size: 19px; line-height: 1.6; }
[data-style="archive"] .article-content h2 { font-size: 22px; line-height: 1.6; margin: 2.4em 0 0.6em; padding-top: 1.2em; }
[data-style="archive"] .meta { font-size: 11px; letter-spacing: 0.08em; margin: 22px 0 0; padding-bottom: 18px; }
[data-style="archive"] .article-topbar { padding: 16px 48px; }
[data-style="archive"] .article-foot { margin-top: 48px; padding-top: 18px; }
[data-style="archive"] .cover-placeholder { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-ink-3); padding: 14px; position: relative; }
[data-style="archive"] .cover-placeholder::after { content: "16 / 7"; position: absolute; right: 14px; bottom: 14px; font-family: var(--font-mono); }

/* ── 视觉世界切换器 ── */
.style-switcher {
  display: flex;
  gap: var(--space-3xs);
  padding: var(--space-3xs);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-rule);
}
.style-btn {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  line-height: 1;
  padding: var(--space-2xs) var(--space-xs);
  border: none;
  background: transparent;
  color: var(--color-ink-2);
  cursor: pointer;
  border-radius: calc(var(--radius-md) - 2px);
  transition: color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
}
.style-btn:hover { color: var(--color-ink); }
.style-btn.active { color: var(--color-paper); background: var(--color-ink); }

/* ── selection ── */
::selection {
  background: var(--color-accent);
  color: var(--color-paper);
}
</style>`;
}
