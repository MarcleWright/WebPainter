# ADA 画板长任务执行台账

## 当前状态

- 父任务见[画板创建、WP 待命与打开提速](2026-11-18_01_drawing-board-workflow-and-open-performance.md)。
- 2026-11-18 Owner 授权按 marcle-goal-excution 实施和独立复审，另确认允许必要的本地提交。生产、外部付费调用、推送和部署仍留在本次范围之外。
- 阶段 0 真实 Web 基线与独立核查完成。阶段 A 通过独立审查与正式入口的隔离 Chrome 验证，已提交画板分支。A–D 已在画板分支 a4eaaa2 完成集成、独立代码审查与自动化。E 的独立 WP 复测已采集，最终画板分支真实 Web 复测与对照核对已经完成。最终代码 46659d1，ADA 归档 4f94ead5。
- ADA 独立工作树 `auto_design_Agent_drawing_board` 在 `18bf864f` 完成 detached 基线。随后保存 `f71d80e5` 到 `codex/archive-drawing-plan-f71d80e5`，用原 SHA 检查对齐 `codex/isolate-drawing-interface-20261104` 至 `18bf864f` 并在独立树检出。原 dev 保持原引用与启动器改动。C 独立 `auto_design_Agent_drawing_standby`／`codex/drawing-board-standby`，D 独立 `auto_design_Agent_drawing_open`／`codex/drawing-board-open-metadata`，均以 A 完成点 `56894feb` 为基线，先验证再合回画板分支。
- WP `main @ b7bcedf` 的选层文档和现有任务文档改动保留。embedded `5398194` 的固定包 `71874433…` 供基线使用。ADA dev 启动器及 Hybrid Session 恢复改动留在原工作树。
- 2026-11-18 Owner 追加授权[缩略图 F1/F2](2026-11-18_01F_drawing-board-thumbnail-refresh.md)。F1 本地提交 `08a709c1`，已回到原 `auto_design_Agent_drawing_board`。F2 排除通用 mip，采用通过独立审查的受限单图层直出。WP main `596d132`、embedded `50b0846`、ADA 本地消费固定包 `8f03c328…`，实际 Chrome 返回及 Chrome/Electron Worker 对照通过。F1、F2 完成本地验证，生产未验。WP main 原有两项选层文档改动保留。

## 阶段索引

| 阶段 | 当前环节 | 独立设计审查和 Planner 裁定 | 实现审查与验证 |
| --- | --- | --- | --- |
| [0](2026-11-18_01-0_drawing-board-open-baseline.md) | 完成 | Reviewer 审查父任务的阶段 0 和实际 `18bf864f`、固定包 `5398194`，结论 Approved with bounded follow-ups。Planner 接受，先用 detached 工作树测量，附着原分支前另做有条件更新。 | 现有 harness 的 100 ms 轮询与固定 600 ms 等待排除出计时。记录普通入口、网络、可编辑状态、实际落笔及独立样本。证据审查 Approved with bounded follow-ups，Planner 接受。正式 Web 和首帧物理呈现待验。 |
| [A](2026-11-18_01A_drawing-board-new-document.md) | 完成 | 三轮设计审查，A-D1–D5 及 A-D1a 已关闭。独立 Approved，合同 SHA-256 EE46E806…397D7。Planner 接受。 | WP main 714ba91、embedded a827136 各独立通过，包 993c936b…。ADA 两个问题返修后独立 Approved。最终 Chrome 新建、取消和保存重开通过。ADA 56894feb，Web 构建 137 个资源校验通过。 |
| [B](2026-11-18_01B_drawing-board-image-entry.md) | 已合入画板分支 | 初版、Worker 与异步文件发布均独立设计 Approved。 | WP codec 5a3d670／embedded 7a37c44 固定包 8d810c07…。真实 Chrome PNG/EXIF 原像素与重开通过。B-I1 修复独立通过，B-I2 Worker 与异步发布后峰值停顿 0.54–0.61 秒，独立 Approved，ADA 395baa05。 |
| [C](2026-11-18_01C_drawing-board-warm-editor.md) | 已合入画板分支 | 独立设计 Approved，SHA A4E9B9FD…7A81D4。 | embedded 清理切片定向 54/54，独立 6/6。C-I1–I3 与旧 Flatten 归属修复通过，WP main 0382d4c、embedded 9b6aaf5、最终固定包 01006e09…。ADA C 独立提交 5fdf8be6，合入 a4eaaa2。同 iframe、跨项目退役 Chrome 已验证。 |
| [D](2026-11-18_01D_drawing-board-open-loading.md) | 已合入画板分支 | 独立设计 Approved，SHA 6B0B016E…E6430。 | D 实现独立 Approved，独立提交 07c12b0b、画板合入点 e0c6c29c。相同 pin 的 4K 冷开元数据首字节 439.2→47.3 ms、确认首笔 4.76→4.42 秒。 |
| [E](2026-11-18_01E_drawing-interaction-regression.md) | 完成 | 独立设计 Approved，SHA 24D71E37…755E。 | 独立 WP 生产窗口和最终集成 Chrome 的 4K 画笔与变换均已采集并独立核对。实际保存挂起时继续撤销、落笔和最新版本重开通过。 |

## 返修信号

已收敛 A 的锁定/恢复提示、B 的权威 410 和容量、C 的旧绘制/提示/导航边界、D 的授权与同版本快照。相应次序、问题与独立裁定在阶段任务中，D 的并发 preview 短间隔重开按一次有界重读修复，已独立通过和实窗复验。当前无未关闭代码阻断。

## 验证限制

隔离 Web 测量和模拟网络数据单列。正式服务器、Owner 真笔／IME／DPR 和正式 Desktop 产品体验仍待独立验收。

## A–D 最终集成底座

ADA a4eaaa258f36b1b9e1470340ae15832ad364f2eb，双亲 e0c6c29c 与 5fdf8be6，树 bfd1243a。独立核验暂存树、20 个合并路径与最终 WP pin。整合集成自动化通过 SQLite／真实 PostgreSQL API 31/31、Web 11 组脚本、四层类型、Vite 构建及 137 个 dist 固定包资源逐 hash。隔离 PostgreSQL 已停止。独立阶段浏览器结论与最终整合版本实窗分别记录。最后保守重试以 46659d1 落档，重新通过 API 31/31、真实固定包 Chrome 的两种图片画板立即重开。原预览和正式内容用途不变。
