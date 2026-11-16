# WebPainter 架构入口

状态：2026-11-12，按 main 当前源码核对。WP 本体工作树为 `WebPainter_main_native`；`WebPainter` 为 integration/embedded 工作树。下述为已实现的职责与支持边界，测试及体验验收另见任务记录。

原作者的 [ARCHITECTURE](../../docs/ARCHITECTURE.md)、[API](../../docs/API.md)、[PSD_COMPATIBILITY](../../docs/PSD_COMPATIBILITY.md) 保留。本页维护 fork 已有改造，不复制全部上游模块。

## 模块与责任

| Owner | 当前职责与边界 |
| --- | --- |
| `src/tools/moveTool.ts` | 支持场景使用私有挖空底图与浮动选区，GPU 图层内合成；松手正式写回，一次拖动一次历史；未支持组合回退 |
| `src/tools/transformTool.ts` | Ctrl+T 会话、完整源预览、资格与安全检查、确认/取消、结果身份核对及一次历史安装 |
| `src/tools/transformTask.ts`、`transformWorker.ts` | 单次变换专用 Worker、私有源复制、ACK/结果验证、进度、终止取消与指标；不建立全工具任务池 |
| `src/tools/transformResample.ts` | RGB/RGBA8 合格后台确认的精确 bicubic 快路径；完整邻域合并边界检查和地址复用；不替换通用采样/resize |
| `src/image-engine/transformPlan.ts` | 预览/确认的几何与容量安全检查；正式分区保持输出原点的1024区域；操作预算768MiB，非法/超限不能绕过检查转同步CPU |
| `src/image-engine/tiledRaster.ts`、`src/rendering/bounds.ts` | 稀疏图块、COW、mip及图块内容边界缓存；缓存包含图块revision/格式/默认值语义，不能只认对象身份 |
| `src/rendering/renderEngine.ts`、`compositor.ts`、`src/gpu` | live override、稳定源atlas、浮动选区及仿射/合法透视预览、完整显示代际准备与交接；资格/容量不满足时有界回退 |
| `src/app/session.ts`、`editor.ts`、`src/history` | 文档身份、编辑保护owner token、受控历史提交和会话切换；取消与迟到结果不能改写其他操作 |
| `src/app/fileOps.ts`、`autosave.ts` | 输出/关闭目标保护与后台确认等待；预览不是可持久化权威结果，失败不标记虚假保存成功 |
| `src/formats`、`src/psd` | 通用native工程与独立PSD读写；缓存、预览纹理及Worker中间数据不成为持久业务真源 |
| `electron`、`src/app/platform` | 桌面桥和浏览器回退；Worker须分别验证开发入口与生产构建窗口 |

## 三条计算路径

```text
Move选区：稳定底图/片段 → 位移参数 → 图层内GPU预览 → 松手写回/一次历史
Ctrl+T：完整源纹理 → affine/projective参数 → 完整代际显示 → Enter
Enter：共同安全预检 → 合格单Worker/合法标准CPU回退
  Worker：私有源 → 原1024逻辑采样 → 量化图块/ACK → 私有结果
  提交：校验session/source/operation → 受保护的一次历史 → 完整权威画面交接
```

Ctrl+T GPU预览目前限简单单根RGB8像素层及有限简单上下层组合；复杂混合、蒙版、组、mesh warp等不因GPU可用而自动获得优化。后台确认有独立资格，不以预览资格代替正式确认资格。具体限制见[预览与生命周期](INTERACTIVE_PREVIEW.md)。

## 已实现与剩余成本

图块内容边界缓存、有限普通画笔/橡皮同步批处理、稳定仿射/透视预览、后台正式确认及专用采样内核均已实现。采样快路径保持原1024分区、mip、浮点累加/量化语义，旧版独立oracle仅在测试使用。当前没有多Worker、Rust/WASM替换或GPU权威像素提交。

[确认吞吐任务](../ai/tasks/2026-11-12_01_transform-confirm-throughput.md)记录同环境4K透明/不透明三类确认总时长中位数约降低40–45%，仍约4–5秒；Owner已观察明显提速。权威交接bounds/mip/显示仍有百毫秒长尾，大画笔帧尾目标也未全部满足；这些不是已经解决的能力。完整实现独立review、其他设备/Owner原作品与分发验收仍独立记录。

## 仓库与集成边界

通用改进先进入main，再由integration/embedded持续合入；ADA持有专用adapter并消费固定WP包，业务Artifact/节点/Provider不进入WP内核。此次main维护不代表embedded/ADA包已更新。ADA专用集成合同保留在embedded/ADA对应文档，本main工作树不复制业务合同。PhotoCraft固定源码与借鉴边界见[对照](PHOTOCRAFT_REFERENCE.md)。
