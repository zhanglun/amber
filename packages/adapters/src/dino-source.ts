import { capture as dinoCapture, type CaptureResult } from "dino";
import type { Asset, RawCapture, Source } from "@amber/domain";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { parseHTML } from "linkedom";
import { convertResidualTables } from "./markdown-table-fallback.js";

// dino 的 CaptureOptions 类型未暴露 realChromeDefaults，但内部 FetchHtmlOptions
// 支持该字段（capture() 通过 { ...options } 透传）。补全类型声明，避免类型断言。
declare module "dino" {
  interface CaptureOptions {
    realChromeDefaults?: boolean;
  }
}

// 微信内置浏览器 UA——mpvideo.qpic.cn / mmbiz.qpic.cn 等微信 CDN 防盗链
// 校验 User-Agent，Node.js 默认 UA 会被拒（403）。
const WECHAT_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40(0x18002831) NetType/WIFI Language/zh_CN";

function isWechatUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith("weixin.qq.com") || host.endsWith("qpic.cn");
  } catch {
    return false;
  }
}

// dino 默认 fetchImage 只设 Referer 不设 UA，微信 CDN 会返回 403。
function createWechatFetchImage(referer: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("Referer", referer);
    headers.set("User-Agent", WECHAT_UA);
    return fetch(input, { ...init, headers });
  };
}

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

// 兜底抓取用的桌面 UA——与 dino static 抓取对齐，避免被站点判为 bot。
const FALLBACK_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// readability 输出 HTML，需转 markdown 与 dino 输出格式对齐（amber web 端 markdown-it
// 用 html:false，会禁用/转义内联 HTML）。turndown 配置与 dino 风格保持一致。
function makeTurndown(): TurndownService {
  return new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
  });
}

/**
 * readability 兜底：当 dino（defuddle）对某些 SSR 页面提取出空内容时，
 * 用 @mozilla/readability 对同一份 HTML 二次提取，转成 markdown。
 *
 * 关键技巧：readability 默认全文模式会误把侧边栏/页脚当主内容（innei.in 实测
 * 抓到全站导航噪音）。因此先 querySelector('article') 限定范围，再把 innerHTML
 * 包进最小文档跑 readability，可稳定拿到干净正文。无 <article> 时退到 body。
 *
 * HTML 来源：兜底时独立 fetch（带桌面 UA）。与 dino 正常抓取路径完全隔离，
 * 仅在 dino 返回空/抛异常时触发，正常情况零开销。
 *
 * 图片策略：兜底模式不下载图片（返回 assets:[]），markdown 里保留原始远程 URL。
 * dino 正常模式才下载图片到 assets 并换占位符；兜底优先保证正文内容不丢。
 *
 * @returns 提取成功返回 RawCapture；fetch 失败/无正文返回 null（由调用方决定回退）
 */
export async function readabilityFallback(
  input: string,
  partial: { title?: string; author?: string; publishedAt?: string; coverImage?: string },
): Promise<RawCapture | null> {
  let resp: Response;
  try {
    resp = await fetch(input, { redirect: "follow", headers: { "User-Agent": FALLBACK_UA } });
  } catch {
    return null;
  }
  if (!resp.ok) return null;
  const html = await resp.text();

  const { document } = parseHTML(html);
  // 优先 <article>，其次 <main>，最后 body；限定范围避免 readability 吸入全站噪音。
  const root = document.querySelector("article") ?? document.querySelector("main") ?? document.body;
  if (!root) return null;

  // 包进最小文档跑 readability：linkedom 的 document 已实测可驱动 readability。
  const scoped = parseHTML(`<html><body>${root.innerHTML}</body></html>`).document;
  const article = new Readability(scoped, { charThreshold: 50 }).parse();
  if (!article?.content) return null;

  const markdown = makeTurndown().turndown(article.content).trim();
  if (!markdown) return null;

  const title =
    partial.title ||
    article.title?.trim() ||
    document.querySelector("title")?.textContent?.trim() ||
    "";

  return {
    title,
    markdown,
    author: partial.author,
    publishedAt: partial.publishedAt,
    coverImage: partial.coverImage,
    assets: [],
  };
}

/** 采集来源：用 dino 抓取并归一为 RawCapture。 */
export class DinoSource implements Source {
  async capture(input: string): Promise<RawCapture> {
    let dinoResult: RawCapture | null = null;
    let dinoError: Error | null = null;
    try {
      const result = await dinoCapture(input, {
        realChromeDefaults: true,
        ...(isWechatUrl(input) && { fetchImage: createWechatFetchImage(input) }),
      });
      dinoResult = toRawCapture(result);
    } catch (error) {
      dinoError = error instanceof Error ? error : new Error(String(error));
    }

    // 快路径：dino 提取到非空正文，直接返回（绝大多数站点的正常情况）。
    if (dinoResult && dinoResult.markdown.trim()) {
      return dinoResult;
    }

    // dino 返回空 markdown 或抛异常 → readability 兜底。
    // static HTML 往往已是完整 SSR，defuddle 提取失败时 readability 常能救场。
    const partial: Partial<RawCapture> = dinoResult ?? {};
    const fallback = await readabilityFallback(input, {
      title: partial.title,
      author: partial.author,
      publishedAt: partial.publishedAt,
      coverImage: partial.coverImage,
    });
    if (fallback) {
      return fallback;
    }

    // 兜底也失败：dino 有结果（空 content）就返回它（保留原行为，让上层空判断照常工作）；
    // dino 抛异常则原样抛出，保留 explainCaptureError 的诊断链路。
    if (dinoResult) {
      return dinoResult;
    }
    const message = dinoError?.message ?? "capture failed";
    throw new Error(explainCaptureError(message));
  }
}
