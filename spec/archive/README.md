# 归档：设计定稿前的讨论草稿

本目录下的文档是 Amber 在 **2026-05-30 设计定稿之前**的讨论记录与早期草稿，**均已被正式设计文档取代**：

> 正式设计：[`docs/superpowers/specs/2026-05-30-amber-v1-design.md`](../../docs/superpowers/specs/2026-05-30-amber-v1-design.md)

保留它们仅作历史参考，**不应作为当前架构或实现的依据**。

## 文档清单

| 文件 | 内容 | 现状 |
|---|---|---|
| `docs0.md` | 最早的项目讨论总结（痛点 → 定位 → MVP → 技术栈 → 开发阶段） | 精华已吸收进正式 spec；保留原始痛点叙述 |
| `docs1.md` | 6 张架构/ER/流程图 | ⚠️ **已过时且与现方案冲突**：基于 NestJS / monorepo / pgvector，与现在的 Node + Supabase + R2 + 三层架构不一致。请勿参考 |
| `docs2.md` | 竞品对比 + 产品定位 | 竞品分析已提取为正式项目文档：[`docs/competitive-analysis.md`](../../docs/competitive-analysis.md) |
| `docs3.md` | 产品思考纠偏（技术服务产品、CLI 先行、聚焦获取/保存/阅读） | 已完全吸收进正式 spec |

## 为什么归档而不是删除

这些草稿记录了项目从"想做 Notion 类笔记软件" → 认清"真正要做的是 Knowledge Pipeline"的认知转变过程。docs0 的原始痛点叙述、docs2 的竞品判断在写 README / 产品介绍时仍有引用价值，因此保留。

特别提醒：**docs1 的架构图是历史错误方向的产物**（正是当时"AI 陷进技术细节"的典型），翻阅时切勿与正式 spec 的架构混淆。
