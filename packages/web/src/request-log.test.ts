import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler, formatErrorLine, formatRequestLine, requestLogger } from "./request-log.js";

describe("formatRequestLine", () => {
  it("formats a single line with iso timestamp", () => {
    const line = formatRequestLine("GET", "/captures/abc", 200, 12, new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toBe("[2026-06-07T09:50:12.345Z] GET /captures/abc 200 12ms");
  });
  it("handles a 500/0ms line", () => {
    const line = formatRequestLine("POST", "/x/delete", 500, 0, new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toBe("[2026-06-07T09:50:12.345Z] POST /x/delete 500 0ms");
  });
});

describe("formatErrorLine", () => {
  it("includes timestamp, method, path and the error stack", () => {
    const line = formatErrorLine("GET", "/boom", new Error("BOOM"), new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toContain("[2026-06-07T09:50:12.345Z] ERROR GET /boom: ");
    expect(line).toContain("BOOM");
  });
  it("falls back to message when stack is undefined", () => {
    const e = new Error("no-stack");
    e.stack = undefined;
    const line = formatErrorLine("GET", "/x", e, new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toBe("[2026-06-07T09:50:12.345Z] ERROR GET /x: no-stack");
  });
  it("stringifies non-Error throws", () => {
    const line = formatErrorLine("GET", "/x", "oops-string", new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toBe("[2026-06-07T09:50:12.345Z] ERROR GET /x: oops-string");
  });
});

describe("requestLogger + errorHandler (real Hono)", () => {
  const fixed = () => new Date("2026-06-07T09:50:12.345Z");
  afterEach(() => { vi.restoreAllMocks(); });

  function makeApp() {
    const app = new Hono();
    app.use(requestLogger(fixed));
    app.onError(errorHandler(fixed));
    app.get("/ok", (c) => c.text("ok"));
    app.get("/boom", () => { throw new Error("BOOM"); });
    app.get("/forbidden", () => { throw new HTTPException(403); });
    return app;
  }

  it("logs a request line for a successful request", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await makeApp().request("/ok");
    expect(res.status).toBe(200);
    expect(log.mock.calls.map((c) => String(c[0])).join("\n")).toContain("GET /ok 200");
  });

  it("logs error stack AND a 500 request line for a throwing route", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await makeApp().request("/boom");
    expect(res.status).toBe(500);
    expect(err.mock.calls.map((c) => String(c[0])).join("\n")).toContain("ERROR GET /boom: ");
    expect(log.mock.calls.map((c) => String(c[0])).join("\n")).toContain("GET /boom 500");
  });

  it("preserves HTTPException status code instead of 500", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await makeApp().request("/forbidden");
    expect(res.status).toBe(403);
    expect(err.mock.calls.map((c) => String(c[0])).join("\n")).toContain("ERROR GET /forbidden");
    expect(log.mock.calls.map((c) => String(c[0])).join("\n")).toContain("GET /forbidden 403");
  });
});
