import { spawn, exec } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join, resolve } from "node:path";
import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { startServer } from "@amber/web";
import { buildServices } from "../wiring.js";
import { installLogging, readLog, followLog, type LogHandle } from "./web-logs.js";

export interface PidInfo {
  pid: number;
  port: number;
  dataDir: string;
  startedAt: string;
}

export interface WebActions {
  isBackground(): boolean;
  restart(port: number, portExplicit: boolean): Promise<void>;
  serve(port: number, opts?: { openBrowser: boolean; hostname?: string }): Promise<void>;
  logs(opts: { lines: number; follow: boolean }): Promise<void>;
  start(port: number): Promise<void>;
  status(): Promise<void>;
  stop(): Promise<PidInfo | null>;
}

export interface WebRuntime {
  buildServices: typeof buildServices;
  getDataDir(): string;
  installLogging: typeof installLogging;
  isAlive(pid: number): boolean;
  kill(pid: number, signal: NodeJS.Signals): void;
  log: Pick<typeof p.log, "info" | "message" | "success" | "warn">;
  now(): Date;
  openBrowser(url: string): void;
  readLog: typeof readLog;
  followLog: typeof followLog;
  readPid(dataDir: string): Promise<PidInfo | null>;
  spawnDaemon(port: number): void;
  startServer: typeof startServer;
  unlinkPid(dataDir: string): Promise<void>;
  writePid(dataDir: string, info: PidInfo): Promise<void>;
}

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

/** 获取本机可访问的地址列表（类 Vite 风格）。 */
function getNetworkAddresses(port: number): { local: string; network: string | null } {
  const local = `http://localhost:${port}`;
  for (const iface of Object.values(networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        return { local, network: `http://${addr.address}:${port}` };
      }
    }
  }
  return { local, network: null };
}

export function daemonProcessArgs(argv: string[], port: number): string[] {
  const args = argv.slice(1);
  const webIndex = args.lastIndexOf("web");
  const portArg = `--port=${port}`;
  return webIndex >= 0 ? [...args.slice(0, webIndex + 1), portArg] : [...args, "web", portArg];
}

function spawnDaemon(port: number): void {
  const child = spawn(
    process.execPath,
    [...process.execArgv, ...daemonProcessArgs(process.argv, port)],
    {
      detached: true,
      stdio: "ignore",
      cwd: process.cwd(),
      env: { ...process.env, _AMBER_WEB_BG: "1" },
    },
  );
  child.unref();
}

async function writePid(dataDir: string, info: PidInfo): Promise<void> {
  await writeFile(pidFilePath(dataDir), JSON.stringify(info, null, 2));
}

async function unlinkPid(dataDir: string): Promise<void> {
  await unlink(pidFilePath(dataDir));
}

const defaultRuntime: WebRuntime = {
  buildServices,
  getDataDir,
  installLogging,
  isAlive,
  kill: (pid, signal) => process.kill(pid, signal),
  log: p.log,
  now: () => new Date(),
  openBrowser,
  readLog,
  followLog,
  readPid,
  spawnDaemon,
  startServer,
  unlinkPid,
  writePid,
};

function hasPortArg(rawArgs: string[]): boolean {
  return rawArgs.some((arg) => arg === "--port" || arg.startsWith("--port="));
}

async function stopExisting(runtime: WebRuntime): Promise<PidInfo | null> {
  const dataDir = runtime.getDataDir();
  const info = await runtime.readPid(dataDir);
  if (!info || !runtime.isAlive(info.pid)) {
    if (info) await runtime.unlinkPid(dataDir).catch(() => {});
    runtime.log.info("Web UI is not running.");
    return null;
  }

  runtime.kill(info.pid, "SIGTERM");
  await runtime.unlinkPid(dataDir).catch(() => {});
  runtime.log.success(`Web UI stopped (PID ${info.pid}).`);
  return info;
}

export function createWebActions(runtime: WebRuntime = defaultRuntime): WebActions {
  return {
    isBackground() {
      return Boolean(process.env._AMBER_WEB_BG);
    },
    async restart(port, portExplicit) {
      const dataDir = runtime.getDataDir();
      const existing = await runtime.readPid(dataDir);
      const restartPort = !portExplicit && existing ? existing.port : port;

      if (existing && runtime.isAlive(existing.pid)) {
        runtime.kill(existing.pid, "SIGTERM");
        await runtime.unlinkPid(dataDir).catch(() => {});
        runtime.log.success(`Web UI stopped (PID ${existing.pid}).`);
      } else if (existing) {
        await runtime.unlinkPid(dataDir).catch(() => {});
      }

      runtime.spawnDaemon(restartPort);
      runtime.log.success(`Web UI restarting on port ${restartPort}…`);
      runtime.log.info('"amber web status" to check  |  "amber web stop" to stop');
    },
    async serve(port, opts = { openBrowser: true }) {
      const dataDir = runtime.getDataDir();
      const logHandle: LogHandle = runtime.installLogging(dataDir);
      try {
        const { readService, blobsDir, deleteCapture, dispose } = runtime.buildServices();
        const addresses = getNetworkAddresses(port);

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
          hostname: opts.hostname,
          onReady: () => {
            runtime.log.success("Web UI ready:");
            runtime.log.info(`  ➜  Local:   ${addresses.local}`);
            if (addresses.network) runtime.log.info(`  ➜  Network: ${addresses.network}`);
            if (opts.openBrowser) runtime.openBrowser(addresses.local);
          },
        });
      } catch (err) {
        logHandle.close();
        throw err;
      }
    },
    async start(port) {
      const dataDir = runtime.getDataDir();
      const existing = await runtime.readPid(dataDir);
      if (existing && runtime.isAlive(existing.pid)) {
        runtime.log.warn(`Web UI already running → http://localhost:${existing.port} (PID ${existing.pid})`);
        runtime.log.info('Use "amber web stop" to stop it first.');
        return;
      }
      if (existing) await runtime.unlinkPid(dataDir).catch(() => {});

      runtime.spawnDaemon(port);
      runtime.log.success(`Web UI starting on port ${port}…`);
      const addresses = getNetworkAddresses(port);
      runtime.log.info(`  ➜  Local:   ${addresses.local}`);
      if (addresses.network) runtime.log.info(`  ➜  Network: ${addresses.network}`);
      runtime.log.info('"amber web status" to check  |  "amber web stop" to stop');
    },
    async status() {
      const dataDir = runtime.getDataDir();
      const info = await runtime.readPid(dataDir);
      if (!info || !runtime.isAlive(info.pid)) {
        if (info) await runtime.unlinkPid(dataDir).catch(() => {});
        runtime.log.info("Web UI is not running.");
        return;
      }
      runtime.log.success("Web UI is running");
      runtime.log.message(
        [
          `  URL      http://localhost:${info.port}`,
          `  PID      ${info.pid}`,
          `  Data     ${info.dataDir}`,
          `  Started  ${new Date(info.startedAt).toLocaleString()}`,
        ].join("\n"),
      );
    },
    async logs(opts) {
      const dataDir = runtime.getDataDir();
      const content = runtime.readLog(dataDir, opts.lines);
      if (content === null) {
        runtime.log.info("No logs yet. Start the web UI first.");
        return;
      }
      if (content === "") {
        runtime.log.info("Log file is empty — the server hasn't printed anything yet.");
        return;
      }
      process.stdout.write(content + "\n");
      if (opts.follow) {
        await runtime.followLog(dataDir);
      }
    },
    async stop() {
      return stopExisting(runtime);
    },
  };
}

function createStatusCommand(actions: WebActions) {
  return defineCommand({
    meta: { name: "status", description: "Show web UI server status" },
    run: () => actions.status(),
  });
}

function createStopCommand(actions: WebActions) {
  return defineCommand({
    meta: { name: "stop", description: "Stop the web UI server" },
    run: () => actions.stop(),
  });
}

function createRestartCommand(actions: WebActions) {
  return defineCommand({
    meta: { name: "restart", description: "Restart the web UI server" },
    args: {
      port: {
        type: "string",
        description: "Port to listen on",
        default: process.env.AMBER_PORT ?? "7788",
      },
    },
    run: ({ args, rawArgs }) => actions.restart(Number(args.port), hasPortArg(rawArgs)),
  });
}

function createServeCommand(actions: WebActions) {
  return defineCommand({
    meta: { name: "serve", description: "Run the web UI in the foreground (for production / supervisors)" },
    args: {
      port: { type: "string", description: "Port to listen on", default: process.env.AMBER_PORT ?? "7788" },
      host: { type: "string", description: "Hostname to listen on", default: "0.0.0.0" },
    },
    run: ({ args }) => actions.serve(Number(args.port), { openBrowser: false, hostname: args.host as string }),
  });
}

function createLogsCommand(actions: WebActions) {
  return defineCommand({
    meta: { name: "logs", description: "View web UI server logs" },
    args: {
      lines: { type: "string", description: "Number of lines to show", default: "200" },
      follow: { type: "boolean", alias: "f", description: "Follow new log output", default: false },
    },
    run: ({ args }) => {
      const lines = Number(args.lines);
      return actions.logs({ lines: Number.isFinite(lines) ? lines : 200, follow: Boolean(args.follow) });
    },
  });
}

const WEB_SUBCOMMANDS = new Set(["restart", "status", "stop", "logs", "serve"]);

function hasWebSubcommand(rawArgs: string[]): boolean {
  return rawArgs.some((arg) => WEB_SUBCOMMANDS.has(arg));
}

export function createWebCommand(actions: WebActions = createWebActions()) {
  return defineCommand({
    meta: { name: "web", description: "Start or manage the local web UI" },
    args: {
      port: {
        type: "string",
        description: "Port to listen on",
        default: process.env.AMBER_PORT ?? "7788",
      },
    },
    subCommands: {
      restart: createRestartCommand(actions),
      status: createStatusCommand(actions),
      stop: createStopCommand(actions),
      logs: createLogsCommand(actions),
      serve: createServeCommand(actions),
    },
    async run({ args, rawArgs }) {
      if (hasWebSubcommand(rawArgs)) return;
      const port = Number(args.port);
      if (actions.isBackground()) {
        await actions.serve(port, { openBrowser: true, hostname: "localhost" });
        return;
      }
      await actions.start(port);
    },
  });
}

export const webCommand = createWebCommand();
