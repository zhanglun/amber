import { describe, expect, it, vi } from "vitest";
import { formatDoctorResult, type DoctorResult } from "@amber/adapters";
import { runAmberDoctor } from "./doctor.js";

const okResult: DoctorResult = {
  ok: true,
  checks: [{ name: "Patchright Chromium launch", ok: true, message: "launched" }],
};

const failResult: DoctorResult = {
  ok: false,
  checks: [
    { name: "Patchright Chromium installation", ok: false, message: "missing", hint: "Run: npx patchright install chromium" },
  ],
};

describe("runAmberDoctor", () => {
  it("logs the formatted result and returns true when healthy", async () => {
    const log = vi.fn();
    const ok = await runAmberDoctor({ doctor: async () => okResult, log });
    expect(ok).toBe(true);
    expect(log).toHaveBeenCalledWith(formatDoctorResult(okResult));
  });

  it("returns false when a check fails", async () => {
    const log = vi.fn();
    const ok = await runAmberDoctor({ doctor: async () => failResult, log });
    expect(ok).toBe(false);
    expect(log).toHaveBeenCalledWith(formatDoctorResult(failResult));
  });
});
