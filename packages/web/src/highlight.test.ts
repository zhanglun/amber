import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./highlight.js";

describe("renderMarkdown", () => {
  it("renders plain text paragraphs to html", async () => {
    const html = await renderMarkdown("hello world");
    expect(html).toContain("<p>hello world</p>");
  });

  it("highlights known language code blocks with shiki", async () => {
    const html = await renderMarkdown("```typescript\nconst x = 1\n```");
    expect(html).toContain('<pre class="shiki');
  });

  it("falls back to plain pre/code for unknown language without throwing", async () => {
    const html = await renderMarkdown("```unknownlang999\nsome code\n```");
    expect(html).toContain("<pre>");
    expect(html).not.toContain('<pre class="shiki');
  });
});
