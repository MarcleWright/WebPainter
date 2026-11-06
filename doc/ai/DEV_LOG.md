# 工作进展索引

2026-11-06 — 03B main通用native v1：显式有界manifest/binary tile、稳定ID和支持数据恢复、继续编辑/撤销、非法输入拒绝；独立PSD管线保留。[格式与边界](../engineering/NATIVE_FORMAT.md)。通过阶段门槛后本地提交并由main单向合入embedded，不推送/发布。

## Recent

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
