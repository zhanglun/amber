# Amber 接入数据库前的改进计划

> **背景：** v1 核心流程已跑通（import → 文件存储 → web 阅读）。在接入 Postgres/R2 之前，先把产品体验和数据模型打扎实。
>
> **参考：** [v1 实现计划](./2026-05-31-amber-v1-implementation.md)

---

## 一、补全基础 CRUD

用起来最迫切的数据管理操作。

- [x] `amber import --force <url>`：跳过去重，强制重新抓取并覆盖旧内容
- [x] `amber delete <id>`：删除一条 capture（JSON 文件 + blobs）
- [x] `amber reimport <id>`：用已有 capture 的 sourceUrl 重新抓取并覆盖

---

## 二、Web UI 阅读体验

Amber 的核心价值是「阅读」，现在的 CSS 是最简占位。

- [ ] 中文排版优化：字体栈、行高（1.8）、段落间距、最大宽度收窄至 680px
- [ ] 代码块语法高亮（highlight.js 或 shiki，按需加载）
- [ ] 暗色模式（`prefers-color-scheme` media query）
- [ ] 文章页显示字数统计和预计阅读时间（中文按 300 字/分钟）
- [ ] 列表页显示字数和抓取日期

---

## 三、列表页搜索与过滤

文件存储下内容都在本地，纯前端就够用。

- [ ] 实时搜索框：按 title / sourceUrl 过滤（前端 JS，无需后端接口）
- [ ] 按抓取时间排序切换（最新 / 最早）
- [ ] 显示来源域名 favicon（`https://www.google.com/s2/favicons?domain=...`）

---

## 四、Capture 模型扩展（为数据库热身）

现在改 schema 零成本，上 Postgres 后就是加列。

- [ ] 添加 `updatedAt: string`（ISO 8601）字段，import/reimport 时更新
- [ ] 添加 `tags?: string[]` 字段，预留给后续分类
- [ ] `Store` 接口加 `delete(id: string): Promise<void>`
- [ ] `Store` 接口加 `search(q: string): Promise<CaptureSummary[]>`（FileStore 用 includes 实现，PostgresStore 用 ILIKE）
- [ ] `FileStore` 实现上述两个新方法

---

## 五、Import 体验优化

- [ ] 批量导入：`amber import --from <file>`，逐行读取 URL，失败跳过并汇报
- [ ] 导入完成后打印 web 详情页链接（`http://localhost:7788/captures/<id>`）
- [ ] 失败重试：dino browser 模式超时时自动重试一次

---

## 进度说明

各任务用 `[x]` 标记已完成，`[~]` 标记进行中。完成一个大块后在此记录日期和备注。

| 模块 | 状态 | 备注 |
|------|------|------|
| 一、基础 CRUD | ✅ 完成 | 2026-06-01 |
| 二、阅读体验 | 未开始 | |
| 三、搜索过滤 | 未开始 | |
| 四、模型扩展 | 未开始 | |
| 五、Import 优化 | 未开始 | |
