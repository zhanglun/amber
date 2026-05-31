# Amber CLI v1 技术方案

> 日期：2026-05-31
> 状态：已确认，待实现
> 关联：[CLI v1 产品文档](./2026-05-31-amber-cli-v1-product.md)、[v1 技术方案](./2026-05-31-amber-v1-technical-design.md)

本文把 [CLI v1 产品文档](./2026-05-31-amber-cli-v1-product.md) 落到实现层面：数据模型扩展、字段填充策略、web daemon 模型、模块改动、`--json` 约定。沿用既有架构纪律（入口薄、core 厚、契约隔离）。

## 1. 数据模型扩展（对齐未来数据库 schema）

**原则：现在 FileStore 存的 JSON 字段，就按未来 Postgres 表的完整 schema 设计，接库时数据无缝迁移、web 不改。**

`@amber/domain` 的 `Capture` 扩展为：

```ts
export interface Capture {
  id: string;
  title: string;
  content: string;        // markdown，图片链接已改写为本地/云 URL
  sourceUrl: string;
  sourceType: "url";
  author?: string;
  siteName?: string;      // 新增：来源站点名（列表展示）
  excerpt?: string;       // 新增：摘要（列表展示）
  coverImage?: string;    // 新增：封面图 URL（列表缩略图；走 blob）
  wordCount?: number;     // 新增：正文字数
  createdAt: string;      // ISO 8601
  capturedAt: string;     // ISO 8601
}

export type CaptureSummary = Pick<
  Capture,
  "id" | "title" | "sourceUrl" | "siteName" | "excerpt" | "coverImage" | "createdAt"
>;
```

- 4 个新字段全部 `optional`：旧数据、缺失值都安全。
- `CaptureSummary` 扩展出列表页需要的展示字段（siteName/excerpt/coverImage），避免列表为了摘要去读全文。
- `RawCapture`（Source 产出）按需扩展，详见 §3。

## 2. 字段填充策略（渐进增强）

每个字段按"谁能现在算"分两批；缺的由 amber 兜底，dino 未来返回后无缝替换。

| 字段 | 来源 | v1 实现 |
|---|---|---|
| `wordCount` | amber 算 | 从 markdown 估算词数（按空白/CJK 字符） |
| `siteName` | amber 算 | 从 `sourceUrl` 取主域名（如 `en.wikipedia.org` → `wikipedia.org`） |
| `excerpt` | dino（未来）→ amber 兜底 | dino 暂未提供；amber 从正文取前 ~200 字（去除 markdown 标记/图片）作摘要 |
| `coverImage` | dino（未来）→ amber 兜底 | dino 暂未提供；amber 取正文第一张图的 URL（改写后的 blob URL） |

**无缝替换机制**：填充逻辑集中在 core 的 `ImportService`（或一个 `enrich` 纯函数）。当 dino 的 `RawCapture` 带上 `excerpt`/`coverImage` 时优先用之，否则用兜底。判断即 `raw.excerpt ?? deriveExcerpt(content)`。

### 2.1 兜底纯函数（可单测）

放在 `@amber/core`：

```ts
// core/src/enrich.ts
export function countWords(markdown: string): number;        // 词数估算（拉丁词 + CJK 字符）
export function deriveSiteName(sourceUrl: string): string;   // 主域名
export function deriveExcerpt(markdown: string, max?: number): string; // 去标记后截断
export function deriveCoverImage(markdown: string): string | undefined; // 第一张图 URL
```

这些是纯函数，输入字符串输出字符串/数字，全部 TDD 单测。

## 3. RawCapture 与填充时机

`RawCapture` 增加可选的 enrich 字段（dino 未来可填，现为 undefined）：

```ts
export interface RawCapture {
  title: string;
  markdown: string;
  author?: string;
  publishedAt?: string;
  excerpt?: string;     // 新增：dino 未来提供
  coverImage?: string;  // 新增：dino 未来提供（原始引用，随 assets 一起改写）
  assets: Asset[];
}
```

**填充发生在 ImportService**，且在图片占位符替换**之后**（这样 coverImage 兜底取到的"第一张图"已是最终 blob URL）：

```
import 流程（更新）：
1. 去重 findBySourceUrl
2. source.capture(url) → RawCapture
3. 上传 assets，替换占位符 → 得到最终 content
4. enrich：
   wordCount  = countWords(content)
   siteName   = deriveSiteName(url)
   excerpt    = raw.excerpt ?? deriveExcerpt(content)
   coverImage = raw.coverImage(改写后) ?? deriveCoverImage(content)
5. 组装 Capture（含新字段）
6. store.insert
```

> coverImage 若来自 dino 的原始引用，需和正文图片一样参与占位符→blob URL 改写；v1 dino 不提供，故走 `deriveCoverImage(content)` 从已改写正文取首图，天然是 blob URL。

## 4. Web daemon 模型（`amber web` 后台化）

### 4.1 文件位置（amber-data 下）

| 文件 | 内容 |
|---|---|
| `amber-data/web.pid` | 运行中 web 进程的 PID + 端口（JSON：`{ pid, port }`） |
| `amber-data/web.log` | web 进程的 stdout/stderr |

### 4.2 `amber web`（启动）

- 用 `child_process.spawn` 以 **detached** 方式启动一个真正跑 Hono 服务的入口（如 `@amber/cli` 的 `web-daemon.ts`，或 `main.ts` 的隐藏子命令 `web __run`）。
- 父进程：把子进程 stdout/stderr 重定向到 `web.log`，`unref()` 后立即退出，打印 url。
- 子进程：启动 Hono 服务，写 `web.pid`（含实际端口），进程存活即服务存活。
- 已运行检测：启动前读 `web.pid`，若进程存活则提示"already running"，不重复启动。
- 端口：`--port` > `AMBER_PORT` > 默认 7788。

### 4.3 `amber web status`

- 读 `web.pid`：
  - 文件不存在 → stopped
  - 存在但进程已死（`process.kill(pid, 0)` 抛错）→ stopped，并清理残留 pid 文件
  - 存在且进程活 → running，显示 pid/port/url/logFile

### 4.4 `amber web stop`

1. 读 `web.pid`；无 → 提示 not running（幂等，退出码 0）。
2. `process.kill(pid, "SIGTERM")`（优雅）。
3. 轮询最多 ~3 秒等进程退出；仍在则 `SIGKILL` 兜底。
4. 删除 `web.pid`，输出 stopped。

### 4.5 进程存活判断

统一用 `process.kill(pid, 0)`：不发信号、只探测——成功=活，抛 ESRCH=死。

## 5. 模块改动清单

| 包 | 改动 |
|---|---|
| `@amber/domain` | `Capture` + 4 字段；`CaptureSummary` 扩展；`RawCapture` + excerpt/coverImage |
| `@amber/core` | 新增 `enrich.ts`（4 个纯函数，TDD）；`ImportService` 接入 enrich；`ReadService` 无需改（list 返回扩展后的 summary，由 Store 提供） |
| `@amber/adapters` | `FileStore.list()` 返回扩展 summary 字段；`DinoSource` 透传 dino 未来的 excerpt/coverImage（现为 undefined） |
| `@amber/web` | 列表页 `renderList` 升级为卡片（标题/来源/时间/摘要/缩略图） |
| `@amber/cli` | `web` 命令重构为 start/status/stop；新增 daemon 逻辑；`--json` 支持；`import`/`list` 输出格式按产品文档 |

> 注：`Store.list()` 现在返回 `CaptureSummary[]`，扩展字段后 FileStore 需在 summary 里带上 siteName/excerpt/coverImage——FileStore 读的是完整 Capture JSON，挑字段即可，无额外存储。

## 6. `--json` 约定

- 每个命令在 `--json` 下输出**单个 JSON 值**到 stdout，无多余日志（日志走 stderr）。
- `import` → `{ id, title, sourceUrl, deduped }`
- `list` → `CaptureSummary[]`
- `web status` → `{ running, pid?, port?, url?, logFile? }`
- `web` / `web stop` → `{ ok: true, ... }`

## 7. 测试策略

| 层 | 测什么 | 方式 |
|---|---|---|
| core/enrich | countWords/deriveSiteName/deriveExcerpt/deriveCoverImage | 纯函数单测 |
| core/ImportService | enrich 字段被正确填充、dino 值优先于兜底 | 内存假实现单测 |
| adapters/FileStore | list 返回新 summary 字段 | 临时目录单测 |
| web/render | 列表卡片含标题/来源/摘要/缩略图 | 字符串断言单测 |
| cli/daemon | 进程存活判断、stop 幂等 | 端到端手动 + 可选脚本验证 |

daemon 的 start/status/stop 全链路以**手动端到端**为主验收（起服务→status→curl→stop）。

## 8. 实现顺序（供写计划参考）

1. domain 扩展字段
2. core/enrich 纯函数（TDD）
3. ImportService 接入 enrich
4. FileStore.list 带新字段
5. web 列表卡片升级
6. cli web daemon（start/status/stop）+ --json
7. 重新导入真实文章，刷新 amber-data，浏览器端到端验收
