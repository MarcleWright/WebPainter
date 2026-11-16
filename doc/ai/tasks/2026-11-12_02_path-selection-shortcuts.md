# 路径转选区快捷键与统一入口

## Status

2026-11-16：F1–F2 及文字工具隐藏路径 P2 补漏独立复审 **Approved**；原 P1–P3 Approved 保留。6.1-sol 子代理完成限定修复，主代理独立检查实际调用链及补测，最终 P-INPUT 262/262、生产构建通过。Owner 已授权复审通过后提交并推送 origin/codex/dev；不合并、不发布。新增文字流程真实窗口、真实 IME/设备和 Owner 验收仍 Pending，不把代码复审通过当作整体验收。

以下保留原实施时点：

方案审查两项 P2 已按 Owner 确认作限定调整：本轮仅零羽化，显式目标不受默认目标 enabled 拦截。2026-11-12，Owner 授权后已按本文 P1→P2→P3 实施与验证，结果见执行记录；实现待独立复审，真实 IME/物理 DPR/人工与 Owner 验收 Pending。本轮明确禁止提交/推送/合并/发布。工作区 WebPainter_Dev，分支 codex/dev，规划基线 a2d48be；基线包含钢笔 F1 准入和 F2 标尺布局修复，本任务不重新解释前任务的审查/人工状态。

## Task Brief

补齐 Ctrl+Enter 路径替换选区、Ctrl+Shift+Enter 添加、Ctrl+Alt+Enter 减去。将快捷键、Paths 面板按钮/右键菜单接到统一 Action 与同一个路径转换入口；先结束有效钢笔草稿再转换，保留开放路径、目标身份及正确历史。复用现有路径栅格化/选区运算，不建立新的快捷键或图像引擎。

## Evidence And Reference

- WP `selectOps.ts::pathToSelection` 已支持 replace/add/subtract/intersect 和 feather；PathsPanel 的按钮与右键直接传 VectorPath 调用，未先 finishPen。`actions.ts` 没有对应路径转换 Action，三个默认绑定因此缺失，不是单纯快捷键冲突。
- WP `pathEditing.ts::getTarget` 优先 Shape，工作路径也可能回退；与 PhotoCraft 显式路径选择优先的规则不同。不能把这个绘图目标 helper 原样当成转换目标解析，也不能结束草稿后才从新 active 状态重猜目标。
- PenOwner 当前未公开 PathTarget。必要时仅增加只读目标描述/有效性查询，保留 [钢笔任务](2026-11-12_01_pen-live-path-editing.md) 的历史 owner、目标保护及结束失败行为。
- PhotoCraft 固定版本 v0.20.2 / `7c12f647150f8e7b2e07718f7993b1fcaa57fefe`：
  - [vector_cmds.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/cmd/vector_cmds.rs#L201-L231) 注册 path.toSelection、path.addToSelection、path.subtractFromSelection，默认 Cmd+Enter / Cmd+Shift+Enter / Cmd+Alt+Enter。
  - [path_ops.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/vector_ui/path_ops.rs#L6-L80) 的 active_path_name / path_to_selection 处理目标和钢笔先结束；失败不继续。转换后仍保留路径资产。
  - [paths.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/cmd/vector_cmds/paths.rs#L336-L382) 使用统一栅格化/选区组合并验证参数，添加/减去命令固定组合方式。

以上为原规划时核对的源码证据；实施与验收结果以文末执行记录为准。原 P1–P3 未移植 PhotoCraft 的取消路径高亮/隐藏工作路径策略；Owner 本次新增的限定调整以文末 F1–F2 为准。

## Change Contract

### 1. 三个 Action 和共享业务入口

| Action | 默认快捷键 | 操作 |
| --- | --- | --- |
| path.toSelection | Ctrl+Enter | replace |
| path.addToSelection | Ctrl+Shift+Enter | add |
| path.subtractFromSelection | Ctrl+Alt+Enter | subtract |

- 注册在现有 Action/keymap 体系（macOS 沿用既有 mod/Cmd 语义），主/备用键、用户覆盖、冲突显示和 enabled/access 使用原机制。不得在 PenTool.keyDown 或 window 单独硬编码组合键，不复活用户已删除的绑定。
- 三个 Action 调用同一转换 owner，显式固定各自组合方式；不允许参数把 add/subtract 偷换为 replace。UI 的显式路径也进入同一入口，不再直接从面板调用底层 raster helper。本轮只支持零羽化，不新增羽化 UI 或完整羽化语义。
- PathsPanel 的现有“Load path as a selection”按钮与“Make Selection”右键项复用 path.toSelection；右键作用于该行路径，即使其不是活动路径。无需新增三个工具栏按钮、顶层菜单或新对话框；其余 Action 可从现有命令搜索/快捷键设置访问。
- 需要选区数据时继续复用 pathToSelection/rasterizePath/combineRaster；可调整 helper 返回结果以区分拒绝、无变化和成功，但不保留 UI 绕过 owner 的第二条提交链路。参数在结束草稿前校验：feather 省略等同 0；显式传入时仅接受数值 0，非零、负值、NaN/Infinity、字符串等均拒绝，不静默忽略或转换。非法目标/参数不得改变草稿、路径、选区或历史。现有 helper 先组合后羽化的行为不作为本任务支持契约，完整路径覆盖羽化后移。

### 2. 转换目标与草稿结束

每次命令先绑定原 session/doc 和 PathTarget 描述（pathId 或 layerId+shape/vectorMask），不预先复制一份可能过期的 VectorPath。目标优先级如下：

1. UI/调用方显式指定的路径行或目标，严格使用该目标，不存在/不可用时拒绝，不回退。
2. 未指定目标且存在有效 Pen 草稿：使用该会话固定的 PathTarget。
3. 无草稿：Paths 面板显式选中的 Work/Saved/Clipping Path。
4. 未显式选择：现有 Work Path（F1 实施后，仅未处于转换后隐藏状态的 Work Path）。
5. 再无文档路径：活动图层的 Shape 路径或 Vector Mask。

- 这是转换入口的优先级，不重排钢笔绘制本身的 getTarget 优先级；F1 仅增加隐藏 Work Path 的显示/默认编辑目标准入。显式 Saved Path 和活动 Shape 共存时转换 Saved Path，不误转换 Shape。
- 捕获目标后检查可编辑会话、access、保存/关闭保护以及本次目标身份。正在进行 pointer 手势或其他变换/文字局部交互时，不强行抢事件结束；转换不可用/拒绝并保留手势。草稿空闲但有已完成步骤时可执行。
- 有草稿时正常 finishPen 一次，保持开放路径，不强制设置 closed、不追加重复起点；然后从同一描述重新取得最终路径并栅格化。明确显式转换 B 而当前草稿在 A 时，先结束 A，再转换 B，不能通过切 activePathId 隐式改目标或重复结束。
- 草稿不足以形成有效路径（如仅一新点且无其他可转换子路径）、目标失效或结束失败时停止，不做转换、不选择备用路径。已有有效草稿保持可恢复；外部状态已接管则按原钢笔失效规则处理，不能恢复旧快照。
- 仅对像素覆盖的填充计算隐式连接开放子路径末端与首端，原 VectorPath 的 closed、锚点和方向柄保持最终路径原样。保留路径资产；原 P1–P3 保留现有显示/选择状态，后续成功转换的显示收尾按 F1 执行，不重写整体路径可见性系统。

### 3. 选区及历史

- replace 使用路径覆盖替换选区，add 合并，subtract 减去；保留抗锯齿/半透明覆盖语义。没有原选区时 add 等同加载该路径、subtract 保持空，不误变成全画布选择。
- 路径有效但覆盖全在画布外时，replace 的结果为空（清空旧选区），add/subtract 不改变原选区；不得因现有 helper 的空交集 early return 把 replace 静默变成无操作。无效路径与有效但零覆盖必须分开处理，不开发新栅格化算法。
- 有草稿时，正常结束的路径编辑和后续 Make Selection 是两个顺序文档历史步骤；无草稿时仅记选区变化。先 Undo 转选区恢复原选区，再 Undo Pen 恢复原路径；Redo 对应恢复。沿用 Shape 创建可独立记账的规则，不合并或重写旧历史。
- 选区无变化不额外记空历史；若路径已合法结束而后续转换失败，保留已提交路径步骤及旧选区，提示原因，不用“回滚整个命令”删除已提交作品。下一次重试仅转换最终路径，不再次制造 Pen 步骤。
- 后续迟到 pointerup/keyup 不复活旧草稿、不在转换后加点；按键重复不连发转换。Undo 在完成转换后走文档历史，不再被旧 Pen 局部栈截获。

## Ownership And Input Boundaries

- 复用 Action enabled/access 和现有会话 canEdit/outputPending/closePending；转换读取 Shape/Vector Mask 不改其几何，遵守现有路径/蒙版访问策略，不把“生成选区”误实现为改图层像素。
- 现有 Action.enabled 不接收 args，且 run 会先执行此检查。因此三个 Action 的公共 enabled 仅作会话/access/保护/交互状态准入，不用默认目标的可转换性拦截显式目标。共享 owner 提供只读的目标级可执行检查：面板按钮/右键针对本次显式目标置灰，handler 对实际参数重复同一检查；无参数快捷键/命令使用默认解析结果，无可转换目标时拒绝且不修改状态。默认 A 无效而显式 B 有效时，B 必须可经公共 Action 执行；B 无效时不得回退 A。不扩展整个 Action 注册表为参数感知框架，也不允许面板绕开公共 Action 的 access。
- 命令启动、finish 后和选区写入前确认原 session/doc 及目标仍对应；失效拒绝，不改新活动文档，也不在失败后回退到其他目标。不建设异步队列或全局事务层。
- 输入框、contenteditable、IME、菜单/Modal、文字编辑自己的 Ctrl+Enter 等局部确认继续优先；无合适目标不吞掉其他 owner 的明确快捷键。实际手势中的 Ctrl/Alt 临时点编辑不因本任务改变归属。
- HistoryPanel 草稿保护保持原契约：只有正常结束成功后才恢复文档历史入口；转换不能绕过该保护直接修改草稿局部栈。

## Scope And Non-goals

- 允许改 actions/现有输入与快捷键接入、路径转选区业务 owner、必要的只读 PenTarget 桥接、PathsPanel 现有入口及关联测试。F1–F2 另允许最小会话显示状态与既有路径 overlay/目标准入接入。针对空覆盖结果修正现有 helper 即可，不扩大为选区系统重构。
- 不新增交集快捷键、反向“选区转路径”快捷键、填充/描边路径快捷键、PS 全量键表、路径参数窗口、路径算法/文件格式、渲染架构或通用命令框架；不混入填充性能、品牌或 ADA。路径取消选中/隐藏仅限文末 F1–F2，不扩展到图层显示或选择体系重构。
- 不改相邻 worktree 与原作者 docs，不把本任务的通过补写成前一任务完整人工通过。

## Stages

| 阶段 | 范围 | 状态 |
| --- | --- | --- |
| P1 转换 owner | 目标解析、草稿正常结束、参数/身份/失败检查与选区/历史契约；有行为测试 | Implemented / 自动验证通过；待独立复审 |
| P2 统一入口 | 三个 Action/默认键、用户覆盖与冲突、面板按钮/右键复用；实际输入传播测试 | Implemented / 自动验证通过；待独立复审 |
| P3 集成验收 | 关联回归、构建、隔离真实窗口连续流程；更新 owner 文档及验证缺口 | 自动/隔离窗口验证完成；人工缺口 Pending；待独立复审 |

按 Owner 本次 coder 授权执行 P1→P2→P3；本轮包含实现和验证，各阶段提交仍须另行授权。不自动启动执行循环或独立 reviewer 记录。

## Acceptance Scenarios

| ID | 场景与通过条件 |
| --- | --- |
| A1 三键与覆盖 | 在原选区上用三个有效绑定分别执行 replace/add/subtract，验证像素覆盖；用户重绑定生效，旧键/移除键不复活，重复键不重复执行；Action 与命令搜索一致 |
| A2 连续绘制 | 未闭合路径→Ctrl/Alt 编辑旧点→松鼠标→Ctrl+Enter，结果包含最后编辑且无多余点；路径保持开放，Pen owner 结束；Undo 先恢复原选区、再恢复路径，Redo 正确。仅一点草稿/进行中的拖动不误加载其他旧路径 |
| A3 统一与目标 | 实际 PathsPanel 按钮、非活动 B 行右键、三个 Action 使用同一 owner；草稿 A/活动 Shape/选中的 Saved Path/Work Path 共存时按契约命中。A 草稿→显式转换 B，A 仅结束一次、选区来自 B；Work/Saved/Clipping/Shape/Vector Mask 均有小 fixture |
| A3b 显式目标准入 | 无草稿、默认选中 A 为空/不可转换，非活动 B 有效：实际右键经公共 Action 可转换 B；默认 A 有效而显式 B 无效/已删除时拒绝、不回退。验证面板 disabled、handler 及 access 一致；不得靠切 activePathId 或直接调用底层 helper 绕过 |
| A4 失败与保护 | access、会话保护、蒙版权限拒绝及注入 finish 失败：选区/历史/有效草稿不变；显式目标删除不回退；finish 后栅格化失败：保留已提交路径、原选区，重试不重复 Pen；迟到尾事件不写新目标 |
| A4b 零羽化边界 | feather 省略与数值 0 结果一致；非零及非法类型/非有限值在 finishPen 前拒绝，已有草稿、局部栈、文档历史和原选区均不变；三个 Action 共用校验，不另写三份算法 |
| A5 边界覆盖 | 空原选区 add/subtract、已有选区的全画布外路径 replace/add/subtract、曲线/孔洞/抗锯齿边缘；断言实际选区样本及历史数，无变化不记空历史，不仅检查包围框 |
| A6 输入隔离 | 实际 App/Canvas 事件中 Ctrl+Enter 生效；文本/IME、文字会话及 Modal 保留自身确认，拖柄期间拒绝转换但不丢手势；完成转换后 Undo 不再进入旧草稿局部栈，HistoryPanel 正常恢复 |

## Validation

- 引用 [验证预设](../../engineering/TESTING.md)：P-DOC、P-INPUT、P-BUILD。补本任务真实 owner 的路径数据/覆盖率/历史序列测试，不为三个 Action 写三份相同算法测试。
- 必须挂载实际 PathsPanel 按钮/右键及 App 输入分发，不能只直接调用 helper。覆盖三个默认键和至少一项用户重绑定、目标冲突、finish 拒绝/重试及空覆盖分支。
- 真实窗口：隔离 profile 当前源码，普通钢笔及直接选择上下文分别测试三个快捷键、转选区前后 Undo/Redo、工作/保存路径和 Shape 目标、原生 Ctrl+Alt 与 IME 隔离；验证主画板实际显示。自动脚本和人工/Owner 体验分开，无相应环境则明确 Pending/Inconclusive。
- 实施后更新 [输入约定](../../design/KEYBOARD_INPUT.md) 和必要的路径转换 owner 文档，任务记录实际阶段、偏差与验证；不以构建通过代替窗口验收。

## Execution / Review

规划阶段首轮方案审查 Changes Requested；Owner 已确认两项限定调整并要求交 coder 执行：非零羽化后移、显式目标与公共 enabled 分层准入。上述契约和 A3b/A4b 为当前执行要求；后续依 [协作规则](../AI_WORKFLOW.md) 记录阶段证据与独立实现复审，人工缺口继续单列，不自动提交、推送或发布。

## Context Delta

路径转选区的三键、共享入口、目标身份和两步历史已在原范围内通过独立复审。后续按 F1–F2 补充成功转换后的文档路径隐藏/取消选中及面板空白取消选中；保留路径资产、Shape/Vector Mask 边界和已有转换算法，不扩大为路径系统重构。

### P1 执行记录（2026-11-12）

- 基线：codex/dev，HEAD `a2d48be7a0d141295cc5fa5ff08ac6e9c1083d01`。开始时仅 doc/README.md、AI_CONTEXT.md、DEV_LOG.md 及本文已有规划改动，均保留。本次 Owner 明确不提交，阶段提交 hash：N/A；不暂存、不推送。
- 新建 pathSelectionOps owner：纯目标准入与公共上下文准入分层，严格绑定 session/doc/描述/对象/最终内容；结束前校验零羽化，捕获原 Pen 身份并正常结束一次。Pen 桥接增加只读目标、busy 查询和结束重入保护，阻止历史回调重复结束。finish 后重读最终路径；合法单点尾段清理允许，外部接管拒绝。
- pathToSelection 继续使用现有栅格化/组合；全画布外 replace 清空、add/subtract 无变化；比较有效覆盖避免空历史；生成失败保留旧选区，历史提交失败作受身份保护的选区恢复。路径和选区保持两步历史。
- 验证：`npm run typecheck` 通过；`npm exec -- vitest run tests/input/pathSelection.test.tsx tests/input/penSession.test.tsx`：2 files / 69 tests passed（新增本任务 27 项）。包含四类 Pen target、两步 Undo/Redo、显式 B、单点/拖动、零羽化非法值、空覆盖、曲线/孔洞/抗锯齿、finish/raster/history 失败重试、外部身份/内容/会话/owner 替换及访问/保存/关闭保护。
- 真实窗口、原生 Ctrl+Alt、IME 及 Owner 人工验收尚未完成；不以本阶段自动结果代替。P1 自动门槛已满足，推进 P2。

### P2 执行记录（2026-11-12）

- 注册三个固定 op 的公共 Action 和默认键，复用现有 keymap/命令搜索；公共 enabled 仅上下文准入。PathsPanel 既有按钮与行右键使用目标级 canPathSelection 置灰，并通过公共 run 调用；不切 activePathId。面板订阅 Pen 局部 historyRev，避免完成草稿后按钮仍保留早期禁用状态。
- `npm run typecheck` 通过；定向 Pen/路径转换回归 2 files / 80 tests passed（本任务累计 38）。挂载实际 App、Canvas、PathsPanel、HistoryPanel 和真实 Menu；覆盖三键与按键重复、重绑/删除、固定 op、防非法羽化、按钮、非活动 B/草稿 A、默认 A 空而 B 有效、B 删除不回退、access、文本/contenteditable/IME/Modal/拖动隔离及迟到尾事件。补独立数值 max/add 与乘法 subtract 量化断言和栅格化后内容变化保护。
- 无新输入监听、无新栅格化算法、无羽化 UI。阶段提交 hash：N/A（本轮禁止提交）。P2 自动门槛满足，推进 P3 完整验证与隔离生产窗口；人工/Owner 尚 Pending。

### P3 执行记录与独立复审交接（2026-11-12）

- P-INPUT 最终：`npm exec -- vitest run tests/input tests/engine/moveSelection.test.ts tests/gpu/moveOutput.test.ts tests/engine/access.test.ts tests/engine/layerAccessUI.test.tsx`，**10 files / 208 tests passed**；本任务 pathSelection.test.tsx 共 42 项。末次补测真实文字会话 Ctrl+Enter/组合态确认隔离、keymap 冲突查询/显式重分配，以及合法结束清理单点尾段后重读几何。零面积的有效路径覆盖压实后成为逻辑空选区，且画布外旧选区也能被 replace 真正清空；重复空转换不新增历史。
- P-BUILD 最终：`npm run build` 通过，含 TypeScript、renderer 和 Electron；现有第三方浏览器兼容/资源体积警告保留，无构建错误。未执行打包安装或发布。完整输出留本地 `doc/material/local/path-selection-2026-11-12/build-result.txt`。
- 已更新 KEYBOARD_INPUT、INTERACTION_RULES 的稳定输入/owner/历史规则，以及 doc/README、AI_CONTEXT、DEV_LOG 的当前索引；保留原规划内容和前任务历史，不将前任务验收状态升级。

#### 验收证据与缺口

| 项目 | 本轮证据与状态 |
| --- | --- |
| A1 三键、固定 op、用户覆盖 | 实际 App/Canvas 默认三键、重复抑制、重绑/移除不复活、冲突查询/重分配；公共 Action 固定 op，命令搜索复用原注册表。自动通过，完整快捷键设置/命令搜索人工体验 Pending |
| A2 连续 Pen 与两步历史 | 真实 Pen owner、Ctrl 最后点编辑、开放路径保持、两步 Undo/Redo、单点草稿拒绝、拖动保护、尾事件；实际 HistoryPanel 与既有 Pen 集成回归通过。设备与 Owner 连续手感 Pending |
| A3 / A3b 目标与显式准入 | 实际面板按钮/非活动 B 右键经过公共 run；A 空/B 有效仍执行，B 失效不回退；A 草稿→B 只结束 A 一次、不切 activePathId；Work/Saved/Clipping/Shape/Vector Mask fixture 通过 |
| A4 失败与保护 | access/mask/tool、保存/关闭、finish 拒绝、栅格化/历史失败重试、session/doc/对象/内容/owner 被接管、写入前变化均有行为证据。已提交 Pen 不因后续失败撤销 |
| A4b 零羽化 | 省略与数值 0 一致；undefined、非零、负数、NaN、Infinity、字符串、null 在 finish 前拒绝，保留草稿、局部栈、正式历史与旧选区 |
| A5 覆盖率与空历史 | 空选区 add/subtract、全画布外三操作、内部退化零面积、画布外旧选区、曲线/孔洞/AA、max 和乘法 subtract 的独立量化数值断言通过；无变化不记空历史 |
| A6 输入隔离 | 实际文本/contenteditable、组合事件、文字会话自己的 Ctrl+Enter、Modal、拖动和尾事件自动通过；真实中文候选、AltGr/多键盘布局、系统焦点与完整人工矩阵 Pending |

#### 独立实现复审说明

- 对比基线 `a2d48be7a0d141295cc5fa5ff08ac6e9c1083d01` 的工作区，包含未跟踪的新 owner、新测试及本任务，不能只审已跟踪 git diff。原已有三份入口文档改动与本文均保留并回填当前状态。
- 核心入口：`src/app/ops/pathSelectionOps.ts`（只读目标检查与共享 handler）、`src/app/actions.ts`（参数无关公共 enabled / 固定 op）、`src/ui/panels/DocPanels.tsx`（公共 run / 目标级 disabled）。`src/tools/penSession.ts`、`penTools.ts` 仅补目标桥接、原 owner 捕获与结束重入保护；未改 Pen 绘图 getTarget 优先级。
- 复查重点：零羽化是否先于任何结束/修改；默认 A 无效不能阻挡显式 B；无效 B 不回退；finish 失败/owner 被替换不伪装成功；允许正常 finish 的尾段清理但拒绝外部内容接管；转换失败后保留 Pen、重试不重复路径历史；有效零覆盖与无效路径分开，空选区在业务判断中也为空。
- `tests/input/pathSelection.test.tsx` 挂载实际 App、Canvas、PathsPanel、HistoryPanel 与真实菜单/工具/会话；renderer、布局与 IO 作隔离。注入失败与身份变化不是人工验收；原生窗口脚本也不能代替真实中文输入/设备/Owner 体验。
- 本轮不创建独立 reviewer 记录，不代替独立复审，不宣称整体或用户验收通过。旧 R4 已知限制继续保留；填充性能、相邻 ADA/main_native/embedded 不在范围。
- 阶段提交清单：P1 / P2 / P3 均 **N/A（Owner 本轮禁止提交）**。不暂存、不提交、不推送、不合并、不发布；待独立实现复审及另行授权。

#### 最终隔离窗口与工作区证据

- 最终构建的正常 main/preload/app://，独立 `path-selection-final` userData/temp；通过 Electron `webContents.sendInputEvent` 输入真实窗口事件，不用 renderer KeyboardEvent 代替这部分原生验证。`CELENNE_SMOKE` 最终 `errors: []`，renderer 为 **webgpu (GPU compositing)**，DPR=1。
- 原生 Ctrl 点编辑→松鼠标→Ctrl+Enter：保留最后编辑、开放 closed=false、不重复加点，Pen 与 Make Selection 两步 Undo/Redo 均通过。Work / Saved / Shape × Pen / Direct Selection × replace / add / subtract 共 **18** 个窗口序列，各自检查覆盖率、路径保留和转换前后 Undo/Redo；原生 Ctrl+Alt+Enter 在这些序列通过。Work/Saved/Shape fixture 切换是脚本布置，不冒充人工菜单操作。
- 主 viewport 1179.640625×827 CSS px；查看最终截图确认 400×300 白色画板、Shape 图像、路径与选区可见。原始脚本/日志/截图留在忽略区 `doc/material/local/path-selection-2026-11-12/`：`host.cjs`、`production.js`、`native-final-result.txt`、`path-selection-open.png`、`path-selection-shape.png`。初次 harness 导出别名和重做 JSON 字段顺序序列化断言问题已修正，均未计入通过；最终运行比较规范化几何且重复完整流程。
- **Pending / Inconclusive**：真实中文 IME 候选/组合确认、AltGr/多布局、OS 焦点/快捷键完整矩阵、真实物理高 DPR、数位板/触摸以及 Owner 人工体验。当前 Windows/WebGPU 脚本通过不等于这些项目通过；无本轮填充性能结论，旧 R4 不修。
- P-DOC：6 份修改文档严格 UTF-8 无 BOM、相对链接存在、材料忽略、原作者文档未改及 `git diff --check` 通过。最终 HEAD 仍为 `a2d48be7a0d141295cc5fa5ff08ac6e9c1083d01`，codex/dev；暂存区为空，所有实现/测试/文档保留工作区，提交 hash 均 N/A。

## F1–F2：转换后显示与面板取消选中（2026-11-12 新增）

### 复审结论与来源边界

- 原实现独立复审 **Approved（原范围）**，未发现新增 P1/P2 阻断项；独立重跑关联集 10 files / 208 tests、typecheck、diff 检查通过，未独立重跑真实窗口。Owner 确认 Ctrl+Enter 功能通过；真实 IME/设备和原有人工缺口不据此升级。
- 转换后路径仍显示是原方案明确排除的产品行为调整；Paths 面板没有空白取消选中是既有交互缺口。以下为新范围，不倒写为原实现违反契约，也不把旧窗口截图当成本轮通过证据。
- WP 依据：`pathSelectionOps.ts::makePathSelection` 当前只返回转换结果；`penTools.ts` 的 overlay 仍通过 `getTarget` 绘制；`pathEditing.ts::getTarget` 在 activePathId 为空时仍回退 Work Path。`session.ts::activePathId` 的 setter 有 finishPen 保护；`DocPanels.tsx::PathsPanel` 仅有行点击选中，没有列表空白点击处理。因此只设 activePathId=null 不足以隐藏/排除 Work Path。
- 固定参考仍为 PhotoCraft v0.20.2 / `7c12f647150f8e7b2e07718f7993b1fcaa57fefe`，本次已重新核对：
  - [path_ops.rs:60–108](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/vector_ui/path_ops.rs#L60-L108)：成功转换后 deselect_loaded_path 清除文档路径选中、记录该文档 Work Path 的隐藏内容；layer 目标直接返回。active_path_name 跳过隐藏 Work Path，仍允许图层路径回退。
  - [paths_panel.rs:267–273](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/vector_ui/paths_panel.rs#L267-L273)：显式选择 Work Path 解除隐藏；选择其他路径不解除 Work Path 隐藏。
  - [paths_panel.rs:312–318](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/vector_ui/paths_panel.rs#L312-L318)：列表剩余空白区域点击仅清除 selected_path，不设置 hidden_work_path。
- WP 沿用已批准的统一 Action owner，让本任务三个 Action、现有面板按钮及右键一致执行下述成功收尾；这是 WP 的统一入口契约，不声称 PhotoCraft 每一种面板入口都经过相同收尾。Clipping Path 在 WP 作为文档路径沿用 Saved Path 规则，不额外移植 PhotoCraft 的填充/调整图层功能。

### F1：转换成功后的文档路径显示与目标

1. 在共享转换 owner 返回 `changed` 或有效 `unchanged` 后，若实际转换目标是 Work/Saved/Clipping Path，取消文档路径行选中并停止显示其编辑线/点柄，同时隐藏该会话当前 Work Path 的默认 overlay 和默认编辑目标回退。转换 Saved/Clipping 时也需隐藏已有 Work Path，避免它立即顶替显示或被下一次无参数转换误命中。不删除路径、不改变几何/closed、图层选中、图层可见性或蒙版启用状态。
2. 转换目标为 Shape/Vector Mask 时，不执行上述文档路径取消/隐藏，不改图层目标和原显示策略。文档路径隐藏后，仍保留既有活动 Shape/Vector Mask 回退；无图层路径时下一次无参数转换应拒绝，不偷偷选隐藏 Work Path。显式指定隐藏路径仍按原准入可转换，不要求先点行，不为转换临时解除隐藏。
3. 显示收尾必须在转换成功且原 session/doc/目标仍有效时执行，不能提前清状态、作用到新活动文档，或因 setter 回调再 finish 一次。`rejected`/`failed` 不执行隐藏/取消；finish 成功而栅格化/选区历史失败仍保留已提交 Pen、旧选区与可恢复目标，重试不重复 Pen。注意成功后 selection.version 已变化，不能直接复用要求“旧选区版本”的提交前检查而跳过收尾。
4. 用最小的会话级状态表达隐藏及其对应 Work Path 身份/内容；面板选中、overlay、默认目标解析使用一致判定。不得序列化到工程/文件、引入通用可见性框架，或仅在绘制处遮住线而仍允许直接选择/锚点工具误编辑隐藏路径。有效 Pen 草稿仍由其固定 owner 绘制和编辑；不重排无关 Shape/文档路径优先级。
5. 显式点击 Work Path 恢复显示并解除隐藏；Saved/Clipping 被选中时恢复该路径显示，但不解除 Work Path 隐藏。Work Path 被新建、替换或几何内容改变后恢复可见；无关选区/history 通知、重绘、工具切换或通知次数不得解除隐藏。隐藏比较应覆盖原地几何变化，不只比较对象地址；Undo/Redo 若回到记录的隐藏内容，可按相同内容判定再次隐藏。切文档不串状态，关闭/销毁后清理，不持久保存。
6. 隐藏后继续钢笔绘制须能正常创建/开始可见草稿，不得静默续写不可见旧路径或清空 Saved/Clipping 资产；沿用 WP 原有创建/历史规则，必要的 Work Path 替换仍须可撤销，不增加新工具模式。新路径被确认后正常绘制/编辑，不被旧隐藏记录压住。
7. 这些显示/选中变化不单独记文档历史、不单独变更 dirty。原先 Pen→Make Selection 的历史顺序不变；Undo/Redo 只按原命令恢复路径/选区数据，不为恢复面板选中另建命令。只有选区变化时才增加选区历史；无变化成功仍完成显示收尾。

### F2：Paths 面板空白点击取消选中

1. 只响应 Paths 列表内容区剩余空白的普通主键点击，取消 activePathId 对应的文档路径行选中；不是取消 Layers 面板的图层选择。点击行/图标/名称、重命名输入框、右键菜单、底部工具栏及滚动操作不得因冒泡误触发。无选中时为无操作。
2. 只清面板选中，不设置或清除 F1 的隐藏记录：普通未隐藏 Work Path 仍可按原规则显示/作为默认目标；已隐藏 Work Path 保持隐藏。Saved/Clipping 取消选中后退出其编辑高亮，允许未隐藏 Work Path 或图层路径按既有规则回退。不得把“空白取消”误实现为“隐藏所有路径”。
3. 有空闲 Pen 草稿时沿用现有受控目标切换先 finishPen，成功后再取消选中，最多结束一次；失败保留选中及草稿，不绕过 setter/owner 强改私有状态。进行中 pointer 手势、文字/变换、IME 重命名组合态及保存/关闭保护不由空白点击强行打断。纯取消选中不增加历史；合法 finish 可产生原有 Pen 历史，不误触发转选区或修改像素覆盖。

### 补测与阶段门槛

| ID | 必须验证的实际行为 |
| --- | --- |
| F-A1 成功收尾 | Work/Saved/Clipping 的 replace/add/subtract；快捷键、按钮、非活动 B 行右键经共享 owner。验证选区覆盖正确、资产/几何保留、选中清除及 overlay 点柄实际消失；Saved B 与 Work A 共存时两者均不作为文档路径叠加显示。Shape/Vector Mask 转换保持原目标/显示，不误隐藏或取消图层 |
| F-A2 默认与显式目标 | 隐藏 Work 后无参数命令不会命中它；有 Shape/Vector Mask 时按原优先级命中图层，无图层路径时拒绝。显式隐藏路径仍可转换，非法显式目标不回退；直接选择/锚点编辑不误改隐藏 Work。不能仅断言隐藏布尔值 |
| F-A3 恢复与生命周期 | 重新点 Work 恢复，再点空白仍为普通可见 Work；只点 Saved 不解除 Work 隐藏。新建/替换/原地编辑 Work 可见，隐藏后继续绘制及 Undo/Redo 可恢复资产；仅选区撤销/重绘/工具切换不解除隐藏。两文档切换、关闭重开不串状态、不序列化隐藏标记 |
| F-A4 无变化与失败 | 有效零覆盖/结果无变化仍收尾且不增空历史；参数/access/保存/关闭拒绝、finish 失败、栅格化/历史失败均不做显示收尾。finish 后失败保留原有路径历史，重试不重复；注入 session/doc/目标切换不影响新目标。成功选区版本变化不能导致遗漏收尾 |
| F-A5 空白与传播 | 挂载实际 PathsPanel：真实空白点击取消行高亮；行/图标/名称、重命名、右键、工具栏和滚动不误取消。空白不改变隐藏状态/选区/图层选择；空闲草稿最多 finish 一次，失败及手势/IME/保护状态保持归属；无选中点击不记历史 |
| F-A6 历史与窗口 | 自动断言 Pen→Selection 两步 Undo/Redo、无草稿仅选区一步、显示操作不单独 dirty/记账。隔离当前构建真实窗口观察 Work/Saved 转换后仅留蚂蚁线、重新点行恢复、空白取消高亮、Shape/Mask 例外及继续绘制；保留前后截图/序列证据，不能仅用绑定表或状态快照验收 |

- **F1 门槛**：完成成功收尾、会话显示状态及必要的 overlay/默认目标准入，并通过 F-A1–F-A4 的定向行为测试及原转换/钢笔回归；再推进 F2。不改既有转换像素算法、三键语义、零羽化与失败历史契约。
- **F2 门槛**：完成面板空白取消及 F-A5；联跑 F-A1–F-A6 自动部分、P-INPUT、typecheck、P-BUILD、P-DOC。在原测试上增加针对真实组件和 owner 的行为验证，不复制三套算法测试；旧断言只按本次显示契约调整，不削弱目标身份、覆盖率或历史断言。
- 真实窗口必须观察路径线/点柄与蚂蚁线，不以 jsdom 通过替代显示验收。真实 IME、OS 焦点、设备等未执行项继续标 Pending/Inconclusive；自动、窗口、独立复审和 Owner 状态分别记录。
- coder 回填每阶段实际改动、命令/结果、窗口证据和缺口，必要时同步现有 owner 文档中已过期的“保留显示”说明。不新增 reviewer 文档，不修旧 R4、填充性能或相邻项目，不自动暂存/提交/推送/合并/发布。
- 当前状态（2026-11-14）：F1 **Implemented / 自动与窗口验证通过**；F2 **Implemented / 自动与窗口验证通过**；新增范围实现复审 **Pending**，真实 IME/设备/Owner 验收 **Pending**。原 P1–P3 的 Approved 不等于新增实现或用户验收通过。


### F1 执行记录（2026-11-14）

- 起始核对：WebPainter_Dev，codex/dev，HEAD `a2d48be7a0d141295cc5fa5ff08ac6e9c1083d01`；原 P1–P3 实现、测试及规划/复审文档均未提交，全部保留。独立复审原范围 Approved 与本轮新范围分开记录。
- DocumentSession 增加私有会话显示记录（Work Path 条目身份与规范化几何内容），不写 document、dirty、历史或文件；显式 Work 选择解除隐藏，Saved/Clipping 选择不解除。读取时比较原地几何，选区/history 通知与切工具不清隐藏，dispose 清理。
- 共享转换 owner 仅在 changed / 有效 unchanged 后，原 session/doc/实际路径目标与上下文仍有效时取消文档路径选中并隐藏 Work；Shape/Vector Mask 不收尾。不沿用旧 selection.version 作为成功收尾 permit；选区已经成功更新版本仍可完成显示。失败分支保持原目标/显示与既有两步历史。
- overlay 和默认直接选择/锚点准入共享 getTarget 的隐藏判断；默认转换也跳过隐藏 Work，显式 target 不受影响。Canvas 对会话显示变化刷新 overlay，包含空选区无蚂蚁线刷新场景。隐藏后新 Pen 通过现有 setWorkPath 创建可见空 Work（必要替换可 Undo），不续写隐藏几何、不清 Saved；不重排 Shape/Mask 绘图优先级。
- `npm run typecheck` 通过；`npm exec -- vitest run tests/input/pathSelection.test.tsx tests/input/penSession.test.tsx`：**2 files / 108 tests passed**（路径转换 66，既有 Pen 42）。F-A1–F-A4 新增 24 项：三类路径×三操作、实际 overlay 线/点输出、直接/锚点不编辑隐藏目标、显式转换、Shape/Mask 例外、行重选、原地修改/替换/两会话、native 编码一致及关闭重开、继续绘制/Work 替换 Undo/Redo、零覆盖/unchanged 不 dirty、finish/raster/history/参数/保护失败及重试、成功通知切文档不清新目标。
- 原断言仅按新显示契约调整：几何从固定路径资产读取，成功后行选择为 null，重复转换用显式 target 或重新选行；保留原覆盖率/身份/历史断言。合法 finish 后续画预览线消失与正式路径线保留分别断言。
- F1 自动门槛通过，进入 F2；真实窗口显示验证待最终构建。F1 hash：N/A（本轮禁止暂存/提交）；独立实现复审、真实 IME/设备及 Owner 验收 Pending。


### F2 执行记录（2026-11-14）

- PathsPanel 仅在列表本体收到无修饰主键 click 时，经原 activePathId setter 取消文档路径选中；target/currentTarget 严格区分，子节点、行、重命名、菜单/工具栏、滚动与非普通主键不进入。空白不设置/清除隐藏记录，不触发转换。以当前会话、交互状态、组合态、弹窗及保存/关闭保护准入；被保护的空白 mousedown 阻止焦点接管，避免 IME 重命名被空白强制结束。
- 空闲草稿仅由 setter 调用一次 finishPen；失败保留 row/owner。手势、文字/变换及保护状态不结束草稿。无选中时直接无操作；纯取消不记文档历史/dirty，合法 finish 仅记原 Pen 步骤。
- F-A5 定向：`npm run typecheck` 通过；路径转换/Pen **2 files / 126 tests passed**（新增空白传播、隐藏不变、子节点/rename/menu/toolbar/scroll、6 类非主键/修饰点击、idle finish/失败重试/拖动/无选中、5 类会话保护、实际重命名组合事件等 18 项）。随后补 8 项 F1 公共键/按钮/非活动行与 Work 共存、access/输出/关闭拒绝、成功通知改目标/改选中后的收尾保护。
- 最终 **P-INPUT：10 files / 258 tests passed**，命令沿用本文 Validation；本任务路径转换测试共 92 项。保留既有零羽化、目标身份、覆盖数值及两步历史断言。最终 **P-BUILD：npm run build 通过**，含 typecheck/renderer/Electron；第三方兼容等既有构建警告未升级为验收结论。完整构建日志本地 `doc/material/local/path-display-2026-11-14/build-result.txt`。
- 更新输入/交互 owner 文档中的旧“保留显示”现行说明，并回填当前入口/上下文/进展索引；原 P1–P3 历史证据保留，不倒写为旧实现违反新契约。
- F2 hash：N/A（本轮不暂存/提交）。真实窗口及人工缺口另列；新增范围独立实现复审 Pending，不用原范围 Approved 或自动通过代替。


### F1–F2 最终窗口、文档与交接证据（2026-11-14）

- **当前源码窗口通过**：`npm run build` 产物，经正常 main/preload/app:// 启动，`path-display-run4` 隔离 userData/temp，Electron 原生 sendInputEvent 驱动键盘、Paths 标签、行选择、空白、Load 按钮与非活动行右键菜单。`CELENNE_SMOKE` 最终 **errors: []**；WebGPU (GPU compositing)，DPR=1，viewport=1179.640625×827 CSS px。fixture 为 400×300，截图确认主画板实际显示；不是旧 P1–P3 截图或开发热更新窗口。
- 16 条记录包含：live Pen→Ctrl+Enter 成功收尾和原 Pen→Selection 两步 Undo/Redo、重选 Work 恢复、空白仅清行但默认 Work 仍可见、Saved 与 Work 共存转换后隐藏两者、Saved 重选后空白保留 Work 隐藏、实际 Load 按钮、非活动 Saved 行 Make Selection（有效 unchanged 也收尾且无新增选区历史）、Work 三个原生快捷键覆盖/收尾、空闲 Saved 草稿空白 finish 一次且选区不变、隐藏后可见新 Pen 和 Work 替换 Undo/Redo、Shape 与 Vector Mask 例外。
- 实际 overlay 像素辅助读回：Work 转换前蓝色 710，转换后 **0**（黑白轮廓 1724）；Saved 选中蓝色 789，转换后 **0**（黑白轮廓 1840）；空白取消 Saved 后蓝色仍 **0**，重选 Work 后蓝色 477。Shape 转换后蓝色 478、Mask 转换后蓝色 414，且图层目标、几何和蒙版 enabled 保留。像素阈值仅是当前 fixture 的自动显示证据，不是通用视觉质量验收标准；同时实际查看前后截图确认文档路径线/点柄消失而蚂蚁线保留、行高亮清除，以及两类图层路径仍显示。
- 本地忽略区 `doc/material/local/path-display-2026-11-14/`：`host.cjs`、`production.js`、`build-result.txt`、`native-result4.txt`；截图 `01-live-before`、`02-work-after`、`03-work-restored`、`04-blank-work-visible`、`05-saved-before`、`06-saved-after`、`07-saved-blank-hidden-work`、`08-context-after`、`09-new-visible-draft`、`10/11-shape-before/after`、`12/13-mask-before/after`，另有 new-document fixture，扩展名均 .png。脚本与日志留在材料区，不提交。
- 窗口初轮中断为 harness 点击落在拒绝提示条覆盖区域（空白/底部按钮），非产品通过证据；加入实际命中检查、按界面 Dismiss 提示和调整至真实剩余空白后，从全新 profile 完整重跑通过。未为解决测试坐标修改产品遮挡/提示条行为。
- **P-DOC 通过**：6 份本轮相关文档 UTF-8 严格解码/无 BOM、相对链接存在、材料忽略、原作者 docs/根文档未改、`git diff --check`。HEAD 仍为 `a2d48be7a0d141295cc5fa5ff08ac6e9c1083d01`，分支 codex/dev；暂存区为空。本次 F1/F2 提交 hash 均 **N/A（明确禁止提交）**，所有既有及新增改动保留工作区。

#### 待独立复审与未验证项

- 从工作区审查原 P1–P3 + 新 F1–F2，包含未跟踪的 `src/app/ops/pathSelectionOps.ts`、`tests/input/pathSelection.test.tsx` 和本文，不能仅看已跟踪 diff。重点检查 Session 私有隐藏记录、setWorkPath 可撤销替换、所有路径工具默认编辑/overlay 一致、成功后新选区版本的收尾许可、Shape/Mask 例外、空白 target/currentTarget 和受保护状态，以及实际公共 Action/面板入口。
- 原 P1–P3 实现和本轮新增范围不同；自查、P-INPUT 与窗口脚本都不替代独立实现复审。不创建 reviewer 文档，不自行将新增范围标记 Approved 或整体验收通过。
- **Pending / Inconclusive**：真实中文 IME 候选/组合提交、系统焦点/AltTab/AltGr 和多键盘布局、物理高 DPR、多显示器、触摸/数位板与完整人工连续体验、Owner 新增行为验收。本轮 composition DOM 回归与 DPR=1 原生窗口证据不能代替这些项目。
- 旧 R4 仍延期，填充性能不在本轮；未修改相邻 ADA/main_native/embedded，未暂存/提交/推送/合并/发布。

### F1 独立复审 P2 修复执行记录（2026-11-16）

- 本日 Owner 明确授权修复复审唯一 P2、补测，并在主代理独立复审通过后提交/推送；该授权覆盖上文旧时点的禁止提交/推送记录，旧记录仍保留为历史。本执行者仅修复、补测与回填，不暂存、提交或推送，最终 Git 操作由主代理负责。
- 已核对源码：`TypeTool.pathUnder` 独立维护沿路径文字候选，原默认 Work 回退未使用会话隐藏判断，导致转换后点击隐藏原线段仍创建 `text.path`，拖动也被沿路径文字抢占。现仅在默认 Work 候选复用 `session.isWorkPathHidden`；显式 Work/Saved 与活动 Shape 候选及其优先级保持原行为，不重排 `getTarget` 或改动文字系统。
- `tests/input/pathSelection.test.tsx` 新增 4 项真实 TypeTool down/move/up 回归：隐藏后原线段点击创建普通 point 文字且无 `text.path`，从原线段拖动创建指定尺寸 paragraph 框；重新显式选择 Work 后点击/拖动恢复沿路径文字；Work 隐藏时显式 Saved、活动 Shape 仍创建沿路径文字。每次通过 `cancelTextEdit` 清理新增文字会话，检查恢复行为与隐藏记录保持。
- `npm exec -- vitest run tests/input/pathSelection.test.tsx tests/input/penSession.test.tsx` 最终 **2 files / 138 tests passed**（路径转换 96，Pen 42）；`npm run typecheck` 通过。首轮新增 4 项对 point 文字 `box` 误断言为 undefined，按现有工厂默认 null 修正后重跑通过，该首轮为测试断言修正，不作为产品失败或通过证据。
- 本次只改 `src/tools/typeTool.ts`、上述测试和本文；主代理另行独立审查、联跑完整 P-INPUT/build 并更新入口文档。本修复 **Implemented / 定向自动验证通过，待主代理独立复审**，不自行标记 Approved。
- 未重新执行真实窗口文字点击/拖框；既有 F1–F2 窗口证据不覆盖本次文字回归。真实中文 IME、系统焦点、多布局、物理高 DPR、多显示器、触摸/数位板、完整人工连续体验及 Owner 新增行为验收仍为 Pending / Inconclusive。

### 主代理独立复审与提交交接（2026-11-16）

- **Approved**：复核 TypeTool 的 cursor/down→pathUnder→up 调用链，默认 Work 候选复用会话隐藏判定；显式路径及 Shape 候选未改变。新增 4 项测试断言实际创建的 TextData.path/kind/box，覆盖原问题和恢复/例外行为；原 F1–F2 目标、显示、失败和历史契约无新增 P1/P2 阻断项。
- 独立最终 P-INPUT：`npm exec -- vitest run tests/input tests/engine/moveSelection.test.ts tests/gpu/moveOutput.test.ts tests/engine/access.test.ts tests/engine/layerAccessUI.test.tsx --reporter=dot`，**10 files / 262 tests passed**。`npm run build` 通过（含 typecheck、renderer、Electron）。首轮完整集包含同一 box 断言误写，修正后完整重跑通过；日志为忽略区 `doc/material/local/path-display-2026-11-14/review-2026-11-16-tests-final.txt`、`review-2026-11-16-build.txt`。
- 文档 UTF-8/无 BOM、相对链接和 diff 检查通过；既有 React act、WASM 路径及构建资源警告不作为窗口/颜色或设备验收证据。本次未重跑真实窗口文字流程，前述人工缺口保持 Pending。
- 本次提交范围为此前未提交的路径转选区 P1–P3、F1–F2、此次文字工具补漏及配套测试/文档；提交前 HEAD 为 `a2d48be`。origin/codex/dev 无落后提交、另有 5 个此前钢笔相关本地提交，本次正常推送包含该祖先链。Owner 已明确授权提交/推送，旧时点禁止 Git 操作的记录不再作为本轮限制；不合并、不发布。实际提交及远端校验结果由交付消息给出。
