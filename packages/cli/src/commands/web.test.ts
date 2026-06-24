import { runCommand } from "citty";
import { describe, expect, it, vi } from "vitest";
import {
  createWebActions,
  createWebCommand,
  daemonProcessArgs,
  type PidInfo,
  type WebActions,
  type WebRuntime,
} from "./web.js";

function fakeActions(): WebActions & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    isBackground: () => false,
    start: async (port) => { calls.push(`start:${port}`); },
    serve: async (port, opts) => { calls.push(`serve:${port}:${opts?.openBrowser ?? true}:${opts?.hostname ?? "undefined"}`); },
    logs: async (opts) => { calls.push(`logs:${opts.lines}:${opts.follow}`); },
    status: async () => { calls.push("status"); },
    stop: async () => { calls.push("stop"); return null; },
    restart: async (port, portExplicit) => { calls.push(`restart:${port}:${portExplicit}`); },
  };
}

function fakeRuntime(info: PidInfo | null): WebRuntime & { calls: string[] } {
  const calls: string[] = [];
  let alive = Boolean(info);
  return {
    calls,
    buildServices: () => ({
      blobsDir: "/tmp/blobs",
      blob: { put: async () => "", urlFor: async () => "" } as never,
      dataDir: "/tmp/amber-data",
      deleteCapture: async () => {},
      dispose: async () => {},
      importService: {} as never,
      readService: {} as never,
    }),
    installLogging: () => ({ close: () => { calls.push("logClose"); } }),
    readLog: () => null,
    followLog: async () => {},
    getDataDir: () => "/tmp/amber-data",
    isAlive: () => alive,
    kill: (pid, signal) => {
      calls.push(`kill:${pid}:${signal}`);
      alive = false;
    },
    log: {
      info: (message) => { calls.push(`info:${message}`); },
      message: (message) => { calls.push(`message:${message}`); },
      success: (message) => { calls.push(`success:${message}`); },
      warn: (message) => { calls.push(`warn:${message}`); },
    },
    now: () => new Date("2026-06-03T00:00:00.000Z"),
    openBrowser: (url) => { calls.push(`open:${url}`); },
    readPid: async () => info,
    spawnDaemon: (port) => { calls.push(`spawn:${port}`); },
    startServer: (_readService, opts) => {
      calls.push(`startServer:${opts.hostname ?? "undefined"}`);
      opts.onReady?.();
    },
    unlinkPid: async () => { calls.push("unlink"); },
    writePid: async (_dataDir, pidInfo) => { calls.push(`write:${pidInfo.port}`); },
  };
}

describe("webCommand", () => {
  it("does not start after running the stop subcommand", async () => {
    const actions = fakeActions();
    await runCommand(createWebCommand(actions), { rawArgs: ["stop"] });
    expect(actions.calls).toEqual(["stop"]);
  });

  it("runs restart without falling through to start", async () => {
    const actions = fakeActions();
    await runCommand(createWebCommand(actions), { rawArgs: ["restart"] });
    expect(actions.calls).toEqual(["restart:7788:false"]);
  });

  it("passes explicit restart port to the restart action", async () => {
    const actions = fakeActions();
    await runCommand(createWebCommand(actions), { rawArgs: ["restart", "--port=8899"] });
    expect(actions.calls).toEqual(["restart:8899:true"]);
  });

  it("routes the serve subcommand with openBrowser=false", async () => {
    const actions = fakeActions();
    await runCommand(createWebCommand(actions), { rawArgs: ["serve", "--port=9000"] });
    expect(actions.calls).toEqual(["serve:9000:false:0.0.0.0"]);
  });

  it("routes the serve subcommand with custom host", async () => {
    const actions = fakeActions();
    await runCommand(createWebCommand(actions), { rawArgs: ["serve", "--host=127.0.0.1"] });
    expect(actions.calls).toEqual(["serve:7788:false:127.0.0.1"]);
  });

  it("routes the logs subcommand with parsed args", async () => {
    const actions = fakeActions();
    await runCommand(createWebCommand(actions), { rawArgs: ["logs", "--lines=50", "--follow"] });
    expect(actions.calls).toEqual(["logs:50:true"]);
  });
});

describe("createWebActions", () => {
  it("serve installs logging and writes pid (smoke)", async () => {
    const runtime = fakeRuntime(null);
    // startServer is a no-op mock, so serve resolves after wiring
    await createWebActions(runtime).serve(7788, { openBrowser: false });
    expect(runtime.calls).toContain("write:7788"); // pid written
    expect(runtime.calls).toContain("startServer:undefined");      // startServer called
    // openBrowser=false -> no open:* call
    expect(runtime.calls.some((c) => c.startsWith("open:"))).toBe(false);
  });

  it("serve opens the browser when openBrowser is true", async () => {
    const runtime = fakeRuntime(null);
    await createWebActions(runtime).serve(7788, { openBrowser: true });
    expect(runtime.calls.some((c) => c.startsWith("open:"))).toBe(true);
  });

  it("serve passes hostname to startServer", async () => {
    const runtime = fakeRuntime(null);
    await createWebActions(runtime).serve(7788, { openBrowser: false, hostname: "0.0.0.0" });
    expect(runtime.calls).toContain("startServer:0.0.0.0");
  });

  it("serve prints Vite-style local and network addresses", async () => {
    const runtime = fakeRuntime(null);
    await createWebActions(runtime).serve(7788, { openBrowser: false });
    const local = runtime.calls.find((c) => c.includes("➜") && c.includes("Local"));
    expect(local).toBeTruthy();
    expect(local).toContain("localhost:7788");
  });

  it("serve defaults hostname to undefined when not provided", async () => {
    const runtime = fakeRuntime(null);
    await createWebActions(runtime).serve(7788, { openBrowser: false });
    expect(runtime.calls).toContain("startServer:undefined");
  });

  it("logs prints a friendly message when there are no logs", async () => {
    const runtime = fakeRuntime(null); // readLog returns null
    await createWebActions(runtime).logs({ lines: 200, follow: false });
    expect(runtime.calls).toContain("info:No logs yet. Start the web UI first.");
  });

  it("logs writes content to stdout when logs exist", async () => {
    const runtime = { ...fakeRuntime(null), readLog: () => "line1\nline2" };
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
    try {
      await createWebActions(runtime).logs({ lines: 200, follow: false });
    } finally {
      spy.mockRestore();
    }
    expect(writes.join("")).toContain("line1\nline2");
  });

  it("restarts on the existing port when no restart port is provided", async () => {
    const runtime = fakeRuntime({
      pid: 123,
      port: 8899,
      dataDir: "/tmp/amber-data",
      startedAt: "2026-06-03T00:00:00.000Z",
    });
    await createWebActions(runtime).restart(7788, false);
    expect(runtime.calls).toContain("kill:123:SIGTERM");
    expect(runtime.calls).toContain("unlink");
    expect(runtime.calls).toContain("spawn:8899");
  });

  it("restarts on an explicit port when provided", async () => {
    const runtime = fakeRuntime({
      pid: 123,
      port: 8899,
      dataDir: "/tmp/amber-data",
      startedAt: "2026-06-03T00:00:00.000Z",
    });
    await createWebActions(runtime).restart(7788, true);
    expect(runtime.calls).toContain("spawn:7788");
  });
});

describe("daemonProcessArgs", () => {
  it("spawns the web start path instead of replaying management subcommands", () => {
    expect(daemonProcessArgs(["node", "/repo/packages/cli/src/main.ts", "web", "restart"], 7788)).toEqual([
      "/repo/packages/cli/src/main.ts",
      "web",
      "--port=7788",
    ]);
    expect(daemonProcessArgs(["node", "/repo/packages/cli/src/main.ts", "web", "stop"], 8899)).toEqual([
      "/repo/packages/cli/src/main.ts",
      "web",
      "--port=8899",
    ]);
  });
});
