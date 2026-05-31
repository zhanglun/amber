import { capture as dinoCapture, type CaptureResult } from "dino";
import type { Asset, RawCapture, Source } from "@amber/domain";

/**
 * 把 dino 的 CaptureResult 转成 amber 的 RawCapture。
 * dino 的图片引用是本地路径（assets/image-001.png）；amber 用占位符（amber-asset:N）。
 * 只替换 markdown 链接/图片语法 `](path)` 内的路径，避免误伤正文。
 */
export function toRawCapture(result: CaptureResult): RawCapture {
  let markdown = result.markdown;
  const assets: Asset[] = result.assets.map((a, i) => {
    const placeholder = `amber-asset:${i}`;
    markdown = markdown.split(`](${a.path})`).join(`](${placeholder})`);
    return { placeholder, data: a.data, contentType: a.contentType };
  });
  return {
    title: result.title,
    markdown,
    author: result.author,
    publishedAt: result.publishedAt,
    assets,
  };
}

/** 采集来源：用 dino 抓取并归一为 RawCapture。 */
export class DinoSource implements Source {
  async capture(input: string): Promise<RawCapture> {
    const result = await dinoCapture(input);
    return toRawCapture(result);
  }
}
