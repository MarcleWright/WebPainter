# C · 返回后 WP 保持待命

[父任务](2026-11-18_01_drawing-board-workflow-and-open-performance.md) · [执行台账](2026-11-18_01_execution-loop.md)

## 目标

将 WP 实例寿命与画板文档寿命分开。正常返回 ADA 释放文档，保留一个隐藏的空 WP。下次打开已有画板或新建时复用同一实例。编辑中的正常输入、无感保存、底部悬浮面板和关闭失败时的草稿保护遵守原合同。

## 设计合同

- ADA DrawingEditorController 继续拥有唯一 iframe、宿主可见性和焦点。用已有控制器状态管理初次挂载、picker、open/close 中、空态待命和最终销毁。成功退出文档时清理 binding、保存 timers、恢复候选处理和旧生成面板。实例留在固定宿主 DOM，隐藏时 inert、不可聚焦、无选中快捷键，外层根恢复到可操作状态。返回后正常活动焦点落到原入口或现存的项目 Canvas。
- WP `requestClose` 依现有 owner 关闭并验证 `state.open=false` 后才进入待命。WP 的文档 session、engine 和 CanvasView 渲染器随关闭释放。WP instance-level 字体、色彩核心、构建资源和 RPC 通道可以与空态同寿命。同个实例只允许当前 picker 或当前文档操作。重新打开建立新的 binding 和 generation。
- ADA page 的生成面板随文档绑定生灭，旧面板的等待任务先按现有离开语义结算。失败时恢复当前面板。复用通道不复用旧 panel owner，迟到的结果、保存和错误回调只允许属于仍有效的 binding。preview 派生任务遵循原正式版本和工作区检查。
- 待命限定为当前服务、账号会话、Profile、实例和项目。实际离开、切换账号或项目销毁旧 iframe。同 Profile／同账号续期保留原规则。处于授权锁定时的编辑文档继续按已有草稿保护路径，而空的 picker 或待命实例可销毁。刷新页面由当前文档 beforeunload 合同处理。
- A 的确认后返回会撤销自动激活。关闭失败留在原文档。对于已确认且在途的 open，先加入其关闭流程，再决定待命或销毁。终止操作和重复返回有共同结论，不能留下隐藏的打开文档。

## 工作区离开与通道隔离

- 跨项目先通过 ProjectSessionCommandBinding／SessionProductCoordinator 实际激活边界等待画板离开，覆盖项目选择、跨项目 Session、注册后激活和移除后的后备选择。选择同一项目的 Session 不销毁空 WP。复用 DesktopProjectDirectory 已有的来源 quiescence，且能观察其阻止结果。画板无法关闭时不应仍然切换。实际卸载需撤销旧 owner，并确保晚挂载的 iframe 被销毁。强制卸载须明确收束权限和草稿路径，不能绕开既有正常离开保护。
- 当前项目归档或删除前先通过同一画板离开合同，管理命令写入之前核查其收敛，包括无后备项目直接进入 landing 的路径。失败保持当前草稿并阻止归档／删除请求。
- 离开开始时由原项目导航 owner 阻止新 picker/open。保持阻止直到目标项目激活确认、导航失败或被后续导航明确取代。检查精确旧项目与当前导航票据，旧 finally 不能解除新请求的阻止。测试目标激活被延迟时旧项目无法重开，以及当前项目归档／删除的关闭失败。
- 使用 `WorkspacePortalProvider` 所属源的固定 DOM 容器或等效明确 owner。iframe 不移到新来源，隐藏源时其 overlay 一起不可见。背景 inert/aria 应施加于内容兄弟节点，避免隔绝 WP 自身的焦点。Web 也接入稳定可清理的宿主节点。
- 复用 MessageChannel 时，为 dirty/error/confirm 和生成面板请求／回执绑定 document lease。宿主核对当前 binding + generation，WP 未发文档代际前只接受明确的 mount/picker 工作。迟到闭合状态不能覆盖新会话。关闭成功撤销旧 lease 并拆旧面板，失败保持原 lease 和原面板。不要以 iframe nonce 单独证明文档身份。
- 普通 close 完成应释放输入 tracker、过期对话框／进度、当前文档 clipboard 或工具捕获状态。应用级字体和 CSS 允许待命。清理只针对已成功关闭的文档，不取代保存截止点，也不在 standalone 中改变用户行为。沿用 A 的可取消打开决策，调用真实离开时应结算当前恢复提示而无需处分恢复候选。

## 最小验收

- 真实 Web 窗口用同一画板和另一画板分别开关三次，验证 iframe DOM／消息握手只一次，文档 binding/generation 每次切换。每次返回隐藏态无画布、自动保存或旧面板，ADA 的焦点及键盘输入恢复。
- 真实入口覆盖返回中保存与关闭失败、连续 Return、返回后新建、慢打开后返回、真实项目／账号切换、续期和授权锁。记录资源释放及第二次打开省下的启动时间，另列下载与首笔可画。
- 保留 A 的同帧确认与开已有板直接路径，覆盖面板关闭失败恢复、旧异步消息丢弃、隐藏来源无全局 overlay、关闭后新文档的指针／按键状态，并验证真实窗口／项目切换时 close 失败会阻止激活。源图导入在 B 验证后走同一个已注册的打开入口。

## 状态

独立首轮设计变化请求覆盖 C-D1 真实离开路径、C-D2 复用通道 stale 请求、C-D3 文档资源清理和 C-D4 恢复提示退出。Planner 接受调整。复审 64647BD0…291D0E 已关闭 D2–D4，D1a 当前项目归档／删除前置和 D1b 导航期间旧项目二次打开仍需明确。Planner 接受两项并补合同。A 的 picker 与宿主持久化合同为实施依赖。

## C 实现与独立复审

设计独立 Approved，候选 A4E9B9FD…7A81D4。WP 的可复用 composition 关闭清理与主线 renderer/光标、Flatten 迟到确认按所有权分别通过独立核查。WP main 928e7f8／0382d4c，embedded 清理 b72279e 及合入后的固定源码 9b6aaf5，port 4／native 1，包 01006e09…318f。原独立版窗口和非可复用嵌入入口保持原路径。

ADA 在 `auto_design_Agent_drawing_standby` 以 56894feb 实施。独立首轮候选 84738f1f…06bc8 为 Changes Requested。Planner 接受 C-I2 并发确认后 surface inert 滞留与 C-I3 跨项目新 Session 在画板关闭失败后管理 busy 滞留，已完成原入口回归。第二轮独立 Approved，代码 seal 602a2080…2169。测试覆盖同源同项目复用、授权锁定、关闭失败、文档级 RPC、Desktop 切源及实际项目导航 owner。

固定包真实 Chrome 首次探针保留同一 iframe 和 Document 交替打开两个画板及新建选择器。关闭后隐藏、inert、无旧文档和生成面板，焦点回到 ADA。真实绘画保存后以原 native ID 和 hash 重开。正常切换另一项目断开旧 iframe，并在下一次打开建立新实例。开发 Vite 冷 picker 单次约 1.21 秒，同项目热 picker 数次约 0.09–0.18 秒，跨项目资源已热的新实例约 0.32 秒，仅作为状态分解诊断，不作正式性能结论。

证据在 C 独立工作树 `.packaging/drawing-board-stage-c`。真实 Desktop 原生焦点/IME 与 Owner 实际感受仍待验。
