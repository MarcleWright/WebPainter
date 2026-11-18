# D · 缩短已有画板的加载时间

[父任务](2026-11-18_01_drawing-board-workflow-and-open-performance.md) · [执行台账](2026-11-18_01_execution-loop.md)

## 目标和源码现状

让打开画板的首个正确显示帧和首笔可画时间缩短。旧 ADA GET drawing 通过 readDrawing 同步整读 native 并算 SHA-256，之后 GET content 再执行一次。第一次整读发生在浏览器请求载荷前。现有内容响应有 ETag，实际重开的缓存情况用基线数据判断。

## 实施合同

- 在 ArtifactStore 提供元数据读取，保留项目归属和未移除检查、ready drawing、canonical Primary MIME/role 及受管路径资格。文档和投影共用同一捕获的 artifact、Primary 和 drawing metadata。投影后复核项目、artifact revision 和 status。Primary、恢复、预览写入在同事务递增 artifact revision。检测到交错变化返回可重试冲突。
- 客户端保留完整 hash 校验和 binding/generation 保护。认证元数据使用 private, no-store，正式内容须匹配该次读取的 hash 和当前作用域。旧内容或旧回执导致打开停止并可重试。
- 新打开给出可见加载阶段。仅在使用已验证且匹配当前版本的缩略图时先显示预览，避开整读 native 的 fallback preview 路由。编辑就绪取决于 WP 画面和可处理输入的状态。恢复候选保持原用户选择合同。
- 正式 content、保存、恢复、生成和预览发布保持原完整性路径。C 待命与本阶段读取优化分开对照。如果剩余成本在传输或 WP 解码／首帧，下一轮用分段证据决定有界缓存、交接字节或解码改动。

## 验收与结果

旧方案首轮独立 Changes Requested，D-D1 权限、D-D2 混读、D-D3 缓存与预览边界已修订。独立第二轮设计 Approved，SHA 6B0B016E…E6430。

SQLite+PG 新元数据与旧 publication 组合 22/22。真实双连接交错覆盖 Primary、恢复和预览，核对移除、非归属、版本、存储资格。损坏文件的 metadata 可以先返回，正式内容必须完整校验并拒绝。Web/API 类型及构建已验证。

同机控制组为 ADA `56894feb`，两组都使用 WP `993c936b…a608`、同一真实 Chrome 与隔离 PostgreSQL、同一 134,247,834 B 双层 4096² native（hash 4fab6193…）。冷开和立即重开各组五次。

| 指标中位数 | A 冷开 → D 冷开 | A 立即重开 → D 立即重开 |
| --- | --- | --- |
| 元数据 TTFB | 439.2 → 47.3 ms | 415.9 → 63.9 ms |
| 点击到派发内容下载 | 621.0 → 260.0 ms | 568.6 → 268.7 ms |
| 达到可编辑状态 | 4,142.1 → 3,755.6 ms | 4,112.0 → 3,860.8 ms |
| 确认首笔可画 | 4,759.9 → 4,415.2 ms | 4,580.0 → 4,332.9 ms |
| 下载结束到可编辑 | 2,667.0 → 2,625.0 ms | 2,670.3 → 2,686.4 ms |

D 真实 1024² 与 4K 的冷开／立即重开／保存后重开均各有五次，验证实际落笔。静态样本用撤销恢复同一版本。同长度损坏载荷打开拒绝并清理编辑器。各组未观察到 native HTTP 缓存命中，下载后约 2.6 秒仍未拆清。阶段 0 的较旧 WP pin 作历史参考。RAF 是渲染机会，物理首帧与正式 HTTPS 待验。

## 独立实现复审

候选 tracked patch 03B8AF73…10E6，新 API 测试 02BC0C37…7277。独立 Approved，独立复算冷开与立即重开指标，核对原始矩阵 3b3dab3a…00d8、精确控制 6170b91e…013a、汇总 4498fef1…75c1。Planner 接受。原始材料在 `auto_design_Agent_drawing_open/.packaging/drawing-open-metadata`。独立提交 07c12b0b，画板分支合入点 e0c6c29c。

## 整合回归补充 · 短间隔重开

整合阶段在派生 preview 写入同期直接请求元数据，观测到真实 HTTP 409。另一独立 Chrome 探针的立即重开不稳定，原因尚未单独证实。Planner 接受先处理已证实的元数据瞬时冲突，避免正常一次并发写入要求用户重开。

只在 GET 元数据的最终一致性检查返回版本冲突时，服务端重新读取一次授权快照、重建投影并复核。非就绪和非归属维持原拒绝语义，持续变化两次后仍返回 409。内容仍用原 revision/hash/binding。重新读取只处理元数据，不打开 native 正文、不返回上一次的投影。保留其他 HTTP、保存和恢复合同。

实际 SQLite 与 PG 交错覆盖一次写入后得到新版本、连续两次交错得到 409，以及非归属、损坏正文和已移除的现有边界。完成后在最终固定包 Chrome 普通入口重测返回立即重开。初版测量的数据与此窄修分别记录。

窄修方案独立 Approved，SHA 81E401A7…BE2E6。最终实现仅 GET 元数据及定向测试两文件，独立 Approved。ADA `46659d1` 已确认。最终 API 类型与 SQLite/PG 31/31。真实 Chrome 使用正常界面创建 PNG 和方向校正 JPEG 画板，真实绘画保存后点返回并立即用 Enter 重开。两例均复用原 iframe、打开同 native ID 和 revision 2、读回精确像素与内容 hash，自然窗口打开 metadata 200。一次交错和连续两次冲突由两数据库定向用例单独证实。浏览器记录 `.packaging/drawing-board-stage-b/integrated-bcd-reopen.json`，SHA DFF78379…216A。键盘卡片重开后本次探针未自动把焦点送入 iframe，点击绘图区可以正常聚焦，留作窗口人工验证。
