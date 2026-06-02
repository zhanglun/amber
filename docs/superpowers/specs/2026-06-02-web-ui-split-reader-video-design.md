# Amber Web UI 分栏阅读与视频渲染设计

## 背景

当前 Web UI 已经具备主题切换、搜索、时间分组、文章渲染和代码高亮。主要体验问题是列表页和详情页分离：打开一篇文章后，用户看不到其他已保存内容，切换文章需要回到列表。

下一轮优化应保持列表紧凑，不改成卡片流。Amber 更像个人资料库 / 阅读器，界面应像“左侧资料库，右侧阅读区”的工作台。

最近导入的小红书内容也会包含本地视频 blob。当前 Markdown 中视频表现为普通链接，例如 `[▶ video](/blobs/captures/<id>/2.mp4)`。文章渲染时应把这类链接转为原生 `<video>` 播放器。

## 目标

- 桌面端使用两栏阅读布局：左侧 capture 列表，右侧文章内容。
- 列表保持紧凑、可扫描，不做卡片化。
- 保留现有分组、搜索、主题切换、Markdown 渲染和代码高亮。
- `/captures/:id` 渲染同一个分栏布局，并高亮当前选中文章。
- `/` 渲染同一个分栏布局，默认选中最新一篇 capture。
- 将本地视频链接渲染为 `<video controls preload="metadata">`。
- 为本地视频 blob 返回正确 MIME 类型。
- 保持服务端渲染，不引入前端框架。

## 不做

- 不做卡片式列表。
- 不扩展摘要、缩略图、coverImage 等列表展示字段。
- 不做 Web UI 删除 / 重抓按钮。
- 不引入客户端路由或 SPA 状态模型。
- 不做远程访问、多用户或同步相关 UI。

## 布局

桌面端使用一个 app shell：

```text
┌───────────────────────┬──────────────────────────────────────────┐
│ Amber  [搜索] [主题]   │ 文章标题 / 来源 / 字数                    │
│ 本周                  │                                          │
│   当前标题             │ 正文内容                                  │
│   其他标题             │ 图片、代码块、视频                         │
│ 上周                  │                                          │
│   ...                  │                                          │
└───────────────────────┴──────────────────────────────────────────┘
```

左侧栏是固定宽度的紧凑列表，保留现有“本周 / 上周 / 更早”分组。右侧阅读区展示当前文章，正文内部继续使用现有阅读宽度约束。

推荐桌面尺寸：

- 侧栏宽度：`320px`，最小 `280px`，最大 `360px`。
- 阅读区：占满剩余宽度。
- 正文内部最大宽度：继续保持约 `680px`。
- app shell 使用视口高度，侧栏和正文可以独立滚动。

移动端先做简单降级：

- 窄屏下改为单列布局。
- `/` 先显示列表，再显示默认选中的最新文章。
- `/captures/:id` 保留紧凑的返回 / 导航区域，并清晰展示文章内容。
- 本轮重点是桌面端阅读效率，移动端只需不破版。

## 路由行为

Hono app 的两个主要路由都需要读取列表：

- `GET /`：读取所有 captures，选择 `readService.list()` 的第一条作为当前文章，再渲染分栏布局。
- `GET /captures/:id`：读取所有 captures，再读取指定 capture，渲染同一个分栏布局并高亮当前行。

无数据时：

- 仍渲染 Amber header / 搜索 / 主题壳。
- 阅读区显示现有空状态：`No captures yet. Run: amber import <url>`。

找不到 `/captures/:id` 时：

- 返回 404。
- 本轮用简单 not-found 页面即可，不需要渲染完整分栏壳。

## 渲染结构

继续用 TypeScript 字符串渲染。`render.ts` 可以拆出小 helper，但不必引入新框架。

建议结构：

- `renderLibrary(items, selectedCapture)`：新的主渲染函数，组装完整分栏页面。
- `renderSidebar(items, selectedId)`：渲染左侧列表、分组、搜索属性和 active 状态。
- `renderReader(capture | null)`：渲染右侧文章或空状态。
- `renderArticleContent(capture)`：渲染标题、meta 和 Markdown 正文。

现有 `renderList(items)` 和 `renderArticle(capture)` API 可以调整，但必须同步更新 Hono handler 和测试。

## 左侧紧凑列表

每个列表项保持轻量：

- 标题最多一到两行。
- 来源 hostname 和日期使用 muted 文本。
- 当前选中文章有 active 状态。
- 本轮不在侧栏加视频标记，避免为了标记去扩展 `CaptureSummary` 或读取更多数据。

搜索继续在客户端完成：

- 按标题和来源过滤。
- 隐藏空分组。
- 更新分组计数。
- 被选中项可见时保留 active 样式。

## 视频渲染

Markdown 渲染器识别指向本地视频文件的链接：

- `.mp4`
- `.webm`
- `.ogv`
- `.mov`

当链接目标匹配上述扩展名时，渲染为：

```html
<figure class="video-embed">
  <video controls preload="metadata" src="/blobs/captures/.../2.mp4"></video>
  <figcaption><a href="/blobs/captures/.../2.mp4">Open video</a></figcaption>
</figure>
```

保留 figcaption 中的 fallback 链接，避免浏览器无法播放时资源不可达。URL 和文本都需要 HTML escape。

这段逻辑应放在 Markdown 渲染层。当前 `highlight.ts` 负责 Markdown-it 初始化，因此优先在其中添加自定义 link renderer。

## Blob MIME 类型

`packages/web/src/index.ts` 的 MIME 表补充：

- `.mp4`: `video/mp4`
- `.webm`: `video/webm`
- `.ogv`: `video/ogg`
- `.mov`: `video/quicktime`

未知扩展继续回退为 `application/octet-stream`。

## 样式

在保留现有主题 CSS variables 的基础上新增分栏阅读样式：

- `.app-shell`
- `.sidebar`
- `.reader`
- `.sidebar-header`
- `.sidebar-item`
- `.sidebar-item.active`
- `.reader-inner`
- `.video-embed`
- `.video-embed video`

视觉原则：

- 不做大卡片。
- 不加装饰背景。
- 不做 hero 化标题。
- 优先保证扫描、切换和阅读效率。

## 测试

新增或更新聚焦测试：

- `/` 路由渲染最新 capture 到右侧阅读区。
- `/captures/:id` 渲染侧栏和选中文章。
- 侧栏选中文章包含 active 状态。
- 现有搜索属性仍存在。
- Markdown 视频链接渲染为 `<video controls preload="metadata">`。
- video blob 扩展名返回正确 MIME 类型。

现有 render 测试需要从“列表页 / 详情页分离”调整为“同一分栏壳中的列表和阅读区”。

## 实现注意事项

- 按小步实现：先分栏布局，再视频渲染，最后补 MIME 类型。
- 不改 domain 字段。
- 不改 import / reimport 行为。
- 如果 `render.ts` 变得过大，先在同文件内拆 helper；只有在明显提升可读性时再新增模块。
