import { describe, expect, it } from "vitest";
import { findConvertibleRefs, isConvertibleImageKey, rewriteAssetRefs } from "./optimize-images.js";

describe("findConvertibleRefs", () => {
  it("finds png/jpg/gif refs and maps to webp keys", () => {
    const content =
      "![a](amber-asset:captures/c1/0.png) and ![b](amber-asset:captures/c1/1.jpg) and ![c](amber-asset:captures/c1/2.gif)";
    const refs = findConvertibleRefs(content);
    expect(refs).toEqual([
      { oldKey: "captures/c1/0.png", newKey: "captures/c1/0.webp" },
      { oldKey: "captures/c1/1.jpg", newKey: "captures/c1/1.webp" },
      { oldKey: "captures/c1/2.gif", newKey: "captures/c1/2.webp" },
    ]);
  });

  it("skips already-webp and svg refs", () => {
    const content = "![a](amber-asset:captures/c1/0.webp) and ![b](amber-asset:captures/c1/1.svg)";
    expect(findConvertibleRefs(content)).toEqual([]);
  });
});

describe("rewriteAssetRefs", () => {
  it("rewrites png/jpg/gif refs to webp and counts them", () => {
    const content = "![a](amber-asset:captures/c1/0.png) text ![b](amber-asset:captures/c1/1.gif)";
    const { content: out, count } = rewriteAssetRefs(content);
    expect(out).toBe("![a](amber-asset:captures/c1/0.webp) text ![b](amber-asset:captures/c1/1.webp)");
    expect(count).toBe(2);
  });

  it("leaves non-asset png mentions in prose unchanged", () => {
    // 不是 amber-asset: 引用，是普通文字提到 a.png，不应改。
    const content = "see the file a.png and amber-asset:captures/c1/0.png";
    const { content: out, count } = rewriteAssetRefs(content);
    expect(out).toContain("a.png");
    expect(out).toContain("amber-asset:captures/c1/0.webp");
    expect(count).toBe(1);
  });

  it("returns content unchanged when no convertible refs", () => {
    const content = "![a](amber-asset:captures/c1/0.webp) plain text";
    const { content: out, count } = rewriteAssetRefs(content);
    expect(out).toBe(content);
    expect(count).toBe(0);
  });

  it("handles jpeg extension", () => {
    const content = "![a](amber-asset:captures/c1/0.jpeg)";
    const { content: out } = rewriteAssetRefs(content);
    expect(out).toContain("amber-asset:captures/c1/0.webp");
  });
});

describe("isConvertibleImageKey", () => {
  it.each(["captures/c1/0.png", "captures/c1/1.jpg", "captures/c1/2.gif", "captures/c1/3.jpeg"])(
    "returns true for %s",
    (key) => expect(isConvertibleImageKey(key)).toBe(true),
  );
  it.each(["captures/c1/0.webp", "captures/c1/1.svg", "captures/c1/2.mp4", "captures/c1/3.bin"])(
    "returns false for %s",
    (key) => expect(isConvertibleImageKey(key)).toBe(false),
  );
});
