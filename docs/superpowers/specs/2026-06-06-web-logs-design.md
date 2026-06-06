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
4. **同一套日志输出在未来 Node.js 生产部署下同样可用**：本地 daemon 落文件、生产前台跑交给 supervisor 捕获，serve() 代码无需分叉。

## 非目标（YAGNI）

- 不做结构化 JSON 日志 / 日志级别系统。
- 不接入外部日志聚合（Loki/ELK 等）——生产环境由部署平台负责，本设计只保证「输出到 stdout/stderr」这一契约。
- 不做单个长跑进程跨午夜的实时文件轮转（见下「已知局限」）。

## 核心理念：一套输出，两种落点

serve() 进程始终把日志写到 **stdout/stderr**（通过 console、Hono 默认错误处理等）。落点由运行方式决定：

| 运行方式 | 场景 | 日志落点 | 查看方式 |
|---------|------|---------|---------|
| `amber web`（自守护，daemon） | 本地开发 | `spawnDaemon` 重定向 stdout/stderr → 当天日志文件 | `amber web logs` |
| `amber web serve`（前台） | 生产部署 | 继承父进程 stdout/stderr | supervisor（systemd `journalctl` / `docker logs` / `pm2 logs`） |

这样 serve() 自身不感知落点，本地与生产共用同一份日志代码。

## 设计

### 1. 日志捕获机制（方案 A：spawn 时重定向 stdio）

`spawnDaemon` 把 `stdio: "ignore"` 改为 `["ignore", fd, fd]`，`fd` 指向当天日志文件（以 append 模式打开）。后台进程的所有 stdout/stderr 原样落盘，**服务端代码零改动**。

选型理由：相比「在 serve() 内自建 rotating logger」（方案 B），方案 A 改动最小、能捕获到未捕获异常和框架原始输出，且天然兼容生产前台模式（前台时这些流直接流向 supervisor）。代价是文件名按进程启动日确定，长跑进程跨天不切文件——对本地工具可接受。

### 2. 日志文件布局

- 目录：`<dataDir>/logs/`（`dataDir` 即 `AMBER_DATA_DIR`，默认 `./amber-data`）
- 文件名：`web-YYYY-MM-DD.log`（按 daemon 启动日，本地时区）
- 写入：append（`flag: "a"`），同一天多次 `restart` 续写同一文件
- 保留：每次 `start` / `restart` 启动前，清理 `logs/` 下文件名日期早于「今天 − keepDays」的 `web-*.log`，`keepDays` 默认 **7**

### 3. `amber web logs` 子命令

```
amber web logs [--lines=N] [--follow]
```

- 默认：读「最新的」`web-*.log`（按文件名日期排序取最新），打印最后 `N` 行后退出，`N` 默认 200。
- `--follow` / `-f`：打印最后 `N` 行后，持续输出文件新追加的内容（`fs.watch` 监听），`Ctrl-C` 退出。
- 选「最新文件」而非「当前运行进程的文件」，使服务停止后仍能查看最后一次崩溃日志。
- 无任何日志文件时：提示 `No logs yet. Start the web UI first.`。

### 4. 生产前台入口 `amber web serve`

将后台进程内部用的 serve 行为暴露为公开子命令 `amber web serve [--port]`：**前台运行、不自守护、不写文件**，日志直接走 stdout/stderr。生产部署用它配合 supervisor。

- 现有内部 `_AMBER_WEB_BG=1` daemon 触发路径保留不变（`spawnDaemon` 仍走它），本子命令是面向部署的稳定入口。
- 文档（`docs/configuration.md`）补一节「生产部署」：示例 systemd unit / Docker CMD 用 `amber web serve`，并说明日志看 `journalctl -u amber` / `docker logs`。

### 5. 应用级日志（提升 dev 与 prod 日志质量）

当前 Hono app 无显式 `onError`、无请求日志。为让捕获到的日志真正有用：

- 在 `createApp` 注册 `app.onError`：`console.error` 打印带时间戳的错误堆栈，返回 500。
- 注册 Hono `logger()` 请求中间件（输出 `method path status` 到 stdout）。

这两项对本地文件日志和生产 stdout 同时受益。请求日志若觉得噪音过大，可作为后续可选项，本期至少保证 `onError` 打印堆栈。

## 代码结构与可测试性

纯函数（全部单测覆盖），I/O 薄壳在外（沿用 `web.ts` 现有 `WebRuntime` 注入风格）：

- `logFileName(date: Date): string` → `web-2026-06-06.log`
- `pickLatestLogFile(filenames: string[]): string | null` → 选最新 `web-*.log`，无则 `null`
- `expiredLogFiles(filenames: string[], today: Date, keepDays: number): string[]` → 该删的文件名列表
- `lastLines(text: string, n: number): string` → 取末尾 N 行

接入点：

- `spawnDaemon`：确保 `logs/` 目录存在 → 跑保留清理 → 用 `fs.openSync(logFile, "a")` 取 fd → 作为 stdout/stderr 传给 `spawn`。
- 新增 `logs` action + `createLogsCommand`，注册进 `web` 的 `subCommands`（与 `status`/`stop`/`restart` 并列），`WEB_SUBCOMMANDS` 集合加 `"logs"`；`hasWebSubcommand` 自动覆盖。
- 新增 `serve` 子命令（`createServeCommand`），`run` 调 `actions.serve(port)` 前台运行。

## 测试

- 4 个纯函数单测，覆盖边界：文件不足 N 行、空目录、跨日期排序、`keepDays` 边界（恰好今天/恰好过期）。
- `logs` action 的「选最新文件 + 打印最后 N 行」：走注入 fs mock，断言输出。
- `serve` 子命令：复用现有 `WebRuntime` mock，断言调用了 `serve(port)`。
- `--follow` 实时流：不做自动化测试（I/O 时序不稳定），手动验证。

## 已知局限

- **跨午夜不切文件**：单个 daemon 进程持有启动时打开的 fd，跨天后仍写入启动日文件。本地开发频繁重启，影响可忽略；如未来需真·按日历日轮转，再走方案 B。
- **保留清理时机**：仅在 `start`/`restart` 时触发，纯靠 `logs` 命令不触发清理。可接受。

## 影响文件

- `packages/cli/src/commands/web.ts`（捕获重定向、新增 `logs`/`serve` 子命令与纯函数）
- `packages/cli/src/commands/web.test.ts`（新增测试）
- `packages/web/src/index.ts`（`onError` + 可选请求日志）
- `docs/configuration.md`（生产部署一节）
