这是我基于我们讨论的方向整理的一份对比表。

## Amber vs 现有产品

| 维度         | Amber（规划）          | [Obsidian](https://obsidian.md?utm_source=chatgpt.com) | [Readwise Reader](https://readwise.io/read?utm_source=chatgpt.com) | [Mem](https://mem.ai?utm_source=chatgpt.com) | [Reflect](https://reflect.app?utm_source=chatgpt.com) |
| ---------- | ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------- | ----------------------------------------------------- |
| 核心定位       | Knowledge Pipeline | 本地知识库                                                  | 阅读器                                                                | AI Notes                                     | Second Brain                                          |
| 第一入口       | 收藏网页               | 写笔记                                                    | 收藏内容                                                               | 写笔记                                          | 写笔记                                                   |
| 数据格式       | Markdown First     | Markdown First                                         | SaaS数据                                                             | SaaS数据                                       | SaaS数据                                                |
| 本地优先       | ✅                  | ✅                                                      | ❌                                                                  | ❌                                            | ❌                                                     |
| Web采集      | ⭐⭐⭐⭐⭐              | ⭐                                                      | ⭐⭐⭐⭐⭐                                                              | ⭐⭐                                           | ⭐⭐                                                    |
| Markdown导入 | ⭐⭐⭐⭐⭐              | ⭐⭐⭐⭐⭐                                                  | ⭐⭐                                                                 | ⭐⭐                                           | ⭐⭐                                                    |
| 静态资源管理     | ⭐⭐⭐⭐⭐              | ⭐⭐⭐                                                    | ⭐⭐⭐                                                                | ⭐⭐                                           | ⭐⭐                                                    |
| 跨设备同步      | ⭐⭐⭐⭐               | ⭐⭐                                                     | ⭐⭐⭐⭐⭐                                                              | ⭐⭐⭐⭐⭐                                        | ⭐⭐⭐⭐⭐                                                 |
| 搜索         | ⭐⭐⭐⭐               | ⭐⭐⭐⭐                                                   | ⭐⭐⭐⭐                                                               | ⭐⭐⭐⭐⭐                                        | ⭐⭐⭐⭐                                                  |
| AI问答       | ⭐⭐⭐⭐               | ⭐⭐                                                     | ⭐⭐⭐⭐                                                               | ⭐⭐⭐⭐⭐                                        | ⭐⭐⭐⭐                                                  |
| 数据所有权      | ⭐⭐⭐⭐⭐              | ⭐⭐⭐⭐⭐                                                  | ⭐⭐                                                                 | ⭐                                            | ⭐                                                     |
| 开发者友好      | ⭐⭐⭐⭐⭐              | ⭐⭐⭐⭐⭐                                                  | ⭐⭐                                                                 | ⭐⭐                                           | ⭐⭐                                                    |
| 可迁移性       | ⭐⭐⭐⭐⭐              | ⭐⭐⭐⭐⭐                                                  | ⭐⭐                                                                 | ⭐                                            | ⭐                                                     |
| 自托管潜力      | ⭐⭐⭐⭐⭐              | ⭐⭐⭐                                                    | ❌                                                                  | ❌                                            | ❌                                                     |

---

## 真正的竞争维度

如果把产品拆开：

| 能力         | 最强产品                                                               |
| ---------- | ------------------------------------------------------------------ |
| 网页抓取       | Dino（你的）                                                           |
| Markdown管理 | [Obsidian](https://obsidian.md?utm_source=chatgpt.com)             |
| 阅读体验       | [Readwise Reader](https://readwise.io/read?utm_source=chatgpt.com) |
| AI组织       | [Mem](https://mem.ai?utm_source=chatgpt.com)                       |
| 第二大脑       | [Reflect](https://reflect.app?utm_source=chatgpt.com)              |

而 Amber 想做的是：

```text
Dino
+
Obsidian
+
Readwise
+
Mem
```

---

## 从 Pipeline 角度看

### Obsidian

```text
Markdown
↓
Store
↓
Search
```

缺：

```text
Capture
```

---

### Readwise

```text
Capture
↓
Read
↓
Recall
```

缺：

```text
Ownership
```

---

### Mem

```text
Notes
↓
AI
↓
Recall
```

缺：

```text
Capture
Markdown
```

---

### Amber

```text
Capture
↓
Markdown
↓
Store
↓
Search
↓
Recall
↓
AI
```

完整闭环。

---

## 我认为最重要的一张表

### 用户真实问题

| 用户问题       | Obsidian | Readwise | Mem | Amber |
| ---------- | -------- | -------- | --- | ----- |
| 收藏网页       | 😐       | 😀       | 😐  | 😀    |
| 保存完整内容     | 😐       | 😀       | 😐  | 😀    |
| Markdown归档 | 😀       | 😐       | 😐  | 😀    |
| 数据属于自己     | 😀       | 😐       | 😐  | 😀    |
| 跨设备访问      | 😐       | 😀       | 😀  | 😀    |
| 搜索历史收藏     | 😀       | 😀       | 😀  | 😀    |
| AI问自己的资料   | 😐       | 😀       | 😀  | 😀    |
| 自建知识资产     | 😀       | 😐       | 😐  | 😀    |

---

## 我对 Amber 的最终定位

不要宣传：

```text
AI Knowledge Base
```

太泛了。

也不要宣传：

```text
Second Brain
```

已经被用烂了。

我会直接定义：

> **Amber 是一个 Markdown-First Knowledge Pipeline，帮助你把网页、文档和笔记沉淀为长期可检索、可关联、可对话的个人知识资产。**

这个定位和：

```text
Dino → Amber
```

是完全闭环的：

```text
发现
↓
Dino
↓
Markdown
↓
Amber
↓
搜索
↓
回忆
↓
利用
```

而且这条链路恰好来自你自己的真实痛点，而不是为了追 AI 热点硬拼出来的功能集合。
