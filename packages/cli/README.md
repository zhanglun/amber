# @amber/cli

Amber 的命令行工具 —— Personal Knowledge Pipeline。

通过 CLI 可以将网页内容抓取为本地知识条目、浏览已保存的内容、或启动本地 Web UI 阅读。

## 前置条件

本项目位于 monorepo 内，需先在根目录安装依赖：

```bash
pnpm install
```

CLI 入口通过 `tsx` 直接运行 TypeScript，无需预编译。

## 命令总览

```bash
amber <command> [args]
```

| 命令 | 说明 |
|------|------|
| `import` | 将网页 URL 抓取并保存到本地 |
| `list` | 列出所有已保存的条目 |
| `web` | 启动或管理本地 Web UI（后台守护进程模式） |

---

### `amber import <url>`

抓取指定网页并保存为本地知识条目。

```bash
amber import https://example.com/article
```

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `url` | positional | ✅ | 要抓取的网页 URL |

如果抓取到的内容为空（如页面需要登录、被反爬拦截或付费墙），会输出警告提示。

**输出示例：**

```
✔ Imported as abc123
ℹ Saved to ./amber-data/captures/abc123.json
```

---

### `amber list`

列出所有已保存的知识条目。

```bash
amber list
```

**输出示例：**

```
│ abc123  示例文章标题
│         https://example.com/article
│ def456  另一篇文章
│         https://example.com/another
ℹ 2 capture(s)
```

---

### `amber web`

以守护进程模式启动本地 Web UI，自动打开浏览器。

```bash
amber web
amber web --port 3000
```

**参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `--port` | string | `7788` | 服务监听端口 |

Web UI 以后台进程运行，终端可继续使用。支持以下子命令：

#### `amber web status`

查看 Web UI 运行状态（URL、PID、启动时间等）。

```bash
amber web status
```

#### `amber web stop`

停止 Web UI 后台进程。

```bash
amber web stop
```

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AMBER_DATA_DIR` | `./amber-data` | 数据存储根目录 |
| `AMBER_PORT` | `7788` | `web` 命令的默认端口（可被 `--port` 参数覆盖） |

## 数据目录结构

```
amber-data/
├── captures/       # 抓取的条目元数据（JSON）
├── blobs/          # 抓取的原始内容（HTML 等）
└── .web.pid        # Web UI 守护进程 PID 文件（自动管理）
```
