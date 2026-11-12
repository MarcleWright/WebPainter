# 钢笔未闭合路径即时编辑与闭合反馈

## Status

方案复审已通过（Owner 确认），2026-11-12 已授权在 codex/dev 按 R1–R2 修订串行实施 P1→P2→P3、各阶段本地提交；不推送/合并/发布。执行基线 2a4a606d3c1c4d252206e09fa1d598a2fce39d24。独立实现复审及人工/Owner 验收 Pending；前一弹窗/选区任务的验收结论不回写。

## Task Brief

设计师绘制钢笔路径尚未闭合时，需要按住 Ctrl 临时直接选择已有锚点/方向柄，按住 Alt 临时转换锚点，松键后从原路径末端继续画。起点可闭合时还需明确、与真实命中一致的提示。采用一个钢笔会话内的临时操作模式，复用现有贝塞尔与编辑能力，不重写路径引擎或建设通用工具框架。

## Evidence And Reference

### WP 当前源码

- `src/tools/penTools.ts`：PenTool 已有起点 8 CSS px 闭合判断，但 cursor 固定 crosshair；PathSelectTool/directSelect 已能移动锚点与方向柄，AnchorTool/convertPoint 已能收拢或拉出柄，尚未共享绘制中的钢笔会话。
- PenTool 持有 PathEdit、spIndex、dragging；现有 finish 为整条编辑提交，Enter/Esc/cancel/deactivate 都可能进入 finish。`editor.ts::setTool` 会 cancel/deactivate 原工具，不能用普通切工具模拟修饰键。
- PathEdit 在路径模式提交 LambdaCommand，在形状/矢量蒙版模式提交整层 ReplaceLayerCommand；临时工具若各自记录快照，再被钢笔整体提交，会形成重叠历史。
- `DocPanels.tsx::HistoryPanel` 另有直接 goto/restoreSnapshot/createSnapshot/clear 入口，绕过 Action；PathsPanel 点击路径仅改 activePathId，editor.activate 切文档则先 cancelTool，不能假设目标切换均已正常结束草稿。
- `inputDispatch.ts`、`actions.ts` 与 `ops/editOps.ts` 拥有快捷键/Undo/Redo 入口；`CanvasView.tsx` 拥有 pointer 捕获与 activeTool；事件生命周期、目标保护和可见模式必须一起核对。

### PhotoCraft 固定参考

版本 v0.20.2，commit `7c12f647150f8e7b2e07718f7993b1fcaa57fefe`，源码阅读不等于本任务已完成运行验收。

- [pen.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/vector_ui/pen.rs)：closes_path_at 按屏幕尺度命中起点；pen_replace 可把 Direct Selection 编辑结果写回未完成路径并继续画。
- [tool_cursor.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/canvas/tool_cursor.rs#L85-L93)：闭合光标使用小圆圈。
- [direct_select.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/direct_select.rs#L230-L242)：Ctrl 已支持 Pen 的临时直接选择；Pen+Alt 的完整 Convert Point 入口仅在没有绘制中路径时启用。不能把“PhotoCraft 未做 Ctrl 编辑”当作事实。

本任务扩展的是绘制尚未结束时 Alt 也能编辑已有锚点；参考 PhotoCraft 的会话/命中/反馈思路，WP 自行冻结本任务交互和历史规则。

## Change Contract

### 1. 当前草稿内的操作模式

| 输入/命中 | 行为 |
| --- | --- |
| 普通 Pen | 沿当前子路径末端添加锚点，已有正常拖柄行为保留 |
| Ctrl（macOS 使用既有 mod/Cmd 语义） | 临时直接选择：点击选择当前草稿锚点，拖锚点时锚点及两柄一起移动；拖柄遵守该点的平滑/断开关系 |
| Alt 点击锚点 | 收拢该点两柄，变为角点；已是无柄角点时不制造空历史 |
| Alt 从锚点拖动 | 拉出成对方向柄，形成平滑点；对原来已有柄的点也须支持拖出，不可按下就提交收柄而丢失后续拖动 |
| Alt 拖已有方向柄 | 仅移动该柄并解除联动，对侧柄保持位置 |
| Ctrl+Alt | 直接选择优先；命中柄时 Alt 独立调整，命中锚点时按直接选择移动，不执行 Alt 的点击转换 |
| 编辑模式点空白 | 不加点、不闭合、不提交、不切去其他路径；可清除临时点选择但保留草稿和续画位置 |
| 松开修饰键 | 返回普通 Pen，继续从当前子路径末端画；编辑旧点不改变续画末端 |

- 仅普通 Pen 的绘制中草稿纳入新增临时模式，支持草稿内已有锚点及方向柄。没有草稿时的独立 Direct Selection/Convert Point 行为保持；Freeform Pen、增删锚点工具、多选点框选/整段重塑不扩展为新需求。
- 分开保存续画末端与临时编辑点/柄；选择和编辑当前草稿不得命中同文档其他已完成路径。命中复用现有屏幕空间计算，并明确 anchor/handle 重合时的稳定优先级。
- 不调用 setTool/cancel/deactivate 来切换模式，不改变工具栏选中项或用户工具组记忆；仅光标、可编辑柄和临时点高亮反映当前模式。只按/松修饰键，即使鼠标未移动，也要刷新反馈。

### 2. 一次 pointer 序列的归属

- pointerdown 冻结本次操作类型、目标锚点/柄及会话；move/up 始终交给该 owner。拖动中松开 Ctrl/Alt 不得变成添加锚点、闭合或把尾事件送给别的工具。
- 方向柄拖动中新增按下 Alt 可单向解除联动，解除后本次拖动保持断开，不在松 Alt 时突然恢复对称。普通新增锚点拉柄中的现有 Alt 解耦行为保留；Ctrl 在拖动中按下只影响下一次手势，不转移当前 owner。
- Shift 的既有可用约束保留，不新增完整 PS 修饰键组合库。Space 临时平移遵守既有输入归属：正在操作锚点时不抢走该序列；空闲时导航结束后继续原草稿。
- 文本焦点、IME、菜单/Modal 和保存/关闭保护优先，修饰键不绕过 access；拒绝的编辑不能退回普通加点。

### 3. 闭合反馈

- 当前子路径满足原有闭合资格、无进行中的拖动、普通 Pen 命中起点时，显示小圆圈闭合光标并突出起点；橡皮筋预览明确接到起点，而非继续追随偏离的鼠标坐标。
- hover、光标、预览终点与实际点击使用同一闭合资格及屏幕空间命中判断。保持当前约 8 CSS px 范围，不随缩放/DPR 漂移，不重复添加一个起点锚点。
- Ctrl/Alt/Ctrl+Alt 时编辑优先，不显示闭合提示、不闭合；编辑起点后仍可松键闭合。完成闭合清理反馈，后续点击不会沿用旧命中。
- 本任务不新增闭合拖动重塑首点功能、自动吸附系统、动画或新的参数面板。

### 4. 历史与草稿责任

- 冻结为沿用现有正式路径上的受控编辑：草稿步骤实时写入原 PathTarget 并显示，但最终路径历史由 Pen 会话结束时统一提交；不改建私有草稿渲染系统。局部快照用于草稿 Undo/Redo 与自有手势取消，不是外部状态失效时强制回滚的依据。
- 一个 Pen 会话拥有当前草稿及最终提交；提取共享编辑计算，禁止调用独立工具的提交入口制造嵌套 PathEdit 或整层历史。
- 草稿内记录有限的局部操作序列：一次加点及其拉柄一步，一次锚点/柄拖动一步，一次转换点击一步；按键切换、选择、空操作、拖回原状态不记账。允许简单路径快照，不建设通用命令总线，不逐帧记历史。
- 通过有效 Action 解析后的 Undo/Step Backward、Redo/Step Forward、菜单/命令入口共同访问当前草稿历史，不硬编码 Ctrl+Z。草稿期间先处理局部历史；局部已无可撤销/重做时禁用或消费该入口，不向文档历史穿透。修改后清除局部 redo 分支；输入框撤销仍归输入框。
- 草稿会话存在期间（含撤到零点但仍可 redo），HistoryPanel 可查看，历史状态 goto、恢复快照、创建快照和清空历史均暂时禁用；实际处理器也检查当前会话，覆盖鼠标、键盘激活、上下文菜单与打开后延迟执行的入口，不只把按钮置灰。提供“请先结束当前路径，再操作文档历史”的提示。不得隐式提交后跳转，也不得捕获含未结束草稿的快照。重命名条目/快照、删除既有快照仅属元数据操作，可保留原有行为，不能借此恢复/跳转或改变当前文档基线。会话正常结束后解除限制；不把 HistoryPanel 改成局部历史面板，不要求重构通用 History。
- 正在 pointer 拖动时触发 Undo：先取消该次尚未完成的拖动、恢复该手势起点，不再同时撤销上一局部操作；Redo 在拖动中不执行。上一步无拖动时才按局部记录撤销。撤到零点仍保持会话的 redo 及目标，不新建重复 Work Path/Shape。
- 结束草稿时只提交一次最终路径编辑，清空局部历史；文档 Undo/Redo 恢复结束前/后的路径，不重放临时工具历史。已有 Shape 创建步骤可独立保留，不强制合并为同一历史，但不得重复创建图层或提交覆盖其他新属性的旧层快照。
- Enter、普通闭合、显式切换工具继续走正常结束；Esc 在正在拖动时仅取消本次手势，空闲时沿用现有结束开放路径语义，不暗中改成丢弃整条路径。结束去重，避免 cancel+deactivate 双重提交。无有效结果/最终无变更不提交空编辑；既有临时目标的创建/清理需有测试说明，不顺带重构通用图层创建历史。

## Ownership And Lifecycle

- 记录 session/doc、PathTarget（pathId 或 layerId+shape/vectorMask）、当前子路径和目标对象身份。区分会话自己的每次修改与外部变更；不能只读当前 activeLayer 重新推导目标，也不能仅依赖自己会更新的 doc revision。
- Shape、Vector Mask、Work/Saved Path 继续使用既有目标规则；临时编辑和局部历史始终作用于原目标。目标切换按下表区分主动结束与外部失效，不把两者统一成清理局部记录。

| 情况 | 路径与历史的处置 |
| --- | --- |
| 用户主动切路径、图层/蒙版编辑目标、文档或工具 | 在旧目标仍有效时，先取消尚未完成的 pointer 手势（保留此前已完成步骤），正常结束有效草稿并至多提交一次，再更改 activePathId/activeLayer/session/tool。保持开放路径，不自动闭合；返回旧目标可看到结果且能通过文档历史撤销/重做。原草稿局部栈结束，不承诺返回后自动恢复续画会话 |
| 正常结束被 access、保存/关闭保护或提交失败拒绝 | 不执行切换；保留旧目标及可恢复草稿，提示原因，不先改 active ID 再补救，不吞掉已完成步骤 |
| 外部写入已替换/删除会话目标，或发生绕过正常切换的对象/身份失效 | 不再以旧快照提交、恢复或复活目标；清理 held/手势/局部历史与反馈，保留外部操作产生的当前路径/文档状态，明确提示草稿因目标变化结束。该分支不承诺找回已被外部替换的旧草稿，也不把旧局部步骤追加成伪造的文档历史 |

- 路径面板点击、图层/蒙版选择、文档标签以及其他等效的主动入口必须复用同一钢笔专属结束检查；检查本次实际要切换的目标，重复选中同一目标不结束草稿。路径面板导致当前目标替换/删除/重命名的主动命令也须先结束旧草稿，再执行命令，避免把正常 UI 操作归为外部失效来丢弃历史。只补相关 owner 桥接，不改其他工具生命周期。
- 实施时列明入口及处置，不只覆盖 editor.activate。正式路径受控写入期间，主动切换不得只清空局部栈留下无历史修改；外部失效时则由外部状态决定最终结果，旧基线失去所有权后不得以“补历史”覆盖它。迟到事件不作用于新目标。
- 失焦、Modal 出现清理 held 修饰键和当前手势；仍拥有目标时取消未完成手势，保留已完成局部步骤及续画位置，不自动结束整条草稿。若目标失效只清理自身状态，不回滚外部更新。返回后须新 pointerdown 才开始编辑。
- pointercancel/lostcapture 对本任务新增临时点编辑手势按取消处理，恢复本手势前状态、不新增历史；普通加点路径原有事件处理若需要配套变化，须明确记录并覆盖，不能让 Canvas 将同一事件先 up 提交再 cancel。不改变其他工具的既有结束规则。
- 保存、正常关闭及切工具必须仍能通过已有结束/保护链路处理可见草稿，不允许因局部历史而让保存漏掉可见编辑，也不授权重写文件生命周期。执行前核对这些入口，若缺少必要桥接仅补钢笔 owner 的接入。

## Boundaries And Non-goals

- 主要涉及 penTools 的共享计算/会话/反馈、必要的 Canvas pointer 与修饰键传播、输入/Action 的局部 Undo/Redo 桥接、HistoryPanel 有界入口保护、路径/图层/文档主动切换的钢笔结束桥接及测试。可按职责拆小文件，不引入新依赖、全局事务系统或通用工具插件框架。
- 不做其他钢笔家族完整 PS 对齐、新增 Delete/多选点能力、路径布尔运算、格式/PSD、渲染核心、填充性能、ADA 接入或品牌调整；不改相邻 worktree、原作者 docs。
- 不能通过提前提交草稿再启用另一个工具、双重历史、全局捕获 Ctrl/Alt 抢文本输入、或只更换光标来满足本任务。

## Stages

| 阶段 | 范围与阶段结果 | 状态 |
| --- | --- | --- |
| P1 会话与历史基础 | 当前目标/续画末端/手势 owner、共享点编辑计算、局部历史与统一 Action 路由、历史面板入口保护及主动切换结束检查；补目标/撤销测试 | 已实施并过自动门槛，独立复审/人工 Pending |
| P2 临时编辑与反馈 | Ctrl/Alt/Ctrl+Alt、闭合统一命中/光标/高亮/预览、修饰键及 pointer 生命周期；完成连续绘制流程 | 已实施并过自动门槛，真实窗口/人工 Pending |
| P3 集成验证 | 关联回归、生产构建、隔离当前源码窗口与人工检查；更新 owner 文档及任务证据 | 实施/自动/隔离窗口完成；独立复审、人工/Owner Pending |

已按本轮 Owner 授权 P1→P2→P3 串行、各阶段独立本地提交。不得因本任务创建自动执行循环或自动 reviewer 记录。

## Acceptance Scenarios

| ID | 场景与通过标准 |
| --- | --- |
| A1 核心连续流程 | 画至少三个点→Ctrl 移动旧点/柄→Alt 收柄/拉柄/独立拖柄→松键继续加点→修饰键编辑起点→普通闭合：始终同路径同子路径，无多余点，续画末端正确 |
| A2 模式与修饰键 | Ctrl+Alt 优先级正确；按/松键不移动鼠标也更新光标；按下后中途松键不换 owner；拖柄中按 Alt 解耦且松键不跳柄；文本/IME/Modal 不被抢按键；临时模式点空白不落新点 |
| A3 闭合反馈 | 在 25%/100%/200% 缩放和窗口 DPR 场景核对闭合范围、光标圆圈、起点高亮及预览；提示出现处点击确实闭合，不出现处不误闭合；编辑模式起点不闭合，已闭合后无残留反馈 |
| A4 局部历史 | 加点/移点/转换各一步；有效重绑定键、菜单/命令入口一致；无文档 canUndo 但草稿有步骤时仍能撤销；撤到零点可 redo；新编辑截断 redo；拖动中 Undo 只取消当前手势，连续撤销再继续画无断点。实际挂载 HistoryPanel 点击旧状态/快照、创建快照、清空及相关键盘/菜单入口均被拒绝，路径/局部栈/文档历史不变；草稿结束后可正常使用，无旁路或重复提交 |
| A5 文档历史 | 正常结束只提交一次路径编辑；文档 Undo/Redo 恢复前后结果，Shape 独立创建历史如保留有明确证据；空点击/无移动/拖回原位不新增历史；结束调用重复不重复提交 |
| A6 目标与失效 | Work Path、已有 Saved Path、Shape、Vector Mask 各用小 fixture 覆盖；已有路径 A 加点并编辑旧点→通过实际面板切 B/图层/文档→返回 A→Undo/Redo，A 的有效开放路径与历史正确，B 不被误写，无旧草稿复活。重复选中原目标不结束；切换被保护拒绝时目标/有效草稿保留。外部替换/删除目标以及失焦/Modal 后迟到 move/up/cancel 不覆盖新状态、不在新文档加点、不留下 held 模式；区分外部失效清理和失焦保留草稿 |
| A7 保护与保存 | 锁定/access/保存关闭保护不被绕过；普通保存/正常关闭/切工具后重开结果包含可见有效路径编辑。Space 平移后可继续原草稿，其他工具及独立 directSelect/convertPoint 原有功能回归通过 |

## Validation

- 引用 [验证预设](../../engineering/TESTING.md)：P-DOC、P-INPUT、P-BUILD；P-MOVE 保留为输入生命周期改动的关联回归，不跑无关图像性能基准。
- 补实际 PenTool 事件序列测试，断言锚点/柄坐标、smooth、closed、子路径/目标身份及局部/文档历史；不能仅测 helper 或比较源码文字。
- 补实际挂载 HistoryPanel/PathsPanel 的入口与切换测试，并覆盖图层选择/文档标签的实际桥接；断言源路径数据、目标 active ID、局部栈和文档历史一致，不能只直接调用“结束草稿”helper。
- 补 App/Canvas 实际输入传播测试，尤其 Action enabled、用户重绑定、pointer 捕获、修饰键释放、文本/IME 与空闲草稿。模拟 DOM 事件不能证明 Windows 原生 Alt 菜单/失焦行为。
- P3 使用隔离 profile 的当前源码窗口，实际测试 A1–A3 及原生 Ctrl/Alt/AltTab/IME；记录来源、场景和限制。无可见窗口、真实 IME 或高 DPR 环境时逐项 Pending/Inconclusive，由 Owner 后续体验确认，不宣称全部验收。
- 实施后仅把已实现规则提升到 [输入约定](../../design/KEYBOARD_INPUT.md) 及必要交互 owner 文档；保持计划、自动验证、独立 review、人工/Owner 验收、发布授权分开。

## Execution / Review

首轮方案审查 Changes Requested，R1–R2 修订后 Owner 确认复审通过并授权实施。阶段实现在此记录，独立实现复审与人工验收仍需另行进行。

## Context Delta

本需求的核心是未闭合路径内即可 Ctrl/Alt 即时编辑，而非先完成路径再切工具。临时模式不结束 Pen 会话；草稿局部历史和最终文档提交分别拥有明确责任。PhotoCraft 的 Ctrl 实现可借鉴，Alt 绘制中完整转换为本任务扩展。

## Review Adjustment R1–R2（2026-11-12）

- R1：草稿会话内禁止跳转文档历史、恢复/创建快照及清空历史，保留查看及不改变当前基线的元数据操作；处理器检查与可见禁用一致。补实际 HistoryPanel 点击验收，不建设局部历史面板。
- R2：采用正式路径上的受控草稿；主动切路径/图层/文档等先正常结束旧草稿再切换，失败则保持原目标，结束不等于闭合。外部替换/删除导致失效时保留外部新状态，只清理旧会话，不拿旧快照补交历史。补实际目标切换→返回→文档 Undo/Redo 验收。

### P1 实施与验证（2026-11-12）

- 起点为 codex/dev / 2a4a606；原 README、AI_CONTEXT、DEV_LOG 和新任务文档修改全部保留。提取 pathEditing 的既有目标/命中/PathEdit 与共享单点几何；新增钢笔专属 PenDraft/PenSession owner 桥接，其他独立工具提交入口保留。
- 正式目标上受控草稿，续画子路径和 pointer 手势分开；局部快照上限 100，记录完成手势，无变化不记账，撤到零点仍持有会话与 redo。Undo/Redo/Step Action enabled 与实际业务入口统一路由；拖动 Undo 仅取消本次手势。最终只提交路径及关联 Shape 几何字段，避免整层旧快照覆盖 opacity 等外部新属性；重复结束去重，提交失败保留草稿。
- R1：HistoryPanel 状态/快照恢复、创建快照与清空可见禁用，实际 handler 再查当前 owner，显示先结束路径提示；元数据重命名/删除既有快照不封锁。会话零点 redo 期间仍保护，正常结束后重新启用。
- R2 入口：PathsPanel activePathId 选择经 session setter；替换/保存/重命名/删除/新建路径等 setPaths 操作先 finish；图层选择、mask/channel 目标 setter、Editor.activate/setTool/removeSession 先检查；失败不更改目标。外部对象或路径内容变化仅丢弃旧 owner，不回滚、不补伪历史。Path/Layer 身份、原路径对象/内容及几何位置共同检查。
- 保存/关闭：沿既有 prepareMoveOutput/closeSession 仅补 finishPen，自动恢复保存跳过未完成草稿，浏览器未保存检测包含 Pen 会话；未重写文件生命周期。正常主动结束取消未完成手势、保留已完成步骤，开放路径不自动闭合。
- 目标/创建说明：Work/Saved Path、Shape、Vector Mask 的局部/文档历史及属性保留均有 fixture；空 Work Path 沿既有 getTarget 创建后保留，可供零点 redo，不新增重复目标；新 Shape 保留原独立 CreateLayer 历史，最终 Pen 编辑另一步，重复结束不重复创建/提交。完整 UI 模式与属性矩阵留待 P3/人工。
- 验证：新增实际 App/HistoryPanel/PathsPanel/LayersPanel/Canvas 文档标签 10 项（含四类目标、重绑 Action、零点、保护拒绝、外部替换、失败提交与 Shape 创建）。`npm exec -- vitest run tests/input tests/engine/moveSelection.test.ts tests/gpu/moveOutput.test.ts tests/engine/access.test.ts tests/engine/layerAccessUI.test.tsx --reporter=dot`：**9 文件 134/134 通过**；typecheck 通过。日志本地忽略目录 `doc/material/local/pen-live-2026-11-12/p1-input.log`。
- 首轮挂载测试暴露结束后无显式 owner UI 通知，已补释放后的 historyRev；夹具把图层 mousedown 写成 click 及缺失 ImageData，已改为实际 mousedown、仅隔离缩略绘制。最初 7/9 后为最终通过；既有 wasm 路径/React act 警告保留，不以这些警告代替失败分析。
- P1 提交 `431989f`；Ctrl/Alt 临时操作、闭合视觉与完整 pointer 清理在 P2 完成，真实窗口/IME/DPR 和 Owner 验收 Pending。

### P2 实施与验证（2026-11-12）

- 当前草稿内 Ctrl 临时直接选择，Alt 点击锚点收柄、从锚点拖动成对拉柄、拖既有柄单侧编辑；Ctrl+Alt 锚点按直接选择、柄按独立编辑。closest 屏幕命中复用原 hitKnot，重合锚点/柄的同距离命中保留 anchor 优先；只检索当前 PathTarget，不命中其他已完成路径。空白编辑点击只清临时选择。
- pointerdown 冻结 kind/目标点与柄、原点/快照；续画 spIndex 独立，临时选择旧点不改变末端。拖动中松 Ctrl/Alt 不换 owner；方向柄 Alt 解耦为单向 sticky，之后松 Alt 不恢复联动；普通新增点拉柄也避免解除后跳回。Alt 原有柄锚点可拖动，不在 down 提交收柄。共享几何同样用于独立 Direct Selection，未调用独立工具提交。
- closing 一个判定共同拥有 cursor/hover/预览/实际 down：普通 Pen、当前开放子路径>1点、无手势、8 CSS px 内。圆圈 cursor、起点圈及 rubber-band 终点一致；闭合预览使用首点入柄。Ctrl/Alt 优先不显示闭合，不重复添加首点；结束即时清 cursor/选择/hover。
- 仅 Pen 修饰键在已有 App owner 准入后转发，keydown/keyup 不移动鼠标也更新 cursor；文本/IME/菜单/Modal/access/保存保护仍优先，不 setTool、不改工具组选项。空闲 Space 保留原 pan，忙碌时不接管手势。
- Pen 专用 interruption 事件只清 Canvas 原 Pen capture/activeTool/pointerBusy；Modal/失焦/文本或组合开始取消未完成手势、保留局部栈。新增可选 cancelPointer，只有 Pen 实现；Canvas pointercancel/lostcapture 对 Pen 先取消且不先 up。普通 Pen 加点手势同样取消（这是配套行为变化），其他工具继续原有 up 约定。迟到尾事件不落新点。
- R2 入口复核追加 layerOps 新建/复制/删除/组与合并/栅格化/矢量蒙版等会替换目标或切目标的 owner 检查，setWorkPath 与回放 Shape/Text 创建也先 finishPen；不是重构它们的算法。实际删除 Shape 检查历史为 Pen→Delete Layer；新建为 Pen→New Layer，避免先改历史基线再补交草稿。
- 测试覆盖 A1 连续绘制/编辑/继续/编辑起点/闭合、Ctrl+Alt、松键手势尾段、sticky 解耦、Alt 已有柄转换、空白与 no-op、平滑柄精确拖回起点、25%/100%/200% CSS 命中与预览、按键不移动更新 cursor、文本/组合/Modal/失焦、真实 Canvas cancel/lostcapture、四类目标外部替换、初始锁定/access 和独立 Direct Selection/Convert Point 历史。
- 验证：P-INPUT/P-MOVE 同 P1 联合集 **9 文件 149/149 通过**；typecheck 通过；再补结束 cursor 即时清理断言，钢笔定向 **25/25 通过**。原始日志 p2-input-final.log、p2-final.log 在本地忽略材料目录。真实 OS Alt/AltTab、IME、高 DPR 尚未验收，P3 继续当前源码窗口与门槛。
- P2 提交 `aad75b1`；无新依赖、文档格式或渲染核心调整，未修改相邻仓库。

### P3 集成验证与交接（2026-11-12）

- 集成补强：Editor.activate 返回切换是否成功，文档标签上下文的后续命令在结束被拒绝时不执行；新文档若因旧 Pen 拒绝激活，保持旧目标且同步新标签。Shape origin/位置与路径共同校验；外部几何接管即清理，最终无路径变化时只还原仍自有的关联字段。补实例保留外部 origin 的回归。
- 外部基线：Pen 同时记录开始时历史 anchor；正常 Panel 跳转/clear 已拒绝，绕过面板的外部 clear 若替换基线，则迟到事件只清理旧草稿，不用旧局部快照反写或追加历史，补独立回归。
- 整层快照的有界防线：editLayer 在 clone 前只询问匹配本 doc/layer 的 Pen owner（Work/Saved Path 不受无关图层快照影响），先结束 Shape/Vector Mask 草稿，避免属性快照把未提交路径当作基线。没有改命令算法/通用 History 或建立事务系统。实际 commitAppearance 的历史顺序及两次撤销均测试；图层缩略和通道视图的主动选择先查成功，再更改视图/目标，保护拒绝不落后续动作。
- 实际挂载补测：已有 Saved Path A 原始点 + 新子路径 + Ctrl 编辑旧点 → PathsPanel 切 B → 返回 A → 文档 Undo/Redo，恢复原基线/最终 A，B 不变；路径面板 Delete 的历史为 Pen→Delete Path，两次 Undo 分别恢复成品与原基线；mask 缩略选择、文档标签切换/迟到事件、外部删除、边界外点击不闭合、Shape origin 接管、整层属性快照均已覆盖。
- 保存/正常关闭：实际 saveAs 与 Save-on-close 走原 FileOps/PSD exporter，IO 受控到内存；重新 importPsd 验证已完成可见路径及正常关闭前新子路径；关闭中未完成加点手势取消、不多写点。另有 encodeNative/decodeNative checkpoint，但没有改格式。初次 close 测试因夹具未提供 recovery.remove 失败，补足平台 IO 接口后通过；不是降低关闭门槛。
- 最终 P-INPUT/P-MOVE 关联命令：`npm exec -- vitest run tests/input tests/engine/moveSelection.test.ts tests/gpu/moveOutput.test.ts tests/engine/access.test.ts tests/engine/layerAccessUI.test.tsx --reporter=dot`，**9 文件 163/163 通过**（含 tests/input/penSession.test.tsx 39 项）。`npm run build`（typecheck、renderer、Electron）通过；最终补充 Alt 返回角点 no-op、Alt 按下后无后续 move 仍断开已拖动柄的验收。日志 p3-acceptance-handoff.log、p3-build-handoff.log 在本地忽略材料区。React act/DOM fixture 的既有 LCMS 路径警告未隐去，最终无失败/未处理错误；生产窗口无 console error。
- 当前源码生产窗口：从该 worktree 正常 main/preload/app:// 加载，独立 handoff-final-dpr1 / handoff-final-dpr2 userData/temp；Windows、Electron 44.4.5 / Chromium 152.0.7977.130，webgpu (GPU compositing)，400×300 RGB8 合成路径 fixture，无相邻业务源码或原用户 profile。两轮串行，避免互抢焦点。
- 原生输入自动场景：三点曲线 → Ctrl 移旧锚点并中途松键 → Ctrl 拖柄、手势中按 Alt 独立且松键不重联 → Alt 收柄/原有锚点拉柄/独立拖柄 → Ctrl+Alt 锚点优先 → 松键从原末端续画 → 原生 Ctrl+Z / Ctrl+Shift+Z 局部撤销重做（文档 history 仍 0）→ 真正切焦点到同 QA 进程第二窗口，blur 取消未完成手势、迟到 up 不落点 → 空闲 Space 平移仍保留同草稿 → 25%/100%/200% CSS 起点命中、按/松 Ctrl 不移动鼠标更新 cursor → 普通闭合无重复锚点 → 一次最终 Pen 历史与文档 Undo/Redo。DPR 1、Chromium `--force-device-scale-factor=2` 两轮均 **errors=[]、Electron exit 0**，各观察到真实 window blur；后者为强制缩放窗口模拟，不冒充物理高 DPI 显示器。
- 已查看 close-feedback.png / pen-closed.png，确认起点圈、柄与闭合边线；cursor 的 SVG CSS 值与命中有自动断言，capturePage 不包含真实 OS 鼠标位图，物理光标外观仍留人工。日志 production-handoff-dpr1.log / production-handoff-dpr2.log；截图、harness、profile 均在 `doc/material/local/pen-live-2026-11-12/`，默认不提交。
- 窗口夹具失败与处理保留：初始固定坐标受半像素 view 原点影响，改为明确整数 CSS 测试视图；BrowserWindow.blur 本身未产生 window blur（观察计数 0），改为真实焦点 peer 窗口后计数到达，回滚/尾事件才算通过。DPR2 首次新建尺寸夹具未完成焦点/输入更新，补原生聚焦及 RAF 等待后核对实际 400×300 再执行。没有改产品命中范围或以假 DOM blur 代替原生结果。
- P-DOC：修改文档 UTF-8 无 BOM、相对链接、本地材料忽略、上游 docs/根 README/CHANGELOG/NOTES 不变及 diff check 通过，见本地 p3-doc.log。输入/交互 owner 与短索引已更新；旧任务验收、填充、PSD 算法及品牌均未改。

### 未验收项与独立复审入口

| 场景 | 当前证据与门槛 |
| --- | --- |
| A1 | 实际 PenTool 四类目标与生产窗口 Work Path 连续 Ctrl/Alt/续画/闭合自动通过；真实作品/全部目标窗口人工 Pending |
| A2 | App/Canvas 传播、空白/no-op、固定 owner、sticky Alt、文本/组合事件、Modal/blur 自动通过；Windows OS AltTab、真实中文 IME/候选窗口与原生菜单完整人工 **Pending / 未执行项 Inconclusive** |
| A3 | CSS 8px 边界内外实际点击/预览、25/100/200% 与 DPR1、强制 DPR2 窗口通过；物理高 DPI/跨屏、OS 光标位图与更多缩放/旋转设备人工 **Pending** |
| A4 | 局部 Undo/Redo/重绑/耗尽/拖动取消/分支、实际 HistoryPanel 状态与快照/toolbar 禁用及 handler guard 自动通过；完整键盘/菜单人工 **Pending** |
| A5 | 一次最终路径编辑、Shape 独立创建、重复结束、空/返回原态、失败保留、属性历史分离自动通过；Owner 体验 **Pending** |
| A6 | Work/Saved/Shape/Vector Mask；真实路径/图层/mask/文档入口与旧点编辑后切 B 返回 A Undo/Redo、保护拒绝、外部替换/删除/origin 接管、迟到尾事件自动通过；完整外部集成矩阵 **Pending** |
| A7 | 锁定/access/输出/切工具、Space、实际保存/正常关闭受控 IO 与 PSD/native 重开、独立 Direct Selection/Convert Point、关联 Move 等自动通过；真实文件系统/全部格式/笔设备 **Pending** |
| 审查/发布 | **待独立实现复审**；方案通过与自动通过均不是整体实现/人工/Owner Approved。未授权推送、合并或发布 |

复审从 `2a4a606..本任务交接HEAD` 读最终源码与任务，不能只看 diff。重点入口：PenTool / PenDraft / PenSession / pathEditing；Action/editOps/inputDispatch；Session setters、Editor.activate/setTool、FileOps prepare/close、editLayer 的定向快照 guard；HistoryPanel/PathsPanel/LayersPanel/DocTabs；Canvas cancel/lostcapture 与修饰键传播；实际 penSession.test.tsx 和本地生产日志。P1 `431989f`，P2 `aad75b1`；P3 `1231c9a`；hash 由本次独立文档回执回填，避免提交内容自引用。原有文档改动已保留，未改相邻 ADA/main_native/embedded，未推送/合并/发布。

### 阶段提交回执（2026-11-12）

| 阶段 | 本地提交 | 验证 |
| --- | --- | --- |
| P1 | `431989f` | 会话/局部历史/主动目标与面板保护；P-INPUT/P-MOVE 134/134、typecheck |
| P2 | `aad75b1` | Ctrl/Alt 编辑、统一闭合和 pointer 生命周期；关联 149/149、钢笔定向 25/25、typecheck |
| P3 | `1231c9a` | 最终 9 文件 163/163、生产构建、P-DOC（6 文档/84 相对链接）；当前源码 DPR1/强制 DPR2 原生序列 errors=[] |

独立实现复审 **Pending**，未执行的真实 IME/OS AltTab/物理高 DPR、完整人工及 Owner 验收按上表保留 Pending/Inconclusive。本回执仅补齐阶段 hash，未改代码或链接；追加后 UTF-8 无 BOM/diff check 通过。本轮仅本地提交，不推送、合并或发布。
