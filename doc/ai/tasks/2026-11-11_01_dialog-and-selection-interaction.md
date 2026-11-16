# 调整窗口与移动选区交互对齐

## Status

方案复审 Approved；P1→P2→P3 已实施并分别本地提交。原实现审查 Changes Requested 的两项 P2 已按 F1–F2 修复，2026-11-12 独立限定修复复审 Approved（f1e54b9..bb76b64）。Owner 已授权提交并推送当前 codex/dev 到 origin；不合并或发布。完整人工/Owner 验收仍 Pending。目标工作区 WebPainter_Dev，原执行基线 d6795149322062570084b73d39d505738a26ade7；下文保留各阶段历史授权与验证状态。

## Task Brief

解决两项设计师日常操作问题：调整窗口的深色遮罩干扰颜色判断；宽松选区移动后仍携带大量透明区域。沿用现有弹窗、输入分发、浮动选区和 GPU/CPU 合成结构，借鉴 PhotoCraft 的透明模态背景与移动片段轮廓，不建设新的编辑器框架。

填充延迟已单独记录为 [WP-PERF-002](../../engineering/KNOWN_ISSUES.md)，由其他分支处理，不属于本任务。

## Evidence And Reference

### 当前 WP（已核对源码；不等于全部人工验收）

- `src/ui/dialogs/DialogHost.tsx` 集中注册 49 种对话框类型；`Modal.tsx` 与 `styles.css` 提供统一外壳和黑色 45% 背景。16 种图像调整共用 `EditingDialogs.tsx` 的 AdjustmentDialog。已确认图像调整、参数滤镜、图层样式、文字变形、双色调五类有主画布实时预览；不能把 49 种类型都当作同一预览缺陷。
- Modal 已支持拖动、Enter/Esc、组合输入保护和有限视图快捷键；背景按下当前会关闭弹窗。CanvasView、inputContext 和现有对话框各有输入/目标保护，不可只改 CSS 后允许所有事件穿透。
- `selectOps.ts::loadLayerTransparency` 读取图层 Alpha、转换坐标并提交正式选区；LayersPanel 的 Ctrl/Cmd+单击缩略图调用该命令。
- `moveTool.ts::beginFloat` 仍以原选区范围提取片段；当前片段 Alpha 为源 Alpha × 选区覆盖率，挖空使用剩余比例。简单把选区替换为图层 Alpha 会使半透明边缘重复衰减。原有移动优化和一次拖动一次撤销必须保留。

### PhotoCraft 固定参考（v0.20.2，7c12f647150f8e7b2e07718f7993b1fcaa57fefe）

- [dialogs.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/dialogs.rs#L575-L605)：公共 Modal 使用透明背景，记忆窗口位置；同文件的 free_pointer_over / pan_delta 提供受控画布交互。
- [adjust_dialog.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/dialogs/adjust_dialog.rs)：共享调整入口；临时预览、确认一次、取消不修改正式文档。这里只参考交互契约，不要求移植其预览引擎。
- [float_cmds.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/cmd/float_cmds.rs#L27-L103)：CutParts 从本次提取片段的 Alpha 建立 outline，不调用 Ctrl+单击的加载选区命令；cut_piece 的同格式分支采用 min(源 Alpha, 选区覆盖率)，挖空与放置必须配套理解。
- [float_cmds/tests.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/cmd/float_cmds/tests.rs#L345-L525)：宽松选区贴合、羽化/半透明、重复移动残影、无位移与撤销等参考。
- [layer_row.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/panels/layer_row.rs#L226-L253)：Ctrl/Cmd+单击走独立 select.loadSelection 命令。两种操作不强行合并。

## Change Contract

### A. 公共弹窗与受控画布交互

1. 公共 Modal 背景统一透明，普通设置/确认窗口也不额外压暗画面；保留弹窗本体、层级与模态输入边界。审计所有注册类型及浏览器 ConfirmHost，不逐个工具复制背景修补。
2. 点击弹窗外部不确认、不取消、不触发作品编辑。取消仅走明确取消入口（Cancel、关闭按钮、有效 Esc）；有自有预览画布的对话框继续由自身处理内部事件。
3. 键盘与指针导航分别判定，不以“输入框仍有焦点”整体阻断画布导航：
   - 键盘：文字/IME 按键归控件；输入框/contenteditable 或组合输入期间 Space 不启动平移、不阻止文字输入。其他焦点下按既有有效绑定及白名单导航，Space 的按下/松开只影响本次临时导航。
   - 指针：暴露画布上的滚轮按现有视图导航语义处理，中键按下起点在暴露画布时可平移，即使参数输入框仍持焦点或正在组合输入。指针在弹窗/控件内则由控件拥有滚动；菜单/下拉 popup 打开时不向画布导航。
   - 未被文字/IME 消费的 Space 可与暴露画布的主键拖动组合；起点在弹窗/标题/popup 的序列始终由原 owner 持有，不因后来移出而变成导航。中键/滚轮导航不调用 CanvasView 普通绘图 pointerdown 的 focus/blur 或工具分发，不强制提交参数、结束 IME、确认弹窗或丢失待输入值；不靠移动焦点才能启动导航。
4. 取色仅允许当前最上层弹窗显式请求、且 WP 已有对应能力的取色交互；没有该能力时不得转发当前绘画工具。执行前列明已有入口及目标，复用其 owner，不新增 PhotoCraft 的曲线加点、整套吸管或参数编辑器功能。
5. 最上层弹窗拥有输入；底层弹窗/主界面不能通过快捷键或鼠标修改文档、切换图层/文档。保留文本编辑、IME、有效绑定、Enter/Esc、防重复提交与保存/关闭保护，不以 pointer-events:none 放开整层背景。
6. 公共层按稳定对话框类型记忆拖动位置（会话内即可），首次居中，重复打开恢复位置；视口缩小时约束位置，使标题和取消入口可达。不引入偏好持久化或通用布局系统。
7. 保留各工具现有预览/确认/取消责任和历史语义；本任务不借机重写各工具预览算法，也不承诺修复此前已延期的调整目标失效取消问题。

### B. 移动片段生成贴合选区

1. 仅选中一个可编辑像素图层且存在像素选区时，在实际开始移动后，从本次提取的片段 Alpha 生成临时轮廓。保留原选区范围约束：原选区外的其他图形不得被选中或移动。轮廓贴合形状及透明洞，不只缩小外接矩形，不把图层样式/蒙版合成结果烘焙成源像素。
2. 移动片段的像素 Alpha 与轮廓覆盖率采用 PhotoCraft 的语义；例如源 Alpha=0.5、选区=0.5 时片段保持 0.5，源 Alpha=1、选区=0.5 时片段取 0.5。提取、原位置剩余覆盖、预览和正式合成须配套，不能只把乘法替换为 min 就宣告完成。
3. 正式像素和正式选区仍由现有移动提交链路拥有；拖动时临时显示贴合轮廓，松手将像素和选区作为同一操作提交。一次独立拖动一次撤销，撤销恢复原始宽松选区；无外部状态接管时，取消和失败不留下贴合选区或挖空残留；外部接管后按下方版本所有权规则清理，不强行恢复快照。连续两次拖动分别可撤销，不采用 PhotoCraft 跨多次拖动后统一 drop 的历史分组。
4. 普通移动、Alt 复制移动及 CPU 回退保持一致语义；GPU 支持范围不扩大，但不能仅在 GPU 路径支持贴合。兼容现有浮动片段复用、图层偏移、裁切和 Shift 约束。
5. 单击未拖动、零位移结束不收缩正式选区、不新增历史；离开后返回起点按最终零位移处理。空片段不制造新轮廓；无透明度可收缩的像素区域保持原有形状。蒙版/Quick Mask 等非像素 Alpha 目标不套用本规则，原有拒绝或处理行为保持。
6. Move 工具采用 PhotoCraft 的选区优先规则：单个活动可编辑像素图层、非空像素选区且既有浮动能力允许时，从画布内任意按下点发起选中片段移动，不再依赖该点覆盖率 >0.5（也不只是改成 >0）。这适用于首拖及落定后重拖，包括整个片段 Alpha<0.5、透明洞或选区外起点；不得因此退入整层移动。down、hover、整层 lift 预备判断复用同一资格规则；保留既有显式自动选层、变换手柄及锁定检查的优先级，不在无选区/多层选择/不适用目标上扩大此行为；本任务不改变选框/套索工具的命中方式。拒绝浮动后不得误走整层移动。该规则使低 Alpha 片段不依赖仍有效的浮动缓存才能重拖。
7. Ctrl/Cmd+单击图层缩略图仍独立加载整层透明度。可复用底层栅格/覆盖率工具，但不得从移动流程调用该提交命令，避免扩大选区和多出历史。

### 执行边界与非目标

- 允许涉及公共 Modal/DialogHost、样式、CanvasView/输入上下文、确有需要的弹窗交互适配，以及 Move/选区/浮动预览/合成/对应测试。按实际调用链最小扩展，不要求创建新的服务或依赖。
- 不改填充性能、文档格式、PSD、保存关闭主线、快捷键默认绑定、其他绘图工具算法、品牌、ADA/Three.js、相邻 worktree 或上游 docs。
- 不建立完整弹窗插件框架、全局命令队列、新渲染核心或实验开关；不要求全面移植 PhotoCraft，也不以百人规模为由省略像素和撤销正确性。

## Ownership And Lifecycle

- 弹窗栈负责当前最上层身份；导航仅使用绑定的当前 session/doc，弹窗关闭、被覆盖、切文档或窗口失焦后清理临时平移/取色，不把迟到 pointerup/keyup 转给原绘图工具或新文档。已有会话/保存保护必须继续生效。
- Move 记录目标 session/doc/layer 及 raster、selection/mask 对象身份；记录基础版本，并在发生本次合法写入后更新对应预期版本。每次 move/up/cancel 与提交前确认身份/版本及本次交互仍有效，不能只比较活动图层 ID 或拖动开始时的 doc revision。局部 guard 即可，不建立通用事务框架。
- 主动取消且资源仍由本次交互拥有时，恢复本次像素/选区快照；外部像素/选区写入、对象替换或目标移除导致失效时，清理自身临时轮廓、override、缓存及资源，禁止把外部新状态恢复成旧快照。迟到 move/up/cancel 不重新提交、不产生历史。override 也只在仍是本次创建的对象时移除。
- GPU 当前私有预览不写正式像素：失效只丢弃暂态，选择性恢复本次仍拥有的显示偏移。CPU 若保留正式状态上的临时写入，按资源分别判断：仅同一 raster/mask 对象且版本仍等于本次最后写入的预期值时，才允许恢复该资源；外部接管的资源保持当前状态。像素失效不能顺带恢复新选区，选区失效也不能无条件恢复新像素。可使用私有工作副本降低回滚需求，但不强制重写 CPU 合成核心；两条路径共同保证外部更新保留，不要求失效后都回到开始快照。
- 保留现有 pointercancel/lostcapture 作为结束的约定，见 [交互约定](../../design/INTERACTION_RULES.md)，不在本任务改成统一 Esc；若结束前已版本失效则按失效清理，不允许借正常结束写回。
- 不在 pointermove 中重新读取整层 Alpha、创建整图快照或写正式选区；轮廓随片段建立/失效，在拖动中复用并平移，防止抵消已有 4K 优化。

## Stages

| 阶段 | 输出与检查 | 状态 |
| --- | --- | --- |
| P1 公共弹窗 | 透明背景、位置记忆及输入边界；完成导航与已有取色入口清单、实际事件传播验证 | 自动验证通过，人工 Pending |
| P2 选区移动 | 片段覆盖率/轮廓、选区优先命中、提取与挖空、GPU/CPU 交接、版本所有权及单次历史配套实现 | 自动验证通过，窗口/Owner Pending |
| P3 集成验收 | 运行关联回归、构建及当前源码独立窗口检查；记录人工未覆盖项，更新 owner 文档 | 实施/自动/窗口脚本完成，独立复审与人工 Pending |

按本轮 Owner 授权 P1→P2→P3 串行执行并分别本地提交。发现范围外缺陷记录并隔离，不以修补全编辑器为任务前置。

## Acceptance Scenarios

| ID | 场景与通过条件 |
| --- | --- |
| A1 | Ctrl+B/U/M 打开前后，中性参数下暴露画布的亮度/对比不变；16 种调整和五类主画布预览均使用公共透明背景，其他对话框不残留局部黑色遮罩；内部预览正常 |
| A2 | 打开调整窗口后不主动移焦，以及修改参数尚未 blur 后立即导航：输入框保持焦点时，暴露画布滚轮/中键有效且不强制 blur/提交参数、不丢输入；组合输入保持。输入框内 Space 只输入字符；非文本焦点 Space+拖动可导航。弹窗内部滚动及 popup 不被抢占，不关闭弹窗、不编辑作品、不增加历史 |
| A3 | 双层弹窗仅顶层可操作；外部点击不关闭；文本/IME 候选 Enter/Esc 不误确认，正常确认只执行一次；背景文档/图层切换及修改快捷键被阻断 |
| A4 | 标题拖动不触发画布导航；重复打开恢复可达位置；关闭/失焦/切目标后迟到事件不产生新编辑。已有显式取色入口按原目标工作，未授权取色的弹窗不会启用当前工具 |
| B1 | 偏移图层上用宽松选区圈住不规则透明图形：拖动开始即显示贴合轮廓（含洞），松手保留；原选区外另一个图形不动；撤销恢复原像素与宽松选区，重做恢复落定状态 |
| B2 | 8/16/32 位小型像素 fixture 覆盖 0/0.25/0.5/1 源 Alpha 与选区覆盖、羽化边缘；验证片段、原位置剩余像素和轮廓的数值，而非只断言 bounds。连续两次移动不留残影、不进一步变淡；允许各位深编码误差但须说明容差 |
| B3 | 全片段 Alpha=0.25、同层另有原选区外图形，连续两次真实 down→move→up 仍只移动片段，两步可分别撤销；含选区外起点和透明洞起点，hover/lift 不进入整层预备。Alt 复制原像素不被挖空；两次移动对应两步历史。取消、空片段、单击/零位移、拖回起点不会额外改选区或历史；正常结束/失效事件不重复提交 |
| B4 | 同一小 fixture 在 GPU 路径与强制能力不支持的 CPU 回退中，预览/落定像素和选区一致；蒙版等不适用目标保持原边界；Ctrl+单击加载整层透明度行为不变 |
| B5 | GPU 与 CPU 回退分别覆盖拖动中外部像素变更、外部选区变更、raster/mask 对象替换后迟到的 move/up/cancel；新状态保留、旧片段不落定、无新增历史或资源泄漏。另测无外部变更时主动取消恢复；CPU 回滚只还原身份/预期版本匹配的自有资源 |
| C1 | 当前源码独立窗口中，以 4K RGB 8 位中/大选区实际拖动，轮廓和像素持续跟随且无明显新增分块/卡顿；记录环境与观察，不把脚本时长冒充窗口 FPS，不引入新性能硬指标 |

## Validation

- 预设引用 [验证约定](../../engineering/TESTING.md)：P-DOC、P-INPUT、P-MOVE、P-BUILD。按改动补跑现有 `tests/engine/moveSelectionReference.test.ts`、`tests/gpu/floatingSelection.test.ts` 与相关合成测试，不要求无依据反复跑全量。
- 本任务补测公共 Modal + 实际 Canvas 事件传播、嵌套栈/IME/导航 owner；不得以 CSS 文本断言或直接调用 helper 代替实际输入边界验证。
- 覆盖 B1–B5 的实际 MoveTool 输入、像素/覆盖率/历史和回退；GPU 用真实可用后端验证预览及输出，mock 不能证明 GPU 正确性。环境无 GPU 时标记该项 Inconclusive，不宣称通过。
- 人工：A1–A4 的窗口视觉与交互、C1 的 4K 实际窗口由 coder 有条件时执行并交 Owner 体验确认；无法覆盖的项目明确 Pending/Inconclusive 与原因，不用自动测试替代人工验收。使用隔离 profile，避免影响现有测试窗口。
- 实施后更新 [输入约定](../../design/KEYBOARD_INPUT.md)、[交互约定](../../design/INTERACTION_RULES.md) 中实际改变的规则；PhotoCraft 对照仅补稳定结论。旧快捷键任务保留历史状态，不改写为本任务已经验收。

## Execution / Review

首轮方案审查 Changes Requested 后，planner 按 R1–R3 修订；Owner 确认方案复审已通过并授权本轮实施。实现结果按阶段记录如下；方案通过不等于实现/人工验收通过。

## Context Delta

Owner 已选择公共透明模态背景及受控画布交互；移动轮廓来自本次片段 Alpha，不调用加载整层透明度命令。只借鉴 PhotoCraft 的交互与覆盖率处理，保持 WP 一次拖动一次撤销及现有优化主线；填充性能仍由其他分支解决。

## Review Adjustment R1–R3（2026-11-11）

- R1：PhotoCraft [moves_selected_pixels_with](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/canvas/move_ui.rs#L19-L32) 根据工具、选区、单层及可编辑资格决定；[tool_input](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/canvas/tool_input.rs#L272-L282) 明确从任意位置移动选中像素。WP 采用同一 Move 规则，协调 hover/lift，补低 Alpha 连续真实拖动验收，不仅修改覆盖率阈值。
- R2：PhotoCraft 的 free_pointer_over/pan_delta 按 popup、指针区域与起点判断，而非是否仍聚焦参数。WP 区分键盘与指针归属；输入/IME 下 Space 保留文字语义是本地明确选择，中键/滚轮不因该焦点失效，也不强制移焦。无需新增焦点管理框架。
- R3：PhotoCraft [floating / before_command](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/cmd/float_cmds.rs#L248-L366) 以 revision 判定暂态有效性；正式文档未被浮动预览修改，失效清理浮动状态即可。WP GPU 与此相近；CPU 当前取消直接 restore，故需要本任务范围内补资源身份/预期版本边界，不能照抄“失效恢复原状态”。不扩展为编辑器全局并发控制。

### P1 实施记录（2026-11-11）

- 基线与工作区：codex/dev / d679514；起始已有 doc/README、AI_CONTEXT、DEV_LOG、KNOWN_ISSUES 及本任务草稿改动，全部保留并随 P1 纳入已批准方案的记录，无相邻仓库修改。
- 公共 Modal 透明背景、外部点击不关闭；公共注册类型通过 DialogType 提供稳定位置键，ConfirmHost 用 confirm 键，session 内记忆并限制在视口内。顶层身份约束确认/键盘/指针，Tab 循环保留弹窗焦点。
- 导航清单：暴露的实际 .viewport 上滚轮遵循 Canvas 的平移/缩放；中键直接操作绑定 session 的 view，不聚焦 Canvas、不 blur 参数、不分发工具。非文本/非组合输入的有效 held 绑定可发起左键平移；按下必须来自 backdrop 的画布区域，标题/控件不能转移归属。popup/menu 阻断导航。失焦/顶层变更/切 session/关闭清理；Canvas 普通入口额外阻断背景编辑。
- 取色清单：审计 DialogHost 49 类及 ColorPicker/ColorRange；现有 SV/hue 是弹窗内部控件，ColorRange 读取前景色但没有明确的主画布取色 owner API。当前无符合“已有显式主画布取色入口”的公共能力，因此未放行工具透传或新增业务入口。五类预览仍由各对话框原 owner 管理。
- 验证：实际 App/Canvas/Modal listeners 62/62（新增 3 场景，覆盖参数焦点/组合输入下滚轮中键、Space/popup/失焦/双层栈、位置记忆与 resize）；typecheck 通过。完整 P-INPUT 8 文件 105/105 通过（本地原始日志 doc/material/local/dialog-selection-2026-11-11/p1-input.log）；原生窗口/视觉、真实 IME/Owner 体验 Pending，自动 DOM 输入不替代人工。
- P1 提交：`4c99632`（公共弹窗及已批准方案文档）。

### P2 实施记录（2026-11-11）

- down 与 hover/lift 共同使用单个像素层+像素选区资格，保留自动选层/变换手柄优先级；不再读取起点覆盖阈值。空片段/锁定拒绝后不落入整层移动；mask/channel/Quick Mask 不套用新片段资格。
- 提取为 `f=min(sourceAlpha,coverage)`，非 Alt 原位剩余为 `(sourceAlpha-f)/(1-f)`（f=1 时为 0），配套现有 straight-alpha source-over。片段轮廓覆盖率用 f，保留洞、原选区约束和图层偏移；不加载整层透明度、不烘焙图层效果。8/16 位按原生编码量化，32 位浮点；测试容差原生 Alpha 1/max、选区 1/255，32 位 1e-6。
- 临时轮廓是 Selection 上私有显示引用，一次建立后只平移；不在 pointermove 创建整图快照、重读整层 Alpha 或改正式选区。Canvas 缓存包含 mask 对象身份，避免沿用原宽松轮廓。通常显示 0.5 等值线；全低 Alpha 无 0.5 边时显示非零边界，保证低 Alpha 环/洞可见；不改正式覆盖数值。
- GPU 能力边界不扩大。CPU 回退也使用私有 cut+LayerOverride.read，保持原生位深，拖动中正式像素/选区均不写。并发已有 preview 时拒绝开始，避免覆盖其他 owner。一次 up 准备两份结果、同一 Composite Move 提交；无位移/返回起点/取消不改正式状态、不新增历史。
- 局部 guard 记录 session/doc/layer、位置、selection/raster/mask 对象与版本、目标模式和 override 身份；失效清理本次引用/资源并丢缓存。提交前再查；提交失败按资源最后自有版本分别回滚，外部已接管的像素/选区保留。浮动缓存补 mask/layer/位置身份，低 Alpha 重拖不依赖缓存。
- 补测：8/16/32 Alpha×coverage 0/.25/.5/1 + .37 羽化数值；偏移低 Alpha 环和洞、原选区外起点、全低 Alpha 缓存失效后重拖、hover 不 lift、两步撤销；Alt/取消/空片段/锁定/零位移/返回起点；真实 GPU 与强制 CPU 预览/落定对照；双后端 8 种接管×3 种迟到尾事件（含 raster/mask/selection 对象、图层移除、override 和切 session）；CPU 提交失败后分别保留外部像素/选区。原 GPU 取消、提交失败、保存/输出交接仍保留。
- 验证：Move+独立新语义 reference+真实 WebGPU floatingSelection 3 文件 22/22；追加低 Alpha 轮廓后 Move+moveOutput 2 文件 36/36；typecheck 通过。扩展回归最初 175/176 通过，唯一失败是 moveOutput 旧 CPU“必须写正式 raster”断言；按私有预览契约更新并在上述 36/36 中通过。未隐藏失败，P3 统一重跑最终关联集。原始日志在本地 `doc/material/local/dialog-selection-2026-11-11/`，不提交。
- 旧 C2 乘法固定 hash 已随获批产品语义作废，engine reference 用独立字节数组计算重叠放置、羽化、剩余与轮廓，不用重新抄当前输出 hash；GPU C2 比较同 fixture 的硬件/强制 CPU。真实 GPU 测试使用可用 WebGPU adapter，不是 mock；仍不代表真实窗口/4K/设备或 Owner 验收。
- P2 提交：`2c3d33b`。独立实现审查及 A1–A4/C1 人工 Pending；旧快捷键任务 R4 调整目标失效后取消限制仍保留，本任务未修复。

### P3 集成与交接（2026-11-11）

- 集成核对补强：正式片段 contour 已改变形状，落定时清除旧 moved-outline 复用标记，避免整次手势落在两帧之间时复用原宽松轮廓；私有预览不再恢复本次未写过的 Selection.moved。补测无绘制间隔的落定标记及实际 Modal Tab 循环、切 session 后迟到中键/wheel 对新旧 view 均无影响。
- 最终 P-INPUT、P-MOVE，加 moveSelectionReference / floatingSelection / GPU compositor 联合集：**11 文件 177/177 通过**；`npm run build`（含 typecheck、renderer 和 Electron）通过。原始日志 `p3-regression-final.log`、`p3-build-final.log` 在本地材料目录。compositor 测试报告最大 GPU/CPU 差异 1.49e-6；该汇总仅是测试数值，不是完整产品验收。
- 当前源码生产窗口：重建后正常 main/preload/app:// 加载，独立 `final-userData` / `final-temp`，未读取原用户 profile。Windows 10 系列，Electron 44.4.5 / Chromium 152.0.7977.130；运行时 WebGPU compositing，adapter vendor=nvidia / architecture=ampere；OS 枚举 RTX A5000（驱动 32.0.15.9636），不以 OS 名称代替运行时 adapter 选择证据。
- 真实窗口自动输入：4096×2160 RGB8 合成非均匀图像，2800×1500 宽松选区含 2400×1200 半透明片段及透明洞，另有原选区外图形；25% zoom。通过 Electron 原生 mouse/wheel 事件进入 Canvas：参数草稿未 blur 时滚轮/中键导航且焦点/值保留、外部点击不关闭/不记历史、标题拖动及同类型恢复位置；大选区在原选区外起点拖动，GPU 私有 preview 存在且正式版本不写，松手一条历史，撤销宽松选区、重做贴合轮廓，外部图形不动、无残留 override/临时轮廓。`p3-production-final.log`：errors=[]、Electron exit 0。
- 已查看窗口截图 `canvas-before-modal.png`、`modal-transparent-navigation.png`、`move-4k-mid.png`、`move-4k-committed.png`，确认 Color Balance 外部未加深色遮罩、标题可达，拖动中图像已位移且轮廓含洞。它们是合成样例、脚本输入与有限截图检查，不是设计师持续拖动/真实照片体验或 FPS 证据。
- 测试夹具问题如实留存：初次 native wheel 检查早于异步事件呈现，加入等待后通过；后续新建尺寸脚本即时 blur 早于 React draft 更新，加入输入状态等待；截图先于已排队 native move 呈现，最终等待 RAF 后重采，实际 GPU 预览/轮廓可见。以上调整均在忽略材料中的测试 harness，未因脚本时序修改产品准入或声称性能提升。日志保留失败尝试，最终以 `p3-production-final.log` 和最终构建为准。
- owner 文档：输入约定、交互约定、INTERACTIVE_PREVIEW、PhotoCraft 稳定借鉴结论及 README/AI_CONTEXT/DEV_LOG 索引已更新；旧快捷键任务状态未改写，填充性能 WP-PERF-002 未实施，R4 调整目标失效后无法取消继续延期。
- P-DOC：UTF-8 无 BOM、当前相关文档相对链接、本地材料 Git 忽略、上游 docs/README/CHANGELOG/NOTES 不变及 `git diff --check` 通过（验证输出见本地 `p3-doc.log`）。

### 验收边界与独立实现复审入口

| 项目 | 当前证据与状态 |
| --- | --- |
| A1 | 公共外壳源码/注册清单与 Color Balance 生产窗口截图已核对；16 调整与五类预览逐项中性参数颜色/内部预览人工矩阵 **Pending** |
| A2 | 实际 App/Canvas DOM 参数/组合事件、popup、held pan、焦点测试通过；原生窗口参数未 blur 的滚轮/中键通过；中文 IME 候选窗口、原生 Space/弹窗内滚动/popup 的完整人工矩阵 **Pending** |
| A3 | 双层 Modal、局部文本/组合事件、编辑隔离与正常确认自动回归通过；Windows 双层实际窗口/真实 IME 人工 **Pending** |
| A4 | 位置/标题/失焦/切 session 迟到事件自动回归和有限生产标题/位置检查通过；关闭/后台目标切换的完整人工矩阵 **Pending**。无合格的已有主画布取色 owner 入口，未新增；旧 R4 限制仍存在 |
| B1–B5 | 原生位深数值、真实 MoveTool/历史、CPU 回退、真实 WebGPU 合成与两路资源接管/清理自动证据通过；真实复杂作品、设备及完整组合人工 **Pending** |
| C1 | 当前生产窗口 4K 大选区 native 输入、GPU preview 与呈现截图已执行；持续跟手/无明显新增卡顿的人工体验 **Pending / Inconclusive**，没有 FPS 结论，中选区和真实照片未验收 |
| 实现/Owner | 独立实现复审 **Pending**；Owner 体验与最终验收 **Pending**；方案复审 Approved 不代表本实现 Approved |

独立复审以 `d679514..本任务交接HEAD` 为范围，同时读取任务与最终源码，不只看 diff。建议重点读 Modal/DialogHost/Canvas 的输入与生命周期、MoveTool 的共享资格/paired alpha/私有 CPU override/逐资源失败回滚、Selection.previewOutline 与 Canvas 缓存，以及上述 reference 和接管测试。P1 `4c99632`、P2 `2c3d33b`；P3 `9c8b21b`；阶段 hash 由本次独立文档回执回填，避免提交内容自引用。此前 task 与四份既有文档修改已保留；本轮仅修改本 worktree，未推送、合并、发布或修改相邻 ADA/main_native/embedded。

### 阶段提交回执

| 阶段 | 本地提交 | 验证 |
| --- | --- | --- |
| P1 | `4c99632` | P-INPUT 105/105、typecheck；公共输入边界及位置测试 |
| P2 | `2c3d33b` | 定向数值/reference/真实 GPU 22/22；Move+输出追加 36/36；typecheck |
| P3 | `9c8b21b` | 最终关联集 177/177、P-BUILD、P-DOC（9 文档/103 相对链接）及最终生产窗口 errors=[] |

本回执仅补齐已完成阶段 hash，不更改上述验收状态；独立实现复审与人工/Owner 均 Pending。不推送、合并或发布。

## 实现审查修复 F1–F2（2026-11-12）

本节为最新执行要求，前文 P1–P3 记录保留为历史证据。独立 review 对 d679514..f1e54b9 的结论为 Changes Requested；复跑 11 文件 177/177、typecheck 和 diff check 通过，但下述两个语义缺口未被原测试捕获。旧记录中的“paired alpha 正确”及实现审查 Pending 不作为当前结论。F1/F2 为实现修复编号，不与方案审查 R1–R3 或原阶段 P1/P2 混淆。

### F1 / P2：修正羽化选区移动的原位剩余覆盖

- 依据：`src/tools/moveTool.ts` 当前挖空采用 `(a-f)/(1-f)`；`tests/engine/moveSelection.test.ts` 和 `moveSelectionReference.test.ts` 重复同一公式。a=1、选区覆盖 k=0.5 时，移动到不重叠位置后原位仍为 1，目标新增 0.5，违背已批准的 PhotoCraft 覆盖率语义。
- 固定参考仍为 7c12f647150f8e7b2e07718f7993b1fcaa57fefe：[pixels.rs 的 try_lift_coverage](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/pixels.rs) 扣除覆盖率；[float_cmds 测试](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/cmd/float_cmds/tests.rs) 明确 opaque/half selection 为 half left, half moved。
- 实现契约：普通移动片段 `f=min(a,k)`；原位剩余 `r=max(a-k,0)`，等价于 `a-f`；轮廓覆盖率仍为 f。目标位置按现有 source-over 合成；Alt 复制保持原位不挖空。不再要求片段与余量在原位 source-over 后必须重建原始 Alpha，该条件不是此产品语义。最终零位移/拖回起点通过丢弃私有预览保留原始像素与选区，不能为满足零位移而改变正常挖空公式。
- 补测：8/16/32 位分别验证不重叠移动的显式期望：a=1,k=.5 → 原位 .5/目标 .5；a=.5,k=.5 → 原位 0/目标 .5；a=.75,k=.25 → 原位 .5/目标 .25。覆盖羽化、重叠放置、Alt、连续移动、零位移/拖回起点、取消、一步撤销/重做；保留低 Alpha 重拖与外部接管测试。
- 重叠场景使用固定像素例子分别断言挖空余量与目标 source-over 结果，不只比较 GPU 与 CPU。更新 reference 和真实 GPU 回归，禁止直接抄当前输出或与实现同公式互证。明确原生编码及选区 8 位量化容差。
- 保留私有 CPU/GPU 预览、版本所有权、一次拖动一次历史及既有 GPU 能力范围；不得改回 pointermove 写正式像素。

### F2 / P2：控件激活优先于 Modal 临时平移

- 依据：`src/ui/dialogs/Modal.tsx` 的 held 绑定判断在按钮/控件归属判断之前。默认 Space 绑定 input.pan 时，焦点按钮的 Space 被 preventDefault，原生按钮激活被阻止。现有 R3 控件测试先把 Space 改绑为 view.zoomIn，未覆盖默认 held 分支。
- 实现契约：保留局部已消费事件、文本/IME、模态 Enter/Esc、控件激活与导航的优先级；仅未被这些 owner 认领的有效 held 绑定可以进入临时平移。保留非文本导航区域的 Space 平移、弹窗中键/滚轮不移焦及 popup/失焦/顶层切换清理。只调整必要分发顺序/资格，不改默认绑定或引入新的输入框架。
- 补测：默认绑定下，聚焦 OK、Cancel 和普通按钮，Space keydown/keyup 不被 held 分支阻止、不形成画布平移，原生激活只执行一次；无重复提交。保留非文本区域 held 导航正例、文本/IME Space、Enter/Esc、已有自定义绑定与控件导航回归。
- DOM 单测需检查真实事件传播及 defaultPrevented，不能只手工 dispatch click 声称证明浏览器键盘激活。用当前源码隔离窗口的原生键盘输入验证按钮 Space；环境无法执行时明确 Inconclusive，并保留独立复审/人工门槛，不伪造通过。

### 执行与收口

1. 检查当前分支/HEAD/status，保留本次任务文档与任何无关改动；只在 WebPainter_Dev 执行。按 F1→F2 完成修复与定向补测，各自本地提交；提交中保留对应任务记录，不覆盖旧证据。
2. 两项完成后运行 P-INPUT、P-MOVE、moveSelectionReference、真实 WebGPU floatingSelection 与 GPU compositor 的关联集及 P-BUILD、P-DOC；去重执行即可。GPU 无可用后端明确 Inconclusive。记录命令、结果、失败及处理、提交 hash 和未覆盖项；177/177 是修复前历史结果，不沿用为修复后证据。
3. 更新本任务与确有变更的 owner 规则/短索引，纠正当前状态与 Alpha 语义，历史实施记录不删除。两项修复完成后标记“待独立复审”，不得自行将整体实现或 Owner 验收改为 Approved。
4. 不扩大到填充性能、旧快捷键 R4、保存关闭主线、其他工具算法、相邻 worktree/ADA 或完整输入/渲染重构；不推送、合并、发布。遇到范围外问题记录并隔离。方案通过与自动回归通过均不替代真实 IME、完整窗口矩阵、4K 持续跟手及 Owner 验收。

| 修复 | 状态 | 提交/验证 |
| --- | --- | --- |
| F1 羽化挖空语义与独立数值验收 | 已修复，待独立复审 | `4fe3c42`；定向 30/30、typecheck 通过 |
| F2 控件 Space 与 held 导航归属 | 已修复，待独立复审 | `9e7fcd9`；最终 190/190、构建及原生窗口按钮 Space 检查通过 |

### F1 执行记录（2026-11-12）

- 起点：codex/dev / `f1e54b997826d46489f398dd8e78c44ea5b0474b`；工作区仅本任务既有修改，原文全部保留。普通挖空改为 `max(a-k,0)`；提取 min、Alt、目标 source-over、私有 CPU/GPU 预览、版本所有权与单次历史均保留。
- 独立数值：8/16/32 位分别固定断言三例（1/.5 → .5/.5，.5/.5 → 0/.5，.75/.25 → .5/.25），同时覆盖预览、Alt、第二次拖动、中间无残影、两步历史、零位移/拖回起点、取消及 undo/redo。旧重建源 Alpha 条件删除。原生 Alpha/8 位选区量化联合容差 `1/255 + 1/maxValue(depth) + 1e-6`，不重叠显式例子不以实现公式生成期望。
- 重叠 reference 改为固定两像素例：红 1/k=.5，蓝 .75/k=.25，右移 1。原位红 .5；重叠处 Alpha .75、直通道红 2/3 蓝 1/3；新位置蓝 .25。8/16/32 位 CPU 预览/落定及真实 GPU 预览读回/落定分别对固定数字断言，RGB/Alpha 容差 2/255+1e-6（涵盖 8 位选区及编码）。真实 GPU 另直接检查三例非重叠原位/目标数字；不以 GPU=CPU 替代预期数值。
- 命令：`npm exec -- vitest run tests/engine/moveSelection.test.ts tests/engine/moveSelectionReference.test.ts tests/gpu/floatingSelection.test.ts --reporter=dot`，3 文件 **30/30 通过**；`npm run typecheck`、`git diff --check` 通过。保留既有低 Alpha、外部接管及失败回滚检查。原始日志：本地忽略目录 `doc/material/local/dialog-selection-fixes-2026-11-12/f1-final.log`。
- 首轮新增 GPU 重叠断言误把 compositeRead 的预乘 RGBA 当成直通道（28/29）；核对现有 compositor 接口后用固定预乘期望 [.5,0,0,.5; .5,0,.25,.75; 0,0,.25,.25] 修正测试，再加 GPU 非重叠例后为上述 30/30。没有改产品合成接口或放宽数值门槛。
- owner 规则同步纠正 INTERACTION_RULES、INTERACTIVE_PREVIEW 与 PhotoCraft 对照；P1–P3 旧过程保留为历史。F1 实现复审、真实作品/4K/IME 和 Owner 体验仍 Pending；F2 接续实施，最终关联集/构建/文档门槛在两项完成后执行。

### F2 执行记录与最终交接（2026-11-12）

- Modal 只调整 held 分支顺序：局部已消费/IME、Tab、模态 Enter/Esc、文本及控件激活/导航先处理；剩余有效 held 才可导航。默认绑定、App/Canvas 架构、其他工具与中键/滚轮不移焦规则均不改。未触及填充性能、旧 R4 或保存关闭主线。
- 新增实际 App/Modal/Canvas DOM 传播用例 6 项：默认 Space 分别聚焦 OK、Cancel、普通按钮，keydown、repeat、keyup 不 preventDefault；按住时背景左拖不平移、不产生历史。测试不手工 click 证明浏览器激活，明确 jsdom 没有该默认行为。另覆盖重绑 held 的 Enter/Esc 仍由 Modal 确认/取消优先，以及非文本区域 F6 held 导航正例。原默认非文本 Space、文本/IME、局部消费、控件导航、自定义绑定和栈/失焦/popup 回归保留。
- 首轮新 DOM 测试前置断言误用 Binding.id（实际为 ids[0]），导致 3 失败/66 通过及 typecheck 阻断；改正测试 API 后，最终集合通过。产品代码仅为上述必要分发排序，不因测试放宽默认事件准入。
- 原生键盘检查：当前源码 `npm run build` 后，正常 main/preload/app://，独立 `doc/material/local/dialog-selection-fixes-2026-11-12/space-userData` 和 space-temp，Windows、Electron 44.4.5 / Chromium 152.0.7977.130，运行时 webgpu (GPU compositing)。先创建活动文档，确保 Modal held 准入真实有效；再打开真实 New Document，分别聚焦普通 Swap、Cancel、Create（公共 OK）按钮，通过 Electron sendInputEvent 发送两次 Space keydown/一次 keyup。三组均 keydown/keyup defaultPrevented=false、**native click=1**；Swap 只交换一次尺寸且不提交，Cancel 不新建文档，Create 仅新建一份；原背景文档 history/view 不变。非文本弹窗 shell 的默认 Space+原生左拖仍平移，松 Space 后尾段继续由 pan 拥有，最终 (36,18)，不新增编辑历史。没有手工 dispatch click 代替被验按钮的键盘激活。
- 原生窗口结果：`native-space.log` errors=[]、Electron exit 0；查看本地截图 space-swap.png / space-held-navigation.png。窗口日志重复 keydown 的 repeat 标记为 false，不把它称为真实 OS 长按自动重复验收；DOM 已覆盖 repeat=true。原生输入/有限截图是自动集成证据，真实 IME 与完整人工矩阵仍 Pending。
- 最终验证命令（去重联合）：`npm exec -- vitest run tests/input tests/engine/moveSelection.test.ts tests/engine/moveSelectionReference.test.ts tests/gpu/floatingSelection.test.ts tests/gpu/compositor.test.ts tests/gpu/moveOutput.test.ts tests/engine/access.test.ts tests/engine/layerAccessUI.test.tsx --reporter=dot`，涵盖 P-INPUT/P-MOVE/reference/真实 WebGPU floatingSelection/compositor，**11 文件 190/190 通过**；GPU/CPU compositor 最大差异报告 1.49e-6。`npm run build`（typecheck、renderer、Electron）通过。原始日志 regression-final.log、build-final.log、native-space.log 均在上述本地忽略材料目录；177/177 不用作修复后证据。
- P-DOC：UTF-8 无 BOM、修改文档相对链接、材料忽略、上游 docs/根 README/CHANGELOG/NOTES 未改及 git diff --check 通过，详见本地 doc-check.log。修复时 F1 owner Alpha 规则、F2 输入规则及短索引已更新，旧 P1–P3 过程保留。
- 交独立复审：以 `f1e54b9..本轮交接HEAD` 检查两项限定修复，并结合原完整实现源码/任务；重点查显式固定数值是否独立、GPU 预乘/直通道容差、零位移私有预览丢弃，以及默认控件 Space 与重绑 held 的 owner 顺序。F1 `4fe3c42`；F2 `9e7fcd9`；hash 在本次独立文档回执回填。修复状态为**待独立复审**，不自行宣称实现/Owner 整体验收 Approved。
- 人工缺口继续保留：A1 16 调整/五类预览逐项颜色，A2–A4 中文 IME/候选窗口/完整原生控件与双层栈/焦点，真实复杂作品、4K 中/大选区持续跟手与完整设备矩阵、Owner 体验均 **Pending / 未执行项 Inconclusive**。本轮未重跑 4K 体验、不报告 FPS；旧 R4 仍延期。未修改相邻仓库，未推送/合并/发布。

### F1–F2 提交回执（2026-11-12）

- F1：`4fe3c42`，覆盖率相减挖空、独立数值/真实 GPU 补测及 Alpha owner 规则。
- F2：`9e7fcd9`，Modal 控件激活优先、事件传播补测及修复后 190/190/构建/原生窗口证据。
- P-DOC：8 份相关文档 UTF-8 无 BOM、98 个相对链接、材料忽略及上游文档保护通过；本回执未改链接或代码，追加后 diff check 通过。最终工作区核对在本地回执提交后执行，不推送/合并/发布。
- 交独立修复复审；实现/人工/Owner 整体验收未批准，前述 Pending/Inconclusive 不变。

### 独立修复复审与推送授权（2026-11-12）

- F1–F2 限定修复复审 Approved，审查范围 f1e54b9..bb76b64；未发现新增 P1/P2 阻断项。F1 覆盖率相减与独立固定数值验收、F2 控件激活优先及默认/重绑 held 补测均关闭。
- Reviewer 独立复跑 11 文件 190/190、typecheck、git diff --check 通过；核对 coder 的原生 Space 脚本及日志，本轮未重新执行窗口测试。复审时工作区干净。
- Owner 随后明确授权提交并推送到远端；目标仅 origin/codex/dev，不合并或发布。真实 IME、完整窗口矩阵、4K 持续跟手与 Owner 验收仍 Pending，批准不替代这些门槛。
