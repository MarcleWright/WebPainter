# WP main 图块级内容边界缓存

日期：2026-11-10。状态：**两阶段实施及本地验证完成，待 ADA集成-REV 统一独立 review；真实手绘笔/物理呈现/Owner 原作品仍 Pending。不推送、不合入 embedded、不更新 ADA 固定包、不发布。**

## 1. 目标、证据与工作位置

消除小笔划使大活动图层反复全像素扫描的成本，同时保持精确内容边界、像素、历史及保存格式不变。首版仅增加图块局部边界缓存，保留每次查询对当前图块集合的矩形合并；不实现增量整层边界树、不节流 UI、不改 GPU 队列、不关闭自动保存。

工作目录为 `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter_main_native`，分支 main，设计时 HEAD `59f81b51fa2db6f6ea0e7d31094d8015549c6ec8`。根 AGENTS 中旧工作目录文字不替代 Owner 明确指定的本工作树。执行前重新核对分支、HEAD、dirty 和适用入口。

既存修改：`doc/ai/AI_CONTEXT.md`、`doc/ai/DEV_LOG.md`、`doc/engineering/DEV_SETUP.md`、`scripts/start-current.mjs`、未跟踪 `start-dev.bat`。保留，不混入本任务或回退。不得修改相邻 embedded/ADA 工作树、切换分支或替换固定包。

前置诊断位于另一工作树：[连续绘画排查任务及 Follow-up Test](../../../../WebPainter/doc/ai/tasks/2026-11-10_01_continuous-painting-performance-diagnosis.md)。原始材料位于同工作树 `doc/material/local/2026-11-10/painting-diagnosis/run-02/`。跨工作树链接为本机证据导航，不构成 main 代码依赖；该诊断文档目前未跟踪，外部执行者缺少材料时应明确记录，不冒称已取得。

独立 review 已认可补测范围：完整 native/CanvasView 输入和 ADA 同作品均复现大活动层边界扫描热点；main D 绘画 RAF p95 约133–150ms，临时固定精确边界后约16.8ms。低频等量输入的最终逐图块像素哈希一致。固定边界只是归因实验，不能成为实现，也不能承诺正式修复达到同一数字。

隐藏大层→删除保留undo→重开没有复现稳定改善；Owner 原始删除改善、真实手绘笔及屏幕呈现延迟仍未定论。本任务不宣称解决所有大图层或 ADA 性能问题。

## 2. 当前实现与设计输入

| 当前路径 | 行为与本任务含义 |
| --- | --- |
| `src/rendering/bounds.ts:11–18` | WeakMap 按 raster.version 缓存整层矩形；一次像素修改后需要重新调用 contentBounds。保留此层缓存。 |
| `src/image-engine/tiledRaster.ts:217–241` | 遍历全部已分配图块并扫描每块全部像素。优化发生在该精确查询内部。 |
| 同文件 `Tile.rev`、`writableTile:147–161` | 原地写入也增加 tile.rev 和 raster.version；COW 创建新 Tile。可用于识别局部失效。 |
| 同文件 `touch:164` | 目前只增加 raster.version；不能据此得知哪个图块被修改，需要显式保守失效策略。 |
| 同文件 snapshot/restore/clone/clear/compact | 替换或共享图块集合、恢复 fill、删除空块。合并必须只读取当前集合。 |
| 同文件 Tile.data/evict | 图块可分页到 scratch，读取可能抛错；缓存不能新增像素驻留或将读取失败当作空块。 |
| `src/app/ops/layerOps.ts`、`src/selection/selection.ts` | 反相会修改像素及 fill，再调用 touch；必须覆盖单通道 fill 语义。 |
| `src/document/native.ts` | 解码向新 raster 安装新 Tile。缓存是运行时派生数据，不序列化、不改 native 版本。 |

以上是设计时源码位置，实施者需重新核对。写入审计须覆盖整个 src，而不只上述候选文件：writableTile、getTile/tiles 暴露的 data、直接替换 Tile、touch、长时间持有可写数组的代码及颜色模式转换。区分创建尚未发布的新 raster 与修改已被查询的 raster。

## 3. 最小实现方案

### 3.1 缓存位置与数据

首选在每个 TiledRaster 内维护私有 `WeakMap<Tile, LocalBoundsEntry>`，不引入通用缓存服务。每个 Tile 在该 raster 下最多一个最新条目，字段包括 tile.rev、解释像素所需的 channels/depth/有效 fill 语义，以及图块坐标内的精确矩形或显式空结果。不得缓存 PixelArray、复制像素或强引用已移除的 Tile。

每 raster 一份 WeakMap 使 touch 的保守失效局限在该 raster，避免全局缓存被其它文档清空。clone 的缓存可以从空开始；本轮不为跨 raster 的共享缓存增加复杂度。WeakMap 的 GC 时机不作为确定性测试承诺。

### 3.2 查询流程

```text
contentBounds()
  遍历当前 tiles 的每个 (key, tile)
    匹配 tile 身份、rev 与像素解释语义
      命中：读取局部矩形（也可以为空）
      失效：用原精确算法扫描该 tile，成功后替换缓存条目
    用当前 key 的坐标平移局部矩形并合并
  返回新生成的整层精确矩形或 null
```

不把图块坐标存进可复用的局部边界；同一 Tile 移到不同 key 时仍按当前坐标合并。每次重建 union，因此删除边缘图块、擦除到空或边界向内收缩都能立即反映，不采用只扩张不收缩的近似。

保留原有规则：4 通道只检查 alpha 相对 0；1 通道相对 `fill * maxValue(depth)`；32 位阈值1e-6，其余位深0.5；只计算已分配图块中的差异样本，缺失图块不展开成无限区域。保留现有数值比较行为，不顺带修改 NaN/浮点或填充值语义。内部矩形不能作为可变引用直接暴露给调用者。

复杂度目标：冷查询仍扫描全部像素；预热后仅扫描变更/新增/语义失效图块的像素，加 O(当前图块数) 的缓存查找与矩形合并。不得把 raster.version 纳入每个局部条目的普通失效条件，否则每笔仍会失效全层。

### 3.3 写入与失效合同

| 操作 | 预期处理 |
| --- | --- |
| writableTile 后完成同步写入 | tile.rev 或身份变化使对应条目失效；下一次查询精确重算。 |
| touch() | 继续增加 raster.version，同时替换本 raster 的局部 WeakMap；作为未知范围变化的保守兜底。普通笔刷若每次额外调用 touch 会抵消收益，必须由写入审计和计数证明实际路径。 |
| fill 变化 | 局部条目检查有效 fill 语义；现行调用方仍需通过 touch/既有方法通知整层缓存。不得暗中改变外层 version 合同。 |
| snapshot / clone / restore | 保留现有 COW 语义；clone 可冷缓存；restore 可保守清空本 raster 局部缓存，历史往返优先正确，不要求首次恢复即热命中。 |
| clear / compact / 移除图块 | clear 清空缓存；compact 后只合并剩余集合，允许复用未变条目；移除条目不能被缓存强引用保活。 |
| 新 Tile / native 解码 | 新身份自然未命中；不得因 rev 同为0复用其它 Tile 的结果。 |
| 分页与读回 | 未变且有有效条目时不必为查询读取像素；失效/冷扫描读取失败则保留原错误传播，不发布失败结果，之后成功读回必须能重试。 |

写入审计发现真实调用方在已缓存后绕过 rev 修改时，只修正与本缓存正确性直接相关的最小调用点，优先使用既有 writableTile/COW 协议；记录文件及原因。不允许以每次全层失效掩盖常规笔划的失效合同，也不借机改造全部像素 API。

可写数组不得跨一次边界查询继续写入而不再标记变化；若实际代码存在这种模式，必须先用回归证明并修正其生命周期。同步函数完成写入前不查询边界是本方案需要核对的前提，不凭假设跳过审计。

## 4. 范围及交付顺序

Owner 已告知 planner Approved；本记录不替代该 reviewer 的原始评审，也不表示实现验收通过。Owner 将另行转发 coder 授权指令，授权后按两个阶段连续执行，阶段间无需再次确认，最终统一独立 review：

1. **阶段一：正确性与缓存实现，本地提交一次。** 补写入路径审计表、精确参考结果测试和局部扫描工作量回归，先证明测试能暴露全层扫描问题；实现局部缓存与必要失效处理，保留原算法作为测试 oracle 的独立参考。清理诊断用固定边界替代，不保留产品开关或双套路径。完成第5节定向自动回归后，提交本任务范围的代码、测试、任务及相关文档。提交不代表性能或实现 review 已通过。
2. **阶段二：性能验证与收口，本地提交一次。** 完成 P-BUILD、第6节 main 完整窗口前后对照与像素一致性核验；必要时修正本范围问题并重跑受影响检查。提交必要修正和最终证据摘要，原始性能材料继续忽略，不纳入 Git。无代码修正时提交最终任务记录即可，不制造空提交。最后将两个阶段的提交和整体差异交 ADA集成-REV 统一独立 review。

阶段一改代码前保全或采集可比较的修复前基线；不能提交后才发现没有前态而切换/覆盖当前 dirty 工作树。可复用 run-02 中环境与输入确实一致的原始数据，说明匹配情况；不匹配时应在实施前补采。

每次提交前检查暂存 diff 和 `git diff --cached --check`，只暂存本任务文件/相关块。已有启动脚本、DEV_SETUP/DEV_LOG 及 AI_CONTEXT 中无关修改必须留在工作区；禁止 `git add -A` 后整包提交。报告遗留 dirty，不要求通过收走无关改动实现工作区干净。

两阶段无需中途请示常规实现选择；若证据要求扩大到 GPU、历史架构或 ADA 改造，则停止扩展并报告原因和最小建议。真实设备缺失保留 Pending，不阻止已授权的自动与脚本验证。明确阻塞须如实记录，不写成通过。

主要改动预期为 `src/image-engine/tiledRaster.ts` 和新增聚焦测试；`src/rendering/bounds.ts` 原则上保持外部行为。其他调用点仅凭审计证据最小修改。禁止本任务直接改属性面板刷新策略、历史架构、GPU 调度、iframe、自动保存、native 格式或扩大为 Rust/WASM 移植。

后续同步路线仍是 main → integration/embedded → ADA 固定包；**本任务只交付 main 实现、验证及上述本地阶段提交。推送、合入 embedded、制作或替换 ADA 固定包、更新 ADA 与发布均不在本次 coder 授权范围**。P-BUILD 是本地验证，允许执行，不等同于发布或配套包升级。

## 5. 正确性与工作量验证

测试使用 Vitest，建议新增 `tests/engine/tileContentBounds.test.ts`，用不依赖新缓存的全扫描 oracle 对照。组合应小而有代表性，不机械构造所有维度的笛卡尔积。

- 精确性：空 raster、空图块、透明 RGB 非零但 alpha 为0、稀疏/稠密、多图块及负坐标；8/16/32 位与1/4通道，单通道非零 fill 和浮点阈值边缘。
- 局部变化：原地写同一 Tile、跨块写入、擦除边缘收缩、擦空、添加/替换/删除块、clear、compact。缓存空结果后再写入也必须重算。
- 生命周期：snapshot→写入→restore、clone 后分别修改、真实编辑命令 undo/redo、fill反相+touch；同一 Tile 出现在不同坐标时边界正确。
- 未知范围写入：明确验证 touch 使已缓存但 rev 未变的结果失效；这不替代实际写入路径/COW 审计。
- 分页：未变热缓存不触发 readSync；冷/失效读回成功得到精确边界；失败抛错且不缓存为 null，恢复 pager 后可重试。用隔离假 pager，结束恢复全局状态，不读写用户 scratch。
- 持久化：native 保存/重开恢复同一像素和边界；不新增缓存字段、不改变格式版本。测试覆盖一条真实擦除/undo/redo 后保存的组合路径。

确定性工作量门槛：256 个图块预热后，连续查询不再扫描像素；正常 writableTile 改1块后仅重扫1块，改K块后仅重扫这些块。重复查询保持命中。允许明确的 touch/restore/fill语义切换保守失效，不允许普通未触及图块随每个笔划重扫。用测试内可验证的扫描/数据读取计数，不靠耗时断言，也不新增产品遥测接口。

至少执行新增测试、现有 `core` / `regressions` / `moveSelection` / `native` 及受写入审计影响的 mask/selection/mode 测试；根据实际 Vitest 文件核对选择。执行 P-BUILD（内含类型检查），不为形式重复运行同一检查。若涉及范围意外扩大，说明原因再补相关检查，不以全套测试代替定向正确性证据。

## 6. main 性能复测与验收边界

沿用诊断 run-02 的共用夹具和正常 CDP→CanvasView 输入路径，修复前后同机器/运行时/构建模式/视口/笔刷。使用独立 profile/temp，不动用户作品。新原始数据放本工作树忽略的 `doc/material/local/2026-11-10/tile-bounds-cache/` 唯一运行目录，不能覆盖诊断材料或上游基准文档。

最小矩阵：A小层基线、D稠密4K活动层，短/长两条轨迹；预热分离，各三次正式重复并交错顺序。追加B/C各一条长轨迹、三次重复，检查可见/隐藏的大层背景没有新退化；无须重跑全部删除/重开性能矩阵，正确性路径由上节覆盖。

主测不安装固定边界替代；记录正常输入数量、合并样本、绘画时段RAF p50/p95/max、长任务、up结算及边界扫描工作量。无插桩与低开销计数分开。补低频等量输入，核对修复前后最终逐图块像素哈希与精确边界一致，避免用事件丢失换取快帧。分页和保存继续正常运行，计时不混入加载或排空。

通过条件：正确性/确定性工作量门槛全部成立；D 的重复全层扫描消失且帧尾有稳定改善，A/B/C无可重复退化。约16.8ms仅是既有归因实验参考，不设跨设备硬门槛。报告实际改进比例、重复间波动和剩余成本；若扫描已减少但仍有长帧，则明确残差，不自动继续GPU或宿主重构，不声称体验已通过。

本任务不要求为 main 验证重建 ADA 包。ADA收益由后续配套更新任务验证；真实手绘笔、物理呈现及Owner原始作品仍需单独人工确认。未经检查项目标 Pending/Inconclusive，不写成通过。

## 7. 交审材料与当前状态

实施交付应包含：实际基线/dirty、写入审计表、最终缓存/失效规则、自动检查结果、前后同配方性能和像素证据、未测限制、最小后续同步建议。任务完成与实现复审、Owner验收、发布分开。

Context Delta：Owner 已授权连续完成两阶段。main 已实现图块局部精确边界缓存，定向回归、构建及完整窗口前后性能/像素验证完成，详见第8/9节；既存启动相关 dirty 保持。交 ADA集成-REV 统一独立 review 后暂停，不自行推送或更新下游。planner Approved 不替代实现 review 或 Owner 验收。


## 8. 执行记录：阶段一

### 工作区及基线保全

实际 main HEAD 为 `59f81b51fa2db6f6ea0e7d31094d8015549c6ec8`，未切分支。保留最初 dirty：AI_CONTEXT/DEV_LOG/DEV_SETUP、start-current.mjs 和 start-dev.bat；本任务只提交自身相关块。原任务文档起初未跟踪，纳入本任务提交。

修改产品源码前，在忽略目录 `doc/material/local/2026-11-10/tile-bounds-cache/run-01/` 保存 HEAD、dirty diff、关键源码及夹具 SHA；复制 run-02 的 A/B/C/D 与原始参考数据而不覆盖它。新建隔离 profile/temp、独立 Vite 16052/CDP 16452，完整 Electron/CanvasView、1450×1000、zoom .35、同笔刷/同轨迹。正式修复前数据在产品源码修改前采集；早期和单测并行的试跑仅作 preliminary，不计入正式对照。

### 全 src 写入路径审计

以 `writableTile/getTile/tiles/data/touch/fill/new Tile` 全 src 检索交叉核对，排除同名的 DisplayTile、LUT、PSD block 及独立临时数组；原始检索输出仅存忽略材料区。

| owner/实际路径 | 写入与查询生命周期 | 失效/COW 结论 |
| --- | --- | --- |
| tiledRaster 的 writeFloat/writePixels/fromPixels | 每个受影响图块先 writableTile，同步完成行写入，期间不查询边界；fromPixels 新建后 compact | 身份或 rev 精确失效；普通区域写入不调用 touch |
| brush/paintOps 的 Paint/Clone/Pattern/Focus/Smudge/Mixer/Tone/ColorReplace/BackgroundErase/MaskAccumulate；paintTools | readFloat 返回独立输入，处理后 writeFloat；跨笔划保留 original 是 clone，只读；没有持有 Tile.data 供后续 dab 绕过写协议 | 正常笔划仅局部失效，不追加全层 touch；真实 PaintOp erase + History 回归覆盖 |
| moveTool.stampFloat | 每块 writableTile 后持有 data，同步 stamp 完成；没有跨边界查询继续写；其它 Move 区域操作用 writeFloat/writePixels | 保留既有 COW/rev，未改 GPU 路径 |
| selection/selection.invert；layerOps 的 mask 创建反相/invertMask | writableTile 后同步逐样本写；fill 翻转后 touch；t.data 可能指旧 COW tile，仅作读取 | fill 语义参与局部键，touch 清空当前 raster 局部缓存；保留原 fill/version 外层合同 |
| selection/ops 的 floodRegion/visited/expand | setPx/set 经 writableTile；getTile 仅检查 visited；out/result 未发布前构造，末尾 touch | 新实例冷缓存；无长持有数组跨查询写入 |
| color/convertDocument、modeConform、inkModes、app/ops/imageOps、plates 的 companion/Lab | 区域 readFloat → 独立数组处理 → writeFloat/新 raster；mode conform 的弱集合不直接修改 Tile；companion 新建或相同写入协议 | 当前 tile rev/身份覆盖颜色转换；不需要变更调用点 |
| commands/rasterCommands、history、clone | snapshot/restore 共享 Tile 引用，后续 writableTile COW；history 不直接写 data | restore 保守清本 raster 缓存；clone 新缓存；不修改历史架构 |
| native decode、其它导入、appearance/滤镜/plugin | native 仅向未发布的新 raster 安装新 Tile；其它结果经 fromPixels/writeFloat 或替换 raster | 新身份必冷；不序列化派生缓存，不改 native 版本 |
| history/scratch；rendering/viewport/GPU/native export | scratch 复制 bytes 后 evict，不改逻辑样本；其余 data/tiles 使用只读；display tiles 是另一个类型 | 热命中不新增像素驻留；冷失败仍抛错，成功前不发布条目 |

未发现需要额外修正的真实旁路写调用点，也未发现普通笔划额外 touch。可写 Tile/data 仍遵循既有合同：一次同步写完再查询；若跨查询继续写，必须重新 writableTile 或 touch；不为未证实调用方增加框架。

### 先行回归

新增独立 scalar 全扫描 oracle，未调用缓存或渲染 bounds。缓存实施前运行新增测试：6 通过、3 失败；256 块预热后的两次查询仍读取 512 个 Tile.data，clone 热查询仍读 2 块，已热分页块仍触发 readSync。这些是预期红测，证明工作量/分页用例能暴露原行为，不把红测算通过。


### 缓存实现及阶段一验证

`TiledRaster` 私有 `WeakMap<Tile, LocalBoundsEntry>` 仅保存最新 rev、channels/depth/有效 fillRaw 及局部 Rect/null。沿用原逐像素比较式，命中时不读 Tile.data；miss 扫描成功后才发布。每次遍历当前 map，按当前 key 平移并重建 union；不缓存图块坐标或整层扩张边界。fillRaw 用 Object.is 匹配，保留 NaN/Infinity 的原比较结果。touch/restore/clear 清本 raster 缓存，clone 从冷开始，compact 可复用剩余条目。未修改 rendering/bounds 的 version 合同、任何调用方、GPU、历史或 native 格式。

阶段一定向验证：新增9项测试全部通过；连同 core、regressions、moveSelection、moveSelectionReference、native、modes、inkModes、cmyk、features 共10文件 **132/132通过**。预热256块读256次，重复查询0次，原地改1块后只读1块，累计改4块后只读4块；空结果也命中。覆盖8/16/32、1/4通道、负坐标、稠密/稀疏、透明RGB、fill/阈值及NaN、收缩/删除/替换/移位、COW/历史、假pager失败重试与真实PaintOp擦除→undo/redo→native重开。未安装用户scratch，测试后恢复全局pager。

阶段一仅声明实现与定向自动证据；构建、正式修复后窗口数据及像素对照留至阶段二。阶段提交 hash 见 Git 日志和最终交付。


## 9. 执行记录：阶段二与统一交审

阶段一提交 `627e790`（缓存、写入审计和定向回归）。阶段二无须代码修正，只提交本节最终验证、上下文及索引相关块；最终 hash 见 Git 日志和交付报告。整体审查范围为 `59f81b5..HEAD`，不含工作区原有启动脚本/文档 dirty。

### 构建、配方与数据有效性

- P-BUILD 完成，含 typecheck、renderer 和 Electron 构建，退出0。既有 Vite URL 与浏览器模块外置警告保留，没有为警告改动范围外代码。阶段一后没有代码变更，无须重复跑同一132项测试。
- 窗口主测为完整 native 应用的 **Vite 开发 renderer**，与前态及 run-02 配方一致；不是生产 dist 帧率验收。Electron44.4.5 / Chromium152.0.7977.130，Windows，前后默认adapter查询均为 NVIDIA Ampere、窗口实际启用WebGPU合成（不作为逐提交GPU完成证明）；窗口1450×1000、DPR1、zoom .35。前后 environment JSON 完全相等，96份初态 canvas、图层/id/顺序/显隐/混合/偏移/逐tile SHA、活动层及视口状态全部一致。
- 相同 A/B/C/D native 夹具、RGB8/sRGB、10px Soft Round、smoothing0、默认自动保存5分钟与scratch/history设置；未关闭分页或自动保存。A为小活动层，B为可见大层背景+小活动层，C为隐藏大层背景+小活动层，D为256块稠密4K活动层。没有固定边界、UI节流或替代绘画路径。
- 主测每笔60条16ms定时CDP move，走原CanvasView/coalesced路径；短/长轨迹沿用run-02。A/D短长、B/C长各1次预热+3次正式重复，按rep交错场景顺序；前后共48份无hook样本（12预热、36正式），均通过输入、可见、历史+1及只修改活动层检查。计数另跑A/D短长；低频另跑D短长100ms、各预热+3次。**计数记录 Tile.data 读取次数代表实际重扫块数，visited只代表union遍历块数，二者分开。**
- 新采集共96份，95有效（24预热、71正式）。修复前 counted/A/long/rep2 混入12条buttons=0的实体鼠标move，虽history/活动层变化检查成立，仍从性能统计排除，因此该额外计数小层条件仅2份有效正式数据；不补齐/伪称3份。正式无hook最小矩阵、D计数及全部低频样本各3次均有效。最早与单测并行的24份试跑保留为preliminary，不计入正式结果。

### 完整窗口前后结果

下表均为三次正式重复，单位ms；RAF仅取完全落在pointerdown→pointerup绘画时段的间隔，p95采用排序后floor(n×.95)位置。无hook没有包装笔刷/边界/engine，仅观察输入、RAF与LongTask；不把RAF等同物理呈现延迟。

| 条件 | 修复前 RAF p95 | 修复后 RAF p95 |
| --- | --- | --- |
| A短 | 16.8 / 16.8 / 16.8 | 16.9 / 16.9 / 16.9 |
| A长 | 16.8 / 16.8 / 16.9 | 16.8 / 16.8 / 16.9 |
| B长 | 16.9 / 16.9 / 16.8 | 16.9 / 16.8 / 16.8 |
| C长 | 16.9 / 16.8 / 16.8 | 33.3 / 16.9 / 16.9 |
| D短 | 150.1 / 233.5 / 150.1 | 16.9 / 16.9 / 16.8 |
| D长 | 150.1 / 216.8 / 183.5 | 16.8 / 16.9 / 16.9 |

- D短/长 p95 中位数分别下降 **88.7% / 90.8%**（约8.9倍/10.9倍的帧间隔改善，不称平均FPS倍数）。D绘画RAF p50从66.7–83.4ms降到16.7ms；max由150.1–233.5ms降到33.3–33.5ms。绘画时段LongTask由每笔17–23次、合计1286–1605ms降到0次。
- D的无hook up事件结算，短由0.8/1.4/0.9变为0.7/0.9/0.8ms，长由1.5/1.4/1.1变为1.0/0.6/0.5ms；不能据此称所有宿主up开销解决。计时不包含作品加载、初态哈希与后续排空；排空轮询只用于确认队列稳定，不作为GPU完成/显示延迟。
- A/B未见重复退化；C首轮p95=33.3ms，随后两轮16.9ms，前后max均约33.4ms，没有形成重复退化模式。仍保留此波动，不能据三个样本证明所有小层场景零退化。
- 所有D主测前后累计合并样本均为60；DOM move数前态22–28，后态55–60，说明慢前态合并更集中，不能把DOM事件数当实际笔刷样本数。低频精确核验另见下节，未以丢事件换快帧。

### 边界工作量与像素证据

| D计数条件 | 修复前实际重扫图块（3次） | 修复后实际重扫图块（3次） | 修复后当前集合遍历量（3次） |
| --- | --- | --- | --- |
| 短 | 5632 / 5376 / 4864 | 51 / 42 / 49 | 13056 / 10752 / 12544 |
| 长 | 5376 / 5632 / 5376 | 78 / 76 / 78 | 14848 / 14592 / 14848 |

前态每次内容边界调用都读256块；后态短每次只读1块，长平均约1.3块。帧数增加导致查询次数从19–22上升到42–58，但整笔实际扫描量仍下降约98.6–99.2%。边界调用累计耗时（含union/计数包装）短从1356.8–1397.9ms降到16.0–24.4ms，长从1301.5–1351.4ms降到33.7–34.5ms。这验证普通绘画没有被每笔touch全失效抵消；O(当前图块数) union仍存在，未实现增量树。

低频100ms精确输入：D短/长各有修复前3次、后3次正式结果，累计合并样本均60；一份短前态为59条DOM move合并60样本，其余60条。每条轨迹六份最终256块SHA完全一致，精确边界均为(0,0,4096,4096)。低频RAF p95由短66.8–100.0/长100.1–100.2ms降到约16.8ms；总输入时长仍约6.5–6.6秒，受输入供给控制，不宣称总笔划速度提升同一比例。结合阶段一真实擦除/撤销重做/native往返测试，未发现像素、历史或保存格式回归。

### 本地材料、复跑及剩余边界

原始材料只在忽略目录 `doc/material/local/2026-11-10/tile-bounds-cache/run-01/`，未提交。主要文件：`baseline-state.json`、`baseline-tracked.diff`、`before/after-environment.json`、`before/after-nohook.json`、`before/after-counted.json`、`before/after-slow.json`、`summary-cache.json`、`pixel-comparison.json`、`verification-cache.json`、`initial-state-match.json` 和 SHA清单 `evidence-manifest-cache.json`。源码/夹具哈希、可重算指标、发送/应答时间、coalesced事件、RAF、LongTask、up、扫描和当前集合遍历数均保留；任务里的稳定结论不依赖材料绝对路径。

复跑：当前根目录 `node scripts/build-electron.mjs`，运行材料 `launch-main.mjs`；分别执行 `measure.mjs <label>`、`count.mjs <label>`、`count.mjs <label> slow`，用 `facts.mjs <label>` 留环境、`summarize-cache.py` 汇总并核对像素。不要覆写现有label/材料；使用新运行目录并更新端口/根目录。基线源保全发生在修改之前，不通过覆盖当前dirty或切换分支取前态。计数包装与任何诊断临时逻辑均不进入产品源码。

- **残余**：D仍有33ms帧，边界之外的排版/UI/渲染工作未分解；小层也偶发双帧间隔。没有证据要求GPU或宿主重构，未扩展。
- **Pending/未测**：真实手绘笔/倾斜、物理屏幕呈现延迟、Owner原始作品及原先删除改善现象、大内存压力/真实scratch故障、生产dist性能、其它位深/笔刷/混合效果性能矩阵；其它位深正确性由定向测试覆盖。未跑全套单测、PhotoCraft运行基准或ADA固定包收益。不得把本轮脚本验证写成Owner体验验收。
- 本轮只读全src审计后仅修改tiledRaster与新增测试，没有扩大GPU/历史/ADA。P-DOC的UTF-8/相对链接、材料忽略及cached diff检查在提交前执行。既存启动相关dirty保留；两次隔离实例经实际preload退出，launcher均退出0，16052/16452无监听；用户实例未关闭。
- 交 ADA集成-REV 对两个阶段及整体差异统一独立review。后续如获授权才按 main→embedded→ADA固定包推进；本轮不推送、不合并、不替换包、不发布。交审后暂停。
