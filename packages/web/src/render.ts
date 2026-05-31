import MarkdownIt from "markdown-it";
import type { Capture, CaptureSummary } from "@amber/domain";

const md = new MarkdownIt({ html: false, linkify: true });

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:16px/1.6 system-ui,sans-serif;color:#222}
  a{color:#06c;text-decoration:none}a:hover{text-decoration:underline}
  img{max-width:100%}
  h1{line-height:1.2}
  .item{padding:.6rem 0;border-bottom:1px solid #eee}
  .muted{color:#888;font-size:.85rem}
</style></head><body>${body}</body></html>`;
}

export function renderList(items: CaptureSummary[]): string {
  const rows = items
    .map(
      (i) =>
        `<div class="item"><a href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>` +
        `<div class="muted">${escapeHtml(i.sourceUrl)}</div></div>`,
    )
    .join("");
  const body = `<h1>Amber</h1>${rows || "<p class='muted'>No captures yet. Run: amber import &lt;url&gt;</p>"}`;
  return page("Amber", body);
}

export function renderArticle(capture: Capture): string {
  const body =
    `<p class="muted"><a href="/">← back</a></p>` +
    `<h1>${escapeHtml(capture.title)}</h1>` +
    `<p class="muted"><a href="${escapeHtml(capture.sourceUrl)}">${escapeHtml(capture.sourceUrl)}</a></p>` +
    md.render(capture.content);
  return page(capture.title, body);
}
