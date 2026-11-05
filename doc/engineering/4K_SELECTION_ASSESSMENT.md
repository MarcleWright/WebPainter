# 4K 选区拖动评估

状态: 2026-11-05 已完成源码分析和隔离测量; 未实施性能优化, 未做优化后验收。原临时评估已提升为本项目可共享的结论, 原始数据由 [material](../material/README.md) 本地保留。

## 判断

目前证据支持中等规模的交互预览与合成接口扩展, 没有要求预先重写文档、分块存储、历史或 PSD 引擎。仅调整块大小、渲染预算或 UI 刷新不足以根治。原型主线现已确定为“浮动选区状态 + 稳定资源 WebGPU 图层内实时合成”, 见 [架构主线](../architecture/INTERACTIVE_PREVIEW.md) 和 [任务 02](../ai/tasks/2026-11-05_02_4k-selection-preview-prototype.md); 仍没有实现或优化后证据。

## 环境与方法

- 原始执行目录: `D:/00_Projects_WSY/AI/Codex_Projects/temp/celenne-studio`; 当前 fork `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter` 源码同为 `a659900384aee878f01e4caae183a666acc7959b`。
- Windows, Xeon W-2125, NVIDIA RTX A5000; Electron 44.4.5, Chromium 152; 隔离运行报告 WebGPU GPU compositing, CPU 对照除外。
- 独立临时 profile、离屏窗口、Vite 开发模式。3840 x 2160 非均匀合成 RGB 图像, 矩形全覆盖选区。调用真实 MoveTool、DocumentSession 及 UI 渲染循环, 不操作用户文档。
- 交互样本每组 40 次移动, 单次处理统计去掉前 4 次; 模型层另有 32 次连续调用, 去掉前 4 次。时间单位 ms。
- 运行时包装方法只计时和计数; 一项控制在测试脚本中调用已有 begin/endInteraction, 未修改或替换源算法。
- 离屏/开发/脚本输入不是生产窗口人工测试; 不将函数耗时换算为最终 FPS。

## 基线结果

`baseline.json`, GPU 开启, 25% 缩放:

| 操作 | 移动平均 | 移动 P95 | 按下提取/准备 |
| --- | ---: | ---: | ---: |
| 512 x 512 选区 | 4.37 | 6.5 | 53.6 |
| 1536 x 1024 选区 | 24.35 | 31.4 | 114.8 |
| 3072 x 1728 选区 | 86.58 | 111.1 | 346.3 |
| 整个图层 | 0.03 | 0.1 | 1.9 |

同一 1536 x 1024 选区在 100% 缩放下平均 26.28ms。缩小显示没有消除原始像素重写。此整层对照是简单图层, 不代表所有复杂层拖动都如此。

不含 UI 的模型测量中, 中/大选区平均 21.48/66.03ms。每次移动分别触达 35/104 个 256 x 256 图块, 对应约 8.75/26MiB 的图块数据; restore 本身约 0.13/0.17ms。触达字节量不是测得的总内存带宽或进程峰值。

## 控制与 CPU 采样

- `profile-run.json`: GPU 预热后, 中选区普通处理平均 25.13ms; 临时延后 UI 通知时 25.05ms。仅抑制侧栏更新未消除主路径开销。
- 同轮每帧输入四个不同位置, 四次处理合计平均 100.46ms。输入采样全部执行会放大成本; 没有模拟硬件驱动的实际事件频率。
- `controls.json`: 正确激活像素图层后, 蒙版 + Multiply + 上方 Curves 的中选区移动平均 25.17ms, 16 位约 35.29ms。这是成本观察, 不是效果正确性验收。
- CPU profile 总采样时段约 15.3s, 包含文档建立、三组拖动和等待。主要 self time: stampFloat 4818ms, contentBounds 3817ms, downsampleQuadrant 2248ms, writableTile 1249ms。不是只截取拖动区间的占比。
- contentBounds 调用来自 GPU 合成的 mayAffect、缩略图和属性面板。当前数据支持把像素改写与失效链作为重点, 不支持把主要原因归为 React 或显卡未开启。

## 必须排除的记录

- `baseline.json` 中 `selection with mask multiply and Curves` 未显式激活底层像素层, 实际移动了调整层; 不用于选区结论。后续 controls 已修正。
- `controls.json` 第一项初始取得的 GPU context 为空, 存在初始化时序; 不用于 GPU 计数对照。最终 profile-run 已等待初始化。
- 原作者 `docs/BENCHMARK_RESULTS.md` 是其他硬件和工作负载, 不与本轮数字混用。

## 源码证据链

| 入口 | 当前行为 | 对本问题的影响 |
| --- | --- | --- |
| [moveTool.ts](../../src/tools/moveTool.ts), 264-299 | 读取 float/native pixels、coverage、alpha, 建立 cutState | 大选区有首次提取成本 |
| 同文件 353-365, stampFloat 87-122 | 每个新位置 restore 后逐像素写入, 通知旧/新区域 | 工作量随选区像素数增加 |
| [tiledRaster.ts](../../src/image-engine/tiledRaster.ts), 147-178 | restore 改写代次, writableTile 按需写时复制 | 每个位置仍可能分配并复制受影响图块 |
| 同文件 217-245; [bounds.ts](../../src/rendering/bounds.ts), 13-18 | 全部图块内容扫描; 整体缓存按 raster.version | 局部变化可触发整层边界扫描 |
| tiledRaster.ts 383-418; [GPU compositor](../../src/gpu/compositor.ts), 79-97/656-668 | 缩略层按子块身份/rev, 图集按身份/rev 复用 | 新像素引起缩略级别与上传更新 |
| [CanvasView.tsx](../../src/ui/CanvasView.tsx), 623 | 合并事件逐个执行 tool.move | 单帧可能重复昂贵处理 |
| moveTool.ts 170/203; [editor.ts](../../src/app/editor.ts), 144 | float 分支先返回, 没有普通层交互的 UI 延后 | 辅助开销增加, 但不是唯一原因 |
| [renderEngine.ts](../../src/rendering/renderEngine.ts), 556; [viewportRenderer.ts](../../src/rendering/viewportRenderer.ts), 46 | 分帧处理, stale tile 仍可绘制 | 追不上时可能混合多个位置阶段; 截图本身不能定量确认 |

## 成本判断

以下为基于当前结构的工程估算, 不是报价、排期或收益承诺; 范围有重叠, 不简单相加。

| 范围 | 估算 | 边界 |
| --- | --- | --- |
| 输入合并与 UI 减负 | 1-2 人日 | 单独实施不足以根治 |
| 常见 RGB 8/16 位浮动预览、GPU/CPU 路径和基本历史/取消验证 | 整体 5-10 人日 | 需要补接口, 不是调参数 |
| 复杂蒙版、剪贴、组、效果、多后端及交接验证 | 整体 2-4 人周 | 取决于验收矩阵, 不含全 PS 等价 |
| 先做受限原型验证可行性 | 建议限 2-3 人日 | 任务 02 已规划, 执行未授权、未开展; 不等于正式可用版本 |

如果原型消除逐输入像素改写后仍卡在合成, 再扩大合成器改造评估。没有证据需要现在先换 Rust 或整套渲染框架。

## 证据限制

尚未测量不规则/羽化选区、大量层、复杂组/剪贴/样式、完整色彩模式、设备丢失或保存并发。尚无 PhotoCraft 同条件运行基准, 本轮新增的是 [固定源码对照](../architecture/PHOTOCRAFT_REFERENCE.md)。对全部路径和算法的结论需后续取样验证。

原始脚本保留的是最后控制轮配置, 并非完整可一键复现的基准套件。正式实施前应将场景、生成数据、计时边界和输出固定, 见 [验证约定](TESTING.md)。
