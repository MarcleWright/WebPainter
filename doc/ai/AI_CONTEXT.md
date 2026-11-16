# 当前上下文

2026-11-16：[Dev→main→embedded→ADA集成](tasks/2026-11-16_01_dev-main-embedded-ada-integration.md)阶段0和A独立Approved；B已在integration/embedded整合已审main 4577114及A1 5924a6d，自动验证/编译通过待独立review，未构建新固定包、未推进C。B完整执行、测试与待审范围见该任务；窗口/性能/人工体验由Owner统一验收，Pending。只本地提交，不推送或发布。

- 通用WP内核由main工作树 `WebPainter_main_native` 持有；本树只单向合入main并拥有通用embedded boot/host port。ADA拥有Profile/Artifact/Results/调度，消费固定包，不复制WP内核。当前架构见[架构入口](../architecture/ARCHITECTURE_OVERVIEW.md)、[预览/后台确认](../architecture/INTERACTIVE_PREVIEW.md)。
- 现行合同port3/native1/policy1，native-only自动保存、操作完整边界seal、短COW owner保护、原codec worker及独立返回预览worker。旧固定源仍 `060b6a4` / bundle `df16465d…`，不得将新源码或编译验证追认到旧包。[端口](../architecture/EMBEDDED_PORT_V1.md)、[03D原配套证据](tasks/2026-11-06_03D_ada-document-workflow.md#autosave-local-rework-final-handoff-2026-11-09)。
- Dev的输入/Modal、min-alpha移动、Pen局部历史及路径转换已在A合入main；R4延期，ADA既有opacity长scrub多history仍未通过/待定位，人工IME/设备及完整格式验收Pending。
- [连续绘画诊断](tasks/2026-11-10_01_continuous-painting-performance-diagnosis.md)F1–F3历史证据独立提交 `326b4d7`；不将其提升为新包或本轮窗口验收。性能原始材料留ignored `doc/material/`。

先读[文档入口](../README.md)，再按任务读owner文档；实际行为以源码及当前验证为准。完整历史见任务与DEV_LOG索引。
