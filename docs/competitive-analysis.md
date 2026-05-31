# Amber 竞品分析与定位

> 整理自早期讨论（原 `spec/archive/docs2.md`），作为正式项目文档保留。
> 关联设计文档：[`superpowers/specs/2026-05-30-amber-v1-design.md`](./superpowers/specs/2026-05-30-amber-v1-design.md)

## Amber vs 现有产品

| 维度 | Amber（规划） | Obsidian | Readwise Reader | Mem | Reflect |
|---|---|---|---|---|---|
| 核心定位 | Knowledge Pipeline | 本地知识库 | 阅读器 | AI Notes | Second Brain |
| 第一入口 | 收藏网页 | 写笔记 | 收藏内容 | 写笔记 | 写笔记 |
| 数据格式 | Markdown First | Markdown First | SaaS 数据 | SaaS 数据 | SaaS 数据 |
| 本地优先 | ✅ | ✅ | ❌ | ❌ | ❌ |
| Web 采集 | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Markdown 导入 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ |
| 静态资源管理 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| 跨设备同步 | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 搜索 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| AI 问答 | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 数据所有权 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐ |
| 开发者友好 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ |
| 可迁移性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐ |
| 自托管潜力 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ | ❌ | ❌ |

> 注：星级为早期主观自评，用于判断方向，非精确测评。其中"跨设备同步 ⭐⭐⭐⭐"是对规划目标的预期，v1 本身不实现同步逻辑（详见设计文档 §5）。

## 各能力的最强产品

| 能力 | 最强产品 |
|---|---|
| 网页抓取 | Dino（自有） |
| Markdown 管理 | Obsidian |
| 阅读体验 | Readwise Reader |
| AI 组织 | Mem |
| 第二大脑 | Reflect |

Amber 想做的是把这几者的核心能力串成一条链：`Dino + Obsidian + Readwise + Mem`。

## 从 Pipeline 角度看缺口

每个竞品都只覆盖 Pipeline 的一段：

- **Obsidian**：`Markdown → Store → Search`，缺 **Capture**
- **Readwise**：`Capture → Read → Recall`，缺 **Ownership（数据所有权）**
- **Mem**：`Notes → AI → Recall`，缺 **Capture** 和 **Markdown**
- **Amber**：`Capture → Markdown → Store → Search → Recall → AI`，完整闭环

## 用户真实问题对照

| 用户问题 | Obsidian | Readwise | Mem | Amber |
|---|---|---|---|---|
| 收藏网页 | 😐 | 😀 | 😐 | 😀 |
| 保存完整内容 | 😐 | 😀 | 😐 | 😀 |
| Markdown 归档 | 😀 | 😐 | 😐 | 😀 |
| 数据属于自己 | 😀 | 😐 | 😐 | 😀 |
| 跨设备访问 | 😐 | 😀 | 😀 | 😀 |
| 搜索历史收藏 | 😀 | 😀 | 😀 | 😀 |
| AI 问自己的资料 | 😐 | 😀 | 😀 | 😀 |
| 自建知识资产 | 😀 | 😐 | 😐 | 😀 |

## 定位结论

不宣传"AI Knowledge Base"（太泛），也不宣传"Second Brain"（已被用滥）。直接定义为：

> **Amber 是一个 Markdown-First Knowledge Pipeline，帮助你把网页、文档和笔记沉淀为长期可检索、可关联、可对话的个人知识资产。**

这条定位与 `Dino → Amber` 完全闭环：

```
发现 → Dino → Markdown → Amber → 搜索 → 回忆 → 利用
```

且这条链路来自真实痛点，而非为追 AI 热点拼凑的功能集合。
