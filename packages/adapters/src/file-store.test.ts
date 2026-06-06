import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Capture } from "@amber/domain";
import { FileStore } from "./file-store.js";

function cap(over: Partial<Capture>): Capture {
  return {
    id: "c1", title: "T", content: "body", sourceUrl: "https://x/a",
    sourceType: "url", capturedAt: "2026-01-01T00:00:00.000Z",
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

  it("list returns summaries sorted by capturedAt desc", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "old", capturedAt: "2026-01-01T00:00:00.000Z" }));
    await store.insert(cap({ id: "new", capturedAt: "2026-02-01T00:00:00.000Z" }));
    const list = await store.list();
    expect(list.map((s) => s.id)).toEqual(["new", "old"]);
    expect(list[0]).toMatchObject({ id: "new", title: "T", sourceUrl: "https://x/a", capturedAt: "2026-02-01T00:00:00.000Z" });
  });

  it("list includes new optional fields when present", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({
      id: "rich",
      coverImage: "https://img/cover.jpg",
      excerpt: "First para.",
      wordCount: 42,
      hasCode: true,
      tags: ["tech", "js"],
    }));
    const list = await store.list();
    expect(list[0].coverImage).toBe("https://img/cover.jpg");
    expect(list[0].excerpt).toBe("First para.");
    expect(list[0].wordCount).toBe(42);
    expect(list[0].hasCode).toBe(true);
    expect(list[0].tags).toEqual(["tech", "js"]);
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
    await store.insert(cap({ id: "r3", readAt: "2026-05-01T00:00:00.000Z" }));
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
    await store.insert(cap({ id: "rp1", readProgress: 55, readAt: "2026-06-04T00:00:00.000Z" }));
    const list = await store.list();
    expect(list[0].readProgress).toBe(55);
    expect(list[0].readAt).toBe("2026-06-04T00:00:00.000Z");
  });

  it("updateTags replaces tags on the capture", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "t1" }));
    await store.updateTags("t1", ["a", "b"]);
    expect((await store.get("t1"))?.tags).toEqual(["a", "b"]);
  });

  it("updateTags accepts empty array to clear tags", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "t2", tags: ["x"] }));
    await store.updateTags("t2", []);
    expect((await store.get("t2"))?.tags).toEqual([]);
  });

  it("updateTags is a no-op for unknown ids", async () => {
    const store = new FileStore(dir);
    await expect(store.updateTags("ghost", ["a"])).resolves.toBeUndefined();
  });

  it("recordVisit sets lastOpenedAt and increments readCount", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "v1" }));
    await store.recordVisit("v1", "2026-06-05T10:00:00.000Z");
    const updated = await store.get("v1");
    expect(updated?.lastOpenedAt).toBe("2026-06-05T10:00:00.000Z");
    expect(updated?.readCount).toBe(1);
  });

  it("recordVisit increments readCount on each call", async () => {
    const store = new FileStore(dir);
    await store.insert(cap({ id: "v2" }));
    await store.recordVisit("v2", "2026-06-05T10:00:00.000Z");
    await store.recordVisit("v2", "2026-06-05T11:00:00.000Z");
    expect((await store.get("v2"))?.readCount).toBe(2);
  });

  it("recordVisit is a no-op for unknown ids", async () => {
    const store = new FileStore(dir);
    await expect(store.recordVisit("ghost", "2026-06-05T10:00:00.000Z")).resolves.toBeUndefined();
  });
});
