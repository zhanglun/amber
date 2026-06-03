import type { Capture, CaptureSummary } from "@amber/domain";
import { getStyles } from "./styles.js";
import { getThemeSwitcherHtml, getThemeScriptHtml, getSearchBarHtml, getListFilterScriptHtml } from "./scripts.js";
import { renderMarkdown } from "./highlight.js";
import { extractToc, type TocItem } from "./toc.js";

export interface Group {
  label: string;
  items: CaptureSummary[];
}

export function groupByWeek(items: CaptureSummary[], now = new Date()): Group[] {
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

function page(title: string, body: string, bodyClass = ""): string {
  const classAttr = bodyClass ? ` class="${escapeHtml(bodyClass)}"` : "";
  return `<!doctype html><html lang="zh" data-theme="minimal"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${getStyles()}
${getThemeScriptHtml()}
</head><body${classAttr}>${body}</body></html>`;
}

export function renderList(items: CaptureSummary[]): string {
  const searchBar = getSearchBarHtml();
  const switcher = getThemeSwitcherHtml();
  const header = `<div class="header"><h1>Amber</h1><div class="header-right">${searchBar}${switcher}</div></div>`;

  if (items.length === 0) {
    const body = header + "<p class='muted'>No captures yet. Run: amber import &lt;url&gt;</p>";
    return page("Amber", body);
  }

  const groups = groupByWeek(items);
  const sectionsHtml = groups
    .map((g) => {
      const rowsHtml = g.items
        .map((i) => {
          const hostname = new URL(i.sourceUrl).hostname;
          const date = i.createdAt.slice(0, 10);
          return (
            `<div class="item" data-title="${escapeHtml(i.title.toLowerCase())}" data-host="${escapeHtml(hostname)}">` +
            `<a href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>` +
            `<div class="muted">${escapeHtml(hostname)} · ${date}</div></div>`
          );
        })
        .join("");
      return (
        `<section class="group" data-group>` +
        `<h2 class="group-label">${escapeHtml(g.label)} <span class="count">${g.items.length}</span></h2>` +
        rowsHtml +
        `</section>`
      );
    })
    .join("");

  const body = header + sectionsHtml + getListFilterScriptHtml();
  return page("Amber", body);
}

function renderTocList(toc: TocItem[]): string {
  return toc
    .map((item) => {
      const id = escapeHtml(item.id);
      return `<li class="toc-item level-${item.level}"><a href="#${id}">${escapeHtml(item.text)}</a></li>`;
    })
    .join("");
}

function renderDesktopToc(toc: TocItem[]): string {
  return (
    `<nav class="toc" aria-label="目录">` +
    `<div class="toc-title">目录</div>` +
    `<ol class="toc-list">${renderTocList(toc)}</ol>` +
    `</nav>`
  );
}

function renderMobileToc(toc: TocItem[]): string {
  return (
    `<details class="toc-mobile">` +
    `<summary>目录</summary>` +
    `<ol class="toc-list">${renderTocList(toc)}</ol>` +
    `</details>`
  );
}

export async function renderArticle(capture: Capture): Promise<string> {
  const switcher = getThemeSwitcherHtml();
  const header = `<header class="article-topbar"><a class="muted" href="/">← 返回列表</a>${switcher}</header>`;
  const { chars, minutes } = readingStats(capture.content);
  const hostname = new URL(capture.sourceUrl).hostname;
  const meta =
    `<p class="meta">${chars} 字 · 约 ${minutes} 分钟 · ` +
    `<a href="${escapeHtml(capture.sourceUrl)}">${escapeHtml(hostname)} ↗</a></p>`;
  const toc = extractToc(capture.content);
  const hasToc = toc.length >= 2;
  const content = await renderMarkdown(capture.content, { toc });
  const body =
    `<div class="article-shell">` +
    header +
    `<div class="article-layout">` +
    `<main class="article-main"><article class="article-content">` +
    `<h1>${escapeHtml(capture.title)}</h1>` +
    meta +
    (hasToc ? renderMobileToc(toc) : "") +
    content +
    `</article></main>` +
    (hasToc ? renderDesktopToc(toc) : "") +
    `</div></div>`;
  return page(capture.title, body, "article-body");
}
