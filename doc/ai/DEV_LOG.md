# 工作进展索引

- 2026-11-16 阶段A：固定Dev普通merge，逐函数整合生命周期；390项回归与P-BUILD通过，独立集成review待执行，B/C和Owner窗口体验Pending。见[集成任务](tasks/2026-11-16_01_dev-main-embedded-ada-integration.md)。

2026-11-06 — 03B main通用native v1：显式有界manifest/binary tile、稳定ID和支持数据恢复、继续编辑/撤销、非法输入拒绝；独立PSD管线保留。[格式与边界](../engineering/NATIVE_FORMAT.md)。通过阶段门槛后本地提交并由main单向合入embedded，不推送/发布。

## Recent

### 2026-11-16 无感自动保存规划

- [分阶段修复任务](tasks/2026-11-16_03_nonblocking-autosave-and-editing.md)：Owner已授权分阶段实施/独立review/本地提交；阶段0§10已补源码落点、旧判断退休表、控件稳定通知与离开时序，待独立review。本阶段仅文档，未实施源码/提交/构包。

### 2026-11-16 跨分支集成阶段0

- [分阶段任务](tasks/2026-11-16_01_dev-main-embedded-ada-integration.md)：方案review通过并获Owner执行授权；阶段0固定输入/保全dirty、整理embedded诊断及ADA现有面板UI交独立review。A–C尚未实施，未提交/合并/换包/推送；人工体验Pending。

### 2026-11-12 当前架构维护与同步

- 吞吐实现/独立oracle/任务已提交 `dc553cb`；本轮94项定向回归重跑通过。更新架构入口、交互预览/后台确认和PhotoCraft历史对照，Owner已观察明显提速，按授权同步origin/main。原始材料不入Git，完整实现review仍Pending，不推进下游。

### 2026-11-12 Ctrl+T 正式确认吞吐实施

- [实施与证据](tasks/2026-11-12_01_transform-confirm-throughput.md)：专用单Worker采样内核，305项回归/P-BUILD及开发生产取消重试通过；同环境4K三类中位总耗时透明降低39.6–44.3%、不透明42.0–45.5%，精确像素及预算不变。仍有4–5秒等待/最高235ms交接长尾，待独立review及Owner体验；Owner反馈提速明显，另授权本轮架构文档维护、提交及推送origin/main；不推进下游。

### 2026-11-11 Ctrl+T 后台确认与透视预览

- [任务与证据](tasks/2026-11-11_02_transform-commit-and-projective-preview.md)：四阶段完成，295项整体回归、取消owner修正后65项复验及构建通过；透视拖动及UI响应改善，确认仍数秒，人工/Owner未验收。交独立review后暂停，不推进下游。

### 2026-11-11 大笔刷与Ctrl+T

- 四阶段完成：253项整体回归、强化夹具19项复验及构建通过；同尺寸eraser/Ctrl+T帧尾改善，brush帧尾未改善，人工与整体Go未验收，交ADA集成-REV后暂停。
- [任务及证据](tasks/2026-11-11_01_large-brush-and-transform-preview.md)，分阶段本地提交，最后交ADA集成-REV。

### 2026-11-10 图块级内容边界缓存

- 两阶段完成：132项定向回归、构建通过；完整native开发窗口D的p95中位数改善88.7%/90.8%，低频像素/边界一致；人工及生产dist性能未验收，待 ADA集成-REV。
- [任务与证据](tasks/2026-11-10_02_tile-content-bounds-cache.md#8-执行记录阶段一)，两次本地阶段提交后交 ADA集成-REV，未授权下游更新。

### 2026-11-10 main_native 日常开发入口

- 新增 [start-dev.bat](../../start-dev.bat), 复用本目录 Start-WebPainter/Vite/Electron, 前端改动热更新, main/preload 重启后生效。
- Owner 指定 WP 本体以 main_native 为主要工作目录, 两个 worktree 分工及使用说明见 [DEV_SETUP](../engineering/DEV_SETUP.md)。本轮不改编辑器算法或品牌, 不提交/推送。

### 2026-11-16 路径显示补漏复审通过

- [任务 02 F1–F2](tasks/2026-11-12_02_path-selection-shortcuts.md)：文字工具默认目标跳过隐藏 Work Path，4 项补测保留普通文字点击/拖框与显式路径、Shape 行为。6.1-sol 子代理修复，主代理独立复审 Approved，关联集 262/262、构建通过；Owner 授权提交并推送 origin/codex/dev，未完成的窗口/人工验收仍单列。

### 2026-11-14 路径转换显示与空白取消 F1–F2

- [任务 02 F1–F2](tasks/2026-11-12_02_path-selection-shortcuts.md)：原范围复审 Approved，新增成功收尾按文档路径取消/隐藏、Shape/Mask 例外和面板剩余空白取消；会话显示状态与默认编辑准入一致。验证及人工缺口见任务，待独立实现复审；不暂存/提交/推送/合并/发布。


### 2026-11-12 路径转选区统一入口实现验证

- [任务 02](tasks/2026-11-12_02_path-selection-shortcuts.md)：三键 replace/add/subtract、共享 Action/面板入口、固定目标与 finishPen、历史/失败及空覆盖验收。基线 F1/F2 为 a2d48be；Owner 已授权 P1→P2→P3 实现验证。阶段证据和真实窗口/IME/人工缺口见任务，待独立实现复审；本轮不提交、推送、合并或发布。

### 2026-11-12 F1/F2 本地提交授权

- Owner 授权提交钢笔准入及关闭标尺布局修复、对应验证和文档；不推送/合并/发布。随后仅分析钢笔路径转选区快捷键缺口，不扩展代码。

### 2026-11-12 关闭标尺导致画板不可见修复

- [任务运行验证 F2](tasks/2026-11-12_01_pen-live-path-editing.md)：WP-UI-001 固定 viewport 网格位置；真实 Electron 复现 0×0 布局并修复，独立完整应用关/开/关标尺与 WebGPU 图像输出通过，构建通过。原源码窗口热更新后恢复适配且保持 Saved；未提交/推送。

### 2026-11-12 钢笔 F1 目标准入修复

- [任务 F1](tasks/2026-11-12_01_pen-live-path-editing.md)：矢量蒙版权限拒绝在注册空草稿前完成，保留已有有效草稿及新建 Shape；三例回归、关联 143/143 与生产构建通过。修复后自查无新增 P1/P2，不替代独立 reviewer/人工验收；未提交或推送。

### 2026-11-12 钢笔即时路径编辑实现

Status: 方案复审通过后按 R1–R2 完成 P1–P3 本地提交，自动与隔离生产窗口证据见任务；待独立实现复审，真实 IME/OS AltTab/物理高 DPR 与人工/Owner Pending。不推送/合并/发布。

- [钢笔任务](tasks/2026-11-12_01_pen-live-path-editing.md)：同一未闭合路径内 Ctrl/Alt 临时编辑、续画末端与手势归属、局部撤销及统一闭合提示；列明三阶段范围、目标失效边界及验收；复审修订补历史面板保护、正式草稿主动切换先提交及对应实际面板测试。

### 2026-11-12 弹窗与移动选区 F1–F2 限定修复

Status: 原实现审查 Changes Requested；限定修复完成，待独立复审，人工/Owner Pending。本地提交，不推送/合并/发布。

- [任务文末 F1–F2](tasks/2026-11-11_01_dialog-and-selection-interaction.md)：F1 覆盖率相减挖空及独立三例/重叠数值；F2 控件激活先于 held 导航。最终关联 190/190、构建及隔离窗口原生 Space 激活/held 正例通过，保留旧 R4 与全部未验收项。

### 2026-11-11 弹窗与移动选区交互实现

Status: 方案复审通过后按授权完成 P1–P3 本地提交；177 项关联回归/构建/隔离生产窗口脚本通过。独立实现复审及人工/Owner Pending，不推送/合并/发布。

- [交互对齐任务](tasks/2026-11-11_01_dialog-and-selection-interaction.md)：公共透明模态背景、受控画布导航及位置记忆；移动片段 Alpha 生成贴合轮廓，配套覆盖率与单次撤销。三阶段范围及验收已列明。
- 颜色填充延迟记录为 [WP-PERF-002](../engineering/KNOWN_ISSUES.md)，由其他分支处理，不混入本任务。

### 2026-11-11 快捷键统一实现交接

Status: 原实现审查 Changes Requested；限定 R1–R3 修复 review 已通过（Owner 确认），R4 延期；人工/Owner Pending。已授权推送 origin/codex/dev，不合并/发布。

- [任务 P1-P5](tasks/2026-11-10_01_shortcut-unification.md) 记录固定 PhotoCraft 源码参考、输入优先级、工具重绑定、常用绑定及验收; codex/dev 独立实施。
- 复用 Action/keymap/工具与历史；有效绑定、分发/焦点/IME、held pan、上下文复制及首批绑定已接入。原 75 项定向检查、生产构建与隔离生产 smoke 证据保留；本轮限定修复 hash、补测和最终门槛见任务文末。

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


2026-11-16 — [跨分支集成最终记录](tasks/2026-11-16_01_dev-main-embedded-ada-integration.md)：Dev→main→embedded→ADA各阶段本地提交与独立技术review Approved；原dirty独立交付，新包来源固定，Owner人工/窗口验收Pending，无推送发布。


2026-11-16 — 登记WP-EDIT-002：[透明穿透选层核对](../engineering/LAYER_PICKING_ASSESSMENT.md)，对照固定PhotoCraft命中owner；3项受控诊断区分原alpha0已有能力与蒙版/opacity0缺口，仅文档未修复。

2026-11-16 — Owner确认ADA内WP开启Auto-Select后透明处可选下层，本次按配置行为收口；WP-EDIT-002记录已区分其他受控边界，无感保存任务明确不包含选层修复。


- 2026-11-16：无感保存阶段A main实现：Session输出/编辑准入分工、稳定检查点与局部buffer通知、旧Promise交互判断退休及close cutoff。336项定向自动/P-BUILD通过，待独立实现review，未推进B/ADA。见[任务§11](tasks/2026-11-16_03_nonblocking-autosave-and-editing.md#11-阶段a实施与验证2026-11-16)。

- 2026-11-16：A独立review唯一P2补修：standalone recovery到期需求在未提交操作期间保留，稳定通知后续跑，失败/close/dispose/输出槽/跨session隔离6项通过，相关57项及P-BUILD通过，待复审。见[任务§11.4](tasks/2026-11-16_03_nonblocking-autosave-and-editing.md#114-a独立review-p2补修范围2026-11-16实施前)。

2026-11-16 [无感自动保存最终记录](tasks/2026-11-16_03_nonblocking-autosave-and-editing.md)：0/A/A1/B/C0/Cfull独立技术审查Approved，固定port4包及ADA有限实窗/4K证据已核对；本地提交，不推送发布。人工/设备/ASAR Pending，详细状态以任务末节为准。
