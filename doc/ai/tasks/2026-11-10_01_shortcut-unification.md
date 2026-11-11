# Task 01: 快捷键统一与 Photoshop 常用操作兼容

## Status

Implemented / 原实现审查 Changes Requested；Owner 限定的 R1、R2、R3 已按顺序分别本地修复并补回归，待独立复审。R4 明确延期，未修复。2026-11-10 方案 Approved 与 P1–P5 历史交接证据保留，当前修复范围、hash、检查及限制见文末「限定修复授权与验收」。R1 的 P1 为缺陷优先级，不是原实施阶段 P1。未推送、合并或发布，G5 人工/真实 Windows/中文 IME/Owner 验收仍 Pending，不据三项修复宣称整体实现验收通过。

工作目录 `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter_Dev`, 分支 `codex/dev`, 核对基线 `59f81b5`。实施前检查实际 HEAD/工作区; 不修改 main_native、embedded 或相邻 ADA, 不带入其他工作区未提交的启动脚本。

## Task Brief And Goal

以 Photoshop 常用操作习惯为目标, PhotoCraft v0.20.2 为主要源码参考, 整理 WP 已有输入层。复用 Action/keymap/工具与命令历史, 解决工具抢键、工具重绑定失效和配置/显示/实际分发不一致, 补已有功能的常用绑定。目标是输入规则可预测、一次按键只执行一个合适操作; 不重写编辑器或承诺完整 Photoshop 兼容。

## Evidence And Reference

- 已核对: `actions.ts` 已注册 image.adjust 的曲线/色相饱和度/色阶/色彩平衡及真实对话框/算法, 但无 Ctrl+M/U/L/B 默认键。前景/背景填充已有 Alt/Ctrl+Backspace, 缺 Delete 别名; Ctrl+J 绑定 layer.duplicate, 选区复制另有 layer.viaCopy。
- 已核对: App 先调用当前工具 keyDown, 后查询 keymap; PaintTool 不排除 Ctrl/Alt 就消费方括号。隔离执行实际方法确认 Ctrl+] 对应 layer.arrange.forward, 却被画笔消费并使 size 40 -> 45。不是完整窗口人工验收。
- 已核对: 工具显式绑定进入 App 后仍优先使用 groupTool, 无法保证独立绑定 pencil 时选中 pencil。D/X、笔刷/数字/Tab 等部分规则散落 App、PaintTool、CanvasView; 冲突检查看不到全部消费路径。
- 现有菜单读取 keymap.bindingsFor、公共命令走 actions.run、用户覆盖可持久化并导入导出。保留这些基础, 不另建第二套命令注册表。
- PhotoCraft 固定 tag v0.20.2 / commit `7c12f647150f8e7b2e07718f7993b1fcaa57fefe`, 仅源码核对, 未运行 Rust 测试, 不声称该版本与 Photoshop 每项完全一致。

固定参考:

- [有效绑定/焦点/命令分发](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/input/shortcut_dispatch.rs)
- [上下文处理及按键匹配](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/input/shortcuts.rs)
- [配置、备用键与临时工具定义](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/prefs/shortcuts.rs)
- [工具独立绑定/默认分组](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/input/tool_shortcuts.rs)
- [菜单与重绑定回归](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/input/shortcut_dispatch/tests.rs)

## Change Contract

### Target flow / Ownership

```text
Action defaults + Tool definitions + User overrides/alternates
                         |
                         v
                 Effective bindings
                  /      |       \
            menu hints  settings  dispatcher
                                     |
             focus / IME / modal / gesture ownership
                                     |
                    busy + target edit protection
                                     |
                 command / exact tool / held tool
                                     |
                  existing Action / Tool / History
```

- Action ID 与现有业务函数继续拥有操作语义; keymap 拥有有效绑定、别名和冲突结果; 分发器拥有事件优先级/消费; 工具拥有正在进行的交互, 但只认领明确的键和修饰键。显示和冲突查询必须反映真正能分发的绑定。
- 可按职责增加少量输入匹配、上下文分发、临时工具模块, 不以文件数量为目标, 不复制 PhotoCraft 的整个 UI/引擎命令框架。复用 `shortcuts.ts`、`actions.ts`、App/CanvasView、现有设置与工具入口。
- 统一入口指统一输入归属和消费规则, 不要求把文字、Modal 等局部监听搬进一个大函数。局部处理器与全局分发共享 IME、事件消费和目标保护约束; 认领事件只决定 owner, 不授予修改权限。执行任何会修改内容、历史或临时编辑状态的处理前, 均检查目标 canEdit/access。
- 本轮不扩展为编辑器内核重构: 不移植 PhotoCraft 多套命令目录、原生 IME 桥接或通用异步队列, 不新增长按任意工具字母切换及临时缩放功能。Space 临时平移与现有修饰键行为按本任务完善生命周期。
- 首版以 Windows Electron 为必验平台; 浏览器用隔离事件检查, 不声称 macOS/所有键盘布局已人工通过。Ctrl/Meta、符号与物理键的规则须显式, 不简单把整套输入统一改为 e.code。

### Must preserve / Must not do

- 保留稳定 Action ID、宏/插件入口、现有算法、GPU 默认选路、一次拖动一次撤销、保存/关闭保护与 access policy。用户移除的绑定不因新增默认键复活。
- 不单独为键盘重写业务逻辑或新建重复命令总线, 不引入 Rust/WASM/新快捷键依赖, 不改文件格式、图像算法、品牌或 ADA。
- 不把 keymap 无条件移到所有工具前面; 路径点编辑、文字、变换等仍能消费自己的确认/取消/局部撤销。也不允许整个工具先消费任意同名按键。
- 新路径接入后删除对应旧硬编码消费路径, 不保留两路执行或用功能开关长期切换。参数型数字透明度可保留一个共享处理器, 不生成 100 条重复 Action。

## Frozen Input And Lifecycle Rules

| 上下文/情况 | 契约 |
| --- | --- |
| 输入框、textarea、contenteditable、IME | 文字输入与剪贴板、全选、文字撤销、箭头、Delete/Backspace 归编辑控件。composition/Process/Dead 等组合输入优先于局部提交/取消及全局快捷键; 候选 Enter/Esc 不提交文字会话、不确认/关闭 Modal。非组合输入时 Ctrl+Enter/Esc 保持现有文字提交语义。首版文本焦点文件命令白名单仅 file.save, 通过其有效绑定触发; 不穿过模态限制, 不泛化放行所有 Ctrl 组合 |
| 对话框/菜单/控件 | 优先本地 Enter/Esc/导航和曲线点 Delete; 不穿透执行清空图层等命令。对话框仅允许不改变文档的缩放/适配视图白名单, 不转发变换/选区/文档切换命令 |
| 拖动/笔画/变换/路径 | 正在进行的交互优先处理自己的明确按键; 其余命令遵守既有 busy 与提交/取消契约, 不在一笔中间插入全局 undo。一个事件只能被一条路径消费 |
| 保存/关闭保护或 access 禁用 | 不通过快捷键绕过目标会话 canEdit/access; 拒绝时给出可理解原因, 不修改内容、历史或临时编辑上下文。非目标文档仍按自身状态使用 |
| 工具绑定 | 默认 B 等共享键保留组记忆和 Shift 轮换; 用户给 pencil 指定独立键时精确选择 pencil。轮换只在有效、允许的工具间进行, 不按旧默认表绕过用户重绑定 |
| held 工具与失焦 | Space 用 keydown/keyup 生命周期, 同一按住不重复进入。松键与结束拖动分开: pointer 释放仍交给发起交互的 owner, 再退出临时模式。窗口失焦、切文档、进入文字/对话框时使 held 状态失效; 不向新目标转发旧事件, 不通过恢复工具误提交/取消作品编辑。详见下方生命周期 |
| 重复键和异步入口 | 箭头/笔刷步进可重复; 文件对话框等一次触发型命令不因 key repeat 重复打开。事件顺序处理, 已消费不二次执行; 延后动作绑定原目标 session/doc/交互身份, 目标改变后取消, 不作用于新的 active 文档 |
| 配置导入与冲突 | 主键/备用键与用户覆盖具有确定优先级。导入先校验再整体替换; 非法形状、非字符串键、冲突或系统保留键应明确拒绝且保留旧配置。旧 JSON 可兼容读取, 无需通用迁移框架; UI 重分配明确释放旧归属, 默认工具组共享键属于显式例外 |

### Input ownership and consumption

1. 先识别事件目标、composition、局部控件/菜单/模态及当前交互。文字编辑器和 Modal 自己的监听也必须执行组合输入保护; 不能只依赖 window 监听。组合结束后正常 Enter/Esc 可执行一次, 不重放候选确认事件。
2. 已由局部 owner 消费的事件不得再次派发; 全局不能提前抢走文本编辑与控件导航。明确白名单的 file.save 需要协调现有 stopPropagation 路径, 复用保存入口完成文字提交与目标保护, 不另写保存逻辑。
3. 工具仅认领清单中的状态与精确修饰键组合。修改前检查目标保护, 拒绝也终止该事件, 不回退到其他命令/工具。保护期间不能借 setTool、deactivate 或局部 Esc 丢掉编辑上下文。
4. 每个后续事件重新检查 owner; 打开/关闭对话框、菜单或文字编辑后, 不沿用旧上下文。局部延迟确认还须验证对话框/会话身份, 已关闭或被替换则取消。不为此建立通用命令队列。

### Effective binding and conflict decisions

有效结果保留来源和用途: command、exact tool、default tool group、held tool; 主键为绑定数组第一项, 其余为备用键。菜单、提示、设置、冲突查询及派发读取同一解析结果, 不将被覆盖的默认键显示为仍有效。

| 情况 | 确定规则 |
| --- | --- |
| 覆盖与优先级 | 某 ID 有用户数组时整体替代该 ID 的默认主键和备用键, 空数组表示全部移除。不同 ID 的用户绑定优先于默认绑定; 同来源默认主键优先于默认备用键。同级冲突不得依赖注册顺序静默选择, 除默认工具组共享外须拒绝/修正; 用户主键与另一用户备用键冲突也拒绝 |
| UI 重分配 | 先展示所有受影响归属, 一次原子更新释放旧归属并赋给新归属。默认共享 B 被命令接管时释放全部相关组成员的 B, 不只释放 Map 的第一个工具; 由此不再派生 Shift+B 轮换。保留这些工具的其他独立键 |
| 默认组与精确工具 | 只有未被用户覆盖、仍拥有该默认键且 access 允许的工具参加默认组记忆与轮换; 组记忆失效则选首个允许成员。显式工具绑定精确选中该工具, 即使显式设回 B 也不自动变回默认组语义; Reset 才恢复默认资格 |
| Shift 轮换 | 作为默认组键派生用途进入有效绑定和冲突查询。显式绑定 Shift+B 优先并抑制该轮换入口, 不影响普通 B; 移除显式归属后按当前组状态重新解析 |
| 数字与 held | 数字透明度/流量由共享处理器处理, 将数字及 Shift+数字用途纳入冲突查询, 不生成 100 条 Action。显式命令可接管相应数字键并抑制该默认处理。held 键与普通命令共同参与冲突检查, 同一组合不能同时启动临时工具和执行命令 |
| 新默认键、重置与导入 | 新增备用键不得追加进已有覆盖数组。单项 Reset 若会冲突则保留旧配置并要求显式重分配; Reset All 恢复经过校验的默认集合。导入允许用户绑定覆盖默认候选, 但拒绝相互冲突的用户绑定及非法/保留键; 整体校验成功后才持久化和通知。P1 列出 Windows 首版有限保留键清单, 不承诺跨平台通用保留键库 |

### Held tool and deferred target lifecycle

- Space 进入临时平移时记录原工具、目标 session/doc、交互身份和触发键; repeat 不重新进入。恢复的是临时覆盖状态, 不调用会 cancel/deactivate 的普通工具切换来模拟恢复, 不改变默认组记忆。
- 原工具正在笔画/拖动时, Space 不接管该 pointer 序列; 未开始拖动时可进入临时平移。平移已开始后即使松键, 保持本次 pointer owner 到 up/cancel 收尾, 然后退出; 不让原工具接收这次尾事件。
- 失焦/切文档/模态出现时立即停止新的临时输入, 清理 held 键与平移捕获状态; 如有临时平移, 仅终止其视图交互, 不提交/取消底下的作品编辑。迟到 keyup/pointerup 不作用于新文档。用户已明确选择其他工具时, 不再恢复旧工具。
- 数字延迟应用记录 session、doc、layer/编辑目标、工具及参数类型; 期间切层、切文档、切工具、进入文字/模态则取消待应用值及两位数缓存。执行时再次验证身份与 canEdit/access。旧动作拒绝或失效不产生历史, 不修改当前 active 的替代目标。

### Ctrl+J command ownership

- 在现有 Action 注册表增加薄入口 `layer.copyContext`（菜单文案“复制选区或图层”）, 默认 Ctrl+J, 设置与菜单显示同一 ID 的有效绑定。入口只选择并调用现有命令, 不实现新像素算法或另建命令总线。`layer.duplicate`、`layer.viaCopy`、`layer.viaCut` 的直接调用及既有宏语义保持不变; Duplicate Layer 不再声明新的默认 Ctrl+J。
- 单个像素层且有非空像素选区时选择 `layer.viaCopy`; 无选区或其他图层类型选择 `layer.duplicate`。多层选中本轮沿用整层复制, 不支持多层选区提取。空白/不相交选区按 viaCopy 的现有结果返回, 不降级整层复制; 不新增取消选区行为。
- 入口及最终命令均检查 access/enabled 和目标可编辑性, 最终命令禁用时给出原因并终止, 不退回另一分支。菜单点击与快捷键走同一入口; 历史/宏继续使用最终业务命令既有记录, 不额外记录一层重复操作。
- 默认切换只用于无相关旧用户覆盖且 Ctrl+J 未被用户占用的配置。若旧配置包含 `layer.duplicate` 或 `layer.viaCopy` 的覆盖（包括空数组）, 则保留旧覆盖并将新入口初始化为无绑定, 不迁移/复活旧键; 用户可主动绑定新入口或 Reset All。该一次性兼容结果须持久化, 重启不重复改变配置。
- 改绑新入口到 F6 后上下文行为随 F6 迁移; Ctrl+J 释放后可分给其他命令。禁止在 dispatcher 根据物理 J 特判复制行为。

## Ordered Phases

按用户授权 P1 -> P5 串行执行, 每阶段完成门槛后再进入下一阶段, 无需逐阶段重复请求执行或提交许可。各阶段分别本地提交, 不将多个阶段合成一个提交; 在本任务记录 hash/实际范围/检查/未验收项。仅暂存已核对属于本阶段的改动, 保留无关工作区改动; 阶段 hash 可在下一阶段或最终交接记录提交中补记。不推送、不合并至 main/embedded、不发布, 最终交独立实现复审。不自动建立执行循环或另拆大量任务文件。常规模块拆分与测试实现由 coder 决定; 遇到改变产品语义的未列例外或必须扩大范围的阻断, 先记录并交 Owner 决定。

| 阶段 | 范围与交付 | 进入下一阶段的门槛 |
| --- | --- | --- |
| P1 兼容清单与基线 | 对已注册 Action/工具及散落监听建立有限清单: 默认/备用/派生/held 键、目标、焦点、是否已实现/占位/未绑定; 包含文字、Modal 及捕获监听。落实本方案决策表、有限保留键清单与新复制入口兼容样例, 记录 Ctrl+] 和工具重绑定基线, 建立可重用事件/会话 fixture | 清单指向真实源码, 每个下述阶段子用例有 owner 和目标阶段; 不提交要求后续阶段才能通过的必失败测试, 新增算法需求留后续 |
| P2 有效绑定与分发 | 整理归一化、配置校验、覆盖优先级和匹配; 收敛 App 分发并协调局部文字/Modal 监听的 IME、消费与 file.save 白名单。为 P3 的派生/数字/held 用途提供统一冲突表示 | G2 通过及 P-TYPE; 验证已有命令, 不要求 P3 的工具迁移或 P4 新默认键提前完成 |
| P3 迁移特殊处理 | 将 D/X、笔刷增减/硬度、数字透明度/流量、Tab 等公共操作迁入一致命令或共享处理器; 工具只留局部交互。统一默认工具组/显式选择及 Space 生命周期, 删除被取代的处理 | G3 通过及 P-TYPE/P-MOVE; 原键释放、无双触发, 延后动作和临时交互不改错目标 |
| P4 常用绑定和语义 | 补下表绑定和填充别名, 接入 layer.copyContext 及其旧配置兼容, 保留原命令 ID 和宏语义; 命令不可用时说明原因 | G4 通过及 P-TYPE; 调整预览/确认/取消、选区 coverage、历史与菜单一致; 不通过新建调整层冒充像素调整 |
| P5 集成验证与收口 | 正常生产入口与配置持久化检查, 回归保存保护与输入焦点, 完成有限人工操作; 文档稳定规则归 design/engineering, 本任务记录阶段证据 | P-BUILD/P-DOC 与下述相关自动检查通过; 人工结果逐项记实, 缺项保持 Pending, 不以 build 通过代替验收 |

### P4 首批绑定范围

| 按键 | 行为和边界 |
| --- | --- |
| Ctrl+U/M/L/B | 打开当前像素图层的 Hue/Saturation、Curves、Levels、Color Balance 现有对话框; 保持预览/取消/确认/历史, 不额外新建调整层; 不支持图层类型明确禁用 |
| Alt+Backspace / Alt+Delete | 现有前景色填充命令, 遵守像素/蒙版目标、选区与锁定语义 |
| Ctrl+Backspace / Ctrl+Delete | 现有背景色填充命令, 同上; Delete/Backspace 兼容仅用于这些有效绑定, 不改变文本编辑中的词删除 |
| Shift+F5 / Shift+Backspace / Shift+Delete | 打开现有 Fill 对话框; 不在文字焦点抢占剪切/删除 |
| Ctrl+J | layer.copyContext: 单个像素层有选区走 viaCopy, 其余（含多层选择）走 duplicate; 保留柔边透明度和旧命令语义。默认键适用条件及拒绝规则见上方命令归属契约 |
| Shift+Ctrl+J | 保持现有 Layer via Cut, 验证选区和撤销未退化 |

P1 可列出其他缺少的 Photoshop 默认键, 但不据此自动加入本轮; 本轮重心为分发正确与上述高频行为。Mac/特殊布局、更多对话框细节及缺失图像功能明确作为后续兼容项。

## Acceptance Scenarios

| ID | 可观察结果 |
| --- | --- |
| K1 命令与别名 | Ctrl+U/M/L/B 打开正确窗口; 预览/取消不留下正式修改或额外历史, 有效确认恰好一条历史。填充主键/备用键输出与菜单一致, 一次有效修改一次历史 |
| K2 事件归一化 | Ctrl/Alt/Shift 精确匹配; 方括号、等号/加号及 Delete 别名按约定工作; Ctrl+] 在画笔下前移图层, 不改变笔刷尺寸 |
| K3 工具重绑定 | 给 pencil 独立键, brush 是最近组工具时仍选择 pencil; 原键按移除/共享规则处理, Shift 轮换不调用旧的绑定; 菜单/工具提示同步 |
| K4 配置 | 重绑定/重分配/解除/重置/导入导出并重启后有效; 旧覆盖和空数组保留; 非法 JSON 内容或冲突拒绝后旧配置可继续使用, 不发生半写入 |
| K5 焦点 | 同一按键在画布、文字编辑、数值输入、对话框、曲线控件中命中正确 owner; 文字 Ctrl+A/C/V/Z/Delete 保留, file.save 有效键只保存一次。composition Enter/Esc 不提交文字、不确认/关闭 Modal, 不切工具/填充; 组合结束后正常操作一次。打开对话框后的后续按键不修改背后文档 |
| K6 临时与重复 | Space 按住/松开和 repeat、Alt 等现有修饰行为正确; 拖动中松键仍由原 pointer owner 收尾, 不误落笔/提交/取消。失焦/切文档/模态清理后迟到事件不影响新目标; 显式换工具不被旧恢复覆盖; 改绑后只认新临时键 |
| K7 历史与保护 | 实际 Move/笔画/变换/路径交互的 Enter/Esc/箭头/局部 undo 维持契约; 保存/关闭忙时按键不能产生新修改或丢掉历史; disabled/access 拒绝不能绕过到另一条路径 |
| K8 Ctrl+J 与目标 | 有选区时只复制选区内容, 源层不变、柔边保留; 无选区/非像素/多层按契约复制整层; Copy/Cut 均可 undo/redo。验证新入口改绑、旧键释放、菜单一致、旧宏不变、旧覆盖/空数组不复活、最终命令拒绝不回退。数字延后动作切层/文档/工具/焦点后失效, 不修改新目标 |

### Stage gates (explicit subsets)

- **G2 / P2:** K2 的匹配单元用例（含符号和修饰键, 不含画笔 Ctrl+] 集成）; K4 的原子导入/覆盖/重置及 command/tool/held/派生冲突解析; K5 的真实文字、数值输入与 Modal 传播/IME/file.save 用例; 已有命令触发一次与 repeat 抑制。尚未迁移的数字/held 消费不计完成, 不要求 K1 新绑定通过。
- **G3 / P3:** K2 画笔 Ctrl+] 集成、K3、K6、K7, 以及 K8 数字延后目标失效部分。以实际监听验证 Shift+B、数字、Space 被重分配后原路径不再消费; 复跑受迁移影响的 K4/K5。保存保护同时覆盖普通命令、工具切换和局部 Enter/Esc, 验证文档/历史/编辑上下文均未破坏, 非目标文档仍可操作。
- **G4 / P4:** K1 与 K8 复制语义部分全部通过; 分别检查调整确认/取消、柔边 Copy/Cut undo/redo、前景/背景填充及蒙版/锁定目标, 不允许三类功能任选一类作为历史验收。补新默认键、旧配置兼容及复制入口重绑定的 K4/K5 用例。
- **G5 / P5:** 全部相关自动场景通过及 P-BUILD/P-DOC; 使用完整生产窗口完成下列人工矩阵。记录每项 Passed/Failed/Pending, 有缺项可交接但不能标记实现/人工验收完成; 方案复审与实现独立复审分开。

## Validation And Evidence

- Preset: [TESTING](../../engineering/TESTING.md) 的 P-TYPE、P-MOVE、P-BUILD、P-DOC。复用现有 moveOutput、access 与相关选区/历史检查, 只在受影响阶段运行相应检查; P-FULL 不作每阶段重复门槛。
- 定向自动: 匹配/有效表可作单元测试, 但传播与双触发测试必须挂载实际 App/CanvasView、文字控件和 Modal 的监听链, 派发 KeyboardEvent 与 composition 事件, 不能只调用抽出的 dispatcher。记录命令调用次数及实际目标/像素/历史结果; 按 G4 分别覆盖三类业务。受控延迟保存检查目标保护和非目标可编辑, 受控计时器检查数字延后动作失效。覆盖先 undo 后 save、先 save 后 undo 的调用与快照顺序（保存进行中的修改仍按 WP 保护规则拒绝）, 打开对话框后后续按键不得穿透。不得只 mock 工具/dispatcher/run 或用源码搜索证明生效。
- 人工: 执行者用隔离 profile 的当前分支生产窗口, 完成像素层 Ctrl+U/M/L/B 和填充、画笔 Ctrl+]、选区 Ctrl+J/undo、文字/数值焦点、文字与 Modal 中中文候选 Enter/Esc、变换 Enter/Esc、Space 拖动中松键/失焦及一个重绑定重启。Owner 后续按设计师使用习惯复验。无法完成逐项记 Pending, 不能宣称接近 Photoshop 已全面验收。
- 首次建立 Dev 依赖和入口时仅使用本 worktree 当前源码, 不链接业务源码到 embedded 或切走其他 worktree 分支; 不把其他启动配置/测试 profile 打进提交。

## Execution Report

已按 P1→P5 串行实施并完成对应自动门槛；人工矩阵仍 Pending，不能标记整体人工验收完成。初始三个索引文件的任务相关改动已保留并更新为实现交接状态，没有夹带其他工作区修改。PhotoCraft 仅保留既有源码参考，本轮没有 Rust 运行验收。

| 阶段 | 状态 | Commit / 自动检查 / 人工边界 |
| --- | --- | --- |
| P1 | 自动门槛 Passed | `ff6c0a1`； 清单/fixture 已建立；baseline 1/1、P-TYPE、diff --check 通过；人工 Pending |
| P2 | 自动门槛 Passed | `d8afe72`； 输入定向 9/9、P-TYPE 通过；事件链与原子配置证据见下；人工 Pending |
| P3 | 自动门槛 Passed | `ee51a5f`； 定向 51/51、P-TYPE/P-MOVE 通过；人工 Pending |
| P4 | 自动门槛 Passed | `d62c999`； 三类业务均覆盖；定向 64/64、P-TYPE 通过；人工 Pending |
| P5 | 自动收口；人工 Pending | `03ccd30`；P-INPUT 75/75、P-BUILD/生产 smoke/P-DOC 通过；不宣称 G5 人工通过 |

## Review Result

2026-11-10 初审: **Changes Requested**。阻断项为本地 IME 提交漏洞、Ctrl+J 命令归属不明、有效绑定冲突规则不完整及阶段门槛/真实事件验收缺口。

2026-11-10 修订后方案级复核: **Approved**。已补清局部/全局输入归属和目标保护、复制入口及旧配置兼容、有效绑定冲突、临时交互生命周期与 G2–G5 门槛; 未发现继续阻断实施的方案问题。此复核由参与修订的同一助手完成, 不作为另一位 reviewer 的独立审查。用户已要求更新 Approved 状态并交 coder 执行; 实现独立复审、生产窗口及 Owner 验收仍待后续证据。共享协作规则见 [AI_WORKFLOW](../AI_WORKFLOW.md)。

## Context Delta

- Keep: WP 独立命令/工具/像素与历史内核继续复用, main/embedded/ADA 不在本轮修改范围。
- Changed: codex/dev 的快捷键工作按 P1-P5 有序实施, Photoshop 习惯为目标、固定 PhotoCraft 源码为参考, 不逐键临时补丁。
- Follow-up: 缺失图像功能、首批之外兼容键及 macOS/完整布局矩阵单列, 不混入本轮。

## P1 Source inventory and gate ownership (2026-11-10)

实际基线: codex/dev / 59f81b51fa2db6f6ea0e7d31094d8015549c6ec8。初始 dirty 为 doc/README.md、doc/ai/AI_CONTEXT.md、doc/ai/DEV_LOG.md 与本任务（untracked）；入口已有内容保留，不暂存到 P1。依赖仅在本 worktree npm ci，不链接其他工作区。

| 输入族 / 状态 | 实际 owner | 后续阶段 / 场景 |
| --- | --- | --- |
| 注册命令默认键、未绑定及 comingSoon | src/app/actions.ts actionDefinitions/allActions（完整有限运行时清单）；菜单 src/app/menus.ts | P2 K2/K4、P4 K1/K8 |
| 工具默认共享键与无键工具、占位 | src/tools/toolTypes.ts TOOLS；实例 src/tools/registry.ts | P3 K3/K6 |
| 当前主键单一 map、覆盖与导入 | src/app/shortcuts.ts；设置 MiscDialogs.tsx ShortcutsDialog；菜单 Menu.tsx | P2 K4；P3 派生/held/数字 |
| 全局工具先拒绝、D/X、方括号、数字350ms、Tab、Esc、组记忆 | src/ui/App.tsx onGlobalKeyDown/handleDigit | P2 分发；P3 K2/K3/K7/K8 |
| PaintTool 方括号及数字重复消费（Ctrl+] size 40→45 的根因） | src/tools/paintTools.ts keyDown | P3 K2，删除公共处理 |
| Space 独立监听、Ctrl+Space spring zoom、pointer owner | src/ui/CanvasView.tsx spring/onPointer*/键盘 effect | P3 K6；本轮移除未纳入范围的临时 zoom 派生 |
| Move 箭头；crop/transform Enter/Esc；polyLasso Enter/Esc/Delete；pen Enter/Esc、pathSelect Delete；slice Delete | src/tools/{moveTool,cropTools,transformTool,selectionTools,penTools,sliceTool}.ts keyDown | P3 K7，精确修饰键及保护 |
| 文字 textarea stopPropagation、Ctrl+Enter/Esc，TypeTool Esc | CanvasView.tsx；src/tools/typeTool.ts | P2 K5 IME/save；P3 K7保护 |
| 数值 Enter/箭头、zoom、层重命名、颜色/历史/通道/路径输入 | src/ui/controls.tsx、App.tsx、panels/{LayersPanel,ColorPanels,DocPanels}.tsx | P2 K5，保留控件归属 |
| Modal Enter/Esc 和异步 setTimeout(onOk)；菜单导航 | src/ui/dialogs/Modal.tsx、src/ui/menu/Menu.tsx | P2 K5，组合输入和实例身份 |
| capture 监听：快捷键录制、Liquify undo/笔刷/工具 | MiscDialogs.tsx ShortcutsDialog；LiquifyDialog.tsx | P2 K5，限制当前 modal/IME |
| 曲线点删除/命令面板导航 | src/ui/dialogs/EditingDialogs.tsx 及 MiscDialogs.tsx；以 rg onKeyDown 全表核对 | P2 K5，局部拥有，不向背后文档转发 |

有限 Windows 保留键：Alt+F4、Alt+Tab、Ctrl+Alt+Delete、Ctrl+Escape、Ctrl+Shift+Escape；拒绝纯修饰键、未知修饰符和同时 Ctrl+Meta。Ctrl/Meta 在事件中映射 Ctrl（Windows Ctrl 是必验，Meta/macOS 未验）；字母使用逻辑 key，符号仅在已知 punctuation code 上取底键，Shift 数字使用 Digit code。Delete 与 Backspace 不全局等价，只由 P4 填充别名声明。

配置样例（P4）：无旧覆盖→copyContext Ctrl+J；duplicate:[] 或 viaCopy:[F6]→新增 copyContext:[] 并持久化；另一用户占 Ctrl+J→新默认被抑制；显式 copyContext:[F6]→仅 F6 调用上下文命令。旧命令 ID 和宏不变。

事件/真实 session fixture: tests/input/fixture.ts；baseline.test.ts 保证真实 brush 与 arrange 注册可复用，不提交预期失败用例。P2 负责实际传播/IME/import；P3 负责实际工具/pointer、定时目标和保护；P4 分别负责调整、填充、Copy/Cut 的像素/历史；P5 负责生产窗口/持久化及人工矩阵。各 K 子项按 G2–G5 归属，无新增图像算法。人工与独立实现审查均 Pending。

### P2 evidence

P1 commit: ff6c0a1。P2 实际范围：shortcuts 有效表来源/优先级、精确匹配、原子导入/重分配/Reset 校验，held/数字/派生用途注册；App IME/repeat；真实 Canvas 文字、数值、菜单、Modal 和 capture 组合输入保护；文字焦点仅有效 file.save 由 capture 协调 stopPropagation，仍复用 actions.run。Modal 延迟 OK 验证组件存活、当前 session 和 dialog 身份。

验证：`npm exec -- vitest run tests/input` 3 files / 9 tests Passed；`npm run typecheck` Passed。listeners.test.tsx 挂载实际 App+CanvasView/NumberField/Modal，替换仅布局/无关面板与图形 renderer；未 mock dispatcher、工具或 run。保存计数测试替换已注册 file.save 的 IO 端点；文字 session 及 Enter/Esc 为实际实现。原子导入拒绝形状/值/保留键/用户主备用冲突，保留旧配置；共享 B 全成员释放、Shift 派生、数字和 held 冲突、精确工具用途通过。P3 原路径迁移尚未计完成。

补正 P1 曲线清单：实际 src/ui/panels/AdjustmentEditors.tsx CurveEditor 只支持拖出删点，没有现成 Delete 监听；本轮验证曲线焦点 Delete 被 Modal 隔离、不清空背后图层，不虚称已有键盘删点。首版保留现有点编辑语义，不增加图像功能。生产窗口及中文输入法实操 Pending；独立实现复审 Pending。

### P3 evidence

P2 commit: d8afe72。P3 实际范围：公共 D/X、笔刷尺寸/硬度、Tab 进入原 Action 注册表；数字为唯一共享处理器，绑定原 session/doc/layer 对象、mode、编辑目标、tool/参数用途并取消旧缓存；删除 PaintTool 重复消费和 App 旧分支。App 使用 inputDispatch，局部确认/取消/删点保留精确按键归属；busy 中阻止全局 undo，Move pointer 期间也不插入箭头历史。有效 toolGroup/explicit tool/cycle 按当前覆盖与 access 解析；工具栏/flyout 读取有效键。Space 改为 heldPan 视图覆盖，不 setTool/deactivate，不引入临时 zoom；pointer up 仍交给原平移，blur/切文档/文字/modal/显式工具切换清理临时模式，迟到事件不改新目标。保存请求到快照间的输入也拒绝，避免仅快照后受保护；普通命令/工具/局部键各自检查，非目标文档可用。异步 transform 动态入口绑定原目标，改变后取消。

验证：`npm exec -- vitest run tests/input tests/engine/moveSelection.test.ts tests/gpu/moveOutput.test.ts tests/engine/access.test.ts`：6 files / 51 tests Passed；P-TYPE Passed。真实 App/Canvas 监听验证 brush Ctrl+] 前移层且 size 不变、原 bracket 释放、pencil 独立键、Shift+B/数字/Space 重分配，350ms 延迟跨层/工具/文档/焦点/modal 失效，held repeat/松键后 pointer 收尾/blur/换文档/改绑。真实文字 session、transform、polyLasso、Move pointer、PaintTool 和 Pen 点交互验证保护与历史；实际 file.save + 受控 IO 延迟验证 undo→save 快照及 save→undo 拒绝、工具/局部拒绝，复用 moveOutput 保存关闭及 GPU 结果回归。第一次迭代中测试纠正了“禁用 brush 后 B 会按组记忆选 pencil”的错误断言，未改变产品规则。无人工项目记为 Passed。

G3 与 P-TYPE/P-MOVE 通过。生产窗口 Space/IME/硬件、Owner 和独立实现审查 Pending。

### P4 evidence

P3 commit: ee51a5f。P4 实际范围：Ctrl+U/M/L/B 绑定原像素调整入口，填充主/备用键读取同一有效表；新增薄 Action layer.copyContext 与 Layer 菜单入口，按单像素有选区/其他（含多选）分发，历史和宏只记录最终 layer.viaCopy / layer.duplicate / layer.viaCut。旧相关覆盖（含空数组）或用户占 Ctrl+J 时持久化 copyContext:[]；Reset All 主动恢复新默认，独立重绑随 Action 迁移，无物理 J 特判。配置持久化失败不变更 live map 或通知。

G4 验证中落实任务已有边界：Fill 旧入口未检查像素/all 锁，增加共享填充 admission，菜单/快捷键/原填充均使用；mask 不受像素锁影响、all 锁保护 layer/mask，channel/quick-mask 沿用既有目标。viaCopy 对非空但已完全在画布外的选区原先 sel.bounds=null 会走整层区域，增加空目标拒绝，不以复制整层回退。均为目标准入检查，不重写像素算法。真实调整和 Fill 对话框固定原 session/doc/layer（Fill 还固定 mask/channel），确认前再检查身份与保护，避免活跃目标改变后调用错误文档。Modal 延迟使用当前回调但保留原实例/目标身份，repeat 确认不会二次执行。

验证：`npm exec -- vitest run tests/input tests/engine/moveSelection.test.ts tests/gpu/moveOutput.test.ts tests/engine/access.test.ts`：6 files / 64 tests Passed；P-TYPE、diff --check Passed。四个真实调整对话框逐一验证正确标题、实际参数预览、取消无像素/历史、确认一条 image.adjust 历史和 undo/redo；另测半覆盖选区和背后未选像素。前景/背景四个填充主/备用键、三个 Fill 打开键各自验证真实结果/一次历史、mask 目标和像素锁。Copy/Cut 验证源像素/柔边 alpha、undo/redo、单层无选区/非像素/多层、画布外选区无结果、final access 拒绝不回退、F6 改绑/旧键释放、真实菜单提示与调用、直接旧 Duplicate 宏仍复制整层。旧覆盖/空数组/占键的导入和重建、存储 quota 失败保持旧 map 通过。

G4/P-TYPE 通过，三类业务均有独立像素与历史证据，未用其中一类替代另一类。生产窗口人工与 Owner 验收、独立实现复审仍 Pending。


### P5 evidence and implementation handoff (2026-11-11)

P4 commit: d62c999。P5 处理集成验证发现的输入缺口：access 禁用后普通 tool 查询返回 null，新增仅检查保留 owner 的 pending 判断，不恢复其输入权限；保护未提交 Pen/透视裁切/模式编辑，工具切换和局部按键不丢编辑。禁用的点编辑工具仍认领 Delete，不回退清空图层；禁用 transform action 不可借切工具或 Enter/Esc 丢模式；纵向文字控件按自身 typeVertical access 保护，不误用横向工具权限。Toolbar D/X 按钮改用相同 Action，D/X/Q 和搜索提示随有效绑定实时更新，移除绑定不再显示旧键；Modal 尊重 defaultPrevented。

P2 曾核对曲线只有拖出删点，并暂未增加键盘行为；P5 对照完整规格补上本地裸 Delete/Backspace：可聚焦并选择中间控制点，删除点只更新当前对话框参数预览，端点保留，正式历史仍在确认时产生；IME/保护不删点、不穿透清图层。此处是对 P2 的实现补齐，不再把该项留为规格例外，也未新建像素算法。四类实际调整和曲线删点的定向测试均通过。

最终自动检查：

| 检查 | 实际结果 / 限制 |
| --- | --- |
| P-INPUT：tests/input + moveSelection + gpu/moveOutput + access + layerAccessUI | **Passed：8 files / 75 tests**。生产 App/Canvas/控件/Modal 和真实工具/业务命令，隔离图形 renderer、布局/无关面板及受控 IO；非窗口人工验收 |
| P-TYPE / P-BUILD | **Passed**：npm run build 包含类型、renderer 和 Electron；有既有 WASM/Node externalization、URL 解析及构建计时警告，没有据此声明全部格式兼容 |
| 正常生产入口 P-SMOKE | **Passed**：当前 worktree build 的 main/preload/app://celenne/index.html，native bridge=true、nodeExposed=false、21 个工具按钮、15 个面板，WebGPU GPU compositing，无 smoke errors |
| 生产 profile 重启 | **Passed（自动）**：隔离 profile 写入 copyContext:[F6]、pencil:[F7]、duplicate:[] 后退出并重启；F6 有效、Ctrl+J 释放，F7 精确 Pencil，提示含 F7，空数组保留；配置由正常 keymap 构造器重新读取，非设置窗口人工验收 |
| 生产实际 DOM 监听 + 业务结果 | **Passed（自动）**：64×48 RGB8 fixture，四个调整打开/取消、Ctrl+] 不改 size、Alt+Delete 实际黑色 RGBA、Shift+Delete Fill、F6 柔边 Copy alpha≈0.5/undo、transform Enter/Esc；实际生产图形窗口截图已查看 |
| P-DOC | **Passed**：20 个改动文件 UTF-8 无 BOM，75 个相对链接存在，材料受 Git 忽略，上游文档无改动，git diff --check 无错误 |
| P-FULL / packaged installer / Rust / macOS / 特殊布局 | **未运行**；不是本轮阶段门槛，不冒充 Passed |

生产脚本使用原有 CELENNE_SMOKE_EVAL 入口和当前 build 的模块 facade，未打开 dev server 或添加业务测试桥。窗口截图/日志/host/eval/profile 在本地忽略的 `doc/material/local/shortcuts-2026-11-10/`（seed.log、verify.log、verify.png 等），未提交。npm ci 缺失 Electron dist 时，按既有 DEV_SETUP 从本机已核对版本 **44.4.5** 的运行时独立复制到本 worktree；来源只读，没有链接业务源码。源/目标 electron.exe SHA256 均为 `BD14928E0728366FD3F41499CB398FF3F4304DAB259A3E605077899A6F8C748E`。

#### 有限人工矩阵（不得用上表替代）

执行者尝试使用 computer-use 对独立 profile 生产窗口操作：已观察完整主界面和 New Document 对话框；曾遇 FrameArrived timeout，恢复后可读 accessibility，但点击返回 coordinate input geometry is unavailable。此前实体 Esc 为 Owner 误触，Owner 已明确继续；没有据此标记人工项目通过。生产 smoke 是独立的自动集成证据。

| 人工项目 | 执行者结果 | Owner 结果 |
| --- | --- | --- |
| 像素层 Ctrl+U/M/L/B、预览/确认/取消 | Pending（已有自动结果） | Pending |
| 前景/背景填充及 Fill 别名 | Pending（已有自动结果） | Pending |
| 画笔 Ctrl+]、真实图层前移与 size | Pending（已有自动结果） | Pending |
| 实际选区 Ctrl+J/undo 与柔边 | Pending（已有自动结果） | Pending |
| 文字/数值焦点和有效 file.save | Pending（已有挂载监听/受控输出结果） | Pending |
| 文字中文候选 Enter/Esc | Pending：未完成真实中文 IME | Pending |
| Modal 中文候选 Enter/Esc | Pending：未完成真实中文 IME | Pending |
| 变换 Enter/Esc | Pending（已有自动结果） | Pending |
| Space 拖动中松键、失焦、迟到事件 | Pending（已有挂载 pointer/键生命周期结果） | Pending |
| 设置窗口重绑并实际重启试用 | Pending（已有 profile 重启自动结果） | Pending |

P5 的自动门槛通过；人工可按任务授权缺项交接，**G5 完整人工门槛不标为 Passed**。独立实现审查未执行，不创建独立 reviewer 记录，不把自查记成独立批准。

#### 给独立实现审查者

- 审查基线 `59f81b51fa2db6f6ea0e7d31094d8015549c6ec8`，范围为本任务的各阶段本地提交；排除 doc/material、构建产物、profile 和运行时副本。相邻 ADA/main_native/embedded 均未修改。
- 先按 [KEYBOARD_INPUT](../../design/KEYBOARD_INPUT.md) 核对稳定契约，再检查 shortcuts 的来源/优先级/重分配/导入事务与兼容初始化、inputContext/inputDispatch 的 IME/文本 save 与局部消费、Canvas/heldPan 的 pointer owner 与失效、editor 保留 owner 的 access 检查、真实 Modal 延迟身份。
- 重点复核 image.adjust 四个对话框的原目标/预览清理、Fill 目标/锁定准入、copyContext 最终分支/access/宏、viaCopy 非空画布外选区拒绝和旧覆盖空数组持久化。保留原最终命令 ID 与历史语义，没有 dispatcher 物理 J 特判。
- 重跑 P-INPUT/P-BUILD/P-DOC。自动 suite 的图形/布局/IO 隔离与生产 smoke 的合成输入有明确局限；手工复测上表，尤其真实中文候选、原生焦点、Space 释放/失焦和重绑重启。
- 本交接只请求实现审查，不授权推送、合并或发布；Owner 人工完成前不宣称完整 Photoshop 兼容。

稳定规则已归 [KEYBOARD_INPUT](../../design/KEYBOARD_INPUT.md)，验证入口归 [TESTING](../../engineering/TESTING.md)；README、AI_CONTEXT、DEV_LOG 只更新本任务状态和索引。


### Final local commit record

P1 `ff6c0a1` → P2 `d8afe72` → P3 `ee51a5f` → P4 `d62c999` → P5 `03ccd307726d01266c4669a7f1a417d2cfff191e`。本次额外文档提交仅补记 P5 hash，按 Ordered Phases 允许的最终交接记录收口，不包含业务改动。

独立实现审查代码范围：`59f81b51fa2db6f6ea0e7d31094d8015549c6ec8..03ccd307726d01266c4669a7f1a417d2cfff191e`。P1–P5 的实现与自动验证已交付；G5 人工、独立实现审查和 Owner 验收仍 Pending，无推送/合并/发布。

## 限定修复授权与验收（2026-11-11）

本节更新上方历史交接的“独立实现审查 Pending”状态，不改写原阶段证据。审查 HEAD 为 `e997029`，业务范围 `59f81b5..03ccd30`；审查开始时工作区干净。复跑原 P-INPUT 合计 75/75 通过，P-BUILD 与 diff --check 通过；追加生产监听/真实会话用例复现以下四项，结论 **Changes Requested**。未做新一轮生产窗口人工或中文 IME 验收。

Owner 决定：仅授权 coder 修复 R1、R2、R3 并补回归测试；R4 延期作为已知问题。保留原架构及 P1–P5 交付，不重跑新的五阶段设计，不引入通用异步框架或重写历史内核。按 R1→R2→R3 推进，各项分别本地提交并记录 hash/证据；无需逐项重复请求许可。保留本次任务文档改动和无关改动，不推送、合并或发布，不修改相邻 ADA/main_native/embedded。常规实现细节自行决定，超出本节产品范围再交 Owner 决定。

### R1 / P1：快速变换必须固定原目标（本轮修复）

- 源码依据：`src/app/actions.ts` 的 `quickTransform`（审查时 190–194 行）仅捕获 session/doc，await 动态导入后 `quickTransformLayer` 重新读取当前 selectedLayers。给快速旋转绑定 F6，在 A 按下后、异步继续前切到同文档 B，会旋转 B 并新增历史；现有跨文档检查不能拦截。
- 修改：入口捕获完整目标图层集合及必要交互身份，继续执行前核对 session/doc、图层对象/选择集合和交互状态，并重查最终 Action access/enabled、canEdit、outputPending/closePending。目标变化或不可用则取消，不改新目标、不产生历史。选择集合变化后又恢复的旧请求也不得复活，可使用有限的请求失效标记或现有状态通知，不建立通用队列。保持旋转/翻转算法和原 Action/宏语义。
- 补测：经实际有效绑定与分发触发，控制异步边界；覆盖同文档 A→B、多选集合增减、切文档、目标删除/替换、权限撤销和保存/关闭 pending，断言原目标/新目标像素或几何及历史均不被旧动作修改。补目标稳定的成功路径，确认只修改原选中集合、一次历史且 undo/redo 正确。覆盖快速旋转与翻转共用入口，不只测 Ctrl+T。

### R2 / P2：新交互使数字延迟输入失效（本轮修复）

- 源码依据：`src/app/inputDispatch.ts` 的 `handleDigit/valid/apply`（审查时 13–29 行）未验证新 pointer 交互或 busy。Move 下按 5，在 350ms 内开始拖动并保持按住，计时器仍修改透明度；松手前历史从 1 条增为 2 条。
- 修改：作品交互开始时取消待应用数字与两位数缓存；即使拖动已在计时器到期前结束，旧数字也不再应用。延迟执行前仍检查原目标身份、交互身份/busy、canEdit、outputPending/closePending 和相关 access。优先复用已有 pointer/交互通知，不能只在定时器里检查“此刻是否 busy”。不影响原有两位数、透明度/流量/填充透明度的正常规则。
- 补测：挂载实际 App/Canvas 监听，覆盖数字后长拖动、350ms 内结束的短拖动、画笔笔画开始、已有切层/切工具/焦点失效以及保存/关闭 pending。检查忙期间及收尾后均无旧参数修改或额外历史；Move/笔画自身正常收尾且一次撤销。正向验证不插入交互时两位数正确合并、单数字按期应用一次。

### R3 / P2：Modal 视图白名单不得抢文字与控件输入（本轮修复）

- 源码依据：`src/ui/dialogs/Modal.tsx`（审查时 37–38 行）在检查文本/控件归属前执行 MODAL_VIEW。将 view.zoomIn 改绑 A，在 Modal 输入框键入 a，事件被 preventDefault 并进入缩放分支。
- 修改：文本编辑及控件本地导航/激活优先于视图白名单。文本焦点不转发画布缩放；继续遵守 composition、defaultPrevented 和消费一次规则。非文本且未被控件认领的白名单键仍能缩放；不得放宽其他文档命令穿透，也不影响非模态文本的 file.save 白名单。
- 补测：挂载真实 Modal 及 input/textarea/contenteditable，给视图命令绑定字母、编辑组合键，断言文字事件未被全局吞掉、视图不变。覆盖数值/选择控件导航、IME、局部已消费事件；非文本区域有效缩放一次，模态内保存/文档修改仍被隔离。jsdom KeyboardEvent 不会自动完成浏览器文字插入，须以消费/命令次数/视图及控件处理证据验证，不能伪称人工打字验收。

### R4 / P2：调整目标失效后无法取消（Owner 明确延期）

- 源码依据：`src/ui/dialogs/EditingDialogs.tsx` 的 AdjustmentDialog.onClose（审查时 220 行）复用提交 permit。打开 Curves 后由程序入口切换活动图层，Esc、Cancel、关闭按钮均无法正常退出；目标删除或 access 失效也会触发。通常需程序/插件或状态变化导致目标失效，不等同正常模态操作必现。
- 本轮不修改此行为、不将其标记为已修复。后续将提交准入与取消清理分开，只清理本对话框拥有的预览，允许安全关闭且不修改新目标；届时单独补测。
- R1–R3 修复复审可以单独通过，但交接必须列出 R4 已知限制，以及 G5 人工和 Owner 验收 Pending；不据三项修复宣称所有发现或整体实现验收完成。

### 执行、补测与交接门槛

1. 先核对实际 HEAD/分支/status，阅读入口及本任务。将各问题复现收敛为可维护测试，确认修复前失败原因与对应业务断言一致；不得靠 mock dispatcher/run/工具跳过生产路径。
2. 每项完成其补测后分别提交；最终运行 P-INPUT、P-BUILD（含 typecheck）和 P-DOC，记录实际数量、结果、警告及证据边界。没有新增失败或改动时不为形式反复执行完整套件。修改的稳定规则仅按需同步 owner 文档，不改变已延期范围。
3. 审查临时用例本地存于 `doc/material/local/shortcuts-review-2026-11-11/review-repro.test.tsx`，原相对导入按 `tests/input/` 编写；仅作复现参考，不能直接从材料路径运行，也不把复制的整份旧测试作为新回归提交。材料受 Git 忽略，无此材料也可按上文重建用例。
4. 在下表补各项 commit、实现范围、补测结果与未验收项，再交独立复审。真实 Windows 输入/中文 IME/生产人工没有完成仍记 Pending；本轮不要求为通过修复门槛伪补人工结果。

| 项目 | 状态 | Commit / 补测 / 边界 |
| --- | --- | --- |
| R1：原目标快速变换 | 本地修复/定向检查通过，待独立复审 | `5a4e59f`；R1 6 tests Passed，P-TYPE Passed；人工/Owner Pending |
| R2：数字延迟与新交互 | 本地修复/定向检查通过，待独立复审 | `beff81e`；R2 及既有失效检查 13 tests Passed，P-TYPE Passed；人工/Owner Pending |
| R3：Modal 文本归属 | 本地修复/定向检查通过，待独立复审 | `f8e94b8`；监听 suite 59/59、P-TYPE Passed；人工/Owner Pending |
| R4：失效调整取消 | Owner 明确延期 | 已知限制，未修复 |
| 修复后复审 | Pending | R1–R3 单独复核；R4、G5 人工/Owner 验收另列 |


### 限定修复执行记录：R1（2026-11-11）

执行基线 e997029，codex/dev；初始 dirty 仅本任务的限定修复授权/审查内容（46 additions / 1 deletion），已完整保留。R4 源码本项未修改。

修复前通过有效 F6 绑定和真实 App/Canvas 分发触发 rotate90cw、flipH：A 按键后同步切到同文档 B，两个用例均 Failed，分别观察到 B 像素/几何改变和新增历史，与 R1 一致。未 mock dispatcher、run、工具或变换算法，动态 import 本身提供异步边界。

修复仅收紧 quickTransform 入口：固定 session/doc、全部选择 ID 与图层对象、active/mask/channel、工具/mode 和历史身份；使用本次请求范围内的 session/store 通知及 pointerdown 使失效不可逆，选择变化后恢复也不复活；import 继续后核对目标、最终 Action enabled/access、canEdit、outputPending/closePending、busy 和 Modal，finally 清理观察者。保留原旋转/翻转算法、Action 和宏记录，没有通用队列。

验证 `npm exec -- vitest run tests/input/listeners.test.tsx -t 'R1:'`：6 tests Passed（其余原 32 项未在本次定向运行），其中 rotate90cw/flipH 各测 15 种失效变化，以及稳定多选成功路径、一条历史、undo/redo、未选图层不变；同文档切层的两个独立复现也保留为回归。`npm run typecheck`、diff --check Passed。修复前隔离运行曾出现已有 jsdom 色彩 WASM 路径警告；修复后定向运行无失败。真实 Windows/中文 IME/生产人工、Owner 及独立实现复审仍 Pending。


### 限定修复执行记录：R2（2026-11-11）

R1 commit：5a4e59f。修复前真实 App/Canvas 下按 5 后分别开始长拖动、350ms 内结束的短拖动，两项均 Failed：原层透明度由 1 变 0.5，旧参数在新交互中或收尾后落下。回归同时断言 Move 自身收尾一条历史及 undo；fixture 的移动距离超过默认吸附回原位阈值，避免把无实际位移误判为缺少历史。没有改变 Move 算法或吸附设置。

修复复用 Canvas 已调用的 setInputPointerBusy：开始时递增有限 pointer 身份并通知数字处理器立即取消 timer 和两位数缓存，长短拖动都永久失效；补齐同一 Canvas guide/ruler pointer 入口的忙状态通知。数字处理器执行前再检查 pointer 身份/忙、工具 busy、原目标/mode/工具、canEdit、outputPending/closePending 与工具/最终层参数 Action enabled/access；不引入队列或改历史内核。

验证 `npm exec -- vitest run tests/input/listeners.test.tsx -t 'R2:|delayed numeric'`：13 tests Passed，含两种 Move 拖动、画笔笔画开始与一次撤销、旧 flow 数字及两位缓存丢弃、输出/关闭 pending（canEdit 仍 true）、canEdit/工具 access/层参数 access 拒绝，以及 opacity/flow/层透明度/填充透明度四类正常两位数与单数字应用次数；复跑既有切层/工具/文档/焦点/Modal 失效用例。`npm run typecheck`、diff --check Passed。真实 Windows/中文 IME/生产人工、Owner、独立复审仍 Pending；R4 未修改。


### 限定修复执行记录：R3（2026-11-11）

R2 commit：beff81e。修复前把 view.zoomIn 绑定 A，真实 Modal 的 input、textarea、contenteditable 三项均 Failed：文字事件被 preventDefault。回归扩展字母及 Ctrl+A/Z/Backspace；jsdom 不执行原生文字插入，所以只记录控件本地 handler、消费状态、视图和历史，不声称实际打字或剪贴板人工验收。

修复只调整 Modal 输入归属：defaultPrevented/IME 先返回；局部 Escape/Enter、文字及 native/role 控件的编辑/导航/激活、Tab 焦点导航均先于视图白名单。多行 textarea/contenteditable 的 Enter 和 repeat 留给编辑区域；普通单行 Enter 的既有模态提交保留。未被认领的非文本区域仍通过有效绑定缩放一次，按钮上未被认领的 Ctrl+= 同样可缩放；控件局部激活/导航键不转发。没有放行保存或其他文档命令，也未修改非模态文本的 file.save 入口。

验证 `npm exec -- vitest run tests/input/listeners.test.tsx`：59/59 Passed（本轮新增 R3 9 项，其余覆盖原监听及 R1/R2）；`npm run typecheck`、diff --check Passed。新增断言覆盖三个编辑目标的四个重绑组合、NumberField 真实箭头步进、select 导航/Enter、button 激活与 Tab、不吞多行 Enter/repeat、composition/局部确认取消优先、局部已消费键、非文本 view.zoomStep 一次，以及模态保存/清图层/新建隔离；既有非模态保存/文字/IME 用例也复跑通过。

R4 保持延期：AdjustmentDialog 仍以提交 permit 限制取消；活动图层/文档、目标删除或 access 变化导致目标失效时，Esc/Cancel/关闭按钮可能无法退出。本轮没有修改该 onClose 或预览取消清理。真实 Windows/中文 IME/生产人工、Owner 和独立修复复审仍 Pending。


### 限定修复最终检查与独立复审交接（2026-11-11）

| 项目 | 最终证据 |
| --- | --- |
| R1 | `5a4e59f`：快速旋转/翻转固定完整原目标和交互身份，失效不可复活；定向 6 项 Passed |
| R2 | `beff81e`：新 pointer 交互取消旧数字 timer/缓存，执行前重查 busy/pending/access；定向及原失效场景 13 项 Passed |
| R3 | `f8e94b8`：Modal 文字、控件局部键、IME 和已消费事件先于视图白名单；包含按钮上未认领 Ctrl+= 仍可缩放；监听 suite 59/59 Passed |
| P-INPUT | **Passed：8 files / 102 tests**（原 75 + 新增 R1 6 / R2 12 / R3 9）；最终重跑包含实际 App/Canvas/Modal、真实工具与业务状态/像素/历史，未 mock dispatcher/run/工具 |
| P-BUILD | **Passed**：typecheck、renderer、Electron 构建；保留既有 WASM/Node browser externalization 和 URL build-time 解析警告；更新/错误上报目标仍为关闭/本地 |
| P-DOC | **Passed**：11 个改动文件 UTF-8 无 BOM、69 个相对链接有效；审查材料受 Git 忽略，上游 docs/根 README/CHANGELOG/NOTES 无改动，diff --check 无错误 |
| R4 | **Owner 明确延期，未修复**；`src/ui/dialogs/EditingDialogs.tsx` 相对本轮 e997029 基线无改动，调整目标失效仍可能无法正常取消 |
| 人工 / Owner / 独立复审 | **Pending**。本轮没有重新执行真实 Windows/中文 IME/生产人工或生产 smoke；原 P5 的生产证据只属于历史构建，不替代本轮验收 |

独立复审代码范围：`e997029310789082ca09e0684e599aac74b8b7de..f8e94b8dae167ab1a1b6d4c98258c03f8c23ecc5`。后续文档提交只补 hash、检查结果与稳定规则，不含业务修复。原 task 的限定授权、审查说明与历史阶段记录均保留，无相邻 ADA/main_native/embedded 修改，无推送/合并/发布。

复审建议按 R1→R2→R3 检查三个独立提交及文末新增回归：特别复核同文档/多选与变化恢复的永久取消、最终 Action/pending 准入、长/短交互后旧数字不落下、模态文字与控件事件不被吞掉，同时非文本未认领 view 键仍执行一次。使用 P-INPUT/P-BUILD/P-DOC 重验；允许 R1–R3 单独复核，不把 R4/G5 人工/Owner Pending 抹掉。本交接不是复审 Approved。
