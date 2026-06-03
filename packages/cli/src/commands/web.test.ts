import { runCommand } from "citty";
import { describe, expect, it } from "vitest";
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
    serve: async (port) => { calls.push(`serve:${port}`); },
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
      dataDir: "/tmp/amber-data",
      deleteCapture: async () => {},
      importService: {} as never,
      readService: {} as never,
    }),
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
    startServer: () => { calls.push("serve"); },
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
});

describe("createWebActions", () => {
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
