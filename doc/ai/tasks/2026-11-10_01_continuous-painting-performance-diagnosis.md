# 连续绘画性能排查方案

日期：2026-11-10。状态：**诊断及F1–F3补测已完成，待独立复核；本记录不授权优化实现**。

## 1. 目标与现有证据

以 WP main 为主要基线，定位大图层存在时连续绘画的拖尾、图块延迟显示来自哪些工作，并给出有因果证据的最小优化路线。ADA 固定包作为必要对照，不预设 iframe、语言、平滑或边界缓存是原因。

Owner 已观察：此前隔几秒卡顿的问题消失；快速跨区域绘画仍曾出现笔迹落后和块状区域来不及显示，关闭 Smoothing 也存在。两边画布调整到约 2560×1440 并删除残留 4K 图层后，体验几乎一致。这支持调查文档负载，**不证明隐藏图层一定参与合成，也不证明边界扫描是唯一瓶颈**。

先前脚本探针使用过不同文档、活动图层及窗口尺寸，且是合成输入；未复现 ADA 明显更慢，不能当成同条件 A/B 或真实手绘笔验收。既有保存窗口测量也不能替代连续笔划测量。

## 2. 工作位置与授权边界

| 角色 | 目录 | 方案编写时 HEAD |
| --- | --- | --- |
| 主要基线：WP main | `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter_main_native` | `59f81b51fa2db6f6ea0e7d31094d8015549c6ec8` |
| 嵌入源码及本任务文档 | `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter` | `2ada52c7ed56ebd1fc6313273a7db97e278ee945` |
| ADA 固定包对照 | `D:/00_Projects_WSY/AI/Codex_Projects/auto_design_Agent` | `fdcbb18672fad0fa5b31c84465bd95c55f404031` |

执行前重新核对各目录适用 AGENTS、文档入口、分支、HEAD、dirty、运行进程和包来源；不能用相邻 `_New` 替代。上述版本是记录，不要求回退到这些版本。

编写时 main 工作树已有未提交的 `doc/ai/AI_CONTEXT.md`、`doc/ai/DEV_LOG.md`、`doc/engineering/DEV_SETUP.md`、`scripts/start-current.mjs` 及未跟踪 `start-dev.bat`。保留并核对启动相关差异，不能标为 clean HEAD。其余两目录当时干净。

授权读取源码、启动隔离诊断实例、制作测试作品、采样和临时诊断脚本，并在本任务追加结果。原始材料写入 WP `doc/material/local/2026-11-10/painting-diagnosis/` 下唯一子目录，先核对忽略规则。允许隔离实例的运行时观测 hook；不修改产品源码、正式配置或真实用户作品，不切换分支、不创建分支、不提交/推送、不重新发布或替换 ADA 固定包、不调用真实付费服务。不要关闭用户现有进程或使用其 profile 写入测试数据。

若无法通过运行时工具取得必要指标，记录缺失项和所需最小插桩，不自行转为产品代码改造。当前只在本任务回填结论，不改 ADA 文档。最终交 Owner 转交 `ADA集成-REV` 独立复核。

## 3. 第一步：固定可比较的环境与作品

1. 阅读 [性能方向](../../product/PERFORMANCE_DIRECTION.md)、[验证约定](../../engineering/TESTING.md)、[PhotoCraft 对照](../../architecture/PHOTOCRAFT_REFERENCE.md)；历史结论均回到当前源码核对。ADA 侧读取自己的入口及当前绘画集成任务，确认实际 vendor 包清单、源码标记、bundle 哈希与运行入口。
2. main 使用其工作树实际源码启动，不把 embedded 目录的 `Start-WebPainter.bat` 当作 main。ADA 先采用与用户 `start-dev-desktop.bat` 对应的隔离开发入口。记录 Electron/Chromium、GPU/驱动、实际渲染与合成后端、DPR、画板视口、zoom、面板、偏好及是否开发模式。WebGPU 标签不等于 GPU 合成已启用。
3. 共用可重建、非均匀像素的测试作品：画布 2560×1440，普通 RGBA 8 位像素层；另备具有真实像素内容的 4096×4096 大图层。记录 seed、文件哈希、图层身份/尺寸/偏移/可见性/混合方式、已分配图块数、活动图层和历史状态。只有大边界但极少图块的稀疏层不能代表稠密大层。
4. 优先两边打开同一 native 文件；如果入口限制需转格式，核对解码后像素、图层结构和属性，记录差异。不得以不同作品或不同活动层冒充严格对照。缩小画布与缩小/裁切图层像素分别记录。
5. 固定笔刷、尺寸、间距、不透明度、压力和 Smoothing。主测 Smoothing=0；优先使用用户常用尺寸，未知时从 10px 起。只在需要区分填充量瓶颈时增加 60px 对照。脚本输入应定时连续分发，不能一次突发全部 move 再等待。

## 4. 第二步：有限场景矩阵

先在 main 完成以下场景，每组从相同初始文件和隔离会话重建，至少三次有效重复。顺序交错，预热与正式样本分开；不要让重复笔划不断增长的文档成为隐含变量。

| 场景 | 活动绘画层 | 其他大层 | 要回答的问题 |
| --- | --- | --- | --- |
| A | 小内容层 | 不存在 | 基线开销 |
| B | 同 A | 可见 4K 层 | 大层合成或资源占用影响 |
| C | 同 A | 同一 4K 层隐藏 | 隐藏是否减少工作，剩余成本在哪里 |
| D | 4K 大内容层 | 无额外大层 | 小笔划是否引发整层相关工作 |

增加一组 C 删除大层后的对照：先保留删除撤销历史测量，再保存测试副本并重开、确认历史重置后测量。与 A 核对等价条件。删除后 undo 仍可能持有像素，不能直接把删除解释为释放内存。

ADA 至少复测 A 及 main 中差异最大的场景；若 main 未出现差异，则在 ADA 复测 B/C/D。仅当出现稳定的宿主差异时，才扩展同源核心版本/运行时或生产入口对照，先排除版本、偏好和文档差异，不开发另一套 direct 产品。

输入同时覆盖短局部笔划和跨视口长笔划。脚本回放用于复现和计时；真实手绘笔、压感及肉眼跟手需单独标记，没有设备/人工记录即 Pending 或 Inconclusive。

## 5. 第三步：沿一条笔划追踪耗时

源码追踪和测量覆盖下列阶段，先低开销采样找热点，再对热点加计数，不对所有模块建设新监控框架：

```text
输入事件 / coalesced samples
  -> 笔刷 move / dab 生成 / 像素写入
  -> dirty 通知与内容边界查询
  -> Properties / 图层缩略图等订阅更新
  -> render engine 队列 / 图块计划与合成
  -> GPU 上传 / 提交 / 画面显示
旁路：历史保留、内存与 GC、后台保存和预览任务争用
```

| 阶段 | 最小证据 |
| --- | --- |
| 输入/笔刷 | 输入数、合并样本数、处理间隔、move/dab 耗时、积压情况；区分输入等待与像素计算 |
| 边界 | 调用者、调用次数、缓存命中/失效、扫描图块/像素量和累计耗时；对比实际改动图块数 |
| UI 订阅 | Properties/缩略图更新频率及耗时，是否与 raster revision 一起放大 |
| 合成/上传 | dirty 区域、待处理图块数及年龄、每帧处理量、CPU/GPU 路径与回退、上传次数/字节和耗时 |
| 显示 | 笔划时段 RAF 分布、最长帧和长任务；能获取时记录输入到对应图块显示的延迟及未更新区域 |
| 内存/后台 | JS heap、可取得的栅格/历史/纹理资源量、GC 和保存阶段时间线；标明估算与未知 |

按 pointerdown→连续 move、pointerup→收尾、后台保存三个时段拆分。记录 p50/p95/max、样本数及重复间差异，避免把启动/读文件/预热的最长帧算进绘画。CPU 嵌套函数时间不能相加当总时长；GPU 提交返回不等于 GPU 完成，RAF 也不等于真实屏幕呈现或笔尖延迟。跨进程时间线需校准时钟。

只在时间线显示保存争用时追加隔离实例的“保存未运行/保存进行中”对照；默认保留正常行为。不能通过永久关闭自动保存来宣称优化成功。

重点核对但不预判：`src/rendering/bounds.ts`、`src/image-engine/tiledRaster.ts`、`src/tools/paintTools.ts`、`src/ui/CanvasView.tsx`、`src/ui/panels/PropertiesPanel.tsx`、`src/ui/panels/Thumb.tsx`、`src/rendering/compositor.ts`，以及实际被调用的 GPU 路径。记录当前版本行号，不沿用历史行号。

## 6. 第四步：建立因果证据并选择路线

对排名靠前的热点至少做一个单变量对照，说明改变了什么、其他条件是否保持、结果是否重复及观测本身的开销。例如图块规模变化、同一层显隐、隔离实例面板显示状态变化。若使用临时运行时替代/跳过计算，仅用于归因，必须标注改变正确性或行为的影响，不能把它当成可交付修复。

PhotoCraft 固定参考为本地 `doc/material/local/2026-11-05/photocraft-v0.20.2/`，tag v0.20.2 / commit `7c12f647150f8e7b2e07718f7993b1fcaa57fefe`，先核对材料 manifest。按实际热点阅读 `crates/compose/src/bounds.rs`、`crates/raster/src/lib.rs`、`crates/compose/src/render.rs`、`crates/ui-egui/src/canvas/gpu_canvas.rs`。只借鉴缓存粒度、失效与资源更新策略，不把未运行的 Rust 程序当性能基准。

若边界扫描证据成立，再评估“图块局部边界缓存→增量维护整层边界→减少非必要查询”的必要范围；不得因方案已有三阶段就全部实施。WP 图块可能原地修改，不能照搬仅靠对象身份的缓存键；要说明 revision、删除/清空、边界收缩、蒙版/填充值等正确性约束。若瓶颈在上传/队列/内存，则按证据调整路线。

输出每个候选优化的 owner、最小改动范围、预期消除的具体工作、正确性风险、验证办法及预期收益依据。通用内核修复建议走 main → embedded → ADA 固定包；宿主特有开销归 ADA，通用嵌入开销归 embedded。此路线仍需后续实施授权。

## 7. 交付与结束条件

在本任务追加一次诊断报告，原始数据只链接到本地材料：

1. 环境/版本/dirty 与实际运行包、作品清单及复现命令。
2. main 矩阵与 ADA 对照结果，标出不可比较之处和所有未执行项。
3. 热点排名表：场景、用户现象、耗时/工作量、调用路径及文件行号、因果对照、置信度。
4. 最小优化路线和暂不需要的改造；区分测量事实、源码事实、推断和建议。
5. 测试实例清理情况、前后 git 状态及未改产品源码的核对。

完成必要矩阵并获得可重复热点及单变量证据后即可交审，不扩展到全编辑器/全格式性能工程。若未复现或关键指标不可取得，明确 **Inconclusive**，列出已排除的有限条件和下一步最小缺失证据，不编造根因、不宣称体验通过，也不无限扩大实验。最终交 `ADA集成-REV` 复核后暂停，未经授权不开始优化。

## Context Delta

- 新增 main 为基线的连续绘画诊断任务，ADA 同作品对照；目前仅方案落盘。
- 用户删除残留 4K 图层后两侧体验接近，是调查输入，不是内核归因结论。
- 本轮不实施、不提交、不推送；既有保存修复验收不扩展为连续绘画验收。

## 2026-11-10 诊断阶段报告（Inconclusive；未完成完整方案）

**结论边界：本次获得 main 当前源码 renderer 的有限 A/B/C/D 回放和 D 场景单变量证据；没有完成原生主进程及 ADA 同作品矩阵，不能据此关闭本任务或解释 Owner 删除残留 4K 层后的全部现象。没有实施优化。** 以下结果供独立 review 审查证据和缺口，不是完整性能验收。

### 版本、环境与材料

执行时 main `59f81b51fa2db6f6ea0e7d31094d8015549c6ec8` / `main`；embedded `2ada52c7ed56ebd1fc6313273a7db97e278ee945` / `integration/embedded`；ADA `fdcbb18672fad0fa5b31c84465bd95c55f404031`。原始前态见 [baseline.json](../../material/local/2026-11-10/painting-diagnosis/run-01/baseline.json)。main 既存三份文档、`scripts/start-current.mjs`、未跟踪 `start-dev.bat` 均保留；embedded 既存 AI_CONTEXT 修改和本任务未跟踪；ADA 干净。本轮不读取或使用 `_New`。

main 启动脚本源码已核对：启动根目录来自当前 checkout，并显式放行 junction 实际依赖路径；原 `current-source-host.cjs` 使用 `doc/material/local/current-source/profile`。为避免触及该已有 profile，本次没有运行该 host，而使用材料目录下独立 Electron BrowserWindow + 当前 main 的 Vite renderer。**这是当前 main renderer 诊断，不能称为完整 native 启动链复测**；没有安装 native preload/scratch/文件服务。此差异使后台保存、历史磁盘分页和完整主进程争用仍不可判定。

实际诊断 Electron 44.4.5 / Chromium 152.0.7977.130；1600×1000 窗口，DPR 1，画板 viewport 1179.64×801 CSS px，zoom .35，pan (0,0)，renderer 自报 `webgpu (GPU compositing)`；完整 GPU 信息在结果 JSON。系统枚举有 NVIDIA RTX A5000（驱动 32.0.15.9636）及两个虚拟显示适配器；枚举信息本身不作为实际 adapter 绑定证明。用户原 WP PID27460、ADA PID31624 保留。

ADA 当前 `apps/web/src/editor/wp-editor-build.json` 与 vendor manifest 一致：port3/native1、mainBase59f81b5、embeddedCommit060b6a4008c165f3eba220564977826c524e1810、sourceHash8160bebed4133a0c63f6e5ad5008a70bde82310c4688c173188374790cf3fbcd、bundleHash df16465d36d9cd7315407612206f033f4d6b0d84a95a09ef45727afb9f7c6556。逐一检查 manifest 的136份文件 SHA256，0不匹配，见 [vendor-verification.json](../../material/local/2026-11-10/painting-diagnosis/run-01/vendor-verification.json)。这证明磁盘固定包完整性，**不证明本次 ADA 实际运行加载了该包**；本次未启动 ADA 隔离开发入口。未替换、重建固定包。

全部本次材料位于忽略目录 [run-01](../../material/local/2026-11-10/painting-diagnosis/run-01/)，`git check-ignore` 已确认命中。复现：在 embedded 根执行 `node doc/material/local/2026-11-10/painting-diagnosis/run-01/launch.mjs`；launcher 只从 main 根加载 Vite 及其实际依赖，在127.0.0.1:16041提供 main 源码。当前 probe/measure 为因果对照版本；基线需分别采用 `probe-baseline.cjs` 和 `measure-baseline.js`（保留文件名引用关系）。首两次启动失败分别为 Windows ESM URL、Electron模块解析，均已修正，失败尝试不计为样本。

### 夹具、输入与实测

画布2560×1440、RGB8、透明小活动层初始无图块；大层为4096×4096、256块×256²像素、每像素RGBA非均匀颜色且alpha255，原始像素64MiB（不含mip/历史/纹理）。生成式 `v=((i/4)*13+tx*17+ty*31+12345)>>>0`，RGB=(v%251,(v>>>3)%253,(v>>>7)%255)。各场景重新创建文档，图层结构不跨样本累积，测试层普通混合、默认偏移、无蒙版/效果。**未生成共用 native 文件、未做跨宿主解码像素哈希核验；不是同文件 A/B。**

Soft Round 10px、hardness0、opacity/flow1、spacing.1、smoothing0、pressure1、无scatter/texture/airbrush；完整 brush 写入原始结果。每次 down 后70次 move，逐次等待8ms，路径 x=200+28i，y=400+sin(i/7)*200，最后up。每组一次预热、三次正式重复，顺序交错。调用真实 brush tool down/move/up 与 mounted host，**绕过 CanvasView pointer/coalesced 输入入口**，不是 OS 鼠标/手绘笔回放。CanvasView 的 pointerDown ref 因此没有被设置，正常绘画6ms合成预算未按真实输入切换；这些数字只能支持工具及订阅链归因，不能当原生笔尖延迟或完整输入积压测量。

[基线原始数据](../../material/local/2026-11-10/painting-diagnosis/run-01/main-results.json)、[因果对照](../../material/local/2026-11-10/painting-diagnosis/run-01/causal-results.json)、[逐轮统计](../../material/local/2026-11-10/painting-diagnosis/run-01/summary.json)。统计包含样本数、p50/p95/max，`summarize.cjs` 可重算；RAF样本包含up后350ms排空，**不能称为严格笔划时段分位数**。elapsed 为 down前至up前，不包含up执行及排空。

| main renderer 场景 | 三次elapsed ms | 每轮RAF p95 ms | 每轮边界扫描累计 ms |
| --- | --- | --- | --- |
| A 小活动层，无大层 | 984.5 /1118.8 /957.8 | 16.8 /16.8 /16.8 | 102.2 /162.9 /90.1 |
| B 小活动层，大层可见 | 924.9 /1049.6 /949.7 | 16.8 /16.8 /16.8 | 83.4 /148.1 /95.2 |
| C 小活动层，同大层隐藏 | 975.8 /954.0 /892.8 | 16.8 /16.8 /16.8 | 141.9 /182.5 /140.1 |
| D 直接在大内容层绘画 | 3731.0 /3969.3 /3630.9 | 66.7 /83.4 /66.7 | 2825.3 /3079.4 /2734.8 |

D每轮58–61次边界扫描，单次p50约43.9–46.9ms，p95约63.4–82.1ms；move函数自身p95约1.4–2.1ms。含等待的笔划时段增长主要发生在move调用之间。不能把扫描、process与其他嵌套耗时相加；GC、实际呈现、后台保存均无完整时间线。

### 单变量证据、源码事实与最小候选路线

运行时仅对 D 大层实例覆盖 `contentBounds`，复用预先求出的固定边界；fixture笔划位于已全不透明4096范围内，不改变外边界。对照保持其余设置/顺序/输入规则，每次独立重建；仅测试归因，不能用于一般编辑（擦除收缩/越界绘画会不正确）。同批未覆盖D为4356.9/4131.8/4129.4ms，固定边界为1039.2/1007.5/1159.9ms；RAF p95由83.3–100降至16.8ms。**该受限场景中，重复边界扫描是主要可重复热点，证据置信度较高；对真实 native/ADA 场景的外推仍有限。**

| 排名/阶段 | 证据与归属 | 限制 |
| --- | --- | --- |
| 1，活动层内容边界 | main `src/rendering/bounds.ts:13` 以栅格version缓存，失效调用 `TiledRaster.contentBounds`；`src/image-engine/tiledRaster.ts:217` 遍历分配图块全部像素；`src/ui/panels/PropertiesPanel.tsx:61` TransformInfo查询。运行栈命中属性面板；D单变量显著降低回放时段 | 开发React，hook每次生成stack，观测开销未单独校准；基线与因果批次有约10–20%漂移，不将其换算正式收益 |
| 2，合成队列 | `src/rendering/renderEngine.ts:563` 按预算处理图块；`src/ui/CanvasView.tsx:317` 正常绘画6ms、其他12ms。因果批记录process前后queue/count/CPU耗时 | process内可能嵌套边界查询，不能单独归为像素合成；无tile年龄/显示对应性，不证明块状显示根因 |
| 待排名，缩略图 | `src/ui/panels/Thumb.tsx:66` 版本key，`:87` 内容边界查询；30ms延期队列、约8ms预算，但单任务不能被该预算抢占 | 未独立计时mip生成/UI提交，不宣称第二主热点 |
| 待排名，内存/历史 | 结果含JS heap快照，未强制GC；DeleteLayerCommand（main `src/commands/layerCommands.ts:53`）保存removed层引用供undo | heap不含全部GPU/栅格，跨样本增长不证明泄漏；未测删除释放 |
| 未排名，输入/GPU/保存 | 实际renderer标签已采集 | 没有coalesced计数、输入到图块呈现、GPU上传字节/完成、GC/profile、保存争用完整证据 |

**候选建议而非实现授权**：通用边界成本归 main，未来验证后 main→embedded→ADA固定包。先评估图块局部边界缓存是否足以消除每次version变化后的全图像素扫描；用tile身份+rev、栅格fill/depth/channels及删除集合处理失效，保留整层边界收缩/空层/蒙版正确性。不因本轮结果直接实施增量整层边界或减少所有查询；面板查询去频可作另一较小候选，但不得让可见属性长期过时。收益依据只限本批D扫描约3秒及运行时替代的差异；正式收益需完整输入/原生/ADA重验。没有证据授权改iframe、换语言、改队列架构或永久关自动保存。PhotoCraft仅沿用设计参考边界；本轮未核对manifest或运行，未用其性能作结论。

### 未完成项与下一步最小证据

1. main完整native独立profile入口、真实CanvasView定时输入、短局部笔划、严格down/move/up分段统计，以及无hook对照；当前仅renderer/工具入口。
2. 共用native作品与像素/结构哈希；删除后保留undo、保存副本重开且确认历史清空。当前只读源码能证明删除命令持有层，不能证明它导致当前性能。
3. ADA按start-dev-desktop对应隔离入口复测A与D，以及必要B/C；本轮仅固定包磁盘核验，**ADA对照未执行**。
4. CPU采样、边界缓存命中/调用者聚合、UI订阅独立计时、dirty tiles/年龄、GPU上传/资源、后台保存竞争和GC/历史资源观测。当前不能完整排序热点；保存争用单变量未启动，因没有时间线证据支持它。
5. 手绘笔、压力/倾斜及肉眼跨区域图块跟进均Pending/Inconclusive。

因此：**Owner原始问题总体Inconclusive；小活动层A/B/C在本次有限回放中未复现稳定差异，不能推导真实用户场景无差异。当前阶段不满足“必要矩阵完成”结束条件。** 未完成项为本次执行缺口，不能冒称因工具限制而已全部排除。需要继续诊断补证，或由Owner另行裁定范围；不能据此进入优化实施。

诊断Electron窗口和Vite进程已退出，16041无监听，只余TIME_WAIT；材料profile保留供审查。原有用户进程未关闭。前后git短状态相同（本任务追加内容除外），未改产品源码、正式配置、固定包、分支；无提交/推送。仅新增忽略材料及追加本任务。交ADA集成-REV审查本阶段证据及未完成边界后暂停。

## Follow-up Test — 2026-11-10 独立 review 后补测

状态：**Owner 已授权补测；待执行，未授权优化实现。** 本节是下一轮执行范围，保留上面的阶段报告与原始数据，不覆盖 run-01，也不将其追认为完整验收。

### Review 结论与待回答问题

独立 review 重算原始 JSON，确认报告 elapsed 和边界累计值一致；源码与固定边界替代支持“在稠密大活动层绘画时，重复边界扫描是显著热点”的有限结论。总体 Changes Requested，尚不能解释 Owner 删除残留大层后的改善或 ADA 与 standalone 的差异。没有新增 P1。

实施前补三项证据：

1. 原 B 夹具用默认 insertLayer 把全不透明大层放到小活动层上方，遮住笔迹；修正后才能比较可见绘画。
2. 原工具直接调用绕过 CanvasView pointer/coalesced 路径，未切换正常绘画预算；需要完整启动入口和正常输入路径验证。
3. 缺少隐藏/删除保留 undo/重开对照及 ADA 同作品复测；不能把活动层热点扩大为所有残留图层问题。

### F1 — 修正夹具，复测 main 完整绘画路径

- 使用 main 工作树的完整 native 启动链和独立 profile/temp，保留已有 dirty。可以在忽略材料目录准备诊断 launcher，但须使用实际 native preload、文件及后台服务，记录与正常入口的差异。不得再次只用裸 BrowserWindow renderer 充当完整入口。
- 生成并保存可共用的 native 夹具。B/C 的大层位于小活动绘画层下方；明确图层顺序、活动层身份、显隐和像素内容。截图证明 B 的笔迹可见。D 是在已有稠密 4K 像素的大层上绘画。
- 从隔离实例的正常 CanvasView 输入入口定时回放，优先 Electron/CDP 输入注入；不得直接调用 tool.down/move/up。记录 pointerdown/move/up、实际进入的处理路径及绘画合成预算。脚本鼠标不等同真实手绘笔；没有 coalesced 样本也如实记录。
- 完成修正后的 A/B/C/D，包含短局部和跨视口笔划；每个测量条件预热与至少三次正式样本分离，重建相同初态，交错顺序。固定活动层、笔刷、zoom、视口、后端和偏好。
- A/D 先保留无运行时 hook 的基线，再作低开销采样/计数对照。不要每次边界调用都生成完整 stack；调用者用少量采样或聚合。严格区分连续绘画、up 收尾和排空时段。
- 若 D 热点仍成立，在同一完整输入路径重复受限固定边界归因实验。只在笔划不会改变精确边界的夹具使用，记录前后边界/输出一致性；这仍不是修复实现或正式收益。

### F2 — 隐藏、删除与重开的最小对照

- 从 C 的相同文件开始：大层隐藏 → 用正常删除命令删除大层但保留 undo → 保存测试副本、重开并确认历史重置。每个状态都在同一个小活动层画相同笔划，与无大层 A 比较。
- 每个独立样本从初态重建；不得把前一状态新增的笔划累积到后一状态。记录活动层、图块/资源量、历史状态及后台保存时间点。删除后对象仍被 undo 引用不等于一定造成性能下降。
- 至少用资源计数/可取得的内存指标区分“层不参与显示”“历史仍持有数据”“重开后的资源状态”。JS heap 不是完整栅格或 GPU 内存；没有释放证据就不宣称释放或泄漏，不通过强制 GC 改写正常基线。
- 每个状态至少三次有效重复；如差异不稳定，报告波动和未复现范围，不把它判成已有边界热点的另一种表现。

### F3 — ADA 同作品验证

- 使用与 `auto_design_Agent/start-dev-desktop.bat` 对应的隔离开发入口，独立 profile/runtime/端口。先读 ADA 适用入口规则，保留实际用户进程与作品。不得替换、重建或重新标记固定包。
- 核对实际窗口加载的 WP 包身份；磁盘 manifest 校验不能替代实际加载证据。记录 Electron/Chromium、GPU 合成、视口、偏好与 main 差异。
- 打开同一 native 夹具，核对解码后图层结构、像素哈希、活动层及显示设置。复测 A/D，以及 F1/F2 中出现稳定差异的必要场景；如果没有稳定差异，至少补 B/C。各条件至少三次正式重复。
- 若跨宿主结果仍不同，先核对输入、版本和运行设置；没有这些控制条件不能归因 iframe。跨进程时间戳需校准，无法校准时只比较各自时段指标。

### 按证据扩展，而非一次铺开所有指标

本轮先完成 F1–F3。若仍出现边界扫描无法解释的块状延迟，再针对相关笔划采集图块队列积压/年龄、dirty 区域、合成与上传时间线；若长帧与保存或 GC 重合，再补对应争用对照。不要先建设全面监控框架、重跑全部历史功能验收或扩展到所有格式。PhotoCraft 性能基准不是本轮前置条件。

### 交付、结束条件与授权

- 新证据写到 `doc/material/local/2026-11-10/painting-diagnosis/` 的新运行目录，保留脚本、夹具、环境、截图、原始 JSON/profile 和可重算统计；核对忽略规则，不覆盖 run-01。
- 本任务追加 Follow-up Test 结果，逐项列 F1/F2/F3 完成情况。更新源码引用时使用当前源码行号，区分 Vite 转换后调用栈行号与磁盘源码行号。
- 结论必须分别回答：大活动层边界热点是否在完整输入路径复现；隐藏与删除差异是否复现及能否归因；ADA 是否存在额外开销。给出有证据的最小路线、owner、预期收益依据和未测限制。
- 三项补测完成后可交审；结果无差异也是有效结果，前提是夹具与入口正确且证据齐全。缺少设备可保留真实手绘笔 Pending，不应因此停止可执行的脚本补测。遇到实际阻塞需记录具体原因、已尝试方法及最小缺失条件，不得把尚未执行当作无法执行，也不得以“已有一个热点”为由提前结束。
- 只允许测试材料/运行时诊断及本任务结果追加；不修改产品源码、正式配置、真实作品，不切换/创建分支，不提交、推送、发布，不调用付费 Provider。不改 ADA 文档，不扩展为优化实施。
- 完成后输出证据路径和结论，供 Owner 转交 **ADA集成-REV** 独立 review；随后暂停，等待优化方案与实施另行授权。


## Follow-up Test 结果 — 2026-11-10（F1/F2/F3 已完成，待 Owner 转交独立 review）

本节取代 run-01 作为本轮主要测量依据，保留旧报告及材料。**只实施诊断，未实施优化。** 本轮三项补测全部完成；真实手绘笔、真实屏幕呈现延迟和 Owner 原始作品场景仍未验收。

### 三个问题的回答

1. **边界扫描热点在完整 native + CanvasView 输入路径复现。** main 的 D 在短、长笔划下均出现约133–150ms的绘画时段 RAF p95；A/B通常约16.8ms。计数路径中，D 绘画期间扫描累计约1.24–1.32秒，单次扫描中位约54–57ms，而短/长笔划最终只改动1/16个图块。受限固定边界后，main 和 ADA 的主要长帧均回到约16.8ms。低频对照实际投递60次move，原路径与固定边界路径的最终逐图块像素哈希完全一致。
2. **隐藏→删除保留undo→保存副本重开，没有复现稳定的性能改善。** 删除前已预热隐藏大层的追加对照也没有该差异；删除后undo仍持有256个resident tile，连同mip名义资源85.5MiB。重开后历史归零、文件与A相同，但性能处于相同波动范围。因此，不能把 Owner 原始改善归因于“删除释放了像素”或“隐藏层必然参与合成”；原始改善的具体原因仍 **Inconclusive**。
3. **ADA 的大活动层主要长帧也随相同边界热点消失。** 原始D的帧尾在ADA略高，故追加了ADA同类单变量对照；固定边界后两边均约16.8ms。ADA松手事件结算仍有约3–9ms、main约0.4–1.7ms的差异，尚不能在运行时版本、React构建模式、嵌入通知等因素间独立归因。没有证据将iframe列为本轮主要瓶颈，也不宣称ADA在任意作品中零额外开销。

### 基线、真实入口与运行差异

- 再次核对：main `59f81b51fa2db6f6ea0e7d31094d8015549c6ec8` / `main`；embedded `2ada52c7ed56ebd1fc6313273a7db97e278ee945` / `integration/embedded`；ADA `fdcbb18672fad0fa5b31c84465bd95c55f404031` / `codex/isolate-drawing-interface-20261104`。main五项既存dirty、embedded上下文与本任务既存dirty均保留；ADA产品工作树干净。只读适用AGENTS/入口和任务，不使用相邻_New。见 [worktrees.json](../../material/local/2026-11-10/painting-diagnosis/run-02/worktrees.json)、[main-existing-startup.diff](../../material/local/2026-11-10/painting-diagnosis/run-02/main-existing-startup.diff)。
- **main实际启动链**：在main根执行原有 `scripts/build-electron.mjs`，再由材料中的 `native-host.cjs` require main的实际 `dist-electron/main.cjs`。窗口由产品main创建，使用实际preload、IPC文件权限/读写、scratch及recovery/后台服务；Vite根固定main工作树。测试native通过本仓库codec解码、实际preload读取；F2副本通过实际preload写盘、读回、codec重开。未将File菜单的PSD流程冒称为native格式UI验收。
- **ADA实际入口**：先用原 `start-local-desktop.mjs` / pnpm入口启动；随后为统一后台节流，在材料目录准备同源诊断launcher。它调用同一main/preload源入口、Profile子进程、ADA Vite工程、正式Canvas“编辑作品”和正式drawing-editor iframe；独立runtime为ADA忽略目录 `.packaging/painting-followup-run02-runtime`，独立Profile位于 [ada-data-path.txt](../../material/local/2026-11-10/painting-diagnosis/run-02/ada-data-path.txt) 指向的owned临时目录。正常保存、Return和preview后台流程保留，未配置付费凭据。
- 两边统一的**诊断运行设置**：独立profile/temp、诊断端口、固定窗口/视口；在新窗口创建时运行时设置 `webContents.setBackgroundThrottling(false)`，避免Windows遮挡令RAF暂停。未写正式配置。main内容区1450×1000；ADA通过CDP逻辑视口1450×1010抵消宿主header等布局差异，两边实际Canvas DOM矩形均为 **1075.125×866 CSS px**、DPR1、zoom .35、pan(0,0)。坐标由各自实际Canvas矩形与docToScreen换算，ADA加真实iframe偏移。此为受控逻辑视口测试，不是物理窗口/笔尖呈现验收。ADA的hostFactory诊断尺寸曾返回1×1，本轮尺寸与坐标核对使用实际Canvas DOM矩形。
- main Electron44.4.5 / Chromium152.0.7977.130；ADA Electron44.9.0 / Chromium152.0.7977.167。各样本实际editor均报告 `webgpu (GPU compositing)`；requestAdapter观测为nvidia/ampere，具体device字段为空，系统枚举NVIDIA RTX A5000及驱动32.0.15.9636。见 [main-environment.json](../../material/local/2026-11-10/painting-diagnosis/run-02/main-environment.json)、[ada-environment.json](../../material/local/2026-11-10/painting-diagnosis/run-02/ada-environment.json)、[display-adapters.json](../../material/local/2026-11-10/painting-diagnosis/run-02/display-adapters.json)。默认adapter查询不等于逐提交GPU完成证明。
- 诊断ADA launcher从材料目录解析host打包器esbuild **0.28.2**，普通ADA launcher为 **0.25.9**，见 [build-tools.json](../../material/local/2026-11-10/painting-diagnosis/run-02/build-tools.json)。这是host main/preload开发构建的差异；ADA Vite工程及既有WP vendor未重建。因此本轮不声称与普通bat产物逐字节一致，也不能用数毫秒差异定量分离iframe成本。

### 实际固定包、共用作品与输入

ADA窗口实际加载bundle `df16465d36d9cd7315407612206f033f4d6b0d84a95a09ef45727afb9f7c6556`；port3/native1，声明embedded源060b6a4008c165f3eba220564977826c524e1810、mainBase59f81b5、sourceHash8160bebed4133a0c63f6e5ad5008a70bde82310c4688c173188374790cf3fbcd。**48份ADA样本均记录实际窗口performance资源列表；其中65个实际加载资源再与服务返回字节及manifest SHA核对，全部一致**，见 [actual-loaded-package.json](../../material/local/2026-11-10/painting-diagnosis/run-02/actual-loaded-package.json)、[ada-network.json](../../material/local/2026-11-10/painting-diagnosis/run-02/ada-network.json)、[ada-counted-network.json](../../material/local/2026-11-10/painting-diagnosis/run-02/ada-counted-network.json)。完整136文件磁盘校验仍0不匹配，见 [vendor-after-check.json](../../material/local/2026-11-10/painting-diagnosis/run-02/vendor-after-check.json)。这是窗口加载与磁盘校验两份独立证据；没有重建、替换或重新标记固定包。

共用native夹具为 [A.wpnative](../../material/local/2026-11-10/painting-diagnosis/run-02/A.wpnative)、[B.wpnative](../../material/local/2026-11-10/painting-diagnosis/run-02/B.wpnative)、[C.wpnative](../../material/local/2026-11-10/painting-diagnosis/run-02/C.wpnative)、[D.wpnative](../../material/local/2026-11-10/painting-diagnosis/run-02/D.wpnative)，生成脚本 [generate.ts](../../material/local/2026-11-10/painting-diagnosis/run-02/generate.ts)；文件SHA与manifest见 [fixtures.json](../../material/local/2026-11-10/painting-diagnosis/run-02/fixtures.json)，逐tile原始SHA见 [fixture-tile-hashes.json](../../material/local/2026-11-10/painting-diagnosis/run-02/fixture-tile-hashes.json)。画布2560×1440、RGB8/sRGB；小层固定id=fixture-small、初始1 tile，4K大层id=fixture-big、4096×4096、256个稠密非均匀RGBA图块、alpha255，raw像素64MiB。seed生成式沿用12345的固定公式。B/C的root顺序为“大层→小绘画层”，后者在上方；普通混合、opacity1、偏移(0,0)，无蒙版/效果。D仅大层。截图 [main-B.png](../../material/local/2026-11-10/painting-diagnosis/run-02/main-B.png)、[ada-B.png](../../material/local/2026-11-10/painting-diagnosis/run-02/ada-B.png) 证明笔迹可见；哈希核对证明B/C仅小活动层发生像素变化。

夹具native文档ID采用隔离ADA作品的nativeId，使真实owner接受同一文件。两边逐样本核对canvas、图层id/顺序/显隐/偏移/混合/opacity及全部tile像素SHA，均通过；ADA owner receipt.contentHash也与对应夹具文件SHA一致。所有文件装载、核验和截图准备均在绘画计时之外。

Soft Round 10px、hardness0、opacity/flow1、spacing.1、Smoothing0、黑色、无scatter/texture/airbrush，完整brush参数在ADA各样本options及脚本中。CDP普通鼠标事件的DOM pressure实际记录为0；源码 `src/tools/paintTools.ts:213` 将mouse样本压力规范为1。没有手绘笔/倾斜验收。

正常输入使用 **CDP Input.dispatchMouseEvent**，经过CanvasView pointerdown/move/up及getCoalescedEvents路径，**没有调用tool.down/move/up**。每笔60条定时move；短路径x=600+2i、y=650+sin(i/6)×20，长路径x=200+33i、y=600+sin(i/6)×220，i=1..60。主测setTimeout16ms逐次发出、不等待上一条move回执；真实发送时间和回执时间保留在sent。实际定时器存在漂移，不能称精确60Hz源。慢场景实际投递的move少于60，原始事件数和coalesced数量均保留；不能把发送数当笔刷处理数。低频100ms实验用于有效输入和像素一致性核对。

无hook基线只使用事件/RAF/LongTask观察器，不替换笔刷、边界或engine函数；计数对照仅包装contentBounds/process，每样本只取前两个调用栈，不逐调用生成stack。所有条件预热1次、正式3次，短/长各自独立初态，场景顺序交错。最终六组数据合计 **152个有效样本（38预热、114正式）**，不是152项产品单测。

### F1 — 完整native无hook矩阵与因果对照（完成）

下表单位ms，三值分别为三次正式重复；绘画时段严格为窗口观察到pointerdown→pointerup，RAF仅统计完全落在该时段的帧间隔。启动、文件读取、预热、up后帧均不混入。

| main场景 | 短笔划绘画时段 | 长笔划绘画时段 | 短笔划RAF p95 | 长笔划RAF p95 |
| --- | --- | --- | --- | --- |
| A | 1506.8 / 1292.2 / 1405.1 | 1375.5 / 1386.0 / 1315.5 | 16.8 / 17.0 / 16.8 | 16.8 / 16.9 / 16.8 |
| B | 1318.5 / 1335.7 / 1405.6 | 1369.0 / 1436.5 / 1338.5 | 16.8 / 16.8 / 16.9 | 16.9 / 16.8 / 16.9 |
| C | 1476.1 / 1311.0 / 1389.8 | 1340.0 / 1455.6 / 1398.7 | 16.9 / 16.8 / 16.8 | 16.8 / 33.3 / 33.3 |
| D | 1613.3 / 1576.7 / 1698.7 | 1635.8 / 1596.8 / 1572.9 | 133.4 / 149.9 / 150.1 | 133.5 / 133.3 / 133.5 |

原始数据 [main-native-results.json](../../material/local/2026-11-10/painting-diagnosis/run-02/main-native-results.json)；该文件另外保留了删除前未预热大层的Delete/Reopen对照，F2主要结论使用下面追加的已预热对照。main无hook松手事件结算0.5–1.5ms；排空检测约215–346ms。排空定义为engine无pending连续三次轮询，含约200ms固定确认下限；**不是GPU完成、精确图块呈现时间或真实显示延迟**。

[main-counted-results.json](../../material/local/2026-11-10/painting-diagnosis/run-02/main-counted-results.json) 中，每次D绘画时段捕获约21–23次256-tile扫描，累计约1236–1323ms，单次p50约54–57ms；正常绘画的process预算实测为 **6ms**。采样栈命中PropertiesPanel TransformInfo和layerVisualBounds。Vite调用栈中的PropertiesPanel:223等是转换后行号，磁盘源码归属为main：

- `src/ui/panels/PropertiesPanel.tsx:55` TransformInfo，:56查询内容边界；
- `src/rendering/bounds.ts:13` rasterContentBounds，按raster.version缓存，失效调用contentBounds；
- `src/image-engine/tiledRaster.ts:217` 遍历所有分配图块的全部像素；:147 writableTile在可原地写入时也递增tile.rev及raster.version；
- `src/ui/CanvasView.tsx:317` 绘画预算选择，:552/:602/:642为正常pointer入口；
- `src/rendering/renderEngine.ts:563` 预算处理，单次内部同步工作仍可能超过预算；
- `src/ui/panels/Thumb.tsx:56` revision key、:76边界查询是潜在消费者，本轮没有把其所有工作独立定为第二热点。

临时固定边界只覆盖本次D大层实例的contentBounds，复用精确初始4096方形边界；笔划始终在原有全不透明范围内部。计数D的RAF p95为短133–167ms、长150–183ms；固定边界后均约16.8ms。无hook与计数批次的D绘画时段大致重叠，帧尾有波动，不能将插桩收益当正式可交付收益；不将包含扫描的engine/process时间与扫描时间相加。

为排除事件合并导致的输出差异，另做100ms低频原路径/固定边界对照：[main-slow-exact-results.json](../../material/local/2026-11-10/painting-diagnosis/run-02/main-slow-exact-results.json)。短/长、原/固定各3次正式样本均实际收到60个move；每条轨迹的六份最终逐tile像素SHA完全一致，恢复原方法后精确边界仍为(0,0,4096,4096)。原路径RAF p95为83–100ms，固定边界约16.8ms。绘画时段均约6.54–6.61秒，由输入供给控制，**不声称该实验让笔划总时长缩短**。见 [exact-output-and-reopen.json](../../material/local/2026-11-10/painting-diagnosis/run-02/exact-output-and-reopen.json)。

### F2 — 已预热隐藏层、删除保留undo与重开（完成）

每个独立样本均从C原始文件开始；追加版本在C状态先预热1200ms，再执行正常 `actions.run('layer.delete')`，重新选中同一小层。Reopen在删除后、绘画前用codec+真实文件IPC保存副本并重开，不携带前一状态笔划。所有副本SHA与A文件完全一致。见 [main-f2-warm-results.json](../../material/local/2026-11-10/painting-diagnosis/run-02/main-f2-warm-results.json)、[exact-output-and-reopen.json](../../material/local/2026-11-10/painting-diagnosis/run-02/exact-output-and-reopen.json)。

| 状态 | 绘画前history.index | 大层资源证据 | 短绘画时段ms（3次） | 长绘画时段ms（3次） |
| --- | --- | --- | --- | --- |
| A | 0 | 无 | 1506.8 / 1292.2 / 1405.1 | 1375.5 / 1386.0 / 1315.5 |
| C | 0 | 文档持有256 tile；85.5 MiB | 1476.1 / 1311.0 / 1389.8 | 1340.0 / 1455.6 / 1398.7 |
| Delete | 1 | undo持有256 resident tile；85.5 MiB | 1388.4 / 1455.4 / 1494.8 | 1369.0 / 1446.6 / 1448.9 |
| Reopen | 0 | 无；文件与A逐字节相同 | 1499.5 / 1392.5 / 1437.7 | 1393.3 / 1308.8 / 1456.2 |

已预热Delete/Reopen各轮RAF p95约16.8–16.9ms；C长笔划有16.8/33.3/33.3ms波动，没有形成“隐藏持续慢、删除持续快”的重复模式。删除前后可显示图层集合不同，但undo确实仍保留大层对象、256个Tile.resident为true的图块和mip。**85.5MiB来自raster.byteSize的名义tile+mip量，不等于操作系统物理驻留或GPU纹理总量**；JS heap快照也不能替代这些量。本轮未强制GC、未制造系统内存压力，不能证明重开立即归还了全部RAM或排除其他内存压力场景。

### F3 — 正式ADA开发入口同作品对照（完成）

A/B/C/D均完成短/长、各一次预热及三次正式重复；实际窗口和同作品核验通过。除实际Canvas测量外，源版本、构建模式和运行时差异已在上方披露。

| ADA场景 | 短笔划绘画时段ms | 长笔划绘画时段ms | 短笔划RAF p95 ms | 长笔划RAF p95 ms |
| --- | --- | --- | --- | --- |
| A | 1221.2 / 1374.7 / 1219.9 | 1361.5 / 1308.8 / 1138.3 | 16.9 / 16.8 / 16.9 | 16.9 / 16.8 / 16.8 |
| B | 1140.3 / 1453.2 / 1193.8 | 1286.8 / 1294.5 / 1274.4 | 16.8 / 16.8 / 16.8 | 16.8 / 16.8 / 16.9 |
| C | 1386.9 / 1340.6 / 1287.0 | 1379.5 / 1140.0 / 1260.9 | 16.9 / 16.8 / 16.9 | 16.9 / 16.8 / 16.8 |
| D | 1654.7 / 1646.9 / 1650.2 | 1698.8 / 1658.7 / 1741.2 | 166.7 / 100.2 / 166.7 | 166.9 / 150.1 / 166.8 |

原始数据 [ada-native-results.json](../../material/local/2026-11-10/painting-diagnosis/run-02/ada-native-results.json)。A/B/C的绘画帧尾与main相近；D的ADA帧尾较高，故追加 [ada-counted-results.json](../../material/local/2026-11-10/painting-diagnosis/run-02/ada-counted-results.json) 的同类边界单变量，而未直接扩展GPU/GC全面插桩。ADA D绘画中的边界扫描累计约1391–1516ms；固定边界后短/长RAF p95均约16.8–16.9ms，与main固定边界结果相近。

分段还观察到ADA D无hook的up结算约46–104ms；计数对照D为53–161ms，其中约50–155ms为up事件区间内的边界扫描。固定边界后up结算约3–9ms；main计数/固定对照约0.4–1.7ms。详见 [phase-attribution.json](../../material/local/2026-11-10/painting-diagnosis/run-02/phase-attribution.json)。**up指标包括事件结算及同步UI/嵌入通知，不是单独brush.up函数CPU时间**。大额up差异同样被边界扫描解释；剩余数毫秒差异尚未拆分为版本、UI结算时机或宿主成本，归因保留Inconclusive。若后续确需追这部分，只需定点采样pointerup→history.push→embedded notify/RPC，不应据此先改iframe。

本轮未复现另一个在消除边界扫描后仍稳定存在的块状长帧来源，因此没有继续铺开图块年龄、GPU上传、GC或保存争用实验。实际屏幕呈现、所有笔刷/混合效果、大内存压力、真实笔仍Pending；未把RAF换算为人工体验验收。

### 最小建议、归属与正确性边界

| 候选 | owner与最小范围 | 本轮收益依据 | 风险及后续验证 |
| --- | --- | --- | --- |
| 图块局部内容边界缓存，保留现有整层查询合同 | main：TiledRaster/Tile及rendering bounds；后续经授权按main→embedded→ADA固定包 | 小量改动图块引发整层16.7M alpha样本扫描；固定边界同时消除了main/ADA绘画和大额up长帧 | 键不能只用对象身份；检查tile.rev、原地写入、所有绕过writableTile的写入/touch、COW/restore、删除/清空/边界收缩、mask/fill/depth/channels。验证边界、像素、undo/redo、保存重开及同配方输入 |
| 减少非必要UI查询 | 暂列备选，非本轮首选实施项 | 属性面板是已命中的消费者，但渲染边界也调用同一合同 | 单独节流面板可能保留渲染扫描，并使可见属性过时；先验证局部缓存后的剩余成本 |
| 增量整层边界、图块队列/GPU重构、ADA宿主重构 | 本轮无实施依据 | 尚无缓存之后的稳定大额残差 | 不因已有三阶段设想而一并实施；先测最小方案后的真实剩余工作 |

这是**建议，不是优化授权**。PhotoCraft仍仅为设计参考；本轮没有PhotoCraft运行基准，也不以语言或iframe形式推导性能结论。

### 材料、校验、失败尝试及清理

全部本轮原始脚本、夹具、截图、JSON和可重算统计在新的忽略目录run-02；run-01未覆盖。主索引为 [summary.json](../../material/local/2026-11-10/painting-diagnosis/run-02/summary.json)、[verification.json](../../material/local/2026-11-10/painting-diagnosis/run-02/verification.json)、[exact-output-and-reopen.json](../../material/local/2026-11-10/painting-diagnosis/run-02/exact-output-and-reopen.json)、[phase-attribution.json](../../material/local/2026-11-10/painting-diagnosis/run-02/phase-attribution.json)。152个样本的初态、活动层、像素变化、正常输入、历史变化、可见状态均通过校验；actual-loaded-package另核对窗口资源。

复跑主要入口：main根 `node scripts/build-electron.mjs` →材料 `launch-main.mjs`；ADA owned临时Profile由原 `scripts/drawing-probe-profile.mts ... --unconfigured` 创建，配置隔离DATA_ROOT/APPDATA/runtime/debug端口后运行 `launch-ada.mjs`；用 `setup-ada.mjs` / `fixture-id.mjs` 获得隔离作品nativeId，再用main的run-ts执行 `generate.ts <新材料目录>`。依次执行 `test-ada.mjs`、`run-main-all.mjs`、`test-main-f2.mjs`、`test-ada-counted.mjs`；最后运行 `hash-fixtures.mjs`、`summarize.mjs`、`verify.mjs`、`verify-exact.mjs`、`check-loaded-package.mjs`。实际env/路径/包及端口由脚本、startup/environment JSON和ada-data-path记录；临时连接token已删除，复跑需通过隔离Profile重新取得连接，不能复用原有用户Profile。

前期失败/排除尝试包括：生成器insertLayer传null、CDP不支持Browser窗口大小方法、native路径未授予访问、ADA首次Profile启动超时、nativeId不匹配、activation过期、窗口遮挡导致hidden/RAF停顿。均在正式数据前修正或排除；旧id/串行CDP/遮挡样本保存为preliminary文件，不混入上述表格。最终ADA基线在第28个样本打开前遇到 `StaleProfileTransportError: Profile-scoped client is disposed`，刷新同一隔离宿主后继续，未重复计入27个已完成样本。该失败发生在输入前，不能判为绘画或iframe性能根因。未修改产品来规避这些情况。

诊断实例已退出：main经实际preload确认关闭，ADA隔离launcher停止并清理其进程树；诊断端口无监听、owned子进程无残留，原用户WP PID27460、ADA PID31624均仍运行。测试profile/临时作品保留供审查，未递归删除材料。见 [cleanup.json](../../material/local/2026-11-10/painting-diagnosis/run-02/cleanup.json)。未修改产品源码、正式配置、真实作品或固定包；无分支创建/切换、提交、推送或发布。最终文档/忽略规则/链接/编码与git diff检查见交付核对。

**本轮结束状态：F1/F2/F3补测完成；边界热点有完整输入路径及像素一致性证据；Owner原始删除改善的具体归因、数毫秒宿主差异和真实手绘笔仍保留上述限制。交付供Owner转交ADA集成-REV独立review，随后暂停，不启动优化。**

交付核对：本任务UTF-8无BOM，相对文件链接0断链；三个工作目录的git diff --check通过。main与embedded保留既存dirty集合，ADA工作树仍干净，三处HEAD/分支未变；本轮仅追加本任务及忽略诊断材料。原始材料顶层文件校验清单见 [evidence-manifest.json](../../material/local/2026-11-10/painting-diagnosis/run-02/evidence-manifest.json)。


## 2026-11-16 阶段0归档核对

本诊断为既有独立文档交付，原始run-01/run-02材料仍在忽略材料区，未重跑或重标新包证据。主任务授权整理后交独立review，再单独本地提交；不混入后续embedded内核合并。文首状态按文末实际完成记录修正，人工/手绘笔与原始观察归因限制保持。Task02仅尾随空格dirty已在完整备份后清除，无语义改动。
