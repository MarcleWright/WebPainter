# ADR-0002: 浮动选区状态与稳定资源的 WebGPU 预览

Status: Accepted for prototype design, 2026-11-05。用户已确定主线并要求创建验证任务; 实现执行尚未授权。

## Context

4K 评估确认普通选区移动的像素重写、内容边界扫描和缩略级别重建有明显成本。PhotoCraft 普通 Move 的浮动状态与正式文档分开, 但仍为新位置构造显示结果; 其 Ctrl+T 有缓存纹理预览。原生并行不能直接当成 TypeScript/Web 的性能保证。

## Decision

- 采用“稳定底图 + 浮动选区 + 位移”的暂态结构, 扩展 WebPainter 已有 WebGPU 图层内合成。
- 拖动中持续显示完整效果; 正式图层/选区像素松手后写入, 维持现有一次拖动一次撤销。
- 输入合并、块级边界缓存和缩略资源复用是配套优化; CPU 作为提交、参考及未支持场景回退。
- 不将“逐位置像素改写的批量复制优化”继续列为同等未决的主路线。准备/提交可复用其技术。
- 先用 [任务 02](../tasks/2026-11-05_02_4k-selection-preview-prototype.md) 验证 RGB 8 位的有限场景。验证不通过时报告具体原因, 不自动扩为完整重构。

## Consequences

文档现在应区分“主线已选定”与“效果未验证”。保留当前文档、历史、PSD 及 CPU 合成基础, 不引入新 Rust/WASM 依赖, 不照搬 PhotoCraft 跨拖动延迟 drop 的历史分组方式。

本决策不是性能承诺、正式产品全场景支持或执行授权。技术 owner 见 [INTERACTIVE_PREVIEW](../../architecture/INTERACTIVE_PREVIEW.md), 产品目标见 [PERFORMANCE_DIRECTION](../../product/PERFORMANCE_DIRECTION.md)。
