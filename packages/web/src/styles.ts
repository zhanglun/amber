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
</style>`;
}
