/**
 * 把正文里残留的 blob URL（`/blobs/<key>` 或带 publicBaseUrl 前缀）反解析成
 * 后端无关的稳定引用 `amber-asset:<key>`。
 *
 * 背景：历史 capture 的 content 把最终 URL 焊死（如 `/blobs/captures/c1/0.png`），
 * 换后端/迁移后链接失效。新版 import 已改存 `amber-asset:<key>`，渲染时由 urlFor 解析。
 * 本函数处理存量数据，让它与新格式对齐。
 *
 * 已是 `amber-asset:` 形态的不再改动；非 blob 路径的完整 URL（外链）原样保留。
 */

/**
 * 已知的 URL 前缀 → 剥皮后得到 key 的规则。
 * `/blobs/` 是 FileBlobStore 的相对前缀；publicBaseUrl 形式由调用方传入。
 */
const BLOB_PREFIXES = ["/blobs/"];

export interface MigrationStats {
  changed: number;
  unchanged: number;
  refsRewritten: number;
}

/**
 * 把一段 content 里的 blob URL 反解析成 amber-asset:<key>。
 * 额外的 publicBaseUrls（如 "http://localhost:7788"）会拼成 `${base}/blobs/` 形态匹配。
 * 返回 { content, changed }。
 */
export function rewriteBlobRefs(
  content: string,
  publicBaseUrls: string[] = [],
): { content: string; refsRewritten: number } {
  if (!content.includes("/blobs/")) return { content, refsRewritten: 0 };

  const prefixes = [...BLOB_PREFIXES, ...publicBaseUrls.map((b) => `${b.replace(/\/$/, "")}/blobs/`)];
  const pattern = new RegExp(
    `(${prefixes.map((p) => escapeRegExp(p)).join("|")})(captures/[^\\s)"']+\\.[a-z0-9]+)`,
    "gi",
  );

  let refsRewritten = 0;
  const rewritten = content.replace(pattern, (_m, _prefix, key: string) => {
    refsRewritten += 1;
    return `amber-asset:${key}`;
  });
  return { content: rewritten, refsRewritten };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 批量迁移：传入 [{id, content}]，返回迁移后的副本 + 统计。
 * 纯函数，不写文件，便于测试和 dry-run。
 */
export function migrateCaptureList(
  captures: { id: string; content: string }[],
  publicBaseUrls: string[] = [],
): { results: { id: string; content: string }[]; stats: MigrationStats } {
  let changed = 0;
  let unchanged = 0;
  let refsRewritten = 0;
  const results = captures.map((c) => {
    const { content, refsRewritten: r } = rewriteBlobRefs(c.content, publicBaseUrls);
    if (r > 0) {
      changed += 1;
      refsRewritten += r;
    } else {
      unchanged += 1;
    }
    return { id: c.id, content };
  });
  return { results, stats: { changed, unchanged, refsRewritten } };
}
