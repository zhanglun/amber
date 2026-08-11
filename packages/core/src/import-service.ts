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
  /** 重新抓取时保留原有注意力状态：undefined=新导入默认进 Inbox，null=已上架。 */
  initialInboxAt?: string | null;
  /** 进度回调：在抓取/压缩/保存各阶段被调用，用于 CLI 更新 spinner 文案。 */
  onProgress?: (message: string) => void;
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

    options?.onProgress?.("Fetching page…");
    const raw = await this.source.capture(url);

    const id = options?.forceId ?? this.newId();
    const total = raw.assets.length;

    // 并发压缩+存储图片：sharp 走 libuv 线程池，可同时处理多张图；串行 await 是大图页
    // import 的主要耗时来源（一张 2–4MB 的 PNG 过 sharp 要数百 ms 到数秒）。
    // 这里只并发算出每张图最终要替换成的 key（optimize → put），正文替换放到下方的同步
    // 循环里——虽然单线程下 content 赋值原子，但顺序替换意图更清晰、也便于阅读。
    // optimizeImage 不可转换/失败时返回 null，调用方用原始 data，不影响并发。
    let done = 0;
    const replacements = await Promise.all(
      raw.assets.map(async (asset, i) => {
        const optimized = await optimizeImage(asset.data, asset.contentType);
        const data = optimized?.data ?? asset.data;
        const contentType = optimized?.contentType ?? asset.contentType;
        const key = assetKey(id, i, contentType);
        await this.blob.put(key, data, contentType);
        options?.onProgress?.(`Optimizing image ${++done}/${total}…`);
        return { i, key };
      }),
    );

    let content = raw.markdown;
    for (const { i, key } of replacements) {
      // 正文只存后端无关的稳定引用 amber-asset:<key>，渲染时由 urlFor 解析成实际 URL。
      // 这样换后端/迁移 blob 后正文链接不会失效。
      // 用正则确保占位符索引后不跟数字：amber-asset:1 不能子串匹配到 amber-asset:12，
      // 否则 asset 数量超过 10 时 replaceAll 会产生错误链接。
      const placeholderRe = new RegExp(`amber-asset:${i}(?!\\d)`, "g");
      content = content.replace(placeholderRe, `amber-asset:${key}`);
    }

    options?.onProgress?.("Saving…");

    const capturedAt = this.now().toISOString();
    // undefined 表示全新导入；null 表示重新抓取时保留“已上架”。
    let inboxAt: string | undefined;
    if (options?.initialInboxAt === undefined) inboxAt = capturedAt;
    else if (options.initialInboxAt) inboxAt = options.initialInboxAt;

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
      // 新存入默认进入收件箱；重新抓取时必须保留用户此前的安顿决定。
      inboxAt,
    };
    await this.store.insert(capture);
    return id;
  }
}
