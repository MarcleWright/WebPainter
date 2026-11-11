# 键盘输入约定

2026-11-11 实现交接。自动与生产 smoke 已验证的范围见[任务记录](../ai/tasks/2026-11-10_01_shortcut-unification.md)；独立实现审查、Windows 人工/中文 IME 和 Owner 验收仍 Pending。

## 绑定与显示

- 复用原 Action ID 和业务命令。Action 的 `shortcuts` 为主键及备用默认键（第一项是主键），工具默认来自 TOOLS。keymap 解析的有效结果同时用于菜单、工具提示、设置、冲突与派发。
- 用户数组整体替代该 ID 默认集合；空数组表示移除。用户绑定优先于其他 ID 的默认候选；默认主键优先于备用键。同级冲突拒绝，默认工具组共享键是显式例外。导入整体校验和持久化成功后才替换 live map；写入失败保留旧配置。
- 未被覆盖且仍持有默认键的可用工具组成默认组，普通 B 等读取组记忆，Shift+B 等轮换。用户指定给工具的键精确选择该工具；即使显式指定 B 也不恢复默认组资格，Reset 才恢复。显式 Shift+B 抑制该轮换但保留普通 B。
- 设置的重分配一次释放所有有效归属。数字与 Shift+数字、held pan 和派生轮换也参与冲突查询。数字参数仅接受对应数字键族；普通命令可接管数字键并抑制默认参数处理。
- 字母使用逻辑 key；已知标点 code 用于归一化底键，Shift 保留为修饰键（例如 Ctrl+= 和 Ctrl+Shift+= 是两个不同组合）。Ctrl/Meta 事件映射 Ctrl，同时按下二者不匹配。Windows 有限保留键见任务 P1；macOS/更多布局未验收。Delete/Backspace 只在显式填充别名中兼容。

## 输入归属与生命周期

- 文本控件拥有文字、剪贴板、全选、文字撤销、箭头与删除。composition/Process/Dead/keyCode229 优先于局部 Enter/Esc 和全局派发。文本焦点仅有效 `file.save` 可跨过控件的 stopPropagation，仍走原保存入口；对话框/菜单不放行文件命令。
- Modal/菜单优先处理局部导航和确认/取消，Modal 仅转发缩放/适配视图白名单。曲线画布可聚焦并选择控制点；裸 Delete/Backspace 删除选中的中间点，保留端点，不穿透清空图层，组合输入和保护期间拒绝。
- 工具仅认领明确修饰键组合的局部确认/取消/删点/箭头。busy 期间不插入全局 undo；Move pointer 中不插入箭头历史。一个事件只消费一次，一次触发型命令抑制 repeat；箭头和笔刷步进可重复。
- 保存/关闭请求与目标 canEdit/access 都参与输入保护。已禁用工具的保留实例只用于判断是否有待结束交互，不重新授予输入；保护期间不通过工具切换、deactivate 或局部 Esc 丢掉文字、路径、变换等编辑。
- Space 的 held pan 是视图覆盖，不调用普通 setTool/deactivate。笔画/拖动中不接管 pointer；平移已开始后松键仍由平移接收 pointer up，之后退出。失焦、切文档、进入文字/Modal/菜单及显式换工具使旧 held 状态失效，清理临时平移捕获，不提交/取消底下作品编辑。现有 Alt 取色不变，本轮不新增临时 zoom。
- 数字延后 350ms，绑定原 session/doc/layer 对象、mode、mask/channel、tool 和参数类型。切层/工具/文档/文本焦点/Modal 后取消缓存，执行时再次验权。动态 transform 入口和 Modal 延迟确认也验证原身份，目标改变不作用于新的 active 文档。

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
