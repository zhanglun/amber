# PKP（Personal Knowledge Pipeline）项目讨论总结

## 一、项目起源

最初的问题来自于个人知识管理的实际痛点：

### 当前工作流

```text
阅读网页
↓
使用 dino 抓取
↓
保存为 Markdown
↓
导入 Obsidian
↓
长期积累
```

### 遇到的问题

#### 1. 跨设备同步困难

Obsidian 本质是本地文件系统。

虽然可以借助：

* iCloud
* Dropbox
* Syncthing
* Git

实现同步，但体验并不理想。

---

#### 2. 知识越来越多

随着时间推移：

```text
100篇
↓
1000篇
↓
5000篇
```

收藏越来越多。

但出现问题：

```text
收藏 ≠ 使用
```

很多内容：

```text
保存了
↓
忘了
↓
找不到
↓
重新搜索
```

---

#### 3. 工具链割裂

目前链路：

```text
网页
↓
抓取工具
↓
Markdown
↓
Obsidian
↓
搜索
↓
AI
```

由多个工具组成。

用户需要在不同系统之间切换。

---

## 二、核心认知转变

最开始的想法是：

```text
做一个类似 Notion 的系统
```

后来发现方向不对。

---

### 真正的问题不是笔记

不是：

```text
如何编辑
```

而是：

```text
如何利用
```

---

### 真正的问题是

```text
发现
↓
保存
↓
整理
↓
关联
↓
检索
↓
利用
↓
输出
```

整个链路没有打通。

---

因此项目本质不是：

```text
Note App
```

而是：

```text
Knowledge Pipeline
```

---

## 三、产品重新定义

### 产品定位

```text
Personal Knowledge Pipeline
```

一句话描述：

> 将收集到的信息转化为长期可复用的知识资产。

---

### 不是什么

不是：

* Notion
* Obsidian
* Logseq

---

### 更像什么

```text
Readwise
+
Raycast
+
Perplexity
+
Knowledge Base
```

---

## 四、核心 Pipeline

系统核心：

```text
Capture
↓
Normalize
↓
Enrich
↓
Store
↓
Recall
↓
Synthesis
```

---

### 1. Capture

采集层。

输入：

```text
URL
Markdown
PDF
GitHub
RSS
```

---

目前已经有：

```text
DINO
```

能力。

---

### 2. Normalize

标准化。

所有来源统一为：

```yaml
KnowledgeItem
```

结构。

---

### 3. Enrich

AI增强。

生成：

```text
Summary
Keywords
Embedding
Related
```

---

### 4. Store

存储。

方案：

```text
PostgreSQL
+
Cloudflare R2
```

---

### 5. Recall

知识召回。

支持：

```text
全文搜索
语义搜索
主题聚合
```

---

### 6. Synthesis

知识综合利用。

例如：

```text
总结
研究报告
学习路线
博客草稿
```

---

## 五、DINO 在系统中的定位

讨论过程中发现：

实际上最有价值的部分已经存在。

---

### DINO

当前能力：

```bash
dino https://xxx.com
```

输出：

```text
article.md
assets/
```

---

这意味着：

```text
Capture
```

已经完成。

---

### DINO 应保持独立

职责：

```text
Capture Engine
```

输入：

```text
URL
```

输出：

```text
Markdown
Assets
Metadata
```

---

不建议与知识库系统强耦合。

---

## 六、PKP 应承担的职责

PKP 不负责抓取。

PKP 负责：

```text
Markdown
↓
KnowledgeItem
↓
Store
↓
Search
↓
Recall
↓
AI
```

---

## 七、核心数据模型

系统核心对象：

```yaml
KnowledgeItem
```

---

建议结构：

```yaml
id:
title:
content:
source_url:
source_type:
summary:
tags:
created_at:
captured_at:
assets:
```

---

未来：

```text
网页
PDF
Markdown
笔记
```

都转换成：

```text
KnowledgeItem
```

---

## 八、MVP 重新定义

### 不做

暂时不做：

* 知识图谱
* Agent
* 协同编辑
* Tiptap
* Notion Clone
* Canvas

---

### 只做

#### 输入

```text
Markdown
URL
```

---

#### 存储

```text
PostgreSQL
R2
```

---

#### 输出

```text
搜索
阅读
```

---

### MVP 目标

一句话：

> 今天保存一篇文章，明天换设备依然能快速找到并阅读。

---

## 九、产品形态

### 首页

Inbox

```text
最近收藏
```

---

### Search

```text
搜索所有知识
```

---

### Reading

```text
Markdown阅读器
```

---

### AI Workspace（后续）

```text
问自己的知识库
```

---

## 十、Tauri 的角色

最开始认为：

```text
桌面应用 = 产品
```

---

后来发现：

```text
Knowledge Engine = 产品
```

---

而：

```text
Tauri
Web
Mobile
```

只是客户端。

---

### Tauri 定位

```text
Knowledge Workbench
```

知识工作台。

---

而不是：

```text
Markdown Editor
```

---

## 十一、推荐技术栈

### Desktop

```text
Tauri
React
shadcn/ui
```

---

### Backend

```text
NestJS
```

---

### Database

```text
PostgreSQL
```

---

### Vector

```text
pgvector
```

---

### Storage

```text
Cloudflare R2
```

---

### AI

```text
OpenAI Compatible API
```

---

## 十二、下一阶段开发顺序

### Phase 1

定义：

```typescript
KnowledgeItem
```

模型。

---

### Phase 2

实现：

```bash
pkp import xxx
```

导入 DINO 产物。

---

### Phase 3

实现：

```bash
pkp search xxx
```

全文搜索。

---

### Phase 4

实现：

```text
Tauri Reader
```

阅读器。

---

### Phase 5

接入：

```text
Postgres
R2
```

实现跨设备同步。

---

### Phase 6

增加：

```text
Summary
Embedding
Recall
AI Workspace
```

---

## 最终定位

```text
Personal Knowledge Pipeline
```

不是：

```text
笔记软件
```

而是：

> 一个把收集到的信息持续转化为可复用知识资产的系统。
