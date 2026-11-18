# A · 在 WP 内新建 ADA 画板设计审查

审查类型为独立设计审查。Reviewer 为本任务独立审查代理 `/root/review_a`。基线为 WP main `b7bcedf`、embedded `5398194`、ADA `18bf864f`。

[阶段 A 任务](../tasks/2026-11-18_01A_drawing-board-new-document.md) · [父任务](../tasks/2026-11-18_01_drawing-board-workflow-and-open-performance.md)

## 第一轮 · Changes Requested

受审版本为父任务 SHA-256 `35A0EADE3B71405B967AFC88A993E1F265C9648C30D91FF2D959764568D714B9` 及当轮 Reviewer 委托中的阶段 A 方案。原结论为 Changes Requested。

| ID | 归因 | 触发机制、影响与最小调整 |
| --- | --- | --- |
| A-D1 | 设计缺陷 | ADA `apps/web/src/editor/controller.ts` 的 `leave()` 会等待 `opening`，而 `rpc.ts` 的普通请求有 120 秒超时。让交互等待占用这两者会卡住返回或让正常选择超时。用立即结算的 show/cancel 命令加一次性结果，由控制器在独立、可取消的状态内等待，并撤销超期或跨作用域结果。 |
| A-D2 | 设计缺陷 | WP `src/embedded/mount.tsx` 的空文档分支不渲染 `App`，因此没有 `DialogHost`；`capabilities.ts` 又禁用 `file.new` 和 `dialog:newDocument`。在空态明确挂载复用 WP UI 的宿主选择器，维持现有 Ctrl+N 和本地新建权限边界。用真实窗口验证焦点、Enter、Escape 和原生下拉的键盘所有权。 |
| A-D3 | 设计缺陷 | ADA `canvas-create.ts` 在异步创建前检查旧 Canvas 票据，`ProjectShell.tsx` 在成功后直接打开。项目或身份变化时旧结果可能接管界面。先捕获原所有者，在确认和持久化后的投影／激活重新验证，确认尺寸、artifact ID 和节点 ID 固定到同一意图；打开失败时重试原 artifact。 |
| A-D4 | 设计缺陷 | ADA `page.ts` 立即挂载面板，`panel.ts` 会立即请求模型，正常面板 host 在 `controller.ts` 的文档绑定后才建立。让选择阶段保持未绑定，正式打开后再按实际文档所有者启动面板，避免预确认请求和临时绑定泄漏。 |
| A-D5 | 设计缺陷 | ADA `rpc.ts` 校验请求参数，但通用回执没有方法级校验。沿共享 `drawingCreateSchema` 校验确认结果及每轴允许范围，界面明确拒绝非法输入。固定包显式验证新增能力；若选用端口变更，同步准备、校验、Web 和 codec 版本约束。 |

## 第二轮 · Changes Requested

受审阶段 A SHA-256 `6ABDAF2C5AD95CE148AF2B3C8383FD97DF7D73D134BC8EAF79A0DF780BD3701C`。A-D2 至 A-D5 已有充分设计约束，A-D1 的确认前取消也已覆盖。

**A-D1a（设计缺陷，仍阻断）**。确认后、打开结算前的返回语义缺失。用户返回时 Canvas 仍可能保持当前有效，旧流程可在异步创建、投影或 `open` 结算后抢焦点，或者与销毁竞态。返回应撤销自动激活，但保全已经接受的原创建意图。已发出 `open` 时应加入其结果并安全关闭再销毁。需要针对 create、projection 和 open 分别阻塞的用例，覆盖重复返回。原结论为 Changes Requested，仅余该项。

## 第三轮 · Approved

受审阶段 A SHA-256 `EE46E806F71161F0212946F0CCFE1E78E7BF87319D2F545D2B0EBC59E52397D7`。阶段 A 第 17、22 行明确了返回或授权锁定同步撤销激活、耐久意图收敛、未发出 open 时跳过、已发出时等待并安全关闭、以及重复返回合并和分段验收。A-D1a 已关闭，A-D1 至 A-D5 在该设计版本均关闭。

结论为 **Approved，限上述阶段 A 设计版本**。此轮未审查源码实施或运行结果。
