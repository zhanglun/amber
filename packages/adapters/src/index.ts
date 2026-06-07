export {
  DinoSource,
  explainCaptureError,
  mentionsBrowserAttempt,
  toRawCapture,
} from "./dino-source.js";
export { FileStore } from "./file-store.js";
export { FileBlobStore } from "./file-blob-store.js";
export { PostgresStore } from "./postgres-store.js";
export { R2BlobStore, createR2BlobStore } from "./r2-blob-store.js";

// dino 的浏览器自检能力（doctor）经 adapters 层再导出，使 dino 依赖封装在本层内，
// 入口层（CLI）只依赖 @amber/adapters，不直接依赖 dino。
export { formatDoctorResult, runDoctor } from "dino";
export type { DoctorResult, DoctorCheck } from "dino";
