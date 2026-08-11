import { describe, expect, it, vi } from "vitest";
import type { BlobStore, Capture, CaptureSummary } from "@amber/domain";
import { escapeHtml, groupByWeek, readingStats, relativeTime, renderArticle, renderLibrary, renderList } from "./render.js";

const CAPTURE: Capture = {
  id: "c1",
  title: "Hello World",
  content: "# Hello\n\n## Section A\n\nsome text here\n\n### Sub A\n\nmore text\n\n## Section B\n\nfinal text",
  sourceUrl: "https://example.com/article",
  sourceType: "url",
  capturedAt: "2026-06-01T00:00:00.000Z",
};

describe("escapeHtml", () => {
  it("escapes &, <, >, and quotes", () => {
    expect(escapeHtml('a & <b> "c"')).toBe("a &amp; &lt;b&gt; &quot;c&quot;");
  });
  it("returns the same string when no special chars", () => {
    expect(escapeHtml("hello")).toBe("hello");
  });
});

describe("readingStats", () => {
  it("counts non-whitespace chars excluding fenced code blocks", () => {
    const { chars } = readingStats("hello world");
    expect(chars).toBe(10);
  });
  it("returns at least 1 minute", () => {
    expect(readingStats("x").minutes).toBe(1);
  });
});

describe("groupByWeek", () => {
  it("puts items into this week, last week, and earlier buckets", () => {
    const now = new Date("2026-06-08T00:00:00.000Z"); // Monday
    const items: CaptureSummary[] = [
      { id: "a", title: "A", sourceUrl: "https://a.com", capturedAt: "2026-06-08T00:00:00.000Z" },
      { id: "b", title: "B", sourceUrl: "https://b.com", capturedAt: "2026-06-01T00:00:00.000Z" },
      { id: "c", title: "C", sourceUrl: "https://c.com", capturedAt: "2026-05-01T00:00:00.000Z" },
    ];
    const groups = groupByWeek(items, now);
    expect(groups[0].label).toBe("本周");
    expect(groups[0].items[0].id).toBe("a");
    expect(groups[1].label).toBe("上周");
    expect(groups[1].items[0].id).toBe("b");
    expect(groups[2].label).toBe("更早");
    expect(groups[2].items[0].id).toBe("c");
  });

  it("omits empty groups", () => {
    const now = new Date("2026-06-08T00:00:00.000Z");
    const items: CaptureSummary[] = [
      { id: "a", title: "A", sourceUrl: "https://a.com", capturedAt: "2026-06-08T00:00:00.000Z" },
    ];
    const groups = groupByWeek(items, now);
    expect(groups.length).toBe(1);
  });
});

describe("relativeTime", () => {
  it("formats 刚刚/分钟/小时/天/周/月/年", () => {
    const now = new Date("2026-08-02T12:00:00Z");
    expect(relativeTime("2026-08-02T11:59:30Z", now)).toBe("刚刚");
    expect(relativeTime("2026-08-02T11:30:00Z", now)).toBe("30 分钟前");
    expect(relativeTime("2026-08-02T10:00:00Z", now)).toBe("2 小时前");
    expect(relativeTime("2026-07-30T12:00:00Z", now)).toBe("3 天前");
    expect(relativeTime("2026-07-01T12:00:00Z", now)).toBe("4 周前");
    expect(relativeTime("2026-03-01T12:00:00Z", now)).toBe("5 个月前");
    expect(relativeTime("2020-01-15T00:00:00Z", now)).toBe("6 年前");
  });

  it("returns empty string for invalid dates", () => {
    expect(relativeTime("not-a-date", new Date("2026-08-02T12:00:00Z"))).toBe("");
  });
});

describe("renderLibrary", () => {
  it("uses tags as multi-index filters instead of assigning a first-tag shelf", () => {
    const html = renderLibrary([
      { id: "a", title: "Robotics note", sourceUrl: "https://one.example/a", capturedAt: "2026-06-02T00:00:00Z", tags: ["具身智能", "论文"] },
      { id: "b", title: "Another robotics note", sourceUrl: "https://two.example/b", capturedAt: "2026-06-01T00:00:00Z", tags: ["具身智能"] },
      { id: "c", title: "No tag yet", sourceUrl: "https://three.example/c", capturedAt: "2026-05-31T00:00:00Z" },
    ]);
    expect(html).toContain('href="/library" aria-current="page"');
    expect(html).toContain("留下来的，不会被时间冲走。");
    expect(html).toContain('data-tag="具身智能"');
    expect(html).toContain('data-tag="论文"');
    expect(html).toContain("未标记 <span>1</span>");
    expect(html).toContain('data-tags="[&quot;具身智能&quot;,&quot;论文&quot;]"');
    expect(html).not.toContain('class="library-shelf"');
    expect(html).toContain("Robotics note");
    expect(html).toContain("No tag yet");
  });
});

describe("renderList", () => {
  it("orders inbox items by inboxAt rather than original capture time", () => {
    const html = renderList([
      { id: "old", title: "Old capture, newly returned", sourceUrl: "https://example.com/old", capturedAt: "2020-01-01T00:00:00.000Z", inboxAt: "2026-06-02T00:00:00.000Z" },
      { id: "new", title: "New capture", sourceUrl: "https://example.com/new", capturedAt: "2026-06-01T00:00:00.000Z", inboxAt: "2026-06-01T00:00:00.000Z" },
    ]);
    expect(html.indexOf("Old capture, newly returned")).toBeLessThan(html.indexOf("New capture"));
  });

  it("renders list items with links and delete buttons", () => {
    const items: CaptureSummary[] = [
      { id: "c1", title: "First", sourceUrl: "https://example.com/a", capturedAt: "2020-01-15T00:00:00.000Z" },
    ];
    const html = renderList(items);
    expect(html).toContain('href="/captures/c1"');
    expect(html).toContain("First");
    expect(html).toContain('action="/captures/c1/delete"');
  });

  it("escapes HTML in title and URL", () => {
    const items: CaptureSummary[] = [
      { id: "s1", title: 'Hello "World"', sourceUrl: "https://example.com/a", capturedAt: "2020-01-15T00:00:00.000Z" },
    ];
    const html = renderList(items);
    expect(html).toContain("Hello &quot;World&quot;");
    expect(html).not.toContain('"Hello "World""');
  });

  it("shows an empty inbox state without implying saved content was lost", () => {
    const html = renderList([]);
    expect(html).toContain("收件箱清空了。");
    expect(html).toContain("你留下的内容都在书架里");
    expect(html).toContain('href="/library"');
  });

  it("includes an accessible full-library search entry", () => {
    const html = renderList([
      { id: "c1", title: "First", sourceUrl: "https://example.com/a", capturedAt: "2020-01-15T00:00:00.000Z" },
    ]);
    expect(html).toContain('<input id="search"');
    expect(html).toContain("搜索标题、正文、来源或标签…");
    expect(html).toContain('id="search-results" hidden aria-live="polite" aria-busy="false"');
    expect(html).toContain("AbortController");
    expect(html).toContain("全库搜索中…");
  });

  it("includes sort group with desc/asc/unread buttons when inbox has items", () => {
    const html = renderList([
      { id: "c1", title: "First", sourceUrl: "https://example.com/a", capturedAt: "2020-01-15T00:00:00.000Z", inboxAt: "2020-01-15T00:00:00.000Z" },
    ]);
    expect(html).toContain('class="sort-group"');
    expect(html).toContain('data-sort="desc"');
    expect(html).toContain('data-sort="asc"');
    expect(html).toContain('data-sort="unread"');
  });

  it("renders favicon image for the source hostname", () => {
    const items: CaptureSummary[] = [
      { id: "c1", title: "T", sourceUrl: "https://example.com/a", capturedAt: "2020-01-15T00:00:00.000Z" },
    ];
    const html = renderList(items);
    expect(html).toContain("s2/favicons?domain=example.com");
    expect(html).toContain('class="favicon"');
  });

  it("places the site footer inside the content column", () => {
    const html = renderList([]);
    expect(html.indexOf('<footer class="site-footer">')).toBeGreaterThan(html.indexOf('<div class="page">'));
  });

  it("shows reading time in meta when wordCount is provided", () => {
    const items: CaptureSummary[] = [
      { id: "c1", title: "T", sourceUrl: "https://example.com/a", capturedAt: "2020-01-15T00:00:00.000Z", wordCount: 1234 },
    ];
    const html = renderList(items);
    expect(html).toContain("约 4 分钟");
  });

  it("omits reading time when wordCount is undefined (old data)", () => {
    const items: CaptureSummary[] = [
      { id: "c1", title: "T", sourceUrl: "https://example.com/a", capturedAt: "2020-01-15T00:00:00.000Z" },
    ];
    const html = renderList(items);
    expect(html).not.toContain("分钟");
  });

  it("shows relative time in meta", () => {
    const items: CaptureSummary[] = [
      { id: "c1", title: "T", sourceUrl: "https://example.com/a", capturedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 - 60 * 1000).toISOString() },
    ];
    const html = renderList(items);
    expect(html).toContain("3 天前");
  });

  it("shows first tag as accent chip in meta line", () => {
    const items: CaptureSummary[] = [
      { id: "c1", title: "T", sourceUrl: "https://example.com/a", capturedAt: "2026-06-08T00:00:00.000Z", tags: ["react", "ui"] },
    ];
    const html = renderList(items);
    expect(html).toContain('<span class="tag">react</span>');
    expect(html).not.toContain('<span class="tag">ui</span>');
  });

  it("adds data-captured-at on each item for sorting", () => {
    const items: CaptureSummary[] = [
      { id: "c1", title: "T", sourceUrl: "https://example.com/a", capturedAt: "2020-01-15T00:00:00.000Z" },
    ];
    const html = renderList(items);
    expect(html).toContain('data-captured-at="2020-01-15T00:00:00.000Z"');
  });

  it("injects data-read-progress and data-read-at on items with read status", () => {
    const items: CaptureSummary[] = [
      { id: "r1", title: "Read Article", sourceUrl: "https://example.com/r", capturedAt: "2026-06-04T00:00:00.000Z", readProgress: 55, readAt: "2026-06-04T12:00:00.000Z" },
    ];
    const html = renderList(items);
    expect(html).toContain('data-read-progress="55"');
    expect(html).toContain('data-read-at="2026-06-04T12:00:00.000Z"');
  });

  it("renders excerpt when available", () => {
    const items: CaptureSummary[] = [
      { id: "e1", title: "With Excerpt", sourceUrl: "https://example.com/e", capturedAt: "2026-06-04T00:00:00.000Z", excerpt: "This is the excerpt text." },
    ];
    const html = renderList(items);
    expect(html).toContain("This is the excerpt text.");
  });
});

describe("renderArticle", () => {
  it("renders the article title and content", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain("Hello World");
    expect(html).toContain("some text here");
  });

  it("renders table of contents for articles with 2+ h2/h3", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="toc"');
    expect(html).toContain('href="#section-a"');
    expect(html).toContain('href="#section-b"');
  });

  it("omits table of contents for articles with fewer than 2 headings", async () => {
    const html = await renderArticle({ ...CAPTURE, content: "# Heading\n\n## Only one\n\ntext" });
    expect(html).not.toContain('class="toc"');
  });

  it("renders author in meta when provided", async () => {
    const html = await renderArticle({ ...CAPTURE, author: "Innei" });
    expect(html).toContain('<span class="author">Innei</span>');
  });

  it("omits author when absent", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).not.toContain('class="author"');
  });

  it("renders tags row and source link in article foot", async () => {
    const html = await renderArticle({ ...CAPTURE, tags: ["随笔"] });
    expect(html).toContain('class="article-foot"');
    expect(html).toContain('class="tag-label"');
    expect(html).toContain('class="source-link"');
    expect(html).toContain("原文发布于");
  });

  it("renders explicit placement actions based on inboxAt", async () => {
    const inboxHtml = await renderArticle({ ...CAPTURE, inboxAt: "2026-06-04T00:00:00.000Z" });
    expect(inboxHtml).toContain('action="/captures/c1/shelve"');
    expect(inboxHtml).toContain("放上书架");
    expect(inboxHtml).toContain('href="/">← 返回收件箱');

    const libraryHtml = await renderArticle(CAPTURE);
    expect(libraryHtml).toContain('action="/captures/c1/return-to-inbox"');
    expect(libraryHtml).toContain("放回收件箱");
    expect(libraryHtml).toContain('href="/library">← 返回书架');
  });

  it("renders source link in meta", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('href="https://example.com/article"');
    expect(html).toContain("example.com");
  });


  const NEIGHBORS = {
    prev: { id: "p1", title: "Prev Article", sourceUrl: "https://prev.com/a", capturedAt: "2026-06-02T00:00:00.000Z" },
    next: { id: "n1", title: "Next Article", sourceUrl: "https://next.com/a", capturedAt: "2026-05-30T00:00:00.000Z" },
  };

  it("injects data-capture-id and data-read-progress on article-shell", async () => {
    const cap = { ...CAPTURE, readProgress: 42 };
    const html = await renderArticle(cap);
    expect(html).toContain('data-capture-id="c1"');
    expect(html).toContain('data-read-progress="42"');
  });

  it("data-read-progress defaults to 0 when readProgress is absent", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('data-read-progress="0"');
  });

  it("injects data-total-chars on article-shell", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toMatch(/data-total-chars="\d+"/);
  });

  it("renders prev/next footer with data-nav attributes when neighbors provided", async () => {
    const html = await renderArticle(CAPTURE, NEIGHBORS);
    expect(html).toContain('data-nav="prev"');
    expect(html).toContain('data-nav="next"');
    expect(html).toContain('href="/captures/p1"');
    expect(html).toContain('href="/captures/n1"');
    expect(html).toContain("Prev Article");
    expect(html).toContain("Next Article");
  });

  it("omits footer when no neighbors", async () => {
    const html = await renderArticle(CAPTURE, { prev: null, next: null });
    expect(html).not.toContain('data-nav="prev"');
    expect(html).not.toContain('data-nav="next"');
    expect(html).not.toContain('class="article-footer"');
  });

  it("renders prev card only when only prev neighbor exists", async () => {
    const html = await renderArticle(CAPTURE, { prev: NEIGHBORS.prev, next: null });
    expect(html).toContain('data-nav="prev"');
    expect(html).not.toContain('data-nav="next"');
  });

  it("renders next card only when only next neighbor exists", async () => {
    const html = await renderArticle(CAPTURE, { prev: null, next: NEIGHBORS.next });
    expect(html).not.toContain('data-nav="prev"');
    expect(html).toContain('data-nav="next"');
  });

  it("renders meta-remaining span in meta line", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="meta-remaining"');
  });

  it("omits the site footer on the article page (design has none)", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).not.toContain('class="site-footer"');
  });

  it("renders a cover placeholder when coverImage is absent", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="cover-placeholder"');
  });

  it("renders real cover image when coverImage is provided", async () => {
    const html = await renderArticle({ ...CAPTURE, coverImage: "https://example.com/cover.jpg" });
    expect(html).toContain('class="cover-image"');
    expect(html).not.toContain('class="cover-placeholder"');
  });

  it("renders font control buttons in topbar", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="font-ctrl"');
    expect(html).toContain('data-dir="down"');
    expect(html).toContain('data-dir="up"');
  });

  it("renders progress bar and scroll-to-top elements", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="read-progress-bar"');
    expect(html).toContain('class="scroll-top-btn"');
  });

  it("shows publishedAt in meta when provided", async () => {
    const html = await renderArticle({ ...CAPTURE, publishedAt: "2024-03-15" });
    expect(html).toContain("2024-03-15");
  });

  it("publishedAt with timezone offset shows the calendar date, not UTC date", async () => {
    // "2024-03-15T01:00:00+08:00" is UTC 2024-03-14 — must still show 2024-03-15
    const html = await renderArticle({ ...CAPTURE, publishedAt: "2024-03-15T01:00:00+08:00" });
    expect(html).toContain("2024-03-15");
    expect(html).not.toContain("2024-03-14");
  });

  it("publishedAt with invalid format shows the raw string", async () => {
    const html = await renderArticle({ ...CAPTURE, publishedAt: "not-a-date" });
    expect(html).toContain("not-a-date");
  });

  it("resolves amber-asset:<key> refs to blob URLs before rendering", async () => {
    const blob: BlobStore = {
      put: vi.fn(),
      urlFor: vi.fn(async (key: string) => `/blobs/${key}`),
      deleteByPrefix: vi.fn(async () => {}),
    };
    const html = await renderArticle({
      ...CAPTURE,
      content: "![img](amber-asset:captures/c1/0.png)",
    }, { prev: null, next: null }, blob);
    expect(blob.urlFor).toHaveBeenCalledWith("captures/c1/0.png");
    expect(html).toContain("/blobs/captures/c1/0.png");
    expect(html).not.toContain("amber-asset:");
  });

  it("leaves content unchanged when no blob is provided", async () => {
    // Old path / tests: no blob → no resolution, raw content passed through.
    const html = await renderArticle({ ...CAPTURE, content: "![img](amber-asset:captures/c1/0.png)" });
    expect(html).toContain("amber-asset:captures/c1/0.png");
  });
});

describe("renderList tags", () => {
  it("renders a top tag bar with distinct tags from all items", () => {
    const items: CaptureSummary[] = [
      { id: "a", title: "A", sourceUrl: "https://a.com", capturedAt: "2026-06-08T00:00:00.000Z", tags: ["react", "ui"] },
      { id: "b", title: "B", sourceUrl: "https://b.com", capturedAt: "2026-06-08T00:00:00.000Z", tags: ["react", "ai"] },
    ];
    const html = renderList(items);
    expect(html).toContain("tag-bar");
    expect(html).toContain('class="tag-filter-all"');
    expect(html).toContain('data-tag="react"');
    expect(html).toContain('data-tag="ui"');
    expect(html).toContain('data-tag="ai"');
    expect(html.match(/<button class="tag-filter" type="button" data-tag="react">/g)?.length).toBe(1);
  });

  it("omits the tag bar when no item has tags", () => {
    const items: CaptureSummary[] = [
      { id: "a", title: "A", sourceUrl: "https://a.com", capturedAt: "2026-06-08T00:00:00.000Z" },
    ];
    expect(renderList(items)).not.toContain('class="tag-bar"');
  });

  it("puts each item's tags into data-tags as JSON and renders an editor", () => {
    const items: CaptureSummary[] = [
      { id: "a", title: "A", sourceUrl: "https://a.com", capturedAt: "2026-06-08T00:00:00.000Z", tags: ["react"] },
    ];
    const html = renderList(items);
    expect(html).toContain('data-tags="[&quot;react&quot;]"');
    expect(html).toContain('class="tag-editor" data-capture-id="a"');
    expect(html).toContain('class="tag-add"');
  });
});

describe("renderArticle tags", () => {
  it("renders an editable tag region for the capture", async () => {
    const html = await renderArticle({ ...CAPTURE, tags: ["react", "ui"] });
    expect(html).toContain(`class="tag-editor" data-capture-id="${CAPTURE.id}"`);
    expect(html).toContain('data-tag="react"');
    expect(html).toContain('data-tag="ui"');
    expect(html).toContain('class="tag-add"');
  });

  it("renders an empty tag editor (just the add button) when no tags", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('class="tag-editor"');
    expect(html).toContain('class="tag-add"');
  });
});
