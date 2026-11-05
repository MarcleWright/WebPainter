# 工作进展索引

## Recent

### 2026-11-05 浮动选区主线与原型任务规划

Status: 方案与任务文档已创建; 原型执行未授权、未开展。

- 确定浮动选区状态 + 稳定资源 WebGPU 图层内合成, CPU 作参考、提交与回退。
- 保留核心优化, 按用户意见将验证收缩为有限实窗前后对照、一个效果组合和小 fixture 像素/历史检查; 30fps 为参考, 完整性能/故障/资源审计后移。
- 执行安排为准备/核心/验证三个串行阶段, 启动后每阶段一次本地提交, 不逐阶段确认或自动 push; 本轮尚未执行。
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
