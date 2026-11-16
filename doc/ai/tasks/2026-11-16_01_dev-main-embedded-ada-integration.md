# Dev → main → embedded → ADA 分阶段集成

日期：2026-11-16。状态：**方案评审通过（两项非阻断澄清已纳入），Owner已授权阶段0→A→B→C执行、本地分阶段提交和独立审查；阶段审查通过后才进入下一阶段。** goal已激活，coder/reviewer子代理均使用gpt-6.1-sol。必要自动验证按阶段执行；最终人工测试与体验由Owner统一执行，未执行项目如实Pending。不推送、不发布、不合ADA主线。

## 1. 目标与边界

把Dev的快捷键、弹窗导航、选区与Pen/路径功能合入main，保留main的边界缓存、画笔批处理、透视GPU预览与后台确认吞吐优化；经集成审查后单向同步embedded，构建确定版本的WP包，再更新ADA现有绘图集成分支。独立WP保持完整本地能力，ADA保持本地iframe和自有悬浮面板/adapter，不复制WP内核。

不包含：合入ADA主线、变更现有产品开放范围、新功能研发、多Worker/GPU权威采样、R4延期修复、真实付费Provider调用、安装器发布或上游PR。集成必需的兼容修复在本任务内；发现无关缺陷记录后续，不借合并重写架构。

主要合同：[当前架构](../../architecture/ARCHITECTURE_OVERVIEW.md)、[交互预览/确认](../../architecture/INTERACTIVE_PREVIEW.md)、[确认吞吐及证据](2026-11-12_01_transform-confirm-throughput.md)、[验证约定](../../engineering/TESTING.md)。Dev与embedded/ADA的适用AGENTS、文档入口、当前任务和平台合同须在各工作树读取；不以本任务覆盖其owner合同。

## 2. 已核对基线与复核要求

| 工作树 | 分支 / HEAD（规划时） | 实际状态 |
| --- | --- | --- |
| `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter_main_native` | main / 7932ab4 | 干净 |
| `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter_Dev` | codex/dev / b5cf006 | 干净；路径转选区P1–P3/F1–F2和隐藏Work文字命中补漏已提交，任务记录独立review Approved，完整设备/Owner验收仍Pending |
| `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter` | integration/embedded / 2ada52c | 既有诊断文档dirty，见下节 |
| `D:/00_Projects_WSY/AI/Codex_Projects/auto_design_Agent` | codex/isolate-drawing-interface-20261104 / 62997f77 | 既有面板UI/测试/文档dirty，见下节 |

实际执行前重新记录绝对目录、分支、完整HEAD、status、remote和跟踪分歧；fetch不等于自动pull/rebase。基线变化须重算范围与冲突，新增未知改动先辨明归属，不覆盖。不得使用相邻_New代替目标。

当前ADA包：mainBase `59f81b51fa2db6f6ea0e7d31094d8015549c6ec8`、embedded `060b6a4008c165f3eba220564977826c524e1810`、bundle `df16465d36d9cd7315407612206f033f4d6b0d84a95a09ef45727afb9f7c6556`，port3/native1/policy1；以实际wp-editor-build和manifest重核。旧包/旧实窗证据不能重标为新包验收。

## 3. 阶段0：保全既有dirty与冻结执行输入

先保存diff（含binary）、未跟踪文件清单及内容、HEAD/status和SHA到各仓库忽略材料区，验证备份可读；材料不得包含凭据或真实用户作品，不纳入Git。备份不等于允许删除原文件。不使用reset --hard、clean、checkout覆盖或自动stash隐藏他人工作。

### embedded既有内容

- 修改：`doc/ai/AI_CONTEXT.md`、`doc/ai/tasks/2026-11-05_02_4k-selection-preview-prototype.md`。
- 未跟踪：`doc/ai/tasks/2026-11-10_01_continuous-painting-performance-diagnosis.md`。

这批是前期诊断记录，不算本轮嵌入实现。逐项核对来源和内容；确认属于已授权且可交付记录后单独文档提交，保留历史证据。若归属或交付状态不清，原工作树保持原样，使用固定提交的隔离worktree推进嵌入验证。不得把未知dirty纳入clean包或伪造来源。

### ADA既有内容

- 修改：`apps/web/src/editor/page.ts`、`panel.ts`、`scripts/drawing-performance-window.mjs`、`doc/ai/AI_CONTEXT.md`、`DEV_LOG.md`、`doc/design/UI_GUIDE.md`。
- 未跟踪：`apps/web/src/editor/panel-layout.self-test.ts`、`doc/ai/tasks/2026-11-12_001_drawing-node-editor-panel.md`。

既有面板记录中的opacity长scrub偶发生成多个历史步骤必须单列复核；若接纳UI且本轮未修复，保留明确未通过/Pending状态，不假称一手势一次历史已验收；不强制扩大为本轮必须修复的功能。若使用已提交HEAD隔离验证，继续明确排除这批UI。

这些属于独立UI交付，不是WP升级diff。先读该任务和改动，核对验证证据与当前源码；若后续Owner执行授权明确覆盖这批交付，补必要检查后单独提交，之后再更新WP包。不能只为获得clean状态而提交未审实现。

若授权/审查不足，原ADA工作树不动，在当前已提交HEAD的隔离worktree验证包升级；必须注明该结果不包含dirty面板。不得用隔离旧UI证据宣称用户当前新UI已验收。最终要更新原目标分支/日常入口并交付完整新UI组合时，仍须先解决这批改动的归属与交付门槛。不能因隔离包通过就覆盖原dirty或自动切换原工作树。

阶段0输出：固定输入commit、dirty逐项去向、原工作树与隔离验证的关系、目标分支落地办法、旧版本回退点。未来执行指令应明确dirty独立交付及本地提交权限；若缺少这项必要决策，仅询问该项，不重新请求已授权的其余工作。

## 4. 阶段A：Dev合入main与独立集成审查

采用保留祖先关系的普通merge，固定源为执行时确认的Dev commit；不rebase共享历史，不用整文件ours/theirs，不反向合入embedded代码。

规划时merge-tree模拟冲突为：`src/app/autosave.ts`、`editor.ts`、`fileOps.ts`、AI_CONTEXT、DEV_LOG。13个双方修改文件还包含session、paintTools、tool、App和CanvasView等；自动合并不代表语义正确。执行时重跑冲突/重叠清单。

逐函数整合以下职责：

- Dev：输入/IME/控件归属、有效keymap、Ctrl+J上下文复制、held pan、透明Modal导航、min-alpha移动片段与coverage相减挖空、Pen私有草稿/局部历史、路径转换及隐藏Work显示/命中。
- main：批次输入保留全部压力/时间点、图块边界缓存写协议、稳定affine/projective源与完整代际、共同几何/总容量检查、Worker专用精确采样、实际取消、owner token、正式结果身份/一次历史及保存关闭等待。
- 特别审查Pen结束、后台transform等待和输出取快照的顺序；不得先改权威数据再因保护拒绝历史，不得保存未完成草稿、接纳迟到结果或把新编辑标成已保存。

验证：至少联跑实际tests/input、transformThroughput/transformTask、projective/transformPreview、Move/浮动合成/output、tile bounds、native及保存关闭/access相关测试，并执行P-BUILD。按实际改动选文件去重，不机械叠加旧测试数。新增针对跨分支组合的回归：Pen结束→保存/路径转换、Ctrl+T applying期间快捷键/undo/保存/关闭、快速取消重试、输入批处理与Modal/Pen事件归属。

使用独立profile/temp的真实独立WP窗口检查Ctrl+J、路径三键、Pen Ctrl/Alt及局部undo、透明边缘Move、透视预览、Enter取消重试与保存重开。复用4K非均匀夹具和固定输入/矩阵做最小性能对照，确认Dev功能未破坏main既有连续显示和确认收益；不重建全设备矩阵。正式像素对照固定旧oracle，不调用已修改新实现假装独立。

形成可审查本地merge提交，记录双亲和冲突决策。coder自查后由独立review者检查合并结果及交叉生命周期；有P1/P2则修复、重验受影响范围并复审。**阶段A审查无阻断问题后才允许同步embedded**；纯文本无冲突、构建或旧任务Approved均不能替代本次集成审查。

## 5. 阶段B：main单向合入embedded、审查与固定包

先按阶段0处理dirty。将阶段A已审main commit合入integration/embedded，保留通用嵌入boot、宿主端口、native编辑上限、后台checkpoint编码与独立预览worker。文档按当前状态整合，不覆盖历史包来源。若通用缺陷必须修main，先在main修复并验证，再单向同步，不能长期维护两份内核。

重点核对 `src/embedded/editor.ts` 的busy/state/change、native capture/history seal、短COW保护、操作回执、dispose/renew，及新Pen/transform生命周期：

- Pen草稿、拖动、文字和applying期间自动保存应延期；不得定时强制结束工具。显式返回/生成的结束或等待规则要有明确顺序与失败结果，不能无限等待或输出半成品。
- 工具busy/mode不一定完整表达新Pen私有状态，须沿真实调用链证明；终止后台transform与捕获/销毁互斥，旧取消/保存回执不能操作新任务。
- 保护使用明确owner，不让embedded旧布尔恢复覆盖main任务token；native codec/元数据/CAS/历史checkpoint语义保持。
- 新Action如layer.copyContext、path转换和工具直接入口都受同一access/native上限约束；隐藏不等于禁用，已有合法内容仍能读取保存。独立main默认完整。
- Worker资源能在嵌入库构建及本地iframe部署路径加载；不能只在Vite下通过。保持native保存不生成PNG、返回后预览异步派生、生成使用准确完整合成图。

联跑main受影响回归与embedded生命周期、checkpoint/undo回执、capabilities、RPC/native测试及构建；新增Pen/后台transform与capture/返回/dispose的组合用例。独立review通过后才构建可交付固定包。

使用embedded已有 `scripts/build-embedded.mjs`，由明确clean源提交构建，检查其实际参数及依赖，不在main调用不存在的脚本。记录完整main来源、embedded commit、sourceHash、bundleHash、每资源SHA、port/native/policy版本、构建环境及支持边界。无合同变化则不为升级而升版本，有破坏变化需先修订两端合同并审查。包中所有Worker及其资源必须进入manifest，旧包保留作回退。

## 6. 阶段C：ADA现有绘图分支更新与配套验证

先满足阶段0的ADA源状态边界；目标仍是 `codex/isolate-drawing-interface-20261104`，不合ADA main。读取ADA Drawing Editor、ADR-0021及相关现行平台合同。通过 `scripts/prepare-wp-editor.mjs <固定dist-embedded>` 校验并消费新包，更新前端wp-editor-build.json与API生成配套文件，不手改vendor。核对脚本的port3/native1要求与新manifest一致。

通常仅替换包与来源记录；确需adapter兼容时最小调整并测试，不将Artifact/Profile/Results业务放进WP。ADA自有面板仍悬浮于WP画板上，不挤占布局、不把控件按键穿透为绘图动作。

必须保留并验证：

- 旧Primary/recovery的native重开、继续编辑、保存与undo/redo；新包合法内容可持久化，拒绝不支持的新操作不损坏旧内容。
- Ctrl+J、路径转换和Pen/透视在ADA实际能力策略下的开放/拒绝；提示词/模型控件与iframe键盘/焦点隔离。
- 自动保存仅native、750ms空闲/5秒最新需求合并、失败不忙重试，恢复备份独立10分钟；返回排空并派生准确revision/hash预览，不复活旧备份/旧预览。
- 生成快照绑定准确D/r、实际reference为完整合成图；用受控本地Provider验证Results持久化、显式加层与失败/重试不重复生成投递，不调用付费模型。
- Applying期间返回/关闭/切作品/切Profile、失败/取消、迟到保存或任务回执的身份保护，无双写/漏存。
- 同Profile、同编辑实例的连接续期，分别覆盖Pen草稿及applying/保存中续期：保留编辑实例、历史与草稿，在途任务/保存维持原operation/checkpoint身份；不得误走切Profile销毁重建或重放生成/保存。

跑相关API/contract/adapter/UI回归、类型和构建。用独立运行目录、profile、测试作品和端口验证实际 `start-dev-desktop.bat` 所用开发链路及新包正式iframe生产窗口；不结束用户进程或读写真实作品。生产测试包沿用 `build-drawing-package.mjs` 的clean源要求，在独立.packaging/drawing-*输出；仅本地验证包，不是发布。记录ADA commit/buildId、ASAR/包来源和实际加载Worker URL。旧ASAR不能证明新包生效。

固定同一4K作品、画布/残存图层、笔刷/缩放、输入轨迹比较main与ADA，区分保存长任务、绘制与确认总时长；不得预设iframe导致延迟。确认新功能可用、自动保存不恢复周期性冻结及完整结果正确。只要求与本次升级相关的有限对照，不要求PhotoCraft同机或全格式/设备矩阵。

独立集成review无P1/P2后才报告阶段C技术通过。没有设备/真实窗口证据的项目标Pending/Inconclusive；Owner实际体验、真实IME/压感/多设备及正式发布各自独立，不以脚本结果填满。

## 7. 提交、回退与最终交付

未来执行授权应明确本地提交和是否推送。本任务建议按dirty独立整理、main merge/修复、embedded merge/兼容修复、ADA包更新/必要adapter、配套证据分别本地提交；不得跨仓库假装原子提交。各阶段先定向正确性验证，再提交交审，不能全部留到最后。**默认执行边界仅本地提交，不推送；需要Owner明确授权后才推自有origin指定分支，不推upstream、不发布。**

回退按明确提交/固定包：main/embedded通过revert本轮合并或修复提交，不重置共享分支；ADA可恢复原固定包指针及相配adapter，但须先证明本轮未产生旧版不可读数据。禁止把代码回退当作可回滚用户作品，不自动降级数据或清理恢复文件。验证失败先停留在当前阶段，不将失败包送入下游。

未来goal执行：主代理持有阶段范围、证据及提交身份；coder子代理只在分配工作树写入，review子代理只读且不审自己实现。共享仓库Git操作串行；同一工作树不得并发写入，跨工作树修改同分支/构建输出也须协调。独立review结论与coder自查分开记录。仅在后续Owner明确授权后启动，不从本任务推断自动执行权限。

最终报告包括：实际提交链及审查结论、dirty去向、冲突决策、各阶段新增/重跑检查、旧/新配套版本与哈希、实际开发/生产入口证据、性能与正确性限制、未验收/延期事项和每个工作区status。记录旧R4延期及既有人工缺口，不自动改判整体产品Go。更新各owner架构/任务与简短上下文，清除已过时的“尚未实现”描述但保留历史证据。

## 8. 原规划交付（历史时点）

仅创建本任务和main文档入口索引；未合并、未改业务源码、未提交/推送或更新构建包。规划依据为本地源码/任务及merge-tree模拟；未运行本次产品测试、性能或真实窗口验收。待reviewer评审后由Owner授权下一步。


## 执行授权补充

2026-11-16 Owner明确开始执行上述阶段；包含既有dirty的审查、保全和可交付内容的独立本地提交。简单准备可直接执行，其余先有任务再实施；每阶段coder后独立review，无阻断后继续。真实窗口与人工体验可由Owner最终统一进行，必要自动回归/构建不能省略，窗口未测保持Pending。后续历史规划限制以本次明确授权为准；不推送。


## 阶段0执行记录（2026-11-16，coder交独立review）

### 固定输入与保全

本阶段没有fetch；以下跟踪分歧以本地remote-tracking引用为准，四树均为ahead 0 / behind 0，不宣称远端已实时刷新。

| 工作树（均位于 `D:/00_Projects_WSY/AI/Codex_Projects/`） | 当前分支 | 实际完整HEAD / 旧版本回退点 |
| --- | --- | --- |
| WebPainter_main_native | main | `7932ab400a60d6d3c8e1c945e5f88bbcfa4d73f2` |
| WebPainter_Dev | codex/dev | `b5cf006f3f47e7937775a4c6f4684c1ba76e0933` |
| WebPainter | integration/embedded | `2ada52c7ed56ebd1fc6313273a7db97e278ee945` |
| auto_design_Agent | codex/isolate-drawing-interface-20261104 | `62997f779e2fd73d90fef8c9697dc861ed00c201` |

四树已在修改前保存 `tracked.patch`（git diff --binary HEAD）、`untracked.json`及未跟踪原文、HEAD/branch/status/remotes和`sha256.json`。WP三树位于各自`doc/material/local/2026-11-16/stage0-preexisting/`，ADA位于`.packaging/stage0-preexisting-20261116/`（其doc/material未被现有规则忽略，故使用既有忽略目录，未改忽略规则）。已逐文件读回重算SHA、非空patch经git apply --numstat解析验证；不包含凭据、真实作品或运行时数据。main备份7文件含1份未跟踪任务，Dev6文件无未跟踪，embedded7文件含1份未跟踪诊断，ADA8文件含2份未跟踪。备份不进入Git，原工作树保留，无stash/reset/clean。

WP origin为MarcleWright/WebPainter，upstream为puripooh5-cloud/celenne-studio（push DISABLED）；ADA origin fetch为MarcleWright/auto_design_agent，push同时配置GitHub与opencloud Gitea。本阶段未网络同步或推送。

### dirty逐项去向及拟独立提交

- main：开工即有AI_CONTEXT、DEV_LOG、本任务三项规划dirty；归本任务文档提交。本阶段更新索引为已授权执行/阶段0交审，§8明确原规划历史，不将A–C写成已实施。
- Dev：始终干净，不修改；阶段A固定源为上表b5cf006。
- embedded：AI_CONTEXT及未跟踪连续绘画诊断任务属历史诊断文档独立交付；核对run-02索引可读及44个相对链接全部存在。任务已有F1–F3完成记录，文首“待执行”修正为诊断完成待独立复核，保持人工/归因限制。Task02既有diff只是行尾空格，在完整备份后清除，恢复与HEAD无差异，不纳入提交。拟提交仅AI_CONTEXT和诊断任务两文件；不混入内核或新包来源。
- ADA：page.ts、panel.ts、drawing-performance-window.mjs、未跟踪panel-layout.self-test.ts及AI_CONTEXT、DEV_LOG、UI_GUIDE、未跟踪面板任务共8文件属Owner现有新UI的独立交付。DrawingNodeCard/NodeView/360尺寸等前段代码已经在HEAD内，本次diff仅后续面板纠正及测试记录，不重复宣称新增节点实现。现有新UI保留在原目标分支；本阶段只追加任务中的范围/验证/未通过状态，不改业务实现。拟按这8文件单独提交，先独立review，再由主代理本地提交；随后才更新包。

没有创建隔离旧UI工作树：原目标分支在dirty通过独立review后独立提交冻结，阶段C继续在同一目标分支落地新包。固定包仍为本任务§2旧包；旧包及旧ASAR保留作来源/回退参考，不能证明新组合已验收。若review发现阻断项，先修本阶段并复审，不替换成旧UI绕过目标。

### 当前源码与自动验证

核对面板仍使用单一mountPanel、原saveAndCapture及RPC生成/Results/addResource适配；新增来源弹层、外部/Escape关闭与destroy监听释放均在ADA面板owner内，不改WP vendor。诊断脚本`--ui-review`显式跳过长opacity scrub，完整路径原断言保留。旧纠正布局实窗performance.json可读且errors为空，仅作为历史证据，不升格为本轮窗口验收。

本轮实际重跑（ADA目标工作树）：

- 六个self-test实际cwd为 `D:/00_Projects_WSY/AI/Codex_Projects/auto_design_Agent/apps/web`（不是ADA仓库根目录）。在该cwd依次执行下列命令，全部退出0；分别覆盖弹层/控件生命周期、IME与close drain、节点原身份入口、返回排空/失败、恢复11场景及输出准入/释放。

```powershell
corepack pnpm exec tsx src/editor/panel-layout.self-test.ts
corepack pnpm exec tsx src/experiments/wp-panel.self-test.ts
corepack pnpm exec tsx src/project/components/drawing-node-card.self-test.tsx
corepack pnpm exec tsx src/editor/autosave-controller.self-test.ts
corepack pnpm exec tsx src/editor/recovery.self-test.ts
corepack pnpm exec tsx src/editor/output-gate.self-test.ts
```

其余以下命令的cwd为 `D:/00_Projects_WSY/AI/Codex_Projects/auto_design_Agent`：

- `corepack pnpm --dir apps/web typecheck`退出0。
- `corepack pnpm --dir apps/web build`退出0（2283 modules，保留既有>500kB chunk提示）；仅web dist，不是生产ASAR或新WP固定包。
- `node --check scripts/drawing-performance-window.mjs`退出0。

opacity长scrub偶发多history保持**未通过/待定位**；本轮未运行此实窗用例、未修复、未判定原因，不以UI回归通过宣称一次手势一次历史已验收。最终人工体验、IME/手绘板/窄窗与新生产窗口均Pending，由Owner统一执行；阶段A/B/C自动验证尚未执行。

阶段0只准备review，无commit、merge、换包、push或发布。通过独立review后由主代理先提交以上独立范围，再进入阶段A；评审结论不能以本coder自查代替。

### 阶段0独立审查

2026-11-16 gpt-6.1-sol独立review Approved，无P1/P2。四树备份SHA/忽略、dirty范围及ADA面板生命周期已核对，reviewer独立复跑六入口通过；已补精确cwd。允许独立本地提交并进入A。opacity仍未通过，真实窗口/Owner体验Pending，不替代后续集成审查。

## 阶段A执行记录（2026-11-16，coder交独立review）

固定main第一亲为`4498e2b3cf17e1cd3925f97fe6b73971ef872b46`，固定Dev第二亲为`b5cf006f3f47e7937775a4c6f4684c1ba76e0933`；merge前main clean。普通`merge --no-commit --no-ff`，未rebase或使用整文件ours/theirs，未修改Dev/embedded/ADA。首次merge因未配置身份在操作前拒绝，随后仅命令级指定授权身份，不改git config。

### 冲突与交叉生命周期决策

- `autosave.ts`：三处条件保留main transform等待、session身份、preview/output/close保护，再增加Dev Pen草稿延期。定时恢复不结束Pen；yield及串行recovery写之前仍重检。
- `fileOps.ts`：prepareMoveOutput先验证session和拒绝未确认transform preview，再以output模式结束Pen，随后Move/text；outputRequest及close保留main等待transform完成/失败后再继续，owner token、精确快照/保存entry与revision保留。
- `editor.ts`：setTool同时保留transformPending及canEdit保护；activate/remove/目标切换先结束Pen。核对自动合并发现Dev cancelTool的canEdit保护会挡住main applying任务在切session时取消，新增独立cancelTransformTask调用，普通工具取消仍走权限与canEdit。
- AI_CONTEXT合并为main当前状态及Dev任务链接，去掉合入后已过时的Dev执行限制；DEV_LOG保留双方历史索引并新增本阶段入口。
- 已逐项核对自动合并的session/tool/paintTools/App/CanvasView、actions和Move路径：session保留transform专用owner/history准入；Canvas coalesced moveBatch保留完整压力/时间点；输入分发接管旧App快捷键，IME/控件/Modal及Pen局部history独立；min-alpha/coverage挖空与稳定GPU源仍由各原owner负责。采样Worker/容量预检/边界缓存实现未重写。

新增3个组合用例：Pen草稿恢复保存延期及显式输出仅结束一次；transform preview拒绝输出前不结束Pen；applying拒绝Dev工具切换/undo/Ctrl+J动作、切session实际终止Worker。原有pathSelection及Pen输出/PSD重开、快速取消重试、owner互斥、Modal/Pen和batch输入用例一起重跑。

### 自动验证（cwd为本main_native）

首次不限制worker的18文件联跑出现GPU fork退出超时并中断，不算通过；改为限制并发分组后：

```powershell
npm test -- tests/input tests/engine/transformThroughput.test.ts tests/engine/transformTask.test.ts tests/engine/moveSelection.test.ts tests/engine/moveSelectionReference.test.ts tests/engine/tileContentBounds.test.ts tests/engine/batchedPaint.test.ts tests/engine/native.test.ts tests/engine/access.test.ts --maxWorkers=2
npm test -- tests/gpu/projectivePreview.test.ts tests/gpu/transformPreview.test.ts tests/gpu/moveOutput.test.ts tests/gpu/floatingSelection.test.ts --maxWorkers=1
npm run build
```

前两组分别14文件328项、4文件62项通过（合计390，含新增3项）；typecheck、Vite renderer及Electron main/preload build退出0。保留现有browser externalization/large chunk提示，未生成安装器。transformThroughput继续使用固定`tests/reference/transform-b01dcb7` oracle，不把当前实现作为独立参考。另一次输入基线215项通过在新增用例前，不重复累计。

真实窗口、统一4K显示/吞吐性能对照、Ctrl+J/路径三键/Pen修饰键/透明Move/Enter取消重试保存重开人工体验、真实IME/压感/设备仍Pending；按Owner补充授权由Owner最终统一执行。自动像素与生命周期回归不能证明这些体验。既有R4延期及opacity未通过状态不变。不启动用户窗口、不推进embedded/ADA、不推送或发布。coder自查不能替代本次独立review，待独立审查无阻断后方可进入B。

GPU串行默认后端40.52秒通过；读取完成缓冲前额外发起的显式`$env:CELENNE_GPU_BACKEND='d3d12'`同组37.05秒再次通过，不重复累计。首次并发退出超时未确定根因，不以推测归因；分组覆盖全部要求。最终61个相关相对链接存在，相关文档UTF-8无BOM，git diff --check通过；清除Dev新增fixture末尾多余空行以满足检查。

### 阶段A独立审查

gpt-6.1-sol独立review Approved，核对双亲冲突及session/Canvas/Pen/Move自动合并，无有证据P1/P2。独立重跑7文件281项通过（Pen/pathSelection/transformTask/listeners/batchedPaint/moveSelection/transformThroughput），diff检查通过；允许进入B。窗口/性能/Owner体验继续Pending，首次GPU退出超时未归因。

### A1：通用局部输入目标兼容（实施范围）

阶段B发现新输入安装器固定window，不能保持既有embedded keyboardTarget/ShadowRoot边界。按通用修复先main规则，在main增加可选EventTarget（默认window），从composedPath识别原始文本/IME目标，保留window blur；增加ShadowRoot/局部按键、文本Ctrl+S与IME、dispose和外部宿主隔离回归。仅main实现并本地提交、独立review后单向同步；不修改embedded。

A1实现：两安装器增加`target: EventTarget = window`；keydown/up及capture保存/IME、focusin监听同一target，window blur保留。统一`inputEventTarget`读取composedPath，composition WeakSet与isComposing使用相同原始目标，避免shadow host与文本目标身份分裂。相邻embedded候选只读参考，未写入。

A1验证：`npm test -- tests/input --maxWorkers=2`，7文件223项通过；补充keyup工具/文本/dispose用例后，`npm test -- tests/input/scopedDispatch.test.ts --maxWorkers=1` 7项通过，最终覆盖224个不同输入用例（不重复累计）。首轮新增文本保存测试2项失败系测试替身注册遗漏Ctrl+S默认声明，补齐声明后通过，非实现缺陷。`npm run build`完整typecheck/renderer/Electron退出0，保留已有externalization与chunk提示。新增7项覆盖局部Element与ShadowRoot外部宿主不抢键、dispose、默认window与shadow文本Ctrl+S/repeat/stopPropagation、composition原始身份、keyup文本保护、blur/focus held清理。真实窗口/Owner体验仍Pending；独立A1 review待执行，不推进B。


## 阶段B执行记录（2026-11-16，coder交独立review）

开工embedded为clean `326b4d7ad4088ea270d7b5ab5a0db2a150e43c8a`，固定已审main为`45771146a210fa583df988f8d27f327fc7da65f4`。普通merge形成`cf4edf8f7e0f067bf2510c04973c8c9dabd7d1d7`，双亲为上述embedded/main，未使用整文件ours/theirs。冲突为README、AI_CONTEXT、DEV_LOG、App、CanvasView及Menu：保留embedded入口/portal/keyboard surface，采用main新dispatch、Pen/Modal/batch及held pan；移除已被替换的旧global工具按键handler。文档保留双方任务索引及历史包来源，AI_CONTEXT收为当前简短状态。

Direct的输入作用域接线需要通用接口，已先报main，由main实施A1 `5924a6dd6deccf4d8239312e13267be53b255624`；主代理确认A1独立Approved（2文件76项独立通过）后才普通merge该main提交。最终generic inputContext/inputDispatch与A1源完全一致，App只调用既有keyboardTarget传给安装器。首个merge中App无参是等待A1的中间态，未构建交付包；最终交审以两次merge后的组合为准，不把嵌入候选当作generic来源。

### embedded owner适配

- busy同时检查Pen owner、transformPending及原pointer/key/text/mode；UI historyRev监听使Pen草稿开始/结束可通知宿主。Pen松开后仍私有持有草稿，后台saveBackground/captureNative延期而不结束工具。
- 显式native save/generation/composite先占唯一output槽，等待原transform成功，再prepareMoveOutput结束Pen/Move/text并seal历史、取稳定快照。取消/失败明确false或reject，保留preview，不输出半成品；close复用main等待逻辑，destroy仍拒绝活动会话。
- native短COW、composite及addResource使用独立edit-protection token，只释放自己的保护；原codec/checkpoint worker、独占native transfer、多消费者generation PNG、ICC/DPI、不可变entry和未跟踪mutation防御保留。
- native上限有限接纳三条path转换Action；layer.copyContext仍经原Action/access及其实际子动作准入，Pen与直接工具入口用原tool/feature gate。visibility不授予执行，codec不依赖产品策略。无port/native/policy破坏变化，仍3/1/1。
- 未改ADA、750ms/5s调度或10分钟恢复时钟，不引入Profile/Artifact/Results。返回仍由宿主先排空native再以独立checkpoint preview worker异步派生；WP没有新增renew API。

### 新增交叉测试与验证

新增`tests/engine/embeddedIntegration.test.ts`五项，使用实际PenTool和TransformWorkerEngine（受控Worker传输/延迟），覆盖松开后的Pen延期及结束通知、生成仅结束一次、applying输出独占/等待与旧保存回执、新编辑保持dirty、取消/重试/close、destroy拒绝、有限路径策略及composite owner释放。将两embedded实现文件临时替回开工版本（finally恢复）后真实复现4失败/1通过，另有旧实现立即拒绝等待输出导致1条未接回执错误；恢复修复后全部通过。该红灯只用于定位兼容差异，不计为通过。

WP的generation、binding、原transform Promise及输出operation/checkpoint在同编辑实例轮询/在途保存中保持；测试没有伪造WP内Profile字段。**真实同Profile连接续期（Pen、applying、保存中原请求身份）是ADA owner阶段C必测，B端口测试不替代该项。**

实际cwd均为`D:/00_Projects_WSY/AI/Codex_Projects/WebPainter`：

```powershell
npm test -- tests/engine/embeddedIntegration.test.ts tests/input tests/engine/embeddedAutosave.test.ts tests/engine/embeddedNative.test.ts tests/engine/embeddedLifecycle.test.ts tests/engine/embeddedRpc.test.ts tests/engine/transformTask.test.ts tests/engine/access.test.ts --maxWorkers=2
npm test -- tests/engine/embeddedIntegration.test.ts tests/engine/native.test.ts tests/engine/moveSelection.test.ts tests/engine/moveSelectionReference.test.ts tests/engine/tileContentBounds.test.ts tests/engine/batchedPaint.test.ts tests/engine/transformThroughput.test.ts tests/engine/embeddedPerformance.test.ts tests/engine/checkpointTransfer.test.ts --maxWorkers=2
npm test -- tests/gpu/projectivePreview.test.ts tests/gpu/transformPreview.test.ts tests/gpu/moveOutput.test.ts tests/gpu/floatingSelection.test.ts --maxWorkers=1
npm test -- tests/input tests/engine/embeddedIntegration.test.ts tests/engine/embeddedAutosave.test.ts tests/engine/embeddedNative.test.ts tests/engine/embeddedLifecycle.test.ts tests/engine/embeddedRpc.test.ts tests/engine/checkpointTransfer.test.ts --maxWorkers=2
npm run typecheck
npx vite build --config vite.embedded.config.ts
```

前3组分别13文件289项（第五项新增前）、8通过文件82项及1个opt-in性能诊断跳过、GPU4文件62项通过；跳过因未提供隔离fixture，不算性能验收。最后一组为A1单向合入后的相关最终复验，13文件263项通过，不重复累计。typecheck及embedded Vite编译通过，保留原browser externalization提示；transformWorker及checkpoint worker资源均生成、client预览仍引用该原checkpoint worker。只运行Vite编译验证，**未运行build-embedded.mjs，未生成native.mjs/manifest或可交付固定包**；当前dist-embedded是验证临时输出，不供ADA消费。

真实窗口、4K性能对照、生产iframe实际Worker加载、IME/压感/人工体验仍Pending，由Owner最终统一验收。R4延期及既有opacity长scrub多history未通过不变。待B独立review无P1/P2后才从明确clean源运行build-embedded、校验完整mainBase/embeddedCommit/sourceHash/bundleHash/资源SHA；旧包完整保留。不推送、不发布、不推进C。

### 阶段B独立审查

gpt-6.1-sol独立review Approved（df3a496），核对双亲及main通用输入一致、嵌入生命周期和5交叉用例，无新增P1/P2。独立主组297项、补充53项通过，1性能诊断跳过；typecheck/diff通过。允许clean源构建固定包，Profile transport renew留C验证；窗口/Owner体验Pending。
