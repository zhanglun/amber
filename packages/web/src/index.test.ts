import { describe, expect, it } from "vitest";
import type { ReadService } from "@amber/core";
import type { Capture } from "@amber/domain";
import { contentTypeForPath, createApp } from "./index.js";

const captures: Capture[] = [
  {
    id: "c1",
    title: "First",
    content: "# First Body\n\ntext",
    sourceUrl: "https://example.com/a",
    sourceType: "url",
    createdAt: "2026-06-02T00:00:00.000Z",
    capturedAt: "2026-06-02T00:00:00.000Z",
  },
  {
    id: "c2",
    title: "Second",
    content: "# Second Body\n\ntext",
    sourceUrl: "https://example.org/b",
    sourceType: "url",
    createdAt: "2026-06-01T00:00:00.000Z",
    capturedAt: "2026-06-01T00:00:00.000Z",
  },
];

function fakeReadService(): ReadService {
  return {
    list: async () => captures.map(({ id, title, sourceUrl, createdAt }) => ({ id, title, sourceUrl, createdAt })),
    get: async (id: string) => captures.find((capture) => capture.id === id) ?? null,
    findBySourceUrl: async (sourceUrl: string) => captures.find((capture) => capture.sourceUrl === sourceUrl) ?? null,
  } as unknown as ReadService;
}

describe("createApp", () => {
  it("renders the newest capture on / inside the split shell", async () => {
    const app = createApp(fakeReadService(), { blobsDir: "/tmp" });
    const res = await app.request("/");
    const html = await res.text();
    expect(html).toContain('class="app-shell"');
    expect(html).toContain('class="sidebar"');
    expect(html).toContain('class="reader"');
    expect(html).toContain("<h1>First</h1>");
  });

  it("renders the selected capture on /captures/:id inside the split shell", async () => {
    const app = createApp(fakeReadService(), { blobsDir: "/tmp" });
    const res = await app.request("/captures/c2");
    const html = await res.text();
    expect(html).toContain('class="app-shell"');
    expect(html).toContain("<h1>Second</h1>");
    expect(html).toContain('href="/captures/c2"');
    expect(html).toContain('class="item sidebar-item active"');
  });
});

describe("contentTypeForPath", () => {
  it("returns video MIME types for local video blobs", () => {
    expect(contentTypeForPath("captures/c1/2.mp4")).toBe("video/mp4");
    expect(contentTypeForPath("captures/c1/2.webm")).toBe("video/webm");
    expect(contentTypeForPath("captures/c1/2.ogv")).toBe("video/ogg");
    expect(contentTypeForPath("captures/c1/2.mov")).toBe("video/quicktime");
  });
});
