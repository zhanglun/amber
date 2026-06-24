import type { BlobStore, Capture, CaptureSummary } from "@amber/domain";
import { getStyles } from "./styles.js";
import {
  getThemeSwitcherHtml,
  getThemeScriptHtml,
  getSearchBarHtml,
  getSortToggleHtml,
  getListFilterScriptHtml,
  getReaderHeaderScriptHtml,
  getDeleteConfirmScriptHtml,
  getReaderEnhancementsScriptHtml,
  getReadIndicatorScriptHtml,
  getTagEditorScriptHtml,
} from "./scripts.js";
import { renderMarkdown } from "./highlight.js";
import { extractToc, type TocItem } from "./toc.js";

const ASSET_REF_RE = /amber-asset:([^\s)]+)/g;

/**
 * 把正文里的 `amber-asset:<key>` 引用解析成实际访问 URL（本地为 `/blobs/<key>`，
 * 云存储为公开/签名直链）。必须在 renderMarkdown 之前做——这样替换后视频嵌入的
 * `/blobs/` 前缀判定天然命中，highlight.ts 无需改动。
 * blob 为 undefined（测试/老路径）时原样返回，对完整 URL 形态的老数据也原样兼容。
 */
async function resolveAssetRefs(markdown: string, blob?: BlobStore): Promise<string> {
  if (!blob || !markdown.includes("amber-asset:")) return markdown;
  const keys = Array.from(markdown.matchAll(ASSET_REF_RE), (m) => m[1]);
  if (keys.length === 0) return markdown;
  // 同一 key 只解析一次。
  const cache = new Map<string, string>();
  await Promise.all(Array.from(new Set(keys)).map(async (k) => cache.set(k, await blob.urlFor(k))));
  return markdown.replace(ASSET_REF_RE, (_m, k: string) => cache.get(k) ?? `amber-asset:${k}`);
}

/**
 * 来源域名 favicon。用 Google s2 服务，img 加载失败时 onerror 隐藏自己（离线/无图标时
 * 不影响布局，hostname 文字仍在）。这是 amber 唯一的运行时外部网络依赖。
 */
function faviconImg(hostname: string): string {
  const domain = escapeHtml(hostname);
  return `<img class="favicon" src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" alt="" width="16" height="16" loading="lazy" onerror="this.classList.add('favicon-failed')">`;
}

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
  const sortToggle = getSortToggleHtml();
  const header = `<div class="header"><h1>Amber</h1><div class="header-right">${searchBar}${sortToggle}${switcher}</div></div>`;
  const tagBar = renderTagBar(collectTags(items));

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
          const tags = i.tags ?? [];
          const tagsAttr = escapeHtml(JSON.stringify(tags));
          const excerptHtml = i.excerpt
            ? `<div class="excerpt">${escapeHtml(i.excerpt)}</div>`
            : "";
          const meta = [
            `${faviconImg(hostname)}${escapeHtml(hostname)}`,
            date,
            ...(typeof i.wordCount === "number" ? [`${i.wordCount} 字`] : []),
          ].join(" · ");
          return (
            `<div class="item" data-title="${escapeHtml(i.title.toLowerCase())}" data-host="${escapeHtml(hostname)}" data-captured-at="${escapeHtml(i.capturedAt)}" data-tags="${tagsAttr}" data-read-progress="${rp}" data-read-at="${ra}">` +
            `<div class="item-main"><a href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>` +
            `<div class="muted">${meta}</div>` +
            excerptHtml +
            renderTagEditor(i.id, tags) +
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

  const body = header + tagBar + sectionsHtml + getListFilterScriptHtml() + getDeleteConfirmScriptHtml() + getReadIndicatorScriptHtml() + getTagEditorScriptHtml();
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
  neighbors: { prev: CaptureSummary | null; next: CaptureSummary | null } = { prev: null, next: null },
  blob?: BlobStore,
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
  const publishedLine = (() => {
    if (!capture.publishedAt) return "";
    // Prefer ISO prefix to avoid UTC conversion shifting the date across midnight.
    const dateStr = /^\d{4}-\d{2}-\d{2}/.test(capture.publishedAt)
      ? capture.publishedAt.slice(0, 10)
      : (() => { const d = new Date(capture.publishedAt!); return isNaN(d.getTime()) ? capture.publishedAt! : d.toISOString().slice(0, 10); })();
    return ` · 发布于 ${escapeHtml(dateStr)}`;
  })();
  const meta =
    `<p class="meta">${chars} 字 · ` +
    `<span class="meta-remaining">约 ${minutes} 分钟</span> · ` +
    `<a href="${escapeHtml(capture.sourceUrl)}">${escapeHtml(hostname)} ↗</a>` +
    publishedLine +
    `</p>`;

  const toc = extractToc(capture.content);
  const hasToc = toc.length >= 2;
  const resolvedContent = await resolveAssetRefs(capture.content, blob);
  const content = await renderMarkdown(resolvedContent, { toc });
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
    renderTagEditor(capture.id, capture.tags ?? []) +
    (hasToc ? renderMobileToc(toc) : "") +
    content +
    footer +
    `</article></main>` +
    (hasToc ? renderDesktopToc(toc) : "") +
    `</div>` +
    `<button class="scroll-top-btn" title="回到顶部" aria-label="回到顶部">↑</button>` +
    `</div>` +
    getReaderHeaderScriptHtml() +
    getReaderEnhancementsScriptHtml({ hasPrev: !!neighbors.prev, hasNext: !!neighbors.next }) +
    getTagEditorScriptHtml();
  return page(capture.title, body, "article-body");
}
