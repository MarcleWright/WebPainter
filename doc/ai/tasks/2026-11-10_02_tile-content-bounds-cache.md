# WP main 图块级内容边界缓存

日期：2026-11-10。状态：**Owner 已授权两阶段连续实施及本地提交；执行中。性能验证与独立 review 状态分别记录，不授权推送或下游更新。**

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

本轮 Context Delta：main 新增本设计任务，Owner 告知 planner Approved 后补充两阶段连续实施/本地提交与最终统一 review 安排；尚未实现或运行上述代码测试。本轮只调整文档，既存启动相关工作保持。交付前按 [验证约定](../../engineering/TESTING.md) 做 P-DOC；coder 收到 Owner 授权指令后实施，完成后提交 review 并暂停，不自行推送或更新下游。


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
