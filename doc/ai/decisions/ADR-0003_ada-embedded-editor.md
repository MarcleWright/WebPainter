# ADR-0003 ADA Embedded Editor And Bounded First Release

## Status

Partial owner confirmation / 2026-11-06。Owner 确认全屏界面及 main -> integration/embedded -> ADA 固定包路线; 本轮随后仅授权 03A 与 03C 有限原型。03A 已实施待独立 review；03C 总体 Inconclusive，工程暂推荐本地 iframe但不冻结选择，见 [实窗证据](../tasks/2026-11-06_03C_carrier-comparison.md#execution-report)。等待 Owner 确认承载和后续授权。

## Context

WebPainter 受限 4K 原型已可用, 最新 ef3eea8 包含后续保存关闭修复, 仍待独立复审和人工验收。Owner 要持续保留独立版并贡献上游 PR, 因此通用编辑开发与嵌入专用改造需有清晰分支边界。ADA 仍缺嵌入、native 载荷及 editor-origin 合同, React 主版本不同。

## Proposed Decision

采用现有编辑内核, 首版有限开放 sketch 工作流, 编辑时全屏遮住 Session/Canvas/Gallery。共用 embedded lifecycle、宿主端口、native codec 和平台业务, 以薄原型比较 A 直接挂载与 B 本地 iframe 后只选一种生产承载。以 ADA 原 owner 承接保存、预览和生成。原生文档是事实来源, PSD 用于交换。保留 WebGPU, Three.js 成本单独有界验证。

详细合同与未定项只归 [ADA_INTEGRATION](../../architecture/ADA_INTEGRATION.md)。这不是新数据库/接口的实施授权, 也不改变 ADA ADR-0021 的权威归属。

## Confirmed Development Route

main 保留完整独立版及通用改进; integration/embedded 持续合入 main 并提供通用嵌入能力; ADA 持有业务 adapter 并引用确定构建包。不得将整个 embedded 反向合回 main, 不维护 ADA 内部第二份 WP 编辑内核。通用修复/codec 不依赖嵌入初始化, 上游 PR 单独按上游基线整理。03A 已从 main/ef3eea8 创建 integration/embedded，未提交或合并。

## Consequences

- 少量首版入口不代表只保留几个工具文件; 隐藏功能仍需与保存/快捷键能力边界一致。
- native codec、宿主适配和 Results 交付是明确工作, 不能由现有 PSD 或可启动页面代替。
- 3D 不是当前 GPU 优化附送能力; 验证失败另行评估, 不自动扩大为 renderer 迁移。
- 03A/03C 的有限实现不自动授权 03B/D/E/F；无执行循环、无正式业务接线或提交/发布。实验 A/B 入口隔离保留，正式生产承载尚未选定。
