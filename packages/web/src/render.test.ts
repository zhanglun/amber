import { describe, expect, it } from "vitest";
import type { Capture, CaptureSummary } from "@amber/domain";
import { escapeHtml, groupByWeek, readingStats, renderArticle, renderList } from "./render.js";

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

describe("renderList", () => {
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

  it("shows empty-state message when no items", () => {
    expect(renderList([])).toContain("No captures yet");
  });

  it("includes search bar", () => {
    expect(renderList([])).toContain('<input id="search"');
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
});
