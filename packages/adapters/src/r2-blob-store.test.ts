import { describe, expect, it, vi } from "vitest";
import type { S3Client } from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { R2BlobStore, createR2BlobStore } from "./r2-blob-store.js";

function makeMockClient() {
  const send = vi.fn().mockResolvedValue({});
  return { send } as unknown as S3Client;
}

describe("R2BlobStore", () => {
  it("put uploads to S3 and returns public URL", async () => {
    const client = makeMockClient();
    const store = new R2BlobStore(client, "my-bucket", "https://cdn.example.com");
    const data = new Uint8Array([1, 2, 3]);

    const url = await store.put("captures/c1/0.png", data, "image/png");

    expect(url).toBe("https://cdn.example.com/captures/c1/0.png");
    expect(client.send).toHaveBeenCalledOnce();
    const cmd: PutObjectCommand = (client.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(cmd.input).toEqual({
      Bucket: "my-bucket",
      Key: "captures/c1/0.png",
      Body: data,
      ContentType: "image/png",
    });
  });

  it("put strips trailing slash from publicBaseUrl", async () => {
    const client = makeMockClient();
    const store = new R2BlobStore(client, "bucket", "https://cdn.example.com/");
    const url = await store.put("file.png", new Uint8Array(), "image/png");
    expect(url).toBe("https://cdn.example.com/file.png");
  });

  it("put omits ContentType when not provided", async () => {
    const client = makeMockClient();
    const store = new R2BlobStore(client, "bucket", "https://cdn.example.com");
    await store.put("file.bin", new Uint8Array());
    const cmd: PutObjectCommand = (client.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(cmd.input.ContentType).toBeUndefined();
  });
});

describe("createR2BlobStore", () => {
  it("returns an R2BlobStore instance", () => {
    const store = createR2BlobStore({
      accountId: "acc123",
      accessKeyId: "key",
      secretAccessKey: "secret",
      bucket: "amber-blobs",
      publicBaseUrl: "https://cdn.example.com",
    });
    expect(store).toBeInstanceOf(R2BlobStore);
  });
});
