# 工作进展索引

## Recent

### 2026-11-06 Task 02 独立审查与局部修复安排

Status: Changes Requested 的两项 P2 已局部修复并验证, 待独立复审。

- 现有 69 项相关测试和构建通过; 额外复现确认越界连续拖动及失败后 redo 一致性问题。
- 保留三阶段成果, [任务 02 的修复调整](tasks/2026-11-05_02_4k-selection-preview-prototype.md#repair-adjustment---2026-11-06) 记录修复及验证。
- 本轮新增一个本地修复提交; 实窗体验仍未验收, 保持 Inconclusive。

### 2026-11-05 浮动选区主线与原型任务规划

Status: 受限原型已执行; 脚本前后数据和自动检查已记录, 人工窗口验收缺失, Inconclusive。

- 确定浮动选区状态 + 稳定资源 WebGPU 图层内合成, CPU 作参考、提交与回退。
- 保留核心优化, 按用户意见将验证收缩为有限实窗前后对照、一个效果组合和小 fixture 像素/历史检查; 30fps 为参考, 完整性能/故障/资源审计后移。
- 执行按准备/核心/验证三个阶段形成本地提交; 未推送。
- 不修改业务代码, 不把文档创建当成实现或验证完成。

Primary task links:

- [原型验证任务 02](tasks/2026-11-05_02_4k-selection-preview-prototype.md)
- [ADR-0002](decisions/ADR-0002_floating-selection-webgpu-prototype.md)

### 2026-11-05 文档体系与性能研究归档

Status: 文档与源码研究完成; 性能实现未开展。

- 新建 fork 自有 doc/ 与入口, 保留上游 docs/ 及根说明。
- 将既有 4K 评估提升为项目文档, 原始数据本地归档。
- 对照 PhotoCraft v0.20.2, 区分 Move 浮动选区、Ctrl+T 纹理预览与 native/Web 分支。

Primary task links:

- [文档治理与源码研究](tasks/2026-11-05_01_documentation-and-performance-research.md)

### 2026-11-05 Fork 本地环境建立

Status: 本地环境验证完成; 品牌、性能与 ADA 集成未改动。

- origin 指向 MarcleWright/WebPainter, upstream 保留 Celenne, 默认推送到 origin。
- 安装依赖和匹配 Electron, 生产 build 及隔离小 PSD smoke 通过。

Links: [DEV_SETUP](../engineering/DEV_SETUP.md)。
