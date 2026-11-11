# 验证约定

原作者说明见 [docs/DEVELOPMENT](../../docs/DEVELOPMENT.md)、[BENCHMARK](../../docs/BENCHMARK.md)。本页维护 fork 的验证选择与证据边界。

## 轻量验证预设

| 预设 | 命令/检查 | 用途 |
| --- | --- | --- |
| P-DOC | UTF-8 解码、相对链接、材料忽略规则、上游 docs 校验、git diff --check | 文档和研究归档 |
| P-TYPE | `npm run typecheck` | TypeScript 契约 |
| P-INPUT | `npm exec -- vitest run tests/input tests/engine/moveSelection.test.ts tests/gpu/moveOutput.test.ts tests/engine/access.test.ts tests/engine/layerAccessUI.test.tsx` | 有效绑定、实际 App/Canvas/文本/Modal 传播、业务像素/历史、保存及 access 回归 |
| P-MOVE | `npm exec -- vitest run tests/engine/moveSelection.test.ts` | 既有选区移动和历史回归 |
| P-BUILD | `npm run build` | 生产资源与 Electron 构建, 内含 typecheck |
| P-SMOKE | 依上游 `CELENNE_SMOKE=1` 入口, 使用独立 userData/temp | 真实生产窗口加载, 不覆盖用户 profile |
| P-FULL | `npm test` | 代码改造范围需要时的完整自动测试 |

未来任务引用预设名, 再补本任务风险检查。文档修改不为形式重复跑完整图像测试; 实施路径变化后才执行相应代码验证。

`npm run benchmark` 会写原作者的 docs/BENCHMARK_RESULTS.md, 不能作为只读查看命令。新增 fork 测量输出放本地材料区或独立结果文件, 不覆盖上游基准来冒充同条件测量。

## 4K 性能的正式测量要求

现有测量及限制见 [评估](4K_SELECTION_ASSESSMENT.md)。后续原型/正式修改前固定:

- 文档尺寸、位深、图层组合、选区形状/面积/羽化、缩放和显示范围。
- 原始分辨率非均匀图像, 同时包含普通照片、透明内容和均匀内容。不要只用易共享的纯色图。
- 硬件、系统、构建模式、Electron/Chromium、native/Web、GPU 后端与回退原因。
- 事件到显示、首次提取、移动处理、帧间隔 P50/P95、过时显示块、提交稳定时间和内存。
- 输入频率和合并样本处理方式; 用相同脚本/轨迹对照修改前后。
- 保存完整可重跑的场景配置和结果。现有最后一版 evaluate.js 不能代替全部基线配置。

比较 PhotoCraft 时固定 v0.20.2 或另行记录新版本; native 和 Web 分开测。源码测试和用户主观试用不能替代同条件生产构建对比。

## 正确性与人工验收

- 普通/复制/连续拖动, 无位移, 取消, undo/redo。
- 透明像素、柔边和原图层 mask/opacity/blend/clip/adjustment 组合。逐项核对松手结果, 不能仅看缩略图。
- 25%/100% 缩放和显示范围变化, 拖动时是否连贯, 首帧是否明显停顿。
- 若加入异步结果, 覆盖取消、切换/关闭文档、旧结果晚到和资源释放; 应用身份以真实运行时验证。
- 导出/重开和目标 Photoshop 文件检查与性能验收分别记录。
- 完全断网运行的绘画、打开、保存、重开、PSD 导出需单独人工验证。

Task 02 的 P-MOVE、GPU 定向检查、P-BUILD 和有限脚本对照见 [任务记录](../ai/tasks/2026-11-05_02_4k-selection-preview-prototype.md), 用户已实际试用确认性能达到可用水平。P-FULL、PhotoCraft Rust 基准和完整人工矩阵仍未执行。生产默认链路及输出交接的后续验收见 [默认接入任务](../ai/tasks/2026-11-06_01_default-gpu-selection-move.md), 自动及生产脚本检查已执行, 未执行的人工与设备项目在该任务记录。

## 快捷键验证边界

稳定规则见[键盘输入约定](../design/KEYBOARD_INPUT.md)，阶段与人工结果见[任务](../ai/tasks/2026-11-10_01_shortcut-unification.md)。P-INPUT 挂载生产监听和真实工具/会话/命令，图形 renderer/布局及 IO 可隔离；不能用它代替完整生产图形、原生焦点/中文 IME 或 Owner 试用。曲线、调整、Fill 和 Copy/Cut 分别检查实际预览/像素/历史。生产 smoke 从当前 worktree 的 build + 正常 main/preload/app:// 加载，独立 profile/temp，不加载相邻业务源码；脚本 KeyboardEvent 及 profile 重启是自动集成证据，人工矩阵须逐项另记。
