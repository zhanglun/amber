/** 一份被收藏的内容，是跨所有版本被存储与阅读的基本单元。 */
export interface Capture {
  id: string;
  title: string;
  content: string;
  sourceUrl: string;
  sourceType: "url";
  author?: string;
  createdAt: string;
  capturedAt: string;
  readProgress?: number; // 0–100，滚动百分比整数
  readAt?: string;       // ISO 8601，首次读完时写入，不随进度回退
}

export type CaptureSummary = Pick<
  Capture,
  "id" | "title" | "sourceUrl" | "createdAt" | "readProgress" | "readAt"
>;

/** 一个二进制资源（图片），由 markdown 中的占位符引用。 */
export interface Asset {
  placeholder: string;
  data: Uint8Array;
  contentType?: string;
}

/** 由 Source 返回的、尚未入库的原始素材。 */
export interface RawCapture {
  title: string;
  markdown: string;
  author?: string;
  publishedAt?: string;
  assets: Asset[];
}

/** 采集来源：给定输入，返回原始素材。 */
export interface Source {
  capture(input: string): Promise<RawCapture>;
}

/** Capture 行的结构化存储。 */
export interface Store {
  insert(capture: Capture): Promise<void>;
  list(): Promise<CaptureSummary[]>;
  get(id: string): Promise<Capture | null>;
  findBySourceUrl(url: string): Promise<Capture | null>;
  delete(id: string): Promise<void>;
  updateReadStatus(id: string, status: { readProgress: number; readAt?: string }): Promise<void>;
}

/** 二进制/对象存储。`put` 返回公开 URL。 */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType?: string): Promise<string>;
}
