# 大笔刷处理与 Ctrl+T 预览优化设计

日期：2026-11-11。状态：**Owner 已授权阶段0→A→B→整体回归连续实施及分阶段本地提交，执行中；不授权推送、embedded/ADA更新或发布。**

## 1. 目标与证据边界

Owner 在 main 实测反馈：普通绘画已较连续；约300px画笔和橡皮擦仍有延迟感；Ctrl+T拖动出现图块位置不一致的画面。Owner 表示 PhotoCraft 同样4K画布下没有此体验。截图能证明所截时刻存在块状不一致，不能证明停止拖动后或 Enter 提交后的结果仍错误；这两项必须复现区分。

前置[图块级边界缓存任务](2026-11-10_02_tile-content-bounds-cache.md)的两阶段提交627e790/e168f36已获本聊天独立技术review Approved，保留其缓存，不回退。此前测量证明大活动层边界扫描显著减少；不等于300px笔刷、Ctrl+T、真实笔尖延迟及ADA新包已验收。

本任务含两个独立工作项：A普通大画笔/橡皮擦，B自由变换预览。二者共用诊断原则，不要求建设统一渲染框架；一个通过不替代另一个通过。目标分别是降低多印迹的重复像素处理、避免变换预览混杂不同状态。不能仅以RAF变快宣称全部问题解决。

工作树：`D:/00_Projects_WSY/AI/Codex_Projects/WebPainter_main_native`，main，设计基线 `e168f36661a682a872c7dfc2f9c2f2f55a146207`。执行前核对适用AGENTS、文档入口、实际HEAD/dirty。保留已有AI_CONTEXT/DEV_LOG/DEV_SETUP、scripts/start-current.mjs、start-dev.bat工作，不覆盖或顺带提交。不要修改相邻embedded/ADA或使用_New。

## 2. 固定源码参考与架构对照

PhotoCraft参考固定为v0.20.2 / `7c12f647150f8e7b2e07718f7993b1fcaa57fefe`，不是持续变化的main。用户实际运行版本未在本轮核对；未编译/运行PhotoCraft基准，不能从代码推算其具体领先倍数。

变换相关原件位于另一WP工作树 `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter/doc/material/local/2026-11-05/photocraft-v0.20.2/`，本轮核对transform_tex、begin、draw三文件与该日SOURCE_MANIFEST的SHA一致。笔刷源码由同一固定commit的官方仓库读取。未来引用/移植必须固定版本并记录来源；不可把旧[PhotoCraft参考](../../architecture/PHOTOCRAFT_REFERENCE.md)中的旧WP行为当成当前实现。

### 2.1 大画笔与橡皮擦

```text
WP main e168f36
CanvasView coalesced samples -> 逐样本 tool.move
  -> 生成 dabs
     -> 每个 dab 计算覆盖
     -> 读 original + 累计 stroke 区域
     -> 更新累计覆盖、混合、写回 target
  -> RAF 合并变化通知 -> 渲染脏区

PhotoCraft 固定版本
批量输入样本 -> StrokeRenderer 累计覆盖
  -> 记录变更的覆盖图块
  -> 本批只合成 dirty 图块 -> 写回目标、报告 damage
     -> 工作区域缓冲复用
     -> 原生端达到阈值时并行；WASM 分支串行
```

| 方面 | WP已核对实现 | PhotoCraft已核对实现 | 借鉴边界 |
| --- | --- | --- | --- |
| 输入 | CanvasView:602起取coalesced事件并逐个调用move | feed_live_stroke收集未消费点；批量move时延后到批末调用，P1 | 保留全部输入与时间/压力，不降采样换快帧 |
| 覆盖与目标写回 | PaintOp已有1通道32位stroke缓存，但每个dab执行原图读、覆盖读写、目标混合写回；paintTools的RAF仅合并通知 | push一批点后composite dirty coverage tiles，P2/P3 | 不能称WP“没有笔划缓存”；差异是合成时机和重复工作 |
| 临时内存 | dabCoverage支持out参数，但当前applyDabs未传复用buffer；readFloat常分配区域数组 | 64×64 coverage tiles；分批合成、区域buffer pool，P3 | 先减少重复与分配，不直接把文档256图块全改64 |
| 并行 | 当前JS同步像素路径；WebGPU画布不等于笔刷像素计算在GPU | 原生Rayon按工作量阈值256×256像素并行；wasm32串行，P3 | 不声称Rust/WASM迁移自动获得并行；worker/GPU笔刷不在首版范围 |

WP当前定位：`src/ui/CanvasView.tsx:602`、`src/tools/paintTools.ts:215`、`src/brush/engine.ts:246`、`src/brush/paintOps.ts:62–106`。PaintOp同时服务brush/pencil/eraser及mask/channel等目标；其他StrokeOp可能读取实时目标并依赖印迹顺序，不可统一批处理。

PhotoCraft一手参考：

- [P1：输入批次](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/canvas/strokes.rs#L425-L456)
- [P2：实时笔划push与合成](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/cmd/brush_cmds.rs#L685-L745)
- [P3：覆盖、并行及脏块合成](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/paint/src/render.rs)（43–93并行；1120–1274合成/缓冲池）

### 2.2 Ctrl+T

```text
WP：变换状态变化 -> updatePreview
    -> override.read按请求区域warpRaster/meshWarpRegion
    -> invalidateAll -> 分块重建显示结果

PhotoCraft：开始时准备预览纹理
    -> 拖动更新quad/homography -> 已缓存纹理映射到网格
    -> 按屏幕缩放选择/缓存mip与过滤方式 -> 显示上方图层
    -> 确认时走正式变换提交
```

WP `src/tools/transformTool.ts:129–184` 的像素预览与此前Move工具的lift/floating GPU路径不同。内容边界缓存减少其查询成本，但没有将重采样预览改成纹理变换。Ctrl+T当前确认/取消在同文件307/332起，仍负责选区、mask、COW及历史；本任务不能用预览纹理覆盖其权威结果。

PhotoCraft PreviewTextures会缓存上传的纹理、mip/过滤及显示配置变体；draw_content用网格绘制当前变换（普通透视路径使用24×24网格），随后绘制above。复杂效果/warp还有其它分支，不表示所有情况都只有一次GPU矩阵更新。它的具体颜色/混合结果不作为WP像素参考。

- [P4：预览纹理与mip选择](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/transform_tex.rs#L1-L118)
- [P5：变换网格与above](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/transform_tool/draw.rs#L102-L152)
- [P6：开始时准备纹理](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/transform_tool/begin.rs)

**源码事实与推断分开：**上述机制已经阅读；“它们解释本次300px延迟和截图全部现象”仍是待验证推断。PhotoCraft正常体验是Owner观察，不是同作品、同笔刷、同输入/硬件的实验。

## 3. 阶段0：最小诊断与设计落点（未来实施授权后的首步）

先读现有GPU override/lift/atlas、PaintOp及工具生命周期，记录准确owner/调用序列，不直接照搬PhotoCraft结构。所有诊断使用独立profile/temp和测试作品副本，保留用户窗口；材料放本工作树忽略目录 `doc/material/local/2026-11-11/brush-transform/` 唯一子目录。

A：固定一份4K非均匀像素图层、Soft Round、zoom/视口/flow/spacing/Smoothing，正常CDP→CanvasView输入比较30/100/300px，普通画笔与橡皮擦分别测试。固定主轨迹，各一次预热、三次正式重复；先采低开销profile，再对热点计数。分开coverage生成、累计覆盖、混合/写回、通知及渲染上传，记录分配与长任务；嵌套耗时不相加。主测不改spacing来降低输入工作量。

B：同一像素层Ctrl+T分别平移、缩放、旋转，持续拖动→停住1–2秒→Enter→undo/redo，另测Escape。记录图片/时序、当前变换版本和显示图块版本、是否继续收敛、最终像素是否正确；用现有CPU提交作正确性参考。发现最终结果或取消丢数据时，优先形成可复现正确性缺陷，不把它掩盖为性能问题。

阶段0交付：A的热点排序及重复读写数量；B的混帧/收敛/最终结果分类；拟改函数、现有可复用GPU能力和不支持条件。后续实施必须匹配实测热点。若批量合成不能消除主要成本，或稳定纹理需要超出下节范围，停在证据结论并交review，不自动扩大到线程/GPU笔刷或全变换重写。目前任务本身不授权执行阶段0。

Reviewer非阻断澄清（2026-11-11）：阶段0的B落点记录必须逐项说明现有atomicPreview、liftTile与commitTransform可以复用什么、缺少什么及最小调整位置。以下三项为新增交接约束，不把既有函数名视为现成能力；本次仅补充设计，仍未实施。

## 4. A：普通大画笔/橡皮擦的最小路线

首版仅优化brush/eraser、RGBA8普通像素层、Normal、固定颜色、单笔配置固定、无selection/mask/lockAlpha/对称/纹理/双笔尖的明确子集。保留真实压力样本；动态opacity等影响等价性的条件必须按下述规则处理。其它已有工具/位深/混合/目标走当前路径，不隐藏或禁用功能。

优先在一次输入处理批次内积累多个dab，保留逐dab覆盖计算和累计顺序，用紧凑脏块集合减少重复目标合成；复用有明确所有者的工作数组。不要先引入跨帧待提交像素队列。先验证coalesced或单次move产生多个dab时的收益；不足时如需跨帧合并，另交设计，不暗加延迟。

**逐印迹语义是硬约束：**当前PaintOp每次以该dab的opacity及累计覆盖重算其矩形；不同dab的矩形、opacity、flow和Float32舍入均可能不同。不能把最后一个dab.opacity应用到整个union，也不能用统一最大opacity代替逐像素最后写入语义。实现前用压力/opacity变化反例确定：保存必要的逐像素有效状态，或在不等价边界分段flush/回退。支持条件必须在进入新路径前明确，切换时完成既有状态交接。

目标是减少重复合成，不改变stroke的32位累计、笔刷覆盖形状、输入顺序、target量化时点的可见结果。用修复前独立参考回放比对，而不是新旧都调用同一新helper。若逐位相等无法成立，先报告差异原因和范围，不自行引入模糊“视觉等价”标准。

每批结束须先写回，再发dirty通知；up最后样本、取消、工具切换、document关闭及保存不能遗漏本批工作。一笔一次历史；不得把缓存/临时buffer写入native。Smudge/Mixer/Clone/Healing等读取实时目标的操作不进入新批路径。缓存有界，按stroke/批次复用及释放，不按输入数积累大数组。保留main原有tile bounds缓存的rev/COW合同。

若阶段0表明coverage本身而非混合写回占主导，允许仅做已证实的缓冲复用等局部优化并验证；不强行实施无收益的批处理架构。结果应说明未解决的成本。

## 5. B：稳定资源的自由变换预览

首版加速资格：单个RGBA8普通像素层、Normal/opacity1、无selection float、mask、效果、clipping、调整、隔离组或智能对象；平移/缩放/旋转（含翻转需单独验证）。文档可有简单Normal像素上下层，必须保持遮挡次序；无法证明组合支持则整次变换走原路径。Warp/透视/多层/文字/CMYK等保留原功能，不一并重写。

将本次变换的源像素资源与参数分离：源纹理/atlas及下层背景/上层组合在有效期间复用，拖动主要更新变换参数。优先复用现有GPU compositor及层级合成能力；不要在最顶层贴一张图而破坏上层遮挡，也不要创建第二套完整渲染器。超出纹理尺寸/容量的作品必须提前判定回退，不能为了单纹理强制缩小权威像素。

一个显示帧必须属于同一transform revision。若内部仍分块准备，在完整资源就绪前保留上一份一致预览，完成后统一切换；过期结果不得覆盖新参数。不能为避免碎块使用无预算的全量同步重采样，造成另一种卡死。

现有 `CanvasView.tsx:318–322` 的atomicPreview会调用 `eng.process(Infinity)`，不提供有预算的准备过程，不能仅打开这个开关满足本任务。B必须明确准备预算、完整画面切换条件和持续输入时的进度策略；可跳过过时预览参数，但不得不断取消准备、始终冻结旧帧直到用户停手。验收记录持续拖动期间的呈现revision推进和最长停滞时段，不能只检查停手后最终收敛。

预览源须包含目标层在画布外的内容，按源内容边界及坐标构建，而不是只截取当前画布/视口。现有 `renderEngine.ts:476` 的liftTile使用文档显示层级尺寸，不能直接视为通用完整源纹理。负坐标、超画布区域在缩放/旋转/平移后进入画布时必须可见；纹理/atlas预算应按所需完整源评估，容量不足提前回退，不静默裁切源来满足预算。

资源键至少包括文档/会话、目标层及源revision、变换会话、颜色显示设置、上下层依赖、GPU设备；参数变化本身不重新上传不变源。zoom引起采样层级变化需可复用/有界，首次准备与稳态性能分别记录。首版可不实现PhotoCraft全部mip策略，但缩小显示不能引入未经说明的严重锯齿或色差；不得改正式插值策略。

生命周期合同：

- 预览期间不改权威像素；沿用既有最终CPU精确变换和一次历史提交。
- Enter时保留最后有效预览，直到新权威结果可完整显示，再切换并释放资源；不产生短暂空白/旧源回跳。**提交失败恢复是本任务新增的交接要求**：当前commitTransform在CPU变换完成前已clearPreview、清mode和st（约341–343行），不存在可直接复用的完整恢复流程。需调整准备/权威写入/历史提交/清理顺序，保留原源和变换参数；失败不留下部分像素变更或多余历史，用户可重试或Escape取消。对可能部分写入的路径说明回滚方式，不能仅延后清st便声称原子性成立；范围超出有限交接时按阶段0规则交review。
- Escape恢复原像素与原历史状态；窗口/文档切换、工具退出、连续开始第二次变换均不能泄漏纹理或显示旧会话结果。
- GPU丢失/源变化/资格失效：废弃旧GPU资源并以当前参数进入原CPU路径，不能重复变换或静默重置参数。取消后迟到结果不得再显示。

截图可能还暴露原CPU路径的新旧图块混杂。阶段0若确认，该正确性问题需最小独立处理并覆盖回退路径；不能只让合资格GPU路径看起来正常，而把已经复现的回退显示错误留作“未支持”。所需代价超过有限预览一致性交接时应交review重新界定范围。

## 6. 验证与交付门槛

| 项目 | 必须提供的证据 |
| --- | --- |
| A像素/历史 | 30/300px，低flow/opacity、真实变化压力、重复重叠、自交、擦除至透明；旧参考与新路径同输入最终像素相同，每批边界可见状态正确，undo/redo/native重开相同；不支持条件明确回退 |
| A工作量 | 同样输入/印迹数下目标读写、混合和分配确实减少；不增加笔划结束大量补算，不以丢点或降低spacing通过 |
| B正确性 | 简单上下层遮挡、平移/缩放/旋转/翻转、负坐标及超画布图层缩入/旋入画布、停住收敛、Enter/Escape、undo/redo/保存重开；源内容不被画布裁掉，最终结果与原精确提交相同，不用GPU预览像素当最终oracle |
| B生命周期 | 持续快速拖动仍持续推进完整画面、退出后迟到、GPU失效/完整源容量回退、文档切换；每帧同revision、无旧图回跳，资源在结束后释放；注入CPU准备及提交交接故障，核对源像素/历史不受部分写入污染、参数可恢复、重试只提交一次、Escape可取消 |
| 兼容性 | 不支持的混合/蒙版/位深/工具抽取代表组合验证仍走原路径；既有Move和tile bounds回归不退化 |

按 [TESTING](../../engineering/TESTING.md) 执行新增定向测试、受影响brush/eraser/transform/history/native及既有Move/tile bounds回归，P-BUILD。测试具体文件由阶段0核对。无需全格式/全工具笛卡尔积，也不因可逆文档变更跑产品测试。

性能前后同机器、同HEAD标记及构建模式、同4K作品、同输入与笔刷设置。A重点300px并保留30px无退化对照，B分别记录准备/拖动/停住/提交；每条件至少一次预热和三次正式重复，交错顺序。RAF、主线程耗时、实际图像版本/连续性分别记录，RAF不等于物理呈现；额外做低频等量输入像素核验。原始证据保留在忽略目录，正式任务只收稳定摘要与复现入口。

通过要求：对应热点工作量减少且正常输入路径获得可重复改善；像素/历史/生命周期无退化；Ctrl+T不再混杂旧新变换画面。不设“必须和PhotoCraft一样快”的无测量门槛，不承诺16.8ms跨设备指标。未复现、设备缺失或剩余长帧必须说明；真实笔及Owner原作保留人工验收，不用合成鼠标宣称已通过。

## 7. 执行与授权边界

本次只提交给reviewer审查设计；planner修改任务后仍须Owner明确授权实施。建议未来按“阶段0归因/落点→A实现验证→B实现验证→整体回归review”执行，A/B可各形成独立本地提交，但当前不授权任何代码修改或Git提交。stage0结果与假设不符时先修订方案，不要求为了完成表格实施两条错误路线。

交审内容：阶段0证据、最终支持/回退表、源码落点与复用能力、A逐印迹等价性说明、B版本/资源交接规则、前后性能、测试及未测项。Reviewer重点审查语义兼容、有限范围是否可执行、回退正确性，以及是否存在未计入的大重构。

通用修复归WP main；后续main→embedded→ADA固定包另行授权。本轮不推送/合并/发布、不改ADA、不建立通用任务队列、不引入Rust/WASM或线程架构，不操作真实作品或付费服务。

Context Delta：新增两项残余性能/显示问题的设计及PhotoCraft固定源码对照；既有边界缓存保留。当前只有源码阅读和Owner反馈，无300px专项或Ctrl+T复现测量，无优化实现。


## 8. 阶段0执行记录（2026-11-11）

main实际HEAD为e168f36661a682a872c7dfc2f9c2f2f55a146207。保留最初AI_CONTEXT/DEV_LOG/DEV_SETUP、start-current.mjs与start-dev.bat dirty。忽略目录 `doc/material/local/2026-11-11/brush-transform/run-01/` 在修改产品源码前保存baseline-state.json、baseline.diff及完整tracked源码baseline-source.tar；不通过切分支/覆盖dirty取得前态。沿用前任务非均匀RGBA8 4096方形图层，将测试文档画布设为4096方形；隔离profile/temp，完整native/Vite窗口1450×1000、zoom.2、独立16062/16462，不动用户作品/进程。

### A：热点与落点

30/100/300px、brush/eraser，固定Soft Round、spacing.1、Smoothing0、相同长轨迹，正常CDP→CanvasView，各预热1次+正式3次交错采集，24份无hook样本无异常buttons输入。另各一份300px CPU profile：brush的applyDabs包含约574.5ms、其中PaintOp.dab含474.1ms，coverage约96.0ms；eraser约501.8/404.9/93.3ms。这些是采样归因，不是可相加的独立绝对计时。downsampleQuadrant另有约279–283ms自身采样成本，渲染与开发React开销仍有残余，不在A内扩大优化。

结论支持输入批次内减少目标读/混合/写及区域数组分配；不是coverage唯一热点，不改变spacing或跳过输入。拟新增有限BatchedPaintOp，与原PaintOp独立保留以作回退/等价参考。保留每dab的Float32覆盖累计；opacity改变时先flush原批，精确区分本批触及像素与union空隙，不能给空隙重套新opacity。CanvasView可把同一coalesced批交给PaintTool，仍逐点按原时间/压力生成dabs；不跨帧积压。仅brush/eraser的RGBA8 Normal普通像素/无selection、mask、lockAlpha等子集进入，其它原路。新增工作数组有固定容量及stroke生命周期，最终批先写回再通知。

### B：分类及三项补充的落点

完整窗口持续拖动→停住1.8秒→Enter→undo/redo已采集平移/缩放，各预热+3次；第一版所谓rotate实际命中corner、矩阵无旋转分量，保留为无效旋转分类，不计旋转证据。修正从右下角外侧旋转后另采预热+3次，正式矩阵有约±.238的非对角分量。观察visible display tiles的revision：拖动的约31–64帧中混杂多个revision，停住后pending=false并收敛；同一结果undo返回原逐tile SHA、redo返回提交后SHA，所有采集样本均成立。这支持预览代际一致性问题，未证实静止/正式提交后的最终数据损坏。Enter仍花约6–9秒CPU正式重采样，不将其称作预览稳态成本。

| 既有能力 | 可复用 | 缺少与拟定最小位置 |
| --- | --- | --- |
| atomicPreview | 既有Move浮动预览使用一次可见集合处理 | CanvasView会process(Infinity)，不采用此开关加速Ctrl+T。RenderEngine需有限的独立待呈现图块集合，预算处理完同revision可见集才替换；准备期间冻结该批参数，latest仅替换下一批，保证持续输入仍推进，不反复取消准备。 |
| liftTile/atlas | compositor纹理atlas按tile身份/rev复用；显示管线及上下层顺序可继续用 | liftTile按文档显示边界裁切且只支持平移，不能当完整源。拟在原compositor override里描述完整源和affine参数，完整负坐标/超画布源与预算先核对；不在最上层另贴图或另造renderer。容量、颜色/层组合及非affine不支持时整体原CPU read回退，并接入同一一致帧交接。 |
| commitTransform | 正式warpLayerRaster/命令及一笔一次history保持CPU权威 | 目前计算前clearPreview/清st，失败不能重试，float可能已部分写入。需在本工具内保留状态和COW恢复点，准备/提交成功后才清交互；失败恢复原像素/selection/历史并保留参数，不修改通用History架构。清预览后也须等新权威可见集完整才交换显示。 |

B还需覆盖源revision/颜色设置/GPU生命周期与当前viewport；不以单个函数名当作现成的全资源协议。若实际实现/验证发现上述有限落点仍不足，将明确停止相关扩展，保留独立A工作，不扩成GPU笔刷/宿主/历史框架。

### 基线有效性与验证边界

原始JSON、profile、脚本与图片在上述忽略目录。低频100ms 300px brush/eraser等量回放另采；其中brush前态预热和rep1混入实体鼠标buttons=0移动，排除并在修改前补采rep1，未将污染样本记为通过。普通无hook矩阵不受影响。正式量化前后结果在后续阶段回填；阶段0不称优化实现通过。PhotoCraft只复用任务给出的固定源码事实，未运行其产品或基准。


## 9. A实现与验证

新增BatchedPaintOp，仅接入brush/brush模式eraser、RGB RGBA8普通Normal像素层、Normal笔刷、round单笔尖、无selection/mask/vectorMask/lockAlpha/scatter/texture/airbrush，笔刷尺寸≤512、无size jitter/velocity扩张。其它条件保留原PaintOp/原工具。CanvasView仅对实现moveBatch的工具交付同一coalesced输入批；其它工具仍逐次转换坐标调用move。动态opacity不禁用：opacity改变即同步flush分段；保留每印迹Float32覆盖舍入，union触及mask避免错误重算空隙。每批同步完成写回后才通知，无跨帧补算。

工作缓冲按stroke持有、最多1M像素一段、最多128个矩形；结束/取消释放。大于支持尺寸的笔刷在进入时走原路，不在画到一半抛弃输入。RGBA8 eraser直接经writableTile/COW写alpha，使用旧U8_TO_FLOAT与Math.fround保留旧Float32→RGBA8量化；RGB不变，减少无关RGBA拷贝。每个新写入口仍先writableTile，不绕过tile.rev/version；边界缓存保留。

验证：batchedPaint含真实变化压力/flow/opacity、30/300px重叠与自交、矩形空隙、低flow/opacity、擦空、逐批旧PaintOp对照；真实工具资格/回退/取消、history undo/redo/native重开。10个重叠dab的普通画笔原图读/目标写由10次降到1次，eraser的原RGBA float读/写由10次降到0（由有界原生alpha写取代），无endBatch遗留工作。新增与core/tile bounds/native/Move/output共6文件 **97/97通过**，P-BUILD通过；已有Vite URL/模块外置警告未扩大修理。

性能为同完整native/Vite窗口正常CDP输入，不是生产dist或真实笔尖延迟。下表为三次正式RAF p95/ms，保持全部60个coalesced样本、spacing.1；低频另核对精确输出。

| 工具/尺寸 | 前态 | 最终A实现(afterA2) |
| --- | --- | --- |
| brush30 |16.9 / 33.3 / 16.8|16.9 / 16.8 / 16.8|
| brush100 |33.4 / 33.4 / 16.8|16.8 / 16.9 / 33.4|
| brush300 |66.7 / 66.7 / 50.0|33.5 / 33.6 / 33.4|
| eraser30 |16.8 / 16.8 / 16.8|16.8 / 16.8 / 16.8|
| eraser100 |33.3 / 16.8 / 33.3|16.9 / 16.9 / 16.9|
| eraser300 |33.5 / 50.1 / 33.5|33.4 / 33.3 / 16.9|

brush300的p95中位数下降约49.8%；eraser300的p95中位数仅约0.6%变化，不能称显著帧尾改善，仍有33ms帧。额外采样profile：eraser applyDabs包含由约501.8降到312.9ms，像素op包含约404.9→192.1ms；brush约574.5→514.8ms，像素op约474.1→416.0ms。profile每工具各一份，不代替三次无hook数据；downsample/开发UI成本仍在，不扩大为GPU笔刷。

低频300px brush/eraser各前3后3有效正式结果的256个tile SHA均一致。前态eraser一份up结算为0且末段像素异于同输入其它重复，按提前终止/来源未定异常排除；前态brush重试仍混入实体鼠标，也排除。用修改前保全的baseline-source.tar创建只读用途的独立源码副本，复用同一未改Electron host、runtime/夹具/隔离配置补采每工具一份，凑足各3份；没有覆盖main dirty或切分支。所有异常/首轮A实现afterA和最终afterA2原件均保留，最终结论仅使用有效样本。初版大数组结构比较测试耗时过长已中断，改用原始字节SHA；一次node环境缺document产生未处理错误后改用jsdom重跑，不将这些尝试记为通过。

A实现及以上证据提交后继续B；未声称Owner/真实手绘笔/ADA新包已验收。


## 10. B实现与阶段验证

在既有compositor override/atlas内加入affine源采样，不新增renderer。资格为单个RGB/RGBA8普通像素层、Normal/opacity与fillOpacity为1、无选区/蒙版/效果等，最多3个简单根像素层；上下层仍按原合成顺序。仅非退化正交affine平移/缩放/旋转/翻转，Warp/quad/shear、组、多层、其它色彩/位深或复杂显示组合保留CPU read。完整源按原raster内容边界准备，包含负坐标和画布外像素；完整源包围矩形最多256tile且源+两份可见集须满足既有atlas容量，超限整体回退，不裁源。预览采用premultiplied bilinear及既有mip；GPU/CPU预览允许小于2/255误差，正式CPU bicubic权威算法未改。纯旋转的浮点det在mip二次幂边界曾造成重复上传，已用仅预览的稳定层级舍入修复。

资源依赖由变换会话私有源clone、原层raster身份/version/rev、文档rev、GPU设备、显示设置/viewport层级及当前简单堆栈资格组成；参数仅更新inverse，不重传源。mip逐tile自底向上准备，单次Canvas处理预算6ms（不可中断的单tile单位可能超预算，并非硬实时）。RenderEngine另持有当前准备代际，冻结该批参数；持续输入只替换下一批latest，完成全部可见tile才交换整份Map，保持进度。viewport/颜色/源变化废弃准备，上一份完整画布保留至替换；CPU回退使用同一协议。CPU viewport缓存版本采用单调值，避免新Map版本重用上传旧纹理。单tile准备异常废弃私有Map后可重试，不能发布部分帧。既有Move atomicPreview不改用该协议。

Enter的CPU准备、写入及history成功前不清状态；工具内COW root/selection恢复点覆盖浮选区部分写入或命令首个swap后异常。history尚未插入则恢复像素/selection，保留当前参数，可重试/Escape；history插入后的通知异常按已提交处理，避免重试重复提交。成功后清override进入完整authority帧准备，保留最后完整预览至新权威可见集完成。退出/切文档/第二次变换释放源atlas键；设备/源/资格失效以当前参数回退CPU，不重置矩阵。up补结算最后指针点，避免重负载下最后坐标被丢弃。

阶段定向验证：新增transformPreview **19项**，连同Move output及tile bounds共 **51/51通过**；P-BUILD通过（既有Vite URL/模块外置警告保留）。含CPU预算/持续参数进度、上下层遮挡、负坐标和超画布源、四类affine、mip1/2、最终独立CPU warp逐字节比较、undo/redo/native、mask/blend/group/capacity回退、颜色/viewport/GPU/源变化、文档切换/二次变换资源释放，CPU准备/部分命令swap/部分float-write/通知故障及预览tile失败重试。

### 完整native开发窗口证据

正式文件为before-transform.json（只计move/scale）、before-transform-rotate.json及afterB2-transform.json。每种操作预热1次+交错正式3次，源/viewport/runtime/隔离偏好同配方，正常CDP输入60点；不是物理呈现延迟或生产dist。新实现三种正式结果RAF p95分别均为16.8–16.9ms；前态move为33.4/33.5/33.3，scale为33.5/33.4/33.4，真实rotate为33.5/33.5/50.1ms。前态每次拖动混合revision约31–59帧，新实现全部为0。正式拖动持续发布57–61份完整代际，最长发布间隔33.5–50.2ms，未以停手才收敛换取一致性；首次从begin至可见完整预览502.8–680.2ms（含调度/准备，不宣称纯GPU时间）。稳态源atlas上传增量全部0。

CPU Enter仍为6767–12402ms，保留为未优化长阻塞。重启后的afterB-handoff-valid补采三种Enter：最后完整预览保留到authority，Enter后引擎收敛137–257ms；可观察交接帧无混合revision、无缺失可见tile。单次CPU fallback慢速平移补采afterB-cpu-valid：340个拖动观察帧、21份呈现代际、混合0，停手pending=false；Enter约9831ms、收敛321ms，旧preview到authority完整切换。这是回退正确性探针，不充作三轮性能收益。

所有正式B结果undo/redo的层坐标及逐tile SHA恢复一致（byteSize可因mip缓存驻留不同，不作像素字段比较）。同矩阵前后结果逐tile精确相同：move有3组、scale/rotate各9组配对；前态少数move漏结算最后点而矩阵不同的样本不强行当等量像素比较。A另有低频等量前3后3核验；B低频完整窗口只采CPU fallback单次，B三轮低频独立对照未执行，不标记通过；自动四类affine精确提交参考覆盖保留。

原始早期afterB rep3出现1Hz/无代际推进，按窗口活跃性异常排除；重启隔离profile后用最终afterB2整组替代。曾尝试系统窗口截图恢复，FrameArrived超时且检测到用户输入，未继续操作用户窗口；后续仅关闭并重启自有隔离测试窗口。追加源码热更新后工具模块状态重置使afterB-handoff/afterB-cpu没有有效变换矩阵，均排除，afterB-handoff-valid及afterB-cpu-valid为重启后的有效补采。未把排除样本或错误旋转分类算通过。故障重试最后修正仅影响异常分支，之后51项/构建及有效交接探针已重验；正常三轮矩阵无需因文档变更重跑。

B阶段实现已完成，整体回归及最终自查继续；Owner原作、真实笔、物理显示、真实设备丢失/内存压力、生产dist性能仍未验收。没有执行PhotoCraft产品同机对照、全部模式/组合笛卡尔积或ADA集成验证。
