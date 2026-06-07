import { afterEach, describe, expect, it, vi } from "vitest";
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
    capturedAt: "2026-06-02T00:00:00.000Z",
  },
  {
    id: "c2",
    title: "Second",
    content: "# Second Body\n\n## Section\n\ntext\n\n### Notes\n\nmore",
    sourceUrl: "https://example.org/b",
    sourceType: "url",
    capturedAt: "2026-06-01T00:00:00.000Z",
  },
];

function fakeReadService(): ReadService {
  return {
    list: async () =>
      captures.map(({ id, title, sourceUrl, capturedAt }) => ({ id, title, sourceUrl, capturedAt })),
    get: async (id: string) => captures.find((c) => c.id === id) ?? null,
    findBySourceUrl: async (sourceUrl: string) =>
      captures.find((c) => c.sourceUrl === sourceUrl) ?? null,
    updateReadStatus: vi.fn(),
    updateTags: vi.fn(),
    recordVisit: vi.fn(),
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
    expect(html).toContain('data-capture-id="c2"');
    expect(html).not.toContain('action="/captures/c2/delete"');
    expect(html).not.toContain('class="group"');
  });

  it("article page includes link to adjacent capture via data-nav", async () => {
    const app = createApp(fakeReadService(), { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/c2");
    const html = await res.text();
    expect(html).toContain('data-nav="prev"');
    expect(html).toContain('href="/captures/c1"');
  });

  it("first article has no prev neighbor but has next", async () => {
    const app = createApp(fakeReadService(), { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/c1");
    const html = await res.text();
    expect(html).not.toContain('data-nav="prev"');
    expect(html).toContain('data-nav="next"');
    expect(html).toContain('href="/captures/c2"');
  });

  it("GET /captures/:id calls recordVisit", async () => {
    const svc = fakeReadService();
    const app = createApp(svc, { blobsDir: "/tmp", deleteCapture: async () => {} });
    await app.request("/captures/c1");
    expect(svc.recordVisit).toHaveBeenCalledWith("c1", expect.any(String));
  });

  it("PATCH /captures/:id/read calls updateReadStatus and returns 204", async () => {
    const svc = fakeReadService();
    const app = createApp(svc, { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/c1/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readProgress: 55 }),
    });
    expect(res.status).toBe(204);
    expect(svc.updateReadStatus).toHaveBeenCalledWith("c1", { readProgress: 55 });
  });

  it("PATCH /captures/:id/tags calls updateTags and returns 204", async () => {
    const svc = fakeReadService();
    const app = createApp(svc, { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/c1/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["reading", "tech"] }),
    });
    expect(res.status).toBe(204);
    expect(svc.updateTags).toHaveBeenCalledWith("c1", ["reading", "tech"]);
  });

  it("PATCH /captures/:id/tags returns 404 for unknown id", async () => {
    const svc = fakeReadService();
    const app = createApp(svc, { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/unknown/tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["x"] }),
    });
    expect(res.status).toBe(404);
    expect(svc.updateTags).not.toHaveBeenCalled();
  });

  it("PATCH /captures/:id/read returns 404 for unknown id", async () => {
    const svc = fakeReadService();
    const app = createApp(svc, { blobsDir: "/tmp", deleteCapture: async () => {} });
    const res = await app.request("/captures/unknown/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readProgress: 50 }),
    });
    expect(res.status).toBe(404);
    expect(svc.updateReadStatus).not.toHaveBeenCalled();
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

describe("createApp requestLog option", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("logs a request line when requestLog is enabled", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = createApp(fakeReadService(), {
      blobsDir: "/tmp",
      deleteCapture: async () => {},
      requestLog: true,
    });
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(log.mock.calls.map((c) => String(c[0])).join("\n")).toContain("GET / 200");
  });

  it("does not log when requestLog is omitted", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = createApp(fakeReadService(), { blobsDir: "/tmp", deleteCapture: async () => {} });
    await app.request("/");
    expect(log.mock.calls.length).toBe(0);
  });
});
