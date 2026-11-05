# 产品定位

## 目的与用户

WebPainter 面向汽车设计师的二维草图和图像编辑工作, 希望提供接近熟悉的 PS 操作习惯的空间: 手绘板绘画、图层、文字、钢笔路径与选区、局部移动和变换、蒙版、基础图像调整、PSD 交换。

产品价值是让设计师能反复试位置、改比例、叠加说明, 不必为工具能力缺口重新搭建工作流。界面和基础能力优先复用 Celenne, 再处理真实设计任务暴露的缺口。

当前预期用户规模约百人, 这是投入与验证范围的规划依据, 不是已确认的现有用户数。原型优先用有限真实工作负载验证核心收益, 避免提前建设完整平台和兼容性验证设施; 单个客户端的 4K 性能与结果正确性仍需保证。

## 当前状态

- fork: [MarcleWright/WebPainter](https://github.com/MarcleWright/WebPainter), 上游 [Celenne Studio](https://github.com/puripooh5-cloud/celenne-studio)。本轮源码基线 `a659900384aee878f01e4caae183a666acc7959b`。
- 本地构建和自带 10 图层 PSD 的启动检查通过。该样例只有 96 x 64 像素, 不能证明 4K 性能或完整 PSD 兼容。
- 用户试用认为功能和 UI 比 Klecks 更符合需求; 这是选型输入, 不代表全部功能已验收。
- 用户观察到 4K 选区移动卡顿和分块更新; 已有隔离测量支持进一步优化, 见 [评估](../engineering/4K_SELECTION_ASSESSMENT.md)。
- 仓库名为 WebPainter, 当前应用内名称、图标和包身份仍沿用上游。品牌替换尚未开展。

## 核心约束

- 完全离线运行是目标要求。核心绘画、编辑、保存与导出不能依赖在线模型、远程 iframe、CDN 或在线认证; 全流程离线验收尚未完成。
- 未来可作为 Auto Design Agent 的编辑能力基底。当前仍是独立工程, 未接入 ADA 的 Canvas、Artifact、生成结果或 Provider。
- 优先解决常见 2D 设计任务。3D、整套 PS 等价实现、移植 PhotoCraft 全部 Rust 引擎不属于当前阶段。
- 后续 AI 生成入口不应成为基本编辑的依赖。ComfyUI 或本地 Agent Provider 是未来集成方向, 不是当前已实现能力。
- 上游代码和第三方许可分别保留。改作另一个产品前需处理名称/图标; 许可原文以根 [LICENSE](../../LICENSE) 为准。

性能优先级与建议目标由 [PERFORMANCE_DIRECTION](PERFORMANCE_DIRECTION.md) 维护。
