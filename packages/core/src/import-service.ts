import type { BlobStore, Capture, Source, Store } from "@amber/domain";
import { assetKey } from "./asset-key.js";
import { computeExcerpt, computeHasCode, computeWordCount } from "./content-stats.js";

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
      const key = assetKey(id, i, asset.contentType);
      const publicUrl = await this.blob.put(key, asset.data, asset.contentType);
      content = content.replaceAll(asset.placeholder, publicUrl);
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
