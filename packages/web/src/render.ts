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

/**
 * 相对时间（对齐设计稿 meta 行：host · 时间 · 阅读时间 · tag）。
 * 未来时间戳（时钟偏移）按「刚刚」处理。
 */
export function relativeTime(iso: string, now = new Date()): string {
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "";
  const diff = Math.max(0, now.getTime() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "刚刚";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d} 天前`;
  const w = Math.floor(d / 7);
  if (d < 60) return `${w} 周前`;
  const mo = Math.floor(d / 30);
  if (d < 365) return `${mo} 个月前`;
  return `${Math.floor(d / 365)} 年前`;
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
  return `<!doctype html><html lang="zh-CN" data-theme="light"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..600&family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&display=swap" rel="stylesheet">
<title>${escapeHtml(title)}</title>
${getStyles()}
${getThemeScriptHtml()}
</head><body${classAttr}>${body}</body></html>`;
}

export function renderList(items: CaptureSummary[]): string {
  const searchBar = getSearchBarHtml();
  const switcher = getThemeSwitcherHtml();
  const sortGroup = getSortToggleHtml();
  const header =
    `<header class="header">` +
    `<a href="/" class="brand"><span class="brand-mark" aria-hidden="true"></span>amber</a>` +
    `<div class="header-right">${switcher}</div>` +
    `</header>`;

  if (items.length === 0) {
    const body =
      `<div class="page">` +
      header +
      `<div class="toolbar">${searchBar}<div class="filter-row">${sortGroup}</div></div>` +
      `<p class="muted">No captures yet. Run: amber import &lt;url&gt;</p>` +
      `<footer class="site-footer"><p>amber · 个人知识库阅读器</p></footer>` +
      `</div>`;
    return page("Amber", body);
  }

  const tagBar = renderTagBar(collectTags(items));
  const toolbar =
    `<div class="toolbar">${searchBar}` +
    `<div class="filter-row">${sortGroup}${tagBar}</div>` +
    `</div>`;
  const intro =
    `<div class="page-intro"><p>${items.length} 篇收藏 · 按时间倒序排列。</p></div>`;

  const groups = groupByWeek(items);
  const sectionsHtml = groups
    .map((g) => {
      const rowsHtml = g.items
        .map((i) => {
          const hostname = new URL(i.sourceUrl).hostname;
          const minutes =
            typeof i.wordCount === "number"
              ? Math.max(1, Math.round(i.wordCount / 300))
              : null;
          const rp = escapeHtml(String(i.readProgress ?? ""));
          const ra = escapeHtml(i.readAt ?? "");
          const tags = i.tags ?? [];
          const tagsAttr = escapeHtml(JSON.stringify(tags));
          const excerptHtml = i.excerpt
            ? `<div class="excerpt">${escapeHtml(i.excerpt)}</div>`
            : "";
          const metaParts = [
            `<span class="entry-host">${escapeHtml(hostname)}</span>`,
            relativeTime(i.capturedAt),
            ...(minutes !== null ? [`约 ${minutes} 分钟`] : []),
          ];
          if (tags.length > 0) metaParts.push(`<span class="tag">${escapeHtml(tags[0])}</span>`);
          const meta = metaParts
            .map((p, idx) => (idx < metaParts.length - 1 ? `${p}<span class="sep" aria-hidden="true">·</span>` : p))
            .join("");
          return (
            `<div class="item" data-title="${escapeHtml(i.title.toLowerCase())}" data-host="${escapeHtml(hostname)}" data-captured-at="${escapeHtml(i.capturedAt)}" data-tags="${tagsAttr}" data-read-progress="${rp}" data-read-at="${ra}">` +
            faviconImg(hostname) +
            `<div class="item-main">` +
            `<a class="entry-title" href="/captures/${escapeHtml(i.id)}">${escapeHtml(i.title)}</a>` +
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

  const body =
    `<div class="page">` +
    header +
    intro +
    toolbar +
    `<main class="collection">` + sectionsHtml + `</main>` +
    `<footer class="site-footer"><p>amber · 个人知识库阅读器</p></footer>` +
    getListFilterScriptHtml() + getDeleteConfirmScriptHtml() + getReadIndicatorScriptHtml() + getTagEditorScriptHtml() +
    `</div>`;
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

/**
 * 文章底部（对齐设计稿：tags chip 行 + 原文链接）。上一/下一篇导航紧随其后。
 */
function renderArticleFoot(capture: Capture): string {
  const hostname = new URL(capture.sourceUrl).hostname;
  return (
    `<footer class="article-foot">` +
    `<div class="tags-row"><span class="tag-label">标签</span>` +
    renderTagEditor(capture.id, capture.tags ?? []) +
    `</div>` +
    `<a class="source-link" href="${escapeHtml(capture.sourceUrl)}" rel="noopener">原文发布于 <span class="link-text">${escapeHtml(hostname)}</span> →</a>` +
    `</footer>`
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
    `<a class="back-link" href="/">← 返回列表</a>` +
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
    return `发布于 ${escapeHtml(dateStr)}`;
  })();
  const metaParts = [
    ...(capture.author ? [`<span class="author">${escapeHtml(capture.author)}</span>`] : []),
    `${chars} 字`,
    `<span class="meta-remaining">约 ${minutes} 分钟</span>`,
    `<a href="${escapeHtml(capture.sourceUrl)}">${escapeHtml(hostname)} ↗</a>`,
    ...(publishedLine ? [publishedLine] : []),
  ];
  const meta =
    `<p class="meta">` +
    metaParts.map((p, idx) => (idx < metaParts.length - 1 ? `${p}<span class="sep" aria-hidden="true">·</span>` : p)).join("") +
    `</p>`;

  const toc = extractToc(capture.content);
  const hasToc = toc.length >= 2;
  const resolvedContent = await resolveAssetRefs(capture.content, blob);
  const rendered = await renderMarkdown(resolvedContent, { toc });
  // 首段加 .lede（drop cap 首字下沉），仅替换首个 <p>
  const content = rendered.replace(/<p>/, '<p class="lede">');
  const readProgress = capture.readProgress ?? 0;
   const footer = renderArticleFooter(neighbors.prev, neighbors.next);

  // 封面图：仅当 coverImage 存在时渲染，紧跟文章标题/元信息之后
  const cover = capture.coverImage
    ? `<figure class="article-cover">` +
      `<img class="cover-image" src="${escapeHtml(capture.coverImage)}" alt="" />` +
      `<figcaption class="cover-caption">${title}</figcaption>` +
      `</figure>`
    : `<figure class="article-cover">` +
      `<div class="cover-placeholder" role="img" aria-label="封面图占位">cover image · 16:7</div>` +
      `<figcaption class="cover-caption">${title}</figcaption>` +
      `</figure>`;

  const body =
    `<div class="article-shell" data-capture-id="${escapeHtml(capture.id)}" data-read-progress="${readProgress}" data-total-chars="${chars}">` +
    `<div class="read-progress-bar"><div class="read-progress-fill"></div></div>` +
    header +
    `<div class="article-layout">` +
    `<main class="article-main"><article class="article-content">` +
    `<h1 class="article-title-anchor">${title}</h1>` +
    meta +
    cover +
    (hasToc ? renderMobileToc(toc) : "") +
    content +
    renderArticleFoot(capture) +
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
