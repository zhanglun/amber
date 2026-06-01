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
});
