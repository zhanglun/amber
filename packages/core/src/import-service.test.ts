import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { BlobStore, Capture, Store } from "@amber/domain";
import { ImportService } from "./import-service.js";

/** 生成一张真实小 png（2x2 红点），用于测试图片转码。 */
async function makePng(): Promise<Uint8Array> {
  const buf = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

const cap: Capture = {
  id: "c1",
  title: "T",
  content: "body",
  sourceUrl: "https://x/a",
  sourceType: "url",
  capturedAt: "2026-01-01T00:00:00.000Z",
};

function fakeStore(rows: Capture[] = []): Store {
  const saved: Capture[] = [...rows];
  return {
    insert: vi.fn(async (c) => {
      const idx = saved.findIndex((r) => r.id === c.id);
      if (idx !== -1) saved.splice(idx, 1, c); else saved.push(c);
    }),
    list: vi.fn(async () =>
      saved.map((r) => ({ id: r.id, title: r.title, sourceUrl: r.sourceUrl, capturedAt: r.capturedAt }))
    ),
    get: vi.fn(async (id) => saved.find((r) => r.id === id) ?? null),
    findBySourceUrl: vi.fn(async (url) => saved.find((r) => r.sourceUrl === url) ?? null),
    delete: vi.fn(),
    updateReadStatus: vi.fn(),
    updateTags: vi.fn(),
    recordVisit: vi.fn(),
  };
}

function fakeBlob(): BlobStore {
  return {
    put: vi.fn(async (key) => `https://cdn.example.com/${key}`),
    urlFor: vi.fn(async (key) => `https://cdn.example.com/${key}`),
  };
}

describe("ImportService.run", () => {
  it("calls source.capture with the given url", async () => {
    const source = { capture: vi.fn(async () => ({ title: "T", markdown: "body", assets: [] })) };
    const svc = new ImportService(source, fakeStore(), fakeBlob());
    await svc.run("https://x/a");
    expect(source.capture).toHaveBeenCalledWith("https://x/a");
  });

  it("stores the capture with capturedAt from deps.now", async () => {
    const source = { capture: vi.fn(async () => ({ title: "T", markdown: "body", assets: [] })) };
    const store = fakeStore();
    const svc = new ImportService(source, store, fakeBlob(), {
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      newId: () => "fixed-id",
    });
    await svc.run("https://x/a");
    const saved = await store.get("fixed-id");
    expect(saved?.capturedAt).toBe("2026-05-31T00:00:00.000Z");
  });

  it("stores publishedAt from raw when provided", async () => {
    const source = { capture: vi.fn(async () => ({ title: "T", markdown: "body", publishedAt: "2024-03-15", assets: [] })) };
    const store = fakeStore();
    const svc = new ImportService(source, store, fakeBlob(), {
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      newId: () => "fixed-id",
    });
    await svc.run("https://x/a");
    const saved = await store.get("fixed-id");
    expect(saved?.publishedAt).toBe("2024-03-15");
    expect(saved?.capturedAt).toBe("2026-05-31T00:00:00.000Z");
  });

  it("stores coverImage from raw when provided", async () => {
    const source = { capture: vi.fn(async () => ({ title: "T", markdown: "body", coverImage: "https://img/cover.jpg", assets: [] })) };
    const store = fakeStore();
    const svc = new ImportService(source, store, fakeBlob(), { newId: () => "cov1" });
    await svc.run("https://x/a");
    const saved = await store.get("cov1");
    expect(saved?.coverImage).toBe("https://img/cover.jpg");
  });

  it("computes wordCount, hasCode, and excerpt at import time", async () => {
    const source = {
      capture: vi.fn(async () => ({
        title: "T",
        markdown: "First paragraph content here.\n\n```js\ncode\n```",
        assets: [],
      })),
    };
    const store = fakeStore();
    const svc = new ImportService(source, store, fakeBlob(), { newId: () => "stats1" });
    await svc.run("https://x/a");
    const saved = await store.get("stats1");
    expect(saved?.wordCount).toBeGreaterThan(0);
    expect(saved?.hasCode).toBe(true);
    expect(saved?.excerpt).toBe("First paragraph content here.");
  });

  it("deduplicates: returns existing id without re-importing", async () => {
    const source = { capture: vi.fn(async () => ({ title: "T", markdown: "body", assets: [] })) };
    const store = fakeStore([cap]);
    const svc = new ImportService(source, store, fakeBlob());
    const id = await svc.run("https://x/a");
    expect(id).toBe("c1");
    expect(source.capture).not.toHaveBeenCalled();
  });

  it("optimizes a png asset to webp and rewrites the content reference", async () => {
    const png = await makePng();
    const source = {
      capture: vi.fn(async () => ({
        title: "T",
        markdown: "![img](amber-asset:0)",
        assets: [{ placeholder: "amber-asset:0", data: png, contentType: "image/png" }],
      })),
    };
    const blob = fakeBlob();
    const store = fakeStore();
    const svc = new ImportService(source, store, blob, { newId: () => "u1" });
    await svc.run("https://x/a");
    const saved = await store.get("u1");
    // png 被转成 webp：正文引用、key 扩展名都应是 .webp。
    expect(saved?.content).toContain("amber-asset:captures/u1/0.webp");
    expect(saved?.content).not.toContain("amber-asset:captures/u1/0.png");
    // blob.put 收到的是 webp contentType。
    expect(blob.put).toHaveBeenCalledWith(
      "captures/u1/0.webp",
      expect.any(Uint8Array),
      "image/webp",
    );
  });

  it("does not optimize svg assets (keeps .svg key)", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const source = {
      capture: vi.fn(async () => ({
        title: "T",
        markdown: "![img](amber-asset:0)",
        assets: [{ placeholder: "amber-asset:0", data: svg, contentType: "image/svg+xml" }],
      })),
    };
    const blob = fakeBlob();
    const store = fakeStore();
    const svc = new ImportService(source, store, blob, { newId: () => "u1" });
    await svc.run("https://x/a");
    const saved = await store.get("u1");
    expect(saved?.content).toContain("amber-asset:captures/u1/0.svg");
  });

  it("falls back to original data when optimization fails (corrupt image)", async () => {
    const source = {
      capture: vi.fn(async () => ({
        title: "T",
        markdown: "![img](amber-asset:0)",
        assets: [{ placeholder: "amber-asset:0", data: new Uint8Array([1, 2, 3]), contentType: "image/png" }],
      })),
    };
    const blob = fakeBlob();
    const store = fakeStore();
    const svc = new ImportService(source, store, blob, { newId: () => "u1" });
    await svc.run("https://x/a");
    const saved = await store.get("u1");
    // 损坏 png 无法转码 → 降级用原始数据，key 仍是 .png。
    expect(saved?.content).toContain("amber-asset:captures/u1/0.png");
  });

  it("forceId skips dedup and overwrites", async () => {
    const source = { capture: vi.fn(async () => ({ title: "New", markdown: "new body", assets: [] })) };
    const store = fakeStore([cap]);
    const svc = new ImportService(source, store, fakeBlob());
    await svc.run("https://x/a", { forceId: "c1" });
    expect(source.capture).toHaveBeenCalled();
    const saved = await store.get("c1");
    expect(saved?.title).toBe("New");
  });
});
