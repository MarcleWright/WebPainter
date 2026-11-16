# ADA内WP与main：能力及连续操作独立排查

日期：2026-11-16。状态：源码对照及受控领域/键盘复现完成，确认两类P2；本轮不实施WP修复或换包。启动端口修复已单独提交ADA `6da525c8`，不混入本报告。

## 1. 核对来源与证据范围

main `6eb2685`（产品内核来源5924a6d），embedded `d277f7c`；ADA当前指针mainBase5924a6d、embedded d277f7c、bundle e1798e817a185b338b5f92d70d6ce5411ac27679d89bbc1b572c42c494b26c73。前次校验public/dist各137资源哈希；本轮再次读取实际指针/源码，未重新运行生产iframe。main与embedded在src/app/src/tools/src/ui的差分仅8个嵌入surface/platform/生命周期文件，通用actions、input、Pen、transform内核已经带入；主要问题是通用输入合同与嵌入背景输出合同不兼容，不是缺少整批Dev源码。

Owner现象：X不可用、保存中Space+左键不能平移、Pen后Ctrl+Enter反复提示busy。受控复现使用固定embedded源码实际initializeEditor、native后台保存、input dispatcher、真实Pen及转换；仅checkpoint编码改为真实native codec同步fixture，host写入故意延迟。不模拟inputBlocked/Action/run，保留真实owner。未操作用户作品、窗口或真实Provider。

## 2. 必改P2

### P2-1 通用编辑参数Action漏入native能力合同

位置：embedded `src/embedded/capabilities.ts:19–28`，对照main `src/app/actions.ts:104–115`，Toolbar底部按钮也调用同一Action。

实际nativeSupports只允许edit/image/layer/select/type/view/shape前缀及少数例外，遗漏color和brush。运行时注册表核对确认以下6个Action被拒绝：color.reset（D）、color.swap（X）、brush.size.decrease/increase（[/]）、brush.hardness.decrease/increase（Shift+[/]）。这些是颜色/笔刷参数，不是native无法保存的文档类型；ADA产品策略也没有关闭这些Action。X在没有任何保存时也被unavailable提示拒绝。

影响：基础键盘工作流缺失；Toolbar重置/交换按钮仍展示但不能执行，快捷键与属性控件行为不一致。最小修订：native合同显式接纳这6个有限Action，不用宽泛放开全部新前缀；按钮可见/可执行与同一policy对齐。新增真实keyboard+Toolbar/policy执行证据，并验证产品显式禁用仍有效。

### P2-2 outputPending混用输出互斥和编辑阻塞，异步保存仍阻断连续操作

位置：embedded `src/embedded/editor.ts:115–141` 的nativeCheckpoint将outputPending保留到编码/host.save完成；main通用 `src/app/inputContext.ts:21`、inputDispatch.ts（held/tool/digits/command）、ops/pathSelectionOps.ts:19、tools/penDraft.ts:55、penTools.ts:112、transformTool.ts:277/453、ui/dialogs/Modal.tsx:36及EditingDialogs.tsx:198均直接将该字段作为阻塞条件。

后台保存COW快照后已释放editProtected，因此canEdit()为true、普通画笔及直接领域命令可以写入；但上述输入/工具检查仍拒绝整个编码/IO窗口。ADA750ms空闲/5秒需求会反复触发此窗口，独立WP手动保存少触发，表现为ADA工具连续性明显更差。

已用真实延迟host.save复现：Space held pan不建立、E不切橡皮、]不改变大小、Ctrl+Enter提示busy；保存完成后Space恢复。新Pen草稿即使从Toolbar直接切换也静默不创建。有效Pen路径在后台保存期间Ctrl+Enter不转换，保存完成后同路径立即转换成功。由此证明存在足以解释用户现象的机制，不声称覆盖Owner每次真实触发的全部时序。

最小正确路线：把“同目标只能一个输出/检查点在途”与“当前权威不可编辑/交互被锁定”分开表达；后台稳定快照编码/上传只占输出槽，不把全部编辑入口锁住。只在短COW捕获、权威安装、不可编辑阶段和关闭实际需要时保护。所有消费者须审计一致迁移，不能只删除inputBlocked一处或缩短busy文案。应保留：同目标保存串行合并、显式返回/生成drain准确checkpoint、旧回执只标原history ID、新编辑仍dirty、失败/取消/renew旧身份隔离。主线通用状态语义先main，嵌入输出保留embedded，ADA只适配业务保存协调，不在vendor修补。

## 3. 按功能族对照

| 功能族 | main | ADA当前WP | 判断 |
| --- | --- | --- | --- |
| D/X与大小/硬度键 | Action已实现 | native policy拒绝6项 | 已证实遗漏，P2-1 |
| 工具切换、数字opacity/flow、Space平移 | 常规空闲可用；手动输出有保护 | 背景native输出也触发通用busy拒绝 | 连续操作缺陷，P2-2 |
| Pen、局部undo、路径三键 | 同一实现 | 已带入，outputPending阻止新草稿/编辑/转换 | 不是未合并；需统一状态修订 |
| Ctrl+J/层操作 | contextual Action已实现 | capability允许，直接run可编辑 | 键盘在后台保存时仍受通用拒绝，领域测试不能证明键盘可用 |
| Ctrl+T/变换确认 | GPU透视+专用Worker | 同内核/manifest含Worker | 入口和确认仍有outputPending检查；不能将此影响与已测吞吐改善混为一谈 |
| Modal透视/画布导航及调整 | Dev实现已合入 | 控件部分可继续，导航/目标有效性检查包含outputPending | 可能在保存窗口冻结/拒绝，源码确认，未逐弹窗运行复现 |
| 画笔实际指针绘画 | canEdit决定目标，批处理内核 | 快照后可继续，但键盘切工具/调参数不一致 | 禁止宣称“整个画布全锁”或“所有编辑均可继续” |
| File本地打开/另存/导出、退出与多文档 | 独立本地完整 | ADA承载隐藏File/tab退出、唯一作品+返回 | 既定产品边界，不作为缺陷；导出需求另定 |
| 高位深/CMYK、智能对象/高级混合/效果、通道/切片等 | 独立版拥有 | native编辑能力上限限制，旧合法数据读写依合同 | 既定范围，不应为修快捷键放开全部能力 |
| 调整/图层/蒙版/文字/基础shape | 通用实现 | 有限native子集与policy门控 | 源码能力存在不等于所有组合已运行验收 |
| 模型/提示词/Results、Primary/recovery/Canvas预览 | WP无ADA业务 | ADA owner与adapter持有 | 属宿主能力，不能搬进WP内核 |

运行时所有已有公共主快捷键的native拒绝清单：上述6项外，File new/open/saveAs/saveCopy/revert/exportAs/info/quit、edit.preferences、filter.last/liquify、window.devtools。后者大多属已有产品/保存范围限制，不自动等同遗漏；main可自定义快捷键，ADA edit.shortcuts也显式关闭。完整工具/调整列表由nativeSupports有限集合定义，未对每项实际绘制/保存全排列验收。

## 4. 为什么原测试与技术review没捕获

embeddedNative/Integration已有延迟回执测试断言canEdit=true，并通过session.push或直接run('layer.copyContext')验证新修改不被旧回执标clean；该路径不会经过inputBlocked。输入测试则按独立WP的手动outputPending语义验证拒绝行为。两组分别通过，却没有同时测试“embedded背景输出在途+实际键盘/Modal/Pen入口”。阶段C续期组合证明身份保持，不证明连续输入可用。此前各阶段Approved的证据范围不能扩充为本报告问题不存在；该集成验证缺口需要修复时补交叉回归。

## 5. 本轮复现与限制

忽略材料：embedded `doc/material/local/2026-11-16/input-continuity/`，含probe.config.mjs/probe.test.ts/denied-shortcuts.json。实际命令：在embedded根目录运行 `node node_modules/vitest/vitest.mjs run --config doc/material/local/2026-11-16/input-continuity/probe.config.mjs`，5/5诊断用例通过——断言当前缺陷存在，不是修复验收通过。包含真实背景保存期键盘、有效路径转换前后对照、新Pen拒绝以及无保存X拒绝。

未执行：完整实际iframe/Toolbar鼠标挂载、每工具/每Modal/每格式组合、真实压力/IME/性能与设备验收。没有证据认为iframe本身造成这些准入问题；没有在本轮修改WP产品代码或替换包。本报告为修复任务的事实输入，不自动授权全功能开放或重写保存架构。旧opacity多历史/R4另行保留。
