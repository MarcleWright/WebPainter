# 0 · 当前固定版画板打开基线

[父任务](2026-11-18_01_drawing-board-workflow-and-open-performance.md) · [执行台账](2026-11-18_01_execution-loop.md)

## 固定输入与审查

ADA 已集成 dev `18bf864f1516c532dab6a153b0d823af7f15acd1`，在独立工作树 detached 作基线。WP 使用 ADA 原清单，经 `prepare-wp-editor.mjs` 验证 clean 固定 embedded `5398194`、port 4／native 1、bundle `71874433…` 的所有包资源。安装使用该工作树 lockfile 缓存。依赖和生成的双清单核验于实际工作树下执行，清单内容相同后恢复原换行。

Reviewer 以实际基线、父任务及 harness 审查，结论 Approved with bounded follow-ups。Planner 接受 detached 核对、独立 PostgreSQL、同源 Web 夹具、当前 WP 包、真实入口与单独保存样本。既有脚本的 100 ms 轮询和 600 ms 固定等待不可用于新计时。用真实输入时间、浏览器网络事件、frame 标记和实际画笔分开观测。按已有授权，正式服务器和真实 Provider 留在本次范围外。

## 执行结果

本机隔离 PostgreSQL、真实 API 和同源 Vite Web，真实 Chrome 正常登录／创建项目／打开画板。浏览器快速检查通过 4096² 新建、返回、节点双击重开、真实画笔、再保存。后来重复组复用显式焦点的节点 Enter 正常入口。记录实际内容长度、正式 revision 和 hash。每组五次，正式内容先产生稳定预览，避免派生图工作污染主样本。

| 样本 | 正式载荷 | 冷打开到可编辑中位数 / 最大值 | 立即重开中位数 / 最大值 |
| --- | --- | --- | --- |
| 空白 1024² | 1,184 B | 447.7 / 696.1 ms | 389.4 / 503.9 ms |
| 双层 4096² | 134,247,834 B | 4,203.7 / 4,655.9 ms | 4,048.4 / 4,303.7 ms |

双层 4K 冷开中位数，元数据 TTFB 417.5 ms，点击到握手 457.2 ms，内容 TTFB 480.7 ms，内容请求总计 1,008.6 ms，内容结束到可编辑 2,572.9 ms。最后一段包含 renderer 收到并消费载荷后的资产处理、哈希校验、RPC、WP 解码与挂载，暂未分别量化。立即重开允许浏览器缓存，样本中 native HTTP 命中为 0。

Raw evidence 在 ADA 独立工作树 `.packaging/drawing-board`，留作后续同口径复跑。以上为开发 Vite 和环回服务结果。首帧、真实笔输入与正式服务吞吐分别记录，不能用这些数字代替正式 Web 的结果。

## 慢网络、正确性与限制

- 全矩阵 26 次观测，含 warmup 和两个五次冷开／五次立即重开组合。捕获的浏览器未处理异常为 0。Vite 服务日志另有 proxy ECONNRESET，没有归入浏览器观察。
- 双层 4K 用浏览器模拟设置 50 ms 延迟和 16 MiB/s 下载上限，打开到可编辑 13,433.2 ms，native 请求共 9,293.7 ms。实际脚本画笔改变历史，返回后提交为 revision 3、hash 改变，随后同 artifact 和 native ID 以新版本准确重开，环回可编辑耗时 4,479.9 ms。空白 1024² 也完成真实落笔、保存与改版重开。
- 画布状态和第二个 RAF 可标记可编辑条件及渲染机会，不能证明物理正确显示时刻。真实笔画已核对历史、dirty 和保存版本。首笔路径没有独立画面提交计时。
- 晚期 4K 采样共 118 次，浏览器进程工作集总峰值 1,668,005,888 B，可能重复计入共享页。API 峰值 464,334,848 B。采样范围不覆盖全矩阵，不含 GPU VRAM。
- 环回及模拟网络结果用于选择 C/D 的局部优化。正式 HTTPS、当前服务器机器、真实笔／IME 和生产 ASAR 仍待另验。

## 独立实现审查

Reviewer 独立核对 harness、真实入口和 26 个观测样本，复算四组统计，核对正式 revision/hash、每次唯一 content 请求和固定包清单。结论 Approved with bounded follow-ups。Planner 接受，完成本机基线。证据 SHA-256 matrix 255df8ad…db359、quick ec53d8c1…d31c、harness ea73baed…d6e2、summary 29ef72e8…4f04。限定结论见上节。
