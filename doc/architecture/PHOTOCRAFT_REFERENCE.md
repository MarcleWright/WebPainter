# PhotoCraft 源码对照与借鉴范围

研究日期: 2026-11-05。结论来自固定源码阅读, 未编译或运行本轮 Rust 基准, 未做两项目同条件人工拖动测试。

## 对照版本

- WebPainter/Celenne: `a659900384aee878f01e4caae183a666acc7959b`, 当前 fork 无业务源码改造。
- PhotoCraft: tag **v0.20.2**, commit **7c12f647150f8e7b2e07718f7993b1fcaa57fefe**。选择用户先前试用的版本, 不把持续变化的 main 当成同一个版本。
- 本地研究原件由 [material](../material/README.md) 保存; 下方固定链接可独立复查。

## 结论

PhotoCraft 值得借鉴, 尤其是暂态编辑与正式文档分工、图块级缓存、预览资源复用以及回归场景。但不能把它概括成“所有拖动都只改变 GPU 坐标”, 也不能归因于“Rust 天然让任何同样算法流畅”。普通 Move 选区与 Ctrl+T 分别讨论。

本项目已按用户决定采用“浮动选区状态 + 稳定资源 WebGPU 图层内实时合成”作为原型主线, 见 [ADR-0002](../ai/decisions/ADR-0002_floating-selection-webgpu-prototype.md)。这是借鉴普通 Move 的暂态结构与纹理预览的思想后进行 Web 适配, 不是声称 PhotoCraft 普通 Move 已完全使用同一 GPU 算法。原型范围与验收见 [任务 02](../ai/tasks/2026-11-05_02_4k-selection-preview-prototype.md)。

## 路径一: Move 工具移动选区

[S1] 的 `CutParts` 保存挖空底图、选中片段和边界; `Floating` 保存 layer、offset、revision。选区初次提取可共享完全选中的源图块, 部分覆盖再处理像素。

`select.float` 后续更新偏移, 正式文档保持原状。但 canvas 的 [S2] `floating_doc` 发现新偏移时仍调用 `displayed`, 由 `CutParts::moved/place` 生成显示文档, 在原图层内将移位片段合成到底图上。它仍有随片段面积增加的 CPU 工作, 不是零像素处理。

[S3] `Surface::translated` 的优化包括:

- 整图块位移可以共享 Arc 图块。
- 非对齐位移按行批量复制编码后的样本, 避免不必要的 float 往返。
- 重复来源和均匀内容可共享/复用, 工作限制在片段相关图块。
- 该函数在 native 使用 Rayon 并行, **wasm32 分支使用串行迭代**。不能把原生并行收益直接当成 Web 版收益。

[S2] 预览键包含文档身份、revision 和显示过的偏移, 可按新旧区域更新显示。Celenne 当前也有旧/新选区区域的脏区通知, 因此“只更新脏区”本身不是缺失功能; 主要差别需结合缓存重建和内容写入看。

正式 `select.drop` 才在 [S1] 通过一次编辑写回。松手不一定立即 drop: 可等到 Enter、取消选区或其他命令。这个历史分组方式不等同 Celenne 每次拖动一条撤销, 不直接移植。

## 路径二: Ctrl+T 自由变换

[S4] 创建 `PreviewTextures`, [S5] 根据变换的四角/网格绘制缓存纹理, [S6] 根据缩放选择纹理级别。这比每次输入都重采样原始图层更接近本项目建议的实时预览方向。

它也处理上方图层、样式、linked mask 等内容; [S7] 的 Above 缓存用于保持遮挡关系。不能据此断言所有混合与调整组合均已像素等价, 本轮没有验收这些组合。

[S8] 对大 warp 的 pending 后台提交保留预览会话直到结果完成, 拒绝时保留可修改状态。这是交接设计的参考, 不是普通 Move 工具所有移动都异步。

## 与本项目方向逐项对照

| 方向 | Celenne 当前状况 | PhotoCraft 已核对方式 | 对 WebPainter 的建议 |
| --- | --- | --- | --- |
| 交互暂态 | 有 float 数据, 但移动中写 live raster | Move 的 Floating 与显示文档分开 | 借鉴身份与生命周期, 保留本项目历史习惯 |
| 内容边界 | 整体边界按 raster.version, 失效后扫描 | [S9] 按 COW 图块身份缓存局部边界 | 高优先级参考, TS 需增加 rev/格式/默认值失效条件 |
| 位移计算 | stampFloat 逐像素处理每个位置 | [S3] 图块共享、行复制、原生并行 | 主线用稳定资源 GPU 位移合成; 行复制辅助准备/提交, 不直接翻译为大量 Worker |
| 变换预览 | override.read 主要在 CPU 采样 | [S4-S7] 缓存纹理与网格显示 | 值得作 GPU 预览参考, 不能只在全画面顶部覆盖 |
| 增量显示 | 已有显示 tiles、脏区和分帧处理 | [S2] 文档/预览键及区域变化 | 保留已有机制, 重点处理失效与显示代次一致性 |
| 压力保护 | 已有缓存与后端设置 | 整层 Move 在超预算时可仅显示轮廓 [S2] | 可借鉴显式降级思路, 阈值和常见4K验收另定 |
| 行为验证 | 小尺寸基础连续移动/undo 测试 | [S10] float/copy/mask/undo 等测试与忽略基准 | 借鉴测试场景, 用相同真实样例补齐性能验证 |

## 借鉴的边界

- 不承诺 Celenne 的性能可以通过照抄获得。native、浏览器、WASM、GPU 后端和内存模型不同。
- 两者的柔边选区提取规则也有区别: Celenne 当前将 alpha 乘 coverage, [S1] 同格式路径使用 alpha 与 coverage 的最小值。不可在性能任务中顺手改变像素规则; 是否对齐 PS 另设需求和像素测试。
- [S10] 自带忽略基准使用 6000 x 4000 的均匀图层和 500 x 400 片段。均匀内容有特殊共享收益, 不能与本项目非均匀4K大选区的测量直接比数字。
- 可参考算法、缓存合同与测试; 实际移植代码时保留原许可及版权。许可证存在不等于所有第三方资源都可随意复制。
- 优先通过现有 TypeScript/WebGPU 结构验证, 不在本轮引入 Rust/WASM 或改造整套引擎。

## 固定源码索引

链接中的行号是 GitHub 原文件行号。远程 API 验证 tag 对应的 commit, 源码原件记录在本地 manifest。

- [S1: 浮动选区与 drop](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/cmd/float_cmds.rs#L27-L143)
- [S2: Move 预览及 damage](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/canvas/move_ui.rs#L278-L345)
- [S3: 栅格平移 native/WASM 分支](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/raster/src/lib.rs#L1115-L1278)
- [S4: 变换开始与纹理准备](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/transform_tool/begin.rs#L51-L89)
- [S5: 变换纹理与网格绘制](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/transform_tool/draw.rs#L94-L154)
- [S6: 预览纹理级别](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/transform_tex.rs#L1-L75)
- [S7: 上方图层缓存](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/transform_tool/preview.rs#L66-L110)
- [S8: 变换提交与 pending](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/ui-egui/src/tools/transform_tool/commit.rs#L82-L100)
- [S9: 按块缓存内容边界](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/compose/src/bounds.rs#L1-L79)
- [S10: 浮动选区测试及基准](https://github.com/storytold/photocraft/blob/7c12f647150f8e7b2e07718f7993b1fcaa57fefe/crates/engine/src/cmd/float_cmds/tests.rs#L24-L177)

## 仍待确认

未执行 PhotoCraft native/Web 同条件基准; 未验收其复杂预览正确性; 未证明所有热点已覆盖; WebPainter 的有限脚本前后结果见任务 02, 不等于 PhotoCraft 同条件比较。产品收益和建议顺序见 [性能方向](../product/PERFORMANCE_DIRECTION.md), 基线与成本见 [评估](../engineering/4K_SELECTION_ASSESSMENT.md)。
