import { describe, expect, it, vi } from "vitest";
import type {
  BlobStore,
  Capture,
  RawCapture,
  Source,
  Store,
} from "@amber/domain";
import { ImportService } from "./import-service.js";

function fakeStore(seed: Capture[] = []) {
  const rows = [...seed];
  const store: Store = {
    insert: vi.fn(async (c: Capture) => {
      rows.push(c);
    }),
    list: vi.fn(async () => rows.map((r) => ({ id: r.id, title: r.title, sourceUrl: r.sourceUrl, createdAt: r.createdAt }))),
    get: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    findBySourceUrl: vi.fn(async (url: string) => rows.find((r) => r.sourceUrl === url) ?? null),
  };
  return { store, rows };
}

function fakeSource(raw: RawCapture): Source {
  return { capture: vi.fn(async () => raw) };
}

function fakeBlob(): BlobStore {
  return {
    put: vi.fn(async (key: string) => `https://cdn.test/${key}`),
  };
}

const raw: RawCapture = {
  title: "Hello",
  markdown: "intro\n\n![a](amber-asset:0)\n\n![b](amber-asset:1)",
  author: "Ada",
  publishedAt: "2026-01-02",
  assets: [
    { placeholder: "amber-asset:0", data: new Uint8Array([1]), contentType: "image/png" },
    { placeholder: "amber-asset:1", data: new Uint8Array([2]), contentType: "image/jpeg" },
  ],
};

describe("ImportService", () => {
  it("uploads assets, rewrites placeholders, and inserts a capture", async () => {
    const source = fakeSource(raw);
    const { store, rows } = fakeStore();
    const blob = fakeBlob();
    const service = new ImportService(source, store, blob, {
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      newId: () => "cap-1",
    });

    const id = await service.run("https://example.com/a");

    expect(id).toBe("cap-1");
    expect(rows).toHaveLength(1);
    const saved = rows[0];
    expect(saved.title).toBe("Hello");
    expect(saved.sourceUrl).toBe("https://example.com/a");
    expect(saved.sourceType).toBe("url");
    expect(saved.author).toBe("Ada");
    expect(saved.capturedAt).toBe("2026-05-31T00:00:00.000Z");
    // 占位符已替换为 R2 URL，正文中不残留任何占位符
    expect(saved.content).toContain("https://cdn.test/captures/cap-1/0.png");
    expect(saved.content).toContain("https://cdn.test/captures/cap-1/1.jpg");
    expect(saved.content).not.toContain("amber-asset:");
    expect(blob.put).toHaveBeenCalledTimes(2);
  });

  it("skips capture entirely when the url already exists (dedupe-first)", async () => {
    const existing: Capture = {
      id: "old", title: "Old", content: "x", sourceUrl: "https://example.com/a",
      sourceType: "url", createdAt: "2026-01-01T00:00:00.000Z", capturedAt: "2026-01-01T00:00:00.000Z",
    };
    const source = fakeSource(raw);
    const { store } = fakeStore([existing]);
    const blob = fakeBlob();
    const service = new ImportService(source, store, blob);

    const id = await service.run("https://example.com/a");

    expect(id).toBe("old");
    expect(source.capture).not.toHaveBeenCalled();
    expect(blob.put).not.toHaveBeenCalled();
    expect(store.insert).not.toHaveBeenCalled();
  });
});
