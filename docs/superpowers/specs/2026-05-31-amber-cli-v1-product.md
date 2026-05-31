# Amber CLI v1 产品文档

> 日期：2026-05-31
> 状态：已确认，待技术方案 / 实现
> 关联：[整体架构与 v1 设计](./2026-05-30-amber-v1-design.md)、[v1 技术方案](./2026-05-31-amber-v1-technical-design.md)

本文定义 Amber CLI v1 的命令面与各命令的用户可见行为。聚焦"用户怎么用、看到什么"，不含实现细节（见技术方案）。

## 1. 定位

Amber CLI 是 v1 阶段唯一入口。它把"导入 → 管理 → 阅读"三件事用三个同级命令暴露：

```
amber import <url>   导入一篇网页
amber list           列出已导入的内容
amber web            启动本地网页阅读
```

CLI 先行是为了快速验证核心能力、对自动化/agent 友好；不代表 Amber 只给开发者用（GUI 是后续阶段）。

## 2. 命令面

### 2.1 顶层命令（同级）

| 命令 | 作用 |
|---|---|
| `amber import <url>` | 抓取并保存一篇网页 |
| `amber list` | 列出已保存的内容 |
| `amber web` | 启动本地 web 阅读服务（默认后台运行） |

### 2.2 `web` 的子命令

| 命令 | 作用 |
|---|---|
| `amber web` | 启动 web 服务（后台），打印访问地址 |
| `amber web status` | 查看 web 服务状态 |
| `amber web stop` | 停止 web 服务 |

### 2.3 全局选项

| 选项 | 作用 |
|---|---|
| `--json` | 以 JSON 输出，供脚本 / agent 消费（人类可读为默认） |

## 3. 各命令行为

### 3.1 `amber import <url>`

- 输入：一个网页 URL（用户自己粘贴）。
- 过程：显示进度（抓取中…），完成后报告结果。
- 成功输出（人类可读）：
  ```
  ✓ Imported as <id>
    Markdown · wikipedia.org · 1,234 words
  ```
- 去重：若该 URL 已导入，直接返回既有 id，不重复抓取，提示 `Already imported as <id>`。
- 失败：打印错误原因，退出码非 0。
- `--json` 输出：`{ "id": "...", "title": "...", "sourceUrl": "...", "deduped": false }`

### 3.2 `amber list`

- 列出已保存内容，按导入时间倒序。
- 人类可读，每条显示：标题、来源站点、时间、（可选）摘要首行。
  ```
  Markdown                        wikipedia.org   2026-05-31
    Plain text markup language used to format...
  <id>
  ```
- 空状态：`No captures yet. Run: amber import <url>`
- `--json` 输出：`CaptureSummary[]`（含 id/title/sourceUrl/siteName/excerpt/createdAt）。

### 3.3 `amber web`

- 默认**后台运行**：启动后立即返回，打印访问地址，终端可继续做别的事。
  ```
  ✓ Amber web started at http://localhost:7788
    Logs: ./amber-data/web.log   Stop: amber web stop
  ```
- 端口：默认 `7788`，可用 `--port` 或环境变量 `AMBER_PORT` 覆盖。
- 若已在运行：提示 `Amber web is already running at http://localhost:<port>`，不重复启动。

### 3.4 `amber web status`

- 运行中：
  ```
  ● running
    URL:   http://localhost:7788
    PID:   12345
    Logs:  ./amber-data/web.log
  ```
- 未运行：`○ stopped`
- `--json`：`{ "running": true, "pid": 12345, "port": 7788, "url": "...", "logFile": "..." }`

### 3.5 `amber web stop`

- 运行中：优雅停止，输出 `✓ Amber web stopped`。
- 未运行：提示 `Amber web is not running`（不报错，幂等）。

## 4. Web 阅读界面（`amber web` 打开后）

### 4.1 列表页（首页 `/`）

每条内容以"成品感"卡片展示，包含：

- **标题**（链接到文章页）
- **来源**（站点名 siteName）
- **时间**（导入或发布时间）
- **摘要**（excerpt，一两行）
- **缩略图**（coverImage，若有）

空状态：提示去用 `amber import`。

### 4.2 文章页（`/captures/:id`）

- 返回列表的链接
- 标题、来源链接
- 正文（Markdown 渲染为干净 HTML，图片来自本地 `/blobs`）

## 5. 数据展示目标

列表页要达到"像成品阅读器"的观感——不是只有标题和 URL，而是标题 + 来源 + 时间 + 摘要 + 缩略图。为此 Capture 需携带 `siteName` / `excerpt` / `coverImage` / `wordCount` 等展示字段（数据契约见技术方案）。

## 6. 不做（v1 CLI 范围外）

- 搜索、删除、编辑、标签
- 账号 / 同步
- 浏览器扩展 / 分享菜单
- `web` 的多实例 / 端口自动分配
- 远程访问（web 仅本机）

这些待后续阶段。
