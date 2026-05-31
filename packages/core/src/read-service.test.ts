import { describe, expect, it, vi } from "vitest";
import type { Capture, Store } from "@amber/domain";
import { ReadService } from "./read-service.js";

const cap: Capture = {
  id: "c1", title: "T", content: "body", sourceUrl: "https://x/a",
  sourceType: "url", createdAt: "2026-01-01T00:00:00.000Z", capturedAt: "2026-01-01T00:00:00.000Z",
};

function fakeStore(): Store {
  return {
    insert: vi.fn(),
    list: vi.fn(async () => [{ id: cap.id, title: cap.title, sourceUrl: cap.sourceUrl, createdAt: cap.createdAt }]),
    get: vi.fn(async (id: string) => (id === "c1" ? cap : null)),
    findBySourceUrl: vi.fn(),
  };
}

describe("ReadService", () => {
  it("lists capture summaries", async () => {
    const svc = new ReadService(fakeStore());
    const items = await svc.list();
    expect(items).toEqual([{ id: "c1", title: "T", sourceUrl: "https://x/a", createdAt: "2026-01-01T00:00:00.000Z" }]);
  });

  it("gets a capture by id, or null", async () => {
    const svc = new ReadService(fakeStore());
    expect(await svc.get("c1")).toEqual(cap);
    expect(await svc.get("nope")).toBeNull();
  });
});
