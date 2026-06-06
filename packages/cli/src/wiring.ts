import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  DinoSource,
  FileBlobStore,
  FileStore,
  PostgresStore,
  createR2BlobStore,
} from "@amber/adapters";
import type { BlobStore, Store } from "@amber/domain";
import { ImportService, ReadService, captureAssetPrefix } from "@amber/core";

export function buildServices() {
  const dataDir = resolve(process.env.AMBER_DATA_DIR ?? "./amber-data");
  const source = new DinoSource();

  const store: Store = process.env.DATABASE_URL
    ? new PostgresStore(process.env.DATABASE_URL)
    : new FileStore(dataDir);

  const blob: BlobStore =
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
      ? createR2BlobStore({
          accountId: process.env.R2_ACCOUNT_ID,
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          bucket: process.env.R2_BUCKET,
          publicBaseUrl: process.env.R2_PUBLIC_BASE_URL ?? "",
        })
      : new FileBlobStore(dataDir);

  const blobsDir = join(dataDir, "blobs");

  async function deleteCapture(id: string): Promise<void> {
    await store.delete(id);
    await rm(join(blobsDir, captureAssetPrefix(id)), {
      recursive: true,
      force: true,
    });
  }

  // 释放 store 持有的资源（PostgresStore 的连接池会保持事件循环存活，
  // 短命 CLI 命令若不释放会卡住不退出）。
  async function dispose(): Promise<void> {
    await store.disconnect?.();
  }

  return {
    dataDir,
    blobsDir,
    importService: new ImportService(source, store, blob),
    readService: new ReadService(store),
    deleteCapture,
    dispose,
  };
}
