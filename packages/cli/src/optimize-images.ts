/**
 * 存量图片迁移到 webp 的纯逻辑（不含文件 IO，便于测试）。
 *
 * 命令层（optimize-images.ts command）负责：读本地 blob 文件 → 调 optimizeImage
 * 转码 → 写新 .webp 文件 → 用本模块的 rewriteAssetRefs 更新正文引用。
 *
 * 这里只处理「正文引用怎么从 .png/.jpg/.gif 改成 .webp」的规则。
 */

/** amber-asset 引用里，可被转成 webp 的源扩展名。webp/svg/mp4 等跳过。 */
const CONVERTIBLE_EXT = new Set(["png", "jpg", "jpeg", "gif"]);

const ASSET_REF_RE = /amber-asset:(captures\/[^\s)"']+\.(png|jpg|jpeg|gif))/gi;

export interface RefRewrite {
  /** 原 key（如 captures/c1/0.png）。 */
  oldKey: string;
  /** 新 key（如 captures/c1/0.webp）。 */
  newKey: string;
}

/**
 * 扫描正文，返回所有可转换的 amber-asset 引用及其 webp 化后的新 key。
 * 不修改正文；命令层拿到结果后决定如何应用。
 */
export function findConvertibleRefs(content: string): RefRewrite[] {
  const result: RefRewrite[] = [];
  for (const m of content.matchAll(ASSET_REF_RE)) {
    const oldKey = m[1];
    const dotIdx = oldKey.lastIndexOf(".");
    const newKey = `${oldKey.slice(0, dotIdx)}.webp`;
    result.push({ oldKey, newKey });
  }
  return result;
}

/**
 * 把正文里的可转换 amber-asset 引用重写成 .webp 形态。
 * 返回 { content, count }。已是 webp/svg 的不受影响。
 */
export function rewriteAssetRefs(content: string): { content: string; count: number } {
  let count = 0;
  const rewritten = content.replace(ASSET_REF_RE, (_m, key: string) => {
    count += 1;
    const dotIdx = key.lastIndexOf(".");
    return `amber-asset:${key.slice(0, dotIdx)}.webp`;
  });
  return { content: rewritten, count };
}

/** 判断一个 blob key（从扩展名）是否是可转换的图片。 */
export function isConvertibleImageKey(key: string): boolean {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return CONVERTIBLE_EXT.has(ext);
}
