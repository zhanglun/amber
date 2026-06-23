import { describe, expect, it } from "vitest";
import type { CaptureResult } from "dino";
import { explainCaptureError, mentionsBrowserAttempt, toRawCapture } from "./dino-source.js";

describe("toRawCapture", () => {
  const result: CaptureResult = {
    url: "https://example.com",
    title: "Test",
    markdown: "hi\n\n![x](assets/a.png)\n\n![y](assets/b.jpg)",
    assets: [
      { path: "assets/a.png", data: new Uint8Array([1]), contentType: "image/png" },
      { path: "assets/b.jpg", data: new Uint8Array([2]), contentType: "image/jpeg" },
    ],
    coverImage: "https://img.example.com/cover.jpg",
  };

  it("rewrites asset paths to amber-asset placeholders", () => {
    const raw = toRawCapture(result);
    expect(raw.markdown).toBe("hi\n\n![x](amber-asset:0)\n\n![y](amber-asset:1)");
  });

  it("passes through coverImage", () => {
    const raw = toRawCapture(result);
    expect(raw.coverImage).toBe("https://img.example.com/cover.jpg");
  });

  it("passes through author and publishedAt when present", () => {
    const withMeta: CaptureResult = { ...result, author: "Alice", publishedAt: "2024-01-01" };
    const raw = toRawCapture(withMeta);
    expect(raw.author).toBe("Alice");
    expect(raw.publishedAt).toBe("2024-01-01");
  });

  it("coverImage is undefined when not provided", () => {
    const noCover: CaptureResult = { ...result, coverImage: undefined };
    const raw = toRawCapture(noCover);
    expect(raw.coverImage).toBeUndefined();
  });

  it("converts residual <table> HTML to a pipe table", () => {
    const withTable: CaptureResult = {
      ...result,
      markdown:
        `<p>intro</p>\n\n` +
        `<table><tbody><tr><td>序号</td><td>标题</td></tr>` +
        `<tr><td>1</td><td>破题</td></tr></tbody></table>`,
      assets: [],
    };
    const raw = toRawCapture(withTable);
    expect(raw.markdown).not.toContain("<table");
    expect(raw.markdown).toContain("| 序号 | 标题 |");
    expect(raw.markdown).toContain("intro");
  });
});

describe("mentionsBrowserAttempt", () => {
  it("detects a failed browser attempt in dino's joined error", () => {
    expect(mentionsBrowserAttempt("static missing article content; browser failed: x")).toBe(true);
  });
  it("detects a failed stealth attempt", () => {
    expect(mentionsBrowserAttempt("stealth failed: Executable doesn't exist")).toBe(true);
  });
  it("detects a failed browser-state attempt", () => {
    expect(mentionsBrowserAttempt("browser-state failed: boom")).toBe(true);
  });
  it("is false for a pure static failure", () => {
    expect(mentionsBrowserAttempt("static missing article content")).toBe(false);
  });
  it("is case-insensitive", () => {
    expect(mentionsBrowserAttempt("Browser Failed: nope")).toBe(true);
  });
});

describe("explainCaptureError", () => {
  it("appends the amber doctor hint when a browser attempt failed", () => {
    const out = explainCaptureError("static missing article content; browser failed: x");
    expect(out).toContain("static missing article content; browser failed: x");
    expect(out).toContain("amber doctor");
  });
  it("returns the original message unchanged for non-browser failures", () => {
    expect(explainCaptureError("static missing article content")).toBe("static missing article content");
  });
});
