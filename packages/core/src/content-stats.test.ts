import { describe, expect, it } from "vitest";
import { computeExcerpt, computeHasCode, computeWordCount } from "./content-stats.js";

describe("computeWordCount", () => {
  it("counts non-whitespace chars excluding fenced code blocks", () => {
    expect(computeWordCount("hello world")).toBe(10);
  });

  it("excludes fenced code blocks", () => {
    const md = "intro\n\n```js\nconst x = 1;\n```\n\noutro";
    expect(computeWordCount(md)).toBe(10); // "intro" + "outro" = 10 chars
  });

  it("returns 0 for empty string", () => {
    expect(computeWordCount("")).toBe(0);
  });

  it("excludes inline code", () => {
    expect(computeWordCount("use `foo` bar")).toBe(6); // "use" + "bar" = 6
  });

  it("excludes image syntax entirely", () => {
    expect(computeWordCount("![alt text](https://img.example.com/pic.jpg) word")).toBe(4); // "word" = 4
  });

  it("keeps link text but excludes URL", () => {
    expect(computeWordCount("[click here](https://example.com/very/long/path) end")).toBe(12); // "click" + "here" + "end" = 12
  });
});

describe("computeHasCode", () => {
  it("returns true for fenced code blocks with backticks", () => {
    expect(computeHasCode("text\n\n```js\ncode\n```")).toBe(true);
  });

  it("returns true for fenced code blocks with tildes", () => {
    expect(computeHasCode("~~~\ncode\n~~~")).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(computeHasCode("just some text")).toBe(false);
  });

  it("returns false for inline code only", () => {
    expect(computeHasCode("use `foo` inline")).toBe(false);
  });
});

describe("computeExcerpt", () => {
  it("returns first paragraph text with markdown stripped", () => {
    const md = "# Heading\n\nFirst paragraph text here.\n\nSecond paragraph.";
    expect(computeExcerpt(md)).toBe("First paragraph text here.");
  });

  it("truncates long text to maxLen with ellipsis", () => {
    const long = "A".repeat(200);
    const result = computeExcerpt(long, 150);
    expect(result.length).toBe(151); // 150 chars + "…"
    expect(result.endsWith("…")).toBe(true);
  });

  it("strips markdown images", () => {
    expect(computeExcerpt("![alt](url) text")).toBe("text");
  });

  it("strips markdown links but keeps text", () => {
    expect(computeExcerpt("[click here](https://x.com) text")).toBe("click here text");
  });

  it("strips bold and italic markers", () => {
    expect(computeExcerpt("**bold** and _italic_")).toBe("bold and italic");
  });

  it("returns empty string for content-less input", () => {
    expect(computeExcerpt("```js\ncode only\n```")).toBe("");
  });
});
