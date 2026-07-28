# amber · 设计系统

> Hallmark multi-page redesign · 单一真相源。list.html 与 article.html 均读此文件。

---

## 1. Genre

**Editorial。** amber 是阅读器，不是 landing page。设计服务的唯一目标是：让文字成为主角，界面退到身后。信息密度优先，克制即精致。

参考气质：Matter / Readwise Reader 的高质量阅读质感，craigmod.com 的留白纪律，Are.na 首页的索引式纯净。

---

## 2. Macrostructure family

| 页面 | Macrostructure | 要点 |
|------|---------------|------|
| 列表页 `list.html` | **13 · Index-First** | 页面就是一列链接。无 hero 图，无叙事流。纵向分组的链接列表，hairline 分隔行，每行 tiny favicon + 标题 + 元信息。 |
| 文章页 `article.html` | **02 · Long Document** | 连续散文，像 memo / 日记。单栏 60-65ch，line-height 1.65+，inline 标题从段落中浮出，无营销结构。 |

两页共享同一设计系统：字体、配色、间距、动效、交互状态。一致性是目标。

---

## 3. Theme — OKLCH 调色

四套主题，通过 `[data-theme]` 属性切换。每套定义完整 7 token。所有颜色为 OKLCH。

### Token 定义

```css
--color-paper     /* 底色（页面背景） */
--color-paper-2   /* 次底（hover 行 / 次级面板） */
--color-ink       /* 正文文字 */
--color-ink-2     /* 次要文字（元信息、时间、host） */
--color-rule      /* hairline 分隔线 */
--color-accent    /* 链接 / 强调色 */
--color-focus     /* 焦点环 */
```

### Theme: light（默认 — 琥珀暖白）

```css
[data-theme="light"] {
  --color-paper:    oklch(97.5% 0.008 85);
  --color-paper-2:  oklch(94.5% 0.010 85);
  --color-ink:      oklch(21% 0.012 55);
  --color-ink-2:    oklch(47% 0.010 55);
  --color-rule:     oklch(89% 0.006 85);
  --color-accent:   oklch(55% 0.13 50);
  --color-focus:    oklch(52% 0.17 50);
}
```

### Theme: warm（纸张感 — 老书 sepia）

```css
[data-theme="warm"] {
  --color-paper:    oklch(95% 0.014 80);
  --color-paper-2:  oklch(92% 0.016 80);
  --color-ink:      oklch(24% 0.014 50);
  --color-ink-2:    oklch(50% 0.012 50);
  --color-rule:     oklch(85% 0.010 80);
  --color-accent:   oklch(50% 0.14 35);
  --color-focus:    oklch(48% 0.17 35);
}
```

### Theme: modern（冷调 — 现代极简）

```css
[data-theme="modern"] {
  --color-paper:    oklch(98% 0.003 245);
  --color-paper-2:  oklch(95.5% 0.004 245);
  --color-ink:      oklch(22% 0.006 245);
  --color-ink-2:    oklch(49% 0.005 245);
  --color-rule:     oklch(89% 0.003 245);
  --color-accent:   oklch(50% 0.14 235);
  --color-focus:    oklch(48% 0.17 235);
}
```

### Theme: dark（暖暗 — 夜读）

```css
[data-theme="dark"] {
  --color-paper:    oklch(16% 0.008 60);
  --color-paper-2:  oklch(20% 0.010 60);
  --color-ink:      oklch(92% 0.006 80);
  --color-ink-2:    oklch(67% 0.008 80);
  --color-rule:     oklch(29% 0.008 60);
  --color-accent:   oklch(72% 0.13 55);
  --color-focus:    oklch(74% 0.17 55);
}
```

### 用色纪律

- accent 占视口面积 ≤ 3%（链接文字、活动 chip 边框、focus 环）。
- 无渐变背景，无 `background-clip: text`，无纯黑纯白。
- 所有中性色向 anchor hue 偏移（暖主题偏暖，冷主题偏冷）。

---

## 4. Typography

### 字体配对（2+1 rule）

| 角色 | 字体 | 用途 |
|------|------|------|
| **Body + Display** | Newsreader (Google Fonts, variable serif) | 正文 + 标题。标题用大 opsz，正文用小 opsz。 |
| **UI / Meta** | Geist (Google Fonts, grotesque sans) | header、元信息行、搜索栏、排序按钮、chip、tag、footer |
| **Mono (outlier)** | Geist Mono (Google Fonts) | 仅用于代码块 + 字数/阅读时间数字。≤ 2 处。 |

### 引入方式

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,200..800&family=Geist:wght@300..700&family=Geist+Mono:wght@400..600&display=swap" rel="stylesheet">
```

### CSS 变量

```css
:root {
  --font-body:    "Newsreader", Georgia, "Songti SC", "STSong", serif;
  --font-ui:      "Geist", "PingFang SC", "Helvetica Neue", sans-serif;
  --font-mono:    "Geist Mono", "JetBrains Mono", ui-monospace, monospace;
}
```

中文 fallback：`"Songti SC"` / `"PingFang SC"` 在中文字符上回退，保证中文排版质量。

### 字号阶梯（Major Third 1.25）

```css
--text-xs:      0.75rem;   /* 12px — 极小元信息 */
--text-sm:      0.875rem;  /* 14px — 次要文字、UI */
--text-base:    1rem;      /* 16px — 列表行标题 */
--text-md:      1.125rem;  /* 18px — 正文 */
--text-lg:      1.25rem;   /* 20px */
--text-xl:      1.5rem;    /* 24px — 小标题 */
--text-2xl:     1.875rem;  /* 30px — 列表页大标题 */
--text-3xl:     2.25rem;   /* 36px */
--text-display: 2.75rem;   /* 44px — 文章页标题（大 opsz） */
```

### 排版规则

- 正文 line-height: 1.7（中文需要更宽松）。
- 标题 line-height: 1.2。
- 正文 measure: `max-width: 65ch`。
- 标题用 Newsreader opsz 轴大值（`font-optical-sizing: auto` 或手动 `font-variation-settings: "opsz" 48`）。
- 正文用 Newsreader opsz 小值（`"opsz" 14`），获得更适合屏幕阅读的字形。
- 所有标题 roman（`font-style: normal`），禁止 italic 标题。
- 段落首行不缩进（Web 惯例），段间距 = 1 个行高。

---

## 5. Spacing

4-point named scale：

```css
--space-3xs: 0.125rem;  /* 2px */
--space-2xs: 0.25rem;   /* 4px */
--space-xs:  0.5rem;    /* 8px */
--space-sm:  0.75rem;   /* 12px */
--space-md:  1rem;      /* 16px */
--space-lg:  1.5rem;    /* 24px */
--space-xl:  2rem;      /* 32px */
--space-2xl: 3rem;      /* 48px */
--space-3xl: 4rem;      /* 64px */
--space-4xl: 6rem;      /* 96px */
```

所有间距用 `var(--space-*)` token。响应式断点媒体查询中的数值除外。

---

## 6. Motion

极度克制。阅读器不需要花哨动效。

```css
--dur-fast:   100ms;
--dur-base:   150ms;
--ease-out:   cubic-bezier(0.16, 1, 0.3, 1);
--ease-in:    cubic-bezier(0.7, 0, 0.84, 0);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

### 规则

- 只动 `transform` 和 `opacity`，不动 layout 属性。
- 时长 ≤ 150ms。
- hover 状态：opacity fade / 颜色过渡，100ms。
- 主题切换：全页 `color` / `background` 属性 150ms 过渡。
- 主题切换按钮：点击无弹性动效，纯状态切换。
- `prefers-reduced-motion: reduce` → 所有动效降级为纯 opacity，时长 → 0。

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Microinteractions stance

- hover 列表行：背景从 `--color-paper` → `--color-paper-2`，150ms。
- 链接 hover：颜色 → `--color-accent`，下划线出现。
- chip/tag hover：边框色加深，无位移。
- focus ring：`outline: 2px solid var(--color-focus); outline-offset: 2px;`，`visible` only。
- active/pressed：颜色加深，无 translateY（阅读器不需要触觉感）。
- 搜索栏 focus：边框色 → accent，无发光效果。
- 主题切换按钮：active 态用 accent 色填充。
- 无 toast，无 confirmation dialog，无 loading spinner（静态设计稿无异步）。

### 8 状态覆盖

交互元素（链接、按钮、chip、搜索栏、主题切换）均设计：
default → hover → focus-visible → active → disabled → loading → error → success。

静态设计稿中 loading/error/success 为视觉定义而非实际触发。

---

## 8. Per-page allowances

### list.html — Index-First

- header：amber wordmark（Geist，无装饰） + 主题切换按钮组（4 个小圆点 / 小方块）。
- 搜索栏：全宽 input，Geist，placeholder「搜索收藏…」。
- 排序切换：文字按钮组（最新 / 最旧 / 未读），active 态用 accent。
- tag chips：横向排列，可选中，active 态 accent 边框。
- 列表主体：按周分组（本周 / 上周 / 更早），每组一个 group label（Geist 小号大写）+ 纵向链接列表。
- 每行：favicon（16px）+ 标题（Newsreader）+ 元信息行（Geist mono，host · 时间 · 阅读时间 · tag）。
- 行间 hairline rule（`border-bottom: 1px solid var(--color-rule)`）。
- 无卡片，无网格，无 icon 装饰。

### article.html — Long Document

- 返回链接（Geist，← 返回列表）。
- 文章标题：Newsreader display opsz，`--text-display`，左对齐。
- 元信息行：Geist，作者 · 时间 · 来源 · 阅读时间。
- cover 图占位：全宽 figure，带 caption（图片为纯色占位 + alt 文字）。
- 正文：`max-width: 65ch`，居中。line-height 1.7。
- inline 标题：h2 / h3 从段落流中浮出，Newsreader，`font-weight: 600`。
- blockquote：左边 2px accent 色竖线（不是粗边框），缩进，italic 正文（blockquote 内可用 italic）。
- 代码块：Geist Mono，`--color-paper-2` 背景，圆角 4px。
- 列表：自定义 marker（accent 色小圆点）。
- 底部：tags（chip 样式）+ 原文链接（accent 色）。
- 无 sidebar，无 TOC（Long Document 不隐藏 CTA 但也不堆 chrome）。

---

## 9. Anti-pattern 规避清单

| 规避项 | 如何规避 |
|--------|---------|
| 紫色渐变 hero | 无 hero，无渐变 |
| Inter-everywhere | Newsreader + Geist 配对 |
| 3 列卡片网格 | 纵向链接列表 + hairline |
| card-in-card | 无嵌套容器 |
| 侧边粗条纹卡片 | 仅 blockquote 左 2px 线 |
| 全屏居中 hero | 无 hero |
| 纯黑纯白 | OKLCH 全部 tinted |
| 渐变标题 | 纯色 ink |
| section 编号标签 | 不用（除非用户要求） |
| italic 标题 | 标题 roman，仅 blockquote 内 italic |
| emoji 装饰 | 无 |
| 重绘浏览器 chrome | 无 |
| 造假数据/指标 | 真实域名 + 真实感标题 |

---

## Hallmark · pre-emit critique（设计系统层）

```
P5  Philosophy — 阅读器本分，界面退让，文字优先
H4  Hierarchy — 标题 > 正文 > 元信息，三级清晰
E5  Execution — OKLCH 全覆盖，token 纪律严格
S4  Specificity — 琥珀暖白 + Newsreader 配 Geist，辨识度高
R5  Restraint — 无装饰，无花哨，仅 fade 动效
V4  Variety — 两页 macrostructure 不同但系统统一
```
