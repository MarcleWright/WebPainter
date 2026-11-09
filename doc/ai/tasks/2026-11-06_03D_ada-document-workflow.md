# Task 03D: ADA 文档身份、保存与二维作品闭环

## Review Repairs 2026-11-09

当前独立实现 review 为 Changes Requested（4 项 P2）。Owner 确认一次修完：WP 通用嵌入能力限制与 ADA 产品配置分离；ADA 修复旧恢复候选阻断重开、慢写期间漏补捕获、被替换载荷未回收。详细执行合同与定向验收归 [ADA 统一修复任务](../../../../auto_design_Agent/doc/ai/tasks/2026-11-06_03BDEF_webpainter-production-integration.md#review-repairs-2026-11-09)。只保留一个有效恢复候选，替换期间允许旧候选加新暂存文件；正式 Primary 独立保留。下方 Implemented 为修复前交付，不表示四项已关闭。

## Status

Implemented / 已授权实施并完成有限验证；待统一 review 和 Owner 验收。依赖 [03B](2026-11-06_03B_native-document-codec.md) 和 [03C](2026-11-06_03C_carrier-comparison.md#confirmed-iframe-decision) 已确认的本地 iframe; 既有保存关闭修复需复审/必要人工收口。父任务 [03](2026-11-06_03_ada-integration-architecture.md)。

## Task Brief And Owners

用已确认的本地 iframe 接通真实平台, 完成创建、原图加入、核心编辑、保存/恢复、重开、预览和退出。ADA contracts、artifact-store、引用/representation owner、Canvas command/runtime 负责平台事实; WebPainter codec/session/history 负责编辑。参考原 Markdown 创建/保存的身份及失败处理, 不复用其 body API 或 document kind 语义。

## Branch Scope

主要代码位于 ADA 指定 worktree 的 adapter/platform/Canvas owners; 引入固定 embedded 包, 不在包内或 ADA 源码中复制修改 WP 内核。WP 端口确需补充则在 embedded, 通用缺陷/功能在 main 后合入 embedded, 每个变更记录 owner 和配套版本。把 WP 的 opaque binding 映射为 Profile/epoch/Project/D/revision, 不将平台业务类型倒灌 WP。

该映射须区分两个生命周期: 编辑 binding 归 Profile/instanceId/Project/D/编辑会话代次, 单次网络操作另捕获 connectionEpoch 和操作身份。不能把打开时的 epoch 永久固化到作品 binding, 也不能使旧操作跟随当前 epoch 自动续命。

## Profile Renewal Contract

Planner 已独立核对 ADA e9f45893 的 `ProfileRuntimeRoot.tsx`, `profile-connection-controller.ts`, `profile-switch-quiescence.ts`, `profile-host-adapter.ts`, `profile-scoped-client.ts` 和 `ProfileConnectionContext.tsx`: renew/切换共用 quiesce, handler 当前无转换原因, workspace identity 是 profileId+instanceId, 成功续期发布新 transport 并释放旧 transport。以下为接线要求, 不是已实现行为:

- 同 Profile、同 instance 的自动续期保留编辑器实例、文档、dirty、历史、视口和当前编辑状态, 不弹保存/放弃/取消, 不调用作品关闭或重挂载。续期失败同样不丢作品; API 暂不可用时显示实际可重试状态, 不宣称保存成功。
- 新读写从现有 ProfileWorkspaceClient 捕获当前有效的 transport 身份。已开始操作保留原 epoch/目标/检查点/操作 ID, 不把旧回执重标成新 epoch 直接应用。续期造成写入结果不确定时, 在确认仍是同一工作区/作品后, 经新 transport 查询原操作 ID/检查点的正式提交状态; 不重放写入或盲增修订, 只有确认实际写入版本且本地仍对应时才更新保存点。
- 真正切 Profile、退出 Profile、重启实例、离开作品/Project 和退出应用仍走关闭合同; 同 Profile 的 restart 不能仅因 profileId 相同而当 renew。由现有 Profile 生命周期 owner 最小区分转换原因或入口, 再由 adapter 调用作品关闭, 不在 WP 识别 ADA 生命周期, 不新建调度器。
- 不把关闭确认直接注册成所有 quiescence 的无差别 handler。沿用现有请求停稳/超时机制, 续期只处理必要网络操作, 不因作品 dirty 要求保存或阻塞续期; 对现有 handler 保持兼容。若实际 instance 改变, 不沿同实例续期路径自动绑定旧会话。

## Change Contract

- 正式 ADA 自有 iframe 页面组合固定 WP 包与底部面板, 使用实际 ADA Electron/本地资源协议, 同步 HTML 与桌面响应头的最小必要 CSP, 核对 WebGPU/WASM/字体/资源加载及消息身份校验。不得沿用测试响应替换作为正式可用证据; 不为打开 iframe 全局放宽到任意来源或开放 Node。Direct 只隔离保留, 普通生产入口不提供 A/B 切换。

- 冻结具体 native Artifact kind、payload roles、源引用、创建/读取/expectedRevision 保存合同和 schema 迁移范围。按 ADA 原 schema/版本机制升级, 不增加平行资产数据库或历史版本服务。
- Canvas toolbar 提供独立的新建绘画作品按钮, 与 Markdown 文档入口分开; 创建 D 与独立节点后打开全屏编辑器。已有作品从其图层文档节点重开, 实施时按既有节点交互明确编辑按钮或双击入口。普通产品入口不得依赖 03C 查询参数/实验按钮。退出恢复原 Canvas 视口/选择, dirty 时经过保存/放弃/取消。原 Image 不改绑, 双击 Image 不创建 D, 内部图层不成为 XYFlow 节点。
- 首版沿用 WP 上方常规面板、左工具栏、右图层管理与中间画板, 保持编辑空间全屏遮住 Session/Canvas/Gallery; 按 03C 定案的组合方式保留底部 ADA 面板接入位置。03D 不提前接通真实生成, 未接通项不显示虚假的可用状态。专用 UI 后续另做, 仍按首版能力清单限制菜单/快捷键/调用, 不因复用 UI 宣称全量 WP 能力可保存恢复。
- 从平台读取 A 的实际内容并显式加入, 保存来源与稳定内容; 引用由原 owner 追踪和保护, 不只存一个失效 URL。使用 03A 核心能力清单; Ctrl+J/选区复制等通用行为若需修正, 在 WP main 先独立修复, 合入 embedded 后更新 ADA 包, 不在 adapter 另写复制算法。
- 单次读取/保存绑定发起时的 Profile/instance/epoch/Project/D/会话代次及操作 ID, 长期编辑会话遵守上面的续期合同。一个活动作品, 同 D 再打开聚焦原会话; 手动保存/输出短暂保护该目标, 成功后更新准确保存点, 不以 doc.rev 代替 history clean 语义。
- native 文件暂存后沿原 Artifact owner 原子公布载荷与新 revision, 失败保留旧版。CAS 冲突不覆盖、保留本地内容并提示重新打开/另存独立方案, 不建合并编辑器。
- 响应丢失时按原操作身份读回确认提交状态, 不盲增 revision 或重复创建 D。D 成功但节点创建失败按原 D/节点 intent 恢复, 不制造第二份作品。
- small/standard 预览消费对应保存检查点并绑定源 revision/hash; 迟到预览拒绝覆盖新版。预览失败与文档保存失败分别显示并重试, 不新建预览 Artifact。
- embedded 正式保存只由 ADA owner 写入; 本地恢复候选带 D 身份和源 revision, 重开提示恢复/放弃, 不与后台 autosave 双写。真正导航、切 Profile/Project、实例重启和退出应用经过关闭合同, 取消保持作品可编辑; 同实例自动续期例外按上述合同保留编辑, 不靠页面卸载提示兜底。

## Failure And Concurrency Semantics

旧回执不得修改新 Profile/作品; 同 D 并发旧保存以 CAS 拒绝。文件/索引部分失败不得出现半版内容。删除 D 或源资源后不复活或悄悄切换目标。保存成功并不自动允许关闭, 仍核对目标/dirty; 输出失败保留内容和恢复材料。平台写入/发布后的通知失败不伪装成未提交并重复创建。

## Acceptance And Validation

- 从 Canvas 工具栏创建作品 -> 进入编辑器 -> 返回 -> 从对应作品节点重开, 原视口/选择保留; 同 D 不重复创建, 原图片和 Markdown 入口行为不变。覆盖关闭 Cancel 与打开失败恢复, 不能仅用实验按钮证明正式入口已接通。

- A 图片 -> D 中手绘/文字/蒙版/调整/选区变换 -> 保存 -> 退出 -> 重启重开继续编辑, 合成/来源正确且 A 不变。
- 延迟保存、响应丢失、CAS 冲突、节点创建失败、旧预览晚到、切 Profile 和恢复候选各做一个实际 owner 风险检查; 使用真实 ArtifactStore/数据库/载荷, I/O 故障可受控, 不只测试模拟返回值。
- 新增一个聚焦续期场景, 使用真实 ProfileConnectionController/quiescence/ProfileWorkspaceClient 及实际编辑器挂载/session 边界, 只控制 adapter/I/O 与回执时机: dirty 绘画中自动续期, 并叠加一笔延迟保存/旧回执。验证无关闭确认/重挂载, 历史/视口/本地内容保留, 旧回执不误标 clean, 新保存捕获新 epoch 并成功。若旧保存已提交但响应不确定, 查询原操作后不重复写入; 再做一次续期失败保持 dirty 的断言。不以独立身份比较函数或 UI mock 代替链路验证。
- 真正切 Profile 的 Save/Discard/Cancel 与同 Profile 实例重启仍经过关闭合同, Cancel 不丢作品; 现有非编辑器 quiescence handler 行为不被改坏。复用现有 controller/生命周期定向测试, 不扩完整连接故障矩阵。
- 保存期间编辑保护、关闭 Cancel/失败、一次拖动一次撤销与选区复制回归; 连续两次保存/undo 回保存点正确。
- 完成一次 main 通用更新 -> embedded 合入/构建 -> ADA 替换包的真实升级演练, 更新前保存的受支持作品仍可重开, 无接口变化时不改 adapter 业务。端口/schema 不兼容明确拒绝且保留旧内容; 旧包恢复不得静默覆盖新格式。只验有限版本对, 不建通用发布平台。
- P-BUILD/P-MOVE 及受影响输出测试; ADA contracts/API/web 类型检查与 Artifact/Canvas/representation 定向测试, 不重复无关全量 provider 检查。真实全屏窗口执行一次保存重开, 原生应用退出和最终离线检查归 03F。

## Execution Report

未执行。按仓库记录合同/迁移/回滚限制、实际检查与未验收项, 不操作真实用户作品作为首轮夹具。

## Plan Review Follow-up

2026-11-06 [独立评审 R1/P2](2026-11-06_03_ada-integration-architecture-review.md)由 planner 静态复核后采纳。已补续期/离开边界、长期会话与单次 transport 身份、owner 和定向验收; 待 reviewer 对修订文档复核。未修改 reviewer 原结论, 不将计划修订视为代码实现、测试通过或 R1 独立关闭。

## Authorized Implementation Progress

Owner 本轮已授权03B→D→E→F连续实施。03D ADA owner 已实现独立drawing创建/保存/CAS、准入状态/原操作查询、单个恢复sidecar、来源引用保护与准确预览；正式Canvas toolbar/节点编辑入口、同iframe薄面板、实际Desktop协议/CSP与应用退出关闭合同已接通。同实例续期沿长期会话+单次transport边界。ADA阶段任务记录详见指定仓库的 2026-11-06_03BDEF_webpainter-production-integration.md。

已实际执行：真实Artifact/API定向组合33/33；新增真实Web adapter→HTTP→Artifact owner延迟回执/续期查询1/1；contracts3/3、Profile controller/workspace/scopedclient、03C两项P2回归29项及共享面板通过。Electron44.9.0实际app协议+生产Canvas入口在隔离Profile运行创建、原图加入、绘画、保存、退出Cancel/重开；同实例续期叠加已提交但暂扣回执、较新本地变更、原操作新transport查询、续期失败保留dirty；真正应用quit Cancel通过。无CSP响应替换、mock保存或真实Provider。

升级演练：main 1b00ef79 的通用非法类型校验更新，单向merge 913fd9a5；清洁包fb1c151c…，原owner保存的nativeId/hash重开保持、继续编辑保存/节点重开通过。main新增6个非法输入先复现，24/24与独立完整build通过；embedded组合41/41。随后端口独立限制可选PNG32MiB，手动native保存不因超限失败，生成捕获仍拒绝；先复现1failed/8passed，修复18/18与类型通过，embedded3cab474e的清洁包cff1ce50…由ADA替换后重验，不能追认此前实窗为此新包。

恢复候选重启实窗、正式packaged/offline、PSD/人工输入等仍归03F统一检查；此记录不是全部验收通过。


2026-11-07补验：实际生产包的保存/恢复/生成闭环、跨会话候选清理与有限输出协调、固定配套版本见[03F最终报告](2026-11-06_03F_offline-psd-acceptance.md#final-pair-and-finite-acceptance-2026-11-07)。真实owner定向最终API组合57/57，原两项P2 29/29保留。PS/native备份是显式下载，不改Primary native保存边界。独立review和人工验收尚未完成。

## R1 implementation 2026-11-09

通用 seam main 5eca625、4154c01 单向合入；embedded 新增 native v1 能力上限与有限 visible/enabled 配置，作用于动作/菜单/工具/快捷键/直接面板及弹窗。codec 不依赖产品配置，已有合法内容保留。先复现 16-bit 后无法保存（1 failed/9 passed），修复后 typecheck 与 native/access/lifecycle/RPC 46/46 通过。固定包及 ADA 产品配置、正式 iframe 复验仍待执行；本记录不代表四项修复验收。

## Repair handoff 2026-11-09

R1 native policy df937cd；Window 自定义面板/恢复布局/直接 showPanel 补修 main b369c45→embedded6a2d2de。main 通用默认完整，embedded 声明并统一执行持久化上限，ADA 自有产品配置。最终固定包 clean source6a2d2de、mainBaseb369c45、bundleab12cc5d…、port2/native1/policy1；类型/构建及47项回归通过。旧深位深失败与 Window 入口红灯已复现，修复后通过。codec不依赖产品配置，合法存量读取保存边界不变。完整版本见 [端口](../../architecture/EMBEDDED_PORT_V1.md#native-editing-admission-2026-11-09)。ADA R2–R4、最终生产测试包/实窗/人工 Pending 与独立 review 以 ADA 正式任务本轮记录为准；未推送/发布或反向合并。


2026-11-09 最终配套复验：ADA 实际生产测试构建0355e68b/drawing-25ce4ef6，消费上述 clean source6a2d2de/bundleab12cc5d…；两条真实 app:// iframe场景（受控Provider1次、空凭据outer launcher0次）通过，无运行错误。旧基线候选保留/Primary打开/导出hash/准确放弃/恢复自动捕获、正式保存、崩溃重启恢复及退出上下文均通过。main b369c45 独立Electron文件保存/重开/dirty取消/崩溃恢复通过。ADA62项组合及追加续期专项、原P2 29项保留。人工IME/手绘板/真实Provider/本轮Photoshop仍未验收；旧证据不追认。见 [ADA最终修复配套及Pending](../../../../auto_design_Agent/doc/ai/tasks/2026-11-06_03BDEF_webpainter-production-integration.md#repair-final-verification-2026-11-09)。本轮独立复审/Owner验收 Pending，交 ADA集成-REV 后暂停。


## F1-F3 Follow-up Final Handoff 2026-11-09

F1/F2 main b07187d+331f0ba（39→41项/types/build），单向同步后实际包源a7fa15a/mainBase331f0ba/sourcea31014b7…/bundle89feb63a…/port2-native1-policy1，62项通过。line只允许其原本的signed endpoint语义，保留路径/合成/重开编辑；直接组/层/删除/mask/Lock all及mask生产入口与action/feature一致，visible/enabled独立，独立main默认完整。59f81b5 native规范和1a3ea82同步仅文档，不追认包来源。

ADA F3属于Artifact owner，未进WP；最终实际构建78db2197/drawing-c2937cd7，ASAR7a9b8ca4…；93项API（含原R2/R3、真实DB/磁盘首次分配失败/事务拒绝/并发锁/子进程中断）通过。新包两条真实app://正式链路通过，含40→10逆向line恢复捕获/保存重开、实际ΔX=-35编辑、生成前S及受控Results、退出/崩溃恢复；Provider分别1/0次。另同正式页受控host逐UI入口检查通过，policy fixture只测权限UI，不执行业务保存/生成；业务接线证据来自前述真实owner完整链路。当前main代码331f0ba独立六层4K实窗通过。

本轮独立复审/Owner验收、人工IME/手绘板/真实Provider/人工Photoshop等仍Pending/Inconclusive，原R2/R3复审关闭结论保留，不表示本轮Approved。详见 [ADA F1–F3最终记录](../../../../auto_design_Agent/doc/ai/tasks/2026-11-06_03BDEF_webpainter-production-integration.md#follow-up-final-verification-2026-11-09)。原始证据ignored，不推送/发布/反向合并；交ADA集成-REV后暂停。
