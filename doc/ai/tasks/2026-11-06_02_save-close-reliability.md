# Task 02: 保存与关闭可靠性

## Status

Changes Requested / 2026-11-06 实现提交 98c4c4f 已完成定向自动验证, 但独立复审确认两项阻断问题, 见下方 Repair Adjustment。用户授权在本任务内修复并补验收, 不另建任务、不回退 GPU 核心。人工验收待完成; 未推送、未发布。

关联 [默认接入任务 01](2026-11-06_01_default-gpu-selection-move.md): GPU 默认路径已实现, 但实现复审为 Changes Requested。本任务同时承接原有文件生命周期缺陷与本次新增回归; 拆分任务不免除回归修复责任, 任务 01 须在关联修复复审通过后结合原有人工验收收口。

## Task Brief

当前保存将异步写盘成功、文件路径绑定、保存点和允许关闭混在同一链路, 缺少明确的目标文档操作边界。参考 PhotoCraft 的保存期间锁定目标文档、固定保存检查点及关闭后二次判断, 建立有限的保存与关闭保护。保留已经可用的 GPU 移动优化, 修复另存为路径回归与原有误标已保存/关闭丢失修改风险。

## Evidence And Root Cause

- 核对基线: 原作者 a659900 与接入前 ec5b6ee 的 `src/app/fileOps.ts` 无差异; 当前默认接入提交 d3a7fb1。实施前重新检查 HEAD 与工作区。
- 原有缺陷: 写盘完成直接 `markSaved()`, 不确认写入后是否又有编辑; `closeSession` 只检查 `save()` 布尔结果, 随后清理恢复数据并移除文档。原有归因来自源码对比, 未在旧版本重新运行复现。
- 当前 P1 已复现: 关闭选择 Save, 延迟写盘期间提交新 Move, 文件只含此前检查点; 当前会保持 modified, 但关闭仍移除会话并删除恢复数据。
- 当前 P2 已复现: original.psd 另存为 copy.psd, 写盘期间提交新 Move, 新增的 entry/rev 检查连同路径更新一起跳过; 下一次 Ctrl+S 又写 original.psd。
- 当前复现使用真实 Session/History/Move/fileOps 与受控 I/O; 既有 79 项相关测试和构建通过未覆盖上述完整断言, 不作为这两项缺陷已修复的证据。
- 现有能力可复用: `snapshotDocument`、history 保存点、每会话 `recoveryWrite` 链; Electron `fs:write` 已采用临时文件后 rename, 不重写文件存储。

PhotoCraft 固定参考为 v0.20.2 / `7c12f647150f8e7b2e07718f7993b1fcaa57fefe`, 仅源码核对, 未运行 Rust 测试:

- [后台保存](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/jobs_ui.rs#L276-L326): 捕获 DocId/revision/快照, 锁目标文档, 拒绝同路径竞争写入。
- [保存结果](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/app/files.rs#L601-L630): 按文档身份分别更新路径与写入版本。
- [关闭检查](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/dialogs/discard_ui.rs#L208-L251): 保存结束后仍确认目标存在、确已无未保存修改。

## Change Contract

### Must change

1. 为目标会话提供最小的手动输出/关闭占用状态及统一检查。Save/Save As/Save Copy/Export As/Quick Export 复用该保护; 同一文档不重叠发起输出, 同一解析后目标路径不出现竞争写入。重复请求提示或返回忙, 不排成延后执行的隐式队列。
2. 输出入口仍按既定规则提交当前有效 Move/文字编辑。进入稳定快照阶段前取得编辑保护, 保持到输出结果落定及必要清理结束。文件选择期间可保留既有交互, 但须占住输出请求, 并在快照前重新核对原会话、结束新交互; 不允许先取快照再补锁的空窗。
3. 编辑保护覆盖真实修改入口: 指针工具、undo/redo、菜单/快捷键、图层属性以及会修改目标文档的异步回调。不能只禁用按钮; 列明实际入口与最小共享保护点。已有异步结果延后应用或安全拒绝, 不得绕过保护修改快照所属文档。其他文档可正常操作, 本文档显示/缩放不必冻结。
4. 分开处理文件绑定、写入检查点和关闭资格。成功的非副本另存为更新原目标文档的路径/格式/名称; 保存点记录实际写入状态。沿用 history entry 的 clean 语义, 编辑后 undo 回保存点仍可 clean; doc.rev 用作过期结果检查, 不替代历史保存点。Save Copy/Export 不改原文件绑定或保存点。
5. 关闭文档/关闭全部/退出应用经过同一生命周期检查。目标正在输出则等待完成后重新判断; 关闭提示与最终清理/移除之间保护目标不再被编辑, 保存成功后仍检查目标身份与 modified。失败、取消或仍 modified 时不移除文档、不删其恢复数据; 不得把文件写入成功直接当成关闭授权。
6. 保留自动恢复顺序链。自动保存遇到目标 Move、手动输出或关闭保护时跳过并可后续重试, 不定时锁住用户绘画。手动保存与恢复删除按目标检查点串行; 旧写入/旧清理不得覆盖或删除较新的恢复内容。

第 3、5 项在本轮复审后补充为 R1/R2 的明确契约, 见 Repair Adjustment; 不扩大成新的编辑器或应用调度框架。

### Must preserve / Must not do

- 保留默认 GPU 能力选路、图层内合成、一次拖动一次撤销、兼容回退及正常自动保存偏好, 不恢复实验开关。
- 关闭仍先取消未确认 Move, 再执行 Save/Don't Save/Cancel; 取消文件对话框不回滚此前已确认的编辑。Don't Save 只在明确放弃目标当前修改时清理并关闭。
- 不建设通用任务队列、持久版本服务或事务框架, 不移植 PhotoCraft 的 Rust 线程/Job 系统, 不增加依赖。不扩大格式支持, 不改 Ctrl+J、品牌、ADA、3D 或 GPU 像素管线。
- 不以全局锁整个应用、禁用自动保存、吞掉异常后报成功、强制标记 clean 或退回旧渲染路径代替修复。不要求完整格式/硬件/性能矩阵。

## Ownership And Invariants

- `DocumentSession` 拥有会话占用与保存点; `fileOps` 拥有输出和关闭流程; `autosave` 继续拥有恢复快照。Editor、actions、CanvasView/工具及现有修改入口仅接入必要的目标保护。electron/platform 维持现有写盘和窗口关闭桥, 仅修复实际绕过生命周期的入口。
- 异步操作始终绑定开始时的 session 实例/id、文档和输出检查点, 不使用完成时的 active 文档。已移除/被替换的目标不得被晚到结果更新或复活。
- 所有退出路径释放自己取得的保护; 内部关闭触发的保存可复用同一保护, 避免重入死锁。重复关闭合并或拒绝, 不重复弹窗、移除或清理。`force` 不得绕过正在写入的目标保护; 仍可保留显式放弃修改的既有用途。
- 若其他会话已经绑定同一输出文件, 写入前拒绝该冲突并提示关闭另一会话或改路径, 不悄悄把另一会话留成与磁盘不一致的 clean 状态。复用既有平台路径规范化, 本轮不建设跨进程文件锁或完整符号链接身份系统。
- 操作返回值须能区分写入成功与当前可关闭; 可沿用兼容外部布尔 API, 但内部不得把二者等同。保护期间出现意外版本变化仍保留 dirty/恢复数据, 不通过更新检查点掩盖它。

## Failure And Concurrency Semantics

| 情况 | 必须结果 |
| --- | --- |
| 手动保存成功 | 原目标正确绑定路径, 只确认实际写入检查点, 清理对应恢复数据后释放保护 |
| 文件选择/格式确认取消, 编码/写盘失败 | 不改原文件绑定或保存点; 不删除未保存修改与恢复数据; 释放保护并可重试 |
| 保存中尝试编辑/重复保存 | 目标编辑不生效且有可理解的忙状态; 无第二次写入, 无新增历史; 非目标文档不受影响 |
| 保存中请求关闭/退出 | 等待既有输出, 再走 dirty/关闭检查; 失败或仍有修改时保留目标, 不在错误提示后继续退出 |
| 关闭确认/恢复清理过程中尝试编辑 | 目标不接受新修改, 不产生提示后或最终检查后的数据丢失空窗 |
| 自动恢复与手动输出相遇 | 跳过忙目标; 已开始的恢复写入与删除有序完成, 无旧恢复晚到复活或误删新恢复 |

## Acceptance Scenarios

| ID | 场景与证据 |
| --- | --- |
| S1 另存为绑定 | A.psd -> B.psd, 受控延迟写盘时尝试 Move/绘画/属性编辑/undo; 编辑被阻止, 成功后路径为 B, 下一次 Ctrl+S 只写 B。PSD 重开确认对应检查点 |
| S2 保存与关闭 | 关闭选择 Save, 延迟写盘时尝试编辑; 不产生未保存的新状态。成功后再判断关闭; 注入意外检查点变化时必须保留文档与恢复数据。另覆盖保存中 Close/Close All/窗口退出等待及保存失败不退出 |
| S3 失败与取消 | 文件选择取消、编码失败、写盘拒绝后路径/保存点正确, dirty/恢复内容保留, 保护释放, 下一次保存可成功 |
| S4 并发与目标 | 同文档重复保存无竞争; 两文档输出同一路径及另一会话已绑定该路径时明确拒绝冲突。保存 A 时切到 B 编辑, B 可正常使用且完成结果只作用于 A; 已失效目标无晚到回写 |
| S5 保存点与副本 | 保存后编辑再 undo 回保存点为 clean; Save Copy/PNG Export 不改原绑定/dirty。输出前实际 Move 提交一次, 后续 pointerup 无额外历史 |
| S6 恢复与关闭空窗 | 控制恢复写入、删除的完成顺序, 验证忙时跳过、松手/释放后恢复, 旧恢复不在关闭后复活; 延迟最终清理时尝试编辑不丢失数据。Cancel 保留文档, Don't Save 正常关闭 |
| S7 退出期间新增文档 | 模拟实际退出回调: 关闭 A 并选择 Save, 延迟写盘期间新增/打开 B 并编辑; 即使 A 已成功关闭, 只要 B 尚未处理, 不得标记 clean exit 或发出 confirmClose。本次退出取消并保留 B, 重试后正常询问 B。并检查单纯 Close All、Close Others 的既有目标范围未被混淆 |
| S8 文字保护与撤销 | 延迟 Save/Save As/Export 写盘期间, 走图层面板双击文字缩略图与 textarea 的真实调用链, 验证不能进入/修改目标文字; 同时覆盖文字样式及提交/取消的直接入口。像素/文字数据、编辑上下文和历史均不被偷偷修改或丢弃。释放保护后一次正常文字编辑可一次 undo/redo; 保存前已有文字编辑仍可正常提交, 路径选择期间新进入的文字编辑在快照前正确收尾 |

## Validation

- Preset: P-DOC、P-BUILD、P-MOVE, 定义见 [TESTING](../../engineering/TESTING.md)。复用 `tests/gpu/moveOutput.test.ts` 与已有历史/恢复测试, 只补以上风险用例; 不要求重建完整性能基准。
- Task-specific: 用真实 Session/History/fileOps 和至少一个真实 Move, 仅控制平台 I/O、失败与等待点; 解码输出/重开 PSD 核对内容。编辑保护必须调用实际指针/命令/属性入口验证, 不能只断言 saving 标志或 mock 一个拒绝函数。逐项列出受保护的写入口, 至少覆盖一个已有异步修改回调。
- Manual: 执行者在隔离配置的正常生产窗口完成一次 4K 保存/另存为/重开, 保存中尝试拖动、undo、改图层属性及关闭窗口; 确认进度可见、失败可继续编辑、GPU 移动体验未明显退化。无法执行则逐项标记未验收, 不以 build 或受控 I/O 测试替代。用户正常入口复验另记结果。
- 本任务不要求 PhotoCraft 运行跑分、全格式 PSD 兼容、完整断电恢复或跨进程文件竞争验证。实现通过后在相关 owner 文档记录最终稳定规则, 同步任务 01 的验收状态; 不提前宣布其人工验收通过。

## Execution Report

2026-11-06 在当前实现上完成有限修复, 保留 GPU 默认选路与像素管线。修复为本记录所在的新增本地提交, 精确 hash 以 Git 日志和交付报告为准。

### 实现与保护点

- Session 持有输出请求、关闭请求和快照/确认期间的编辑保护。文件选择期间仅占用输出请求; 快照前再次完成原目标的 Move/文字收尾并加保护, 保持至写盘、结果处理和恢复清理结束。重复输出直接提示忙并返回 false, 重复关闭复用已有关闭请求; Close All/应用退出沿用现有 closeSession/closeAll 链路。正在使用的其他工具须先结束后再保存。
- 手动输出按目标路径的分隔符、大小写和点段生成竞争键, 拒绝同路径并发或覆盖其他已打开会话绑定的文件。沿用平台选定的路径, 不增加符号链接识别或跨进程锁。路径/格式/名称在非副本写入成功后独立绑定; 保存点记录实际写入 entry, 意外版本变化继续 dirty。关闭等输出完成, 保护提示和清理阶段, Save 后检查 modified, 最终移除前再核对身份及 entry/rev。清理失败不再吞掉异常而继续关闭, 可释放保护后重试。
- 真实修改入口: CanvasView 指针进入点、Move.down、Session.paintTarget/paintBlockReason（画笔等）、App 工具快捷键及 actions.run; operations 的 need/needLayer 覆盖属性和普通菜单操作。History 的 push/undo/redo/goto/rejectLast 和共享 editRaster/editLayer/recordStateChange 也检查目标保护。Layer Style 的直接预览与恢复、宏矩阵变换及智能对象更新接入同一目标检查。已关闭会话不再允许这些入口修改。
- 异步结果: 滤镜/Filter Gallery 在私有输入上计算全部 plate, 检查原会话仍存在且可编辑后一次写回; 保护期间到达的结果拒绝应用。置入、替换智能对象、智能对象解码、选择、粘贴与 inpaint 通过目标/共享修改点保护。恢复写入和删除继续沿每会话 recoveryWrite 串行; 自动保存每次 yield 后及排队写入前跳过输出/关闭中的目标, 手动清理前仍检查保存检查点。

### 验证结果

P-MOVE、moveSelectionReference、floatingSelection、共享 GPU compositor/preview 与 moveOutput 共六文件 87 项通过。P-BUILD 通过（含 typecheck; 仍有既有 Vite URL/模块外置警告）。P-DOC UTF-8/相对链接/材料忽略及 git diff --check 通过。未重测 4K 性能, 未改 GPU 合成算法。

| 验收 | 已执行的自动证据 |
| --- | --- |
| S1 | 真实 Move 和画笔、属性、undo 在延迟 Save As 期间不改目标; A→B 绑定与下一次 Save 写 B; PSD 重开像素比较沿用既有用例 |
| S2 | 关闭 Save 延迟写盘中注入意外 rev 后保留 dirty/会话/恢复; 保存中 Close/force 等待, Close All 遇写盘失败不移除目标 |
| S3 | 路径选择取消、编码异常、写盘拒绝均保留绑定/dirty, 释放保护后可重试; 清理异常保留会话后可重试 |
| S4 | 同文档重复保存拒绝; 同路径写入竞争及另一文档绑定冲突拒绝; A 保存期间 B 的实际属性编辑有效; 已关闭目标无晚到状态回写 |
| S5 | 输出前 Move 只确认一次, 重复 pointerup 不新增历史; 保存后新编辑再 undo 回写入 entry 为 clean; 副本及 PNG 不改变原绑定/保存点 |
| S6 | 受控恢复写入完成后才删除; 自动保存跳过占用目标; 最终清理和关闭确认期间实际修改被阻止; 重复 Close 不重复提示, Cancel 保留、Don't Save 关闭 |

另用真实异步 FilterDef/runFilterAsync/applyFilter 控制结果完成点, 验证保存保护期间不会写入像素或历史。受控测试只替换平台 I/O 与等待点, 不伪造 Move/Session/History 提交。

### 未完成验收

本轮未执行正常生产窗口的人工 4K 保存/另存为/重开、保存期间人工拖动/undo/属性/原生窗口关闭操作, 未取得用户正常入口复验。实际磁盘失败/断电、跨进程竞争、完整格式与硬件矩阵未执行。应用退出复用 closeAll 的源码链路及领域测试, 不等于原生窗口退出人工验收。上述项目均不标记通过; 保持待独立 reviewer 复审, 不据方案通过或自动测试通过宣布任务 01 的人工收口。

## Review Result

2026-11-06 用户确认方案审查 Approved。对 98c4c4f 的独立实现复审为 Changes Requested: 复跑原有六文件 87 项测试与 P-BUILD 均通过, 另增两项真实领域行为的受控 I/O 复现均失败。人工验收未执行。后续交付遵循 [AI_WORKFLOW](../AI_WORKFLOW.md), 不自动创建执行循环或独立 reviewer 文件。

## Repair Adjustment - 2026-11-06

本节补清原有第 3、5 项要求的具体触发场景和通过条件, 不替换既有 S1-S6。基于 98c4c4f 继续修复, 不重新实施 GPU 优化或扩大任务。上方 Execution Report 保留为首轮执行记录, 其“保护覆盖”描述不代表下列遗漏已经通过。

### R1: 应用退出必须核对实时会话集合 (P1)

- 证据: `fileOps.closeAll` 只遍历开始时 `[...editor.sessions]`; A 保存等待中创建并修改 B, A 关闭后返回 true, 此时仍有一份 modified 会话。`src/main.tsx` 的退出回调随后直接 `markCleanExit`/`confirmClose`。独立复现输出为 `result=true, remaining=1, remainingDirty=true`。
- 责任: 原有整体退出链路疏漏, 当前任务要求应用退出可靠性, 属于尚未完成的范围, 不是新增需求。
- 明确行为: 在全量关闭收尾及实际批准应用退出前核对实时会话集合。等待期间有新增或尚未处理的会话时, 取消本次退出并保留它, 由用户重试; 已完成关闭的 A 无需复活。不得在仍有未处理文档时记 clean exit 或发送 confirmClose, 不自动放弃新增文档。普通 Close All 也不得在漏掉新增会话时返回“全部关闭成功”; Close Others 仍保留原 except 目标语义。
- 边界: 修复 `fileOps.closeAll` 与 `src/main.tsx` 的实际交接, 只在确有必要时最小调整现有平台关闭入口。保留正常单文档后台保存期间其他文档可操作; 不以全局冻结所有交互或无限循环关闭新文档代替最终判定。
- 证据要求: S7 至少经过实际生产退出回调所用的控制逻辑, 可控制保存等待与平台 confirmClose, 断言 clean-exit 标记/confirmClose 未执行及 B 被保留。不能只证明 closeSession 正确或复制一段“理想退出逻辑”到测试中。

### R2: 文字修改必须先检查保护, 不能只拦历史 (P2)

- 证据: `LayersPanel.editLayerContent` 双击文字缩略图直接进入 `startTextEdit`, textarea 直接调用 `updateEditingText`, 均未检查目标保护。保存写盘期间调用这条真实链路再 commit, 文字已改变, 但新增 `History.push.canMutate` 拦截丢弃 alreadyApplied 的命令。独立复现为 `canEdit=false, text='after', sameHistory=true`。
- 责任: 原有直接写入口未接入新保护, 与新增历史拦截形成撤销回归, 属于本次实现遗漏。
- 明确行为: 在文字编辑开始、内容/样式变更及提交/取消恢复等真正修改前检查原目标会话的存活与保护; 被拒绝时不得先修改文档或清空编辑上下文。图层面板/Canvas 双击、textarea、选项栏等旁路共用领域保护, 不只禁用单个 UI 控件。文件流程应在取得保护前完成已有文字交互, 包括异步文件选择/确认后新增的文字编辑; 不开放全局绕过保护开关。
- 历史约束: 保留保护期间拒绝普通修改的语义, 不通过放开所有 History 写入补救。不能把“已经改变内容, 再让 push 静默返回”当作成功阻止编辑; 正常编辑在解除保护后仍完整记录撤销。只修本次可达文字链路, 不重构全部命令框架。
- 证据要求: S8 调用生产所用文字函数/事件入口, 控制平台写盘等待即可; 不 mock canEdit、文字修改或 History 来制造通过。至少验证一个直接文字样式入口和一次解除保护后的 undo/redo。

### 修复验证与交付

- 复用原定 P-MOVE、P-BUILD、P-DOC 与相关输出测试, 加 S7/S8 定向回归; 不重跑无关格式/设备全矩阵, 不重建性能基准。
- 原人工验收要求保留, 另加一次保存中双击文字缩略图/尝试输入及一次退出等待时新增文档的有限检查。不能执行则明确未验收, 不以受控 I/O 推断原生窗口已经通过。
- 修复后在本任务追加 Repair Execution Report, 分别记录 R1/R2、自动/人工证据和剩余边界, 再交独立 reviewer 复审。当前工作区已有另一项 ADA 集成文档改动, 不覆盖、暂存或提交那些改动; 本次本地提交只包含本任务及其修复所需文件, 不推送、不发布。

## Context Delta

- Keep: GPU 默认优化成果及原型受限 Go 有效, 无需回退渲染核心。
- Changed: 保存/关闭可靠性独立为本任务, 同时承接旧缺陷和默认接入回归; 采用目标文档保存期间限制编辑的主线, 不默认引入边写边编辑的输出队列。
- Repair: 98c4c4f 复审要求在本任务内补 R1 实时会话退出判定与 R2 文字直接修改保护/撤销回归, 通过 S7/S8 验证; 不以已存在的历史/关闭底层检查替代完整链路。
- Follow-up: 本任务修复并复审后, 回到任务 01 完成剩余人工验收; Ctrl+J 等独立议题维持原边界。


## Repair Execution Report - 2026-11-06

基于 98c4c4f 继续修复 R1/R2, 未回退 GPU 默认选路或修改像素管线。修复实现及自动回归完成, 状态为待独立 reviewer 复审; 不据此改判原型 Go 或人工验收状态。新增本地提交的精确 hash 见交付报告/Git 日志。

### R1 实时会话与退出交接

- `closeAll` 遍历既定集合后检查实时会话, 存在非 except 会话即返回 false。等待期间新增的文档保留, 不循环追关; Close Others 仍只允许 except 会话留下。
- `main.tsx` 的原生退出回调使用 `requestApplicationClose`。该控制器等待 closeAll 后再次检查实时集合; 最终检查与 clean-exit 标记、confirmClose 之间没有异步等待点。
- S7 经生产控制器及真实 Move/Session/History/fileOps 验证: A 的关闭 Save 等待期间创建并编辑 B, A 可关闭但本次退出返回 false, B 保持 dirty, running 标记仍为 1, confirmClose 未调用; 重试正常保存 B 后才标记 clean 并调用 confirmClose 一次。另分别覆盖普通 Close All 与 Close Others 遇新增会话返回 false、重试及 except 保留。

### R2 文字修改与输出快照

- 文字领域入口在修改前核对目标 session 实例仍存活且 canEdit: start/update/style/path、TypeTool 指针创建/拖动与 commit/cancel。拒绝 commit/cancel 时不先清空 editing, 也不先恢复或删除图层。共享 History 保护保留。
- 图层面板双击入口在 setActive/setTool 之前检查保护, 异步载入后的 startTextEdit 再次检查。测试调用该生产回调、textarea 所用 updateEditingText 及直接样式/提交/取消函数, 不 mock canEdit、文字修改或 History。
- 既有输出准备点复用文字提交: 文件选择、PSD 兼容确认及 yield 后, 加保护/取快照之前再次提交原目标文字。文本不能完成提交则输出失败, 不将未入历史的文字带入受保护阶段。
- S8 分别延迟 Save、Save As、PNG Export 写盘, 验证拒绝文字开始/输入/样式/提交/取消后文字、raster、mode、editing 和 history 不变; 解锁后正常文字+样式编辑一次 undo/redo。另验证保存前、选路径期间和兼容确认期间的文字均进入真实历史, PSD 重开内容为最终文字, 连续 undo 返回各阶段。A 受保护时拒绝进入 A 不会提交/丢弃 B 正在进行的文字编辑, B 仍可编辑和撤销。

### 验证与边界

- 反向回归: 临时恢复 HEAD 的 fileOps/typeTool 后, Close All/Close Others 两用例均复现 true 而预期 false; Save 文字用例复现 blocked/96 样式而预期 before/48。文件随后完整恢复修复版本。首轮合并反向运行等待超时, 不计通过; 分离后上述三项均明确失败, 证明新增断言能捕获原缺陷。
- P-DOC: 40 份 doc/docs/AGENTS Markdown 的 UTF-8 解码、fork 相对链接、任务无 BOM、本地材料忽略及 git diff --check 通过。
- P-MOVE 及相关六文件: 95/95 通过, 包括新增 S7/S8 八项回归。P-BUILD 通过（内含 typecheck、renderer 与 Electron 构建）; 既有 Vite URL/浏览器模块外置警告仍存在。
- 测试为真实领域对象与 GPU Move, 平台 I/O/等待和 PSD 兼容对话框应答受控。文字入口未挂载可见 React textarea, jsdom 缺少真实字体/Canvas 排版; 断言覆盖领域文本、raster 不变与历史, 不作为真实字体渲染或原生窗口验收。
- 本轮未重测性能、未执行全格式/硬件矩阵、完整测试集、断电或跨进程文件竞争。GPU 性能收益沿用原有任务证据, 本修复不宣称新增性能收益。
- 人工未验收: 原规定正常生产窗口 4K 保存/另存为/重开, 保存期间拖动/undo/属性及关闭、进度可见、失败后继续编辑、GPU 体验; 新增保存中双击文字缩略图/输入与退出等待期间新增文档; 用户正常入口复验。均继续未验收, 不以自动结果替代。
- ADA 集成文档及其 README/AI_CONTEXT/DEV_LOG 改动完整保留, 不暂存、不纳入本次提交。不推送、不发布; 自查不作为独立 reviewer 结论。
