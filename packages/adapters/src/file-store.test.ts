import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Capture } from "@amber/domain";
import { FileStore } from "./file-store.js";

function cap(over: Partial<Capture>): Capture {
  return {
    id: "c1", title: "T", content: "body", sourceUrl: "https://x/a",
    sourceType: "url", createdAt: "2026-01-01T00:00:00.000Z", capturedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("FileStore", () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "amber-filestore-")); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it("insert then get round-trips a capture", async () => {
    const store = new FileStore(dir);
    const c = cap({ id: "abc", title: "Hello" });
    await store.insert(c);
    expect(await store.get("abc")).toEqual(c);
  });

  it("get returns null for unknown id", async () => {
    const store = new FileStore(dir);
    expect(await store.get("nope")).toBeNull();
  });

  it("list returns summaries sorted by createdAt desc", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "old", createdAt: "2026-01-01T00:00:00.000Z" }));
    await store.insert(cap({ id: "new", createdAt: "2026-02-01T00:00:00.000Z" }));
    const list = await store.list();
    expect(list.map((s) => s.id)).toEqual(["new", "old"]);
    expect(list[0]).toEqual({ id: "new", title: "T", sourceUrl: "https://x/a", createdAt: "2026-02-01T00:00:00.000Z" });
  });

  it("findBySourceUrl finds a matching capture or null", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "a", sourceUrl: "https://x/one" }));
    expect((await store.findBySourceUrl("https://x/one"))?.id).toBe("a");
    expect(await store.findBySourceUrl("https://x/missing")).toBeNull();
  });

  it("list returns empty when nothing imported yet", async () => {
    const store = new FileStore(dir);
    expect(await store.list()).toEqual([]);
  });

  it("delete removes the capture file, then get returns null", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "del1" }));
    expect(await store.get("del1")).not.toBeNull();
    await store.delete("del1");
    expect(await store.get("del1")).toBeNull();
  });

  it("delete is a no-op for unknown ids", async () => {
    const store = new FileStore(dir);
    await expect(store.delete("ghost")).resolves.toBeUndefined();
  });

  it("updateReadStatus merges readProgress into the stored capture", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "r1" }));
    await store.updateReadStatus("r1", { readProgress: 42 });
    const updated = await store.get("r1");
    expect(updated?.readProgress).toBe(42);
    expect(updated?.readAt).toBeUndefined();
  });

  it("updateReadStatus sets readAt when provided", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "r2" }));
    await store.updateReadStatus("r2", { readProgress: 100, readAt: "2026-06-04T10:00:00.000Z" });
    const updated = await store.get("r2");
    expect(updated?.readAt).toBe("2026-06-04T10:00:00.000Z");
  });

  it("updateReadStatus does not overwrite an existing readAt", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "r3", readAt: "2026-05-01T00:00:00.000Z" } as Capture));
    await store.updateReadStatus("r3", { readProgress: 100, readAt: "2026-06-04T10:00:00.000Z" });
    const updated = await store.get("r3");
    expect(updated?.readAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("updateReadStatus is a no-op for unknown ids", async () => {
    const store = new FileStore(dir);
    await expect(store.updateReadStatus("ghost", { readProgress: 50 })).resolves.toBeUndefined();
  });

  it("list includes readProgress and readAt when present", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "rp1", readProgress: 55, readAt: "2026-06-04T00:00:00.000Z" } as Capture));
    const list = await store.list();
    expect(list[0].readProgress).toBe(55);
    expect(list[0].readAt).toBe("2026-06-04T00:00:00.000Z");
  });
});
