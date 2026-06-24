import { describe, expect, it } from "vitest";
import { migrateCaptureList, rewriteBlobRefs } from "./migrate-blob-refs.js";

describe("rewriteBlobRefs", () => {
  it("rewrites a relative /blobs/ URL to amber-asset:<key>", () => {
    const content = "![img](/blobs/captures/c1/0.png)";
    const { content: out, refsRewritten } = rewriteBlobRefs(content);
    expect(out).toBe("![img](amber-asset:captures/c1/0.png)");
    expect(refsRewritten).toBe(1);
  });

  it("rewrites a publicBaseUrl-prefixed URL", () => {
    const content = "![img](http://localhost:7788/blobs/captures/c1/0.png)";
    const { content: out } = rewriteBlobRefs(content, ["http://localhost:7788"]);
    expect(out).toBe("![img](amber-asset:captures/c1/0.png)");
  });

  it("handles multiple refs in one content", () => {
    const content =
      "![a](/blobs/captures/c1/0.png) text ![b](/blobs/captures/c1/1.mp4)";
    const { content: out, refsRewritten } = rewriteBlobRefs(content);
    expect(out).toContain("amber-asset:captures/c1/0.png");
    expect(out).toContain("amber-asset:captures/c1/1.mp4");
    expect(refsRewritten).toBe(2);
  });

  it("leaves already-migrated amber-asset: refs unchanged", () => {
    const content = "![img](amber-asset:captures/c1/0.png)";
    const { content: out, refsRewritten } = rewriteBlobRefs(content);
    expect(out).toBe(content);
    expect(refsRewritten).toBe(0);
  });

  it("leaves external URLs unchanged", () => {
    const content = "![img](https://example.com/foo.png) and [link](https://other.com/x)";
    const { content: out, refsRewritten } = rewriteBlobRefs(content);
    expect(out).toBe(content);
    expect(refsRewritten).toBe(0);
  });

  it("returns content unchanged when no /blobs/ present", () => {
    const content = "plain text with no images";
    const { content: out, refsRewritten } = rewriteBlobRefs(content);
    expect(out).toBe(content);
    expect(refsRewritten).toBe(0);
  });

  it("handles video links in the ▶ video embed form", () => {
    const content = "[▶ video](/blobs/captures/c1/2.mp4)";
    const { content: out } = rewriteBlobRefs(content);
    expect(out).toBe("[▶ video](amber-asset:captures/c1/2.mp4)");
  });
});

describe("migrateCaptureList", () => {
  it("reports stats correctly for a mix of changed and unchanged", () => {
    const captures = [
      { id: "a", content: "![img](/blobs/captures/a/0.png) and ![b](/blobs/captures/a/1.png)" },
      { id: "b", content: "no images here" },
      { id: "c", content: "![x](amber-asset:captures/c/0.png)" },
    ];
    const { results, stats } = migrateCaptureList(captures);
    expect(stats).toEqual({ changed: 1, unchanged: 2, refsRewritten: 2 });
    expect(results[0].content).toBe("![img](amber-asset:captures/a/0.png) and ![b](amber-asset:captures/a/1.png)");
    expect(results[1].content).toBe("no images here");
    expect(results[2].content).toBe("![x](amber-asset:captures/c/0.png)");
  });
});
