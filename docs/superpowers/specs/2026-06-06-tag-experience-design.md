# 标签体验闭环 设计

> 日期：2026-06-06
> 状态：已确认，待实现计划
> 关联：[Capture 元数据丰富化计划](../plans/2026-06-05-capture-metadata-enrichment.md)、[CLI v1 产品文档](./2026-05-31-amber-cli-v1-product.md)

## 背景

Capture 元数据丰富化已落地：`tags?: string[]` 字段、`Store.updateTags` / `ReadService.updateTags`、`PATCH /captures/:id/tags` 端点都已存在并测试覆盖。`ReadService.list()` 返回的 `CaptureSummary` 也已携带 `tags`。

但标签在用户侧是「死的」：

- Web 列表页、文章页**都不展示标签**，也无任何编辑入口。
- 列表页搜索框只过滤标题/来源，不涉及标签。
- CLI 没有任何标签命令。

本设计补齐标签的**展示 → 编辑 → 按标签筛选 → CLI** 闭环。**不改动存储层与数据契约**，仅涉及前端、CLI，以及一个归一化纯函数。

## 目标

1. Web 列表页：顶部标签栏筛选（多选，OR 语义）；卡片展示标签并可内联编辑。
2. Web 文章页：meta 下方可编辑标签区。
3. CLI：`amber tag ls/add/rm` 子命令。
4. 标签归一化在单一收口点完成，web 与 CLI 行为一致。

## 非目标（YAGNI）

- 标签重命名 / 合并
- 标签计数徽标、标签颜色
- CLI 全局 `amber tags`（列出所有标签）
- 服务端标签索引 / 搜索（数据量大时再议）

## 架构与组件

### 1. 归一化（唯一收口点）

`packages/core` 新增纯函数：

```typescript
export function normalizeTags(tags: string[]): string[];
```

行为：对每个元素去首尾空格 → 丢弃空串 → 去重（保留首次出现，**原样大小写**，区分大小写比较）。

在 `ReadService.updateTags(id, tags)` 内部调用 `normalizeTags` 后再委托 `store.updateTags`。这样 **web 的 PATCH 端点和 CLI 两条写入路径都经过同一处归一化**，无需在多处重复逻辑。

### 2. Web 列表页（`packages/web/src/render.ts` + `scripts.ts`）

**顶部标签栏**：

- 服务端从全部 items 的 `tags` 汇总去重，按出现顺序渲染成可切换胶囊：`[ 全部 ] [ react ] [ 前端 ] …`。
- 多选；选中多个时为 **OR**（条目命中任一激活标签即显示）。
- 「全部」为重置项：点击清空所有激活标签。
- 若没有任何标签，整条标签栏不渲染。

**卡片**：

- 摘要下方渲染该条的标签 chip。卡片上的 chip 是**展示 + 编辑**（每个带 `✕`，末尾 `[ + ]`）；**不是筛选触发器**——筛选只由顶部标签栏驱动。
- 每个 `.item` 增加 `data-tags` 属性，值为该条标签的 **JSON 数组**（`escapeHtml` 后写入），供筛选脚本精确读取每个标签。
- 卡片内嵌一个 `.tag-editor[data-capture-id]` 区块（含每个标签的 `✕` 与末尾 `[ + ]`），与文章页共用编辑脚本。

**筛选脚本**（扩展现有 `getListFilterScriptHtml`）：

- 将「搜索框文本」与「激活标签集（OR）」合并判断每个 `.item` 的可见性。
- 搜索框对标题/来源仍是**子串**匹配；标签筛选是**精确成员**匹配（区分大小写），二者为 AND 关系（既要满足搜索、又要命中任一激活标签）。
- 联动更新分组 `[data-group]` 的可见性与 `.count`。
- 可判定的匹配逻辑抽成可导出纯函数 `tagFilterMatch(itemTags, activeTags, query, title, host)` 以便单测；DOM 脚本本身保持现有「薄脚本字符串」风格，调用等价逻辑。
- **已知取舍**：顶部标签栏是页面加载时的服务端快照。通过编辑器新增一个此前不存在的全新标签后，标签栏需刷新页面才会出现该标签（卡片上的 chip 则即时更新）。可接受。

### 3. Web 文章页（`packages/web/src/render.ts`）

`meta` 段下方渲染一条可编辑标签区 `.tag-editor[data-capture-id]`：

- 现有每个标签为一个 chip，带 `✕` 删除。
- 末尾 `[ + ]` 触发新增（输入标签名）。

### 4. 编辑脚本（列表卡片与文章页共用）

`scripts.ts` 新增一个通用脚本，处理页面上所有 `.tag-editor[data-capture-id]` 块：

- **新增**：用户输入 → 读当前标签 → 追加 → `PATCH /captures/:id/tags` 发送**全量**数组 → DOM 乐观更新。
- **删除**：点 `✕` → 读当前标签 → 过滤 → 同样发送全量数组 → DOM 乐观更新。
- 复用同一段逻辑，不区分列表/文章。

> 端点 `PATCH /captures/:id/tags` 已是「整体替换」语义，归一化在 `ReadService.updateTags` 内完成，前端无需额外处理。

### 5. CLI（`packages/cli/src/commands/tag.ts`）

```
amber tag ls  <id>            列出某条的标签
amber tag add <id> a b c      追加标签（经 normalizeTags 去重）
amber tag rm  <id> a          移除标签
```

- 均通过 `readService.get(id)` 读现状、`readService.updateTags(id, …)` 写回。
- 每个位置参数视为**一个标签**；含空格的标签需用引号（`amber tag add <id> "machine learning"`）。
- `add`：现状 ∪ 新标签 → updateTags（归一化在 service 内）。
- `rm`：现状 ∖ 指定标签（区分大小写精确匹配）→ updateTags。
- `ls`：打印当前标签（空时给出提示）。
- 未找到 id：报错并非 0 退出码。
- 注册进 CLI 主入口（`main.ts` 的 `subCommands`）。

## 数据流

```
[Web 编辑] tag-editor → PATCH /captures/:id/tags (全量)
                                  │
[CLI 编辑] amber tag add/rm ──────┤
                                  ▼
                    ReadService.updateTags(id, tags)
                                  │ normalizeTags
                                  ▼
                       Store.updateTags(id, tags)

[Web 筛选] 顶部标签栏 + 搜索框 → 客户端 tagFilterMatch (OR) → 控制 .item 可见性
```

## 错误处理

- PATCH 端点对未知 id 已返回 404（现状保留）。
- CLI 对未知 id 报错退出。
- 前端编辑乐观更新；本设计不引入失败回滚（与现有 read 进度上报一致，best-effort）。

## 测试

- **core**：`normalizeTags` 单测（去空格 / 去空串 / 去重 / 保留大小写）；`ReadService.updateTags` 委托前确实归一化。
- **web/render**：标签栏汇总去重渲染；卡片渲染 `data-tags` 与标签 chip；文章页渲染可编辑标签区；无标签时不渲染标签栏。
- **web/scripts**：`tagFilterMatch` 纯函数单测（标签精确成员 OR、与搜索子串 AND、空激活集=不约束、子串不误命中如 `re` 不匹配 `react`）。
- **cli**：`tag add/rm/ls` 用假 `readService`（仿 `web.test.ts` 模式）验证读—改—写与边界（未知 id、空标签）。

## 文件变更一览

| 文件 | 变更 | 职责 |
|------|------|------|
| `packages/core/src/tags.ts` | Create | `normalizeTags` 纯函数 |
| `packages/core/src/tags.test.ts` | Create | `normalizeTags` 单测 |
| `packages/core/src/index.ts` | Modify | barrel 导出 `normalizeTags` |
| `packages/core/src/read-service.ts` | Modify | `updateTags` 调用 `normalizeTags` |
| `packages/core/src/read-service.test.ts` | Modify | 断言归一化 |
| `packages/web/src/render.ts` | Modify | 标签栏、卡片标签、文章页编辑区 |
| `packages/web/src/render.test.ts` | Modify | 标签渲染断言 |
| `packages/web/src/scripts.ts` | Modify | 扩展筛选脚本、共用编辑脚本、`tagFilterMatch` |
| `packages/web/src/scripts.test.ts` | Modify | `tagFilterMatch` 单测 |
| `packages/web/src/styles.ts` | Modify | 标签 chip / 标签栏 / 编辑区样式 |
| `packages/cli/src/commands/tag.ts` | Create | `amber tag` 子命令 |
| `packages/cli/src/commands/tag.test.ts` | Create | CLI 命令测试 |
| `packages/cli/src/main.ts`（主入口） | Modify | `subCommands` 注册 `tag` 命令 |
