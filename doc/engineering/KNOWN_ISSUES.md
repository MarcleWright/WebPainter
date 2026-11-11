# 已知问题与缺口

| ID | 状态 | 用户影响/范围 | 证据与后续 |
| --- | --- | --- | --- |
| WP-PERF-001 | 原型可用性已确认, 默认接入已实现但复审要求修复 | GPU 默认选路已在 d3a7fb1 实现; 保存/关闭关联修复及正常入口人工验收待完成 | [原型任务 02](../ai/tasks/2026-11-05_02_4k-selection-preview-prototype.md)、[默认接入任务](../ai/tasks/2026-11-06_01_default-gpu-selection-move.md) |
| WP-PERF-002 | Open, 用户已观察; 待专项测量 | 2026-11-11 在 WebPainter_Dev 当前源码窗口执行颜色填充命令后, 用户感到延迟较高; 图像尺寸、位深、选区范围与耗时尚未标准化记录 | 已核对 [fill 实现](../../src/app/ops/editOps.ts): 当前包含主线程区域 readFloat、逐像素混合与 writeFloat, 并经过历史记录及重绘链路; 尚未测量各部分占比, 不将源码路径等同于已证实瓶颈。按 Owner 要求由另一个分支单独解决（分支/任务待定）, 当前 codex/dev 不实施该性能优化, 不混入快捷键任务验收 |
| WP-FILE-001 | Open, 当前版本受控 I/O 复现; 原有根因已核对 | 关闭选择 Save, 写盘期间新增修改后仍可能清理恢复数据并关闭; 旧版另有误标 clean 风险 | [保存与关闭可靠性任务](../ai/tasks/2026-11-06_02_save-close-reliability.md); 源码归因与复现边界见任务证据 |
| WP-FILE-002 | Open, d3a7fb1 新增回归已复现 | 另存为写盘期间编辑会跳过新路径绑定, 下一次 Ctrl+S 可能写回旧文件 | [保存与关闭可靠性任务](../ai/tasks/2026-11-06_02_save-close-reliability.md); 尚未修复 |
| WP-EDIT-001 | Open, 已核对绑定 | Ctrl+J 固定复制整层, 不随像素选区复制到新图层, 与用户预期不符 | actions.ts:206 绑定 layer.duplicate; 现有 layer.viaCopy/layerVia(false) 读取选区, 可暂用 Layer -> New -> Layer via Copy; 未修改代码 |
| WP-IDENTITY-001 | Deferred | fork 仍使用上游 app 名称和图标; 尚不作为新品牌发行 | [产品定位](../product/PRODUCT_BRIEF.md); 单独处理品牌和包身份 |

上游功能限制继续参考 [docs/KNOWN_LIMITATIONS.md](../../docs/KNOWN_LIMITATIONS.md), 不复制为已在本机复现的缺陷列表。完全离线、PSD 全量兼容与复杂交互尚未完成验收, 属于验证缺口, 不据此宣称必然失败。
