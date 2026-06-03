import { describe, expect, it } from "vitest";
import { extractToc } from "./toc.js";

describe("extractToc", () => {
  it("extracts h2 and h3 headings but ignores h1", () => {
    expect(extractToc("# Title\n\n## Intro\n\n### Detail")).toEqual([
      { level: 2, text: "Intro", id: "intro" },
      { level: 3, text: "Detail", id: "detail" },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    expect(extractToc("## Real\n\n```md\n## Fake\n```\n\n### More")).toEqual([
      { level: 2, text: "Real", id: "real" },
      { level: 3, text: "More", id: "more" },
    ]);
  });

  it("deduplicates repeated heading ids by occurrence order", () => {
    expect(extractToc("## Repeat\n\n## Repeat\n\n### Repeat")).toEqual([
      { level: 2, text: "Repeat", id: "repeat" },
      { level: 2, text: "Repeat", id: "repeat-2" },
      { level: 3, text: "Repeat", id: "repeat-3" },
    ]);
  });

  it("cleans common inline markdown before slugging", () => {
    expect(extractToc("## **重点** [链接](https://example.com) `code`")).toEqual([
      { level: 2, text: "重点 链接 code", id: "重点-链接-code" },
    ]);
  });
});
