import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BlobStore } from "@amber/domain";

/**
 * 基于本地文件的 BlobStore 实现（无云模式）：把资源写入 <dataDir>/blobs/<key>，
 * 返回以 publicBaseUrl 为前缀的 URL（默认 "/blobs/<key>"，未来 web 服务可直接 serve）。
 */
export class FileBlobStore implements BlobStore {
  private readonly blobsDir: string;
  private readonly publicBaseUrl: string;

  constructor(dataDir: string, publicBaseUrl = "") {
    this.blobsDir = join(dataDir, "blobs");
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, "");
  }

  async put(key: string, data: Uint8Array, _contentType?: string): Promise<string> {
    const dest = join(this.blobsDir, key);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, data);
    return `${this.publicBaseUrl}/blobs/${key}`;
  }

  async urlFor(key: string): Promise<string> {
    return `${this.publicBaseUrl}/blobs/${key}`;
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    await rm(join(this.blobsDir, prefix), { recursive: true, force: true });
  }
}
