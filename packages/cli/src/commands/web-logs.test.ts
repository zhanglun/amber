import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, afterEach, beforeEach } from "vitest";
import {
  cleanupExpiredLogs, dateStamp, expiredLogFiles, lastLines,
  logFileName, pickLatestLogFile, readLog, shouldRotate,
} from "./web-logs.js";

describe("dateStamp", () => {
  it("formats local date as YYYY-MM-DD", () => {
    expect(dateStamp(new Date(2026, 5, 7))).toBe("2026-06-07");
    expect(dateStamp(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

describe("logFileName", () => {
  it("builds web-<date>.log", () => {
    expect(logFileName(new Date(2026, 5, 7))).toBe("web-2026-06-07.log");
  });
});

describe("pickLatestLogFile", () => {
  it("returns the most recent matching file", () => {
    const files = ["web-2026-06-05.log", "web-2026-06-07.log", "web-2026-06-06.log"];
    expect(pickLatestLogFile(files)).toBe("web-2026-06-07.log");
  });
  it("ignores non-matching files", () => {
    expect(pickLatestLogFile([".web.pid", "notes.txt", "web-2026-06-01.log"])).toBe("web-2026-06-01.log");
  });
  it("returns null when there are no log files", () => {
    expect(pickLatestLogFile([".web.pid", "other.log"])).toBeNull();
  });
});

describe("shouldRotate", () => {
  it("is false on the same calendar day", () => {
    expect(shouldRotate(new Date(2026, 5, 7, 1), new Date(2026, 5, 7, 23))).toBe(false);
  });
  it("is true across days", () => {
    expect(shouldRotate(new Date(2026, 5, 7, 23), new Date(2026, 5, 8, 0))).toBe(true);
  });
});

describe("expiredLogFiles", () => {
  const files = ["web-2026-05-31.log", "web-2026-06-01.log", "web-2026-06-07.log", "keep.txt"];
  it("returns files older than keepDays before today", () => {
    // today=2026-06-08, keepDays=7 -> cutoff=2026-06-01, expire dates < 2026-06-01
    expect(expiredLogFiles(files, new Date(2026, 5, 8), 7)).toEqual(["web-2026-05-31.log"]);
  });
  it("keeps the cutoff date itself (boundary)", () => {
    expect(expiredLogFiles(["web-2026-06-01.log"], new Date(2026, 5, 8), 7)).toEqual([]);
  });
  it("ignores non-log files", () => {
    expect(expiredLogFiles(["keep.txt"], new Date(2026, 5, 8), 7)).toEqual([]);
  });
});

describe("lastLines", () => {
  it("returns the last n lines", () => {
    expect(lastLines("a\nb\nc\nd", 2)).toBe("c\nd");
  });
  it("drops a single trailing newline before counting", () => {
    expect(lastLines("a\nb\nc\n", 2)).toBe("b\nc");
  });
  it("returns all lines when fewer than n", () => {
    expect(lastLines("a\nb", 10)).toBe("a\nb");
  });
  it("returns empty string for empty input", () => {
    expect(lastLines("", 5)).toBe("");
  });
  it("strips all trailing newlines", () => {
    expect(lastLines("\n", 5)).toBe("");
  });
});

describe("readLog (real fs)", () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "amber-weblogs-")); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it("returns null when logs dir is absent", () => {
    expect(readLog(dir, 200)).toBeNull();
  });

  it("reads last n lines of the latest log file", async () => {
    const logs = join(dir, "logs");
    await mkdir(logs, { recursive: true });
    await writeFile(join(logs, "web-2026-06-06.log"), "old\n");
    await writeFile(join(logs, "web-2026-06-07.log"), "l1\nl2\nl3\n");
    expect(readLog(dir, 2)).toBe("l2\nl3");
  });
});

describe("cleanupExpiredLogs (real fs)", () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), "amber-weblogs-")); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it("deletes only expired log files", async () => {
    const logs = join(dir, "logs");
    await mkdir(logs, { recursive: true });
    await writeFile(join(logs, "web-2026-05-31.log"), "x");
    await writeFile(join(logs, "web-2026-06-07.log"), "x");
    cleanupExpiredLogs(dir, new Date(2026, 5, 8), 7);
    expect((await readdir(logs)).sort()).toEqual(["web-2026-06-07.log"]);
  });

  it("does not throw when logs dir is absent", () => {
    expect(() => cleanupExpiredLogs(join(dir, "nope"), new Date(2026, 5, 8), 7)).not.toThrow();
  });
});
