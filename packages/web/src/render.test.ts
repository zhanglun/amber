import { describe, expect, it } from "vitest";
import { renderArticle, renderList, escapeHtml, readingStats } from "./render.js";

const CAPTURE = {
  id: "c1",
  title: "Title",
  content: "# Heading\n\ntext",
  sourceUrl: "https://example.com/a",
  sourceType: "url" as const,
  createdAt: "2026-06-01T00:00:00.000Z",
  capturedAt: "2026-06-01T00:00:00.000Z",
};

describe("escapeHtml", () => {
  it("escapes html special characters", () => {
    expect(escapeHtml(`a<b>&"c`)).toBe("a&lt;b&gt;&amp;&quot;c");
  });
});

describe("readingStats", () => {
  it("returns zero chars and one minute for empty content", () => {
    expect(readingStats("")).toEqual({ chars: 0, minutes: 1 });
  });

  it("counts non-whitespace non-code-block characters", () => {
    expect(readingStats("你好世界")).toEqual({ chars: 4, minutes: 1 });
  });

  it("excludes fenced code blocks from char count", () => {
    expect(readingStats("```\nconst x = 1\n```")).toEqual({ chars: 0, minutes: 1 });
  });

  it("calculates reading time at 300 chars per minute", () => {
    const result = readingStats("字".repeat(600));
    expect(result.chars).toBe(600);
    expect(result.minutes).toBe(2);
  });
});

describe("renderList", () => {
  const items = [
    { id: "c1", title: "First", sourceUrl: "https://example.com/a", createdAt: "2026-06-01T00:00:00.000Z" },
  ];

  it("links to each capture", () => {
    const html = renderList(items);
    expect(html).toContain('href="/captures/c1"');
    expect(html).toContain("First");
  });

  it("shows hostname and formatted date", () => {
    const html = renderList(items);
    expect(html).toContain("example.com");
    expect(html).toContain("2026-06-01");
  });

  it("shows empty hint when no captures", () => {
    expect(renderList([])).toContain("No captures yet");
  });

  it("includes theme switcher", () => {
    expect(renderList(items)).toContain("theme-switcher");
  });
});

describe("renderArticle", () => {
  it("renders markdown to html", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("text");
  });

  it("includes back link", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain('href="/"');
  });

  it("shows word count and reading time", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain("字");
    expect(html).toContain("分钟");
  });

  it("shows source hostname with link to original", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain("example.com");
    expect(html).toContain('href="https://example.com/a"');
  });

  it("includes theme switcher", async () => {
    const html = await renderArticle(CAPTURE);
    expect(html).toContain("theme-switcher");
  });
});
