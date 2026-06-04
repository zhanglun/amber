import { describe, expect, it } from "vitest";
import {
  getThemeSwitcherHtml,
  getThemeScriptHtml,
  getSearchBarHtml,
  getListFilterScriptHtml,
  getReaderHeaderScriptHtml,
  getDeleteConfirmScriptHtml,
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
