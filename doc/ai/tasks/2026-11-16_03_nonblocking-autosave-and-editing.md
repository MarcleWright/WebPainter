# 无感自动保存与连续编辑：分阶段修复

日期：2026-11-16。状态：**方案review通过（两项非阻断补充已纳入），Owner已授权goal模式按0→A→B→C实施、必要验证、独立审查和分阶段本地提交。** 每阶段审查无阻断后继续；subagent统一gpt-6.1-sol，不推送/发布、不合ADA主线。

## 1. 产品要求与事实输入

Owner确认：普通后台保存不应阻断几乎任何正常编辑操作。绘画/擦除、换色、笔刷参数、切工具、Space平移/缩放、Pen续画/编辑/局部历史、路径转选区、图层操作、撤销重做和变换，不得仅因后台保存存在而拒绝。不以隐藏busy提示替代恢复操作。

保存捕获稳定检查点后，后台编码/传输/写入；用户继续编辑，最新需求进入下一轮。旧回执只确认原检查点，新编辑不得误标已保存。保存失败保留当前作品、状态非模态提示，不抢焦点、不连续弹窗，不忙重试。返回/关闭/切Profile属于显式离开，可建立最终内容截止点并排空保存；同Profile同实例连接续期不得走离开/重建流程。

事实输入：[连续操作排查](2026-11-16_02_embedded-editing-continuity-audit.md)。该轮5项受控诊断确认缺陷存在，不是修复验收；未做完整iframe/设备实测。两根因：embedded native白名单漏掉6个color/brush Action；outputPending兼任输出互斥与编辑阻塞，真实背景保存释放canEdit后，实际键盘/Pen/路径/Modal仍被拒绝。此前canEdit/直接领域命令与续期测试不能证明键盘连续可用。

已有可复用能力：snapshotDocument的元数据深复制与raster COW、checkpoint worker分批独占传输/原codec、history entry保存点、ADA一次在途与最新需求合并、revision/CAS、回执operation身份。保留这些成果，不重建存储或另写WP内核。

## 2. 仓库、基线与本期边界

| 工作树 / 分支 | 设计时基线 | 修改责任 |
| --- | --- | --- |
| `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter_main_native` / main | 6eb2685 | 通用输出/编辑准入分工、工具稳定边界和交互消费者迁移、历史/快照正确性 |
| `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter` / integration/embedded | d277f7c | 单向合main；嵌入checkpoint/编码/回执生命周期、6个有限Action、端口状态 |
| `D:/00_Projects_WSY/AI/Codex_Projects/auto_design_Agent` / codex/isolate-drawing-interface-20261104 | 6da525c8 | 自动保存需求调度、状态文案、离开排空/失败恢复、固定包消费与业务验证 |

ADA当前固定包mainBase5924a6d / embedded d277f7c / bundle e1798e817a185b338b5f92d70d6ce5411ac27679d89bbc1b572c42c494b26c73，port3/native1。实际执行前重核完整HEAD、dirty、适用AGENTS、文档入口及平台合同，保全已有未跟踪排查报告和其他工作。不操作Dev或相邻_New，不用dirty构建clean包，不重标旧包证据。

不包括：开放全部WP能力、重做存储/native格式、半途草稿崩溃恢复、全工具jobs/全局任务总管、持续整文档副本或每次指针采样快照、多Worker/GPU权威写入、上游PR/ADA主线/发布。旧R4与opacity偶发多history保留已知状态；但本次必须证明保存不会新增历史切分，不能以旧问题名义豁免新回归。

Owner范围澄清：ADA内WP透明处选下层的问题，在开启Auto-Select后已正常，确认为选项关闭导致。本轮不加入选层修复、不改变Auto-Select默认值；独立蒙版/opacity命中边界留后续，不影响本任务的输入/保存验收。

## 3. 必须冻结的职责与生命周期合同

### 3.1 单一事实与公开入口

- DocumentSession拥有文档存活/实际编辑保护及输出状态的权威事实；工具owner拥有当前手势、草稿有效性和可收尾性。编辑调用者通过所属owner的公开准入读取，不各自猜测“有Promise就是禁止编辑”。
- 输出owner独占输出槽的开始、结束、失败清理和检查点回执；ADA Autosave拥有何时发起/合并/重试的需求，不直接改WP内部字段。订阅者只能观察，不能提前解锁。
- 区分输出在途、快照暂不可捕获、实际内容保护和离开过程，不要求这些全部成为持久字段；实施阶段选择最小状态/接口，不为每个入口增一个旁路开关。
- tool自身冲突、未完成指针手势、transform权威准备、资源导入实际保护等继续按原owner管理。普通保存不扩大这些保护的寿命；视口导航和纯UI参数不因保存任务在途被拒绝。

### 3.2 稳定边界与历史

只在真实稳定操作边界捕获。Pen草稿会先改live path再最终入历史，文字/Move/transform也有暂态；不能只凭canEdit或history.current存在就快照，也不能把当前doc所有字段无条件当已提交状态。

- 自动保存遇到未结束操作延期捕获，用户继续操作；不得自动finishPen、提交文字/变换或取消工具。操作稳定后的通知推动合并需求重新执行，不依赖下一次随机输入/定时碰巧触发。
- 若一段长手势/草稿迟迟不结束，允许最近已保存检查点落后，并明确尚有未保存内容。不能声称草稿已落盘；不为本期保留额外整文档“上次稳定副本”或设计草稿恢复协议。
- history.seal只能作用于确定结束的用户操作边界，不能定时截断scrub/笔划，也不能改变Pen局部撤销。一手势一次历史与旧checkpoint可辨识须同时成立。
- 捕获检查点与身份须在同一稳定边界绑定。若检查安全与捕获间发生await/yield，要重新验证，而非读取混合状态。短同步COW捕获可以存在，但不能靠长编辑锁跨越worker/IO等待；实测其成本，不承诺数学上零耗时。

### 3.3 快照、输出和回执

捕获的像素、路径、文字、图层属性及保留元数据不能随live编辑变动；worker只能transfer私有副本，不得detach文档/历史共享buffer。沿现有有界分批复制/worker编码，不在主线程补回整幅像素序列化。

每会话一个在途输出、一个最新需求，不建立无界队列或为每次编辑落盘。保存A期间编辑B/C，A成功仅确认A；下一轮可合并到C。undo/redo/历史分叉后仍以正确checkpoint判断dirty。旧成功/失败/取消回执不得覆盖新操作状态或释放别人保护。正式保存、恢复备份、生成捕获、手动输出的互斥由输出owner协调，不能各自绕过接口写入同一作品。

### 3.4 显式离开、取消与失败

返回/关闭/切Profile有独立离开owner和明确截止点：按工具合同收尾当前操作，然后禁止新增目标内容修改、捕获最终检查点、等待保存确认后离开。收尾必须能在本owner授权下完成，不能先设保护再把自己的Pen提交/历史堵住。禁止在仍无限接收新内容时循环flush追赶dirty。

离开等待仍应有可理解的进度/失败反馈；失败或取消离开，释放本次保护，恢复编辑及后续保存调度。保留“正常返回不提供破坏性放弃”的既有合同，不新增丢弃作品按钮。同Profile续期保持实例、草稿、历史与原operation/checkpoint，不建立截止点。同目标输出不可并行的限制不转嫁成全画布不可编辑。

## 4. 阶段0：接口落点与旧路径退休清单

完整阅读受影响链路，列出每个状态的创建者/修改者/释放者/读取者，以及修改后的职责。必须覆盖所有outputPending/closePending/editProtected判断，按用途分类，不能机械全删。至少列明：

| 当前入口族 | 必须回答的问题 |
| --- | --- |
| Session、fileOps、embedded editor/capture/addResource | 哪些互斥仍需保留；哪些后台输出不拥有编辑保护；谁处理终态和owner释放 |
| inputContext/inputDispatch/数字延迟参数/heldPan | 同样的后台输出为何不再取消数字、拒绝Space、切工具或普通Action |
| PenTools/PenDraft/pathSelectionOps/finishPen | 草稿稳定边界、局部历史、自动捕获延期与显式离开收尾怎么区分 |
| transformTool/文字/Move | 保存期间可继续使用；自身applying/手势冲突的保护不被越过 |
| Modal/EditingDialogs/DocumentDialogs/CanvasView/菜单面板 | 键盘、按钮、领域入口语义一致，拒绝和取消清理不走不同保护假设 |
| embedded mount.tsx的指针/按键/IME/控件焦点边界 | 区分仍未提交的控件值与已完成参数编辑；操作结束后即使无下一输入，也必须通知并唤醒保存；只保持焦点不能无限延期稳定内容 |
| Autosave/Recovery/Controller/连接续期 | 谁订阅稳定通知，最新需求如何恢复，离开失败后如何退出等待 |

产出“保留/替换/删除”的旧判断清单、最小新准入合同、状态时序和交叉测试落点。替代接口落地后退休旧判断，禁止长期双轨兼容。通用改变先main，不把embedded专用字段散入通用工具；独立版手动保存的路径/绑定/输出合同需回归，不以ADA需求静默放宽全部手动操作。

阶段0只做针对当前问题的落点设计，不扩展为全仓可观测平台。发现本期前置能力不成立时修订任务再实施，不用含糊“busy”绕过正确性。

## 5. 阶段A：WP main通用准入与稳定操作边界

在main实现阶段0确定的最小公共能力；逐族迁移交互消费者并清除被替代的直接字段检查。保留实际canEdit/owner保护，不让公开准入绕过锁定图层、失效目标、active gesture或transform提交。显式输出准备与自动捕获采用不同收尾意图，不允许调用者传任意绕过保护的布尔值。

阶段验收：

- 在真实Session/工具/dispatcher上表达非阻塞后台输出，验证X/D、大小硬度、切工具、数字参数、Space导航、Pen/路径转换、图层/undo/redo/transform及Modal可按其正常前置执行；另验证真实编辑保护仍拒绝相关修改。
- 数字输入期间启动后台保存不取消本应落下的参数；工具/目标失效仍按原合同取消。只改提示文本不合格。
- Pen/文字/Move/transform、连续scrub/笔划的稳定判定真实可用；自动捕获不结束手势、不改变一次操作历史边界，结束通知能释放待保存需求。
- 快照后继续改像素/路径/文字/属性与undo/redo/分叉，固定快照内容不变；不同历史状态的保存点语义正确。
- 定向联跑input、Pen/path、transform、Move/output、snapshot/native/history及保存关闭，P-BUILD。测试针对真实事件和业务结果，不mock准入返回true。

形成独立可审查main提交；独立review无P1/P2后才推进B。不把接口新增/类型通过代替行为验收。

## 6. 阶段B：embedded非阻塞checkpoint与能力补漏

普通merge阶段A确定main提交；保留embedded boot/keyboardTarget/portalTarget、native边界、后台codec/预览worker，不覆盖宿主适配。通用缺陷回main修复验证后再单向合入，不复制第二份通用状态机。

- native背景快照/编码/host写入占输出槽，不在整个Promise期阻塞编辑；短捕获保护正确释放，期间开始的新操作归下一需求。输出竞争继续串行/拒绝或合并，不能并发写同作品。
- 端口busy/state语义明确区分“不能捕获”与“不能编辑”，订阅者可判断稳定边界/未保存内容；有新增字段或变化先明确两端兼容性，必要时升级port版本，不无依据声称port3兼容。
- 显式接纳color.reset/color.swap/brush.size.decrease、increase/brush.hardness.decrease、increase六项；原产品禁用仍优先，Toolbar按钮和快捷键遵守相同能力入口。不得借此开放所有color/brush未来Action或不支持文档类型。
- 稳定快照前后绑定generation/binding/operation/checkpoint，旧回执不能mark当前新编辑clean或污染取消重试；不因为保留输出互斥就把该字段继续用作编辑锁。

阶段验收：使用实际initializeEditor、键盘dispatcher、真实Pen/路径/Modal/工具输入，延迟checkpoint worker准备、编码及host.save三个阶段分别操作。检查实际坐标、颜色、工具、选择、路径和历史结果，而不只断言canEdit=true。必须重现并修复[排查报告](2026-11-16_02_embedded-editing-continuity-audit.md)五个场景及同类六Action执行。

验证并发编辑期间编码的是固定快照；一在途/最新需求、失败重试、旧回执、restore/close/destroy及生成独占均闭合。恢复备份也不阻断编辑。独立测试历史不被保存周期切碎；opacity旧问题未复现不能直接写“已修复”。联跑embedded生命周期/codec/capability/RPC及A受影响回归与构建。

补充mount.tsx实际边界用例：pointerup/keyup、compositionend、参数提交/blur后不再输入，保存仍被稳定通知唤醒；未提交文字/控件状态不能因忽略焦点而误捕获。

独立review通过后，从clean源构建固定包并逐文件校验；记录mainBase/embeddedCommit/sourceHash/bundleHash/port/native版本、资源和Worker路径。不可用dirty新实现搭配旧manifest，不修改vendor补丁。

## 7. 阶段C：ADA调度、离开截止点与新包消费

在ADA现有绘图集成分支正规消费固定包，同步前端/API配套记录；保留悬浮Panel，不改成占据画布空间。按新端口语义订阅可捕获/在途状态，保留750ms空闲/5秒需求、10分钟备份的一在途/最新需求策略；5秒不是强制结束长操作的承诺。

- 稳定通知到来后重新检查最新需求；长操作、编码中持续编辑不会丢掉“还需保存”的需求，也不能产生空转重试。
- 状态文案按已确认检查点和未完成操作表达；存在未保存草稿/新编辑时不显示“当前全部已保存”。失败用非模态状态保留重试机会，同一失败检查点不忙重试，离开可明确重试。
- 建立离开截止点并按§3.4执行；不在编辑不中断时无限flush，也不在失败后残留close/closingRequested或锁定工具。
- 同Profile同实例续期分别测试Pen草稿、applying、编码/保存中续期；保留原实例/history/草稿/op/checkpoint。切作品/切Profile测试旧身份失效，不把续期当切换。
- 保持Primary/recovery CAS与旧候选处理、返回后准确revision/hash派生预览、生成D/r对应完整reference与Results/显式加层；普通保存仍不生成PNG，不调用真实付费Provider。

阶段验收：API/contract/controller/autosave/recovery/output-gate及新旧配套校验；真实owner连续输入组合测试，含保存A→编辑B→undo/redo/分叉C→A回执→最终保存C并重开。补离开期间停止新增内容、保存失败/取消离开恢复编辑、重试成功后退出及准确预览。编码/IO慢不能导致连续busy toast，保存状态不抢焦点。

执行类型、Web与Desktop资源构建。新固定包在开发入口和生产资源路径检查Worker及全部资源哈希；真实iframe加载和人工操作必须最终有记录，不能用静态哈希代替。相关真实窗口步骤按后续Owner授权由执行者或Owner承担，不能未经确认自动省略为整体通过。

## 8. 最终验收、提交与审查边界

未来获实施授权后，0→A→B→C按顺序执行，每阶段先有任务/落点、必要自动检查、可审查本地提交和独立review，无阻断再推进。工作树与共享Git写入串行。是否使用goal/subagent及模型由Owner执行指令决定，本文件不自行启动。

早期真实流程探针的固定时点：**B阶段首次可消费候选包接入ADA后、展开C完整矩阵前**执行；沿用现有窗口脚本，不另建框架。最小真实生产流程探针：实际ADA iframe中故意延迟后台保存，同时X换色、Space拖动、Pen→Ctrl+Enter，并在完成后重开确认；实现初期尽早核对接线，不等全部完成后才发现只测到领域旁路。最终再做有限功能族矩阵，不要求全工具/全格式笛卡尔积。

成功标准：正常后台保存不新增键盘/工具拒绝、不自动提交草稿、不截断手势；最终图像/路径/文字与历史正确，最后保存可重开；旧回执不污染新内容；离开可结束且失败能回编辑。分别记录快照最长同步任务、复制批次、输入/显示长帧与写盘时间，比较同文档/同操作的无保存与延迟保存，不以IO完成快或平均FPS替代连续体验。存在不可解释的新长阻塞必须归因，不以“异步”判通过，不扩为无依据性能重构。

真实笔、IME、高DPR/多设备与全格式可单独Pending。自动、真实窗口、Owner体验、独立review与发布分别记录；所有未测项目明确，不以单元测试通过宣称完整产品Go。

交付含：旧判断退休清单、各owner最终状态/时序、提交链和审查结论、自动/窗口证据、配套版本/哈希、回退办法及剩余问题。回退不等于回滚用户数据；端口变化要保留明确配套，不静默降级或清恢复文件。未经另行授权不推送、不合ADA main、不发布。

## 9. 原规划交付（历史）

仅编写修复计划及main简短索引；前置排查报告保持原样。本任务尚未实施，没有运行本轮修复测试、构建或换包，等待设计review。


## 执行授权与补充（2026-11-16）

Owner明确要求补齐reviewer两点并开始subagent长任务，现goal已active。授权阶段内必要源码/测试/文档修改、main单向同步embedded、clean固定包消费到ADA原绘图分支，以及分阶段本地提交；不推送。所有旧规划禁止实施文字保留历史含义，以本次授权为准。现有main未提交文档含独立选层记录，须保全、不要混入本轮产品修复；Auto-Select问题仍不在范围。阶段0先形成可审查的owner/退休清单，独立review通过再实施A。

## 10. 阶段0源码落点设计（2026-11-16，待独立review）

本节为实施合同，**尚未实现或运行修复验收**。全文读取本任务、前置02、WP两工作树入口/协作规则，并以实际源码搜索核对。当前main完整HEAD `6eb26857db09da092f913ccd200a72470012dd8b`，embedded `d277f7c3ec1b574af8672fe3a98972c88efaead3`，ADA `6da525c882b3c4df42ec6c29c308199923adae82`；后两树clean。main既有AI_CONTEXT/DEV_LOG/KNOWN_ISSUES dirty，02/03及LAYER_PICKING_ASSESSMENT未跟踪。改动前全部逐文件保全至忽略材料 `doc/material/local/2026-11-16/autosave-stage0-before/`（含SHA256）；选层文档与KNOWN_ISSUES本阶段不改、不混提交。没有开启用户窗口、调用真实Provider、合并、构包或提交。

### 10.1 最小公共合同及owner

在通用层建立一个针对**稳定检查点**的公开模块（建议 `src/app/checkpoint.ts`），不是全局jobs。DocumentSession继续唯一拥有存活、真实edit protection、输出槽与close生命周期；该模块组合既有工具owner的纯查询，不复制Pen/Move/transform内部状态。

1. `canEdit()`仍只表达未disposed且无实际edit owner；普通后台输出不加入该判断。通用交互只读取canEdit及各自工具/目标/policy前置。`outputPending`、`closePending`改为session内部字段，公开输出槽reserve/join/release接口（release核对原reservation token），只由fileOps/embedded输出owner使用。不要保留可任意赋值的旧字段给交互继续读取。close的Promise去重不是编辑锁。
2. 公开 `checkpointReady(session)` 纯查询：session存活/canEdit、无Pen owner、无text edit、无Move暂态、无transform preview/pending、无当前tool.busy、无Canvas指针transaction、无已注册控件未提交/连续手势。输出槽是否空闲单独读取，不混入编辑准入。viewport pan/纯UI状态不构成文档暂态；仍可作为短输入避让，不能锁画布。
3. 公开稳定变化通知复用session.on/notify；增加针对本session的控件/Canvas操作边界登记（开始返回释放函数，幂等释放、卸载释放、结束后notify）。它只计数未结束的UI操作，不保存任务、不拥有异步工作、不改变history。工具owner开始/结束都notify；订阅者在通知后重读checkpointReady，不信任事件携带的旧true。后台保存仅在pending需求存在时响应，不轮询。
4. 以意图明确的 `prepareExplicitOutput(session)` 替换prepareMoveOutput；只显式保存/生成/离开调用，可结束Pen/text/Move，transform保持既有等待applying、保留未确认preview则拒绝。后台捕获只使用checkpointReady，绝不调用prepare。退休 `finishPen(output:boolean)` / `PenDraft.allowed(output)` 旁路：准备在真实close保护建立之前完成，普通Pen合法性不再检查输出Promise，无需任意boolean越锁。若explicit preparation发生await，返回后重新核对session、target和所有稳定前置。
5. 实际protection保留token集合与transform唯一owner提交合同。清除无生产writer的legacy editProtected setter（全src搜索无赋值）；只保留只读派生查询或直接用canEdit。acquire/release在事实变更时notify，不能让观察者负责解锁。

历史身份仍使用history.current.id；不另引入文档版本系统。history.push的merge会保留entry ID，所以稳定捕获须先seal，再同步绑定entry/revision与snapshot。seal只禁止**下一次**push merge，并非提交当前操作。后台任务不能在活跃scrub/数字延迟/手势中调用seal。

### 10.2 全部旧状态生产消费者的退休表

下表覆盖main及embedded `rg outputPending|closePending|editProtected src` 的生产命中；main与embedded通用命中相同，阶段A改main后普通merge，不双写。

| 生产落点（当前行） | 保留 / 替换 / 删除及具体职责 |
| --- | --- |
| session.ts:31–48、history.canMutate/doc.editingAllowed | 输出/close Promise保留为私有owner状态和join接口；editOwners与disposed保留；legacy布尔setter删除。canEdit不含背景输出。真实close cutoff以专属edit protection表达。 |
| fileOps.ts:59/66/68 outputRequest | 保留同session输出互斥和终态清理，迁入token输出槽；手动路径writingPaths继续独立保留。独立版手动Save/SaveAs/Copy/Export的显式收尾、路径选择、错误与现有实际output protection寿命不在本期静默放宽。 |
| fileOps.ts:375/380/399/401 closeSession | 保留重复close join和已有输出join。删除交互读closePending需求；先await既有输出/transform、收尾、重检，再同步建立close保护和最终身份；finally只释放自己的token。native host保存不能再依赖closing=true的随意旁路，使用close owner内部输出入口。 |
| inputContext.ts:21；inputDispatch.ts:27 | 删除输出/close Promise拒绝；只按canEdit和已有pointer/tool/dialog/target/policy判定。350ms数字pending订阅不得因output notify取消；稳定查询需纳入未落下的数字（注册pending开始/取消/apply完成通知）。heldPan仍按自己pointer与窗口失焦释放。 |
| actions.ts:189/213（freeTransform异步准备与place） | 删除输出/close字段读，保留session/doc/tool/mode/layer/取消/policy/dialog身份重检与canEdit；资源加载实际保护不删。保存中可启动transform，旧快照不随新preview变化。 |
| ops/pathSelectionOps.ts:19 | 删除输出/close判断；保留canEdit/mode/policy/目标及expected Pen owner核对。转换显式finish该Pen后继续真实转换，不因背景输出拒绝。 |
| penTools.ts:112；penDraft.ts:55；penSession.ts finish桥 | 删除Promise判断与output布尔豁免；保留Pen owner.valid、layer锁、mask能力、局部history/finishing重入保护。注册、commit/abandon/invalid清理释放时发稳定通知；开放路径仍是draft，pointerup不算完成。 |
| transformTool.ts:277/453 | 删除输出/close判断；保留job/canEdit/session身份、预算/预检以及transform protection/pushProtected。begin preview、applying开始及finally成功/失败/取消发通知，失败保留preview时仍不可捕获。 |
| Modal.tsx:36；EditingDialogs.tsx:198；DocumentDialogs.tsx:200 | 删除输出/close判断；保留top dialog、session/doc/layer/mask/channel身份、canEdit和policy。预览型调整dialog从打开有效preview到Apply/Cancel完整结束登记不稳定；Cancel还原完成后再通知，不能把中间preview当已提交。 |
| CanvasView、菜单/Toolbar/面板（无直接三字段命中） | 维持canEdit/policy领域入口；Canvas pointer transaction在down→up/cancel、capture丢失及卸载清理登记；up调用tool.up或cancel完成**之后**释放/notify。现有setInputPointerBusy在tool.up之前清除，不可直接当捕获已稳定的信号。控件见10.3。 |
| app/autosave.ts:39/45/52（独立恢复） | 输出槽、close过程避让保留为输出竞争规则；移动/Pen/transform散列替换共同checkpointReady，每次yield后重检。不强行finishPen，不因迁移而改变恢复目录/写入队列/removal顺序。 |
| embedded/editor.ts:38、100/113/114、119/140/141、170 | busy合并表达退休；capture/nativeCheckpoint/saveBackground使用输出槽互斥+共同稳定查询。背景native/recovery捕获仅短同步COW保护，编码/host IO只占输出槽；capture显式准备及既有导出保护保持。finally核对reservation身份释放。background预检与Promise微任务实际捕获之间重检。 |
| embedded/editor.ts:177/191/192 addResource | 保留输出槽竞争、实际resource protection及op/session校验；读资源/解码期间真实保护不移除。安装命令前只释放自己的token，其他owner仍通过canEdit拒绝；失败不留下保护或槽。 |
| embedded/editor.ts close confirm/native closing参数 | host正常返回无破坏性放弃保持。close内部可在自己cutoff保护下读取固定最终checkpoint，不向普通api暴露ignoreProtection。解除原closing参数和Pen output布尔互相绕过。 |

完成A/B后再次全src搜索：输出Promise只允许在Session与输出owner内；所有交互族不得出现旧输出字段。真实edit保护writer：main fileOps save/export/close、transformTool；embedded capture/checkpoint/resource。全部保留token清理与过期防护，不机械删除。

### 10.3 实际稳定边界与mount控件合同

`editor.beginInteraction/endInteraction`当前只延迟面板docRev，不能证明document稳定；MoveTool松手可能仍保留floating selection，`editor.moving(s)`/finishMove才是owner边界。typeTool已有onTextEdit，start/edit/commit/cancel都以该owner为准。PenDraft直接改livePath、changed发doc事件且record只写局部states，直到Pen commit/abandon且桥owner释放前一律延期。transform预览与applying结束分别观察，不把worker完成和preview可提交混同。

main新增边界必须覆盖：Canvas stroke/eraser/selection/guide等真实up/cancel完成；Move lift/finish/cancel；Pen注册/释放；type start/commit/cancel；transform preview/start/applying/finally；数字pending apply/cancel；Modal预览Apply/Cancel；共享NumberField和Slider。每条结束路径（含失败/卸载）通知，订阅回调不在doc.emit中同步捕获，合并到当前事件处理结束后重新查询。

embedded mount.tsx当前window capture监听pointer/key/composition/focus，使用setTimeout唤醒；`busy()`还把所有聚焦textarea/contenteditable/非range input永久视忙。这个focus规则必须删除，不能只删focus检查后忽略未提交值。

- 共享NumberField当前onChange仅setText、blur才commitText；新增局部未提交登记，在输入文本偏离已提交value时开始，成功commit或无效值还原完成后释放。未编辑的focus不登记。ArrowUp/Down是已调用onChange的提交参数，keyup后可稳定，即使仍聚焦；Enter的blur/commit完成后通知。IMΕ compositionend不等于文本已提交，仍以该控件commit和type owner决定。
- NumberField label scrub从pointerdown登记，pointerup/cancel/lostcapture清理并在onCommit完成后释放；不能在保存定时器里seal。Slider onChange已改doc的连续手势在pointerdown或range键按下开始，pointerup/keyup/onCommit完成后结束；补cancel/卸载。参数已提交但仍聚焦range/NumberField，保存必须继续。
- 普通input/textarea/contenteditable按各自owner实际commit合同登记未提交值：Canvas文字由type owner；dialog编辑由dialog owner；图层重命名等局部buffer由对应编辑组件在提交/取消后释放。实施A必须通过全UI检索onChange/local buffer枚举，不能以CSS selector推断已提交。纯搜索/文件名等不改document的输入不加入文档暂态。
- mount只提供输入事务避让（pointers、keys、composing）及事件结束后的通知；window blur清keys，也清遗失pointer并通知，但**不替工具提交/结束draft**，实际owner仍阻止捕获。focusout延迟回调在React提交之后读取；compositionend/keyup/pointerup/pointercancel、控件commit通知都能独立唤醒pending需求。注册监听和所有释放在destroy清理，shadow portals与iframe各测一次。

测试必须包含“最后事件后不再输入”：range pointerup、NumberField blur/Enter、ArrowUp后仍保持focus、compositionend后明确commit；反例是NumberField已键入但未blur/commit、文字draft和Pen开放路径，均不得被捕获。长按Space或聚焦本身不能无限延期已经稳定的文档。

### 10.4 捕获/回执及离开时序

背景：ADA记录最新需求D → WP输出槽reserve（不设编辑锁）→ 微任务重检session/binding、checkpointReady与边界计数 → 在同一同步段history.seal、取entry/revision、短保护、snapshotDocument、释放短保护 → checkpoint-output已有有界private tile复制/worker → host.save → 验op/generation/binding/session → markSaved(原entry) → token释放槽并notify。若重检不稳定，返回deferred，不报用户保存失败，不触发忙重试；需求保留，等稳定通知。捕获后新B/C可立即编辑，旧A成功只确认A；A失败不能无条件markUnsaved清除后来确认的saved身份。每session只有一输出槽，无额外队列。

snapshotDocument现有深拷贝metadata/custom/path/text等与raster COW复用；不更改captureState为持久第二份文档。测试覆盖mask/channel/companion/selection、smartSource/pattern和metadata嵌套对象。worker transfer对象必须是复制批次私有ArrayBuffer，检查live/历史buffer未detach。稳定捕获seal后再有同类merge命令必须获新entry，undo回A可准确clean；redo/分叉保持dirty判定。control手势中不得seal，Pen局部undo不变。

离开：ADA controller.leave去重并暂停调度 → await opening/recovery/当前输出（不把此等待当cutoff）→ 调用WP明确的“准备并冻结离开”入口 → 等待applying；按owner合同结束Pen/text/Move、拒绝未确认transform/未结束不可收尾手势 → 重检身份和稳定性 → **同一同步段建立close edit token并绑定最终entry**（此刻cutoff）→ 在close owner内部输出最终checkpoint并等host确认 → 校验仍是截止身份、移除session/destroy → ADA派生该revision/hash预览。不得继续controller当前两次flush的while追赶活跃编辑，再最后才requestClose。

端口落点：采用port **4** 的配套升级，新增明确 `outputBusy`、`checkpointReady`、`hasUncommittedChanges`，dirty仍表示history相对已确认点；删除旧busy歧义字段及两端busy fallback，更新contract/frame RPC/loader/版本拒绝测试。`hasUncommittedChanges`由工具/控件owner派生，用于draft无history时仍显示未保存；不让ADA猜WP字段。离开使用requestClose内完成cutoff+保存（返回false恢复），由其唯一owner控制，不再调用Autosave.flush追赶；如需在销毁前宿主确认，使用明确close生命周期方法，不暴露任意ignore锁参数。C实施时合同测试固定API具体形状，新增方法必须同步RPC和销毁清理。

失败/取消：close owner finally释放自己的token/close Promise，仍有transform/resource owner不得顺手释放；ADA clearing closingRequested、重建backupTimer、changed唤醒。同一失败checkpoint+change抑制自动忙重试，明确离开重试可清失败身份；state显示仍有新编辑/draft，不显示全已保存。续期只更新同实例连接token，不调用leave、不丢已有operation/checkpoint；切binding才失效旧回执。Recovery不markSaved，与正式输出共享槽，10分钟需求在不稳定时保留并由稳定通知重启。

### 10.5 实施/验证落点与阶段门

| 阶段 | 真实链路与自动验证落点 |
| --- | --- |
| A | tests/input/{baseline,scopedDispatch,penSession,pathSelection,surfaces}.test及tests/gpu/moveOutput、tests/engine/{transformTask,native}.test；追加共享控件DOM测试与history/snapshot固定点测试。真实session输出槽延迟，实际dispatcher按X/D/六参数、E/Space/数字、Pen局部历史/Ctrl+Enter、Modal导航和transform；同时真实edit token应拒绝。无需native host即可测非阻塞背景槽语义，独立手动fileOps显式保护须继续回归。 |
| B | 现有embeddedNative/embeddedIntegration/codec/capability/RPC测试：真实initializeEditor+input dispatcher，分别延迟worker prepare、encode、host.save并重跑02五场景。增加mount真实React控件/portal/IME边界、private transfer、旧回执/取消retry、恢复捕获/生成冲突；联跑A并构建。 |
| C | ADA apps/web/src/editor/{autosave,controller}与output-gate/recovery/contract/API测试：state分字段调度、deferred结束必唤醒、失败不自旋、请求close后cutoff不可再改、失败恢复与retry、同Profile Pen/applying/encoding/save续期、切binding旧回执。现有scripts/drawing-autosave-evidence.mjs及相关实际窗口脚本沿用。 |

阶段0独立review范围就是本节与短索引，源码只读；无源码实现/构包/本地提交。独立review无阻断后A编码；A独立review通过后B单向merge。**B首个clean候选包接ADA后、C完整矩阵前**跑实际iframe延迟保存+X/Space/Pen→Ctrl+Enter→重开探针，失败先修接线，不能挪到最终。未开启窗口的本阶段不把此探针写为通过。最终按§8记录快照同步时长/复制批次/长帧/IO以及有限族矩阵，设备与人工证据仍独立。

### 阶段0独立审查

2026-11-16 gpt-6.1-sol只读独立review Approved，无有依据P1/P2。核对旧字段消费者、Session/fileOps/history、NumberField/Slider、embedded mount/contract与ADA调度/RPC，确认§10可执行，允许进入A。尚无实现或修复验收。选层相关dirty不纳入保存任务提交。
