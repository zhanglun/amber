import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { BlobStore } from "@amber/domain";

export class R2BlobStore implements BlobStore {
  private readonly base: string;

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    publicBaseUrl: string
  ) {
    this.base = publicBaseUrl.replace(/\/$/, "");
  }

  async put(key: string, data: Uint8Array, contentType?: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      })
    );
    return `${this.base}/${key}`;
  }

  async urlFor(key: string): Promise<string> {
    return `${this.base}/${key}`;
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const listed = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix })
    );
    const keys = (listed.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => typeof k === "string");
    if (keys.length === 0) return;
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      })
    );
  }
}

export function createR2BlobStore(opts: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}): R2BlobStore {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${opts.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
    },
  });
  return new R2BlobStore(client, opts.bucket, opts.publicBaseUrl);
}
