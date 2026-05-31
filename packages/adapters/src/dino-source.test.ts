import { describe, expect, it } from "vitest";
import type { CaptureResult } from "dino";
import { toRawCapture } from "./dino-source.js";

describe("toRawCapture", () => {
  it("rewrites dino asset paths to amber placeholders in markdown", () => {
    const result: CaptureResult = {
      url: "https://example.com/a",
      title: "Post",
      markdown: "hi\n\n![x](assets/image-001.png)\n\n![y](assets/image-002.jpg)",
      author: "Ada",
      publishedAt: "2026-01-02",
      assets: [
        { path: "assets/image-001.png", data: new Uint8Array([1]), contentType: "image/png" },
        { path: "assets/image-002.jpg", data: new Uint8Array([2]), contentType: "image/jpeg" },
      ],
    };

    const raw = toRawCapture(result);

    expect(raw.title).toBe("Post");
    expect(raw.author).toBe("Ada");
    expect(raw.publishedAt).toBe("2026-01-02");
    expect(raw.markdown).toBe("hi\n\n![x](amber-asset:0)\n\n![y](amber-asset:1)");
    expect(raw.assets).toEqual([
      { placeholder: "amber-asset:0", data: new Uint8Array([1]), contentType: "image/png" },
      { placeholder: "amber-asset:1", data: new Uint8Array([2]), contentType: "image/jpeg" },
    ]);
  });

  it("leaves markdown untouched when there are no assets", () => {
    const result: CaptureResult = {
      url: "https://example.com/a", title: "T", markdown: "plain text", assets: [],
    };
    const raw = toRawCapture(result);
    expect(raw.markdown).toBe("plain text");
    expect(raw.assets).toEqual([]);
  });
});
