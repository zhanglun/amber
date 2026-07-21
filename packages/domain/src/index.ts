/** 一份被收藏的内容，是跨所有版本被存储与阅读的基本单元。 */
export interface Capture {
  id: string;
  title: string;
  content: string;
  sourceUrl: string;
  sourceType: "url";
  author?: string;
  capturedAt: string;      // 用户保存的时间（ISO 8601，始终有值）
  publishedAt?: string;    // 原文发布时间（ISO 8601，可选）
  coverImage?: string;     // 封面图 URL（来自 dino）
  excerpt?: string;        // 导入时计算的纯文字摘要（≤150字）
  wordCount?: number;      // 导入时计算的字符数（不含代码块和空白）
  hasCode?: boolean;       // 导入时计算：正文是否含代码块
  tags?: string[];         // 用户自定义标签
  readProgress?: number;   // 0–100，滚动百分比整数
  readAt?: string;         // ISO 8601，首次读完时写入，不随进度回退
  lastOpenedAt?: string;   // ISO 8601，最近一次打开时间
  readCount?: number;      // 打开次数（每次访问 /captures/:id 自增）
}

export type CaptureSummary = Pick<
  Capture,
  | "id" | "title" | "sourceUrl" | "capturedAt" | "publishedAt"
  | "coverImage" | "excerpt" | "wordCount" | "hasCode"
  | "tags" | "readProgress" | "readAt"
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
  coverImage?: string;
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
  updateTags(id: string, tags: string[]): Promise<void>;
  recordVisit(id: string, visitedAt: string): Promise<void>;
  /** 释放底层资源（如数据库连接）。无连接的实现可不提供。 */
  disconnect?(): Promise<void>;
}

/** 二进制/对象存储。`put` 返回公开 URL（向后兼容；新代码不应把该 URL 写进正文，
 *  应在正文里存 `amber-asset:<key>`，渲染时用 `urlFor` 解析）。 */
export interface BlobStore {
  put(key: string, data: Uint8Array, contentType?: string): Promise<string>;
  /** 把稳定 key 解析成访问 URL（本地为 `/blobs/<key>`，云存储为公开/签名直链）。 */
  urlFor(key: string): Promise<string>;
  /** 删除指定前缀下的所有对象（如 `captures/<id>/` 下的全部 blob）。 */
  deleteByPrefix(prefix: string): Promise<void>;
}
