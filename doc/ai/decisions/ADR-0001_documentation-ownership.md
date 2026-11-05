# ADR-0001: Fork 与上游文档分工

Status: Accepted, 2026-11-05, 基于用户明确要求。

## Context

仓库已带有原作者的 docs/、README、CHANGELOG 和开发计划。用户要求保留该体系, 同时建立适合自己和 ADA 后续工作的文档系统, 将性能观察与研究落到本项目。

## Decision

- 保留原作者 docs/ 和根说明, 不搬迁、不压缩为新索引、不在本轮改写。
- 新建 doc/ 作为 WebPainter fork 的知识入口, 按 product/architecture/design/engineering/material/ai 分工。
- 以源码确认当前行为。原作者文档是上游背景, 不自动代表本 fork 已验收; 本 fork 的建议不伪装为上游实现。
- 原始参考材料默认本地忽略; 稳定结论、来源版本和测量限制写入 owner 文档, 可独立阅读。
- 根 AGENTS 只提供入口与边界, 不成为产品或架构替代品。

## Reason

保留上游历史和未来同步空间, 同时避免需求、测量、提案与实现状态混在同一套原作者说明中。

## Consequences

维护 fork 差异时先更新对应 owner, 再更新少量下游索引。若以后需同步上游文档或修正文档真相, 明确来源与改动范围, 不把历史说明静默替换为本机测试结果。

本决策只确定文档责任, 不决定性能实现路线。最新主线见 [INTERACTIVE_PREVIEW](../../architecture/INTERACTIVE_PREVIEW.md), 后续选定记录见 [ADR-0002](ADR-0002_floating-selection-webgpu-prototype.md)。
