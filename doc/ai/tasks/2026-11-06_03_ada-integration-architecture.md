# Task 03: ADA 集成架构规划

## 2026-11-09 Review Repair Decision

03B–03F 独立实现审查为 **Changes Requested：4 项 P2，无 P1**。Owner 已确认统一能力配置、旧候选不阻断已保存版本、恢复补捕获及有限文件保留方案。四项连续修复、分阶段本地提交、统一交 ADA集成-REV 复审；当前仅更新任务，尚未实施修复。执行范围、复现与验收统一归 [ADA 四项修复任务](../../../../auto_design_Agent/doc/ai/tasks/2026-11-06_03BDEF_webpainter-production-integration.md#review-repairs-2026-11-09)。iframe 决策不变，旧通过记录保留原版本与范围，不追认为修复通过。

## 2026-11-07 Authorized Implementation State

Owner已授权并连续实施03B→D→E→F，按阶段本地提交。通用native在main1b00ef79，只有main→embedded同步；ADA正式iframe/真实Artifact、GenerationRuntime与Results已接通，有限生产包/离线实窗/实际PS检查见[03F](2026-11-06_03F_offline-psd-acceptance.md)。Direct仍隔离，不是两套产品。当前是代码与有限技术验证完成、待统一独立review及Owner人工验收；没有推送/发布或ADA主线合并。历史03C Inconclusive只保留原证据范围，不能追认全部人工/GPU/手绘板验收。以下11-06文档交接与旧Status按历史时点保留。

## Current Decision And Remaining Execution

2026-11-06：Owner 确认本地 iframe；03C 有限面板原型已独立 review Approved，原两项 P2 已关闭。详见 [03C 当前选型](2026-11-06_03C_carrier-comparison.md#confirmed-iframe-decision)。以下旧 Status/交接按历史时点保留；承载选择不再阻塞后续，设备/正式宿主等未验收项不升级为通过。03B/D/E/F 尚未实施，本次仅调整文档。

后续可在 Owner 一次性 coder 授权下连续执行 **03B -> 03D -> 03E -> 03F**、分阶段本地提交、最后统一验证和独立 review，不再为 A/B 选择或例行阶段切换停下。必须保留以下依赖门槛，不能等全部写完才首次测试：

- 03B：先在 WP main 实现通用 codec 并证明支持字段/像素/可编辑往返与非法输入拒绝，再将 main 合入 embedded，刷新固定包并验证 iframe 接口；main 不导入 embedded/ADA。可在获授权后为 WP main 使用独立 worktree，避免切换当前含文档改动的工作区。
- 03D：用正式 ADA Electron/资源协议和最小必要 CSP 接通 iframe 与 Canvas 正式入口，验证真实平台 owner 的保存/恢复/CAS/旧回执/预览和 Profile 续期；使用隔离测试数据，不依赖实验 CSP 替换或 mock 保存。Direct 不接生产。
- 03E：在 ADA 底部面板接入既有模型配置、GenerationRuntime 和 Artifact/Results owner，完成准确 D/r -> S -> B -> Results -> 显式加层；自动验证可控制 Provider，但发布与关联 owner 使用真实实现。未授权的真实/付费 Provider 不调用。
- 03F：在可用环境完成最终 iframe 与 WP 独立入口的有限打包、离线、输入、PSD 检查。缺少硬件/Photoshop/真实模型授权的项列 Pending 和复现步骤；可执行的自动检查及正确性缺陷不能仅标 Pending 绕过。首版代码完成、独立 review、Owner 人工验收、发布分别给结论。

每阶段必要检查通过后提交，后续失败回到对应 owner 修复并重验；最后汇总精确配套版本、阶段提交、执行证据及未验收项，交 **ADA集成-REV** 一次统一 review。若遇到破坏数据的设计冲突、前置合同不成立或必须改变已确认范围，报告具体阻塞；不以连续实施为由忽略失败。常规实现细节不逐项请求确认。

跨仓库代码/本地提交，以及 main -> embedded 的必要本地同步，须由后续 coder 指令明确授权；不把该计划当成推送、ADA main/dev 合并、发布、真实用户库迁移或正式 3D/GLB 实施授权。执行时同步 ADA 自有架构/任务中的 iframe 决策，历史原型记录保留原证据范围。

## Status

本轮 Owner 仅授权 03A 与 03C 有限原型/测试及向 ADA集成-REV 发评审请求。03A 已实施待 review；03C 对照完成但总体 **Inconclusive**，承载未定案。已建 integration/embedded，未提交、推送、合并、发 PR 或发布；03B/D/E/F 未实施。

2026-11-06 后续：03A/03C 独立实现 review 为 Changes Requested, 两项实验壳 P2 待修复, 见 [03C 补充范围](2026-11-06_03C_carrier-comparison.md#ui-clarification-and-bounded-follow-up)。Owner 新确认的 UI/入口要求已写入本组计划; 当前追加授权仅为调整任务文档, 不启动修复、面板实现或后续任务。

## Task Brief

明确有限首版和未来扩展的边界, 避免把完整 WebPainter 应用无差别搬入 ADA, 或只复制几个工具重新搭建编辑器。先形成可审查的嵌入、状态、保存、生成与三维扩展架构, 架构确认后再制定执行任务。

## Evidence And Ownership

- 初次核对为 WP 98c4c4f; 本次更新基线为 main/ef3eea8, ADA 指定 worktree 仍为 e9f45893。现有规划文档 dirty 与 ADA 原有文档均保留, 执行前需重核实际版本。
- [保存与关闭可靠性任务](2026-11-06_02_save-close-reliability.md) 最新补修有 95 项定向自动证据与构建记录, 仍待独立复审/人工验收; 本轮未重跑或替代该验收。
- 平台目标依据来自 ADA 原架构；规划阶段未修改其文档或代码，本轮有限实现范围见末尾交接。未调用真实库、Provider 或用户文档。

## Proposed Scope

以 [ADA_INTEGRATION](../../architecture/ADA_INTEGRATION.md) 为合同草案, [ADR-0003](../decisions/ADR-0003_ada-embedded-editor.md) 记录提案。保留内核与有限首版, 经对照后已确认本地 iframe, Direct 仅保留为实验。原生保存与 PSD 分开; 首版工具细目仍需审查。

Owner 已确认首版沿用 WP 上方面板/左工具栏/右图层/中间画板, 只增加底部 ADA 悬浮功能面板, 用于提示词、模型选择、生成及结果查看, 无 Agent 对话; 专用 UI 留待后续。WP main 保留完整独立能力, ADA 仅开放首版能力。03C 补同一薄面板的布局/输入/受控通信比较; 03D 负责 Canvas 工具栏新建作品、作品节点重开及保存退出; 03E 负责正式生成/Artifact/持久 Results/显式加层。正式入口不是现有实验按钮, 旧原型证据不覆盖新增面板。

## Ordered Subtasks And Dependencies

原子任务规划的后续授权由本轮 Status 覆盖；A/C 记录本次交付，其余仍 Planned。不是长任务执行循环，不委派 agent 或自动提交。未来代码跨两个仓库时, 应先取得相应实施授权并分别记录提交, 不将一个仓库的提交当作跨仓库原子提交。

## Branch And Repository Ownership

开发路线的稳定规则归 [架构 2.1](../../architecture/ADA_INTEGRATION.md#21-仓库分支和更新路线)。未来执行时按以下分配落代码, 不能将本表当成现在建分支/提交的授权:

| 位置 | 允许内容 | 不应进入 |
| --- | --- | --- |
| WP main | 通用编辑功能/修复/codec, 独立本地入口 | 嵌入专用 boot、ADA 业务依赖 |
| WP integration/embedded | 可选嵌入 boot、通用端口/lifecycle/承载构建入口 | ADA API/业务 owner、另一套画笔/历史 |
| ADA 指定 worktree | 全屏壳、WP 固定包、业务 adapter、平台数据接线 | vendor 包内直接改 WP 内核 |

03A 主要在 embedded; 必需的通用清理拆独立变更先入 main。03B 的通用 codec 在 main, 再合入 embedded, 只依赖 03A 的已确认数据合同而不导入 embedded 模块。03C 跨 embedded 与 ADA; 03D/03E 主要在 ADA, 通用 bug 回 main; 03F 核对三方配套版本及两种产品的必要回归。

每个跨分支/仓库交付记录 main base、embedded commit、bundle hash、port/native 版本和 ADA commit。候选包先校验后替换, 验证失败保留旧配套包, 不盲目只换某一侧。升级/旧包回退需对旧文档可读性有证据, 不承诺把新版文档降级。上游 PR 不捆绑嵌入/ADA 变更, 是否提交 PR 另行授权。

## Dependency Table

| 子任务 | 依赖 | 交付 |
| --- | --- | --- |
| [03A 编辑边界与宿主端口](2026-11-06_03A_editor-boundary.md) | 重新核对最新 HEAD 与保存/关闭修复状态 | 可启动/销毁的编辑模块、共享 DTO/端口、首版能力合同 |
| [03B 原生文档 codec](2026-11-06_03B_native-document-codec.md) | 03A 数据/能力合同 | 可重复恢复的首版 native 载荷, 不依赖宿主传输 |
| [03C 全屏承载比较](2026-11-06_03C_carrier-comparison.md) | 03A | 已确认 iframe；Direct 仅实验，三维探针未验收 |
| [03D ADA 作品闭环](2026-11-06_03D_ada-document-workflow.md) | 03B + 03C 定案, 保存/关闭修复收口 | 文档节点创建/编辑/保存重开/预览/恢复 |
| [03E 生成与 Results](2026-11-06_03E_editor-generation.md) | 03D | D/r -> S -> B -> Results -> 显式加层 |
| [03F 离线/PSD/产品验收](2026-11-06_03F_offline-psd-acceptance.md) | 03D, 最终集成验收需 03E | 固定构建包的完整首版闭环与未验收清单 |

建议串行顺序 A -> C -> B -> D -> E -> F, 尽早识别承载问题。B 在 main 完成后再合入 embedded, 对更新后的包重验 C 的受影响路径, 不沿用旧 commit 的通过记录。B 与 C 在 A 后无代码依赖, 可先 B; 依赖的是数据合同, 不是让 main 合入 embedded。保存关闭未收口不妨碍规划/隔离验证, 但不能据此日常集成。

关键门槛: A 确认首版能力和输出边界; C 承载定案; B 证明像素/结构可恢复; D 证明 A 图片到修改后的作品保存重开; E 证明实际 reference 与持久 Results; F 为实际离线和 Photoshop 证据。失败只修当前范围或记录阻塞, 不自动重选引擎/扩建平台。原型不依赖完整平台 API, 正式闭环不接受只接 mock。

## Acceptance Of This Planning Work

- 明确 Image/图层文档/Canvas 节点身份、命令历史、保存修订与预览的区别。
- 说明现有实现与未实现接线, 尤其 React/boot 耦合、native codec 缺口与 Three.js 传递风险。
- 保留 editor-origin 快照/Results/显式加层与离线/PSD 的既定语义。
- 首版投入有边界, 扩展不要求重做平台或复制全部应用; 未授权实施项保持待定。

## Validation

P-DOC: 新增/修改文档 UTF-8 无 BOM、相对链接、diff 检查及上游文档未变。纯规划不重跑图像测试或 build, 不将源码核对写成运行验收。

## Planning Execution Report (Before Implementation)

- 完成两仓库静态核对, 与用户确认指定目标 worktree。
- 后续按用户澄清将界面独立与运行环境隔离分开, 更新架构/ADR 并创建 03A-03F 草案。没有实现任一子任务。
- 本次补入 Owner 确认的分支开发路线、通用端口与 ADA 身份隔离、配套版本/升级/上游 PR 边界。仍只存在 WP main, 没有创建嵌入分支或执行集成。
- 新增架构草案、Proposed ADR 和本记录, 仅维护 WebPainter 入口/context/log。
- 尚未执行嵌入原型、资源迁移、native codec、ADA schema/接口、生成、PSD 或离线验证。
- 文档检查结果见本次交付; 未提交、推送、发布。

## Context Delta

- Keep: 受限 GPU 原型成果、ADA 统一文档/历史/合成目标、完全离线和 PSD 要求。
- Changed: 通用更新先 main, 再合入 embedded 并构建固定包, 最后更新 ADA adapter; 明确 main 不依赖嵌入专用模块, WP 不拥有 ADA 业务身份。
- Avoid: 不预设全量入口接入、不只复制几个工具、不把本地 iframe 当现成 SDK 或把三维纹理共享当已实现。
- Follow-up: 审查 03A-03F 后再授权执行; 通过 03C 选择承载, 不预先冻结 iframe。3D 正式能力仍是后续范围。

## Plan Review Result And Revision

2026-11-06 独立[整体评审](2026-11-06_03_ada-integration-architecture-review.md)为 Changes Requested, 无 P1, 一项 R1/P2 归 03D。Planner 已在 ADA e9f45893 静态核对并采纳: 自动同实例续期保留作品, 生命周期身份与单次 transport epoch 分开, 真正离开才走关闭合同, 并补真实 owner 的续期/延迟保存定向验收。架构同步修订, reviewer 原文不改。

当前状态为 R1 已作计划修订/待独立复核, 不是 Approved 或代码已修复; 不阻断 03A-03C 的隔离设计, 各项实际执行仍需授权。本轮只检查文档和源码, 未运行产品测试、创建分支或修改 ADA。

## 03A / 03C Execution Handoff

2026-11-06：仅执行本轮授权 A/C。实现/35 项定向检查见 [03A](2026-11-06_03A_editor-boundary.md#execution-report)，包版本、三入口实窗、维护成本、暂推荐方案与未验收项见 [03C](2026-11-06_03C_carrier-comparison.md#execution-report)。已有规划 dirty 保留。用户要求向 ADA集成-REV 发送独立评审请求，发送后本实施 session 停止；等待 review、承载确认与下一阶段授权，按 B→D→E→F 推进，不能自行进入下一项。

## Repair handoff 2026-11-09

R1 native policy df937cd；Window 自定义面板/恢复布局/直接 showPanel 补修 main b369c45→embedded6a2d2de。main 通用默认完整，embedded 声明并统一执行持久化上限，ADA 自有产品配置。最终固定包 clean source6a2d2de、mainBaseb369c45、bundleab12cc5d…、port2/native1/policy1；类型/构建及47项回归通过。旧深位深失败与 Window 入口红灯已复现，修复后通过。codec不依赖产品配置，合法存量读取保存边界不变。完整版本见 [端口](../../architecture/EMBEDDED_PORT_V1.md#native-editing-admission-2026-11-09)。ADA R2–R4、最终生产测试包/实窗/人工 Pending 与独立 review 以 ADA 正式任务本轮记录为准；未推送/发布或反向合并。


2026-11-09 最终配套复验：ADA 实际生产测试构建0355e68b/drawing-25ce4ef6，消费上述 clean source6a2d2de/bundleab12cc5d…；两条真实 app:// iframe场景（受控Provider1次、空凭据outer launcher0次）通过，无运行错误。旧基线候选保留/Primary打开/导出hash/准确放弃/恢复自动捕获、正式保存、崩溃重启恢复及退出上下文均通过。main b369c45 独立Electron文件保存/重开/dirty取消/崩溃恢复通过。ADA62项组合及追加续期专项、原P2 29项保留。人工IME/手绘板/真实Provider/本轮Photoshop仍未验收；旧证据不追认。见 [ADA最终修复配套及Pending](../../../../auto_design_Agent/doc/ai/tasks/2026-11-06_03BDEF_webpainter-production-integration.md#repair-final-verification-2026-11-09)。本轮独立复审/Owner验收 Pending，交 ADA集成-REV 后暂停。
