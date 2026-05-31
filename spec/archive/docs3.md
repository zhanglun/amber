# Amber 产品思考记录（2026-05-30）

## 当前阶段结论

本次讨论最大的收获是：

**Amber 目前不应该继续讨论数据库、向量检索、AI、RAG 等技术细节。**

因为产品形态尚未完全明确。

技术方案应该服务于产品形态，而不是反过来。

---

# Amber 是什么

Amber 的定位已经基本明确：

> Amber 是一个 Personal Knowledge Pipeline。

目标是帮助用户完成：

```text
获取信息
↓
保存信息
↓
阅读信息
↓
管理信息
↓
发现信息
↓
利用信息
```

其中当前阶段只聚焦前三步：

```text
获取信息
↓
保存信息
↓
阅读信息
```

后续：

```text
搜索
关联
AI
```

属于未来阶段。

---

# 用户真实痛点

目前用户（我自己）的真实使用流程：

```text
阅读文章
↓
觉得有价值
↓
保存
↓
未来重新阅读
```

主要内容来源：

* 技术博客
* GitHub
* 文档
* 论文
* 公众号
* 网页文章

目前方案：

```text
Dino
↓
Markdown
↓
Obsidian
```

存在问题：

* 同步体验一般
* 多设备访问麻烦
* 保存与阅读割裂
* 收藏内容容易吃灰
* 长期管理体验不好

---

# Dino 与 Amber 的关系

已经明确：

```text
Dino
=
Capture Engine

Amber
=
Knowledge Engine
```

职责划分：

## Dino

负责：

```text
URL
↓
Markdown
↓
Assets
```

目标：

```text
稳定抓取
标准化输出
```

---

## Amber

负责：

```text
Markdown
↓
存储
↓
阅读
↓
管理
```

目标：

```text
长期沉淀知识
```

---

# 关于 CLI 优先

本次讨论中一个重要纠偏：

CLI 优先 ≠ 开发者产品。

CLI 优先的原因是：

```text
开发快
验证核心能力快
自动化友好
Agent友好
```

而不是：

```text
只给程序员使用
```

---

Amber 最终依然是一个有 GUI 的产品。

CLI 只是第一阶段的能力验证入口。

---

# Amber 未来的产品形态

当前判断：

Amber 最终会拥有：

```text
CLI
+
Web
+
Desktop
```

---

但开发顺序应该是：

```text
CLI
↓
Web
↓
Desktop
```

原因：

CLI 最容易验证核心能力。

---

# Amber 第一阶段的用户流程

## 导入内容

用户执行：

```bash
amber import https://xxx.com
```

Amber 内部：

```text
Amber
↓
Dino
↓
Markdown
↓
Import
↓
Store
```

完成保存。

---

## 查看内容

用户执行：

```bash
amber serve
```

启动：

```text
localhost:7788
```

打开浏览器访问。

---

## 阅读内容

用户在 Web UI 中：

```text
查看文章
阅读文章
管理文章
```

---

# 对产品形态的新理解

此前曾经陷入：

```text
CLI 产品
vs
GUI 产品
```

的错误讨论。

实际上：

CLI 与 GUI 只是不同入口。

核心应该是：

```text
Amber Core
```

提供：

```text
Import
Storage
Search
Sync
```

能力。

---

然后：

```text
CLI
Web
Desktop
```

都调用同一套能力。

---

# 当前不要讨论的内容

以下内容暂时不进入设计：

* AI
* Agent
* RAG
* 向量检索
* 知识图谱
* 协同编辑
* Tiptap
* Canvas

原因：

这些都不是当前核心问题。

---

# 当前最需要回答的问题

Amber 最终的产品界面应该长什么样？

即：

用户导入了 1000 篇文章之后。

打开 Amber。

第一眼应该看到什么？

这将决定：

```text
Amber 是：

Reader
Library
Workspace
还是其他形态
```

这个问题尚未最终确定。

因此下一阶段应该继续围绕：

```text
获取
保存
阅读
```

三个场景深入设计产品交互。

而不是进入数据库和技术架构设计。

---

# 当前阶段共识

Amber 的第一目标不是：

```text
AI知识库
```

也不是：

```text
第二大脑
```

而是：

> 帮助用户将收集到的内容长期保存，并在未来能够方便地重新阅读和利用。

这是产品的原点。

后续所有设计都应该围绕这个目标展开。
