import { describe, expect, it, vi } from "vitest";
import type { Capture } from "@amber/domain";
import { runTagAdd, runTagLs, runTagRm } from "./tag.js";

const cap: Capture = {
  id: "c1", title: "T", content: "body", sourceUrl: "https://x/a",
  sourceType: "url", capturedAt: "2026-01-01T00:00:00.000Z", tags: ["react", "ui"],
};

function fakeReadService(found = true) {
  return {
    get: vi.fn(async (id: string) => (found && id === "c1" ? cap : null)),
    updateTags: vi.fn(async () => {}),
  };
}

describe("runTagLs", () => {
  it("returns current tags", async () => {
    const svc = fakeReadService();
    expect(await runTagLs(svc as never, "c1")).toEqual({ ok: true, tags: ["react", "ui"] });
  });
  it("errors on unknown id", async () => {
    const svc = fakeReadService(false);
    const res = await runTagLs(svc as never, "nope");
    expect(res.ok).toBe(false);
  });
});

describe("runTagAdd", () => {
  it("appends new tags and dedups via normalize", async () => {
    const svc = fakeReadService();
    const res = await runTagAdd(svc as never, "c1", ["ai", "react"]);
    expect(svc.updateTags).toHaveBeenCalledWith("c1", ["react", "ui", "ai"]);
    expect(res).toEqual({ ok: true, tags: ["react", "ui", "ai"] });
  });
  it("errors on unknown id without writing", async () => {
    const svc = fakeReadService(false);
    const res = await runTagAdd(svc as never, "nope", ["x"]);
    expect(res.ok).toBe(false);
    expect(svc.updateTags).not.toHaveBeenCalled();
  });
});

describe("runTagRm", () => {
  it("removes the given tags", async () => {
    const svc = fakeReadService();
    const res = await runTagRm(svc as never, "c1", ["ui"]);
    expect(svc.updateTags).toHaveBeenCalledWith("c1", ["react"]);
    expect(res).toEqual({ ok: true, tags: ["react"] });
  });
  it("errors on unknown id without writing", async () => {
    const svc = fakeReadService(false);
    const res = await runTagRm(svc as never, "nope", ["x"]);
    expect(res.ok).toBe(false);
    expect(svc.updateTags).not.toHaveBeenCalled();
  });
});
