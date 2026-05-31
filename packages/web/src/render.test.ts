import { describe, expect, it } from "vitest";
import { renderArticle, renderList, escapeHtml } from "./render.js";

describe("render", () => {
  it("escapes html in titles", () => {
    expect(escapeHtml(`a<b>&"c`)).toBe("a&lt;b&gt;&amp;&quot;c");
  });

  it("renders a list linking to each capture", () => {
    const html = renderList([
      { id: "c1", title: "First", sourceUrl: "https://x/a", createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(html).toContain("First");
    expect(html).toContain('href="/captures/c1"');
  });

  it("shows an empty hint when there are no captures", () => {
    expect(renderList([])).toContain("No captures yet");
  });

  it("renders article markdown to html", () => {
    const html = renderArticle({
      id: "c1", title: "Title", content: "# Heading\n\ntext", sourceUrl: "https://x/a",
      sourceType: "url", createdAt: "2026-01-01T00:00:00.000Z", capturedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("text");
    expect(html).toContain('href="/"'); // 返回列表的链接
  });
});
