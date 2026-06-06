import { describe, expect, it } from "vitest";
import { normalizeTags } from "./tags.js";

describe("normalizeTags", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeTags(["  react  ", "vue"])).toEqual(["react", "vue"]);
  });

  it("drops empty and whitespace-only entries", () => {
    expect(normalizeTags(["a", "", "   ", "b"])).toEqual(["a", "b"]);
  });

  it("dedups keeping first occurrence", () => {
    expect(normalizeTags(["a", "b", "a"])).toEqual(["a", "b"]);
  });

  it("is case-sensitive (React and react are distinct)", () => {
    expect(normalizeTags(["React", "react"])).toEqual(["React", "react"]);
  });

  it("returns empty array for empty input", () => {
    expect(normalizeTags([])).toEqual([]);
  });
});
