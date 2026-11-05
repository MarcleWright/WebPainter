# WebPainter 工作入口

- 当前仓库是 MarcleWright/WebPainter, 工作目录为 D:/00_Projects_WSY/AI/Codex_Projects/WebPainter。
- 先读 [doc/README.md](doc/README.md) 和 [doc/ai/AI_CONTEXT.md](doc/ai/AI_CONTEXT.md), 再按任务读取对应层。
- `docs/`、根 README.md、CHANGELOG.md 和 NOTES_FOR_ARTCRAFT.md 保留原作者体系。WebPainter 的需求、差异、验证和决策写在 `doc/`。确需改上游文档时, 先在任务中说明原因和范围。
- 判断现有行为时以实际源码和本仓库验证为准。上游文档、用户观察、测量、建议、已实现必须分开标记。
- Task 02 已获用户授权并执行受限实验原型; 其结果与未验收项见任务记录。后续按用户明确的任务范围工作; 评估和计划不自动授权额外实现、提交、推送或发布。
- 修改前检查 git status, 保留无关改动。不要因本仓库任务修改相邻 ADA 仓库。
- 原始截图、测试数据、CPU profile 和外部源码放 `doc/material/` 本地材料区, 默认不进入 Git。稳定结论写入对应 owner 文档。
- 文档用 UTF-8, 优先无 BOM。任务结束检查相关链接、编码和 git diff --check。
- AI_CONTEXT 保持短而当前, DEV_LOG 只作索引; 详细过程归入任务记录。按需建立任务, 不自动创建执行循环或独立 reviewer 记录。
