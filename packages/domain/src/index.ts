/** 一份被收藏的内容，是跨所有版本被存储与阅读的基本单元。 */
export interface Capture {
  id: string; // uuid，应用层生成
  title: string;
  content: string; // markdown；图片链接已改写为 R2 公开 URL
  sourceUrl: string;
  sourceType: "url"; // 联合类型，未来扩展：'pdf' | 'markdown' | 'note'
  author?: string;
  createdAt: string; // ISO 8601
  capturedAt: string; // ISO 8601
}

export type CaptureSummary = Pick<
  Capture,
  "id" | "title" | "sourceUrl" | "createdAt"
>;

/** 一个二进制资源（图片），由 markdown 中的占位符引用。 */
export interface Asset {
  placeholder: string; // markdown 中的占位符，如 "amber-asset:0"
  data: Uint8Array;
  contentType?: string;
}

/** 由 Source 返回的、尚未入库的原始素材。 */
export interface RawCapture {
  title: string;
  markdown: string; // 图片为占位符，待替换为 R2 URL
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
}

/** 二进制/对象存储。`put` 返回公开 URL。 */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType?: string): Promise<string>;
}
