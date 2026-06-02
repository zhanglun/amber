import type { Capture, CaptureSummary } from "@amber/domain";
import { getStyles } from "./styles.js";
import { getThemeSwitcherHtml, getThemeScriptHtml } from "./scripts.js";
import { renderMarkdown } from "./highlight.js";

export interface Group {
  label: string;
  items: CaptureSummary[];
}

export function groupByWeek(items: CaptureSummary[]): Group[] {
  const now = new Date();
  const daysToMonday = (now.getUTCDay() + 6) % 7;
  const thisMonday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToMonday);
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
