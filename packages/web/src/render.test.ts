import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { renderArticle, renderLibrary, renderList, escapeHtml, readingStats, groupByWeek } from "./render.js";
import type { CaptureSummary } from "@amber/domain";

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
    { id: "c1", title: "First", sourceUrl: "https://example.com/a", createdAt: "2020-01-15T00:00:00.000Z" },
  ];

  it("links to each capture", () => {
    const html = renderList(items);
    expect(html).toContain('href="/captures/c1"');
    expect(html).toContain("First");
  });

  it("shows hostname and formatted date", () => {
    const html = renderList(items);
    expect(html).toContain("example.com");
    expect(html).toContain("2020-01-15");
  });

  it("shows empty hint when no captures", () => {
    expect(renderList([])).toContain("No captures yet");
  });

  it("includes theme switcher", () => {
    expect(renderList(items)).toContain("theme-switcher");
  });

  it("output contains group class and data-group", () => {
    const html = renderList(items);
    expect(html).toContain('class="group"');
    expect(html).toContain('data-group');
  });

  it("each item has data-title attribute", () => {
    const html = renderList(items);
    expect(html).toContain('data-title="first"');
  });

  it("each item has data-host attribute", () => {
    const html = renderList(items);
    expect(html).toContain('data-host="example.com"');
  });

  it("output contains search bar input", () => {
    const html = renderList(items);
    expect(html).toContain('<input id="search"');
  });

  it("header contains header-right wrapper", () => {
    const html = renderList(items);
    expect(html).toContain('class="header-right"');
  });

  it("escapes special characters in data-title attribute", () => {
    const special = [
      { id: "s1", title: 'Hello "World"', sourceUrl: "https://example.com/a", createdAt: "2020-01-15T00:00:00.000Z" },
    ];
    const html = renderList(special);
    expect(html).toContain('data-title="hello &quot;world&quot;"');
  });
});

describe("renderLibrary", () => {
  const items = [
    { id: "c1", title: "First", sourceUrl: "https://example.com/a", createdAt: "2026-06-01T00:00:00.000Z" },
    { id: "c2", title: "Second", sourceUrl: "https://example.org/b", createdAt: "2026-05-25T00:00:00.000Z" },
  ];

  it("renders a split app shell with sidebar and reader", async () => {
    const html = await renderLibrary(items, CAPTURE);
    expect(html).toContain('class="app-shell"');
    expect(html).toContain('class="sidebar"');
    expect(html).toContain('class="reader"');
    expect(html).toContain("<h1>Title</h1>");
  });

  it("marks the selected sidebar item active", async () => {
    const html = await renderLibrary(items, CAPTURE);
    expect(html).toContain('class="item sidebar-item active"');
    expect(html).toContain('href="/captures/c1"');
  });

  it("renders an empty reader state when no capture is selected", async () => {
    const html = await renderLibrary([], null);
    expect(html).toContain("No captures yet");
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

describe("groupByWeek", () => {
  function makeSummary(id: string, createdAt: string): CaptureSummary {
    return { id, title: `Title ${id}`, sourceUrl: "https://example.com/path", createdAt };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-03T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("returns empty array when given empty list", () => {
    expect(groupByWeek([])).toEqual([]);
  });

  it("groups item from this week into 本周", () => {
    const items = [makeSummary("1", "2026-06-02T10:00:00Z")];
    const groups = groupByWeek(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("本周");
    expect(groups[0].items).toEqual(items);
  });

  it("groups item from last week into 上周", () => {
    const items = [makeSummary("2", "2026-05-26T10:00:00Z")];
    const groups = groupByWeek(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("上周");
    expect(groups[0].items).toEqual(items);
  });

  it("groups item from earlier into 更早", () => {
    const items = [makeSummary("3", "2026-05-01T10:00:00Z")];
    const groups = groupByWeek(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("更早");
    expect(groups[0].items).toEqual(items);
  });

  it("filters out empty groups", () => {
    const items = [
      makeSummary("1", "2026-06-02T10:00:00Z"),
      makeSummary("2", "2026-05-01T10:00:00Z"),
    ];
    const groups = groupByWeek(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("本周");
    expect(groups[1].label).toBe("更早");
  });
});
