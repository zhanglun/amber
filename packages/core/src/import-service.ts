import type { BlobStore, Capture, Source, Store } from "@amber/domain";
import { assetKey } from "./asset-key.js";
import { computeExcerpt, computeHasCode, computeWordCount } from "./content-stats.js";
import { optimizeImage } from "./image-optimize.js";

export interface ImportDeps {
  now?: () => Date;
  newId?: () => string;
}

export interface ImportOptions {
  forceId?: string;
}

export class ImportService {
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(
    private readonly source: Source,
    private readonly store: Store,
    private readonly blob: BlobStore,
    deps: ImportDeps = {},
  ) {
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  async run(url: string, options?: ImportOptions): Promise<string> {
    if (!options?.forceId) {
      const existing = await this.store.findBySourceUrl(url);
      if (existing) return existing.id;
    }

    const raw = await this.source.capture(url);

    const id = options?.forceId ?? this.newId();
    let content = raw.markdown;
    for (let i = 0; i < raw.assets.length; i++) {
      const asset = raw.assets[i];
      // 压缩图片转 webp（png/jpeg/gif → webp quality 85），省存储、加快加载。
      // 不可转换（svg/webp/video）或失败时返回 null，用原始数据。必须在 assetKey 之前
      // 转换，这样 key 扩展名（.webp）、blob 存储、正文引用三者在同一循环内自动对齐。
      const optimized = await optimizeImage(asset.data, asset.contentType);
      const data = optimized?.data ?? asset.data;
      const contentType = optimized?.contentType ?? asset.contentType;
      const key = assetKey(id, i, contentType);
      await this.blob.put(key, data, contentType);
      // 正文只存后端无关的稳定引用 amber-asset:<key>，渲染时由 urlFor 解析成实际 URL。
      // 这样换后端/迁移 blob 后正文链接不会失效。
      content = content.replaceAll(asset.placeholder, `amber-asset:${key}`);
    }

    const capturedAt = this.now().toISOString();
    const capture: Capture = {
      id,
      title: raw.title,
      content,
      sourceUrl: url,
      sourceType: "url",
      author: raw.author,
      capturedAt,
      publishedAt: raw.publishedAt,
      coverImage: raw.coverImage,
      excerpt: computeExcerpt(content),
      wordCount: computeWordCount(content),
      hasCode: computeHasCode(content),
    };
    await this.store.insert(capture);
    return id;
  }
}
