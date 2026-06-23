import { capture as dinoCapture, type CaptureResult } from "dino";
import type { Asset, RawCapture, Source } from "@amber/domain";
import { convertResidualTables } from "./markdown-table-fallback.js";

/**
 * 把 dino 的 CaptureResult 转成 amber 的 RawCapture。
 * dino 的图片引用是本地路径（assets/image-001.png）；amber 用占位符（amber-asset:N）。
 * 只替换 markdown 链接/图片语法 `](path)` 内的路径，避免误伤正文。
 *
 * asset 占位符替换之后再兜底转换残留的 `<table>` HTML：dino 对无表头 table
 * 已尽力转换，但仍可能残留（如旧版本 capture）；amber web 端禁用内联 HTML，
 * 残留 table 会被当字符串转义，所以这里扫一遍，多行转 pipe table、单行拍平。
 */
export function toRawCapture(result: CaptureResult): RawCapture {
  let markdown = result.markdown;
  const assets: Asset[] = result.assets.map((a, i) => {
    const placeholder = `amber-asset:${i}`;
    markdown = markdown.split(`](${a.path})`).join(`](${placeholder})`);
    return { placeholder, data: a.data, contentType: a.contentType };
  });
  markdown = convertResidualTables(markdown);
  return {
    title: result.title,
    markdown,
    author: result.author,
    publishedAt: result.publishedAt,
    coverImage: result.coverImage,
    assets,
  };
}

/**
 * 判断 dino 的失败信息是否涉及一次浏览器尝试。
 * dino 在 auto/browser/stealth 模式下，各次尝试失败会拼成 `"<label> failed: ..."`
 * （label 取自 strategy.ts：browser / stealth / browser-state）。出现这些即说明
 * 走到了需要 Chromium 的路径——纯静态失败只会有 "static ..."，不会命中。
 */
export function mentionsBrowserAttempt(message: string): boolean {
  return /(browser|stealth|browser-state) failed/i.test(message);
}

const DOCTOR_HINT =
  "提示：目标站点可能需要浏览器渲染，而 Chromium 可能未安装。运行 `amber doctor` 安装后重试。";

/**
 * 为抓取失败信息补充可读引导：仅当失败涉及浏览器尝试时，追加 `amber doctor` 提示，
 * 且始终保留原始错误信息（不隐藏、不改写），避免丢失诊断线索。
 */
export function explainCaptureError(message: string): string {
  return mentionsBrowserAttempt(message) ? `${message}\n\n${DOCTOR_HINT}` : message;
}

/** 采集来源：用 dino 抓取并归一为 RawCapture。 */
export class DinoSource implements Source {
  async capture(input: string): Promise<RawCapture> {
    try {
      const result = await dinoCapture(input);
      return toRawCapture(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(explainCaptureError(message));
    }
  }
}
