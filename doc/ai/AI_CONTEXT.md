# 当前上下文

更新: 2026-11-06。保持短而当前; 详细历史读任务记录。

## 当前阶段

- WebPainter 是 Celenne fork, 独立目录 `D:/00_Projects_WSY/AI/Codex_Projects/WebPainter`。业务源码基线 a6599003, 应用品牌尚未替换。
- 已有安装、生产构建与小 PSD 启动检查; 用户实际试用认可 UI/功能, 同时观察到 4K 选区拖动问题。
- 已建立 `doc/`, 保留 `docs/` 原作者体系; 先前测量已提升为项目评估, PhotoCraft v0.20.2 对照已归档。
- [原型任务 02](tasks/2026-11-05_02_4k-selection-preview-prototype.md) 已按受限原型 Go 收口: 用户实际试用确认性能达到可用水平, 完整人工场景和正式化仍待验证; 品牌/ADA/Rust 改造未开展。
- 准备、核心、有限验证及局部修复分别提交; 用户已授权同步自有 origin/main, 不推送上游或发布。
- 2026-11-06 独立复审修复提交 59c01de 为 Approved, 72 项相关测试和构建通过; 原型 Go 不等于生产默认启用。
- Start-Task02 仅作合成样例验证, 保留 F7/F8/F9; 已移除 F6 算法切换和实验标记。
- Start-WebPainter 为完整当前源码入口, 使用原 profile/temp, 读取正常用户偏好, 不强制关闭自动保存或注入优化开关。
- 新反馈 Ctrl+J 复制整层: 已核对其绑定 layer.duplicate, 现有 Layer via Copy 支持读取选区但无快捷键。记录为 WP-EDIT-001, 未授权或实施该行为调整, 不混入性能任务。
- 默认接入 d3a7fb1 已实现, 独立复审为 Changes Requested: 保存后关闭会丢失较新修改, 另存为可能保留旧路径。[保存与关闭可靠性任务](tasks/2026-11-06_02_save-close-reliability.md) 承接旧缺陷和新增回归, 方案已通过审查并授权后续 coder 实施及本地提交, 尚未实现; 修复复审后再结合 [默认接入任务](tasks/2026-11-06_01_default-gpu-selection-move.md) 的人工验收收口。未推送或发布。

## 优先议题

- 产品目标是实时跟手、画面连贯、最终结果可信、撤销习惯不变。
- 主线明确为浮动选区状态 + 稳定资源 WebGPU 图层内实时合成, 松手写回。输入减负、块级缓存和缩略复用配套; CPU 保留作参考/提交/回退, 不再列为同等未决主路线。
- 原型保留全部核心优化, 验证缩为 RGB 8 位 4K 中/大选区前后对照、一个效果组合、小 fixture 像素与历史检查。30fps 为参考目标, 不叠加多项数值硬门槛; 完整矩阵、GPU 读回和故障/资源审计后移。
- 默认路径已有输出交接, 但复审暴露文件生命周期缺陷; 后续采用手动保存期间限制目标文档编辑、独立处理路径/保存点、关闭等待后重查的主线。保留 GPU 核心, 不建设通用任务队列; 新任务 Ready, 实现与人工验收另行记录。
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
