# amber web 日志查看 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `amber web` 后台进程把运行日志写入按日期拆分的文件，并提供 `amber web logs` 查看（含 `--follow`），本地开发与生产前台共用同一落点。

**Architecture:** 日志写入逻辑放在 `serve()` 内（而非 spawn 层），通过 tee `process.stdout/stderr.write` 把输出同时写到 `<dataDir>/logs/web-YYYY-MM-DD.log`，崩溃路径用同步写入保证落盘。纯函数（文件名/选择/过期/取尾行/轮转判定）抽到独立模块 `web-logs.ts` 并单测；I/O 薄壳与命令接线在 `web.ts`。

**Tech Stack:** TypeScript (ESM), citty (CLI), vitest, node:fs。

**约定：** 提交信息不要包含任何 AI/Claude 署名（遵循仓库全局偏好）。所有命令在仓库根 `/Users/zhanglun/Documents/mine/amber` 下执行。

**关联 spec：** `docs/superpowers/specs/2026-06-06-web-logs-design.md`

---

## File Structure

- `packages/cli/src/commands/web-logs.ts`（新建）：纯函数 + 文件读写 + `installLogging`/`followLog`。单一职责：日志的命名、轮转、读取、tee 安装。
- `packages/cli/src/commands/web-logs.test.ts`（新建）：纯函数与文件读写的单测。
- `packages/cli/src/commands/web.ts`（修改）：`WebRuntime`/`WebActions` 扩展、`serve` 加 `openBrowser` 选项并接入日志、新增 `logs`/`serve` 子命令、`WEB_SUBCOMMANDS` 扩展。
- `packages/cli/src/commands/web.test.ts`（修改）：mock 扩展 + 新行为测试。
- `docs/configuration.md`（修改）：生产部署一节。

---

## Task 1: 日志命名与选择纯函数

**Files:**
- Create: `packages/cli/src/commands/web-logs.ts`
- Test: `packages/cli/src/commands/web-logs.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `packages/cli/src/commands/web-logs.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { dateStamp, logFileName, pickLatestLogFile, shouldRotate } from "./web-logs.js";

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
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm exec vitest run packages/cli/src/commands/web-logs.test.ts`
Expected: FAIL（`Cannot find module './web-logs.js'`）

- [ ] **Step 3: 写最小实现**

创建 `packages/cli/src/commands/web-logs.ts`：

```ts
const LOG_FILE_RE = /^web-(\d{4}-\d{2}-\d{2})\.log$/;

export function dateStamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function logFileName(date: Date): string {
  return `web-${dateStamp(date)}.log`;
}

export function pickLatestLogFile(filenames: string[]): string | null {
  const logs = filenames.filter((f) => LOG_FILE_RE.test(f)).sort();
  return logs.length > 0 ? logs[logs.length - 1] : null;
}

export function shouldRotate(openedDate: Date, now: Date): boolean {
  return dateStamp(openedDate) !== dateStamp(now);
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm exec vitest run packages/cli/src/commands/web-logs.test.ts`
Expected: PASS（8 个用例）

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/commands/web-logs.ts packages/cli/src/commands/web-logs.test.ts
git commit -m "feat(cli): web 日志命名与选择纯函数"
```

---

## Task 2: 过期判定与取尾行纯函数

**Files:**
- Modify: `packages/cli/src/commands/web-logs.ts`
- Test: `packages/cli/src/commands/web-logs.test.ts`

- [ ] **Step 1: 追加失败测试**

在 `web-logs.test.ts` 顶部 import 改为：

```ts
import { dateStamp, expiredLogFiles, lastLines, logFileName, pickLatestLogFile, shouldRotate } from "./web-logs.js";
```

文件末尾追加：

```ts
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
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm exec vitest run packages/cli/src/commands/web-logs.test.ts`
Expected: FAIL（`expiredLogFiles`/`lastLines` 未导出）

- [ ] **Step 3: 写最小实现**

在 `web-logs.ts` 追加（`LOG_FILE_RE` 已存在，复用）：

```ts
export function expiredLogFiles(filenames: string[], today: Date, keepDays: number): string[] {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffStamp = dateStamp(cutoff);
  return filenames.filter((f) => {
    const m = LOG_FILE_RE.exec(f);
    return m !== null && m[1] < cutoffStamp;
  });
}

export function lastLines(text: string, n: number): string {
  const trimmed = text.endsWith("\n") ? text.slice(0, -1) : text;
  if (trimmed === "") return "";
  const lines = trimmed.split("\n");
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm exec vitest run packages/cli/src/commands/web-logs.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/commands/web-logs.ts packages/cli/src/commands/web-logs.test.ts
git commit -m "feat(cli): web 日志过期判定与取尾行纯函数"
```

---

## Task 3: 日志读取与清理（真实文件）

**Files:**
- Modify: `packages/cli/src/commands/web-logs.ts`
- Test: `packages/cli/src/commands/web-logs.test.ts`

- [ ] **Step 1: 追加失败测试**

`web-logs.test.ts` 顶部补 import：

```ts
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";
```

并把现有 `web-logs.js` 的 import 补上 `cleanupExpiredLogs, readLog`：

```ts
import {
  cleanupExpiredLogs, dateStamp, expiredLogFiles, lastLines,
  logFileName, pickLatestLogFile, readLog, shouldRotate,
} from "./web-logs.js";
```

文件末尾追加：

```ts
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
    await writeFile(join(dir, "web-2026-05-31.log"), "x");
    await writeFile(join(dir, "web-2026-06-07.log"), "x");
    cleanupExpiredLogs(dir, new Date(2026, 5, 8), 7);
    expect((await readdir(dir)).sort()).toEqual(["web-2026-06-07.log"]);
  });
});
```

> 注：上面 `readLog` 用例里临时文件那两行只是为了稳妥建目录，可简化——核心断言是最后一行。实现时如果觉得啰嗦，保留 `mkdir(logs)` + 两个 `writeFile` + 断言即可。

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm exec vitest run packages/cli/src/commands/web-logs.test.ts`
Expected: FAIL（`cleanupExpiredLogs`/`readLog` 未导出）

- [ ] **Step 3: 写最小实现**

`web-logs.ts` 顶部加 import，并追加函数：

```ts
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export const LOG_DIR_NAME = "logs";

export function readLog(dataDir: string, lines: number): string | null {
  const logsDir = join(dataDir, LOG_DIR_NAME);
  let names: string[];
  try {
    names = readdirSync(logsDir);
  } catch {
    return null;
  }
  const latest = pickLatestLogFile(names);
  if (!latest) return null;
  const text = readFileSync(join(logsDir, latest), "utf8");
  return lastLines(text, lines);
}

export function cleanupExpiredLogs(logsDir: string, today: Date, keepDays: number): void {
  let names: string[];
  try {
    names = readdirSync(logsDir);
  } catch {
    return;
  }
  for (const f of expiredLogFiles(names, today, keepDays)) {
    try {
      unlinkSync(join(logsDir, f));
    } catch {
      // ignore: best-effort cleanup
    }
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm exec vitest run packages/cli/src/commands/web-logs.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/cli/src/commands/web-logs.ts packages/cli/src/commands/web-logs.test.ts
git commit -m "feat(cli): web 日志读取与过期清理"
```

---

## Task 4: 日志安装（tee + 轮转 + 崩溃同步落盘）与 follow

**Files:**
- Modify: `packages/cli/src/commands/web-logs.ts`

> 本任务的 `installLogging`/`followLog` 改写全局 `process.stdout` 并涉及 I/O 时序，不做自动化测试（见 spec「测试」节），靠 typecheck + 手动验证保证。务必只新增导出、不破坏已有纯函数。

- [ ] **Step 1: 实现 installLogging 与 followLog**

`web-logs.ts` 顶部的 `node:fs` import 扩展为下面这行（**替换** Task 3 加的那条 `import { readdirSync, readFileSync, unlinkSync } from "node:fs"`，合并为一条）：

```ts
import {
  appendFileSync, closeSync, mkdirSync, openSync,
  readdirSync, readFileSync, statSync, unlinkSync, writeSync,
} from "node:fs";
```

`import { join } from "node:path"` 已在 Task 3 引入，保持不变。

追加类型与函数：

```ts
export const DEFAULT_KEEP_DAYS = 7;

export interface LogHandle {
  close(): void;
}

export interface InstallLoggingOptions {
  keepDays?: number;
  now?: () => Date;
}

/**
 * 在当前进程内安装日志：tee process.stdout/stderr 到按日期拆分的文件，
 * 跨天自动重开文件，崩溃时同步落盘。返回的 close() 恢复原始 write 并关闭 fd。
 */
export function installLogging(dataDir: string, options: InstallLoggingOptions = {}): LogHandle {
  const keepDays = options.keepDays ?? DEFAULT_KEEP_DAYS;
  const now = options.now ?? (() => new Date());
  const logsDir = join(dataDir, LOG_DIR_NAME);

  mkdirSync(logsDir, { recursive: true });
  cleanupExpiredLogs(dataDir, now(), keepDays);

  let openedDate = now();
  let fd = openSync(join(logsDir, logFileName(openedDate)), "a");

  const origStdout = process.stdout.write.bind(process.stdout);
  const origStderr = process.stderr.write.bind(process.stderr);

  function writeToFile(chunk: string | Uint8Array): void {
    const current = now();
    if (shouldRotate(openedDate, current)) {
      try { closeSync(fd); } catch { /* ignore */ }
      openedDate = current;
      fd = openSync(join(logsDir, logFileName(openedDate)), "a");
    }
    try {
      writeSync(fd, typeof chunk === "string" ? chunk : Buffer.from(chunk));
    } catch {
      // ignore: never let logging crash the server
    }
  }

  function makeTee(orig: typeof process.stdout.write): typeof process.stdout.write {
    return function (
      this: unknown,
      chunk: string | Uint8Array,
      encoding?: BufferEncoding | ((err?: Error) => void),
      cb?: (err?: Error) => void,
    ): boolean {
      writeToFile(chunk);
      // 保留完整签名与返回值（背压布尔）
      return (orig as (...a: unknown[]) => boolean)(chunk, encoding, cb);
    } as typeof process.stdout.write;
  }

  process.stdout.write = makeTee(origStdout);
  process.stderr.write = makeTee(origStderr);

  const onFatal = (label: string) => (err: unknown): void => {
    const stack = err instanceof Error ? (err.stack ?? err.message) : String(err);
    try {
      appendFileSync(
        join(logsDir, logFileName(now())),
        `\n[${now().toISOString()}] ${label}: ${stack}\n`,
      );
    } catch {
      // ignore
    }
    process.exit(1);
  };
  const uncaught = onFatal("uncaughtException");
  const unhandled = onFatal("unhandledRejection");
  process.on("uncaughtException", uncaught);
  process.on("unhandledRejection", unhandled);

  return {
    close(): void {
      process.stdout.write = origStdout;
      process.stderr.write = origStderr;
      process.off("uncaughtException", uncaught);
      process.off("unhandledRejection", unhandled);
      try { closeSync(fd); } catch { /* ignore */ }
    },
  };
}

/**
 * tail -f 风格跟随最新日志文件：每 500ms 从上次读到的偏移读增量并打印。
 * 该 Promise 不主动 resolve；进程在 Ctrl-C 时退出。
 */
export function followLog(dataDir: string): Promise<void> {
  const logsDir = join(dataDir, LOG_DIR_NAME);
  // logs 是独立 CLI 进程，stdout 未被 tee，直接写即可。
  return new Promise<void>(() => {
    let file: string | null = null;
    let offset = 0;
    setInterval(() => {
      let names: string[];
      try { names = readdirSync(logsDir); } catch { return; }
      const latest = pickLatestLogFile(names);
      if (!latest) return;
      const full = join(logsDir, latest);
      if (latest !== file) { file = latest; offset = 0; }
      let size: number;
      try { size = statSync(full).size; } catch { return; }
      if (size <= offset) return;
      const chunk = readFileSync(full).subarray(offset);
      offset = size;
      process.stdout.write(chunk.toString("utf8"));
    }, 500);
  });
}
```

> `followLog` 用 `setInterval`，进程靠 Ctrl-C(SIGINT) 退出。`logs` 命令在 follow 模式下 await 这个永不 resolve 的 Promise。

- [ ] **Step 2: typecheck**

Run: `pnpm exec tsc --noEmit -p packages/cli/tsconfig.json`
Expected: 无错误（若 `node:fs` 有未使用 import，删掉未使用项后重跑）

- [ ] **Step 3: 纯函数测试仍通过**

Run: `pnpm exec vitest run packages/cli/src/commands/web-logs.test.ts`
Expected: PASS（本任务未改纯函数）

- [ ] **Step 4: 提交**

```bash
git add packages/cli/src/commands/web-logs.ts
git commit -m "feat(cli): web 日志 tee 安装、日期轮转与崩溃同步落盘"
```

---

## Task 5: serve 接入日志 + openBrowser 选项

**Files:**
- Modify: `packages/cli/src/commands/web.ts`
- Modify: `packages/cli/src/commands/web.test.ts`

- [ ] **Step 1: 改 mock 与新增失败测试**

在 `web.test.ts` 的 `fakeRuntime` 返回对象里追加三个方法（放在 `buildServices` 之后）：

```ts
    installLogging: () => ({ close: () => { calls.push("logClose"); } }),
    readLog: () => null,
    followLog: async () => {},
```

把 `fakeActions` 的 `serve` 改成记录 openBrowser，并新增 `logs`：

```ts
    serve: async (port, opts) => { calls.push(`serve:${port}:${opts?.openBrowser ?? true}`); },
    logs: async (opts) => { calls.push(`logs:${opts.lines}:${opts.follow}`); },
```

在 `describe("createWebActions", ...)` 内新增：

```ts
  it("serve installs logging and closes it on shutdown is wired (smoke)", async () => {
    const runtime = fakeRuntime(null);
    // startServer is a no-op mock, so serve resolves after wiring
    await createWebActions(runtime).serve(7788, { openBrowser: false });
    expect(runtime.calls).toContain("write:7788"); // pid written
    expect(runtime.calls).toContain("serve");      // startServer called
    // openBrowser=false -> no open:* call
    expect(runtime.calls.some((c) => c.startsWith("open:"))).toBe(false);
  });

  it("serve opens the browser when openBrowser is true", async () => {
    const runtime = fakeRuntime(null);
    await createWebActions(runtime).serve(7788, { openBrowser: true });
    expect(runtime.calls.some((c) => c.startsWith("open:"))).toBe(true);
  });
```

> 注意：`startServer` 的 mock 是同步 no-op，但真实实现里 `onReady` 才触发 openBrowser。因此 mock 的 `startServer` 需要调用传入的 `onReady`。下一步会改 mock。

把 `fakeRuntime` 的 `startServer` 改为会触发 onReady：

```ts
    startServer: (_readService, opts) => {
      calls.push("serve");
      opts.onReady?.();
    },
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm exec vitest run packages/cli/src/commands/web.test.ts`
Expected: FAIL（`serve` 还没有 `openBrowser` 行为 / `installLogging` 等类型不匹配）

- [ ] **Step 3: 改 web.ts**

3a. 顶部 import 追加：

```ts
import { installLogging, readLog, followLog, type LogHandle } from "./web-logs.js";
```

3b. `WebRuntime` 接口追加三行（放在 `startServer` 附近）：

```ts
  installLogging: typeof installLogging;
  readLog: typeof readLog;
  followLog: typeof followLog;
```

3c. `defaultRuntime` 追加三项：

```ts
  installLogging,
  readLog,
  followLog,
```

3d. `WebActions` 接口：把 `serve` 改签名并新增 `logs`：

```ts
  serve(port: number, opts?: { openBrowser: boolean }): Promise<void>;
  logs(opts: { lines: number; follow: boolean }): Promise<void>;
```

3e. 替换 `serve` action 实现为：

```ts
    async serve(port, opts = { openBrowser: true }) {
      const dataDir = runtime.getDataDir();
      const logHandle: LogHandle = runtime.installLogging(dataDir);
      const { readService, blobsDir, deleteCapture, dispose } = runtime.buildServices();
      const url = `http://localhost:${port}`;

      await runtime.writePid(dataDir, {
        pid: process.pid,
        port,
        dataDir,
        startedAt: runtime.now().toISOString(),
      });

      const cleanup = async () => {
        await runtime.unlinkPid(dataDir).catch(() => {});
        await dispose().catch(() => {});
        logHandle.close();
      };
      process.once("SIGINT", () => { void cleanup().then(() => process.exit(0)); });
      process.once("SIGTERM", () => { void cleanup().then(() => process.exit(0)); });

      runtime.startServer(readService, {
        blobsDir,
        deleteCapture,
        port,
        onReady: opts.openBrowser ? () => runtime.openBrowser(url) : undefined,
      });
    },
```

3f. `run()` 的 daemon 分支显式传 openBrowser：

```ts
      if (actions.isBackground()) {
        await actions.serve(port, { openBrowser: true });
        return;
      }
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm exec vitest run packages/cli/src/commands/web.test.ts`
Expected: PASS

- [ ] **Step 5: typecheck**

Run: `pnpm exec tsc --noEmit -p packages/cli/tsconfig.json`
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add packages/cli/src/commands/web.ts packages/cli/src/commands/web.test.ts
git commit -m "feat(cli): web serve 接入日志并按场景决定是否开浏览器"
```

---

## Task 6: logs 与 serve 子命令

**Files:**
- Modify: `packages/cli/src/commands/web.ts`
- Modify: `packages/cli/src/commands/web.test.ts`

- [ ] **Step 1: 新增失败测试**

在 `web.test.ts` 的 `describe("webCommand", ...)` 内追加：

```ts
  it("routes the serve subcommand with openBrowser=false", async () => {
    const actions = fakeActions();
    await runCommand(createWebCommand(actions), { rawArgs: ["serve", "--port=9000"] });
    expect(actions.calls).toEqual(["serve:9000:false"]);
  });

  it("routes the logs subcommand with parsed args", async () => {
    const actions = fakeActions();
    await runCommand(createWebCommand(actions), { rawArgs: ["logs", "--lines=50", "--follow"] });
    expect(actions.calls).toEqual(["logs:50:true"]);
  });
```

在 `describe("createWebActions", ...)` 内追加：

```ts
  it("logs prints a friendly message when there are no logs", async () => {
    const runtime = fakeRuntime(null); // readLog returns null
    await createWebActions(runtime).logs({ lines: 200, follow: false });
    expect(runtime.calls).toContain("info:No logs yet. Start the web UI first.");
  });
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm exec vitest run packages/cli/src/commands/web.test.ts`
Expected: FAIL（serve/logs 子命令不存在；`logs` action 未实现）

- [ ] **Step 3: 改 web.ts**

3a. 新增 `logs` action（放在 `createWebActions` 返回对象内，`stop` 之后）：

```ts
    async logs(opts) {
      const dataDir = runtime.getDataDir();
      const content = runtime.readLog(dataDir, opts.lines);
      if (content === null) {
        runtime.log.info("No logs yet. Start the web UI first.");
        return;
      }
      process.stdout.write(content + "\n");
      if (opts.follow) {
        await runtime.followLog(dataDir);
      }
    },
```

3b. 新增两个命令工厂（放在 `createRestartCommand` 之后）：

```ts
function createServeCommand(actions: WebActions) {
  return defineCommand({
    meta: { name: "serve", description: "Run the web UI in the foreground (for production / supervisors)" },
    args: {
      port: { type: "string", description: "Port to listen on", default: process.env.AMBER_PORT ?? "7788" },
    },
    run: ({ args }) => actions.serve(Number(args.port), { openBrowser: false }),
  });
}

function createLogsCommand(actions: WebActions) {
  return defineCommand({
    meta: { name: "logs", description: "View web UI server logs" },
    args: {
      lines: { type: "string", description: "Number of lines to show", default: "200" },
      follow: { type: "boolean", alias: "f", description: "Follow new log output", default: false },
    },
    run: ({ args }) => actions.logs({ lines: Number(args.lines), follow: Boolean(args.follow) }),
  });
}
```

3c. `WEB_SUBCOMMANDS` 加入 `logs`、`serve`：

```ts
const WEB_SUBCOMMANDS = new Set(["restart", "status", "stop", "logs", "serve"]);
```

3d. `createWebCommand` 的 `subCommands` 追加：

```ts
    subCommands: {
      restart: createRestartCommand(actions),
      status: createStatusCommand(actions),
      stop: createStopCommand(actions),
      logs: createLogsCommand(actions),
      serve: createServeCommand(actions),
    },
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `pnpm exec vitest run packages/cli/src/commands/web.test.ts`
Expected: PASS

- [ ] **Step 5: typecheck + 全量测试**

Run: `pnpm exec tsc --noEmit -p packages/cli/tsconfig.json && pnpm test`
Expected: typecheck 无错误；测试全绿（web-logs + web 新用例通过，Postgres 跳过）

- [ ] **Step 6: 提交**

```bash
git add packages/cli/src/commands/web.ts packages/cli/src/commands/web.test.ts
git commit -m "feat(cli): 新增 amber web logs 与 amber web serve 子命令"
```

---

## Task 7: 手动验证

**Files:** 无（仅运行验证）

- [ ] **Step 1: 后台启动并看日志**

```bash
pnpm amber web stop || true
pnpm amber web --port=7788
# 浏览器应自动打开
pnpm amber web logs
```
Expected: `logs` 打印出启动日志（含 Hono/服务输出）。

- [ ] **Step 2: 触发页面访问后跟随**

```bash
pnpm amber web logs --follow
```
打开 `http://localhost:7788` 点几下，确认终端实时滚动出请求/错误输出。`Ctrl-C` 退出。

- [ ] **Step 3: 前台模式不弹浏览器**

```bash
pnpm amber web stop || true
pnpm amber web serve --port=7788
```
Expected: 进程前台运行、stdout 有日志、**不**自动打开浏览器。`<dataDir>/logs/web-<today>.log` 同时在写。`Ctrl-C` 退出。

- [ ] **Step 4: 崩溃同步落盘（可选）**

临时在某路由 handler 里 `throw new Error("boom")`，访问该路由，确认 `logs/web-<today>.log` 末尾有 `uncaughtException`/错误堆栈。验证后还原改动。

---

## Task 8: 生产部署文档

**Files:**
- Modify: `docs/configuration.md`

- [ ] **Step 1: 追加「生产部署」一节**

在 `docs/configuration.md` 末尾追加：

````markdown
---

## 生产部署（Node.js）

生产环境用前台命令运行，交给进程管理器守护：

```bash
amber web serve --port=7788
```

`amber web serve` 与本地 `amber web` 的区别：前台运行、不自动开浏览器，但日志写入**同一个文件** `<AMBER_DATA_DIR>/logs/web-YYYY-MM-DD.log`，同时输出到 stdout。

查看日志两种方式都可用：

- `amber web logs [--lines=N] [--follow]` —— 读日志文件，跨环境一致
- 进程管理器自带的 stdout 捕获，如 `journalctl -u amber -f`、`docker logs -f <container>`、`pm2 logs amber`

systemd unit 示例：

```ini
[Service]
WorkingDirectory=/opt/amber
Environment=AMBER_DATA_DIR=/var/lib/amber
Environment=DATABASE_URL=postgresql://...
ExecStart=/usr/bin/pnpm amber web serve --port=7788
Restart=always
```

日志按日期拆分、默认保留 7 天（`serve` 启动时清理过期文件）。
````

- [ ] **Step 2: 提交**

```bash
git add docs/configuration.md
git commit -m "docs: 补充 amber web 生产部署与日志说明"
```

---

## Self-Review 结果（作者已核对）

- **Spec 覆盖**：目标 1（落文件）→ Task 4/5；目标 2（logs 命令 + follow）→ Task 3/6 + followLog；目标 3（日期拆分/保留/清理）→ Task 1/2/3/4；目标 4（dev/prod 单落点同命令）→ Task 5/6/8。spec 第 5 节（不弹浏览器）→ Task 5。Phase 2（Hono onError）按 spec 明确不在本计划。
- **占位符**：无 TBD/TODO；每个改码步骤均有完整代码。
- **类型一致性**：`installLogging`/`readLog`/`followLog`/`LogHandle`/`logFileName`/`pickLatestLogFile`/`expiredLogFiles`/`lastLines`/`shouldRotate`/`dateStamp`/`cleanupExpiredLogs`/`LOG_DIR_NAME` 在 Task 1-4 定义，Task 5-6 引用一致；`WebActions.serve(port, opts?)` 与 `logs(opts)` 签名在接口、mock、命令工厂三处一致。
- **已知注意点**：Task 4 的 `installLogging`/`followLog` 不做自动化测试（全局 process 改写 + I/O 时序），由 Task 7 手动验证兜底；Task 3 测试里 `readLog` 用例的临时建目录写法可简化。
