import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Capture } from "@amber/domain";
import { PostgresStore } from "./postgres-store.js";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;

function cap(over: Partial<Capture> = {}): Capture {
  return {
    id: "c1",
    title: "T",
    content: "body",
    sourceUrl: "https://x/a",
    sourceType: "url",
    capturedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe.skipIf(!TEST_DB_URL)("PostgresStore", () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore(TEST_DB_URL!);
  });

  afterAll(async () => {
    await store.disconnect();
  });

  beforeEach(async () => {
    await store.deleteAll();
  });

  // ── insert / get ──────────────────────────────────────────────────────────

  it("insert then get round-trips a capture", async () => {
    const c = cap({ id: "abc", title: "Hello" });
    await store.insert(c);
    const found = await store.get("abc");
    expect(found?.id).toBe("abc");
    expect(found?.title).toBe("Hello");
    expect(found?.capturedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("get returns null for unknown id", async () => {
    expect(await store.get("nope")).toBeNull();
  });

  it("insert rejects a duplicate id", async () => {
    await store.insert(cap({ id: "dup" }));
    await expect(store.insert(cap({ id: "dup", sourceUrl: "https://x/dup2" }))).rejects.toThrow();
  });

  it("insert preserves optional string fields", async () => {
    await store.insert(cap({
      id: "opt",
      author: "Alice",
      publishedAt: "2024-03-15T01:00:00+08:00",
      coverImage: "https://img/c.jpg",
      excerpt: "First para.",
    }));
    const found = await store.get("opt");
    expect(found?.author).toBe("Alice");
    expect(found?.publishedAt).toBe("2024-03-15T01:00:00+08:00");
    expect(found?.coverImage).toBe("https://img/c.jpg");
    expect(found?.excerpt).toBe("First para.");
  });

  it("insert preserves computed fields", async () => {
    await store.insert(cap({ id: "cmp", wordCount: 42, hasCode: true }));
    const found = await store.get("cmp");
    expect(found?.wordCount).toBe(42);
    expect(found?.hasCode).toBe(true);
  });

  // ── list ──────────────────────────────────────────────────────────────────

  it("list returns summaries sorted by capturedAt desc", async () => {
    await store.insert(cap({ id: "old", capturedAt: "2026-01-01T00:00:00.000Z" }));
    await store.insert(cap({ id: "new", sourceUrl: "https://x/b", capturedAt: "2026-02-01T00:00:00.000Z" }));
    const list = await store.list();
    expect(list.map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("list omits content field", async () => {
    await store.insert(cap({ id: "lc" }));
    const list = await store.list();
    expect(list[0]).not.toHaveProperty("content");
  });

  it("list includes optional fields when present", async () => {
    await store.insert(cap({
      id: "rich",
      coverImage: "https://img/cover.jpg",
      excerpt: "First para.",
      wordCount: 42,
      hasCode: true,
      tags: ["tech", "js"],
      readProgress: 55,
      readAt: "2026-06-04T00:00:00.000Z",
    }));
    const list = await store.list();
    expect(list[0].coverImage).toBe("https://img/cover.jpg");
    expect(list[0].excerpt).toBe("First para.");
    expect(list[0].wordCount).toBe(42);
    expect(list[0].hasCode).toBe(true);
    expect(list[0].tags).toEqual(["tech", "js"]);
    expect(list[0].readProgress).toBe(55);
    expect(list[0].readAt).toBe("2026-06-04T00:00:00.000Z");
  });

  it("list returns empty when nothing imported", async () => {
    expect(await store.list()).toEqual([]);
  });

  // ── findBySourceUrl ───────────────────────────────────────────────────────

  it("findBySourceUrl finds a matching capture or null", async () => {
    await store.insert(cap({ id: "a", sourceUrl: "https://x/one" }));
    expect((await store.findBySourceUrl("https://x/one"))?.id).toBe("a");
    expect(await store.findBySourceUrl("https://x/missing")).toBeNull();
  });

  // ── delete ────────────────────────────────────────────────────────────────

  it("delete removes the capture, get returns null", async () => {
    await store.insert(cap({ id: "del1" }));
    expect(await store.get("del1")).not.toBeNull();
    await store.delete("del1");
    expect(await store.get("del1")).toBeNull();
  });

  it("delete is a no-op for unknown ids", async () => {
    await expect(store.delete("ghost")).resolves.toBeUndefined();
  });

  // ── updateReadStatus ──────────────────────────────────────────────────────

  it("updateReadStatus sets readProgress", async () => {
    await store.insert(cap({ id: "r1" }));
    await store.updateReadStatus("r1", { readProgress: 42 });
    const updated = await store.get("r1");
    expect(updated?.readProgress).toBe(42);
    expect(updated?.readAt).toBeUndefined();
  });

  it("updateReadStatus sets readAt when provided", async () => {
    await store.insert(cap({ id: "r2" }));
    await store.updateReadStatus("r2", { readProgress: 100, readAt: "2026-06-04T10:00:00.000Z" });
    const updated = await store.get("r2");
    expect(updated?.readAt).toBe("2026-06-04T10:00:00.000Z");
  });

  it("updateReadStatus does not overwrite existing readAt", async () => {
    await store.insert(cap({ id: "r3", readAt: "2026-05-01T00:00:00.000Z" }));
    await store.updateReadStatus("r3", { readProgress: 100, readAt: "2026-06-04T10:00:00.000Z" });
    const updated = await store.get("r3");
    expect(updated?.readAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("updateReadStatus is a no-op for unknown ids", async () => {
    await expect(store.updateReadStatus("ghost", { readProgress: 50 })).resolves.toBeUndefined();
  });

  // ── updateTags ────────────────────────────────────────────────────────────

  it("updateTags replaces tags", async () => {
    await store.insert(cap({ id: "t1" }));
    await store.updateTags("t1", ["a", "b"]);
    expect((await store.get("t1"))?.tags).toEqual(["a", "b"]);
  });

  it("updateTags accepts empty array to clear tags", async () => {
    await store.insert(cap({ id: "t2", tags: ["x"] }));
    await store.updateTags("t2", []);
    expect((await store.get("t2"))?.tags).toEqual([]);
  });

  it("updateTags is a no-op for unknown ids", async () => {
    await expect(store.updateTags("ghost", ["a"])).resolves.toBeUndefined();
  });

  // ── recordVisit ───────────────────────────────────────────────────────────

  it("recordVisit sets lastOpenedAt and increments readCount", async () => {
    await store.insert(cap({ id: "v1" }));
    await store.recordVisit("v1", "2026-06-05T10:00:00.000Z");
    const updated = await store.get("v1");
    expect(updated?.lastOpenedAt).toBe("2026-06-05T10:00:00.000Z");
    expect(updated?.readCount).toBe(1);
  });

  it("recordVisit increments readCount on each call", async () => {
    await store.insert(cap({ id: "v2" }));
    await store.recordVisit("v2", "2026-06-05T10:00:00.000Z");
    await store.recordVisit("v2", "2026-06-05T11:00:00.000Z");
    expect((await store.get("v2"))?.readCount).toBe(2);
  });

  it("recordVisit is a no-op for unknown ids", async () => {
    await expect(store.recordVisit("ghost", "2026-06-05T10:00:00.000Z")).resolves.toBeUndefined();
  });
});
