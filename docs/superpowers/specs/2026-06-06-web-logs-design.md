# amber web 日志查看设计

- 日期：2026-06-06
- 状态：待实现
- 关联代码：`packages/cli/src/commands/web.ts`、`packages/web/src/index.ts`

## 背景与问题

`amber web` 以 detached 后台进程方式运行（`spawnDaemon`，`web.ts:81`），spawn 时 `stdio: "ignore"`，后台进程的 stdout/stderr 被**直接丢弃**。因此：

- 页面报错时（Hono 默认 `onError` 会 `console.error(err)` 并返回 500），错误堆栈进了 stderr，但被吞掉，用户无从排查。
- web 子命令只有 `restart`/`status`/`stop`，没有查看日志的入口。
- 即便加一个查看命令，目前也**无日志可读**——没有任何输出被持久化。

## 目标

1. 后台进程的运行日志（stdout/stderr，含未捕获异常与 Hono 错误堆栈）被持久化到文件。
2. 新增 `amber web logs` 子命令，支持查看最近日志与实时跟踪。
3. 日志按日期拆分、追加保留、自动清理过期文件，防止无限增长。
4. **本地开发与未来 Node.js 生产部署共用同一个日志落点和同一条查看命令**，无需两套心智模型。

## 非目标（YAGNI）

- 不做结构化 JSON 日志 / 日志级别系统。
- 不接入外部日志聚合（Loki/ELK 等）。
- 本期不改 `@amber/web` 的应用级日志（`onError`/请求中间件），见「Phase 2」。

## 核心理念：单一落点（日志文件）

**所有场景都把日志写到同一个文件**，`amber web logs` 在任何场景都读同一个文件、用同一条命令。

实现关键：把「写日志」的逻辑放进 **`serve()`** 函数自身，而不是放在 `spawnDaemon`（spawn 层）。因为 `serve()` 在所有运行场景都会执行：

| 运行方式 | 谁在跑 serve() | 日志落点 | 查看 |
|---------|--------------|---------|------|
| `amber web`（自守护 daemon，本地开发） | 后台进程 | `<dataDir>/logs/web-YYYY-MM-DD.log` | `amber web logs` |
| `amber web serve`（前台，生产部署） | 前台进程 | **同一个文件** | `amber web logs` |

`spawnDaemon` 那层不再做任何 stdio 重定向（保持 `stdio: "ignore"`），日志落点的统一完全由 `serve()` 内部负责。

## 设计

### 1. 日志写入机制（serve() 内 tee）

`serve()` 启动时初始化一个日志 sink，并 tee 进程输出：

1. 打开当天日志文件的 append 写入流（`<dataDir>/logs/web-YYYY-MM-DD.log`）。
2. **tee `process.stdout.write` / `process.stderr.write`**：保存原始 write，替换为「调用原始 write（前台时 supervisor / 终端照样可见）+ 追加写入日志文件」。这样 `console.*`、Hono 默认错误输出全部进文件。包装函数必须**完整保留 write 的签名与返回值**（`(chunk, encoding?, cb?)` 三种重载、返回原始 write 的布尔背压值），否则会破坏依赖返回值的调用方。
3. 注册 `process.on("uncaughtException")` 与 `process.on("unhandledRejection")`：把崩溃堆栈写入文件，**用同步写入**（`fs.appendFileSync` 或 `fs.writeSync(fd)`，不能用异步流——进程随即 `exit(1)`，异步写来不及 flush，崩溃日志会丢，而这恰恰是最需要落盘的场景），再以非零码退出。
4. **按日期重开**：sink 每次写入前比对「当前日期」与「已打开文件的日期」，跨天则关闭旧流、打开新当天文件——实现真·按日历日轮转（解决长跑进程跨午夜不切文件的问题）。

选型理由：相比在 spawn 层做 fd 重定向（只能覆盖本地 daemon、无法覆盖前台 serve），把日志放进 serve() 才能让本地与生产共用单一落点。tee 拦的是 `process.stdout/stderr.write` 这一层，抓不到原生代码直接写 fd 的输出——但 amber 是纯 JS Hono 服务，输出全走 console，覆盖足够。

### 2. 日志文件布局

- 目录：`<dataDir>/logs/`（`dataDir` 即 `AMBER_DATA_DIR`，默认 `./amber-data`）
- 文件名：`web-YYYY-MM-DD.log`（本地时区日期）
- 写入：append（`flag: "a"`），同一天多次启动续写同一文件
- 保留：`serve()` 启动时清理 `logs/` 下文件名日期早于「今天 − keepDays」的 `web-*.log`，`keepDays` 默认 **7**

### 3. `amber web logs` 子命令

```
amber web logs [--lines=N] [--follow]
```

- 默认：读「最新的」`web-*.log`（按文件名日期排序取最新），打印最后 `N` 行后退出，`N` 默认 200。
- `--follow` / `-f`：打印最后 `N` 行后，持续输出文件新追加的内容，`Ctrl-C` 退出。**用 offset 轮询实现**（记住已读字节偏移，每 ~500ms 读增量），不用 `fs.watch`——后者跨平台行为不一致、易漏事件。
- 选「最新文件」而非「当前运行进程的文件」，使服务停止后仍能查看最后一次崩溃日志。
- 无任何日志文件时：提示 `No logs yet. Start the web UI first.`。

### 4. 生产前台入口 `amber web serve`

将 serve 行为暴露为公开子命令 `amber web serve [--port]`：**前台运行、不自守护、不弹浏览器**，日志写入同一文件（同时 tee 到 stdout 供 supervisor 捕获）。生产部署用它配合 systemd / Docker / pm2。

- 现有内部 `_AMBER_WEB_BG=1` daemon 触发路径保留不变（`spawnDaemon` 仍走它）。
- 文档（`docs/configuration.md`）补一节「生产部署」：示例 systemd unit / Docker CMD 用 `amber web serve`，并说明既可 `amber web logs` 看文件、也可 `journalctl -u amber` / `docker logs` 看 stdout。

### 5. serve() 不在前台模式弹浏览器（修复点）

当前 `serve()` 的 `onReady` 无条件调 `openBrowser(url)`（`web.ts:178`）。生产无头服务器上执行 `xdg-open` 会报错或拉起无用进程。

- 给 `serve` action 增加 `openBrowser: boolean` 选项。
- daemon 路径（`run()` 中 `isBackground()` 分支）传 `openBrowser: true`，保留本地「启动即开浏览器」的体验。
- `amber web serve` 子命令传 `openBrowser: false`。

## 代码结构与可测试性

纯函数（全部单测覆盖），I/O 薄壳在外（沿用 `web.ts` 现有 `WebRuntime` 注入风格）：

- `logFileName(date: Date): string` → `web-2026-06-06.log`
- `pickLatestLogFile(filenames: string[]): string | null` → 用严格正则 `^web-\d{4}-\d{2}-\d{2}\.log$` 过滤后选最新，无则 `null`
- `expiredLogFiles(filenames: string[], today: Date, keepDays: number): string[]` → 该删的文件名列表
- `lastLines(text: string, n: number): string` → 取末尾 N 行
- `shouldRotate(openedDate: Date, now: Date): boolean` → 跨日判定

接入点：

- `serve()`：初始化日志 sink（建 `logs/` 目录 → 保留清理 → 打开当天文件 → tee stdout/stderr → 注册异常 handler）；现有 cleanup（SIGINT/SIGTERM）中关闭日志流、恢复原始 write。
- `serve` action 签名加 `openBrowser` 选项；`run()` 的 daemon 分支传 `true`。
- 新增 `logs` action + `createLogsCommand`，新增 `serve` action 包装的 `createServeCommand`；两者注册进 `web` 的 `subCommands`，并把 `"logs"`、`"serve"` 都加入 `WEB_SUBCOMMANDS`（否则 `hasWebSubcommand` 漏判、走错分支）。
- `spawnDaemon`：`stdio` 保持 `"ignore"`，不改动。

## 测试

- 5 个纯函数单测，覆盖边界：文件不足 N 行、空目录、跨日期排序、`keepDays` 边界（恰好今天 / 恰好过期）、`shouldRotate` 同日与跨日。
- `logs` action 的「选最新文件 + 打印最后 N 行」：走注入 fs mock，断言输出与「无日志」提示。
- `serve` 子命令：复用现有 `WebRuntime` mock，断言调用 `serve(port, { openBrowser: false })`。
- `run()` daemon 分支：断言 `serve` 收到 `openBrowser: true`。
- tee 与 `--follow` 实时流：不做自动化测试（涉及全局 `process` 改写与 I/O 时序），手动验证。
- 手动验证清单：① 路由抛错时堆栈进入日志文件；② `uncaughtException` 同步落盘（构造一个崩溃，确认日志文件里有堆栈）；③ 前台 `amber web serve` 不弹浏览器、stdout 与文件都有输出。

## 已知局限

- **tee 覆盖面**：只拦 `process.stdout/stderr.write` 层，原生代码直接写 fd 的输出抓不到。amber 全走 console，实际无影响。
- **保留清理时机**：仅在 `serve()` 启动时触发，纯靠 `logs` 命令不触发清理。可接受。
- **`lastLines` 读整文件**：把文件全读进内存再取尾部。本地日志量级可接受；若未来日志显著变大，再改为从文件末尾反向读。
- **生产环境双写**：前台模式下日志同时进文件和 stdout（被 journald/docker 再存一份），磁盘上有轻微重复。这是「单一可读落点」的代价，可接受；若某些部署只想要 stdout、不想要 app 自管文件，后续可加一个 `--no-log-file` 开关或环境变量关闭文件写入（本期不做）。

## Phase 2：应用级日志（请求日志 + onError）

> Phase 1（上文）已实现：单落点文件、tee、`logs`/`serve` 子命令、崩溃同步落盘。Phase 2 在此基础上补「写什么」——让正常请求与受控错误都进日志。Phase 1 的 tee 已能捕获**崩溃和任何 stdout/stderr 输出**，但健康请求（成功 200）本身不产生任何输出，所以需要应用级日志。

### 背景

`packages/web/src/index.ts` 的 `createApp` 目前**没有** `onError`、**没有**请求日志中间件。Hono 默认 `onError` 会 `console.error(err)`（已被 Phase 1 tee 捕获），但：
- 正常请求无任何日志，无法观察访问情况；
- 默认错误行无时间戳，500 响应是纯文本。

### 目标

1. 每个请求产出一条带 ISO 时间戳的单行访问日志。
2. 受控错误（handler 抛错）产出带时间戳的错误行 + 返回干净的 500 页。
3. 输出仍走 `console.*` → Phase 1 tee → 同一日志文件 + stdout，不新增任何文件逻辑。
4. **对现有 11 个 `index.test.ts` 测试零改动、零噪音。**

### 架构与文件

新建 `packages/web/src/request-log.ts`（把日志逻辑从已不小的 `index.ts` 隔离，单一职责、可独立测试）。导出：

- `formatRequestLine(method: string, path: string, status: number, ms: number, now: Date): string`
  纯函数 → `[<now.toISOString()>] <method> <path> <status> <ms>ms`
- `formatErrorLine(method: string, path: string, err: unknown, now: Date): string`
  纯函数 → `[<now.toISOString()>] ERROR <method> <path>: <stack>`
- `requestLogger(now?: () => Date)` → Hono 中间件
- `errorHandler(now?: () => Date)` → 返回一个 `app.onError` 处理器

### 请求日志中间件

```
记 start = Date.now()
await next()
ms = Date.now() - start
console.log(formatRequestLine(c.req.method, c.req.path, c.res.status, ms, now()))
```

要点（已用真实 Hono 4.6 实测验证）：
- **每个请求都在 `next()` 返回后记一条请求行**，覆盖 200 / 404 / 500。**实测**：Hono 在 handler 抛错时先运行 `onError`（设置 500 响应），再让 `await next()` **正常返回**（不向中间件重新抛出），因此 next() 之后 `c.res.status` 已是 500，可直接取用——**无需** try/catch，也不会取到错误状态码。
- 抛错的请求产生**两条互补日志**：`onError` 的错误堆栈行（先）+ 中间件的请求行（后，status=500）。前者给堆栈、后者给访问摘要，不重复，符合 access-log + error-log 惯例。
- **耗时 `ms` 用真实 `Date.now()` 起止相减**；**时间戳用可注入的 `now()`**（固定 `now()` 会让 ms 恒为 0，故两者分开）。纯函数把 `ms`（数字）与 `now`（时间戳）分开接收，保证 ms 真实、时间戳可测。
- **用 `c.req.path` 而非 `c.req.url`**：path 不含 query string，避免把查询参数写进日志（有意为之）。

> 验证记录（小 Hono app + `app.request()` 实测）：`/ok`→`["after-next status=200"]`；`/boom`→`["onError:BOOM","after-next status=500"]`（onError 先跑、next 不抛、status 已是 500）；`/nope`→`["after-next status=404"]`。

### onError 处理器

```
console.error(formatErrorLine(c.req.method, c.req.path, err, now()))
return c.html("<p>出错了。<a href='/'>返回</a></p>", 500)
```

- 自定义 `onError` 会替换 Hono 默认处理器，因此**必须自己 `console.error`**，否则丢失错误日志；不会与默认处理器重复打印。
- `onError` 在中间件的请求行**之前**运行（见上验证），故同一请求的错误堆栈行排在请求行前面，属正常顺序。
- 返回最简 500 HTML 页，替代 Hono 默认纯文本。

### 接入与开关（关键：不污染现有测试）

`WebOptions` 增加 `requestLog?: boolean`：
- 为 `true`：在**路由注册之前** `app.use(requestLogger())`，并 `app.onError(errorHandler())`。中间件必须在路由前注册（Hono 中间件顺序敏感，注册晚于路由则不生效）。
- 默认 / `false`：两者都不挂——现有 `index.test.ts`（不传该选项）行为不变、无噪音。

`startServer` 传 `requestLog: true`，故本地 daemon 与生产 `serve` 都开启。

### 测试

- `request-log.test.ts`：`formatRequestLine` / `formatErrorLine` 纯函数单测，注入固定 `now`，断言精确字符串。
- 中间件 + onError：构造一个挂了「正常路由」和「抛错路由」的小 Hono app，用 `app.request()` 触发，spy `console.log`/`console.error`：① 正常请求 → `console.log` 收到格式化请求行、响应正常；② 抛错请求 → 返回 500、`console.error` 收到错误堆栈行、`console.log` **收到** status=500 的请求行（两条互补日志）。
- 现有 `index.test.ts` 不改动。

### 已知取舍

- **500 页对 API 端点也返回 HTML**：`PATCH /captures/:id/read` 等返回 204/JSON 的端点出错时会收到 HTML 500 页。错误罕见且 HTML 可读，可接受，不单独处理。
- 请求日志依赖 Phase 1 的 tee 才会落文件；若 `requestLog: true` 但未经 `serve()`（未安装 tee）直接用 `createApp`，日志只到 stdout——这正是 `startServer` 始终经由 `serve()` 的原因。

### Phase 2 影响文件

- 新建 `packages/web/src/request-log.ts` + `packages/web/src/request-log.test.ts`
- `packages/web/src/index.ts`：`WebOptions` 加 `requestLog?`、`createApp` 条件挂载中间件与 onError、`startServer` 传 `requestLog: true`

## 影响文件

- `packages/cli/src/commands/web.ts`（日志 sink、tee、`logs`/`serve` 子命令、`openBrowser` 选项、纯函数）
- `packages/cli/src/commands/web.test.ts`（新增测试）
- `docs/configuration.md`（生产部署一节）
