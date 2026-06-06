import { describe, expect, it, vi } from "vitest";
import type { Store } from "@amber/domain";
import { ReadService } from "./read-service.js";

const cap = {
  id: "c1", title: "T", content: "body", sourceUrl: "https://x/a",
  sourceType: "url" as const, capturedAt: "2026-01-01T00:00:00.000Z",
};

function fakeStore(): Store {
  return {
    insert: vi.fn(),
    list: vi.fn(async () => [{ id: cap.id, title: cap.title, sourceUrl: cap.sourceUrl, capturedAt: cap.capturedAt }]),
    get: vi.fn(async (id: string) => (id === "c1" ? cap : null)),
    findBySourceUrl: vi.fn(async (url: string) => (url === "https://x/a" ? cap : null)),
    delete: vi.fn(),
    updateReadStatus: vi.fn(),
    updateTags: vi.fn(),
    recordVisit: vi.fn(),
  };
}

describe("ReadService", () => {
  it("list delegates to store.list", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    const result = await svc.list();
    expect(store.list).toHaveBeenCalled();
    expect(result[0].id).toBe("c1");
  });

  it("get delegates to store.get", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    expect(await svc.get("c1")).toEqual(cap);
    expect(await svc.get("x")).toBeNull();
  });

  it("findBySourceUrl delegates to store.findBySourceUrl", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    expect(await svc.findBySourceUrl("https://x/a")).toEqual(cap);
    expect(await svc.findBySourceUrl("https://other")).toBeNull();
  });

  it("delegates updateReadStatus to the store", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    await svc.updateReadStatus("c1", { readProgress: 70 });
    expect(store.updateReadStatus).toHaveBeenCalledWith("c1", { readProgress: 70 });
  });

  it("normalizes tags before delegating updateTags to the store", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    await svc.updateTags("c1", [" a ", "a", "", "b"]);
    expect(store.updateTags).toHaveBeenCalledWith("c1", ["a", "b"]);
  });

  it("delegates recordVisit to the store", async () => {
    const store = fakeStore();
    const svc = new ReadService(store);
    await svc.recordVisit("c1", "2026-06-05T10:00:00.000Z");
    expect(store.recordVisit).toHaveBeenCalledWith("c1", "2026-06-05T10:00:00.000Z");
  });
});
