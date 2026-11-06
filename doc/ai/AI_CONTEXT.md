# 当前上下文

2026-11-06 当前执行：Owner 新授权仅 03C 底部 ADA 面板有限原型与受控 A/B 补验，分阶段本地提交、不推送。此前 P2 Approved 并保留回归。WP 仅补通用 mountPage；ADA 拥有面板/受控合同及组合页面。见 [当前 03C](tasks/2026-11-06_03C_carrier-comparison.md#bottom-panel-bounded-prototype)。整体仍 Inconclusive，Owner 未确认承载；03B/D/E/F 未实施。

2026-11-06 最新交接：两项 P2 经 ADA集成-REV 独立复审 **Approved**（仅修复范围）；Owner 已授权提交/推送现有集成工作。03C 仍 Inconclusive、承载未定，底部面板补验尚未执行，03B/D/E/F 未实施。旧原型包不因源码提交而追认至新 commit。详见[复审与提交交接](tasks/2026-11-06_03C_carrier-comparison.md#p2-independent-re-review-and-commit-handoff)；下方保留历史阶段记录。

2026-11-06 — 03C 两项 P2 已按本轮有限授权修复，待独立复审：Return 等待完整打开并合并关闭；非法确认值一律 Cancel。新增回归 29/29、原壳自测、ADA typecheck/build、WP lifecycle/RPC 9/9 与固定包 6/6 定向实窗通过；真实 dirty 场景保留修改。底部面板/其他补验及 03B/D/E/F 未实施；无新分支/提交/发布。详见 [03C 修复记录](tasks/2026-11-06_03C_carrier-comparison.md#p2-repair-only)，发 ADA集成-REV 复审后暂停。

更新: 2026-11-06。保持短而当前; 详细历史读任务记录。

## 当前阶段

- 2026-11-06 后续澄清已按 Owner 要求更新[父任务 03](tasks/2026-11-06_03_ada-integration-architecture.md): 首版沿用 WP UI, 底部增加 ADA 提示词/模型/生成/结果悬浮面板, 无 Agent 对话; Canvas 工具栏新建作品、作品节点重开, 专用 UI 后续再做。A/C 实现 review 为 Changes Requested, 两项实验壳 P2 与面板有限补验见 [03C](tasks/2026-11-06_03C_carrier-comparison.md#ui-clarification-and-bounded-follow-up)。以下原交付证据保留原范围; 当前仅文档调整, 无代码实施或承载定案。

- 2026-11-06 本轮授权的 [03A](tasks/2026-11-06_03A_editor-boundary.md) 已隔离实施、[03C](tasks/2026-11-06_03C_carrier-comparison.md) 有限实窗对照完成，总体 **Inconclusive**。已建 integration/embedded；main 仍 ef3eea8，未提交/推送。36/36 定向检查、两侧构建/类型、main 独立 smoke 及三入口脚本通过；工程暂推荐本地 iframe，未获承载确认，手绘板/人工输入与 GLB 探针未验收。端口和工具/native 规格见 [Port v1](../architecture/EMBEDDED_PORT_V1.md)。03B/D/E/F 未实施，到此暂停；独立 review 请求按本轮 Owner 授权发往 ADA集成-REV。

- Task03 整体独立评审为 Changes Requested(1 项 R1/P2): 03D 需区分同 Profile/instance 自动续期与真正离开。Planner 已按实际生命周期源码采纳并修订 [03D](tasks/2026-11-06_03D_ada-document-workflow.md#profile-renewal-contract)/架构, 保留编辑会话、每次请求捕获当前 epoch、旧请求不重标身份, 补定向验收; 待独立计划复核, 未实施或测试。评审原文保留。

- 2026-11-06 ADA 集成目标为 `auto_design_Agent` 指定 worktree, 不使用 `_New`。Owner 确认全屏编辑空间及 main -> integration/embedded -> ADA 固定包路线, WP 独立本地能力保留。最新核对 WP main/ef3eea8、ADA e9f45893; 该段为规划时点；当前嵌入分支与验证状态以上述 03A/03C 为准。A/B 承载未定。[父任务 03](tasks/2026-11-06_03_ada-integration-architecture.md)及 03A-03F 已更新分支 owner、通用端口/ADA 身份隔离、升级和上游 PR 边界, 见[架构](../architecture/ADA_INTEGRATION.md)。建议 A->C->B->D->E->F; codec 在 main 后合入 embedded, 重验受影响包。仅文档, 待整体审查和实施授权。

- WebPainter 是 Celenne fork, 独立目录 `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter`。业务源码基线 a6599003, 应用品牌尚未替换。
- 已有安装、生产构建与小 PSD 启动检查; 用户实际试用认可 UI/功能, 同时观察到 4K 选区拖动问题。
- 已建立 `doc/`, 保留 `docs/` 原作者体系; 先前测量已提升为项目评估, PhotoCraft v0.20.2 对照已归档。
- [原型任务 02](tasks/2026-11-05_02_4k-selection-preview-prototype.md) 已按受限原型 Go 收口: 用户实际试用确认性能达到可用水平, 完整人工场景和正式化仍待验证; 品牌/ADA/Rust 改造未开展。
- 准备、核心、有限验证及局部修复分别提交; 用户已授权同步自有 origin/main, 不推送上游或发布。
- 2026-11-06 独立复审修复提交 59c01de 为 Approved, 72 项相关测试和构建通过; 原型 Go 不等于生产默认启用。
- Start-Task02 仅作合成样例验证, 保留 F7/F8/F9; 已移除 F6 算法切换和实验标记。
- Start-WebPainter 为完整当前源码入口, 使用原 profile/temp, 读取正常用户偏好, 不强制关闭自动保存或注入优化开关。
- 新反馈 Ctrl+J 复制整层: 已核对其绑定 layer.duplicate, 现有 Layer via Copy 支持读取选区但无快捷键。记录为 WP-EDIT-001, 未授权或实施该行为调整, 不混入性能任务。
- 默认接入 d3a7fb1 已实现, 独立复审为 Changes Requested: 保存后关闭会丢失较新修改, 另存为可能保留旧路径。[保存与关闭可靠性任务](tasks/2026-11-06_02_save-close-reliability.md) 承接旧缺陷和新增回归, 已按授权实现并完成定向自动验证, 待独立实现复审和人工验收; 修复复审后再结合 [默认接入任务](tasks/2026-11-06_01_default-gpu-selection-move.md) 的人工验收收口。未推送或发布。

## 优先议题

- 产品目标是实时跟手、画面连贯、最终结果可信、撤销习惯不变。
- 主线明确为浮动选区状态 + 稳定资源 WebGPU 图层内实时合成, 松手写回。输入减负、块级缓存和缩略复用配套; CPU 保留作参考/提交/回退, 不再列为同等未决主路线。
- 原型保留全部核心优化, 验证缩为 RGB 8 位 4K 中/大选区前后对照、一个效果组合、小 fixture 像素与历史检查。30fps 为参考目标, 不叠加多项数值硬门槛; 完整矩阵、GPU 读回和故障/资源审计后移。
- 默认路径已有输出交接, 但复审暴露文件生命周期缺陷; 后续采用手动保存期间限制目标文档编辑、独立处理路径/保存点、关闭等待后重查的主线。保留 GPU 核心, 不建设通用任务队列; 目标会话保护已实现, 实现复审与人工验收另行记录。
- 借鉴 PhotoCraft 的普通 Move 与 Ctrl+T 必须分开。前者仍构造显示结果, 后者有缓存纹理预览; 原生平移的 Rayon 分支不等于 Web 并行。
- 保持一次拖动一次撤销。不要照搬 PhotoCraft 在多次移动后才 select.drop 的分组方式。

## 证据边界

- 既有 4K 测量是开发/离屏/合成数据/脚本输入, 不是生产窗口 FPS。
- 小 PSD smoke 是 96 x 64、10 层, 不是 4K 或完整格式验收。
- 有开发模式的 4K 脚本前后数据, 不是实际 FPS 或人工体验; 没有 PhotoCraft 同条件运行基准, 没有全离线验收。
- 原始材料保留在本地 `doc/material/`, 默认不提交; 共享结论不依赖本地机器绝对路径。

## 建议阅读顺序

1. [文档入口](../README.md)
2. [保存与关闭可靠性任务](tasks/2026-11-06_02_save-close-reliability.md) 与 [默认接入任务](tasks/2026-11-06_01_default-gpu-selection-move.md), 再按需读 [原型任务 02](tasks/2026-11-05_02_4k-selection-preview-prototype.md) 与 [ADR-0002](decisions/ADR-0002_floating-selection-webgpu-prototype.md)
3. [交互预览主线](../architecture/INTERACTIVE_PREVIEW.md) 与 [交互约定](../design/INTERACTION_RULES.md)
4. [产品性能方向](../product/PERFORMANCE_DIRECTION.md)、[4K 评估](../engineering/4K_SELECTION_ASSESSMENT.md)
5. [PhotoCraft 对照](../architecture/PHOTOCRAFT_REFERENCE.md)

执行或计划新任务前检查实际 git 状态和源码, 不把本上下文代替验证。
