import { describe, expect, it } from "vitest";
import type { ReadService } from "@amber/core";
import type { Capture } from "@amber/domain";
import { contentTypeForPath, createApp } from "./index.js";

const captures: Capture[] = [
  {
    id: "c1",
    title: "First",
    content: "# First Body\n\n## Intro\n\ntext\n\n### Detail\n\nmore",
    sourceUrl: "https://example.com/a",
    sourceType: "url",
    createdAt: "2026-06-02T00:00:00.000Z",
    capturedAt: "2026-06-02T00:00:00.000Z",
  },
  {
    id: "c2",
    title: "Second",
    content: "# Second Body\n\n## Section\n\ntext\n\n### Notes\n\nmore",
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
  it("renders the list page on / without the article shell", async () => {
    const app = createApp(fakeReadService(), { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/");
    const html = await res.text();
    expect(html).toContain('<input id="search"');
    expect(html).toContain('href="/captures/c1"');
    expect(html).toContain('href="/captures/c2"');
    expect(html).toContain('action="/captures/c1/delete"');
    expect(html).not.toContain('class="article-shell"');
  });

  it("renders the selected capture on /captures/:id as a focused article", async () => {
    const app = createApp(fakeReadService(), { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/c2");
    const html = await res.text();
    expect(html).toContain('class="article-shell"');
    expect(html).toContain('class="toc"');
    expect(html).toContain('<h1 class="article-title-anchor">Second</h1>');
    expect(html).toContain('href="#section"');
    expect(html).not.toContain('href="/captures/c1"');
  });

  it("deletes a capture and redirects back to the list", async () => {
    const deleted: string[] = [];
    const app = createApp(fakeReadService(), {
      blobsDir: "/tmp",
      deleteCapture: async (id) => { deleted.push(id); },
    });
    const res = await app.request("/captures/c2/delete", { method: "POST" });
    expect(deleted).toEqual(["c2"]);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
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
