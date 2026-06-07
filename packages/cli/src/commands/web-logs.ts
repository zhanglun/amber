import {
  appendFileSync, closeSync, mkdirSync, openSync,
  readdirSync, readFileSync, readSync, statSync, unlinkSync, writeSync,
} from "node:fs";
import { join } from "node:path";

const LOG_FILE_RE = /^web-(\d{4}-\d{2}-\d{2})\.log$/;

export const LOG_DIR_NAME = "logs";

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
  const trimmed = text.replace(/\n+$/, "");
  if (trimmed === "") return "";
  const lines = trimmed.split("\n");
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

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
  let text: string;
  try {
    text = readFileSync(join(logsDir, latest), "utf8");
  } catch {
    return null;
  }
  return lastLines(text, lines);
}

export function cleanupExpiredLogs(dataDir: string, today: Date, keepDays: number): void {
  const logsDir = join(dataDir, LOG_DIR_NAME);
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

export const DEFAULT_KEEP_DAYS = 7;

let logInstalled = false;

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
  if (logInstalled) {
    throw new Error("installLogging called twice in the same process");
  }
  logInstalled = true;
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
      if (typeof chunk === "string") {
        writeSync(fd, chunk);
      } else {
        writeSync(fd, chunk);
      }
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
    const ts = now();
    try {
      appendFileSync(
        join(logsDir, logFileName(ts)),
        `\n[${ts.toISOString()}] ${label}: ${stack}\n`,
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
      logInstalled = false;
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
    let fd: number | null = null;
    let offset = 0;
    setInterval(() => {
      let names: string[];
      try { names = readdirSync(logsDir); } catch { return; }
      const latest = pickLatestLogFile(names);
      if (!latest) return;
      const full = join(logsDir, latest);
      if (latest !== file) {
        if (fd !== null) { try { closeSync(fd); } catch { /* ignore */ } }
        try { fd = openSync(full, "r"); } catch { fd = null; return; }
        file = latest;
        offset = 0;
      }
      if (fd === null) return;
      let size: number;
      try { size = statSync(full).size; } catch { return; }
      if (size <= offset) return;
      const buf = Buffer.allocUnsafe(size - offset);
      let bytesRead: number;
      try { bytesRead = readSync(fd, buf, 0, buf.length, offset); } catch { return; }
      offset += bytesRead;
      process.stdout.write(buf.subarray(0, bytesRead).toString("utf8"));
    }, 500);
  });
}
