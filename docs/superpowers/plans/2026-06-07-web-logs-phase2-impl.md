# amber web 应用级日志 (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `@amber/web` 加请求日志中间件和自定义 `onError`，让正常请求（带 ISO 时间戳的单行访问日志）和受控错误（堆栈 + 干净 500 页）都进日志，输出经 Phase 1 的 tee 落到同一日志文件。

**Architecture:** 新建独立模块 `request-log.ts`（纯 formatter + Hono 中间件 + onError handler），通过 `createApp` 的新选项 `requestLog` 条件挂载；`startServer` 始终开启，现有测试默认不开启故零影响。日志走 `console.log`/`console.error` → Phase 1 tee。

**Tech Stack:** TypeScript (ESM), Hono 4.6, vitest。

**约定：** 提交信息不要包含任何 AI/Claude 署名。命令在仓库根 `/Users/zhanglun/Documents/mine/amber` 下执行。

**关联 spec：** `docs/superpowers/specs/2026-06-06-web-logs-design.md`（Phase 2 章节，含已实测验证的 Hono 行为）。

---

## File Structure

- `packages/web/src/request-log.ts`（新建）：`formatRequestLine`、`formatErrorLine`（纯函数）、`requestLogger`（中间件工厂）、`errorHandler`（onError 工厂）。单一职责：定义“写什么日志”。
- `packages/web/src/request-log.test.ts`（新建）：纯函数单测 + 用真实 Hono app 测中间件/onError。
- `packages/web/src/index.ts`（修改）：`WebOptions` 加 `requestLog?`、`createApp` 条件挂载、`startServer` 传 `requestLog: true`。

**已验证的 Hono 4.6 行为（plan 依据）：** handler 抛错时 Hono 先跑 `onError`（设 500），再让中间件的 `await next()` **正常返回**（不重新抛出），故 `c.res.status` 在 next() 之后已是 500。抛错请求因此产生两条互补日志：onError 的错误堆栈行 + 中间件的请求行(500)。

---

## Task 1: 纯 formatter

**Files:**
- Create: `packages/web/src/request-log.ts`
- Test: `packages/web/src/request-log.test.ts`

- [x] **Step 1: 写失败测试**

创建 `packages/web/src/request-log.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { formatErrorLine, formatRequestLine } from "./request-log.js";

describe("formatRequestLine", () => {
  it("formats a single line with iso timestamp", () => {
    const line = formatRequestLine("GET", "/captures/abc", 200, 12, new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toBe("[2026-06-07T09:50:12.345Z] GET /captures/abc 200 12ms");
  });
});

describe("formatErrorLine", () => {
  it("includes timestamp, method, path and the error stack", () => {
    const line = formatErrorLine("GET", "/boom", new Error("BOOM"), new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toContain("[2026-06-07T09:50:12.345Z] ERROR GET /boom: ");
    expect(line).toContain("BOOM");
  });
  it("stringifies non-Error throws", () => {
    const line = formatErrorLine("GET", "/x", "oops-string", new Date("2026-06-07T09:50:12.345Z"));
    expect(line).toBe("[2026-06-07T09:50:12.345Z] ERROR GET /x: oops-string");
  });
});
```

- [x] **Step 2: 运行测试，确认失败**

Run: `pnpm exec vitest run packages/web/src/request-log.test.ts`
Expected: FAIL（`Cannot find module './request-log.js'`）

- [x] **Step 3: 写最小实现**

创建 `packages/web/src/request-log.ts`：

```ts
export function formatRequestLine(
  method: string,
  path: string,
  status: number,
  ms: number,
  now: Date,
): string {
  return `[${now.toISOString()}] ${method} ${path} ${status} ${ms}ms`;
}

export function formatErrorLine(
  method: string,
  path: string,
  err: unknown,
  now: Date,
): string {
  const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
  return `[${now.toISOString()}] ERROR ${method} ${path}: ${detail}`;
}
```

- [x] **Step 4: 运行测试，确认通过**

Run: `pnpm exec vitest run packages/web/src/request-log.test.ts`
Expected: PASS（3 个用例）

- [x] **Step 5: 提交**

```bash
git add packages/web/src/request-log.ts packages/web/src/request-log.test.ts
git commit -m "feat(web): 请求日志与错误日志格式化纯函数"
```

---

## Task 2: requestLogger 中间件与 errorHandler

**Files:**
- Modify: `packages/web/src/request-log.ts`
- Test: `packages/web/src/request-log.test.ts`

- [x] **Step 1: 追加失败测试**

在 `request-log.test.ts` 顶部 import 改为：

```ts
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler, formatErrorLine, formatRequestLine, requestLogger } from "./request-log.js";
```

文件末尾追加：

```ts
describe("requestLogger + errorHandler (real Hono)", () => {
  const fixed = () => new Date("2026-06-07T09:50:12.345Z");
  afterEach(() => { vi.restoreAllMocks(); });

  function makeApp() {
    const app = new Hono();
    app.use(requestLogger(fixed));
    app.onError(errorHandler(fixed));
    app.get("/ok", (c) => c.text("ok"));
    app.get("/boom", () => { throw new Error("BOOM"); });
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
});
```

- [x] **Step 2: 运行测试，确认失败**

Run: `pnpm exec vitest run packages/web/src/request-log.test.ts`
Expected: FAIL（`requestLogger`/`errorHandler` 未导出）

- [x] **Step 3: 写最小实现**

在 `request-log.ts` 顶部加类型 import，并追加两个工厂：

```ts
import type { ErrorHandler, MiddlewareHandler } from "hono";
```

```ts
export function requestLogger(now: () => Date = () => new Date()): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    // 已验证：handler 抛错时 Hono 先跑 onError 设 500，再让 next() 正常返回，
    // 因此这里的 c.res.status 已是最终状态码（含 500），无需 try/catch。
    console.log(formatRequestLine(c.req.method, c.req.path, c.res.status, ms, now()));
  };
}

export function errorHandler(now: () => Date = () => new Date()): ErrorHandler {
  return (err, c) => {
    console.error(formatErrorLine(c.req.method, c.req.path, err, now()));
    return c.html("<p>出错了。<a href='/'>返回</a></p>", 500);
  };
}
```

- [x] **Step 4: 运行测试，确认通过**

Run: `pnpm exec vitest run packages/web/src/request-log.test.ts`
Expected: PASS（5 个用例）

- [x] **Step 5: typecheck**

Run: `pnpm exec tsc --noEmit -p packages/web/tsconfig.json`
Expected: 无错误

- [x] **Step 6: 提交**

```bash
git add packages/web/src/request-log.ts packages/web/src/request-log.test.ts
git commit -m "feat(web): 请求日志中间件与自定义 onError"
```

---

## Task 3: 接入 createApp 与 startServer

**Files:**
- Modify: `packages/web/src/index.ts`
- Test: `packages/web/src/index.test.ts`（新增 1 个用例）

- [x] **Step 1: 新增失败测试**

在 `packages/web/src/index.test.ts` 末尾追加（如已有 `vi` 的 import 则复用；否则把顶部 vitest import 加上 `vi`）：

```ts
describe("createApp requestLog option", () => {
  it("logs a request line when requestLog is enabled", async () => {
    const { vi } = await import("vitest");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const readService = { list: async () => [], get: async () => null, recordVisit: async () => {} } as never;
      const app = createApp(readService, {
        blobsDir: "/tmp/x",
        deleteCapture: async () => {},
        requestLog: true,
      });
      const res = await app.request("/");
      expect(res.status).toBe(200);
      expect(log.mock.calls.map((c) => String(c[0])).join("\n")).toContain("GET / 200");
    } finally {
      log.mockRestore();
    }
  });

  it("does not log when requestLog is omitted", async () => {
    const { vi } = await import("vitest");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const readService = { list: async () => [], get: async () => null, recordVisit: async () => {} } as never;
      const app = createApp(readService, { blobsDir: "/tmp/x", deleteCapture: async () => {} });
      await app.request("/");
      expect(log.mock.calls.length).toBe(0);
    } finally {
      log.mockRestore();
    }
  });
});
```

> 注：`createApp` 已在该测试文件被 import；若没有，则补 `import { createApp } from "./index.js";`。`readService` 用最小 stub 即可（`/` 路由只调用 `list()`）。

- [x] **Step 2: 运行测试，确认失败**

Run: `pnpm exec vitest run packages/web/src/index.test.ts`
Expected: FAIL（`requestLog` 不是 `WebOptions` 的属性 / 没有日志输出）

- [x] **Step 3: 改 index.ts**

3a. `WebOptions` 接口加一行：

```ts
export interface WebOptions {
  blobsDir: string;
  deleteCapture: (id: string) => Promise<void>;
  onReady?: () => void;
  requestLog?: boolean;
}
```

3b. 顶部 import 追加：

```ts
import { errorHandler, requestLogger } from "./request-log.js";
```

3c. 在 `createApp` 里，紧接 `const app = new Hono();` 之后、第一个 `app.get(...)` 之前插入（中间件必须先于路由注册）：

```ts
  if (options.requestLog) {
    app.use(requestLogger());
    app.onError(errorHandler());
  }
```

3d. `startServer` 调用 `createApp` 时传 `requestLog: true`：

```ts
  const app = createApp(readService, {
    blobsDir: options.blobsDir,
    deleteCapture: options.deleteCapture,
    requestLog: true,
  });
```

- [x] **Step 4: 运行测试，确认通过**

Run: `pnpm exec vitest run packages/web/src/index.test.ts`
Expected: PASS（含新增 2 个用例，原有 11 个不变）

- [x] **Step 5: typecheck + 全量测试**

Run: `pnpm exec tsc --noEmit -p packages/web/tsconfig.json && pnpm test`
Expected: typecheck 无错误；全量测试全绿（Postgres 跳过）。

- [x] **Step 6: 提交**

```bash
git add packages/web/src/index.ts packages/web/src/index.test.ts
git commit -m "feat(web): createApp 按 requestLog 选项挂载日志，startServer 默认开启"
```

---

## Task 4: 手动验证（前台 serve 实地看请求日志）

**Files:** 无（仅运行验证）

- [x] **Step 1: 前台起服务并访问**

```bash
pnpm amber web stop || true
DATABASE_URL= AMBER_DATA_DIR=/tmp/amber-p2test pnpm amber web serve --port=7799 &
# 用 curl 重试等待服务起来（不要用 sleep）
curl -s --retry-connrefused --retry 15 --retry-delay 1 -o /dev/null http://localhost:7799/
curl -s -o /dev/null http://localhost:7799/nope
```

- [x] **Step 2: 查看日志文件**

```bash
cat /tmp/amber-p2test/logs/web-*.log
```
Expected: 看到形如 `[<iso>] GET / 200 Nms` 与 `[<iso>] GET /nope 404 Nms` 的行。

- [x] **Step 3: 清理**

```bash
pkill -f "web serve --port=7799" || true
rm -rf /tmp/amber-p2test
```

---

## Self-Review 结果（作者已核对）

- **Spec 覆盖**：目标1（请求行）→ Task1 `formatRequestLine` + Task2 `requestLogger`；目标2（错误堆栈 + 500 页）→ Task1 `formatErrorLine` + Task2 `errorHandler`；目标3（走 tee 同文件）→ 无新文件逻辑，靠 `console.*`，Task4 实地验证；目标4（现有测试零影响）→ Task3 gating + “does not log when omitted” 用例。已验证的 Hono 行为反映在 Task2 的 `/boom` 用例（断言 500 请求行 + 错误堆栈两条）。
- **占位符**：无 TBD/TODO；每个改码步骤均有完整代码。
- **类型一致性**：`formatRequestLine`/`formatErrorLine`/`requestLogger`/`errorHandler` 在 Task1-2 定义，Task2-3 引用一致；`WebOptions.requestLog?` 在接口、`createApp`、`startServer`、测试四处一致。
- **注意点**：Task2/Task3 的测试都 spy `console.log`/`console.error` 并在 `afterEach`/`finally` 还原，避免污染其它测试输出。
