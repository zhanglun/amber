import { describe, expect, it } from "vitest";
import type { CaptureResult } from "dino";
import { toRawCapture } from "./dino-source.js";

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
});
