/**
 * 图片压缩转 webp。在 import 时（blob.put 之前）调用，把静态图（png/jpg）和
 * 动图（gif）转成体积更小的 webp，节省 R2/本地存储、加快加载。
 *
 * 设计：
 * - 只转 image/png、image/jpeg、image/jpg、image/gif。这些转 webp（quality 85，
 *   肉眼基本无损）能显著减小体积。
 * - image/webp 已是目标格式，跳过（幂等）。
 * - image/svg+xml 是矢量文本，rasterize 反而变大变糊，跳过。
 * - video/* 不是图片，跳过。
 * - GIF 用 sharp 的 animated 选项保留多帧动图。
 * - 任何转换失败（损坏图片等）都降级返回 null，调用方用原始 data，不让单张坏图中断 import。
 * - contentType 必须是干净值（不带 `; charset=` 后缀），与 assetKey 的精确匹配约定一致。
 */
import sharp from "sharp";

/** 可被转换为 webp 的源 contentType。webp/svg/video/未知一律跳过。 */
const CONVERTIBLE = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif"]);

export interface OptimizedImage {
  data: Uint8Array;
  contentType: "image/webp";
}

/**
 * 把图片转成 webp。返回 { data, contentType: "image/webp" }。
 * 不可转换（webp/svg/video/未知）或转换失败时返回 null，调用方应原样使用原始数据。
 */
export async function optimizeImage(
  data: Uint8Array,
  contentType?: string,
): Promise<OptimizedImage | null> {
  if (!contentType || !CONVERTIBLE.has(contentType)) return null;
  try {
    const buffer = await sharp(Buffer.from(data), { animated: contentType === "image/gif" })
      .webp({ quality: 85 })
      .toBuffer();
    return { data: new Uint8Array(buffer), contentType: "image/webp" };
  } catch {
    // 损坏图片 / 不支持的编码 → 降级，用原始数据。
    return null;
  }
}
