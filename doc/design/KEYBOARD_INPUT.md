# 键盘输入约定

2026-11-11 实现交接。自动与生产 smoke 已验证的范围见[任务记录](../ai/tasks/2026-11-10_01_shortcut-unification.md)；原实现审查为 Changes Requested；限定 R1–R3 修复 review 已通过（Owner 确认），R4 明确延期。Windows 人工/中文 IME 和 Owner 验收仍 Pending。

## 绑定与显示

- 复用原 Action ID 和业务命令。Action 的 `shortcuts` 为主键及备用默认键（第一项是主键），工具默认来自 TOOLS。keymap 解析的有效结果同时用于菜单、工具提示、设置、冲突与派发。
- 用户数组整体替代该 ID 默认集合；空数组表示移除。用户绑定优先于其他 ID 的默认候选；默认主键优先于备用键。同级冲突拒绝，默认工具组共享键是显式例外。导入整体校验和持久化成功后才替换 live map；写入失败保留旧配置。
- 未被覆盖且仍持有默认键的可用工具组成默认组，普通 B 等读取组记忆，Shift+B 等轮换。用户指定给工具的键精确选择该工具；即使显式指定 B 也不恢复默认组资格，Reset 才恢复。显式 Shift+B 抑制该轮换但保留普通 B。
- 设置的重分配一次释放所有有效归属。数字与 Shift+数字、held pan 和派生轮换也参与冲突查询。数字参数仅接受对应数字键族；普通命令可接管数字键并抑制默认参数处理。
- 字母使用逻辑 key；已知标点 code 用于归一化底键，Shift 保留为修饰键（例如 Ctrl+= 和 Ctrl+Shift+= 是两个不同组合）。Ctrl/Meta 事件映射 Ctrl，同时按下二者不匹配。Windows 有限保留键见任务 P1；macOS/更多布局未验收。Delete/Backspace 只在显式填充别名中兼容。

## 输入归属与生命周期

- 文本控件拥有文字、剪贴板、全选、文字撤销、箭头与删除。composition/Process/Dead/keyCode229 优先于局部 Enter/Esc 和全局派发。文本焦点仅有效 `file.save` 可跨过控件的 stopPropagation，仍走原保存入口；对话框/菜单不放行文件命令。
- Modal/菜单优先处理局部导航和确认/取消。Modal 仅对非文本且未被控件局部键认领/消费的事件转发缩放/适配视图白名单；重绑的字母和编辑组合键不抢文字，Tab、控件激活以及多行 Enter/repeat 保持本地归属。曲线画布可聚焦并选择控制点；裸 Delete/Backspace 删除选中的中间点，保留端点，不穿透清空图层，组合输入和保护期间拒绝。
- 工具仅认领明确修饰键组合的局部确认/取消/删点/箭头。busy 期间不插入全局 undo；Move pointer 中不插入箭头历史。一个事件只消费一次，一次触发型命令抑制 repeat；箭头和笔刷步进可重复。
- 保存/关闭请求与目标 canEdit/access 都参与输入保护。已禁用工具的保留实例只用于判断是否有待结束交互，不重新授予输入；保护期间不通过工具切换、deactivate 或局部 Esc 丢掉文字、路径、变换等编辑。
- Space 的 held pan 是视图覆盖，不调用普通 setTool/deactivate。笔画/拖动中不接管 pointer；平移已开始后松键仍由平移接收 pointer up，之后退出。失焦、切文档、进入文字/Modal/菜单及显式换工具使旧 held 状态失效，清理临时平移捕获，不提交/取消底下作品编辑。现有 Alt 取色不变，本轮不新增临时 zoom。
- 数字延后 350ms，绑定原 session/doc/layer 对象、mode、mask/channel、tool 和参数类型。切层/工具/文档/文本焦点/Modal 后取消缓存；Canvas pointer 交互开始立即取消旧 timer 与两位数缓存，即使短拖动已经结束也不再应用。执行时再检查 pointer 身份/busy、原目标、canEdit、outputPending/closePending 和相关 access。Modal 延迟确认仍验证原实例/目标身份。
- 快速旋转/翻转的异步入口固定原 session/doc、完整选中图层对象与选择集合、mode/工具及必要编辑身份；选择或交互变化后恢复也不复活旧请求，继续前重查最终 Action enabled/access 和目标编辑/保存关闭状态。不改变既有变换算法、Action/宏及历史。

## 公共弹窗的画布导航（2026-11-11）

[弹窗与选区任务](../ai/tasks/2026-11-11_01_dialog-and-selection-interaction.md) 改为透明模态外壳。最上层 Modal 仍拥有输入，外部点击不关闭、不编辑背景；Tab 在该弹窗循环，普通 Canvas 绘图入口拒绝 Modal 背景事件。位置按对话框类型在本次应用会话记忆并限制在视口可达范围。

暴露的实际画布区域允许滚轮（原有平移/修饰缩放）及中键平移，即使参数仍聚焦、尚未 blur 或处于组合输入；它们只改变绑定 session/doc 的 view，不让参数失焦或转入工具。Space/用户重绑的 held pan 仅在非文本、非 IME 焦点可发起左键导航；文本 Space 保留字符语义。标题/控件内开始的序列不能移交画布，popup/menu 期间不接管导航。失焦、弹窗栈变化、关闭或切文档清理临时状态，迟到尾事件不编辑新目标。

目前公共对话框没有具备明确 owner 的主画布取色入口；ColorPicker 内部 SV/hue 不属于背景画布导航授权，ColorRange 读取已有前景色也不开放当前工具透传。独立实现审查与完整 Windows/中文 IME、人工/Owner 验收 Pending，旧任务 R4 限制如下保留。

## 首批兼容操作

| 默认键 | Action / 语义 |
| --- | --- |
| Ctrl+U/M/L/B | 原 Hue/Saturation、Curves、Levels、Color Balance 像素调整对话框；预览不记正式历史，确认走原 image.adjust，不新建调整层 |
| Alt+Backspace / Alt+Delete | edit.fillForeground |
| Ctrl+Backspace / Ctrl+Delete | edit.fillBackground |
| Shift+F5 / Shift+Backspace / Shift+Delete | edit.fill 对话框 |
| Ctrl+J | layer.copyContext：单个像素层且有非空选区调用 layer.viaCopy；其他类型/无选区/多选调用 layer.duplicate |
| Ctrl+Shift+J | 原 layer.viaCut |
| D / X、方括号/Shift+方括号、Tab | color.reset/swap、brush.size/hardness、view.togglePanels；全部可重绑 |

填充遵守选择覆盖、mask/channel/quick-mask 和锁定目标，像素锁不禁止独立蒙版目标，all 锁保护 layer/mask。非空但完全位于画布外的选区直接拒绝 Copy/Cut，最终命令禁用时不退回整层复制。上下文复制只选择既有命令，历史/宏记录仍属于最终业务命令；直接 Duplicate/Copy/Cut ID 保留。

首次读取旧配置若包含 duplicate/viaCopy 覆盖（包括空数组），或 Ctrl+J 已被用户占用，则持久化新入口无绑定。显式 copyContext 覆盖优先；Reset All 可主动恢复新默认，重启不重新迁移或复活移除的键。

源码 owner：[有效绑定](../../src/app/shortcuts.ts)、[分发](../../src/app/inputDispatch.ts)、[焦点与 IME](../../src/app/inputContext.ts)、[held pan](../../src/app/heldPan.ts)、[Action](../../src/app/actions.ts)。验证命令见 [TESTING](../engineering/TESTING.md)。

## 已知限制

R4 按 Owner 决定延期：AdjustmentDialog 取消仍复用提交 permit。打开调整对话框后，若程序切层/切文档、删除目标或改变 access 使目标失效，Esc/Cancel/关闭按钮可能无法退出。本轮未分离提交准入与取消清理，也未标记该问题已修复。限定修复与独立复审边界见[任务文末](../ai/tasks/2026-11-10_01_shortcut-unification.md)。
