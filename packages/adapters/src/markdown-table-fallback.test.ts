import { describe, expect, it } from "vitest";
import { convertResidualTables } from "./markdown-table-fallback.js";

describe("convertResidualTables", () => {
  it("returns markdown unchanged when there is no table", () => {
    const md = "# Title\n\nsome text with | pipe\n\n[link](https://x.com)";
    expect(convertResidualTables(md)).toBe(md);
  });

  it("converts a multi-row headerless table to a GFM pipe table", () => {
    const md =
      `<table><tbody><tr><td>序号</td><td>标题</td></tr>` +
      `<tr><td>1</td><td>破题</td></tr></tbody></table>`;
    const out = convertResidualTables(md);
    expect(out).toContain("| 序号 | 标题 |");
    expect(out).toContain("| --- | --- |");
    expect(out).toContain("| 1 | 破题 |");
    expect(out).not.toContain("<table");
  });

  it("flattens a single-row table to a paragraph", () => {
    const md = `<table><tbody><tr><td>1</td><td>破题：一个反直觉的事实</td></tr></tbody></table>`;
    const out = convertResidualTables(md);
    expect(out).not.toContain("<table");
    expect(out).not.toMatch(/\| ---/);
    expect(out).toContain("1");
    expect(out).toContain("破题：一个反直觉的事实");
  });

  it("strips inline styles and nested tags from a real WeChat layout table", () => {
    const md =
      `<table><tbody style="visibility: visible;"><tr style="visibility: visible;">` +
      `<td data-colwidth="77" style="padding-right: 12px;"><span leaf="">1</span></td>` +
      `<td style="vertical-align: middle;"><span style="font-weight: 700;"><span leaf="">破题：一个反直觉的事实</span></span></td>` +
      `</tr></tbody></table>`;
    const out = convertResidualTables(md);
    expect(out).not.toContain("<table");
    expect(out).not.toContain("style=");
    expect(out).toContain("破题：一个反直觉的事实");
  });

  it("preserves amber-asset placeholders inside cells", () => {
    // Markdown image/ link syntax survives because we only strip HTML tags,
    // not the `](amber-asset:N)` substring.
    const md =
      `<table><tbody><tr><td>封面</td><td>![cover](amber-asset:0)</td></tr>` +
      `<tr><td>1</td><td>![pic](amber-asset:1)</td></tr></tbody></table>`;
    const out = convertResidualTables(md);
    expect(out).toContain("amber-asset:0");
    expect(out).toContain("amber-asset:1");
    expect(out).not.toContain("<table");
  });

  it("escapes pipe characters inside cells", () => {
    const md =
      `<table><tbody><tr><td>a|b</td><td>c</td></tr>` +
      `<tr><td>1</td><td>2</td></tr></tbody></table>`;
    const out = convertResidualTables(md);
    expect(out).toContain("a\\|b");
    expect(out).not.toMatch(/a\|b(?!\\)/); // unescaped a|b must not appear
  });

  it("converts multiple tables in one markdown string", () => {
    const md =
      `<table><tbody><tr><td>1</td><td>a</td></tr></tbody></table>\n\n` +
      `middle text\n\n` +
      `<table><tbody><tr><td>h</td></tr><tr><td>1</td></tr><tr><td>2</td></tr></tbody></table>`;
    const out = convertResidualTables(md);
    expect(out).not.toContain("<table");
    expect(out).toContain("middle text");
    expect(out).toContain("| h |");
    expect(out).toContain("| 1 |");
    expect(out).toContain("| 2 |");
  });

  it("degrades to plain text when the table has no parseable rows", () => {
    const md = `<table><tbody>no rows here</tbody></table>`;
    const out = convertResidualTables(md);
    expect(out).not.toContain("<table");
    expect(out).toContain("no rows here");
  });
});
