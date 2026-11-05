# 文档治理与性能源码研究

## Status

文档与研究完成; 性能优化实现未开展。日期: 2026-11-05。

## Task Brief

保留 Celenne 原作者 docs 体系, 为 WebPainter fork 建立分层文档。将先前临时 4K 评估提升为项目观察, 从产品与交互角度解释优化方向, 并核对 PhotoCraft 是否值得借鉴。用户明确要求使用 doc-system-governance; 本轮不实现优化、不提交或推送。

## 范围与结果

- 新建根 AGENTS 与 doc/ 的产品、架构、设计、工程、材料及 AI 入口。
- 既有测量的结果、环境、错误样本排除、工期估算和未验证项归 [4K 评估](../../engineering/4K_SELECTION_ASSESSMENT.md)。
- 核对 PhotoCraft tag v0.20.2 对应 commit 7c12f647150f8e7b2e07718f7993b1fcaa57fefe; 查看选区 float、Move 显示、Surface 位移、bounds 缓存、Ctrl+T 预览与提交和相关测试。
- 原始评估、JSON、profile 及固定源码复制到本地 material, 不把机器原件作为共享规范。
- 只在原始材料本地副本中保存代码, 没有导入 Rust 依赖, 没有移植算法。

## 关键结论归属

| 结论 | Owner |
| --- | --- |
| 跟手、连贯、结果可信和操作稳定 | [产品方向](../../product/PERFORMANCE_DIRECTION.md) |
| 一次拖动一次撤销、实时预览 | [交互约定](../../design/INTERACTION_RULES.md) |
| 稳定浮动资源和缓存的候选方向 | [预览建议](../../architecture/INTERACTIVE_PREVIEW.md) |
| PhotoCraft 两条路径与 native/WASM 差别 | [源码对照](../../architecture/PHOTOCRAFT_REFERENCE.md) |
| 上游与 fork 文档所有权 | [ADR-0001](../decisions/ADR-0001_documentation-ownership.md) |

## Validation

预设: P-DOC。检查 UTF-8/乱码、相对链接、原始材料忽略、保留 docs 与根文件、仅文档 diff。最终检查结果见本任务末尾的执行结果。

本轮未重跑性能基准、Rust 测试、完整 TS 测试或生产构建; 先前 build/smoke 与基线明确归为既有证据。无独立审查, 不创建 task_review。

## Execution Result

- 已创建 19 份入口/分层文档文件, 核对 80 个相对链接及 UTF-8/无 BOM/无乱码/无尾随空格。
- 原作者 docs/ 的 14 个文件校验值不变; 根说明、src、electron、scripts、package 与锁文件相对 HEAD 无变化。
- 本地归档 33 份原始材料, manifest 校验值一致; 加上 manifest 共 34 个文件均被材料规则忽略。
- 运行 git diff --check, 并对新增文件逐个做 no-index 空白检查。no-index 返回 1 表示新文件与空文件不同, 不把这一返回值误认为空白错误。
- 自查范围为文档结构、事实分级、链接、编码、版本、忽略规则和保留边界; 无独立审查。
- 未修改业务源码, 未执行优化、提交、推送、发布或真实 AI 服务。原始基准的不可完整一键复现限制已写入工程文档。

## Context Delta

### Keep

保留上游架构基础、一次拖动一次撤销、独立工作目录及离线产品约束。

### Changed

项目正式知识入口为 doc/; 原临时评估已提升为工程文档。PhotoCraft 比较从主观语言判断改为固定版本和具体机制。

### Avoid

不把脚本处理耗时当生产 FPS; 不把普通 Move 当 Ctrl+T; 不把 Rust native 并行当 WASM 并行; 不把文档建议当实现授权。

### Follow-up

- 受限性能原型与正式基准场景: 已提升到产品方向与 AI_CONTEXT, 等待后续任务授权。
- 复杂组合/离线/PSD 人工验收: 由 TESTING 维护, 当前未完成。
- 品牌身份: KNOWN_ISSUES 中 Deferred, 不混入性能任务。
