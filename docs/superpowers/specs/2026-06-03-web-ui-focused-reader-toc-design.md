# Amber Web UI 专注阅读与 TOC 设计

## 背景

上一轮 Web UI 做了左侧文章列表 + 右侧阅读区的分栏布局，解决了详情页无法快速切换文章的问题。但在引入 TOC 后，三栏布局会挤压正文：左侧文章列表、中央正文、右侧 TOC 同时常驻，阅读空间不足。

新的方向是让页面职责重新分离：

- `/` 负责找文章：紧凑列表、搜索、分组。
- `/captures/:id` 负责读文章：专注正文、返回列表、右侧 TOC。

详情页不再常驻显示全部文章列表。TOC 比文章列表更贴近“阅读当前文章”的任务。

## 目标

- 详情页恢复专注阅读布局，不显示左侧文章列表。
- 详情页顶部只保留轻量导航：返回列表、来源信息、主题切换。
- 桌面端在正文右侧显示 sticky TOC。
- 移动端将 TOC 折叠到标题 / metadata 下方。
- TOC 只包含有效标题，优先展示 `h2` / `h3`。
- 少于 2 个可用标题时不显示 TOC。
- 不做上一篇 / 下一篇导航。
- 不引入前端框架或重型依赖。

## 不做

- 不保留详情页左侧文章列表。
- 不做上一篇 / 下一篇。
- 不做 TOC 当前阅读位置高亮。
- 不做可折叠多级树。
- 不扩展 domain 或 store 字段。
- 不改 import / reimport 行为。

## 页面职责

### 列表页 `/`

列表页继续作为资料库入口：

- Amber 标题。
- 搜索框。
- 主题切换。
- “本周 / 上周 / 更早”分组。
- 紧凑文章列表。

点击文章进入 `/captures/:id`。

### 详情页 `/captures/:id`

详情页只服务当前文章阅读：

```text
┌──────────────────────────────────────────────────────────────┐
│ ← 返回列表                                  [主题]            │
├───────────────────────────────────────┬──────────────────────┤
│ 标题                                  │ 目录                 │
│ 字数 · 阅读时间 · source ↗            │  - 小节一            │
│ 正文                                  │  - 小节二            │
│ 图片 / 视频 / 代码块                  │  - 小节三            │
└───────────────────────────────────────┴──────────────────────┘
```

桌面端右侧 TOC 使用 sticky 定位，随着正文滚动保持可见。正文仍保持现有阅读宽度，不被拉到全屏。

移动端：

- TOC 渲染为 `<details class="toc-mobile">`。
- 默认收起。
- 位置在标题和 metadata 下方、正文之前。
- 右侧 sticky TOC 隐藏。

## TOC 提取规则

输入是 capture 的 Markdown 正文。TOC 从 Markdown heading 行提取：

- 支持 ATX heading：`## 标题`、`### 标题`。
- 忽略 fenced code block 内的 heading-like 文本。
- 只收集 `h2` 和 `h3`。
- `h1` 不进入 TOC，因为文章标题已经在详情页顶部展示。
- 空标题忽略。

每个 heading 生成：

```ts
interface TocItem {
  level: 2 | 3;
  text: string;
  id: string;
}
```

`id` 生成规则：

- 基于 heading 文本 slug。
- 英文 / 数字转小写，空格和标点转 `-`。
- 中文保留，保证中文标题可读。
- 重复标题追加 `-2`、`-3`。
- 生成的 id 用于 TOC 链接和正文 heading。

## Markdown heading id

TOC 只有在正文 heading 带对应 `id` 时才可跳转。Markdown 渲染层需要用同一套 heading 提取结果给 `h2` / `h3` 添加 id。

推荐做法：

- 新增 `toc.ts`，负责 `extractToc(markdown)` 和 slug 逻辑。
- `renderArticle(capture)` 调用 `extractToc(capture.content)`。
- `renderMarkdown(content, { toc })` 接收可选 TOC 数据，在 Markdown-it heading renderer 中为匹配的 `h2` / `h3` 写入 id。

这样 TOC 提取和 Markdown 渲染共享同一套结果，避免两边 slug 不一致。

## 渲染结构

保留列表页当前 `renderList(items)`。

详情页建议重回独立文章渲染：

- `renderArticle(capture)`：渲染完整详情页。
- `renderArticleHeader(capture)`：返回列表、主题按钮、标题、meta。
- `renderToc(toc)`：桌面 TOC。
- `renderMobileToc(toc)`：移动折叠 TOC。
- `renderMarkdown(content, options)`：正文 HTML。

`renderLibrary(items, selectedCapture)` 可以在本次实现中移除，或暂时不再被路由使用。优先减少未使用路径，避免未来维护两个详情模型。

## 路由行为

Hono app：

- `GET /`：继续渲染列表页，不默认打开文章。
- `GET /captures/:id`：只读取指定 capture 并渲染专注详情页。
- 找不到 id：保持 404。

这会撤回上一轮 `/` 默认选择最新文章的行为。新的职责更清晰：列表页找文章，详情页读文章。

## 样式

新增或调整样式：

- `.article-shell`
- `.article-topbar`
- `.article-layout`
- `.article-main`
- `.toc`
- `.toc-title`
- `.toc-list`
- `.toc-item`
- `.toc-item.level-3`
- `.toc-mobile`

桌面建议：

- `.article-layout` 使用两栏 grid：正文 `minmax(0, 680px)` + TOC `220px`。
- TOC sticky top 约 `1rem`。
- TOC 使用小字号、muted 文本、当前不做 active 高亮。

移动建议：

- `.article-layout` 单列。
- `.toc` 隐藏。
- `.toc-mobile` 显示。

## 测试

新增 / 更新测试：

- `extractToc` 提取 h2/h3，忽略 h1。
- `extractToc` 忽略代码块中的 heading。
- `extractToc` 处理重复标题 id。
- `renderArticle` 对有 TOC 的文章输出 `.toc` 和锚点链接。
- `renderArticle` 对少于 2 个 heading 的文章不输出 TOC。
- `renderMarkdown` 给 h2/h3 添加对应 id。
- `/` 路由继续渲染列表页，不渲染文章详情。
- `/captures/:id` 渲染详情页和 TOC。

## 实现注意事项

- 继续控制文件长度，Web 源文件保持在 500 行以内。
- 优先新增 `toc.ts` 隔离 TOC 逻辑，避免 `render.ts` 继续膨胀。
- 保留已有视频渲染能力。
- 如果移除 `renderLibrary`，同步删除对应测试，避免死代码测试。
