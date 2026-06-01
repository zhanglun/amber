import { spawn, exec } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { startServer } from "@amber/web";
import { buildServices } from "../wiring.js";

// ─── types ────────────────────────────────────────────────────────────────────

interface PidInfo {
  pid: number;
  port: number;
  dataDir: string;
  startedAt: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function getDataDir(): string {
  return resolve(process.env.AMBER_DATA_DIR ?? "./amber-data");
}

function pidFilePath(dataDir: string): string {
  return join(dataDir, ".web.pid");
}

async function readPid(dataDir: string): Promise<PidInfo | null> {
  try {
    return JSON.parse(await readFile(pidFilePath(dataDir), "utf8")) as PidInfo;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** 跨平台打开浏览器，fire-and-forget。 */
function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? `open "${url}"`
    : process.platform === "win32" ? `start "" "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd);
}

/**
 * 以后台 detached 子进程重新启动自身。
 * 使用 process.execPath + process.execArgv 精确复现 tsx 加载链。
 */
function spawnDaemon(): void {
  const child = spawn(
    process.execPath,
    [...process.execArgv, ...process.argv.slice(1)],
    {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
      env: { ...process.env, _AMBER_WEB_BG: "1" },
    },
  );
  child.unref();
}

// ─── subcommands ──────────────────────────────────────────────────────────────

const statusCommand = defineCommand({
  meta: { name: "status", description: "Show web UI server status" },
  async run() {
    const dataDir = getDataDir();
    const info = await readPid(dataDir);
    if (!info || !isAlive(info.pid)) {
      if (info) await unlink(pidFilePath(dataDir)).catch(() => {});
      p.log.info("Web UI is not running.");
      return;
    }
    p.log.success("Web UI is running");
    p.log.message(
      [
        `  URL      http://localhost:${info.port}`,
        `  PID      ${info.pid}`,
        `  Data     ${info.dataDir}`,
        `  Started  ${new Date(info.startedAt).toLocaleString()}`,
      ].join("\n"),
    );
  },
});

const stopCommand = defineCommand({
  meta: { name: "stop", description: "Stop the web UI server" },
  async run() {
    const dataDir = getDataDir();
    const info = await readPid(dataDir);
    if (!info || !isAlive(info.pid)) {
      if (info) await unlink(pidFilePath(dataDir)).catch(() => {});
      p.log.info("Web UI is not running.");
      return;
    }
    process.kill(info.pid, "SIGTERM");
    await unlink(pidFilePath(dataDir)).catch(() => {});
    p.log.success(`Web UI stopped (PID ${info.pid}).`);
  },
});

// ─── main web command ─────────────────────────────────────────────────────────

export const webCommand = defineCommand({
  meta: { name: "web", description: "Start or manage the local web UI" },
  args: {
    port: {
      type: "string",
      description: "Port to listen on",
      default: process.env.AMBER_PORT ?? "7788",
    },
  },
  subCommands: { status: statusCommand, stop: stopCommand },
  async run({ args }) {
    const port = Number(args.port);
    const dataDir = getDataDir();

    // ── foreground parent: guard + spawn daemon ──────────────────────────────
    if (!process.env._AMBER_WEB_BG) {
      const existing = await readPid(dataDir);
      if (existing && isAlive(existing.pid)) {
        p.log.warn(`Web UI already running → http://localhost:${existing.port} (PID ${existing.pid})`);
        p.log.info('Use "amber web stop" to stop it first.');
        return;
      }
      spawnDaemon();
      p.log.success(`Web UI starting on port ${port}…`);
      p.log.info('"amber web status" to check  |  "amber web stop" to stop');
      return;
    }

    // ── background daemon: start server ─────────────────────────────────────
    const { readService, blobsDir } = buildServices();
    const url = `http://localhost:${port}`;

    await writeFile(
      pidFilePath(dataDir),
      JSON.stringify({ pid: process.pid, port, dataDir, startedAt: new Date().toISOString() } satisfies PidInfo, null, 2),
    );

    const cleanup = () => unlink(pidFilePath(dataDir)).catch(() => {});
    process.once("SIGINT", () => { cleanup(); process.exit(0); });
    process.once("SIGTERM", () => { cleanup(); process.exit(0); });

    startServer(readService, { blobsDir, port, onReady: () => openBrowser(url) });
  },
});
