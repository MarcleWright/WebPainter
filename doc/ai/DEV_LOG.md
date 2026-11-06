# 工作进展索引

2026-11-07 — 03B→D→E→F授权实施与有限收口：main native、正式iframe真实owners、受控生成/Results、生产包离线/恢复与PS27有限核对、两独立入口回归。版本/实际通过/人工Pending见[03F](tasks/2026-11-06_03F_offline-psd-acceptance.md)，待统一独立review及Owner验收，不推送发布。

2026-11-06 — 03B main通用native v1：显式有界manifest/binary tile、稳定ID和支持数据恢复、继续编辑/撤销、非法输入拒绝；独立PSD管线保留。[格式与边界](../engineering/NATIVE_FORMAT.md)。通过阶段门槛后本地提交并由main单向合入embedded，不推送/发布。

2026-11-06 — Owner 确认 iframe；03C 有限面板 review Approved。更新 ADR/架构及后续 B→D→E→F 连续执行安排，保留人工/正式宿主/离线等未验收项。本次仅文档。[选型](tasks/2026-11-06_03C_carrier-comparison.md#confirmed-iframe-decision)。

2026-11-06 — 03C 面板有限原型完成自查：WP c9acf84 通用 mountPage/干净固定包、ADA 共用面板/受控合同；双方类型/构建、WP9、面板与保留P2/实窗通过。人工IME/手绘板/正式宿主仍 Pending，工程暂推荐B但总体 Inconclusive，待统一独立review/Owner选择。分阶段本地提交、不推送，03B/D/E/F 未推进。[记录](tasks/2026-11-06_03C_carrier-comparison.md#bottom-panel-bounded-prototype)。

2026-11-06 — 03C 两项 P2 已按本轮有限授权修复，待独立复审：Return 等待完整打开并合并关闭；非法确认值一律 Cancel。新增回归 29/29、原壳自测、ADA typecheck/build、WP lifecycle/RPC 9/9 与固定包 6/6 定向实窗通过；真实 dirty 场景保留修改。底部面板/其他补验及 03B/D/E/F 未实施；无新分支/提交/发布。详见 [03C 修复记录](tasks/2026-11-06_03C_carrier-comparison.md#p2-repair-only)，发 ADA集成-REV 复审后暂停。

## Recent

### 2026-11-06 03A / 03C 有限实施与对照

Status: 03A 实施待 review；03C 总体 Inconclusive，等待 Owner 承载确认，后续阶段暂停。

- [03A](tasks/2026-11-06_03A_editor-boundary.md) / [03C](tasks/2026-11-06_03C_carrier-comparison.md)：同内核 4K 实窗、端口生命周期、36/36 定向检查、双方构建与 main smoke；暂推荐本地 iframe，不以单次性能数据定案。未提交、推送、发布；03B/D/E/F 未实施。

### 2026-11-06 Task03 评审 R1 规划修订

Status: Planner 已采纳 R1/P2 并修订计划, 待独立复核; 不视为代码验收。

- 核对 ADA renew/quiescence/workspace transport, 区分自动续期与真正关闭作品, 补 03D 生命周期/操作身份和定向验收。
- [父任务评审处理](tasks/2026-11-06_03_ada-integration-architecture.md#plan-review-result-and-revision)、[03D](tasks/2026-11-06_03D_ada-document-workflow.md#profile-renewal-contract)。未改 reviewer 原文/产品代码/相邻 ADA, 未执行测试或提交。

### 2026-11-06 独立版、嵌入分支与 ADA 更新路线

Status: Owner 已确认分支路线, 03A-03F 文档修订待整体审查; 无实现授权。

- main 保留独立本地能力及通用功能/codec, embedded 持续合入 main 并提供通用入口, ADA 只持专用 adapter 和固定版本包; 上游 PR 按通用改动独立整理。
- [父任务](tasks/2026-11-06_03_ada-integration-architecture.md#branch-and-repository-ownership)、[架构](../architecture/ADA_INTEGRATION.md#21-仓库分支和更新路线)、ADR 与全部子任务同步。最新静态基线 ef3eea8/e9f45893; 保存关闭仍待复审/人工。本轮无分支创建、代码改动、提交或相邻 ADA 写入。

### 2026-11-06 ADA 共用任务与承载分叉规划

Status: 03A-03F 已拆分, 待审查及实施授权。

- Owner 确认全屏界面独立, 不等于必须 iframe; 修正架构/ADR, 保留 A/B 选择。
- [父任务与六项子任务](tasks/2026-11-06_03_ada-integration-architecture.md#ordered-subtasks-and-dependencies)明确共用代码、依赖及有限验收。主要分叉在 03C, 不建设两套完整产品; 未改代码/相邻 ADA 或创建执行循环。

### 2026-11-06 ADA 集成架构草案

Status: 仅架构规划, 待 Owner 确认, 未实施或提交。

- 以最新 WebPainter 和指定 ADA worktree 核对, 建议保留内核、有限开放首版, 明确嵌入/保存/生成/Three.js 边界。
- [架构草案](../architecture/ADA_INTEGRATION.md)、[任务记录](tasks/2026-11-06_03_ada-integration-architecture.md)、[Proposed ADR](decisions/ADR-0003_ada-embedded-editor.md)。确认架构后再拆实施任务。

### 2026-11-06 保存与关闭可靠性实现

Status: 局部实现及定向自动验证完成, 待独立 reviewer 复审和人工验收。

- 目标会话输出/关闭占用、编辑入口保护、文件绑定与保存点分离、关闭等待后重查; 保留默认 GPU 优化。
- 验证范围、受保护入口、结果与未验收项见 [任务记录](tasks/2026-11-06_02_save-close-reliability.md#execution-report)。本地提交, 不推送或发布。


### 2026-11-06 保存与关闭可靠性任务规划

Status: 新任务方案已审查通过并授权后续 coder 实施及本地提交, 尚未实现; 默认接入实现复审为 Changes Requested。

- 区分原有关闭/保存点疏漏与本次另存为路径回归, 保留 GPU 优化, 采用目标文档保存保护与关闭重查的有限主线。
- [新任务](tasks/2026-11-06_02_save-close-reliability.md) 明确范围和验收; 关联修复后再收口 [默认接入任务](tasks/2026-11-06_01_default-gpu-selection-move.md), 人工验收仍单列。

### 2026-11-06 默认接入任务规划

Status: 默认接入已实现, 自动及生产脚本验证通过; 后续独立复审要求保存/关闭修复, 详见上方关联任务, 人工验收仍待完成。

- 用户明确不保留优化模式开关, 以能力自动选路, 将保存/导出和自动保存等交接纳入最小正式接入范围。
- [默认接入任务](tasks/2026-11-06_01_default-gpu-selection-move.md) 给出范围和有限验收, 不扩展所有格式或引入框架。本轮保留并接入既有启动器, 实现与未验收项见任务 Execution Report。

### 2026-11-06 完整当前源码启动器

Status: Start-WebPainter.bat 已新增并实际启动验证; 本轮未提交/推送。

- 保留正式桌面 main/preload/文件服务, 加载当前源码并显式开启 GPU 移动优化, 不预置合成图片。独立配置和临时目录, 自动保存关闭。
- 与固定样例的 Start-Task02.bat 分开; [入口与验证边界](../engineering/DEV_SETUP.md#启动当前源码的完整工程)。未改工具算法、生产默认开关或 Ctrl+J。

### 2026-11-06 受限原型收口与仓库同步

Status: Task 02 受限原型 Go; 用户授权提交手测入口与记录并同步自有 origin/main。

- 72 项相关测试、构建、独立复审及用户实际试用支持本轮结论; 未覆盖场景和正式化继续保留, 不开启生产默认开关。
- 包含现有阶段提交及后续手测入口, 排除原始材料和用户 profile; 不推送 Celenne 上游、不创建 PR 或发布。

### 2026-11-06 用户试用反馈

Status: 用户确认优化性能达到可用水平; 完整验收仍未完成。

- 实际体验反馈归 [任务 02](tasks/2026-11-05_02_4k-selection-preview-prototype.md#user-feedback---2026-11-06); Ctrl+J 的整层复制绑定另记 [WP-EDIT-001](../engineering/KNOWN_ISSUES.md), 本轮未改复制行为。

### 2026-11-06 Task 02 双击手测入口

Status: 修复提交 59c01de 独立复审通过; 手测入口已启动验证, 用户体验待确认。

- 新增 [Start-Task02.bat](../../Start-Task02.bat), 自动打开独立 4K 实验窗口, 提供旧/优化切换及固定样例; 启动方式见 [DEV_SETUP](../engineering/DEV_SETUP.md#task-02-手动体验)。
- 确认真实 WebGPU 后端与初始实验配置, 未将启动检查记为人工拖动验收, 未改生产默认开关或重新测量性能。

### 2026-11-06 Task 02 独立审查与局部修复安排

Status: Changes Requested 的两项 P2 已局部修复并验证, 待独立复审。

- 现有 69 项相关测试和构建通过; 额外复现确认越界连续拖动及失败后 redo 一致性问题。
- 保留三阶段成果, [任务 02 的修复调整](tasks/2026-11-05_02_4k-selection-preview-prototype.md#repair-adjustment---2026-11-06) 记录修复及验证。
- 本轮新增一个本地修复提交; 实窗体验仍未验收, 保持 Inconclusive。

### 2026-11-05 浮动选区主线与原型任务规划

Status: 受限原型已执行; 脚本前后数据和自动检查已记录, 人工窗口验收缺失, Inconclusive。

- 确定浮动选区状态 + 稳定资源 WebGPU 图层内合成, CPU 作参考、提交与回退。
- 保留核心优化, 按用户意见将验证收缩为有限实窗前后对照、一个效果组合和小 fixture 像素/历史检查; 30fps 为参考, 完整性能/故障/资源审计后移。
- 执行按准备/核心/验证三个阶段形成本地提交; 未推送。
- 不修改业务代码, 不把文档创建当成实现或验证完成。

Primary task links:

- [原型验证任务 02](tasks/2026-11-05_02_4k-selection-preview-prototype.md)
- [ADR-0002](decisions/ADR-0002_floating-selection-webgpu-prototype.md)

### 2026-11-05 文档体系与性能研究归档

Status: 文档与源码研究完成; 性能实现未开展。

- 新建 fork 自有 doc/ 与入口, 保留上游 docs/ 及根说明。
- 将既有 4K 评估提升为项目文档, 原始数据本地归档。
- 对照 PhotoCraft v0.20.2, 区分 Move 浮动选区、Ctrl+T 纹理预览与 native/Web 分支。

Primary task links:

- [文档治理与源码研究](tasks/2026-11-05_01_documentation-and-performance-research.md)

### 2026-11-05 Fork 本地环境建立

Status: 本地环境验证完成; 品牌、性能与 ADA 集成未改动。

- origin 指向 MarcleWright/WebPainter, upstream 保留 Celenne, 默认推送到 origin。
- 安装依赖和匹配 Electron, 生产 build 及隔离小 PSD smoke 通过。

Links: [DEV_SETUP](../engineering/DEV_SETUP.md)。
