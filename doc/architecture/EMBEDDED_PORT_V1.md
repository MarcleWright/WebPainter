# Embedded Port v1 — 03A 实施边界

2026-11-06。实现位于 `integration/embedded`，待独立 review；不是正式 ADA 保存合同。承载结论见 [03C](../ai/tasks/2026-11-06_03C_carrier-comparison.md)。

## 入口和所有权

`src/embedded/contract.ts` 仅含 DTO/type。`initializeEditor(host)` 管理一个活动编辑器，复用原 `Editor`、`DocumentSession`、History、`prepareMoveOutput`、`save` 和 `closeSession`。没有第二份像素或历史存储，不导入 ADA 包。初始化不导入独立 main，不安装 autosave、recovery scheduler、updater、退出或 launch-file handlers，也不激活 plugins。

| API/事件 | 语义 |
| --- | --- |
| `open(binding, resourceToken)` | 宿主异步读取受控资源；空编辑器才可打开。解析后再核对 generation，不将迟到内容加到新实例 |
| `save()` | 复用现有 PSD 保存保护；宿主确认成功后才移动保存点。此轮输出格式明确为 `psd-test`，不是 native |
| `captureComposite()` / `exportPng()` | 完成合法 Move/text 临时操作，保护目标并获取稳定快照，走既有 PNG exporter；捕获不标 clean，不发布平台资产 |
| `command()` | 只接受 undo / redo / layerViaCopy / transform，映射原命令；不接受任意 JS 或任意命令字符串 |
| `requestClose()` | 等待输出，取消未确认 Move，处理原 Save/Discard/Cancel；Cancel 保留实例和 dirty |
| `destroy()` | 有文档时拒绝。失效 generation，解除 session/font 监听，释放 tool 实例和宿主服务；UI wrapper 先卸载自有 React root |
| `dirty` / `error` | 非权威通知。dirty 观察者异常不阻断编辑；输出 Promise 拒绝保留 dirty，可重试 |

`Operation` 包含 generation、operationId 和 opaque binding；WP 不解释 Profile、Project、Artifact、权限或 revision。宿主完成这些业务校验。端口不携带 GPU 对象，绘画/拖动热路径不经端口。PNG/PSD 为现有 CPU 编码；iframe 当前通过 structured clone 复制二进制，没有宣称零拷贝。

`installPlatform` 是可逆的单活动实例 seam，独立默认仍为原 Electron/Browser Platform。关闭/保存保护沿用原 session；没有重做关闭队列。独立入口不依赖 embedded 模块。内核与 UI 的必要 seam 改动暂只在 integration 分支，main 没有被提交、修改或合并；不能整体反向合并。

## 首版工具核对与后续 native 清单

以下是从真实代码核对的首版规格输入，不是所有工具或 native 往返已验收。

| 范围 | 真实入口/数据 | 当前证据及范围 |
| --- | --- | --- |
| 画笔/橡皮、颜色和尺寸 | `paintTools.ts`、ToolPointer pressure | 实窗鼠标连续笔画通过；真实压感和手感未测 |
| 矩形/套索、Move | selectionTools / moveTool | 既有测试与本轮 4K 脚本；不是全部羽化/效果矩阵 |
| 钢笔转选区 | `DocPanels.tsx` Make Selection → `pathToSelection` | 源码核对。不是仅凭工具枚举；未做手工路径验收 |
| Ctrl+T | `edit.freeTransform` → `beginTransform`，由 session mode controller 处理 | 保留原路径；本轮未完成真实变换人工矩阵 |
| Layer via Copy | `layer.viaCopy` → `layerVia(false)`，读取选区 coverage | 宿主枚举指向该命令。Ctrl+J 仍绑定 `layer.duplicate`；WP-EDIT-001 未修，后续 03D 接线前另行处理 |
| 文字、基础蒙版、曲线等调整 | 原 text/LayerMask/adjustment 实现 | 保留现有本地能力；IME、缺字体和完整外观验收未覆盖 |

03B 的有限 native 恢复规格：

- 文档：稳定文档身份、名称、canvas 尺寸/分辨率/RGB8、profile 描述；schemaVersion 与平台 revision 分开。当前 `CelenneDocument.id` 是运行时生成，codec 要明确重建身份，不能将 readonly TS 字段当已完成稳定保存。
- 图层：稳定 ID、类型、树与顺序、名称、可见性、opacity、fillOpacity、blendMode、锁、位置；像素/手绘为 TiledRaster 内容，不保存 renderer/cache。
- 蒙版：enabled/linked、位置、density/feather、coverage；声明支持的模式并拒绝未知内容。
- 文字：TextData 的段落、runs、样式、字体标识/排版，以及外观所需内容；缺字体须明确。路径：SavedPath/VectorPath 的 knots、闭合及相关参数。
- 调整：首版实际开放的 adjustment discriminant 和全部对应参数；引用图片须有通用来源 token/hash 与必要内嵌像素，ADA 身份由宿主映射。
- parent 指针、runtime rev、选中/视口、命令历史、GPU、缓存、凭证不作为 native 事实。selection 是否持久化留 03B 明确；不能静默许诺恢复。
- 高位深/CMYK、smartObject、video、复杂效果/advanced blending、正式 3D 不进入此轮 native 承诺。当前试验 UI 仍用于观察原工具，并非首版发布 UI；03D 需按最终支持合同收口。03B 未实施，`nativeVersion=null`。

现行简单宿主能力门在 action registry 同时控制菜单/快捷键/command palette：禁独立 file/app 入口与设置/恢复动作，只保留宿主 save/close；宿主 command 为固定枚举。无文档时显示宿主打开提示，不显示独立 Welcome 文件入口。通过 Platform 的文件读取/写入不能回退到用户本地默认 I/O。

## 单例与资源清点

| 对象/副作用 | 处理 |
| --- | --- |
| Editor / UI store / actions / tools / mode controllers | 每 realm 一个；destroy 清 tool 实例、clipboard，恢复 actions/platform；不是多实例 SDK |
| App、CanvasView、Workspace 的键盘/窗口监听与 rAF/ResizeObserver | 由 React effect cleanup 解除；直接挂载键盘监听改用自有 surface，输入类型从 composedPath 识别 |
| 菜单和工具 flyout portal、CSS | A 用 shadow 内 portal 与 inline CSS；B 用自身 document 默认作用域 |
| 字体刷新 documentAdded / onEngineFonts / timer | installer 返回 disposer，destroy 解除；已加载字体和 CMS 模块可在同 realm 复用 |
| 数字不透明度延迟输入 | App cleanup 清 timer/buffer，避免作用于下一作品 |
| Viewport / GPU | 原 renderer cleanup；清失效诊断引用。A 的共享 GPU device/cache 是 realm 级缓存，未证明 destroy 后 GPU 驱动内存归零；B 删除 iframe 释放页面作用域，不声称独立 OS 进程或安全沙箱 |
| main 的 recovery/update/window/file/error handlers | embedded 不注册；独立 boot 保留 |

36 项本轮定向检查和实窗范围见任务记录；全工具、完全离线、Photoshop、Provider、Profile/CAS 均没有由此获得验收。
