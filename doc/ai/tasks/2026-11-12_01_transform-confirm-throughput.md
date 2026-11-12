# Ctrl+T 正式确认耗时优化

日期：2026-11-12。状态：**已按Owner授权完成实施、测量与规定验证；吞吐目标达标，待独立实现review；Owner已反馈提速明显，2026-11-12另授权架构文档维护、本地提交并推送origin/main，不推进embedded/ADA或发布。**

## 1. 目标与基线

工作目录 `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter_main_native`，预期分支 main。本次核对 HEAD 为 `b01dcb79922279744de987d7fce1c4a2454f2390`，开始时工作区干净。实施前重新核对分支、HEAD、dirty 和适用 AGENTS；保留其他人的改动，不切换工作树，不操作相邻 `_New`。

承接 [Ctrl+T 后台确认与透视预览](2026-11-11_02_transform-commit-and-projective-preview.md)。Owner 已观察实时透视调整流畅，但 Enter 后 Applying transform 等待明显。本任务降低**正式确认总耗时**，保留当前预览、正式像素、历史、取消与输出交接规则。提示窗本身不是优化目标，不通过隐藏进度或提前宣告完成改善指标。

既有证据与当前判断：

- 前任务同机 4K 非均匀透明夹具正式确认总耗时约 6.8–8.0 秒，重采样、量化和块整理约 6443–7645ms；源复制约 36–44ms，源 ACK 等待约 25–50ms，安装/历史约 0.2–0.6ms。分段存在包含关系，不能相加。
- 这些来自前任务原始窗口记录，不是本任务新基准。它们支持优先调查 Worker 内部计算，尚不能区分插值、mip、读取、量化各自的热点，也不能证明多 Worker 是最小方案。
- 本轮在 Owner 要求先写任务前，曾启动未改产品源码的 2K Node 探针；已停止并撤回参考副本及诊断脚本。该不完整探针不作为实施成果、正式基线或优化收益。

目标门槛：在下述固定窗口夹具中，普通仿射、Ctrl 拖角、Ctrl+Alt+Shift 透视的 **Enter→完整权威画面可用耗时中位数各降低至少 30%**；这是期望的实施验收门槛，不是已证明收益或一秒完成承诺。若未达标，报告实际结果和瓶颈，不自动扩展架构或以微基准代替验收。

## 2. 范围与不变条件

首要范围沿用现有后台确认资格：单个根 RGB/RGBA8 普通 Normal 像素层、opacity/fillOpacity 为 1、无选区、蒙版、效果、clipping 或高级混合，合法仿射及四边形。功能回退与安全拒绝范围沿用前任务，不扩大格式/工具支持。

- 保持 CPU 权威重采样、原 bicubic 系数、预乘/反预乘、透明阈值、overshoot clamp、Float32 中间写入及最终量化语义；同输入最终 tile 字节和图层坐标必须精确一致。
- 保持从输出原点开始的 **1024×1024 逻辑区域**、中心 mip 判定、源读取边界和矩阵运算顺序。调度/传输块可与逻辑区域不同，但不得据此重选 mip 或改变边界舍入。
- 保持当前容量/几何预检；不提高 768MiB 操作估算上限来迁就优化，不允许非法/超限输入绕过检查进入同步回退。
- 保持实际取消、session/source/op 校验、一次历史、undo/redo、私有结果原子安装，以及保存/关闭等待规则。失败和取消不能留下半成品；旧回执不能影响重试。
- 不降低正式分辨率、插值质量，不把 GPU 预览当最终像素，不丢弃末次输入。不改变已经流畅的透视预览架构。

不在本任务内：大笔刷、滤镜生命周期缺陷、全工具统一 jobs/Worker 池、Move 预览迁移、全局缓存重构、Rust/WASM/native addon 或 GPU 权威提交、embedded/ADA 同步及打包发布。不以模块复用为目标，也不为避开复用而重复一套业务状态。

## 3. 源码落点与 PhotoCraft 借鉴边界

实施前完整追踪以下链路，确认实际资格、缓冲寿命和同步主线程工作：

| WP 入口 | 需要核对的职责 |
| --- | --- |
| [transformTool.ts](../../../src/tools/transformTool.ts) | commitTransform、冻结输入、保护、结果校验、历史安装和预览交接 |
| [transformTask.ts](../../../src/tools/transformTask.ts) | Worker 启动、源私有副本、ACK、结果验证、取消及 metrics |
| [transformWorker.ts](../../../src/tools/transformWorker.ts) | 1024 逻辑计算、writeFloat/compact、256 图块传输 |
| [resample.ts](../../../src/image-engine/resample.ts) | warpSampleContext、warpRaster、sample 与 resizeImage 的调用关系 |
| [tiledRaster.ts](../../../src/image-engine/tiledRaster.ts) | readFloat、mip、writeFloat、compact、COW 和量化 |
| [imageOps.ts](../../../src/app/ops/imageOps.ts) | 同步正式路径及参考分区；不误以为新旧调用同一已修改函数就是独立 oracle |
| [renderEngine.ts](../../../src/rendering/renderEngine.ts)、[fileOps.ts](../../../src/app/fileOps.ts) | 最后预览到完整权威画面的交接、保存及关闭 |

PhotoCraft 固定版本 `7c12f647150f8e7b2e07718f7993b1fcaa57fefe`：

- [transform.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/algo/src/transform.rs)：目标图块原生 Rayon 并行、源 footprint 按需读取、无有效源时跳过、完成块及时写入及释放浮点临时数据。
- [jobs.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/jobs.rs)：快照计算与正式提交分离。本轮 WP 已有对应专用流程，不为性能任务移植其完整 jobs。

借鉴的是独立工作并行和减少无效工作。PhotoCraft 的 `a=-0.75` cubic、预缩小和边缘处理与 WP 不同，不直接替换；原生共享图块与浏览器 Worker 传输条件不同。没有 PhotoCraft 同机产品基准，不承诺同等速度。

## 4. 实施阶段与方案选择

### A. 先建立可归因基线

保全实施前源码和构建身份于 `doc/material/local/2026-11-12/transform-confirm/`，不靠切换当前 main 运行旧版本。复用前任务合格夹具及窗口脚本前，核对其最终矩阵、透明像素、输入计数、入口和硬编码路径。

在独立 profile/temp 的完整 native 窗口建立基线，固定版本、机器、电源状态、viewport、DPR、缩放与 GPU；不操作 Owner 日常作品或窗口。至少使用前任务同配方 4K 非均匀透明源，以及一份固定的非均匀不透明图像；另用小夹具验证边缘、负坐标和缩小。

将 Worker 内部拆分为源读取/mip、预乘、坐标映射与插值、反预乘、量化写入、compact；同时保留打包、ACK、安装、完整权威交接等总阶段。CPU profile 或低侵入分段探针用于归因；带探针样本与正式无探针计时分别记录，不在逐像素循环塞计时器。

产出热点占比、处理像素/块数、临时资源估算及候选方案。先比较最小内核优化是否足够，不把“单 Worker”自动等同唯一瓶颈。

### B. 优先验证小范围计算优化

以下为候选，依阶段 A 证据选择，不要求全部实现：

- 将确认路径中大量重复的索引/边界判断移出内层循环；对完整采样邻域位于源缓冲内部的像素采用快路径，边缘继续精确处理。保留原累加次序与 Float32 舍入。
- 减少已证实有成本的临时对象、重复转换或缓冲分配；不得仅凭源码出现对象/闭包就宣称其主导耗时。
- 在能够证明整个滤波支持域为空时跳过采样，包含 bicubic 邻域和 mip 影响；保留 mask/fill 的区别，不把缺失 tile 一概解释成透明。

尽量限制在实际热点。若修改公共 sample/warpRaster，必须追踪 resizeImage、智能对象和其他插值调用方，并补相应精确回归；若采用仅确认使用的专用快路径，保持原路径作回退并证明调用资格。两种落点都可，按风险和实测成本选择，不预先要求抽取公共模块。

### C. 仅在必要时验证有限并行

若内核优化后仍未达到目标且 profile 显示独立计算主导，可比较 1 与 2 个专用 Worker。只允许分发原逻辑区域或保留其完整采样上下文的子任务；结果顺序不得影响像素、稀疏 tile 集合及坐标。

启动多 Worker 前先给出保守峰值估算，包含所有实例的源副本、mip、重叠读取窗、计算缓冲、结果及在途数据；并发资源按同时存活求和，不沿用单 Worker 数字。现有 4K 估算已接近操作上限，不能默认每个 Worker 都复制整层。如果两份源无法安全容纳，应回到单 Worker 或放弃候选；不得把 SharedArrayBuffer/跨源隔离变成新默认要求。

复用当前变换 operation 的控制边界，取消时结束所有参与 Worker，失败丢弃全部私有结果，等待明确结束。已运行部分失败不得自动同步重做。小任务须有保留单 Worker 的路径，避免并行启动成本倒挂。

若需要新增原生依赖、改变权威像素语义、修改安全上限或重构公共任务平台，属于设计范围变更，先回报，不自行推进。范围内常规算法试验不需要逐项另行审批。

## 5. 正确性验证

建立来自实施前固定 SHA 的独立旧路径 oracle：参考采样、分区、映射和量化不能转而调用新快路径。比较最终逐 tile 字节、tile 坐标/集合、图层偏移和内容边界；适当保留浮点中间结果对照以发现被量化暂时掩盖的差异。

必要覆盖：

- 普通仿射、两种透视交互的最终矩阵、旋转、翻转、非整数平移、缩放；负坐标与画布外源。
- 非均匀 RGB、全透明/半透明、透明边缘、窄条和极小源；完整/部分邻域跨源边界及图块边界。
- 跨 1024 分区和 mip 阈值的透视，保持现有“误用 256 采样分区会产生不同结果”的反例。
- 取消后重试、重复 Enter、Worker 加载与运行失败、错误/晚到结果、切文档、保存与关闭竞争；权威不变或一次成功历史，undo/redo/native 重开精确一致。
- 容量/退化拒绝及既有合法 CPU 回退保持原行为；非法输入不进入优化采样和同步 CPU。

若公共内核受影响，再覆盖它实际支持的 8/16/32 位、nearest/bilinear/bicubic、resize 和智能对象调用；不因只优化 RGB8 Worker 就默许其他调用退化。若采用多 Worker，加顺序扰动、部分失败和全体取消，以及总内存/在途预算断言。

运行 [TESTING](../../engineering/TESTING.md) 的 P-BUILD，并以现有 transformTask、transformPreview、projectivePreview、Move/output 测试为基础选择相关回归。新测试针对真实数值/生命周期风险，不仅镜像新实现。独立代码 review、自动检查和 Owner 体验分别记录。

## 6. 性能验收与停止条件

实施前后各一次预热、至少三次正式样本，三种路径交错；相同夹具、输入轨迹、最终矩阵及同环境。正式性能测量期间不并行运行构建或测试。原始 JSON、CPU profile、脚本和源码/构建 SHA 留在本地材料区；稳定结论写本任务。

分别报告：

1. Enter 事件返回、进度出现、结果就绪、安装、完整权威画面可用及总耗时；不把 Worker 结束提前当显示完成。
2. 计算阶段耗时、处理像素/逻辑块数、峰值在途字节、保守操作内存估算；实测 RSS/VRAM 若取得须单独标识，不能以静态估算冒充。
3. 最长主线程任务和取消响应。独立窗口正式取消三次，常规目标 ≤100ms；出现超标须解释，不能因平均值达标忽略失败。
4. 拖动输入完整性、最终矩阵、持续预览发布及停手收敛。必须保持末次输入和完整帧交接，不以丢输入、少算像素或截去画布外内容换速度。

性能采用第1节三类各降低30%的总耗时目标，报告每次原始数值及中位数，不仅报告内核倍数。小图和非目标合法回退路径应与基线对照；明显回退时限定优化资格或撤回候选。确认内存须通过相同总预算；有无法解释的新主线程冻结、取消失效、像素差异或预览退化则不通过。

至少在实际开发入口和生产构建窗口验证最终确认路径加载/完成/取消；性能比例只能引用同运行方式的前后数据。未获得窗口证据时标 Pending，Node 微基准不能代替用户实际等待时间。真实手绘笔、不同设备和全格式矩阵可后续验收，不为本次确认优化扩展成全产品测试。

## 7. 设计阶段交付与授权边界（历史）

设计阶段仅交付本任务及必要入口链接，待评审。其后 Owner 已在本轮明确授权实施、验证及记录；实际执行见第8节，不授权本地提交。

后续获实施授权后：按 A→选定的 B/C→整体验证推进，保留未采用方案的简要依据；提交可审查的最小代码改动、独立 oracle、前后证据、剩余限制和复审说明。未达目标应如实交付诊断结论，不把“已移到 Worker”再次当成吞吐优化成功，不无限扩展范围。

不自动提交、推送、合入 embedded、更新 ADA 包或发布。Owner 实际作品体验和发布决策与自动验证分开。

## 8. 2026-11-12 本轮执行记录（持续更新）

实际目录 main_native，main，HEAD b01dcb79922279744de987d7fce1c4a2454f2390。启动 dirty 为 AI_CONTEXT、DEV_LOG 和本任务设计文档；全部保留，只定向更新本任务相关内容。未切换工作树或修改相邻仓库。

阶段 A：修改产品源码前，保存 baseline-state.json、baseline.diff、baseline-source.tar 于忽略的 `doc/material/local/2026-11-12/transform-confirm/`。固定旧源码另解压在该材料目录，由本 checkout 相同 node_modules 支持 Vite，未切换 main。独立 oracle 在 `tests/reference/transform-b01dcb7/`，保留原 resample/matrix/tiledRaster/pixels/rect；分区、映射、输出 roundOut 与量化均独立，具体 provenance 与 SHA 在其 PROVENANCE.md。

本轮窗口基线是新采样；复用前任务 setup/transform harness 并核对路径、61点轨迹、60个 coalesced 输入、quad 和最终参数前置校验。仅通过实际 CanvasView/CDP 正常输入触发变换；不是直接调用内核计时。测试宿主仅隔离 profile/temp、窗口尺寸及文件选择；完整应用 main/preload/renderer 和真实 Worker 不替换。Enter 计时包含事件返回与等待 transformPending 结束、engine.hasPendingWork 排空；保留 RAF/交接、逐 tile SHA、undo/redo、JS heap 和 longtask 原始证据。这代表程序化原生窗口，不能证明物理扫描或 Owner 手感。

环境：Xeon W-2125 4核8线程、RTX A5000，驱动32.0.15.9636，Windows，平衡电源；Electron44.4.5/Chromium152.0.7977.130；1450×1000、DPR1、zoom .2、WebGPU compositing。before-environment.json 保存运行时完整偏好；源为固定 D.wpnative 的4096²非均匀图，透明配方包含 alpha0/127，另固定同RGB全不透明配方。正式性能期间不运行构建/测试。工作集/PrivateBytes采样独立记录，不能作为操作安全预算或独占内存证明。

PhotoCraft 固定 transform.rs/jobs.rs 已重新阅读：按目标区域按需读 footprint、无有效源时跳过、原生分块并行及快照后一次提交可借鉴；本任务不移植其 cubic/边缘/预缩小语义或 jobs，原生共享源也不能直接对应浏览器 Worker 复制成本。先完成单 Worker 内核归因，现有768MiB预算不变。

### 阶段 A 归因与 B 候选

正式基线为 before-transform-all.json / before-opaque-transform-all.json，各预热1+正式3、三类交错；所有样本均保留最终权威/undo/redo。有效诊断为 phases3-transform-all.json，单独的 instrumented 原生窗口样本（每类1份），不进入收益表。探针将反预乘移到独立整段循环便于归因，故它不是原生产性能；无逐像素计时。Worker 细分原始ms：

| 路径 | 读源/mip | 预乘 | 坐标映射+插值+clamp | 反预乘 | 量化writeFloat | compact | 像素/逻辑块 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| affine |290.3|146.2|6596.3|112.8|268.9|0.4|16777216 / 16|
| Ctrl拖角 |339.3|165.5|7128.9|109.1|384.8|7.7|16777216 / 16|
| 组合透视 |349.3|150.6|7362.1|113.6|465.9|14.0|17760256 / 18|

采样段约占计算87–89%，读/mip与量化不是首要瓶颈。选择 B 的完整邻域快路径和四tap展开，仅在 `src/tools/transformResample.ts`，Worker换调用；原公共 resample/resize/智能对象/preview全部不改。完整4×4邻域只判断一次边界；行地址跨通道复用，内部四tap直接访问。源窗口边缘保留原zero extension，每个通道的0起始、tap与row累加顺序、Float32存储→clamp→反预乘顺序不变。仍调用原 applyH/warpSampleContext/readFloat，不改原1024分区/mip/源范围。没有新增整层或像素临时副本；cubic权重数组数量与旧路径相同。

首轮5文件94/94定向通过：transformThroughput10项（内部3种alpha，每个逻辑区域比较Float32字节与独立oracle，最终全tile/集合/坐标/内容边界），transformTask33、projectivePreview9、transformPreview19、moveOutput23。P-BUILD通过（包含typecheck、renderer及Electron构建）；生产Worker与真实窗口验证继续。该结果为自查/自动验证，不是独立review。

失败诊断记录：phases / phases2 因在同一Vite服务热更新后动态import与注册模块身份不一致，未得到实际提交，样本废弃；原件/invalid JSON保留。完整重启Vite+native后phases3三类都有实际Worker诊断、一次history与最终像素。harness已加非空transform状态/session匹配、Worker后端和history+1检查，防止无效样本被计作近零收益。正式before发生在诊断热更新之前，全部有实际Worker+一次历史；不受这两组失败诊断影响。

### 正式无探针原生开发窗口性能

以下为新测量，同环境JSON逐字段相同、同输入轨迹/最终参数/源tile/输出tile均经report.py配对断言。每份夹具每类各预热1次、正式3次交错，表只列正式样本。总耗时=Enter事件返回wall+等待task结束与engine排空wall，包含轮询（100ms粒度）及完整authority准备，不是Worker结束时间；不代表物理显示扫描时间。两端正式样本无内部细分探针。每行原始值按rep1/2/3列出，单位ms。

| 夹具 / 路径 | before三次 | after三次 | before中位数 | after中位数 | 降低 |
| --- | --- | --- | --- | --- | --- |
|透明 / affine|7758.16/8785.17/7510.82|4241.54/4496.86/4457.63|7758.16|4457.63|42.54%|
|透明 / ctrl|7386.81/8592.21/7370.85|4246.17/4457.90/4865.19|7386.81|4457.90|39.65%|
|透明 / perspective|8091.22/9040.40/8676.95|4936.59/4835.96/4733.41|8676.95|4835.96|44.27%|
|不透明 / affine|7477.74/7688.07/7261.66|4466.50/4234.20/4000.22|7477.74|4234.20|43.38%|
|不透明 / ctrl|7701.62/7804.03/7133.81|4063.34/4197.24/4509.41|7701.62|4197.24|45.50%|
|不透明 / perspective|7845.31/9494.89/8009.35|4856.88/4648.37/4176.92|8009.35|4648.37|41.96%|

全部6行达到各≥30%的目标。选择保留首个B内核候选，不再进行C多Worker：现有方案已经满足门槛，无需增加源副本、mip、并行读窗和在途结果。没有用更高安全上限迁就方案，也未声称比较过1/2 Worker。最终产品改动仅新增确认专用内核+Worker调用点；不修改其他工具、预览、通用采样、协议、history、保护或文件协调。

两份夹具24对样本（包含预热）全部源图和屏幕坐标/buttons/coalesced轨迹一致；60个coalesced输入/次，最终M/quad一致，实际worker后端且一次history。最终逐tile SHA、tile坐标/集合、层偏移全相同，undo恢复原作、redo恢复结果；没有裁掉画布外内容。完整16/18逻辑块和16777216/17760256目标像素与before相同，原1024输出原点未变。

透明正式预览RAF p95：before affine16.9/16.8/16.8、Ctrl16.8/16.8/16.8、透视16.9/16.8/16.8ms；after三类均16.8/16.8/16.8ms。持续完整代际before affine60/60/61、Ctrl56/59/56、透视57/58/59，after61/59/61、60/59/58、61/60/59；最长发布间隔before范围33.6–99.9ms，after33.6–83.5ms，均无混合代际。停手pending=false，最后presented revision=62，正式矩阵精确配对；不称之为Owner手感或物理呈现验收。

确认相关保守CPU峰值估算两端完全相同：affine/Ctrl698089472bytes（665.75MiB），组合透视714866688bytes（681.75MiB），仍按原768MiB总预算预检；最大单在途262144bytes。该估计包含原有源/预览/Worker/mip/结果/读窗/计算缓冲，不是RSS。新内核未添加存活的像素副本或并行结果；使用原源Float32读窗和原1024输出缓冲。

工作集/PrivateBytes由隔离Electron主进程及启动时已存在的子进程ID每秒采样，原件before-memory.jsonl/after-memory.jsonl；是整个窗口测量会话（含预热、历史/GC/显示、部分空闲）的采样观察最大值，不是精确瞬时操作峰值、独占RSS或因果内存降幅，可能漏掉两次采样之间的峰值。GPU VRAM仅有系统nvidia-smi全局值，未取得应用独占VRAM，不据此声称显存改善。安全性仍依据未变的保守操作预检，不用RSS替代预算。

Longtask原始观察器持续到drain后100ms，可能包含settled之后的任务。before不透明affine rep1的2245ms长任务起于306189.5ms；首个settled帧在306167.2ms，故在本次Enter→authority测量之后，不能混入确认时间；保留原件且不擅自修复无关后处理。正常确认/交接仍有百毫秒级显示任务，最终范围和取消另列。未通过隐藏进度或提前结束pending获取收益。

### 分阶段、取消与小图补充（独立窗口样本）

before-stages/after-stages-transform-all.json各三类一份，有额外DOM进度观察及逐RAF authority检查，独立于正式三轮，不替代上述无探针收益表。用keydown捕获记Enter原点；authorityFrame要求任务结束、原override已清、engine无pending、hold=false且当前可见tile全齐，仍不证明显示器扫描。以下ms均相对Enter，Worker-ready为task.totalMs（起点稍晚于Enter），installedFrame为第一次观察到已安装的RAF，不等于installMs本身。

| 路径 | before进度 / Worker-ready / installedFrame / authorityFrame | after进度 / Worker-ready / installedFrame / authorityFrame | before/after Enter返回 |
| --- | --- | --- | --- |
|affine|5.4 / 8429.6 / 8558.8 / 8734.3|10.1 / 4430.7 / 4507.1 / 4655.6|8.5 / 35.9|
|ctrl|3.3 / 8043.4 / 8115.6 / 8316.1|1.9 / 4282.5 / 4423.2 / 4638.4|6.4 / 3.9|
|perspective|3.5 / 8971.5 / 9063.9 / 9226.2|5.4 / 4265.6 / 4360.1 / 4552.1|6.3 / 12.3|

正式透明样本独立metrics范围（before→after，ms，分段有包含关系，不相加）：
- snapshotMs: 0.3–1.0 → 0.3–1.2
- admitMs: 0.0–0.1 → 0.0–0.2
- packMs: 34.8–50.3 → 37.6–44.0
- transferWaitMs: 20.4–53.0 → 26.0–38.5
- computeMs: 6866.6–8616.2 → 3813.8–4538.1
- computeWallMs: 6922.8–8655.3 → 3876.0–4583.9
- assembleMs: 1.6–3.0 → 1.6–3.1
- totalMs: 7015.5–8767.2 → 3970.1–4702.8
- installMs: 0.3–0.8 → 0.2–0.9
- maxPackUnitMs: 0.4–1.0 → 0.4–1.0

开发实际进度Cancel按钮4次（1预热+3正式），afterC-cancel.json为本轮新采样，正式响应6.88/5.44/5.07ms，均≤100ms；每次约315–319ms时终止专用Worker，已完成全部私有源打包（35.5–38.5ms累计）并处于约4秒的计算任务中。逐tile/坐标/历史与取消前精确相同，保留可调整preview。该脚本不模拟取消函数；四次均button=true。取消后重试与晚到结果等另由整体回归和生产窗口验证。

小图97×67 RGB非均匀半透明、带旋转/缩放，before-small/after-small.json：RGB8单Worker正式总耗时136.82/124.76/120.44→134.72/124.03/136.92ms，中位124.76→134.72ms；16位合法标准CPU路径120.80/27.46/48.18→51.80/56.02/53.15ms，中位48.18→53.15ms。均预热1+正式3，同源/参数、最终tile与undo一致。小图Worker启动/窗口轮询主导，5–10ms绝对差异不支持显著算法退化或小图加速主张；CPU回退源码未改，不为这些波动改变资格。未对所有合法回退组合做窗口性能矩阵。

### 最终整体回归与生产验证

`npm exec -- vitest run` 选择19文件，**305/305通过、0失败**（regressions.json；58 suites是describe分组统计，不冒称58文件）。文件：engine的transformThroughput、transformTask、batchedPaint、core、regressions、native、modes、inkModes、cmyk、features、moveSelection、moveSelectionReference、tileContentBounds；gpu的projectivePreview、transformPreview、compositor、preview、floatingSelection、moveOutput。首次94为这些检查的子集，不累加为399个唯一测试。P-BUILD已通过，内含typecheck/renderer/Electron；之后产品源码未再修改。

关键自动回归：独立b01dcb7的最终tile/坐标/内容边界及Float32逐字节、旋转/翻转/分数坐标/极小源/窄条/透明边缘/跨tile与1024/mip阈值；原“误改256分区会不同”反例保留。实际Worker engine接新核、FakeWorker只代替传输。重复Enter、运行/加载失败、坏回执/过期源/旧cancel回调、切文档/移除、取消重试、受控一次history与外部编辑保护、undo/redo/native encode/decode、save/close/autosave等待、owner-only释放、部分交换回滚、容量/近奇异/非法矩阵/quad/horizon拒绝以及合法CPU回退均通过。拒绝仍零同步CPU绕过；没有触碰原协调实现。测试注入不冒称Owner真实保存关闭体验。

生产构建完整app://窗口 production-final-cancel-retry.json：真实Ctrl+Alt+Shift透视preview.projective=true，Enter返回8.81ms；实际Cancel按钮10.66ms响应，mode仍transform，逐tile/坐标及history与原作一致。再次Enter启动第二个原生Worker，canEdit=false，进度可见；成功仅一次Free Transform历史，undo原作/redo最终逐tile精确一致。观察器仅继承原生Worker构造记录URL，未mock：两次均 `app://celenne/assets/transformWorker-DWeqmpBg.js`，与本轮构建manifest匹配。开发实际入口与生产入口均证明新Worker加载、完成、取消；本轮性能比例只来自同运行方式的开发前后，不外推生产比例。

before窗口会话的已采样工作集最大2894.7MiB、PrivateBytes最大2733.5MiB（443个非空1秒样本；计数/范围为整会话，不是单操作）。

after窗口会话的已采样工作集最大3286.8MiB、PrivateBytes最大3064.6MiB（385个非空1秒样本；计数/范围为整会话，不是单操作）。

为区分额外验证与主要性能段，另以各端最后一份正式夹具JSON写入时间为截止，截取1秒采样（memory-primary-summary.json固定UTC cutoff及原始计数）：before311样本，工作集最大2894.7MiB/PrivateBytes2733.5MiB；after284样本，工作集最大2868.8MiB/PrivateBytes2603.7MiB。该段只覆盖主要前后夹具测试至结束，排除后续阶段探针/取消/小图；after整会话3286.8MiB发生在额外验证期间。两种口径都保留，不把不同验证次数、会话长度或GC造成的峰值变化归因为单操作内存改善。操作安全预算仍按同一保守静态估算。

正式Enter确认观察范围（从首个commit帧前50ms到首个settled帧，保守包含交接；原始observer更宽）：透明before最长103–147ms、after93–166ms；不透明before105–169ms、after106–235ms。235ms在权威交接附近，Worker结果像素/数量与before完全相同，主线程安装仅0.2–0.8ms，仍有未修改的bounds/mip/显示准备成本；另补主线程CPU诊断原件及归因，不把吞吐达标等同所有UI反馈≤100ms。

### 剩余主线程归因、限制与交审入口

单独补充 `authority-main.cpuprofile`、`authority-main-clock.json`、`authority-profile-summary.json`、`main-profile-transform-affine.json`，为有CPU profiler的诊断样本，不进入正式性能表。将Profiler的相对时间对齐到browser performance.now（约2ms误差），结果就绪→完整authority约297.7ms；该段self samples中 downsampleQuadrant约153.2ms、contentBounds约89.7ms，主要来自原有CanvasView显示准备和Thumb/readFloat/mip链路。该次longtask为117/128ms，未复现原始235ms个例；支持将剩余成本定位到未修改的bounds/mip/显示准备，不能证明235ms个例的每一毫秒归因或保证无GC/系统调度影响。递归/包含计数不与self相加。新Worker只改变私有采样计算，主线程收到的图块、字节和数量与固定旧版相同，未新增主线程像素安装工作。

交付状态：本轮三类变换在透明与不透明固定夹具均达到中位总耗时降低≥30%；精确像素/输入/历史、自动生命周期、原生开发及生产Worker加载/取消重试验证通过。**不宣称所有UI阶段≤100ms、不判Owner整体体验Go、不称自查为独立review。** 确认仍约4–5秒，权威交接长尾最高235ms、会话峰值内存和原合法CPU同步回退仍存在。没有继续多Worker、renderer改造、原生依赖或GPU权威提交。

Pending：独立实现review；Owner原作品/真实手绘笔/物理显示与真实保存关闭体验；其他机器、内存压力/设备丢失及全格式/全工具矩阵；安装包/分发。没有运行PhotoCraft同机产品基准，没有embedded/ADA同步、打包发布或下游推进。

Reviewer建议顺序：

1. [专用内核](../../../src/tools/transformResample.ts)与[Worker调用点](../../../src/tools/transformWorker.ts)，检查完整邻域条件、tap/row累加及Float32写回顺序；公共resample、plan、安全预算、task/tool/fileOps与renderEngine均无本轮修改。
2. [独立oracle provenance](../../../tests/reference/transform-b01dcb7/PROVENANCE.md)与[精确回归](../../../tests/engine/transformThroughput.test.ts)，五个冻结依赖已对git show b01dcb7再次校验（仅标准化LF）；参考不导入任何src采样/映射/量化代码。结合既有transformTask33项与跨1024反例复核。
3. 本材料目录中的 `report.py before after`、`report.py before-opaque after-opaque` 重算原始正式样本、源/输入/矩阵、最终tile与undo/redo断言；`launch-baseline.mjs`服务固定旧源码，`launch.mjs`服务当前源码，均配相同隔离native宿主，无须切换main。材料harness改进仅为状态有效性断言，正式前后没有逐像素计时。
4. `regressions.json`、`candidate-build-manifest.json`、`production-final-cancel-retry.json`，以及最终 `final-manifest.json`/源码归档与diff检查。原始JSON、截图、探针、CPUPROFILE和测试材料均在忽略的 `doc/material/local/2026-11-12/transform-confirm/`；不是Git交付数据，不修改上游docs体系。

最终仍main / b01dcb79922279744de987d7fce1c4a2454f2390加本轮可审查dirty；源码身份不伪造为新commit，使用final-manifest里的SHA-256及candidate-source.zip。生产Worker为transformWorker-DWeqmpBg.js，main/preload SHA与基线相同（9445d988… / ed9d2ad3…），全构建文件hash在candidate-build-manifest。测试后产品源码未再修改，P-BUILD无须重复；现有依赖构建警告保留，无构建失败。

完成后交审并停止；无分支创建、commit、push、merge、发布或相邻仓库修改。只定向更新本任务、AI_CONTEXT与DEV_LOG，不撤销启动dirty。


## 文档维护与同步（2026-11-12）

Owner反馈“提速还是挺明显的”，授权维护本地架构文档并提交、推送，让工作区干净。更新ARCHITECTURE_OVERVIEW、INTERACTIVE_PREVIEW及PHOTOCRAFT_REFERENCE，连接当前Move/边界缓存/仿射与透视预览/专用Worker/精确采样内核职责，压缩AI_CONTEXT旧原型状态。以上授权覆盖本轮现有实现、独立oracle、测试与文档；原记录中无commit/push为交审时历史状态，本节记录后续授权。完整实现独立review与其他人工验收仍Pending，不自动更新embedded/ADA或发布。

同步前复核：94项定向回归（transformThroughput/transformTask/projectivePreview/transformPreview/moveOutput）本轮重跑通过；10项实现/测试文件SHA与既有final-manifest一致，未重复构建或窗口性能测量。架构与任务UTF-8无BOM、相对文件链接及git diff --check检查通过。原始材料保持忽略，不纳入提交。
