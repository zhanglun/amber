/**
 * 兜底转换：把 markdown 中残留的 `<table>` HTML 转成 GFM pipe table 或段落。
 *
 * 背景：dino 用 turndown-plugin-gfm 转 table，但 gfm 规则要求首行是 <th>。
 * 微信等站点用纯 <td> 的布局 table，gfm 不处理 → 原样 HTML 残留在 markdown 里。
 * amber web 端 markdown-it 用 `html: false`，会把残留 HTML 当字符串转义显示。
 *
 * 本函数在 dino 已尽力转换后做最后一道兜底：消除所有 `<table>` HTML，
 * 多行转 pipe table，单行拍平成段落，解析失败降级为纯文本段落。
 * 绝不保留 `<table>` HTML 字符串。
 *
 * 必须原样保留 `amber-asset:N` 占位符：cell 内容里的 markdown 链接/图片
 * 语法（`![alt](amber-asset:0)`）应保留，因此提取时只剥离 HTML 标签、
 * 保留纯文本与 markdown 语法字符。
 */

const TABLE_RE = /<table\b[^>]*>[\s\S]*?<\/table>/gi;

/** 剥离 HTML 标签，保留内部文本与 markdown 语法字符（如 `]()`、`|` 原样保留后由调用方转义）。 */
function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 把一行 HTML 切成若干 cell 文本（已 stripTags）。 */
function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(rowHtml)) !== null) {
    cells.push(stripTags(m[1]));
  }
  return cells;
}

/** 把一个 `<table>...</table>` 块转成 markdown 文本；无法解析时降级为纯文本段落。 */
function tableToMarkdown(tableHtml: string): string {
  const rows: string[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(tableHtml)) !== null) {
    const cells = extractCells(rm[1]).filter((c) => c.length > 0);
    if (cells.length > 0) rows.push(cells);
  }

  // 降级：解析不出任何行/cell → 拍平整块为段落文本。
  if (rows.length === 0) {
    const text = stripTags(tableHtml);
    return text ? text : "";
  }

  // 单行：布局 table，拍平成段落，cell 用 em-space 连接。
  if (rows.length === 1) {
    return rows[0].join("\u2003");
  }

  // 多行：转 pipe table。列数以最大行为准，短的补空。
  const colCount = Math.max(...rows.map((r) => r.length));
  const escapeCell = (c: string) => c.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const norm = rows.map((r) => {
    const padded = [...r];
    while (padded.length < colCount) padded.push("");
    return padded.slice(0, colCount).map(escapeCell);
  });
  const header = norm[0];
  const body = norm.slice(1);
  const separator = header.map(() => "---");
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...body.map((r) => `| ${r.join(" | ")} |`),
  ];
  return lines.join("\n");
}

/**
 * 扫描 markdown，把每个残留的 `<table>` HTML 块替换为 markdown 文本。
 * 非 table 部分原样返回。
 */
export function convertResidualTables(markdown: string): string {
  if (!/<table\b/i.test(markdown)) return markdown;
  return markdown.replace(TABLE_RE, (tableHtml) => tableToMarkdown(tableHtml));
}
