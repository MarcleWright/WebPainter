# 当前上下文

2026-11-12 [Ctrl+T正式确认吞吐](tasks/2026-11-12_01_transform-confirm-throughput.md)已按Owner授权实施，待独立实现review；Owner已观察明显提速；只改专用Worker采样内核。独立b01dcb7 oracle及305项整体回归、P-BUILD、开发/生产实际取消重试通过；同环境4K窗口三类总耗时中位数透明降低39.6–44.3%、不透明42.0–45.5%，最终tile/坐标/输入精确一致。仍约4–5秒，authority长尾最高235ms；原768MiB预算、预览和文件协调不变。本轮Owner另授权提交并推送origin/main；不推进下游，详细证据及限制见任务。

2026-11-11 [Ctrl+T后台确认与透视预览](tasks/2026-11-11_02_transform-commit-and-projective-preview.md)四阶段实施及验证完成，待独立实现review与Owner体验：专用Worker保留CPU原1024采样语义，owner保护/安全拒绝与透视GPU稳定源已接入。295项整体回归，末次取消owner修正后65项复验及构建通过；开发/生产Worker与取消重试有真实窗口证据。透视p95约改善49%，确认最长主线程任务约8秒→94–128ms，总耗时仍6.8–8.0秒；人工/真实设备等Pending，不判整体Go。只main本地提交，不推进embedded/ADA/发布，大画笔不在本轮。

2026-11-11 [大笔刷与Ctrl+T任务](tasks/2026-11-11_01_large-brush-and-transform-preview.md)四阶段实现/验证完成，待ADA集成-REV独立复审：253项整体回归、强化非均匀夹具后19项复验及构建通过。同尺寸重采：300px eraser p95约改善33.2%，brush帧尾未改善（撤销初测49.8%结论）；Ctrl+T p95约改善49.7%，混合revision为0，CPU Enter仍约6–12秒且交接有长尾。低频精确像素一致；支持/回退及人工未验收见任务，不判整体Go。既存启动dirty保留，不推送或推进embedded/ADA。

2026-11-10 [图块级内容边界缓存任务](tasks/2026-11-10_02_tile-content-bounds-cache.md)两阶段已完成：局部精确缓存及132项定向测试、构建通过；同配方完整native开发窗口D的RAF p95中位数改善88.7%/90.8%，低频逐tile像素SHA及边界一致。待 ADA集成-REV 统一独立review；真实手绘笔/物理呈现/Owner原作品及生产dist性能仍Pending。只交付 main 两次本地提交，既存启动dirty保留，不推进embedded/ADA或推送发布。

2026-11-10 Owner 指定后续 WP 本体主要在 `WebPainter_main_native` 工作, 当前为 main; `WebPainter` 保留 embedded 工作目录。新增根目录 `start-dev.bat`, 复用当前 checkout 的 Vite + 原生 Electron 启动流程; 前端热更新, main/preload 改动重启。见 [开发环境](../engineering/DEV_SETUP.md#启动当前源码的完整工程)。

2026-11-06 03B：main独立worktree通用native v1已实施，待后续统一review。初始main ef3eea8；75项首次组合检查、追加后native18项/类型及构建通过，6层4K codec与tile往返有记录。格式/拒绝边界见 [native格式](../engineering/NATIVE_FORMAT.md)，[执行证据](tasks/2026-11-06_03B_native-codec.md)。只由main单向合入embedded供ADA固定包使用，不引入ADA/embedded依赖；未推送/发布，人工/Photoshop未验收。

更新: 2026-11-12。保持短而当前; 详细历史读任务记录。

## 当前阶段与入口

- WP本体通用改进在main工作树 `WebPainter_main_native`；embedded工作树 `WebPainter`单向合入main，ADA消费固定包。正常开发入口为根目录start-dev.bat，见[开发环境](../engineering/DEV_SETUP.md)。
- 当前模块、已实现优化与安全/回退边界见[架构入口](../architecture/ARCHITECTURE_OVERVIEW.md)及[预览/后台确认](../architecture/INTERACTIVE_PREVIEW.md)，不以旧原型研究文档代替当前源码。
- 2026-11-12 Owner反馈确认提速明显，并授权维护文档、提交及推送origin/main；本次包含当前吞吐实现/测试/任务，未授权下游包更新或发布。Owner体验反馈不代替完整实现独立review。
- 一次用户操作一次历史、CPU权威像素、共同安全预检、owner token和完整画面交接保持；未做多Worker/Rust/GPU权威提交。大画笔、authority显示长尾仍待后续。

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
