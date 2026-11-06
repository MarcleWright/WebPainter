# ADA 集成架构草案

## Status And Authority

- 2026-11-06 最新：Owner 已确认首版使用 **本地 iframe**，03C 有限面板原型独立 review Approved；Direct 仅保留为实验。详见 [选型与证据边界](../ai/tasks/2026-11-06_03C_carrier-comparison.md#confirmed-iframe-decision) 及 [Port v1](EMBEDDED_PORT_V1.md)。性能/设备及正式产品验收缺口不因选型关闭；03B/D/E/F 未实施，执行权限以后续 coder 指令为准。下列初始基线仅为历史时点，最新配套见 03C。
- WebPainter 初次研究基线为 98c4c4f; 路线更新时已核对 `main/ef3eea87beb00b2c79c6f1e4902e4a5739ef8557`。规划期既有未提交文档全部保留；本轮源码与包的未提交状态见 03A/03C。保存/关闭最新修复仍待独立复审及人工验收。
- 目标: `D:/00_Projects_WSY/AI/Codex_Projects/auto_design_Agent`, worktree 分支 `codex/isolate-drawing-interface-20261104`, HEAD `e9f458930f250191ef35d2efae3734cca4573351`。不以相邻 `_New` 目录替代。ADA 当前已有未提交文档, 既有内容保留；本轮仅新增实验壳/固定测试包和任务记录，不接业务存储。
- 平台目标语义归 ADA 的 `doc/architecture/DRAWING_EDITOR_ARCHITECTURE.md` 和 ADR-0021。本文件只拥有 WebPainter 的接入建议, 不以本 fork 文档自行改变 ADA 的现行业务合同。
- [讨论记录](../ai/tasks/2026-11-06_03_ada-integration-architecture.md), [决策草案](../ai/decisions/ADR-0003_ada-embedded-editor.md)。下述均为目标, 不是已交付能力。

## 1. 首版选择: 保留编辑内核, 有限开放工作流

建议以 WebPainter 为编辑能力基底, 首版交付汽车 sketch 的核心闭环。不是全量开放现有应用, 也不是把几个工具的代码复制到 ADA 后重建一套编辑器。

保留 document / tiledRaster / selection / commands-history / rendering-gpu / typography-vector / psd 等依赖闭包。首版只展示并验收承诺的入口。后续工具主要复用原实现, 仍需补序列化、历史、宿主能力与交互验证, 不承诺加一个按钮即可上线。

首版建议范围, 待 Owner 确认:

| 工作流 | 首版建议 | 后续单独扩展 |
| --- | --- | --- |
| 作品 | 独立文档节点创建/打开/保存/重开/退出, 加入已有图片 | 模板、跨作品多文档管理 |
| 绘画 | 画笔/橡皮、压感、颜色/大小/不透明度、缩放/平移/取色 | 复杂湿画笔、笔刷资产市场 |
| 图层 | 像素/文字/基础调整, 顺序/可见性/锁定/透明度, 基础蒙版 | 完整高级效果、智能对象、复杂剪贴组合 |
| 局部编辑 | 矩形/套索、钢笔路径转选区、选区复制成层、移动, 基础 Ctrl+T | 智能选区、完整路径/形状编辑工作流 |
| 调整 | 基础曝光/亮度对比、色相饱和度或曲线, 以现有实现核对 | 完整调色与滤镜目录 |
| 交换 | 原生可编辑保存、合成 PNG、约定子集 PSD 导出 | 完整 PSD 往返、RAW/CMYK/高位深覆盖 |
| AI | 当前画面生成, Results 浏览与显式添加图层 | Agent 直接编辑工具、ComfyUI/本地 LLM adapter |
| 3D | 架构边界及有限混合验证 | 正式模型图层、灯光材质与三维编辑工具 |

首版尺寸基准为非均匀 3840 x 2160、sRGB RGBA8。先用约 5-10 层代表性作品验证, 不据用户人数减少单机像素正确性要求。工具存在于枚举不代表完整可用; 尤其钢笔转选区、选区复制与 Ctrl+T 的真实行为需单独核对。WP-EDIT-001 的 Ctrl+J 绑定缺口需在承诺该交互前解决, 不默认已修复。

不支持的工具不只隐藏按钮: 菜单、快捷键和宿主调用应遵守同一个简单能力清单。保留独立 WebPainter 的完整模式, 不为 ADA 模式删除现有功能或建立插件市场。对超出保存合同的文档应阻止编辑/保存或明确拒绝导入, 不能静默压平丢失内容。

<a id="2-部署边界-独立全屏编辑空间-承载方式待比较"></a>

## 2. 部署边界: 独立全屏编辑空间, 本地 iframe

Owner 确认: 编辑时全屏遮住 Session/Canvas/Gallery, 退出回原工作上下文。界面独立不等于运行页面必须独立。无论采用何种承载, 程序资源随 ADA 本地部署, 不访问远程站点或用户磁盘源码目录。

2026-11-06 Owner 补充确认的首版 UI: 沿用 WP 上方常规面板、左侧工具栏、右侧图层管理与中间画板, 在编辑区域底部增加 ADA 悬浮功能面板, 提供提示词、模型选择、生成操作及结果查看入口。它是作品内的生成面板, 不提供 Agent 对话, 不嵌入后台 Session。复用 WP UI 不等于开放全部 WP 能力, 仍受首版能力和保存合同约束; 专用 UI 留待后续, 本轮不要求重做工具栏/图层面板、完整无界面 SDK 或通用插件框架。

面板及业务 adapter 由 ADA 持有, 通过确定版本的 WP 包组合成编辑页面。正式选用 B, 面板与 WP 同在 iframe 内的编辑页面, 经受约束的宿主通信提交命令、取得模型选项、读取 Artifact 与结果; A 的异步函数适配只保留为实验。WP 只提供通用捕获、资源输入和编辑命令, 不导入 ADA 模型/Provider/Artifact 合同, 不修改 vendor 包承载专用 UI。03C 验证这种组合的最小构建/挂载方式与输入隔离, 不能默认现有端口已满足全部扩展。

面板不能导致后台工作区重挂载或抢输入。提示词输入/IME、模型下拉与结果操作不得穿透为绘画或后台快捷键; 回到画板后恢复绘画输入, 关闭面板弹出层不等于关闭作品。控制底部遮挡, 窗口缩放后必要操作仍可达。03C 只做同一薄面板与受控宿主往返验证, 正式平台生成/Artifact/Results 接线归 03E, 不以旧原型证据追认新增面板已通过。Owner 已确认 iframe；人工/设备与正式平台验收仍按 03D/03F 完成。

正式方案 B: 全屏容器加载 ADA 自有本地 iframe 页面, 用消息适配宿主接口。方案 A 曾作为直接挂载对照, 现仅保留为隔离实验。选型基于既有 UI 隔离与维护边界, 不宣称 iframe 更快、零开销或独立进程。

WebPainter 当前 React 19.3、ADA React 18.3, 且 `src/main.tsx` 安装全局启动、关闭、恢复、更新和错误处理。A 需要验证独立 React root 或其他最小兼容方式及 CSS/全局事件治理, 不假设可直接导入 App, 不自动全局升级 React。B 需要验证焦点、消息、二进制交接与资源路径; iframe 不保证独立 CPU 线程或自动消除卡顿, 也不替代 API 的身份检查。

共用部分是可启动/销毁的 embedded lifecycle 和宿主端口, 复用 UI/内核, 不启动独立 Electron、不注入另一套 preload、不注册自身更新器/窗口退出/独立恢复调度。保存和 PSD 下载交给宿主。独立桌面 boot 保持原行为, 沿用 Platform 分界, 不建设通用宿主框架。

两种承载已按同一内核和测试作品完成有限对照。后续只发展 iframe 正式路径, 对 WebGPU、pointer/pressure、焦点/IME、快捷键、拖放、输出和资源保留对应检查; 不维护两套完整产品。热路径不经过宿主, 三维 producer 也留在编辑模块一侧。

```text
ADA Canvas / Artifact / Generation / Profile owners
              | 宿主适配器: 身份、读写、资源、生成、退出
              | 小型宿主端口: A 为函数调用, B 为消息适配
              v
全屏编辑模块: WebPainter UI + DocumentSession + 命令历史
              | 工具与图层 -> 现有 GPU/CPU 合成 -> 编辑视口
              | 保存检查点 -> 原生载荷 / 预览 / PSD / 生成快照
```

首版一个活动编辑作品, 不预建多窗口同步。再次打开同一 D 聚焦已有会话; 切作品先处理 dirty 和退出边界。多窗口意外并写仍由持久化修订校验拒绝旧保存。

### 2.1 仓库、分支和更新路线

Owner 已确认采用以下路线, 不因 A/B 承载选择而改变:

```text
WebPainter 仓库
  main: 完整独立版, 通用功能/性能/缺陷修复
    |
    +-- 合入 -> integration/embedded: 通用嵌入入口与宿主边界
                   |
                   +-- 固定 commit 构建包 -> ADA 指定 worktree
                                              ADA 专用适配
```

- 仍是两个工程, 不是第三份完整 WP。03A 获本轮授权后已从 main/ef3eea8 建立 integration/embedded，未提交/合并；固定 prototype snapshot 及源码 dirty 状态见 03C。需要同时操作时可为同一 WP 仓库建立额外 worktree, 它不是新 fork, 不在脏目录切分支或重复维护源码副本。
- `main` 保留本地打开/保存/恢复/窗口/更新与全部独立入口, 不为 ADA 删功能。嵌入专用 boot、可选端口和生命周期改造在 embedded; 若确有价值的通用清理需要回主线, 单独整理验证后进入 main, 不把整个嵌入分支反向合回 main。
- 画笔/选区/渲染/PSD 等通用功能与修复先在 main, 再合入 embedded。集成阶段发现通用 bug 也如此处理; 紧急定位补丁不得形成两份长期实现。通用 codec 可在 main 提供可选库能力, 不依赖 embedded 的初始化代码或改变默认文件流程。
- WP 不包含 ADA API、Profile/Project/Artifact/Results 业务实现; 通用端口采用编辑会话、opaque host binding/token、资源描述与通用输出结果。ADA adapter 负责映射业务身份并验证权限/epoch/revision, 不把凭证交给编辑器。
- ADA 引用确定的嵌入构建包, 不在 vendor/bundle 中直接改画笔/内核。升级通常更新包和版本记录, 只有端口/载荷或能力变化才调整 adapter。依赖闭包与构建方式由 03C 定案, 不自动引入 submodule/npm 发布平台。
- 每次接入记录: main 来源基线、embedded 源 commit、构建包 hash、端口版本、native schemaVersion、ADA 适配 commit。发布内容不依赖会移动的分支名。跨仓库没有原子提交, 必须能按记录重建并验证同一配套版本。
- 更新 main -> embedded 后解决冲突并重验独立入口/嵌入合同, 再更新 ADA 并跑定向回归。接口不兼容明确拒绝加载, 旧包回退不得静默读取/覆盖不支持的新文档; 不承诺降级文档或自动还原已保存内容。
- 上游 PR 从上游基线整理独立的通用改动和测试, 不将 main 上全部 fork 差异或 embedded/ADA 适配捆绑提交。PR 的创建/发送另需用户授权, 上游接纳不是本任务可保证的验收条件。

## 3. 谁拥有哪份状态

| Owner | 事实与职责 | 不应承担 |
| --- | --- | --- |
| WebPainter DocumentSession | 一份打开作品的图层、像素、选区、临时交互和撤销历史 | 平台 Artifact 库、Provider 调用、Canvas 布局 |
| ADA Artifact/payload owner | D 的身份、已保存载荷、修订、引用和来源 | 每个鼠标事件的像素状态 |
| ADA Canvas/projection owner | 文档节点创建、位置/连线、small/standard 合成预览 | 内部图层、另一份编辑历史 |
| ADA Generation/交付 owner | 固定输入快照、生成执行、正式结果、作品 Results 关联 | 直接改 WebPainter GPU 对象或强制插层 |
| 宿主适配器 | 捕获目标身份, 请求/回执映射, 打开/关闭与错误展示 | 复制整个 ProjectShell、通用消息总线或新资产数据库 |

运行时 D 的编辑内容只有一个真源, 是编辑器文档。已保存版本由平台持久化, 缩略图是派生表示。不得将 GPU 纹理当文档载荷或在 ADA store 再存整份实时像素文档。

编辑会话身份与网络 transport 身份分开: 同 Profile/instance 的自动续期不销毁作品或固定新文档身份, adapter 的长期 binding 不永久钉住打开时 epoch; 每个新请求通过现有 ProfileWorkspaceClient 捕获当前 epoch。旧操作保持其原身份, 不重标 epoch 接受旧回执。结果不确定时查询原操作/检查点, 不重放写入。真正切 Profile/实例重启与续期在现有生命周期 owner 区分, 不能给共用 quiescence 无差别挂作品关闭回调。具体合同和验证归 [03D](../ai/tasks/2026-11-06_03D_ada-document-workflow.md#profile-renewal-contract)。

宿主合同初步只需 open/load、save checkpoint、read asset、export、capture composite、add image layer、request close 与 dirty/error 通知。WP DTO 只带编辑会话代次、操作身份及 opaque host binding; ADA adapter 另捕获并校验 Profile/epoch/Project/Artifact/expectedRevision, 不能用 opaque token 代替平台校验。两种承载均采用异步完成/失败语义。B 另核对协议版本、requestId、source/origin 与握手; A 同样校验会话身份。B 使用二进制转移或资源句柄, 不反复 base64, 不传 GPU 对象。不得转移活跃图块 buffer; 独立编码输出可交接, 接收方负责释放, 失败从稳定检查点重试。

## 4. 文档身份与可编辑保存

Canvas toolbar 提供独立的新建绘画作品入口, 与 Markdown 文档入口分开; 创建新的图层文档 D 和独立节点后打开全屏编辑器。已有作品从其图层文档节点重开, 具体采用编辑按钮或双击由 03D 按现有交互约定明确。退出恢复原 Canvas 视口/选择, dirty 时经过保存/放弃/取消。当前 03C 的查询参数与 Direct/iframe 按钮只是实验入口, 不能作为正式交付入口。图片节点双击不转型; 图片 A 保留原身份, 显式加入 D 后记录其 Artifact/源 payload/hash, 后续修改 A 不悄悄改变已保存作品外观。实际引用、删除保护与保留规则必须接入原平台 owner, 不能仅把 ID 写进 JSON 就当引用完整。

建议 native schemaVersion=1 的 manifest + 二进制内容块作为平台 payload, 不直接序列化 TS 类。通用 codec 描述图层树、画布/色彩、文字/路径/调整/蒙版与通用资源来源; ADA-specific 身份映射与受约束来源扩展由 adapter 负责, codec 不解释平台权限或调用数据库。内容块保存像素及必要内嵌资源。包容器/块编码与 ADA kind/role 在各自 owner 设计时确认, 不建内容寻址存储或永久版本库。

当前 `fileOps` 和 autosave 主要经 PSD/PSB 保存恢复, 有 `snapshotDocument` 不等于已有可持久化 native codec。新增 codec 是明确工作量; 若评估改用 PSD 加 sidecar 过渡, 必须证明首版信息能恢复且只有一个权威载荷, 不能静默以 PSD 取代原生文档目标。

- 有修改的成功保存更新同一 D, 以 expectedRevision 拒绝旧写入; 无变化不增加持久修订。命令历史步骤不等于 D 的修订。
- binary 文件先暂存, 数据库/索引通过原 Artifact owner 确认后才发布新修订, 失败保留上一完整版本; 不出现新 manifest 配旧像素。沿用其原子可见边界, 不另建事务服务。
- 预览绑定准确的源 revision/hash。迟到预览不能覆盖新版; 预览失败可重试, 不冒充保存成功或发布第二个 D。
- 首版手动保存与生成捕获期间短暂保护目标会话, 结束临时交互并取得稳定检查点; 不锁整个 ADA。保存失败/冲突保留 dirty、恢复材料与编辑会话。
- ADA 恢复、保存与编辑器原 autosave 不得成为两个正式写入者。embedded recovery 沿用同一捕获入口, 在 Profile/Project/D 范围保存本地恢复候选; 未确认写入的候选不能标 clean, 不含糊地覆盖正式 D。
- 返回 Canvas、真正切 Profile/Project、实例重启和关闭应用遵守同一保存/放弃/取消流程。宿主拦截导航, 不只依靠 beforeunload。同 Profile/instance 的自动续期不进入关闭流程, 保留 dirty/历史/视口; 失败也不丢编辑。切换后的旧回调不得跨边界读写或挂回新界面。
- 本地导出 PSD/PNG 不自动创建 Artifact、不改变原 D 的保存点。另存为独立作品才创建新 D。

## 5. 画面合成、Three.js 与后续 3D

ADA 外层 XYFlow 不合成作品像素, 它消费作品预览。因此接入 ADA 本身并不要求把 WebPainter 与另一套外层 GPU 合成器统一。本轮在目标前端依赖中未发现 Three.js, 现有 `3D` 节点/生成类型也不能证明已有可复用的三维编辑器; 后续先清点实际实现。

初始复用 WebPainter 的 WebGPU 合成和 CPU 回退, 不再增加 PixiJS 或重写为 Three.js。未来 3D producer 应放在作品编辑器一侧, 把当前视角内容放进原图层位置, 继续经过蒙版/透明度/混合及上方调整; 不是把一个 DOM canvas 叠在作品顶上。

共同文档要保留模型来源、相机/姿态/材质等可编辑参数, 与派生画面分开。共享作品历史顺序, 不把三维操作记在另一条独立 undo 栈。首版不必提前添加空 3D schema 或通用插件系统。

Three.js 与现有 WebGPU 纹理不假设直接互通。后续用一个 GLB、下方图片、上方线稿、一个蒙版/调整组合做有限验证: 转动中画面正确、停下后导出一致、资源可释放。记录传递方式、读回/上传成本、分辨率和实际更新延迟。禁止以每帧 PNG 编解码或仅显示控制框冒充实时混合能力。

该验证在大规模 renderer 绑定开发前做, 不要求完成正式 3D 功能。结果不佳时另作三选一评估: 优化内容桥接、迁移部分合成到共同底座、延后 3D 并明确影响。不得把二维优化 Go 直接当成三维方案 Go, 也不自动重写整个编辑器。Vizcom 是方向参考, 不是必须复制的底层依赖。

## 6. 编辑器内生成

首版从上述底部 ADA 悬浮面板输入提示词、选择模型并提交, 在编辑空间内查看进度、失败和 Results, 无需进入 Session 或发起 Agent 对话。模型选项/可用性、生成命令和 Artifact 读取复用 ADA 现有 owner; 无可用模型时明确显示状态, 不阻断普通编辑。03E 负责正式接线, 不是在 WP 内增加独立 Provider 客户端。

固定 D 的成功保存检查点 r, 从同一内容产生不可变合成快照 S。S 为正式图像 Artifact, 实际生成 reference 指向 S, 来源记录指向 D/r; 继续编辑不会改变已提交请求。捕获和保存之间不得混入另一版像素, 有效 Move/文字应按同一输出规则结束。保存/快照失败不启动 Provider。

生成仍走 ADA GenerationRuntime 和 adapter, 不在编辑器直连 Provider。请求捕获原 Profile/Project/D、S 和交付目标。结果 B 发布后进入原作品 Results, 持久关联原生成记录; 不自动建图层/Canvas 节点, 查看候选也不改文档。用户点添加才走作品命令入栈; undo 移层不删除 B。

先验证 editor-origin 交付, 不先沿 canvas-origin 生成再删除或隐藏自动节点。发布成功但 Results 关联失败属于交付恢复, 重试使用原执行/结果身份, 不重复付费生成。关闭/切作品后仍投递原 D; D 被删除时保留已发布资产并呈现可恢复的交付失败, 不重定向新活动作品。

Results 归平台生成/作品关联, 不随每次 native 文档保存复制。Gallery 分类与快照默认可见性继续暂缓。未来 ComfyUI 与本地 LLM 属于原 provider owner, 首版不新增 adapter 或 Agent 编辑工具。

## 7. 离线、PSD 和交付边界

程序、字体、笔刷、WASM、worker、色彩资源和导出依赖随本地包部署, 编辑/保存/恢复/PSD 不访问公网。未配置 AI 时只禁用生成入口, 不影响编辑。嵌入版本不携带独立更新器、原作者服务地址或第二套 Electron。

PSD 复用已安装的 ag-psd 与现有导出管线; 约定每种首版层是可编辑导出还是明确栅格化, 对用户说明损失。未来模型图层可保留 native 参数并将 PSD 对应层栅格化, 不承诺 PSD 内仍可旋转。Photoshop 打开与导出后复合画面检查单列, 不以写出文件成功代替。

WebPainter 以固定 commit 的构建产物及协议版本随 ADA 打包, 保存来源/许可说明, 不运行时拉 GitHub、不链接开发目录。不先建设 npm 发布平台或统一两个仓库的发布节奏。升级时测试 native schema、桥协议和用户文档恢复; 原品牌图标/第三方资源分别核查, 不因 fork 就假设分发清单已完成。

## 8. 共用任务与承载分叉

任务索引与依赖归 [父任务 03](../ai/tasks/2026-11-06_03_ada-integration-architecture.md)。用户已要求向下拆分, 子任务共六项；本轮仅 A/C 获有限实施授权，其他仍待授权:

| 任务 | 主要代码/合同 | A/B 共用程度 |
| --- | --- | --- |
| 03A 编辑边界与宿主端口 | embedded lifecycle、DTO、输出/关闭边界、能力清单 | 共用核心; DOM 绑定细节交给 03C |
| 03B 原生文档 codec | 受支持图层、像素/蒙版/文字/路径/参数往返 | 基本全共用 |
| 03C 全屏承载比较与选型 | A mount、B 消息/iframe、焦点/资源/样式与构建 | 主要分叉, 只做薄对照后选一个 |
| 03D ADA 作品闭环 | Artifact 保存/引用/恢复、Canvas 节点/预览、核心编辑入口 | 业务共用, UI 接入由所选承载适配 |
| 03E 生成与 Results | 检查点/快照/生成/交付/显式加层 | 业务共用, 端口传输方式不同 |
| 03F 离线与 PSD 产品验收 | 本地资源、打包、PSD 约定、手绘板 4K 作品 | 场景共用, 最终只验所选承载 |

Three.js 正式编辑另开后续任务。03C 只附带一个有界内容输入探针, 记录未来桥接成本, 不重写 renderer。采用约百人产品的最小复杂度: 一个活动作品、一条历史、一个正式保存 owner、小型端口与能力列表。不开版本管理、协作合并或插件平台, 不为候选 B 强迫所有内部业务对象做 JSON 往返。

## 9. Current Evidence And Remaining Decisions

本轮为静态源码/文档核对, 未执行嵌入、Provider、PSD 或离线测试:

| 已核对 | 本地源码入口 | 仍待确认 |
| --- | --- | --- |
| 独立 boot 有全局服务, 不是 mount SDK | WebPainter `src/main.tsx`, `src/app/platform/platform.ts` | embedded entry 与本地页面生产可行性 |
| DocumentSession 有 history/engine/保存保护 | `src/app/session.ts`, `src/app/fileOps.ts` | 宿主保存/恢复的适配覆盖 |
| 已有 PSD 导入导出, 无现成 native 文档包合同 | `src/formats/registry.ts`, `src/app/autosave.ts` | schema 子集、包格式与恢复证明 |
| 两端 React 主版本不同 | 两仓库 `package.json` / ADA `apps/web/package.json` | 隔离页面的实际输入与 GPU 表现 |
| 平台已有 Artifact 修订/载荷/发布 owner | ADA `apps/api-node/src/artifact-store.ts`, `packages/contracts/src/index.ts` | 图层文档类型、引用与 CAS 扩展 |
| 现有 Markdown 创建/保存有捕获身份与恢复处理 | ADA `apps/web/src/project/services/canvas-document-creation-command.ts`, `canvas-document-save-command.ts` | 复用边界而非复用 Markdown body API |

当前已确认独立全屏产品界面及本地 iframe 承载; 首版具体工具与原生保存合同由 03B/03D 冻结并验证。Three.js 内容传递仍是有界验证问题。任务拆分不自动授权执行。
