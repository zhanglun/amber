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
.app-body { max-width: none; height: 100vh; margin: 0; padding: 0; overflow: hidden; }
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
.header-right { display: flex; align-items: center; gap: 1rem; }
.search-bar input { border: 1px solid var(--border); border-radius: 6px; padding: .3rem .6rem; font-size: .85rem; background: var(--bg); color: var(--text); width: 180px; }
.search-bar input:focus { outline: none; border-color: var(--link); }
.group { margin-bottom: 1.5rem; }
.group-label { font-size: .8rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid var(--border); padding-bottom: .3rem; margin-bottom: .5rem; }
.group-label .count { font-weight: 400; margin-left: .4rem; }
.app-shell { display: grid; grid-template-columns: minmax(280px, 320px) minmax(0, 1fr); height: 100vh; }
.sidebar { border-right: 1px solid var(--border); overflow-y: auto; padding: 1rem; background: var(--bg); }
.sidebar-header { display: flex; flex-direction: column; gap: .8rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); margin-bottom: 1rem; }
.sidebar-header h1 { margin: 0; font-size: 1.2rem; }
.sidebar .header-right { justify-content: space-between; gap: .8rem; }
.sidebar .search-bar input { width: 100%; }
.sidebar-item { padding: .55rem .6rem; border-bottom: 0; border-radius: 6px; }
.sidebar-item a { display: block; color: var(--text); font-weight: 500; line-height: 1.35; }
.sidebar-item.active { background: var(--bg-code); }
.sidebar-item.active a { color: var(--link); }
.reader { overflow-y: auto; padding: 2rem; }
.reader-inner { max-width: var(--max-width); margin: 0 auto; }
.video-embed { margin: 1.5rem 0; }
.video-embed video { display: block; width: 100%; max-height: 70vh; background: #000000; border-radius: 6px; }
.video-embed figcaption { margin-top: .4rem; color: var(--text-muted); font-size: .85rem; }
@media (max-width: 760px) {
  .app-body { height: auto; overflow: auto; }
  .app-shell { display: block; height: auto; }
  .sidebar { border-right: 0; border-bottom: 1px solid var(--border); }
  .reader { overflow: visible; padding: 1rem; }
}
</style>`;
}
