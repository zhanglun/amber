export function getStyles(): string {
  return `<style>
:root {
  --bg: #FDFBF7;
  --bg-code: #F5F2EB;
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
body.article-body { max-width: none; margin: 0; padding: 0; }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
h1, h2, h3, h4, h5, h6 { line-height: 1.3; }
p { margin: 0 0 1em; }
img { max-width: 100%; }
pre, code { font-family: var(--font-mono); background: var(--bg-code); }
pre { padding: 1rem; border-radius: 6px; overflow-x: auto; }
code { padding: .2em .4em; border-radius: 3px; }
pre code { padding: 0; background: none; }
.muted { color: var(--text-muted); font-size: .85rem; }
.muted .favicon { vertical-align: -0.15em; margin-right: .25rem; border-radius: 3px; }
.muted .favicon-failed { display: none; }
.header { display: flex; justify-content: space-between; align-items: center; padding: .8rem 0; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem; }
.item { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: .8rem 1rem; background: color-mix(in srgb, var(--bg-code) 50%, var(--bg)); border-radius: 8px; margin-bottom: .5rem; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.04); transition: background-color .15s ease, box-shadow .15s ease, transform .2s ease, opacity .2s ease; }
.item-main { min-width: 0; flex: 1; }
.item-main a { overflow-wrap: anywhere; }
.excerpt { font-size: .8rem; color: var(--text-muted); margin-top: .15rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.delete-form { flex: 0 0 auto; }
.delete-btn { border: 0; background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-size: .8rem; padding: .25rem .1rem; opacity: .55; }
.delete-btn:hover, .delete-btn:focus { color: #c2410c; opacity: 1; text-decoration: underline; }
.meta { color: var(--text-muted); font-size: .85rem; margin: .3rem 0 1rem; }
.theme-switcher { display: flex; gap: .4rem; }
.theme-btn { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border); cursor: pointer; padding: 0; }
.theme-btn[data-theme="minimal"] { background: #FDFBF7; }
.theme-btn[data-theme="warm"]    { background: #faf8f3; }
.theme-btn[data-theme="modern"]  { background: #f6f7f9; }
.theme-btn[data-theme="dark"]    { background: #18181b; }
.theme-btn.active { border-color: var(--link); }
.shiki.github-dark { display: none; }
[data-theme="dark"] .shiki.github-light { display: none; }
[data-theme="dark"] .shiki.github-dark { display: block; }
.header-right { display: flex; align-items: center; gap: 1rem; }
.search-bar input { border: 1px solid var(--border); border-radius: 6px; padding: .3rem .6rem; font-size: .85rem; background: var(--bg); color: var(--text); width: 180px; transition: border-color .15s ease; }
.search-bar input:focus,
button:focus-visible,
.tag-filter:focus-visible,
.tag-filter-all:focus-visible,
.sort-toggle:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--link) 25%, transparent); }
.sort-toggle { background: none; border: 1px solid var(--border); border-radius: 6px; padding: .3rem .6rem; font-size: .85rem; color: var(--text-muted); cursor: pointer; }
.sort-toggle:hover { color: var(--text); border-color: var(--link); }
.tag-bar { display: flex; flex-wrap: wrap; gap: .4rem; margin: .6rem 0 1rem; }
.tag-filter, .tag-filter-all { border: 1px solid var(--border); border-radius: 999px; padding: .15rem .6rem; font-size: .78rem; background: var(--bg); color: var(--text-muted); cursor: pointer; }
.tag-filter.active, .tag-filter-all.active { background: var(--link); border-color: var(--link); color: #fff; }
.tag-editor { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: .35rem; align-items: center; }
.tag-chip { display: inline-flex; align-items: center; gap: .2rem; border: 1px solid var(--border); border-radius: 999px; padding: .1rem .5rem; font-size: .75rem; color: var(--text-muted); }
.tag-remove { border: none; background: none; color: var(--text-muted); cursor: pointer; font-size: .85rem; line-height: 1; padding: 0; }
.tag-remove:hover { color: var(--link); }
.tag-add { border: 1px dashed var(--border); border-radius: 999px; background: none; color: var(--text-muted); cursor: pointer; font-size: .8rem; line-height: 1; padding: .1rem .45rem; }
.tag-add:hover { color: var(--link); border-color: var(--link); }
.group { margin-bottom: 1.5rem; }
.group-label { font-size: .8rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid var(--border); padding-bottom: .3rem; margin-bottom: .5rem; }
.group-label .count { font-weight: 400; margin-left: .4rem; }
.article-shell { min-height: 100vh; }
.article-topbar { position: sticky; top: 0; z-index: 10; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 1rem; padding: .8rem 1rem; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--bg) 75%, transparent); -webkit-backdrop-filter: blur(20px) saturate(180%); backdrop-filter: blur(20px) saturate(180%); }
@supports not ((backdrop-filter: blur(10px)) or (-webkit-backdrop-filter: blur(10px))) { .article-topbar { background: var(--bg); } }
.article-topbar .theme-switcher { justify-self: end; }
.article-topbar .topbar-right { justify-self: end; }
.article-topbar-title { max-width: min(44vw, var(--max-width)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); font-size: .9rem; font-weight: 600; opacity: 0; transform: translateY(4px); transition: opacity .18s ease, transform .18s ease; }
.article-topbar.title-visible .article-topbar-title { opacity: 1; transform: translateY(0); }
.article-layout { width: 100%; padding: 2rem 1rem 4rem; }
.article-main { max-width: var(--max-width); margin: 0 auto; min-width: 0; }
.article-content { max-width: var(--max-width); font-size: var(--font-size-article, 16px); }
.article-content > h1:first-child { margin-top: 0; }
.toc { position: fixed; top: 5rem; left: max(1rem, calc((100vw - var(--max-width)) / 2 - 260px)); width: 220px; max-height: calc(100vh - 6rem); overflow: auto; border-right: 1px solid var(--border); padding-right: 1rem; font-size: .85rem; line-height: 1.45; }
.toc-title { color: var(--text-muted); font-weight: 600; margin-bottom: .5rem; }
.toc-list { list-style: none; margin: 0; padding: 0; }
.toc-item { margin: .35rem 0; }
.toc-item.level-3 { padding-left: .8rem; }
.toc a { color: var(--text-muted); }
.toc a:hover { color: var(--link); }
.toc-mobile { display: none; margin: 1rem 0 1.5rem; border: 1px solid var(--border); border-radius: 6px; padding: .6rem .8rem; }
.toc-mobile summary { cursor: pointer; color: var(--text-muted); font-size: .9rem; }
.toc-mobile .toc-list { margin-top: .6rem; }
.toc-mobile a { color: var(--text-muted); }
.video-embed { margin: 1.5rem 0; }
.video-embed video { display: block; width: 100%; max-height: 70vh; background: #000000; border-radius: 6px; }
.video-embed figcaption { margin-top: .4rem; color: var(--text-muted); font-size: .85rem; }
@media (max-width: 900px) {
  .article-layout { display: block; max-width: var(--max-width); padding: 1.25rem 1rem 3rem; }
  .toc { display: none; }
  .toc-mobile { display: block; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  .article-topbar-title { transform: none; }
}
.topbar-right { display: flex; align-items: center; gap: .6rem; }
.font-ctrl { display: flex; gap: .2rem; }
.font-btn { width: 26px; height: 26px; border-radius: 5px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); cursor: pointer; font: inherit; font-size: .78rem; display: flex; align-items: center; justify-content: center; }
.font-btn:hover { background: var(--border); color: var(--text); }
.read-progress-bar { position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 200; background: transparent; pointer-events: none; }
.read-progress-fill { height: 100%; width: 0; background: linear-gradient(90deg, var(--link), #818cf8); transition: width .1s linear; }
.code-block { position: relative; margin: 1.2rem 0; }
.code-block pre { margin: 0; }
.code-lang { position: absolute; top: .45rem; left: .9rem; font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); pointer-events: none; }
.copy-btn { position: absolute; top: .45rem; right: .6rem; padding: .18rem .5rem; border-radius: 4px; background: var(--border); border: 1px solid var(--border); color: var(--text-muted); font-size: .7rem; cursor: pointer; transition: all .12s; }
.copy-btn:hover { color: var(--text); }
.copy-btn.copied { color: #4ade80; border-color: #4ade80; }
.scroll-top-btn { position: fixed; bottom: 1.5rem; right: 1.5rem; width: 36px; height: 36px; border-radius: 50%; background: var(--border); border: 1px solid var(--border); color: var(--text-muted); font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .2s, transform 100ms ease-out; z-index: 50; }
.scroll-top-btn:hover { color: var(--text); }
.article-footer { border-top: 1px solid var(--border); margin-top: 2.5rem; padding-top: 1.25rem; display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.nav-card { display: flex; flex-direction: column; gap: .2rem; background: var(--bg-code); border: 1px solid var(--border); border-radius: 8px; padding: .75rem 1rem; text-decoration: none; color: inherit; transition: border-color .15s, transform 100ms ease-out; }
.nav-card:hover { border-color: var(--link); text-decoration: none; }
.nav-card-next { text-align: right; }
.nav-dir { font-size: .7rem; color: var(--text-muted); }
.nav-title { font-size: .85rem; color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.read-indicator { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 8px; margin-right: .5rem; margin-top: .35rem; }
.read-indicator.unread { background: var(--link); }
.read-indicator.in-progress { width: auto; height: auto; border-radius: 3px; background: transparent; color: #f59e0b; font-size: .7rem; font-weight: 600; padding: .05rem .25rem; margin-top: .3rem; }
.read-indicator.read { background: var(--border); }
.title-read { color: var(--text-muted); }
.meta-remaining { transition: color .2s; }
.toc-item.active > a { color: var(--link); font-weight: 500; }
.toc-item.active > a::before { content: ''; display: inline-block; width: 5px; height: 5px; background: var(--link); border-radius: 50%; margin-right: .35rem; vertical-align: middle; margin-bottom: 1px; }
.delete-btn, .theme-btn, .sort-toggle, .tag-filter, .tag-filter-all, .tag-remove, .tag-add, .font-btn { transition: color .15s ease, background-color .15s ease, border-color .15s ease, opacity .15s ease, transform 100ms ease-out; }
.theme-btn:active { transform: scale(0.85); }
.delete-btn:active, .sort-toggle:active, .tag-filter:active, .tag-filter-all:active { transform: scale(0.93); }
.tag-remove:active, .tag-add:active, .font-btn:active { transform: scale(0.9); }
.copy-btn:active, .scroll-top-btn:active { transform: scale(0.92); }
.nav-card:active { transform: scale(0.98); }
.item:hover { background: var(--bg-code); box-shadow: 0 4px 8px rgba(0,0,0,0.08); transform: translateY(-1px); }
.item::before { content: ''; position: absolute; left: 0; top: 6px; bottom: 6px; width: 3px; background: var(--link); transform: scaleY(0); transition: transform .15s ease; border-radius: 0 2px 2px 0; }
.item:hover::before { transform: scaleY(1); }
.item-entering { opacity: 0; transform: translateY(6px); }
</style>`;
}
