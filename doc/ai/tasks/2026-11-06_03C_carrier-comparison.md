# Task 03C: 独立全屏承载 A/B 有限对照与定案

## Bottom Panel Bounded Prototype

2026-11-06 新一轮授权：仅底部 ADA 悬浮面板与受控链路补验，允许在当前分支分阶段本地提交。此前两项 P2 独立复审 Approved，保留其回归。承载尚未确认，03B/D/E/F 未获实施授权。下方旧报告仍按原包/原阶段理解。

开工核对：WP `integration/embedded` / `3a04360b6c74c0539d4e058b55fe54310cd4fe61`；ADA `codex/isolate-drawing-interface-20261104` / `feac5a452c39ae5c1dcccd10ddcffc5a8395b8e3`，两边干净，未用 `_New`。WP main 与 merge-base 均为 `ef3eea87beb00b2c79c6f1e4902e4a5739ef8557`。

阶段 1（通用挂载）：WP client 只增加懒加载 `mountPage`，让 ADA 自有 iframe 页面可在同一 document 组合 WP 和 ADA 面板；原 mountDirect/mountIframe 与独立入口保留。没有 ADA 模型/Provider/Artifact 代码进入 WP，没有新增插件框架。构建 manifest 改为报告实际 dirty 和 main merge-base，避免把已提交源码或已移动 main 冒充旧包版本。

阶段检查：WP typecheck、embeddedLifecycle/embeddedRpc **9/9** 通过。下一步先提交此通用入口，再从干净的确切 commit 重新构建固定包，ADA 校验并复制后验证两条路径。最终本轮证据、配套提交及未验收项在本节续记；阶段提交不是验收。

### Panel Prototype Final Evidence

本轮面板与受控链路已实施、统一自查通过，**等待 ADA集成-REV 一次独立 review 与 Owner 承载选择；总体仍 Inconclusive**。两仓库运行代码阶段分别为 WP `c9acf842177d624e1b972d650865811169892bfc`、ADA `d8ea30df`/`61ac16577653b8c652c5194d8bbb5ada246e90f7`；最终详细证据、命令和成本比较由 [ADA 本轮记录](../../../../auto_design_Agent/doc/ai/tasks/2026-11-06_03AC_webpainter-carrier-prototype.md#bottom-panel-bounded-prototype) 拥有。本仓库仅通用入口/manifest 与必要记录，不含 ADA 面板业务；后续文档提交不改变源包标记。

| 配套 / 验证 | 本轮实际结果 |
| --- | --- |
| WP main ref / merge-base | `ef3eea87beb00b2c79c6f1e4902e4a5739ef8557`，未移动 |
| 新 embedded 构建 | 干净 `c9acf842177d624e1b972d650865811169892bfc`，`uncommitted=false`；bundleHash `f6e695f341b151a5858d8a3444475f0d177e8342b20cd0f0d9809b09876a1088`；sourceHash `7e430e67013d3b4d55a823c4ca1a511d1b77dbeb970212cb9eb54196dd2d8f23`；port=1/native=null |
| 固定包验证 | 175 文件、13,060,109 bytes，WP dist / ADA public / ADA dist SHA256 一致。旧包 53ef5988… 不追认为新 commit 构建 |
| ADA 最终构建 | 从干净 `61ac1657` 执行；main ref/merge-base `3c70a6d57ccaed56dd15566ad4b946f666cac85b`；非 desktop 发布包 |
| WP / ADA 必要门槛 | WP `npm run build`（含类型、renderer、Electron）、端口 lifecycle/RPC **9/9**；ADA typecheck/build、面板合同/失败重试/RPC 自测、旧壳和 P2 **29/29** 通过 |
| 面板实窗 A/B | **2/2**：同模型、提示词、4K 作品与笔画；输入隔离、画板恢复绘画、受控快照/预览、关闭重开、原 DOM/测试上下文与后台诊断键恢复通过。1440×1000 / 820×600，收起48px，小窗可继续绘画和 Return |
| 快照证据 | 作品 SHA256 仍 `6412ae9b…`；笔画前后快照摘要不同，A/B 笔画后均 4,083,139 bytes / SHA256 `a2c18d6d23ab4c0946277a02054bf909affe069fc0c83c4d109c6ffc1cad9b0d`。预览固定 640×360 SVG，不改历史/加层，不发布 Artifact |
| 已审 P2 保留回归 | 新包/最终构建定向实窗 **6/6**，真实 dirty 场景 32 次取消保留文档，明确 Save/Discard 通过；不是旧包结果复用 |

A 使用 WP Shadow root 与 ADA 自有 Shadow 面板，直接调用受控合同；B 使用 **ADA 自有 iframe 页面**，在同 document 挂 WP mountPage 与完全相同面板，有限 DTO/RPC 回父宿主，不在父页装第二个活动内核。原通用 mountIframe 保留兼容，当前 B 补验不再直接打开 WP 的 embedded.html；不是在包内注入/修改业务代码。

**工程暂推荐 B，未替 Owner 定案。** A 少业务 RPC，但仍需持续治理共页 window、CSS/portal、React roots 和 composedPath，实窗 WP 字号/排版与 B 有差异；B 更接近 WP 常规页面，成本转为 ADA 页面/RPC 签名、握手/释放和 CSP/焦点验收。面板/业务合同本身一份。B structured clone 仍复制快照；A/B 都需稳定合成/PNG 编码，不以单次耗时认定快慢/零开销。

**Pending / Inconclusive**：人工真实 IME、原生下拉/焦点手感、手绘板、剪贴板/拖放、全快捷键/极端窗口；正式 ADA Electron/CSP 与真实业务 Session/Canvas/Gallery 上下文；离线冷缓存/长时 GPU/驱动内存。测试仍用 WP Electron 44.4.5/Chromium 152、RTX A5000、可见临时 profile、测试 app 协议/CSP，composition 是脚本事件；普通后台 Profile 探测被测试 CSP 在网络前拦截，未访问业务数据库。不能代替人工验收或证明全 WP 功能/格式可恢复。native/Artifact/Results/真实 Provider/加层及 GLB 未实施或补验。

最终原始材料只在被忽略目录：ADA `.packaging/wp-03c-panel/final-{window,p2-window}/results.json`、截图/日志及 `final-versions.json`，WP `doc/material/03c-panel-{build,tests}.log`；不混入提交。双方分别本地阶段提交，无原子跨仓提交，未开新分支/推送/合并/发布。向 ADA集成-REV 发送一次统一 review 后暂停，03B/D/E/F 未推进。

## Status

Finite prototype complete / **Inconclusive**，2026-11-06。Owner 本轮授权仅 03A 与 03C 有限原型/测试。依赖 [03A](2026-11-06_03A_editor-boundary.md)，没有实施 03B、03D/03E/03F。等待独立 review、Owner 确认承载及后续授权。

后续状态补充（2026-11-06）：独立实现 review 为 **Changes Requested**，两项 P2 见下节。Owner 随后确认沿用 WP UI、增加底部 ADA 悬浮面板并要求调整任务文档。以下新增验证尚未执行，本次仅调整文档，不授权继续代码实施；原实测报告保留其原范围，承载仍未定案。

## Task Brief

产品界面已确定: 编辑时遮住 Session/Canvas/Gallery, 返回时保留原上下文。只比较 A 同页面直接挂载和 B 本地 iframe 的工程代价/实际表现, 不做两套完整功能, 不先冻结 iframe。

## Branch Scope

嵌入 boot/root/message 构建入口在 WP integration/embedded; ADA 的全屏壳与业务适配在指定 ADA worktree。main 不承接 A/B 实验; 确需修复通用内核先回 main。ADA 消费固定 commit 构建产物, 可用本地未发布包做验证, 不能把活跃源码目录作为生产路径或直接改包内代码。

## Owners And Change Contract

- WebPainter 负责嵌入入口/生命周期, ADA 专用全屏壳负责进入退出。工作范围跨两个仓库, 未来执行需相应授权及分别检查 dirty, 不改相邻 `_New`。
- A 使用最小 root/mount 适配, 验证 React 18/19 兼容或隔离 root; 清理 CSS/document/window 全局作用, 不通过全局升级 ADA React 掩盖问题。函数调用使用同一异步宿主端口。
- B 只增加本地页面、消息 DTO 校验/请求关联、source/origin/握手/代次及释放, 使用同一端口业务。部署源按实际 Electron/本地资源方案确认, 不依赖开发 URL 或第二个 Electron。
- 共用固定 main base/embedded commit、非均匀 4K 作品与操作轨迹。记录包 hash、端口/native 版本和 ADA commit, 随包资源不来自临时源码路径。保存传输可用同一独立输出或既有 PSD 测试字节, 不声称为最终 native 保存。
- 比较独立正常入口、A、B: 启动/重开、真实连续绘画/选区拖动、准备/松手停顿、输出端到端耗时与峰值内存。记录真实后端、构建模式、资源大小及主要复制/编码位置, 不用指针事件/rAF 数量冒充完整 FPS。无预设“无损耗”或固定百分比结论。
- 手绘板压力、IME、快捷键、剪贴板/拖放、缩放和焦点只做有限必要人工验证; 切回 Canvas 后原键位恢复, 后台普通工作区不抢输入, 不被编辑器重复卸载重建。
- 先静态核对实际三维 owner。用一个 GLB 在编辑模块侧输出透明内容到原图层位置, 上方线稿与一个 mask/adjustment 组合做一次有限探针, 不做持久化 3D 类型或全套工具。若显著超出薄验证范围, 记录具体缺口和后续估算, 不偷换成顶层 DOM 覆盖。未跑通不能写作三维可用。

## Decision Gate

### UI Clarification And Bounded Follow-up

- 按 [集成架构](../../architecture/ADA_INTEGRATION.md#2-部署边界-独立全屏编辑空间-承载方式待比较) 复用 WP 上方面板/左工具栏/右图层/中间画板, 只增加底部 ADA 悬浮面板。面板包含提示词、模型选择、生成按钮与结果查看入口, 无 Agent 对话; 不要求本阶段制作专用 WP UI 或完成全部能力裁剪。
- ADA 拥有面板代码, 记录其如何消费固定 WP 包并组合编辑页面; B 的面板与 WP 位于同一 iframe 页面, A 使用对应全屏编辑容器。WP 仅补确有需要的通用挂载/端口能力, 不导入 ADA 业务。两个候选共用一份薄面板与业务合同, 不开发两套生成产品。
- 获后续实施授权后, 在已有 A/B 场景各补一条受控链路: 模型选项/提示词输入 -> 捕获当前合成图 -> 宿主命令 -> 返回受控状态和测试资源 -> 面板预览。模型与资源可用固定夹具, 不接真实 Provider/业务数据库, 不实现 native 保存、正式快照 Artifact、Results 持久化或完整生成流程; 显式加层的正式闭环归 03E。记录所需端口缺口, 不将夹具往返称为 03D/03E 已完成。
- 定向验证提示词 IME/快捷键不触发画板或后台操作、模型下拉与结果预览的焦点/弹出层、回画板后绘画恢复、底部遮挡及窗口缩放、返回后原上下文保留。只补受影响构建/输入/通信/生命周期证据, 不重跑无关完整性能矩阵; 缺少人工设备证据仍标 Pending/Inconclusive。
- 原型 review 两项 P2 须先修复并复审: (1) ADA `apps/web/src/experiments/wp-carrier.ts` 打开期间 Return 可在 api 尚未就绪时退出, 迟到打开遗留隐藏活动编辑器; 最小处理为打开/关闭互斥或取消代次加迟到资源释放, 覆盖延迟加载/挂载与重复关闭。 (2) 同文件确认框直接将文本转 Number, 非数字/越界值可能被 WP closeSession 当成放弃修改; 使用明确按钮或严格整数范围校验, 非法输入按取消处理, 覆盖 dirty 文档不丢失。review 已重跑 WP 生命周期/RPC 9 项及 ADA 壳自测, 均通过但未覆盖上述缺口; 延迟加载 Return 与非法输入已有定向复现。该句为首次评审时点；本轮仅两项 P2 修复的状态见下方 [P2 Repair Only](#p2-repair-only)，面板补验未实施。

### Selection Gate

输出一份短比较表: 可行性、首次适配工作、内存/延迟、输入体验、平台资源与释放缺口。两者都可行时选择整体适配/维护成本较低且手绘体验符合要求的一种, 不只比较函数调用耗时。若均不可行则如实报告, 不自动重写 renderer。定案回写架构/ADR, 删除或隔离落选实验入口, 生产只保留一条承载路径; 不要求永久维护双 adapter。

比较表补充 ADA 面板与固定包的组合成本、宿主命令/资源通信和输入隔离证据。完成修复及获授权的补充验证后, 将配套版本、证据和未验收项发给 **ADA集成-REV** 独立 review, 然后暂停。review 通过不替代 Owner 的承载选择及下一阶段授权, 不自动进入 03B/D/E/F。

比较还须包含侵入独立主线的范围与后续 merge 冲突面, 不把易维护性等同于零改动。若 03B 后续更新了 main/embedded 基线, 刷新包与版本记录并重验受影响路径, 不把旧包验证结果追认到新包。

## Validation

WebPainter P-BUILD/P-MOVE + ADA web 类型检查、生产资源构建及受影响全屏挂载/导航定向测试。实际命令以开工时两个 package.json 核对, 不照搬另一个 worktree。至少一次固定环境实窗对照及连续开关资源/事件检查, 无 GPU/手绘板条件则结论标 Inconclusive, 不以 jsdom 通过定案。3D 探针结论与二维承载结论分开。

## Execution Report

### Result And Recommendation

**总体 Inconclusive，工程上暂推荐 B 本地 iframe，尚未定案。** 两种薄入口均已在本机可见生产资源窗口运行同一 4K 场景；缺少真实手绘板、人工 IME/焦点/剪贴板与完整显示延迟证据，不能确认哪种满足汽车 sketch 手感。没有删除候选或创建正式双产品；A/B 只保留在隔离实验入口，普通 ADA 没有新作品编辑功能。

| 维度 | A 直接挂载 | B 本地 iframe |
| --- | --- | --- |
| 有限可行性 | 独立 React 19 root 运行于 ADA React 18 页面；Shadow DOM 显示作品，鼠标/undo/redo/PNG/关闭重开通过 | 同源 `app://auto-design-agent` 页面握手后使用同一 session/端口；相同场景通过 |
| 首次适配 | Shadow CSS、内部 portal、键盘 surface/composedPath、宿主快捷键边界；触及 App/CanvasView/Toolbar/Menu/Workspace | 握手 source/origin/version/nonce、MessageChannel、DTO allowlist、请求关联/超时/释放；不把编辑事件发到父页面 |
| 后续维护 | 上述共享 UI 文件的变更须持续复验；实窗 A 字号/排版与独立/B 仍有偏差，不能声称视觉适配完成 | 页面天然保留原 CSS/document/window 作用域；主要冲突面在 boot/端口/消息 adapter，升级仍需协议与输入回归 |
| 平台资源 | 本地相对资源；WASM 需要配套 CSP | 相同资源；额外需要 iframe CSP、握手和 iframe 权限/焦点验收 |
| 复制位置 | 宿主函数调用；仍需 CPU stable snapshot、合成和 PNG/PSD 编码 | 相同 CPU 编码；资源读取/输出跨 MessagePort structured clone，未 transfer，存在额外字节复制 |
| 资源释放 | 卸载 root/effects、清工具缓存与字体监听、恢复宿主服务；realm 的 GPU/CMS/font cache 可保留 | await destroy 回执后断开 port/删除 frame；不保证独立渲染进程或安全隔离 |

推荐依据是 B 更少依赖独立主线 UI 的长期全局治理。本轮单次耗时接近，**不能用它判定 B 更快或 A 零损耗**。B 的 CSP 与真实设备验证成本仍必须计入。若手绘/IME 后续不满足要求，应再评估；本轮没有自动切换路线或重写 renderer。

### Frozen Package / Environment

- WP main base / 当前 embedded HEAD 均为 `ef3eea87beb00b2c79c6f1e4902e4a5739ef8557`；分支 `integration/embedded`。**新增代码未提交**，`embeddedCommit` 仅标记父基线；实际原型由 sourceHash `04144b8195f66a8c1550a833db9cebf01b748a683a7cbf9ab8f67d12e8968dde` 固定，不能称为已发布的 fixed-commit 包。
- bundleHash `53ef5988d621b36466510595e636ccc6d746d1953a0331c2133bc697eb333941`，portVersion=1，nativeVersion=null；manifest 内逐文件 SHA256。包内容共 13,059,391 bytes，排除 sourcemap 4,057,343 bytes，包含实验 standalone 入口；不是实际启动下载量。
- ADA `codex/isolate-drawing-interface-20261104`，HEAD `e9f458930f250191ef35d2efae3734cca4573351` + 本轮未提交实验壳。包复制至 `apps/web/public/experiments/wp-03c/<bundleHash>/`，运行时不读取 WP 活跃源码目录；pointer 在 `src/experiments/wp-carrier-build.json`。正式固定提交/打包闭环未满足，不能日常集成。
- Windows，本轮测试 Electron 44.4.5 / Chromium 152.0.7977.130；adapter 报告 nvidia / ampere，系统 GPU info 列出 RTX A5000。ADA 仓库安装的 Electron 版本不同，**正式 ADA Electron host 未验收**。同源 iframe 与父页面本轮共用 Tab renderer，不能宣称 CPU/崩溃隔离。
- 同一个确定性 4096×4096 RGB8 PSD，非均匀参考 + 透明线稿及 mask + curves，3 层；SHA256 `6412ae9b19167be83c076e66bc6eb4a50f36f58cb3ee0bb3a28bba7694303318`。不是 5–10 层/真实汽车作品矩阵。独立/A/B 均固定测试缩放 35%、相同文档坐标笔画和 1500×1500 选区轨迹。
- 每种入口使用独立 Electron 进程和临时 userData；visible=true、sandbox/contextIsolation=true、无 Node 暴露。测试关闭后台节流，避免窗口遮挡令 rAF 暂停；这不是普通用户默认桌面条件。

### Actual Window Measurements

最终包各一次受控运行；下面是诊断值，非统计结论或真实手感。启动值包括刻意等待 1.5 秒和脚本检查；松手值是发出 mouseUp 到脚本确认 Move 不再 active 的观测，非光学显示延迟。100ms 采样内存是进程 working set，不是 JS heap/独占内存/VRAM；可能漏掉瞬时峰值。

| 项目 | 正常 standalone boot + 测试装载钩子 | A | B |
| --- | ---: | ---: | ---: |
| 打开/viewport 检查（ms，含等待） | 3260 | 3672 | 3867 |
| 松手至 Move 结束观测（ms） | 207 | 200 | 203 |
| PNG 端到端捕获（ms） | 4570 | 4765 | 4643 |
| PNG bytes | 7,040,236 | 7,040,236 | 7,040,236 |
| 活动 Tab 采样峰值（MiB） | 1127.8 | 1056.1 | 1120.9 |
| GPU 进程采样峰值（MiB） | 255.3 | 248.3 | 252.0 |
| Ctrl+Z / redo history index | 2→1→2 | 2→1→2 | 2→1→2 |
| 3 次关闭后的 iframe/canvas/inert | 不适用 | 均 0/0/false | 均 0/0/false |

三者均为 WebGPU compositing，拖动时 `gpu.floating=true`；真实鼠标事件连续笔画使 history 从初始变为 2，Move 提交后为 3。测试未把事件数量/rAF 数量当 FPS。`prepareObservedMs` 原始字段只量到输入排入队列（0–1ms），**无效于准备停顿评价，不用于决策**。尚未取得真实准备/事件到显示完整延迟；字节数相同不等于逐像素或色彩一致性证明。截图仅核对确实显示内容与本轮操作，不替代像素验收。

最终原始 JSON/截图位于 ADA 本地 `.packaging/wp-03c-final-evidence/{standalone,direct,iframe}/`；重跑脚本为 ADA `scripts/wp-carrier-window-probe.cjs`。早期试跑目录不是最终证据：修正了脚本最后窗口退出、回传函数不可克隆、遮挡节流、以及只改响应头而遗留 HTML meta CSP 等测试问题；早期不支持的 brightnessContrast 场景走 CPU Move，最终 curves 场景才确认浮动 GPU 路径。

### CSP / Resource Evidence

现行 ADA `apps/web/index.html` meta 和 `apps/desktop/src/main/main.ts` 响应头均包含 `frame-src 'none'` 与 `script-src 'self'`。实窗先验证 iframe 被 CSP 阻止。本轮仅测试协议响应同时替换 HTML meta/header 的 `frame-src 'self'` 和 `script-src 'self' 'wasm-unsafe-eval'` 后完成 A/B；**正式源文件策略未改**。最终场景 errors=[]；不覆盖 RAW、全部 worker/字体资源或离线冷启动。WASM 许可对 A/B 都是缺口，frame 许可是 B 额外缺口。

### 3D Probe — Inconclusive

静态核对 ADA 现有 3D owner：`NodeView.tsx` 的 Mesh·GLB 是不可执行的生成占位面，apps/packages 中未找到 Three.js/GLTFLoader/model-viewer runtime 或依赖；WP `LayerKind` 也没有 3D producer。没有可直接复用的模型加载/透明输出 owner。

本轮没有新增 3D 引擎依赖，**未运行 GLB → 透明图层 → 上方线稿/mask/adjustment 的探针**。缺口是本地 loader/模型资源、相机 framing、透明/色彩/预乘及方向约定、readback→TiledRaster 输入与资源释放；不是把 GLB 放在 DOM 顶层就能证明合成。估算后续单模型薄探针约 1–2 工程日（粗估，非承诺），需获得进一步范围确认；不做持久 3D 类型或完整工具。本结论与二维承载可行性分开。

### Validation / Stop Gate

- WP 36/36 定向检查、integration P-BUILD、embedded build；固定 main archive P-BUILD 与独立原生 smoke 均通过，见 03A。
- ADA `corepack pnpm --dir apps/web typecheck`、`build`、`exec tsx src/experiments/wp-carrier.self-test.ts` 通过。壳测试验证保留原 root/子节点、不重挂载后台、关闭 Cancel、await destroy 与重复返回；实窗三次循环未遗留 overlay canvas/frame，背景 inert 恢复。真实 Canvas 业务键位/内容恢复仍未人工验收。
- 未验收：真实手绘板压力/延迟/长线手感，人工 IME/焦点/拖放/剪贴板、全部快捷键，真正准备及显示延迟、GPU 驱动内存释放/长时间压力、正式 ADA Electron/CSP、完全断网冷缓存、Photoshop、native/CAS/恢复/生成/Results、GLB 探针。没有使用真实 Provider、用户作品或业务数据库。
- 新代码和固定包为本地未提交原型。没有提交、推送、合并、打包发布或修改 `_New`。已按 Owner 明确授权向 **ADA集成-REV** 发送变更范围、任务记录、验证结果和未验收项；发送成功不代表独立 review 已通过。
- **03C 到此暂停。** 等待独立 review 与 Owner 承载确认及下一阶段授权；本轮不启动 03B/D/E/F。之后按 B→D→E→F，03B 改基线后刷新包并重验受影响路径。

### Reproduction (Local Test Only)

1. WP：`node scripts/build-embedded.mjs`。
2. ADA：`node scripts/prepare-wp-carrier-probe.mjs <WP>/dist-embedded`，再由 WP 执行 `node scripts/run-ts.mjs scripts/embedded-fixture.ts <ADA>/apps/web/public/experiments/wp-03c/fixture.psd`。
3. ADA：`corepack pnpm --dir apps/web build`，使用 WP 安装的 Electron 运行 `node <WP>/node_modules/electron/cli.js scripts/wp-carrier-window-probe.cjs .packaging/wp-03c-final-evidence/<mode> <mode>`，mode 分别为 standalone/direct/iframe。每个进程自行退出，素材和包均为本地测试资源。
4. 上述会重建快照；不同源码产生不同 hash，旧报告不得追认至新包。

### Review Request Receipt

2026-11-06，已通过 session 消息工具成功发送至 ADA集成-REV（thread `01a1b03a-dc79-7fa1-a048-812fd8e4595d`）。请求包含两仓库范围、36 项检查、固定包/原始证据、工程暂推荐 B 和完整未验收项。未收到或代写独立结论；本实施 session 已暂停，不再推进后续阶段。

## P2 Repair Only

2026-11-06，Owner 仅授权修复上述两项 P2，**已实施并自查通过，待独立复审**。底部面板及其他 03C 补验、03B/D/E/F 不在本轮授权内，均未实施，整体仍 Inconclusive。

代码只改 ADA 实验壳：Return 等待完整 load/mount/open、合并重复关闭，销毁完成前保持背景 inert；确认输入严格校验十进制选项整数及范围，非法值一律 Cancel。没有改 WP 内核、port/native 版本或固定包，没有通用队列或业务接线。

完整变更范围、两仓库基线/dirty、文件 SHA、命令及证据归 [ADA 本轮修复记录](../../../../auto_design_Agent/doc/ai/tasks/2026-11-06_03AC_webpainter-carrier-prototype.md#p2-repair-only)。本轮新增回归先复现 22 项失败，修复后 29/29；原壳自测、ADA 类型/构建、WP lifecycle/RPC 9/9 通过。固定包 A/B 可见窗口 6/6 延迟阶段退出/释放/重开通过；真实 dirty 文档 32 次非法值/Cancel 保留原 session/history，明确 Save/Discard 可关闭。没有把原全量/性能证据追认成本轮重跑。

配套仍为 WP ef3eea8 / ADA e9f45893 + 未提交壳修复，bundleHash `53ef5988d621b36466510595e636ccc6d746d1953a0331c2133bc697eb333941`，portVersion=1、nativeVersion=null。WP src 与开工快照相同，175 包文件 SHA 校验通过。两仓库现有分支/HEAD 不变，保留既有修改；无新分支、提交、推送、合并或发布。

实窗为受控测试，未人工验收 prompt/手绘板/IME 等输入，也未验证 GPU 驱动内存归零或正式 ADA host/CSP；原未验收项不变。Return 等待打开完成而非取消底层加载。待向 ADA集成-REV 发送复审请求后暂停；复审通过不自动授权底部面板或 03B/D/E/F。

本轮 P2 复审发送回执：2026-11-06，已成功发送修改范围、配套版本、验证及未验证项至 ADA集成-REV（thread `01a1b03a-dc79-7fa1-a048-812fd8e4595d`）。发送成功不代表 Approved；本实施 session 已暂停，等待独立复审和后续授权。

## P2 Independent Re-review And Commit Handoff

2026-11-06，ADA集成-REV 独立复审结论为 **Approved，仅限本轮两项 P2 修复**，审查范围内无剩余 P1/P2。Return 等待完整打开并合并重复关闭；非法确认输入按 Cancel 处理。reviewer 实际重跑新增回归 29/29、原壳自测、WP lifecycle/RPC 9/9、ADA typecheck，均通过；核对 175 个固定包文件哈希及 WP src 与修复前快照一致。已审阅 coder 的 6 组实窗记录和真实 dirty 文档证据，本次复审未重跑实窗或完整构建。

Owner 随后明确授权将两仓库当前集成规划、原型及修复提交并推送，工作区干净后交付下一阶段 coder instruction。提交目标为当前工作分支及各自已配置的 origin 推送地址，不合并 main/dev、不发布。本次仅补交接记录并提交现有工作，不实施底部面板或 03B/D/E/F。实际提交号与远端核验结果以本次交付回执为准。

03C 总体仍 Inconclusive，承载未定案；现有包未重建，其 manifest/pointer 继续记录原父基线和未提交原型状态，不因源码提交而追认为新 commit 构建。后续仅按单独授权补 03C 底部面板与受控通信验证，完成后交 ADA集成-REV review 并等待 Owner 选择承载。人工输入/手绘板、正式 ADA host/CSP、离线等原未验收项不变。
