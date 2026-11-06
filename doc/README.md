# WebPainter 文档入口

本目录记录 WebPainter fork 自己的产品目标、设计约束、技术建议和验证。原作者的 [README](../README.md)、[CHANGELOG](../CHANGELOG.md)、[NOTES_FOR_ARTCRAFT](../NOTES_FOR_ARTCRAFT.md) 与 `docs/` 保留原貌。

## 从哪里开始

| 你想了解 | 主要文档 |
| --- | --- |
| 项目面向谁、与 ADA 的关系 | [产品定位](product/PRODUCT_BRIEF.md) |
| 为什么优化 4K、先做什么、怎样算有效 | [产品性能方向](product/PERFORMANCE_DIRECTION.md) |
| 拖动时看什么、什么时候落定、怎样撤销 | [交互约定](design/INTERACTION_RULES.md) |
| 原有结构与 fork 的边界 | [架构入口](architecture/ARCHITECTURE_OVERVIEW.md) |
| 预览与正式数据如何分工 | [交互预览主线](architecture/INTERACTIVE_PREVIEW.md) |
| 原型具体验证什么、怎样判定 | [原型验证任务 02](ai/tasks/2026-11-05_02_4k-selection-preview-prototype.md) |
| 去掉实验开关、默认接入优化 | [默认接入任务](ai/tasks/2026-11-06_01_default-gpu-selection-move.md), 已实现, 复审要求修复 |
| 稳定保存与关闭, 修复路径回归 | [保存与关闭可靠性任务](ai/tasks/2026-11-06_02_save-close-reliability.md), 方案已通过, 待 coder 实施 |
| PhotoCraft 值得借鉴什么 | [PhotoCraft 源码对照](architecture/PHOTOCRAFT_REFERENCE.md) |
| 4K 问题证据、测量限制与成本 | [4K 评估](engineering/4K_SELECTION_ASSESSMENT.md) |
| 本地运行和远程配置 | [开发环境](engineering/DEV_SETUP.md) |
| 怎样验证、哪些还没有验证 | [验证约定](engineering/TESTING.md) |
| 当前已知缺口 | [已知问题](engineering/KNOWN_ISSUES.md) |
| 后续 AI 如何继续 | [当前上下文](ai/AI_CONTEXT.md)、[协作规则](ai/AI_WORKFLOW.md)、[进展索引](ai/DEV_LOG.md) |
| 原始证据 | [材料入口](material/README.md) |

## 两套文档的责任

- `docs/`: 保留的上游实现说明、历史计划与原作者基准。其原有生成脚本继续拥有自己的输出, 不改写为本 fork 的实施状态。
- `doc/`: 本 fork 的主要知识入口, 不复制整套上游说明。当前源码行为需要以代码核对, 发生差异时由这里说明差异和证据。
- 稳定规则每项只有一个主要归属; 其他文件通过链接引用。历史过程在 `ai/tasks/`, 不堆进需求或 AI_CONTEXT。
- 采用此分工的决策见 [ADR-0001](ai/decisions/ADR-0001_documentation-ownership.md)。

## 状态标记

- **已观察**: 用户试用现象, 尚不等于标准化性能测量。
- **已核对**: 对固定源码版本的确认, 不等于运行验收。
- **已测量**: 写明数据、环境、路径与限制。
- **建议 / 待验证**: 后续候选方案和指标, 不代表用户已授权实施。
- **已实现 / 已验收**: 必须各有代码和相应验证证据。

Task 02 已按受限性能优化原型判为 Go: 自动检查、独立复审与用户实际试用支持其可用性。完整人工场景和正式化验证仍有未覆盖项; 默认接入已实现但复审要求修复保存/关闭问题, 关联任务及人工与发布验收见上表。品牌替换、ADA 接入未实施。
