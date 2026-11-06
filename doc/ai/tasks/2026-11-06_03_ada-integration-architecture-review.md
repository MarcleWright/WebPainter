# Changes Requested — Task 03 ADA 集成架构与任务计划独立评审

日期：2026-11-06。状态：1 项 P2 待 planner 修订，无 P1。

本记录整理本次独立静态评审，供 planner 修订计划。用户在只读评审完成后明确要求输出 review 文档，因此本次仅新增此文件；不修改原计划、业务源码或 ADA 文件，不创建分支、提交或推送。本记录不授予实施或发布权限。

## 1. 总体方向结论

整体方向合理，不需要重选已确认的开发路线或提前确定 iframe：

- WP main 保留完整独立本地能力，通用功能、修复与 codec 先进入 main。
- integration/embedded 持续合入 main，拥有通用嵌入入口、生命周期和宿主端口。
- ADA 持有业务 adapter，消费固定版本构建包，不维护第二份 WP 编辑内核。
- 全屏编辑空间与运行页面隔离是两个问题；直接挂载和本地 iframe 通过有限对照定案。
- 一份编辑文档、一条会话历史、一个正式保存 owner，符合当前产品规模。

未发现上述分工必然导致 main 反向依赖 embedded、codec 循环依赖或不可持续的双份内核维护。main/embedded/ADA 配套版本记录、升级演练和从上游基线整理独立 PR 的安排合理。

结论为 Changes Requested 的原因是下述平台生命周期遗漏，不是因为规划中的能力尚未实现。

## 2. 实施前必改

### R1 — P2：区分自动连接续期与真正离开 Profile

**修订归属：03D；应在 03D 接线实施前补齐。** 不要求重做总体架构，不阻断 03A–03C 的隔离验证；相关工作仍须另获实施授权。

**计划位置：**

- [03D 文档身份与保存任务](2026-11-06_03D_ada-document-workflow.md)，第 13、20、24、33 行。
- [集成架构](../../architecture/ADA_INTEGRATION.md)，第 93、108 行。

计划要求读取/保存绑定捕获的 Profile epoch，并让切 Profile 经过保存/放弃/取消的关闭合同，但没有区分同一 Profile、同一实例的自动连接续期。验收覆盖切 Profile，未覆盖编辑会话跨 transport epoch 继续存活的场景。

**已核对的源码事实：**

| 证据 | 行号 | 当前行为 |
| --- | --- | --- |
| [ProfileRuntimeRoot.tsx](../../../../auto_design_Agent/apps/web/src/project/ProfileRuntimeRoot.tsx) | 45、52–73 | 自动安排连接续期；同一工作区续期不按真正切换展示，也不因 connection epoch 改变而重建整个工作区 |
| [profile-connection-controller.ts](../../../../auto_design_Agent/apps/web/src/project/services/profile-connection-controller.ts) | 76–81、100、114–120 | renew 与真正切 Profile 都调用共用 quiesce；renew 成功后生成新的 connection epoch |
| [profile-switch-quiescence.ts](../../../../auto_design_Agent/apps/web/src/project/services/profile-switch-quiescence.ts) | 1–20 | 当前 handler 无转换原因参数；协调器有等待超时和 switch-blocking 语义 |
| [profile-host-adapter.ts](../../../../auto_design_Agent/apps/web/src/project/services/profile-host-adapter.ts) | 32–39 | 工作区生命周期身份为 profileId + instanceId，不包含 connectionEpoch |
| [profile-scoped-client.ts](../../../../auto_design_Agent/apps/web/src/project/services/profile-scoped-client.ts) | 30–51、114–135 | 请求身份包含 epoch；续期发布新 transport 并 dispose 旧 transport，旧身份不再被接受 |

**触发场景：**用户长时间绘画，作品保持 dirty，期间自动续期。若实现时直接把编辑器的关闭回调注册到现有共用 quiescence，自动续期也会触发保存/放弃/取消流程；用户取消会阻止该次续期。若保留编辑会话，却将打开时的 epoch 固定在长期 binding 中，续期后的新保存又可能被判为旧请求。

**用户影响：**正常绘画被后台续期打断；取消关闭可能使续期无法完成；旧 binding 可能使仍在编辑的作品无法继续保存。以上是当前计划允许出现、但没有纳入验收的接线错误路径，不是已复现的嵌入产品缺陷。

**最小修订建议：**

1. 在 03D 明确区分编辑会话生命周期身份与单次操作的 transport 身份。同 Profile、同实例续期保留会话、dirty、历史和视口，不进入关闭流程。
2. 新操作从现有 ProfileWorkspaceClient 捕获当前 epoch；已开始的操作及其迟到回执仍受原操作身份约束，不把旧请求直接重新标成新 epoch。保存结果不确定时沿原操作身份核对提交结果。
3. 真正切 Profile、重启实例、离开作品或退出应用仍走关闭合同。沿现有 lifecycle owner 区分转换原因或入口，不另建调度器。
4. 在 03D 增加一个使用真实生命周期 owner 的定向场景：dirty 编辑中发生自动续期，并叠加延迟保存回执；验证不关闭/重挂载编辑器、不丢历史、不被旧回执误标 clean，续期后能继续保存。真正切 Profile 的 Save/Discard/Cancel 保持原验证。

**本项关闭条件：**planner 在计划中写清上述行为、owner 和定向验证，并使架构中的 epoch/关闭描述与其一致。计划复审通过不等于代码或运行验收通过。

## 3. 其余范围的评审结果

| 范围 | 结论与依据 |
| --- | --- |
| 分支、包升级与上游 PR | 职责成立；已明确通用改动先 main、禁止直接改 ADA vendor 内核、记录配套包和协议版本、有限升级回归，以及上游 PR 独立整理。未发现需要额外发布平台的依据。 |
| 03A 通用端口与生命周期 | 实际 singleton、导入副作用和平台调用确实存在，不能只改 main.tsx。任务已要求清点、销毁重开、关闭/输出保护及独立入口回归；一个活动实例的边界合理，尚无证据要求全面改为多实例依赖注入框架。 |
| 03B native codec | snapshotDocument 是运行时检查点，现有 PSD/PSB 保存恢复不是 native codec。计划已明确新增 codec 工作，要求稳定 ID、像素/蒙版、文字、路径、调整和合成往返证明；main 仅依赖确认后的规格，不导入 embedded 模块。具体格式和支持字段由任务冻结，不能在实施前宣称已恢复全部能力。 |
| 03C 承载比较 | 同内核、同作品、薄入口、定案后只保留一条生产路径的设计合理。React 版本、全局样式/事件、焦点/IME/压感、GPU、复制成本、资源构建和合并维护成本已纳入，不要求两套完整产品。 |
| 03D 保存与恢复 | 除 R1 外，已区分 Artifact、节点、内部图层、命令历史和持久修订；CAS、暂存后原子发布、旧回执、预览版本、恢复候选和单正式写入者有明确要求。现有 Markdown API 只作为 owner/失败处理参考，不被误当 native API。 |
| 03E 生成与 Results | D/r 固定检查点、实际 reference 指向合成快照 S、结果 B 持久归原作品 Results、显式加层、撤销保留 B，以及只重试交付、不重复 Provider 调用的方向一致。editor-origin 是明确新增工作，不是沿 canvas-origin 创建后隐藏节点。 |
| 03F 与三维边界 | 二维首版、有限三维内容输入探针、正式三维功能、完全离线、PSD/Photoshop、真实模型和人工验收分开合理。无硬件或环境时保留 Pending/Inconclusive，不以类型检查或文件写出成功代替实测。 |
| 六项任务依赖与规模 | A→C→B→D→E→F 可成立；B 合入后重验 C 的受影响路径，版本不能跨包追认。一个活动作品、有限版本对、定向风险测试适合当前规模；未发现必须移除的通用框架或验证负担。 |

未另列可后续处理的 P1/P2。首版属性清单、native 包格式和 A/B 选型属于任务已明确承担的后续设计交付，不因尚未冻结而单独判为缺陷。

## 4. 覆盖范围与基线

本次评审使用指定的两个工作目录，不以相邻 `_New` 替代 ADA：

| 仓库 | 分支 | HEAD |
| --- | --- | --- |
| WebPainter | main | ef3eea87beb00b2c79c6f1e4902e4a5739ef8557 |
| auto_design_Agent | codex/isolate-drawing-interface-20261104 | e9f458930f250191ef35d2efae3734cca4573351 |

读取 WP 适用 AGENTS.md、双方文档入口和 AI_CONTEXT，并按 owner 层核对。指定 ADA 目录及已检查的适用层级未发现仓库 AGENTS.md，另读取其 AI_WORKFLOW。未跟踪规划文件直接从工作区读取，未仅依赖 git diff。

完整阅读的主要规划：

- [WP ADA_INTEGRATION](../../architecture/ADA_INTEGRATION.md)、[ADR-0003](../decisions/ADR-0003_ada-embedded-editor.md)、[父任务 03](2026-11-06_03_ada-integration-architecture.md)。
- [03A](2026-11-06_03A_editor-boundary.md)、[03B](2026-11-06_03B_native-document-codec.md)、[03C](2026-11-06_03C_carrier-comparison.md)、[03D](2026-11-06_03D_ada-document-workflow.md)、[03E](2026-11-06_03E_editor-generation.md)、[03F](2026-11-06_03F_offline-psd-acceptance.md)。
- [ADA DRAWING_EDITOR_ARCHITECTURE](../../../../auto_design_Agent/doc/architecture/DRAWING_EDITOR_ARCHITECTURE.md)、[ADR-0021](../../../../auto_design_Agent/doc/ai/decisions/ADR-0021_unified-layered-drawing-editor.md)，以及 DATA_MODEL、ARCHITECTURE_OVERVIEW、PROJECT_WORKSPACE_MODEL 的相关合同。

源码追踪覆盖 WP boot、Platform、Editor/DocumentSession、fileOps、autosave、字体刷新、文档模型/clone、TiledRaster、动作入口及渲染资源释放；ADA ArtifactStore 发布/保存/删除、Markdown 创建与保存命令、representation、GenerationRuntime/ToolGateway、Profile transport/quiescence 和桌面退出/资源协议。

评审时 WP 的既有 dirty 为三份文档索引/context/log 修改及本组新增规划；ADA 的既有 dirty 为五份文档修改及两份新增目标架构/ADR。只读评审结束时状态与开始一致。新增本 review 时重新检查了 WP 基线和 dirty，未覆盖原有改动。

## 5. 未核对项与证据限制

- 本轮是静态计划与源码评审，没有运行 build、单元/集成测试或嵌入原型。
- 没有手绘板、实际 GPU/内存/延迟、完全离线、打包窗口、Photoshop 或真实 Provider 验收。
- 没有复验既有保存/关闭修复；原任务的历史测试记录不计为本轮通过。
- 未逐项验证全部工具、PSD 属性、第三方资源许可或 native codec 可恢复性；这些仍归相应任务实际交付。
- ADA 部分旧 owner 文档与当前源码存在时点差异；本次以实际源码核对能力，未将旧文档中的功能枚举或未实施描述直接作为当前行为证据。
- 原只读评审执行了两仓库 git diff --check，无报错；WP 本组规划文件 UTF-8 解码与相对文件目标检查无异常。这些只证明文档基本检查，不证明产品可用。
- 文中的源码行号对应上述基线；规划文件为当时工作区版本。planner 修订后应按新内容复审，不能沿用本记录声称已关闭 R1。

本记录仅交付给用户，由用户交给 planner；没有通过工具向其他人或 chat 发送消息。
