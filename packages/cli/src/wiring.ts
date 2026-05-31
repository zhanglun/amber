import { resolve } from "node:path";
import { DinoSource, FileBlobStore, FileStore } from "@amber/adapters";
import { ImportService, ReadService } from "@amber/core";

/** 无数据库模式：所有数据落到本地目录（默认 ./amber-data）。 */
export function buildServices() {
  const dataDir = resolve(process.env.AMBER_DATA_DIR ?? "./amber-data");
  const source = new DinoSource();
  const store = new FileStore(dataDir);
  const blob = new FileBlobStore(dataDir);
  return {
    dataDir,
    importService: new ImportService(source, store, blob),
    readService: new ReadService(store),
  };
}
