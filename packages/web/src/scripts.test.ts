import { describe, expect, it } from "vitest";
import {
  getThemeSwitcherHtml,
  getThemeScriptHtml,
  getSearchBarHtml,
  getListFilterScriptHtml,
  getReaderHeaderScriptHtml,
  getDeleteConfirmScriptHtml,
  calcReadProgress,
  calcRemainingMinutes,
  getReaderEnhancementsScriptHtml,
  getReadIndicatorScriptHtml,
  tagFilterMatch,
  getTagEditorScriptHtml,
} from "./scripts.js";

describe("getThemeSwitcherHtml", () => {
  it("includes buttons for all four themes", () => {
    const html = getThemeSwitcherHtml();
    expect(html).toContain('data-theme="minimal"');
    expect(html).toContain('data-theme="warm"');
    expect(html).toContain('data-theme="modern"');
    expect(html).toContain('data-theme="dark"');
  });

  it("buttons call setTheme on click", () => {
    expect(getThemeSwitcherHtml()).toContain("setTheme");
  });
});

describe("getThemeScriptHtml", () => {
  it("reads and applies theme from localStorage", () => {
    const script = getThemeScriptHtml();
    expect(script).toContain("localStorage");
    expect(script).toContain("amber-theme");
    expect(script).toContain("data-theme");
  });

  it("defines setTheme globally", () => {
    expect(getThemeScriptHtml()).toContain("setTheme");
  });
});

describe("getSearchBarHtml", () => {
  it("contains search input with id and type", () => {
    const html = getSearchBarHtml();
    expect(html).toContain('id="search"');
    expect(html).toContain('type="search"');
  });

  it("wraps input in search-bar div", () => {
    expect(getSearchBarHtml()).toContain('class="search-bar"');
  });
});

describe("getListFilterScriptHtml", () => {
  it("filters items by data-title and data-host", () => {
    const script = getListFilterScriptHtml();
    expect(script).toContain("data-title");
    expect(script).toContain("data-host");
  });

  it("toggles group visibility via data-group", () => {
    expect(getListFilterScriptHtml()).toContain("data-group");
  });

  it("updates count element", () => {
    expect(getListFilterScriptHtml()).toContain(".count");
  });

  it("reads item tags and tag-filter chips", () => {
    const html = getListFilterScriptHtml();
    expect(html).toContain("data-tags");
    expect(html).toContain("tag-filter");
  });
});

describe("getReaderHeaderScriptHtml", () => {
  it("uses IntersectionObserver to show the title after the article h1 leaves view", () => {
    const script = getReaderHeaderScriptHtml();
    expect(script).toContain("IntersectionObserver");
    expect(script).toContain(".article-title-anchor");
    expect(script).toContain("title-visible");
    expect(script).toContain("isIntersecting");
  });
});

describe("getDeleteConfirmScriptHtml", () => {
  it("confirms capture deletion before submitting delete forms", () => {
    const script = getDeleteConfirmScriptHtml();
    expect(script).toContain(".delete-form");
    expect(script).toContain("confirm");
    expect(script).toContain("preventDefault");
    expect(script).toContain("data-title");
  });
});

describe("calcReadProgress", () => {
  it("returns 0 at the top", () => {
    expect(calcReadProgress(0, 1000, 500)).toBe(0);
  });

  it("returns 100 at the bottom", () => {
    expect(calcReadProgress(500, 1000, 500)).toBe(100);
  });

  it("returns 50 at midpoint", () => {
    expect(calcReadProgress(250, 1000, 500)).toBe(50);
  });

  it("returns 0 when page fits in viewport", () => {
    expect(calcReadProgress(0, 400, 500)).toBe(0);
  });

  it("clamps to 100 when scrolled past bottom (over-scroll)", () => {
    expect(calcReadProgress(600, 1000, 500)).toBe(100);
  });
});

describe("calcRemainingMinutes", () => {
  it("returns full time at 0 progress", () => {
    expect(calcRemainingMinutes(600, 0)).toBe(2);
  });

  it("returns 0 at 100 progress", () => {
    expect(calcRemainingMinutes(600, 100)).toBe(0);
  });

  it("returns half at 50 progress", () => {
    expect(calcRemainingMinutes(600, 50)).toBe(1);
  });

  it("returns 0 for empty content", () => {
    expect(calcRemainingMinutes(0, 0)).toBe(0);
  });
});

describe("getReaderEnhancementsScriptHtml", () => {
  it("contains progress bar logic", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("read-progress-fill");
  });

  it("uses requestAnimationFrame for scroll throttle", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("requestAnimationFrame");
  });

  it("handles font size via localStorage", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("amber-font-size");
  });

  it("injects copy buttons into pre elements", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("copy-btn");
  });

  it("saves progress to PATCH endpoint", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("/read");
    expect(getReaderEnhancementsScriptHtml()).toContain("PATCH");
  });

  it("reads data-nav attributes for keyboard shortcuts", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain('data-nav="prev"');
    expect(getReaderEnhancementsScriptHtml()).toContain('data-nav="next"');
  });

  it("updates meta-remaining element", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("meta-remaining");
  });

  it("shows scroll-top-btn after threshold", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("scroll-top-btn");
  });

  it("updates toc active class on scroll", () => {
    expect(getReaderEnhancementsScriptHtml()).toContain("toc-item");
    expect(getReaderEnhancementsScriptHtml()).toContain("active");
  });
});

describe("getReadIndicatorScriptHtml", () => {
  it("reads data-read-progress from list items", () => {
    expect(getReadIndicatorScriptHtml()).toContain("data-read-progress");
  });

  it("reads data-read-at from list items", () => {
    expect(getReadIndicatorScriptHtml()).toContain("data-read-at");
  });

  it("adds read-indicator element", () => {
    expect(getReadIndicatorScriptHtml()).toContain("read-indicator");
  });

  it("applies title-read class for read captures", () => {
    expect(getReadIndicatorScriptHtml()).toContain("title-read");
  });
});

describe("tagFilterMatch", () => {
  it("passes when no query and no active tags", () => {
    expect(tagFilterMatch(["react"], [], "", "Some Title", "example.com")).toBe(true);
  });

  it("matches active tag by exact membership (OR)", () => {
    expect(tagFilterMatch(["react", "ui"], ["ai", "ui"], "", "T", "h")).toBe(true);
    expect(tagFilterMatch(["react"], ["ai", "ui"], "", "T", "h")).toBe(false);
  });

  it("does not substring-match tags (re does not match react)", () => {
    expect(tagFilterMatch(["react"], ["re"], "", "T", "h")).toBe(false);
  });

  it("matches query as substring of title or host (case-insensitive)", () => {
    expect(tagFilterMatch([], [], "wiki", "A Wikipedia Page", "x.com")).toBe(true);
    expect(tagFilterMatch([], [], "example", "T", "example.com")).toBe(true);
    expect(tagFilterMatch([], [], "zzz", "T", "h")).toBe(false);
  });

  it("requires BOTH query and active tag to pass (AND)", () => {
    expect(tagFilterMatch(["react"], ["react"], "nomatch", "T", "h")).toBe(false);
    expect(tagFilterMatch(["react"], ["react"], "title", "Title", "h")).toBe(true);
  });
});

describe("getTagEditorScriptHtml", () => {
  it("PATCHes the tags endpoint", () => {
    const html = getTagEditorScriptHtml();
    expect(html).toContain("/tags");
    expect(html).toContain("PATCH");
  });
  it("handles add and remove controls", () => {
    const html = getTagEditorScriptHtml();
    expect(html).toContain("tag-add");
    expect(html).toContain("tag-remove");
  });
});
