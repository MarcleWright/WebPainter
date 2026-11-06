# 已知问题与缺口

| ID | 状态 | 用户影响/范围 | 证据与后续 |
| --- | --- | --- | --- |
| WP-PERF-001 | 实验优化已获用户可用性确认, 正式化待定 | 默认生产路径仍未开启优化; 完整场景、准备/松手停顿及持久化并发仍需验收 | [评估](4K_SELECTION_ASSESSMENT.md)、[任务 02](../ai/tasks/2026-11-05_02_4k-selection-preview-prototype.md); 2026-11-06 用户反馈性能改善达到可用水平 |
| WP-EDIT-001 | Open, 已核对绑定 | Ctrl+J 固定复制整层, 不随像素选区复制到新图层, 与用户预期不符 | actions.ts:206 绑定 layer.duplicate; 现有 layer.viaCopy/layerVia(false) 读取选区, 可暂用 Layer -> New -> Layer via Copy; 未修改代码 |
| WP-IDENTITY-001 | Deferred | fork 仍使用上游 app 名称和图标; 尚不作为新品牌发行 | [产品定位](../product/PRODUCT_BRIEF.md); 单独处理品牌和包身份 |

上游功能限制继续参考 [docs/KNOWN_LIMITATIONS.md](../../docs/KNOWN_LIMITATIONS.md), 不复制为已在本机复现的缺陷列表。完全离线、PSD 全量兼容与复杂交互尚未完成验收, 属于验证缺口, 不据此宣称必然失败。
