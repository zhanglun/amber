# amber · 设计系统

> web 阅读器（`packages/web`）单一真相源。列表页 = Index-First，文章页 = Long Document。
> 三套视觉世界（editorial / ink / archive）共享同一份结构与排版纪律，仅字体、密度、配色不同。

---

## 1. Genre

**Editorial 阅读器。** amber 是阅读工具，不是 landing page。设计唯一目标：让文字成为主角，界面退到身后。信息密度优先，克制即精致。三套风格是这个命题的三个答案，不是三个产品。

## 2. 两级主题系统（核心）

```text
data-style  ── 视觉世界（字体 + 结构 + 排版）：editorial | ink | archive
data-theme  ── 情绪配色（4 种，每个世界各自诠释）：light | warm | modern | dark
```

3 × 4 = **12 种组合**。`data-theme` 的 4 个名字是「情绪槽」，语义跨风格一致：

| data-theme | 情绪 | editorial | ink | archive |
| --- | --- | --- | --- | --- |
| `light` | 日 / 明亮 | 琥珀暖白 | 日间犊皮纸 | 冷纸（标志） |
| `warm` | 纸 / 暖 | sepia 纸感 | 暗厅羊皮 | 牛皮纸归档 |
| `modern` | 冷 / 中性 | 冷调极简 | 冷调墨夜 | 蓝图 |
| `dark` | 夜 / 暗 | 暖暗夜读 | 午夜琥珀金（标志） | 碳黑 |

### 切换器 UX

- **风格切换器**（纸 / 墨 / 档 三按钮）：切 `data-style`，存 `localStorage.amber-style`。
- **配色点**（4 个）：切 `data-theme`，存 `localStorage.amber-theme`。
- **首次进入某风格时展示其标志配色**（ink→dark、archive→light、editorial→light），用 `amber-style-<style>-seen` 标记；之后保留用户选择。
- 两套切换器都出现在列表页 header 与文章页 topbar。

### 实现映射

| 关注点 | 位置 |
| --- | --- |
| 共享 token（spacing/type/motion/radius/layout） | `styles.ts` `:root` |
| editorial 4 配色 | `styles.ts` `[data-theme="..."]` |
| ink / archive 字体+结构覆盖 | `styles.ts` `[data-style="..."]` |
| ink / archive × 4 配色 | `styles.ts` `[data-style="X"][data-theme="Y"]` |
| 切换器 HTML + 脚本 | `scripts.ts` `getStyleSwitcherHtml` / `getStyleScriptHtml` / `getThemeSwitcherHtml` / `getThemeScriptHtml` |
| 字体挂载、`<html data-style data-theme>`、切换器落位 | `render.ts` `page()` / `renderList` / `renderArticle` |

## 3. 三套视觉世界

### editorial（纸）— 默认，保留既有实现

- **POV**：阅读器本分，界面退让，文字优先（参考 Matter / Readwise Reader / craigmod.com）。
- **字体**：Newsreader（正文+标题，opsz 轴）+ Geist（UI）+ Geist Mono（代码/数字）。
- **macrostructure**：列表 = 按周分组的 hairline 链接列表；文章 = 65ch 单栏、首字下沉、左侧浮动 TOC。
- 详见 `amber-redesign/design.md`（本风格的完整原始规范，仍生效）。

### ink（墨）— 深色优先夜读

- **POV**：阅读是郑重的、有仪式感的夜读。
- **字体**：Fraunces（正文+标题，opsz + WONK 轴的字符个性）+ Inter（UI）+ JetBrains Mono。
- **结构差异**：更大更表现型的首字下沉（accent 金色、opsz 144）、毛玻璃 sticky topbar、金色阅读进度条带辉光、品牌字用 Fraunces。
- **标志配色**：`dark` = 午夜琥珀金（近黑暖底 + 象牙白 + 单一琥珀金，accent 占视口 ≤3%）。

### archive（档）— 精密归档机

- **POV**：amber 是一台精密归档机，克制到极致即风格。
- **字体**：Inter（正文+UI，全 grotesque，无衬线）+ IBM Plex Mono（数据/标签/日期）。
- **结构差异**：
  - 列表行变 **3 列网格**：`[日期 MM·DD] [标题 + 元信息] [删除]`；隐藏 favicon 与相对时间，用绝对日期列替代（`<time class="item-date">`，archive 专属，默认 `display:none`）。
  - 元信息、排序、标签、章节标签全部 mono + 大写 + 字间距。
  - 文章标题 sans、紧字距、无首字下沉；h2 顶部 hairline；列表 marker 用 `+`；代码块左侧 2px 实线、无圆角。
- **标志配色**：`light` = 冷纸 + 瑞士红（红极克制，仅活动态/链接/计数）。

## 4. 配色 token（OKLCH）

7 个语义 token，每套组合都有完整定义（`styles.ts` 内）：

```text
--color-paper    底色     --color-ink     正文
--color-paper-2  次底     --color-ink-2   次要文字
--color-rule     hairline --color-accent  链接/强调
--color-focus    焦点环
```

用色纪律（三套通用）：accent 占视口面积 ≤3%；无渐变背景，无 `background-clip:text`，无纯黑纯白；所有中性色向各自 anchor hue 偏移。具体 OKLCH 值以 `styles.ts` 为准（单一真相源，不在本文档重复，避免漂移）。

深底组合（`editorial/dark`、`ink/modern`、`ink/dark`、`archive/dark`）下 Shiki 代码块自动切 `github-dark`。

## 5. 排版 / 间距 / 动效（共享）

- **measure**：正文 `--max-width: 65ch`；字号阶梯 Major Third 1.25；正文 line-height 1.7（中文更宽松），标题 1.2。
- **间距**：4-point 命名阶梯（`--space-3xs..4xl`），全部走 token。
- **动效**：极克制。只动 `transform`/`opacity`/`color`；时长 ≤150ms；`prefers-reduced-motion` 全部降级为 ~0。
- **状态**：hover/focus-visible/active/disabled 全覆盖；focus 环 `outline: 2px solid var(--color-focus)`。

## 6. 居中规则（重要）

**正文永远居中于视口，TOC 浮动在左侧边距，不挤占正文。** 三套风格共用同一实现：

```css
.article-main { max-width: var(--max-width); margin: 0 auto; }   /* 居中 */
.toc { position: fixed; left: var(--toc-left, ...); }            /* 浮动左边距 */
```

`--toc-left` 由 `getReaderEnhancementsScriptHtml` 的 `alignToc()` 按 `.article-main` 实际左边距动态计算，避免 ch 单位在不同字体下的亚像素偏差导致 TOC 与正文重叠。**禁止用两栏 grid（`[main][toc]`）把正文挤左**——那是已被废弃的旧 mockup 写法。

## 7. 反模式

无 hero / 无渐变 / 无 3 列卡片网格 / 无 card-in-card / 无渐变标题 / 无 emoji 装饰 / 无纯黑纯白 / 标题 roman（blockquote 内才 italic）/ section 编号仅在序列本身承载信息时用（archive 的日期列 OK，装饰性 01/02 不用）/ mono 只用于代码、数据、度量（不作为「技术感」戏服）。

## 8. 演进备忘

- 新增视觉世界：在 `styles.ts` 加 `[data-style="new"]`（字体+结构）+ 4 个 `[data-style="new"][data-theme="..."]` 配色；在 `scripts.ts` 的 `sig` 映射加标志配色；在 `render.ts` font link 补挂所需字族。先改本文档第 2/3 节，再落代码。
- `data-theme` 的 4 个名字是稳定的情绪槽；不要为单套风格引入第 5 个配色名。
