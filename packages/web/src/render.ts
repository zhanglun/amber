import type { Capture, CaptureSummary } from "@amber/domain";
import { getStyles } from "./styles.js";
import {
  getThemeSwitcherHtml,
  getThemeScriptHtml,
  getSearchBarHtml,
  getListFilterScriptHtml,
  getReaderHeaderScriptHtml,
  getDeleteConfirmScriptHtml,
  getReaderEnhancementsScriptHtml,
  getReadIndicatorScriptHtml,
} from "./scripts.js";
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
    const ts = new Date(item.capturedAt).getTime();
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
          const date = i.capturedAt.slice(0, 10);
          const rp = escapeHtml(String(i.readProgress ?? ""));
          const ra = escapeHtml(i.readAt ?? "");
          const excerptHtml = i.excerpt
            ? `<div class="excerpt">${escapeHtml(i.excerpt)}</div>`
            : "";
          return (
            `<div class="item" data-title="${escapeHtml(i.title.toLowerCase())}" data-host="${escapeHtml(hostname)}" data-read-progress="${rp}" data-read-at="${ra}">` +
            `<div class="item-main"><a href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>` +
            `<div class="muted">${escapeHtml(hostname)} · ${date}</div>` +
            excerptHtml +
            `</div>` +
            `<form class="delete-form" method="post" action="/captures/${escapeHtml(i.id)}/delete" data-title="${escapeHtml(i.title)}">` +
            `<button class="delete-btn" type="submit" title="删除">删除</button>` +
            `</form></div>`
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

  const body = header + sectionsHtml + getListFilterScriptHtml() + getDeleteConfirmScriptHtml() + getReadIndicatorScriptHtml();
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

function renderArticleFooter(
  prev: CaptureSummary | null,
  next: CaptureSummary | null
): string {
  if (!prev && !next) return "";
  const prevCard = prev
    ? `<a class="nav-card" href="/captures/${escapeHtml(prev.id)}" data-nav="prev">` +
      `<span class="nav-dir">← 上一篇</span>` +
      `<span class="nav-title">${escapeHtml(prev.title)}</span></a>`
    : `<span></span>`;
  const nextCard = next
    ? `<a class="nav-card nav-card-next" href="/captures/${escapeHtml(next.id)}" data-nav="next">` +
      `<span class="nav-dir">下一篇 →</span>` +
      `<span class="nav-title">${escapeHtml(next.title)}</span></a>`
    : `<span></span>`;
  return `<footer class="article-footer">${prevCard}${nextCard}</footer>`;
}

export async function renderArticle(
  capture: Capture,
  neighbors: { prev: CaptureSummary | null; next: CaptureSummary | null } = { prev: null, next: null }
): Promise<string> {
  const switcher = getThemeSwitcherHtml();
  const fontCtrl =
    `<div class="font-ctrl">` +
    `<button class="font-btn" data-dir="down" title="缩小字体">A−</button>` +
    `<button class="font-btn" data-dir="up" title="放大字体">A+</button>` +
    `</div>`;
  const title = escapeHtml(capture.title);
  const header =
    `<header class="article-topbar">` +
    `<a class="muted" href="/">← 返回列表</a>` +
    `<span class="article-topbar-title" aria-hidden="true">${title}</span>` +
    `<div class="topbar-right">${fontCtrl}${switcher}</div>` +
    `</header>`;

  const { chars: computedChars } = readingStats(capture.content);
  const chars = capture.wordCount ?? computedChars;
  const minutes = Math.max(1, Math.round(chars / 300));
  const hostname = new URL(capture.sourceUrl).hostname;
  const publishedLine = capture.publishedAt
    ? ` · 发布于 ${escapeHtml(capture.publishedAt.slice(0, 10))}`
    : "";
  const meta =
    `<p class="meta">${chars} 字 · ` +
    `<span class="meta-remaining">约 ${minutes} 分钟</span> · ` +
    `<a href="${escapeHtml(capture.sourceUrl)}">${escapeHtml(hostname)} ↗</a>` +
    publishedLine +
    `</p>`;

  const toc = extractToc(capture.content);
  const hasToc = toc.length >= 2;
  const content = await renderMarkdown(capture.content, { toc });
  const readProgress = capture.readProgress ?? 0;
  const footer = renderArticleFooter(neighbors.prev, neighbors.next);

  const body =
    `<div class="article-shell" data-capture-id="${escapeHtml(capture.id)}" data-read-progress="${readProgress}" data-total-chars="${chars}">` +
    `<div class="read-progress-bar"><div class="read-progress-fill"></div></div>` +
    header +
    `<div class="article-layout">` +
    `<main class="article-main"><article class="article-content">` +
    `<h1 class="article-title-anchor">${title}</h1>` +
    meta +
    (hasToc ? renderMobileToc(toc) : "") +
    content +
    footer +
    `</article></main>` +
    (hasToc ? renderDesktopToc(toc) : "") +
    `</div>` +
    `<button class="scroll-top-btn" title="回到顶部" aria-label="回到顶部">↑</button>` +
    `</div>` +
    getReaderHeaderScriptHtml() +
    getReaderEnhancementsScriptHtml({ hasPrev: !!neighbors.prev, hasNext: !!neighbors.next });
  return page(capture.title, body, "article-body");
}
