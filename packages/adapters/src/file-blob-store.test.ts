import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileBlobStore } from "./file-blob-store.js";

describe("FileBlobStore", () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "amber-blob-")); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it("writes bytes under blobs/<key> and returns a /blobs URL", async () => {
    const store = new FileBlobStore(dir);
    const url = await store.put("captures/c1/0.png", new Uint8Array([1, 2, 3]), "image/png");
    expect(url).toBe("/blobs/captures/c1/0.png");
    const written = await readFile(join(dir, "blobs", "captures", "c1", "0.png"));
    expect(Array.from(written)).toEqual([1, 2, 3]);
  });

  it("prefixes with publicBaseUrl when provided", async () => {
    const store = new FileBlobStore(dir, "http://localhost:7788");
    const url = await store.put("captures/c1/0.png", new Uint8Array([1]));
    expect(url).toBe("http://localhost:7788/blobs/captures/c1/0.png");
  });
});
