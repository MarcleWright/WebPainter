# 当前上下文

2026-11-16 [无感保存任务](tasks/2026-11-16_03_nonblocking-autosave-and-editing.md)：A及A1独立Approved；本树普通merge main5d5e97a与已审A1 a275a2a，B源码实现port4、输出槽与编辑分离、真实owner稳定捕获/通知及native close截止点，自动回归/编译完成，等待B独立review。尚未构建交付固定包、换ADA或推进C；证据与Pending见任务§12。只本地提交，不推送发布。

此前[跨分支集成任务](tasks/2026-11-16_01_dev-main-embedded-ada-integration.md)已独立Approved；ADA现用固定源仍d277f7c/mainBase5924a6d、bundle e1798e81，属于port3历史包，不将本轮源码/测试追认给旧包。

- 通用WP内核由main工作树 `WebPainter_main_native` 持有；本树只单向合入main并拥有通用embedded boot/host port。ADA拥有Profile/Artifact/Results/调度，消费固定包，不复制WP内核。当前架构见[架构入口](../architecture/ARCHITECTURE_OVERVIEW.md)、[预览/后台确认](../architecture/INTERACTIVE_PREVIEW.md)。
- 源码合同port4/native1/policy1，native-only自动保存、操作完整边界seal、短COW owner保护、原codec worker及独立返回预览worker。现用旧固定源 `d277f7c` / bundle `e1798e81…`，不得将新源码或编译验证追认到旧包。[端口](../architecture/EMBEDDED_PORT_V1.md)、[03D原配套证据](tasks/2026-11-06_03D_ada-document-workflow.md#autosave-local-rework-final-handoff-2026-11-09)。
- Dev的输入/Modal、min-alpha移动、Pen局部历史及路径转换已在A合入main；R4延期，ADA既有opacity长scrub多history仍未通过/待定位，人工IME/设备及完整格式验收Pending。
- [连续绘画诊断](tasks/2026-11-10_01_continuous-painting-performance-diagnosis.md)F1–F3历史证据独立提交 `326b4d7`；不将其提升为新包或本轮窗口验收。性能原始材料留ignored `doc/material/`。

先读[文档入口](../README.md)，再按任务读owner文档；实际行为以源码及当前验证为准。完整历史见任务与DEV_LOG索引。
