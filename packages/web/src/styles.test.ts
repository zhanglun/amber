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

  it("includes list item delete action styles", () => {
    const css = getStyles();
    expect(css).toContain(".item-main");
    expect(css).toContain(".delete-form");
    expect(css).toContain(".delete-btn");
    expect(css).toContain(".delete-btn:hover");
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

  it("animates the sticky header title and respects reduced motion", () => {
    const css = getStyles();
    expect(css).toContain(".article-topbar-title");
    expect(css).toContain("opacity: 0");
    expect(css).toContain("transform: translateY(4px)");
    expect(css).toContain(".article-topbar.title-visible .article-topbar-title");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("transition: none");
  });
});

describe("reading enhancement styles", () => {
  it("includes read progress bar styles", () => {
    expect(getStyles()).toContain(".read-progress-bar");
    expect(getStyles()).toContain(".read-progress-fill");
  });

  it("includes copy button styles", () => {
    expect(getStyles()).toContain(".copy-btn");
    expect(getStyles()).toContain(".code-lang");
    expect(getStyles()).toContain(".code-block");
  });

  it("includes font control styles", () => {
    expect(getStyles()).toContain(".font-ctrl");
    expect(getStyles()).toContain(".font-btn");
  });

  it("includes scroll-to-top button styles", () => {
    expect(getStyles()).toContain(".scroll-top-btn");
  });

  it("includes article footer nav styles", () => {
    expect(getStyles()).toContain(".article-footer");
    expect(getStyles()).toContain(".nav-card");
  });

  it("includes read indicator styles for list page", () => {
    expect(getStyles()).toContain(".read-indicator");
  });

  it("includes meta-remaining style", () => {
    expect(getStyles()).toContain(".meta-remaining");
  });

  it("includes toc active item style", () => {
    expect(getStyles()).toContain(".toc-item.active");
  });

  it("uses font-size-article variable on article content", () => {
    expect(getStyles()).toContain("--font-size-article");
  });
});
