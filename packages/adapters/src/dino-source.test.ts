import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureResult } from "dino";
import {
  explainCaptureError,
  mentionsBrowserAttempt,
  readabilityFallback,
  toRawCapture,
} from "./dino-source.js";

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

// readabilityFallback 用全局 fetch；各用例 stub fetch 返回构造 HTML。
const PARAGRAPH = "这是一段足够长的中文正文，用于让 readability 判定为可读内容。".repeat(3);

function page(body: string, title = "页面标题"): string {
  return `<html><head><title>${title}</title></head><body><nav>导航与页脚噪音</nav>${body}</body></html>`;
}

function stubFetch(body: string, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } })),
  );
}

describe("readabilityFallback", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("从 <article> 提取出非空 markdown，assets 为空", async () => {
    stubFetch(page(`<article><h2>小标题</h2><p>${PARAGRAPH}</p><p>${PARAGRAPH}</p></article>`));
    const r = await readabilityFallback("https://example.com/a", {});
    expect(r).not.toBeNull();
    expect(r!.markdown.trim().length).toBeGreaterThan(0);
    expect(r!.markdown).toContain("正文");
    expect(r!.assets).toEqual([]);
  });

  it("title 优先使用 partial.title", async () => {
    stubFetch(page(`<article><p>${PARAGRAPH}</p></article>`));
    const r = await readabilityFallback("https://example.com/a", { title: "来自 dino" });
    expect(r!.title).toBe("来自 dino");
  });

  it("无 <article> 时退到 <main> 仍可提取", async () => {
    stubFetch(page(`<main><p>${PARAGRAPH}</p><p>${PARAGRAPH}</p></main>`));
    const r = await readabilityFallback("https://example.com/a", {});
    expect(r).not.toBeNull();
    expect(r!.markdown.trim().length).toBeGreaterThan(0);
  });

  it("无 <article>/<main> 时退到 body", async () => {
    stubFetch(page(`<div><p>${PARAGRAPH}</p><p>${PARAGRAPH}</p></div>`));
    const r = await readabilityFallback("https://example.com/a", {});
    expect(r).not.toBeNull();
  });

  it("fetch 非 2xx 返回 null", async () => {
    stubFetch("", 404);
    const r = await readabilityFallback("https://example.com/a", {});
    expect(r).toBeNull();
  });

  it("fetch 抛异常返回 null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network error");
      }),
    );
    const r = await readabilityFallback("https://example.com/a", {});
    expect(r).toBeNull();
  });

  it("透传 partial 的 author/publishedAt/coverImage", async () => {
    stubFetch(page(`<article><p>${PARAGRAPH}</p><p>${PARAGRAPH}</p></article>`));
    const r = await readabilityFallback("https://example.com/a", {
      author: "Innei",
      publishedAt: "2026-07-23",
      coverImage: "https://img/cover.jpg",
    });
    expect(r!.author).toBe("Innei");
    expect(r!.publishedAt).toBe("2026-07-23");
    expect(r!.coverImage).toBe("https://img/cover.jpg");
  });
});
