# Ctrl+T 后续：后台确认与透视预览

日期：2026-11-11。状态：**Owner已于本轮授权阶段0→C→D→整体验证连续实施、分阶段本地提交；实现与规定验证已完成，待独立实现review和Owner人工体验；不推送或推进embedded/ADA/发布。**

## 1. 范围与基线

工作树为 `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter_main_native`，main，设计核对 HEAD `a2fac7d`，调整前工作区干净。实施前重新检查 HEAD、dirty 与适用 AGENTS。不操作 embedded、ADA 或相邻 _New。

承接[大笔刷与变换任务](2026-11-11_01_large-brush-and-transform-preview.md)，保留已经有效的图块边界缓存、仿射 GPU 预览和一致帧交接。优先级：C 后台确认 → D 透视预览。300px 画笔剩余延迟单独保留为后续测量项，不在本轮扩展笔刷、缩略层或通用任务框架。

既有证据：同尺寸开发窗口仿射拖动已改善；Enter 同步 CPU 提交仍约 6–12 秒。Owner 观察 Ctrl+拖角明显慢于普通拖角；当前 `transformTool.ts` 的 `gpuFor()` 排除 `s.quad`，普通四边形变换进入 CPU 回退。这些不等于已量化本轮优化收益。

## 2. PhotoCraft 参考与 WP 差异

固定参考 `7c12f647150f8e7b2e07718f7993b1fcaa57fefe`，未运行其同机性能基准，不承诺获得相同速度。

| 路径 | PhotoCraft 固定源码 | WP 当前与借鉴方向 |
| --- | --- | --- |
| 确认 | [jobs.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/jobs.rs)：快照、原生后台任务、取消、返回 UI 后校验并提交一次历史；wasm 路径 inline | `commitTransform → applyTransform → warpLayerRaster` 同步执行。借鉴计算与正式提交分离，不照搬完整 job 平台 |
| 重采样 | [transform.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/algo/src/transform.rs)：按目标图块计算、按需取源、及时释放缓冲；原生 Rayon 并行 | 用有界图块任务避免大临时副本；先单个专用 Worker，不把异步等同加速、不立即建线程池 |
| 透视预览 | [draw.rs](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/transform_tool/draw.rs)：缓存纹理经单应变换网格显示并处理投影边界 | 现有 atlas/override 仅支持有限 affine；扩展 projective 采样，复用完整源和一致帧发布 |

## 3. 阶段0：确定数据交接和实际成本

读取 `transformTool.ts`、`imageOps.ts`、`resample.ts`、TiledRaster/COW、history、保存/关闭、既有 Worker 与 GPU override/atlas 生命周期。列出 C/D 支持条件、修改函数和复用边界。

固定 4K 非均匀含透明源、视口/DPR/缩放/设备/运行方式，各预热一次、正式三次；隔离测试作品与 profile，不操作用户窗口。分别测量 Enter 的快照/打包、传输、计算、结果安装/历史、authority 呈现；透视记录正常 Ctrl+拖角及 Ctrl+Alt+Shift 路径，不能用普通缩放代替。保留原始输入与最终矩阵。

阶段0必须说明 Worker 数据格式、共同几何/总容量预检、内存上限和拒绝/回退分类；识别主线程仍可能长阻塞的位置。容量估算须包含总目标像素/字节、源快照、结果及同时在途临时缓冲，不能仅限制单次源读取。另须记录以下两项落点：

- **传输块与逻辑采样区域分离。** 当前 `imageOps.ts` 按1024×1024区域调用 `warpRaster`，后者在区域中心选mip。传输/调度可细分，但必须保留原逻辑区域、分区原点及采样上下文；不能以改成256块后仍调用同一bicubic函数作为像素等价证明。
- **编辑保护的归属与时序。** 当前 `session.editProtected` 同时限制编辑和历史写入，保存/关闭还会在finally释放它。列明任务、保存、关闭各自持有/等待/释放保护的时序，选择局部owner/token或等价的明确归属机制，避免直接共用一个无所有者布尔值；无需建设通用任务框架。

若需改变权威像素语义、放弃取消恢复或建设通用历史/任务平台，先回报设计差异，不自行扩大范围。

## 4. C：后台正式变换确认

### 最小首版

- 支持现有简单单 RGB/RGBA8 像素层、无选区/蒙版/效果的仿射及合法四边形变换；资格及容量在启动前确定。功能不支持的组合仅在通过共同几何/总容量预检后才允许保留原提交路径，并明确标记；不能宣称全部 Ctrl+T 已消除阻塞。无法保守确认安全容量的情况拒绝本次确认，不绕过检查。
- 只建立变换专用 Worker。复用现有 CPU 正式重采样内核，保持 bicubic、透明像素处理、坐标与量化语义；GPU 预览不充当权威结果。不为了变快降低最终质量。
- 读取稳定源快照，按需发送有界源/目标图块，避免每个目标图块重复传整层。不得 transfer 正在被文档、历史或预览持有的 buffer；私有副本可 transfer。限制同时在途数据和目标结果容量，提前拒绝不合理输出范围。
- 打包、拷贝、结果组装也须有界并给 UI 调度机会；仅给同步重采样加 Promise 不合格。最终准备私有 raster 后短时间交换，不在 UI 线程重新逐像素复制整幅图。

### 生命周期与正确性

`preview → preparing/applying → ready → committed`，失败/取消回到可恢复预览。Enter 后保持最后完整预览与变换参数，显示进度和取消；成功权威画面完整可用后才交接。

- 同一目标文档在任务期间阻止编辑、undo/redo、再次确认与工具切换引发的隐式提交；非冲突 UI 保持响应。不允许重复 Enter 创建第二任务/历史。
- 保护由当前operation持有，只有持有者能够释放；保存/关闭的finally不得提前解除变换保护。结果就绪后，在仍阻止外部编辑的受控提交区完成版本校验、权威替换和一次历史写入，再结束任务并交接保护；不能因editProtected阻止自己的历史写入，也不能先无保护解锁再提交。
- 任务绑定 document/session、源 revision 和唯一 operation id；提交前重查。文档关闭/切换使任务取消或失效，晚到结果不得写入其他作品；取消后可重新进入，旧结果不能覆盖新任务。
- 保存/自动保存不得把预览当成已提交结果：目标文档保存请求等待任务成功或取消后读取稳定权威状态；关闭必须协调取消/完成与原关闭流程。不能显示虚假“已保存”，不能在取消前释放仍被 Worker 使用的资源。
- Worker失败同样必须结束等待并释放本任务保护；等待中的保存/关闭重新检查会话、权威revision及尚未确认的变换状态，按原保存/关闭规则继续或明确返回失败，不无限等待、不把失败当成变换成功。若仅保存未变换的权威作品，必须明确其不包含仍保留的预览参数。
- Worker 异常、取消、内存/容量拒绝、结果验证失败均不改权威像素/selection/history；仍可重试或 Escape。提交成功只产生一个历史步骤，取消产生零步骤。历史成功后的通知错误不得导致重复提交。
- 取消机制必须能在计算期间实际生效，可分块让出 Worker 消息循环或终止专用 Worker；单线程忙循环仅等待 cancel 消息不合格。不以 SharedArrayBuffer/跨源隔离作为新默认依赖。
- **执行能力不足与变换本身不安全分开。** Worker加载失败或功能不支持，仅在共同几何/总容量预检通过后才可启动前明确回退CPU。非法/非有限矩阵、不可接受的投影范围、不合理输出或总内存预算超限，直接拒绝本次确认，保留参数供调整或取消，绝不转入旧同步CPU提交。Worker专用传输/在途预算不能满足时也不能自动视为CPU安全；若考虑回退，须独立证明其峰值满足同一总预算。运行中失败不自动再执行一遍阻塞 CPU 提交，须展示失败并保留重试/取消选择。

### 验证

与修改前 CPU 参考比较同矩阵逐 tile 字节、坐标及 undo/redo/native 重开；覆盖平移、缩放、旋转、翻转、四边形、负坐标和画布外源。注入中途取消、重复 Enter、Worker 失败、过期回执、关闭/切文档及保存竞争，验证零半成品、零双写、一次历史。

补充必测：大倍率/近退化/总容量拒绝时同步CPU提交调用数为零、权威及历史不变、参数可继续调整；合法的Worker不可用回退必须经过同一预检。跨mip阈值的透视及透明边缘与原1024逻辑分区精确对照，覆盖传输细分后的输出。保存等待期间Worker失败必须结束等待、正确释放各自保护并可恢复编辑；成功提交时外部编辑仍被阻止而本任务历史能写入，不能被保存/关闭finally提前解锁。

测量总耗时与 UI 阻塞分别报告：至少消除原 6–12 秒连续主线程冻结，进度/取消持续响应。记录最长主线程任务、取消请求至响应、最后预览至权威交接及峰值在途字节。阶段0先列出可测响应门槛（建议常规取消/UI反馈 ≤100ms），超标需归因，不能仅以 Worker 已运行判通过。总耗时若未下降必须如实保留，不能称确认已变快。

## 5. D：四边形/透视 GPU 预览

- 在既有 GPU override 与稳定源 atlas 上扩展单应变换，包含齐次坐标除法及安全判定；不能只删除 `s.quad` 资格判断。保持已有简单图层组合/颜色位深限制，不扩展 mesh warp、复杂图层或 GPU 权威提交。
- 完整源覆盖负坐标和画布外内容；沿用容量预检，不允许裁掉超画布源后声称成功。既有显示缓存不能代替完整源。
- 显式处理奇异矩阵、自交/退化四边形、投影分母接近零或跨越无穷远；非法或无法证明安全的情况在分配前拒绝并保留可恢复状态，不能生成无限目标区域。仅GPU能力/资源不足且几何与容量安全的情况允许有界CPU预览回退；预览回退不豁免C的正式确认预检。
- 明确透视下空间变化的缩小倍率与 mip 策略，控制锯齿/模糊及层级切换上传；不直接沿用仅适用于仿射的全局 determinant。稳态无内容/层级变化不重复上传源。
- 复用完整代际交接和 latest 参数策略：持续拖动持续产生完整画面，不可一直等停手；保留上下层遮挡、颜色设置、viewport/设备变化与资源释放机制。禁止 `process(Infinity)` 全量准备。
- Enter 使用 C 的合法四边形提交路径，取消恢复原状态；预览参数与最终提交矩阵一致，不以末次事件丢失换平滑。

验证正常 Ctrl+拖角、Ctrl+Alt+Shift、持续快速拖动、停手收敛、Enter/Escape，以及退化/容量/GPU失效回退。包含画布外源缩入、透明边缘和上层遮挡。记录混合代际为零、持续发布间隔、上传次数、RAF p95；同输入前后各三次，不能以平均 FPS 或静止截图替代。正式像素以 C/原 CPU 参考为准，GPU 预览单独检查几何与允许采样误差。

## 6. 执行、提交与交审边界

按本轮Owner明确授权，依阶段0 → C → D → 整体验证执行，C/D 各自完成正确性检查后本地提交；整体证据及文档另一个提交。不把正确性检查全部拖到最后。正常范围内连续推进，设计范围变更才回报，不因常规实现细节反复要求确认。

整体至少覆盖 transformPreview、Move/输出交接、tile bounds、history/native 相关回归与项目构建；实际命令按 TESTING 和阶段0落点确定。不新增全模式笛卡尔积。Worker 加载需同时验证开发入口及生产构建窗口，不能只用 mock/源码 Worker 测试；未获得窗口证据则标 Pending。

完成后交 ADA集成-REV 独立 review，列提交、源码/配套环境、支持/回退条件、前后原始证据索引及未验收项。自动测试、开发/生产窗口、Owner体验、独立复审分别记录；不得自动推送、合入 embedded 或更新 ADA 包。

## 7. 实施前设计交付记录

设计阶段仅新增任务并连接入口。其后Owner告知计划评审通过并授权实施；实施、验证和剩余Pending见第8–11节，设计通过不等于实现或体验通过。

评审修订：接受reviewer的P2，明确共同安全预检与能力回退分离，并补充容量拒绝不得调用同步CPU提交的回归；同时纳入采样分区及编辑保护归属两项阶段0澄清。此为计划修订，待reviewer复核，不自行标记Approved。


## 8. 阶段0诊断与实施落点

实际main HEAD为a2fac7dfc429df17a5b4dd719c4c6c88b2ddafaa。已有dirty为AI_CONTEXT/DEV_LOG、前任务01记录、本任务02设计；不覆盖前任务01或顺带提交其修改。本任务相关上下文段可定向回填。产品修改前已保存baseline-state.json、baseline.diff、baseline-source.tar于忽略的 `doc/material/local/2026-11-11/transform-commit/run-01/`。

完整native开发窗口固定1450×1000、DPR1、zoom.2、相同4K非均匀RGBA8源并加入透明像素，独立profile/temp/16062/16462；测试宿主固定可见且忽略实体鼠标，正常CDP输入经CanvasView。before-transform-all.json共12份：affine/Ctrl拖角/Ctrl+Alt+Shift各预热1次+正式3次交错；Ctrl两种均有真实quad，不用缩放冒充。正式Enter含同步处理为affine8804/8905/8585ms、Ctrl8269/7879/8264ms、perspective9087/8675/9001ms；停止均pending=false。基线可分的快照/传输/安装尚无异步边界，按同步整体记录，不能虚构分段计时。后续增加独立阶段metrics与主线程/取消证据。

### C落点与数据边界

专用变换Worker复用warpRaster/TiledRaster；保持imageOps的输出边界roundOut、从目标nb原点起每1024逻辑区域、该区域中心mip选择和采样源范围，逻辑计算不拆成256采样区域。源RGBA8私有tile副本逐个发送，最多一个在途；Worker内同样1024计算，量化/compact后按256私有tile转移回来，主线程直接装入尚未发布的私有raster，不重拷整幅。文档/历史/预览buffer绝不transfer。取消终止专用Worker，既有同步内核无须SharedArrayBuffer。打包及安装逐消息/yield，记录单单位/总耗时、峰值在途、计算/交换与总耗时；目标UI/取消常规反馈≤100ms，超标仍如实归因，不承诺总耗时下降。

共同预检拟落src/image-engine/transformPlan.ts，先验证finite/可逆、凸quad、正反投影分母在矩形域不跨零或近零、可接受坐标/输出范围，再估算全部相关raster/结果。上限：操作保守峰值768MiB、总目标32M像素、边长32768，坐标界限保证tile键安全；估算包含相关权威源、Worker源副本、两端mip完整包围矩形、两份结果容量、最大源Float32读区、1024 Float32输出及同时在途缓冲，不只限制某次readFloat。超限/无法证明安全直接拒绝，保留参数，不调用同步CPU。功能或Worker启动能力不足仅在共同预检已通过才可明确CPU回退；运行中错误不自动CPU重做。复杂Warp/动态外观不能保守证明容量时拒绝确认，不借功能不支持绕过安全预检。

编辑保护落DocumentSession：按owner持有token，保存/关闭只释放自己的token；canEdit始终对外为false。本任务带token的history push只给受控替换/一次历史，不临时全局解锁；原普通push/undo/redo仍拒绝。保存请求先等待transformPending，再重查会话及结果；失败/取消后明确返回未保存，不假装含预览。自动保存等待或跳过不稳定目标，不序列化预览。关闭等待完成/失败后沿原规则，切文档/直接移除取消任务；工具切换、重复Enter与参数编辑任务期拒绝，非冲突UI/进度取消可用。操作绑定唯一id、session、doc/source版本，晚到结果丢弃；正式安装前重查，工具内COW回滚保留上轮失败恢复合同，不建设通用job/history平台。

### D落点

在既有override/atlas affine采样内加入齐次除法，不新增renderer。共同几何/容量判定用于预览，非法状态保留最后完整预览并允许参数调整/Escape，不转CPU。对合法projective在每个显示逻辑tile中心求原localScale，复用warpRaster相同bilinear/mip选择及其逻辑源采样范围；准备同帧所需层级集合，参数不改变层级/内容则不重复上传。层级因空间变化使用逐tile选择，不沿用全局determinant。沿用6ms单位间预算、冻结准备代际/latest下一代、完整Map交换与完整负坐标源。

阶段0路线与源码/基线一致，按有限落点继续C；Worker实际加载需开发及生产窗口，自动注入不代替窗口验收。原始基线不纳入Git。


## 9. C实现及阶段验收

实现transformPlan共同finite/凸quad/正反分母/输出坐标、总像素和保守768MiB容量预检；范围或总预算拒绝在Worker/同步CPU之前，参数保留。加入专用transformWorker和单在途ACK协议，源仅transfer私有256KiB副本；原1024目标逻辑区域、原warpRaster bicubic/mip/量化保持不变，结果量化/compact后按256私有图块转移，主线程直接安装到未公开raster。macro矩阵重放也经过同一安全预检，仍明确为同步路径，不宣称它消除冻结。

首版后台资格为单个根RGB8普通Normal像素层、无selection/mask/vectorMask/效果/clipping/高级混合且opacity/fillOpacity为1；合法quad与affine均支持。其它可保守确认的栅格组合在共同预检后保留明确CPU提交；动态appearance、非零fill或Warp等不能证明容量时拒绝确认，不以能力不足绕过拒绝。Worker不存在/启动加载失败可在已通过共同预检后明确CPU回退，运行中错误不自动重做。cancel终止Worker并settle promise，进度取消保留可恢复preview，Escape/切文档/直接移除取消并退出；操作id+session+doc/source身份/version在交换前重验。

Session保护按token/owner持有；兼容legacy布尔仅操作自己的legacy保护，不能解除token。本任务history push携带私有token，在canEdit仍false时只允许持有者且无其它owner的受控提交；外部history/undo/redo/共享编辑入口不获临时解锁。output/close仅释放各自token，文件请求等待transformPending；失败/取消明确返回未保存/未关闭，下一请求仍须确认/取消保留的preview。autosave等待稳定结果并跳过未确认preview。COW root/selection恢复点覆盖部分swap，history已插入的通知异常按成功处理，防止双提交；结果完成前旧完整预览保持，权威帧沿既有整体交换。

定向 **4文件79/79通过**：新增transformTask28项，transformPreview19、Move/output及tile bounds。包括五种几何与负坐标/画布外源、透明数据、原1024跨mip透视精确参考（错误256重采样会产生不同SHA）、原buffer不detach、每次≤256KiB在途、完整history/native、外部编辑与自己history共存、容量/非有限/近奇异/自交/投影horizon拒绝、Worker不存在与加载/运行失败、重复Enter、中途取消/切换/移除、过期源/坏回执、保存/关闭/自动保存等待、保护owner、部分交换及通知故障。初轮FakeWorker跨realm typed array模拟有误与若干测试断言/夹具错误已修正后重跑，失败尝试不计通过。P-BUILD通过，既有Vite警告保留。

真实开发窗口afterC-probe（透明夹具，单次仿射能力探针）：Enter返回7.6ms，快照约1ms、预检1.1ms、私有copy累计37.4ms（单单位最大0.3ms）、source ACK等待23.1ms、内核+量化6960.7ms、Worker含ACK7033.3ms、结果就绪7139.7ms、组装3.4ms、交换/历史3.8ms；峰值在途262144 bytes，保守估算674758656 bytes。这是单份阶段探针，不代替最终三轮比较。主线程authority仍有102/125ms长任务，未宣称无长帧。实际Cancel按钮预热+3正式响应5.8/5.9/6.9ms，像素/历史不变、参数保留，可重新确认。

生产真实app://窗口production-C/production-C-immediate已加载构建的专用Worker资源并完成一次历史，不依赖DEV模块hook或mock；记录独立Worker target、持续RAF、异步pending保护及最终undo/redo逐tile一致。首次观察通用进度UI延迟250ms，已仅给变换任务加入immediate进度选项并复验：Enter返回8.1ms、可见progress/Cancel约6.2ms，pending时canEdit=false；生产authority仍有最高225ms长任务，人工体验未验收。开发/生产证明的是本机加载和路径可用，不等于打包分发/Owner体验通过。

夹具纠正：首次before来自继承的全不透明源，最初透明注入表达式因索引含小数没有生效，整组不得充作本轮合格性能对比。核验后统一使用全透明/半透明非均匀4K夹具，before-transparent在实施前保全的a2fac7d源码副本重采12份；不切main或覆盖dirty，环境相同，正式Enter最长主线程任务8063–8840ms。原始错误夹具和两组证据全部保留。C最终三轮及D性能在整体阶段继续。

C阶段代码和以上证据本地提交后进入D；不涉及大笔刷、embedded/ADA或通用任务框架。


## 10. D实现及阶段验证

在原gpu.affine override描述中增projective标记，继续使用同一atlas与合成管线。WGSL增加齐次分母除法、接近零及转换为整数前的范围保护，源采样仍是premultiplied bilinear。几何安全由共同预检对完整源正投影及正式输出逆投影域证明；显示域中落在有效源投影外、接近逆分母零的像素安全返回透明，不构造无界采样区。每个显示逻辑tile使用其自身逆映射中心localScale选择mip及原CPU采样区域限制，空间倍率不同可使用不同level，不用全局det；warpRaster只是抽出原计算步骤为warpSampleContext，正式1024分区、插值、量化及运算顺序保持。

按同帧可见集合准备所需层级，既有prepareAffine缓存持有各mip的稳定源；新增保守完整源0..8层级atlas容量核验，仍最多256源tile包围矩形、简单根像素层组合≤3。层级切换可首次上传对应mip，不把每次参数更新当源变化。完整负坐标/画布外源不裁切；合法GPU能力/容量失效进入同参数、有界CPU preview，非法/总预算拒绝不安装新的GPU或CPU采样closure，保留上一完整代际并显示可调整/取消状态。资格校验和准备几何冻结为该代际副本，避免后续quad输入改变准备中的参数；沿用6ms单位间预算、latest下一代及完整Map交换，没有process(Infinity)。

阶段新增projectivePreview **9项真实GPU测试**：两种controller修饰键路径、上下层遮挡、负坐标/画布外非均匀透明源、zoom1/2、空间变化mip、相同源不重复上传、持续参数更新完整代际推进、非法quad零新GPU/CPU采样、容量和设备回退。GPU与CPU bilinear preview在这些小夹具的max误差<4/255；正式结果仍用独立CPU bicubic/原字节参考，不能把preview误差界当正式误差许可。

自查修正与回归：共同容量补计live authority、冻结preview及Worker/CPU私有源三份可能共存的mip；单通道CPU扩展RGBA32与浮选区完整cur/from Float32写回缓冲也计入，不沿用C探针旧估计。总预算仍768MiB，不扩大。首次窗口精确比对发现组合键透视仅一tile不等：geometry预检用乘倒数，而原warpLayerRaster用除法，ceil使宽度4576变4577。已严格改回原除法顺序，补对称透视边界精确回归。另补无位移确认零Worker/零历史、CPU回退也持有owner保护、macro重放安全预检回归。当前定向 **5文件93/93通过**（task33、projective9加既有51），P-TYPE及P-BUILD通过。

完整native开发窗口最终有效组为before-transparent-transform-all.json与final2-transform-all.json，均预热+3正式/三种路径，各12份，环境JSON字段完全相同；每份60个coalesced点，无额外鼠标输入。affine/Ctrl/组合透视每类各9组同参数交叉配对最终tile SHA与坐标精确相同，全部undo/redo恢复相同，停手pending=false。final2为新的独立profile但同prefs/viewport/runtime；先前final组出现一份零输入及窗口失活/RAF准备超时，已排除并重启；脚本已增加完整输入/quad前置验证。afterD组的旧透视像素差异也已明确废弃，不拿它当最终像素通过；所有原件保留。

| 预览路径 | 前态三次RAF p95/ms | final2三次RAF p95/ms | 后态完整代际数 | 后态最长发布间隔/ms |
| --- | --- | --- | --- | --- |
| 仿射对照 |18.1/18.2/18.2|18.1/18.1/18.1|60/58/58|36.1/35.6/54.1|
| Ctrl拖角 |36.0/36.0/36.0|18.2/18.1/18.1|56/56/57|107.3/52.7/88.5|
| Ctrl+Alt+Shift |36.0/35.6/35.8|18.1/18.1/18.1|54/53/56|88.4/106.5/71.5|

两类透视p95中位数约下降49.7%/49.4%。前态透视本已一致帧，但持续拖动仅4–5完整代际、最长约357–406ms；本轮**前后混合代际均0**，不冒称从混杂修成一致。透视每次首次层级变化新增64个mip tile上传，最长间隔对应这段准备的4–7个RAF、单次process约6.2–6.6ms；源上传达到稳态后增量0。该计数仅raw8 atlas上传，不统计旧CPU override的临时Float32上传，不用“旧计数0”暗示旧路径无需传数据。首次切换仍约107ms，未宣称所有画面反馈≤100ms。

生产production-D.json：真实app://窗口正常组合键拖角，override.projective=true；通过保留原生Worker构造、只记录URL的观察器确认加载 `app://celenne/assets/transformWorker-CckuvPAs.js`，非mock。Enter返回11.8ms、progress/Cancel约16.1ms出现，任务期canEdit=false，完成一次历史，undo/redo逐tile一致。与开发测试分别记录；没有把script窗口证明当Owner/物理设备验收。

D阶段实现、以上定向回归及开发/生产路径证据完成后本地提交，整体回归和最终上下文继续。


## 11. 整体验证与交审结果

阶段0 `cf4d013`、C `dd94aca`、D `0ec5c2d` 已本地提交；本节所在最终提交包含整体证据、上下文及取消回调owner最后修正。后者将Cancel绑定具体task而不是可被重试替换的s.job，旧回调/旧session取消句柄不能取消新operation，已结束task的cancel也不再改写metrics。整体回归 **18文件295/295通过**；最后这一局部修正后相关task/projective/Move-output **3文件65/65复验通过**，最新P-BUILD通过（含typecheck），不虚增为360个唯一测试。

整体文件：engine下transformTask、batchedPaint、core、regressions、native、modes、inkModes、cmyk、features、moveSelection、moveSelectionReference、tileContentBounds；gpu下projectivePreview、transformPreview、compositor、preview、floatingSelection、moveOutput。保留原笔刷和GPU Move优化，不做全格式/全工具笛卡尔积。

### C最终性能与分段证据

正式比较只使用第10节 before-transparent/final2两组同环境、同4K含全透明/半透明源、同输入/最终矩阵的预热+三轮；没有并行测试/构建。最终分段diagnostics每次记录backend=worker，峰值在途始终262144bytes。普通/Ctrl操作保守CPU资源估计698089472bytes、组合透视714866688bytes；这是此次变换相关源/结果/临时资源的静态估计，不是实测全应用RSS/VRAM，GPU atlas另有独立容量预检。

| 确认路径 | 前态Enter→authority drain三次/ms | final2三次/ms | 总耗时中位数变化 |
| --- | --- | --- | --- |
| 仿射 |8941/8367/8549|7202/7145/7646|减少约15.8%|
| Ctrl拖角 |8949/8413/8995|6806/7406/7207|减少约19.5%|
| 组合透视 |8848/8655/9113|8047/7948/7710|减少约10.2%|

以上总时长包含authority准备和轮询，不是纯内核，不能从单Worker推断普遍并行加速。正式后台任务快照0.3–0.9ms、共同预检0–0.2ms、私有源copy累计36.4–44.2ms（单单位最大0.3–0.5ms）、source ACK等待24.8–50.4ms、内核+量化6443–7644.9ms、Worker计算墙时含结果ACK6473.2–7683.1ms、主线程结果组装1.2–2.9ms、交换/历史0.2–0.6ms，结果就绪6576–7781.8ms。分段有包含关系，不相加冒充总耗时。

前态正式最长主线程任务8063–8840ms；final2为94–128ms，Enter事件返回5.2–28.9ms，已消除该路径原数秒连续UI冻结，但**仍有authority bounds/mip/显示长任务**。结果就绪到引擎drain的差值约204–299ms，含预检/轮询，不当成裸GPU交接计时；观察commit可见tile齐全、代际不混杂且无倒退，保留最后preview至authority。RAF/元数据不能证明物理显示扫描，体验仍待人工验收。

为补齐旧同步路径的分段成本，另从原a2fac7d归档建立baseline-diagnostic，只加入performance.now计时（原始baseline-source/tar不改），before-phases每路径单份诊断：快照0–0.4ms、warp准备62.8–88.5ms、原内核8108.2–8389.9ms、结果writeFloat构建337.9–461.4ms、history安装0.4–1.6ms；原路径无传输，记0/N/A。该带探针额外样本未预热/三轮，**只作归因，不混入正式性能表**。原正式before-transparent仍是无计时补丁的保全源码。

### 最新生产取消/重试与收口

production-final-cancel-retry.json来自最新生产构建真实app://窗口、同透视入口：实际Cancel按钮约14.9ms响应，取消后像素/历史与原作精确一致、mode仍transform；再次Enter加载第二个真实原生Worker，最终只产生一个历史步骤，undo/redo一致。观察器仅包装原生构造记录URL，没有mock Worker。此前开发取消三轮及生产加载/立即进度证据仍保留。末次回调owner修正仅影响取消/重试分支，正常像素与性能计算路径未改，不把最终正式矩阵冒称重跑过取消补丁后的性能。

| 分类 | 当前支持/处理 | 验收边界 |
| --- | --- | --- |
| 后台确认 | 单个根RGB8普通Normal像素目标，opacity/fillOpacity1，无selection/蒙版/效果/高级混合等，合法affine或quad | 原CPU内核/1024逻辑分区，私有图块，session/revision/op校验，一次history；不是GPU权威结果 |
| 合法CPU回退 | 功能不支持或Worker不存在/启动加载失败，且共同几何/总预算已通过 | 明确提示标准处理可能暂停UI；同步路径仍有owner保护，不宣称此类全部消除阻塞 |
| 安全拒绝 | 非finite/近奇异/自交/投影horizon、范围或总预算超限，或动态appearance/Warp/非零fill等不能证明安全容量的情况 | 保留参数供调整/Escape；零同步CPU绕过。运行中Worker失败不自动CPU再做 |
| 透视GPU | 原有限RGB8简单根像素图层组合≤3、完整源/全部mip atlas预算可容纳，Ctrl两种路径 | 逐显示tile空间mip、齐次除法和完整代际；GPU能力不足且共同容量安全时CPU preview |
| 生命周期 | 任务期间编辑/历史/工具及重复确认保护，保存/关闭等待，失败/取消显式退出；owner-only释放 | 自动注入及脚本窗口证据通过，真实Owner操作习惯/设备体验仍Pending |

剩余事项/Pending：确认总耗时仍约6.8–8.0秒，authority仍有最高128ms开发长任务（生产阶段另见最高225ms），透视首次mip层级切换仍可造成约107ms完整画面发布间隔；CPU回退仍可能阻塞。真实手绘笔/物理呈现、Owner原作品及真实保存关闭体验、真实设备丢失/内存压力（本轮为程序化失效/故障/容量注入）、分发安装包/不同设备和全组合矩阵未验收。没有运行PhotoCraft产品同机基准，没有ADA消费端或集成包验收；不自动改判整体体验Go。

原始JSON、PNG、脚本、源码归档/诊断副本均留在忽略目录 `doc/material/local/2026-11-11/transform-commit/run-01/`，final-manifest.json给出源码与有效证据SHA索引。P-DOC核对UTF-8无BOM、相关本地链接与材料忽略，git diff --check通过。前任务01的既存dirty衔接段SHA保持，未纳入本轮；AI_CONTEXT/DEV_LOG仅回填本任务02段。完成后交指定独立reviewer，随后暂停；不推送、不修改embedded/ADA、不更新固定包或发布。
