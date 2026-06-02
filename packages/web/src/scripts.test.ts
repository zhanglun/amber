import { describe, expect, it } from "vitest";
import { getThemeSwitcherHtml, getThemeScriptHtml } from "./scripts.js";

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
