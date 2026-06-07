import { describe, expect, it } from "vitest";
import { formatErrorLine, formatRequestLine } from "./request-log.js";

describe("formatRequestLine", () => {
  it("formats a single line with iso timestamp", () => {
    const line = formatRequestLine("GET", "/captures/abc", 200, 12, new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toBe("[2026-06-07T09:50:12.345Z] GET /captures/abc 200 12ms");
  });
});

describe("formatErrorLine", () => {
  it("includes timestamp, method, path and the error stack", () => {
    const line = formatErrorLine("GET", "/boom", new Error("BOOM"), new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toContain("[2026-06-07T09:50:12.345Z] ERROR GET /boom: ");
    expect(line).toContain("BOOM");
  });
  it("stringifies non-Error throws", () => {
    const line = formatErrorLine("GET", "/x", "oops-string", new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toBe("[2026-06-07T09:50:12.345Z] ERROR GET /x: oops-string");
  });
});
