import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./highlight.js";
import type { TocItem } from "./toc.js";

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

  it("renders local video links as native video embeds", async () => {
    const html = await renderMarkdown("[▶ video](/blobs/captures/c1/2.mp4)");
    expect(html).toContain('<figure class="video-embed">');
    expect(html).toContain("<video");
    expect(html).toContain("controls");
    expect(html).toContain('preload="metadata"');
    expect(html).toContain('src="/blobs/captures/c1/2.mp4"');
  });

  it("adds toc ids to h2 and h3 headings by order", async () => {
    const toc: TocItem[] = [
      { level: 2, text: "Repeat", id: "repeat" },
      { level: 2, text: "Repeat", id: "repeat-2" },
    ];
    const html = await renderMarkdown("## Repeat\n\n## Repeat", { toc });
    expect(html).toContain('<h2 id="repeat">Repeat</h2>');
    expect(html).toContain('<h2 id="repeat-2">Repeat</h2>');
  });
});
