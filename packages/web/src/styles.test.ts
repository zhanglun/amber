import { describe, expect, it } from "vitest";
import { getStyles } from "./styles.js";

describe("getStyles", () => {
  it("includes CSS custom properties for all four themes", () => {
    const css = getStyles();
    expect(css).toContain("--bg");
    expect(css).toContain('[data-theme="warm"]');
    expect(css).toContain('[data-theme="modern"]');
    expect(css).toContain('[data-theme="dark"]');
  });

  it("includes shiki dual-theme display rules", () => {
    const css = getStyles();
    expect(css).toContain(".shiki.github-dark");
    expect(css).toContain('[data-theme="dark"] .shiki.github-light');
  });

  it("sets max-width for reading layout", () => {
    expect(getStyles()).toContain("--max-width: 680px");
  });
});
