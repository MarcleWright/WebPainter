# Task 01: 快捷键统一与 Photoshop 常用操作兼容

## Status

Approved / 方案通过, 待 coder 执行。2026-11-10 初审 Changes Requested 后已按受控输入层重构边界修订并完成方案级复核, 保留现有架构和 P1–P5。用户已授权 coder 按本任务串行实施、验证并各阶段分别本地提交; 未授权推送、合并或发布。本轮仅更新方案与交接提示, 尚未开始业务实现。方案 Approved 不等于实现独立审查或用户验收通过。

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

尚未实施。初稿已创建规格与入口索引; 本次仅更新方案 Approved 状态和 coder 执行授权, 保留其他文档已有改动。执行者按阶段在此补充实际证据, 不据已有 PhotoCraft 源码测试声明 Rust 运行验收。

| 阶段 | 状态 | Commit / 自动检查 / 人工边界 |
| --- | --- | --- |
| P1 | Gate Passed | 清单/fixture 已建立；baseline 1/1、P-TYPE、diff --check 通过；人工 Pending |
| P2 | Gate Passed | 输入定向 9/9、P-TYPE 通过；事件链与原子配置证据见下；人工 Pending |
| P3 | Planned | 待 P2 |
| P4 | Planned | 待 P3 |
| P5 | Planned | 待 P4 |

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
