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

  it("includes search bar and group label styles", () => {
    const css = getStyles();
    expect(css).toContain(".header-right");
    expect(css).toContain(".search-bar");
    expect(css).toContain(".group-label");
    expect(css).toContain(".count");
  });

  it("includes focused reader, toc, and video embed styles", () => {
    const css = getStyles();
    expect(css).toContain(".article-shell");
    expect(css).toContain(".article-layout");
    expect(css).toContain(".toc");
    expect(css).toContain(".toc-mobile");
    expect(css).toContain(".video-embed");
    expect(css).toContain(".video-embed video");
  });

  it("keeps article content centered while floating the toc on the left", () => {
    const css = getStyles();
    expect(css).toContain(".article-layout { width: 100%; padding: 2rem 1rem 4rem;");
    expect(css).toContain(".article-main { max-width: var(--max-width); margin: 0 auto;");
    expect(css).toContain(".toc { position: fixed;");
    expect(css).toContain("left: max(1rem, calc((100vw - var(--max-width)) / 2 - 260px))");
    expect(css).not.toContain("grid-column: 3");
  });
});
