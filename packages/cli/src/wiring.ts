import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DinoSource, FileBlobStore, FileStore } from "@amber/adapters";
import { ImportService, ReadService, captureAssetPrefix } from "@amber/core";

/** 无数据库模式：所有数据落到本地目录（默认 ./amber-data）。 */
export function buildServices() {
  const dataDir = resolve(process.env.AMBER_DATA_DIR ?? "./amber-data");
  const source = new DinoSource();
  const store = new FileStore(dataDir);
  const blob = new FileBlobStore(dataDir);
  const blobsDir = join(dataDir, "blobs");

  async function deleteCapture(id: string): Promise<void> {
    await store.delete(id);
    await rm(join(blobsDir, captureAssetPrefix(id)), { recursive: true, force: true });
  }

  return {
    dataDir,
    blobsDir,
    importService: new ImportService(source, store, blob),
    readService: new ReadService(store),
    deleteCapture,
  };
}
