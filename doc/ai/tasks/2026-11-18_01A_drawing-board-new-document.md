# A · 在 WP 内新建 ADA 画板

[父任务](2026-11-18_01_drawing-board-workflow-and-open-performance.md) · [执行台账](2026-11-18_01_execution-loop.md)

## 目标与边界

ADA 用户界面改称「画板」。项目画布上的创建入口打开全屏 WP，并在 WP 内选现有常用预设或自定义宽高，初值 1920 × 1080，固定 RGB8，按 ADA 合同接受每轴 1–8192 的整数。确认后由 ADA 保存 artifact、确认原 Canvas 投影、在同一 iframe 打开。已有画板打开照旧。自定义标题、持久化 kind 和旧文档原尺寸保留。「AI 编辑」与从图创建在 B 实施，关闭后复用实例在 C 实施。

## 实施合同

- WP main 让独立版和宿主模式共用像素预设。宿主模式复用 Modal，并过滤不适用预设和印刷字段。宽高为空、非整数或超限时提交禁用，输入不能被悄悄裁到另一个尺寸。独立版的名称、单位、色深、背景与本地新建行为保留。
- Owner 试用发现下拉预设点击时闪烁。宿主新建画板改用平铺的尺寸按钮，矩形按实际比例绘制，分辨率显示在下方。初始值与默认预设一致时高亮该按钮。手工修改任一轴或交换不同的宽高会取消高亮，再次点击尺寸按钮可重新选中。
- embedded 在空文档态明确挂载该 picker，由 composition-facing 的 mountPage 提供一个独立的 `NEW_DOCUMENT_PICKER_VERSION = 1` 附加能力。打开／撤销 picker 是立即完成的操作，确认或取消由一次性回调发出。保持 WP port 4/native 1 和旧独立 iframe/direct 入口兼容，当前 native 白名单及 Ctrl+N 无权创建本地会话。销毁、撤销和提交之间以同一个 picker ID 仲裁，既有文档打开后禁止再拉 picker。
- ADA 的成对 iframe RPC 新增有限 show/cancel/settlement 消息。启动命令只等待 picker 挂载确认。用户选择由控制器本地可取消状态等待。取消、返回、实际离开、授权锁定和启动失败会使该 picker ID 失效，迟到结果不得写入。加入可信的同源／nonce 路径和明确运行时结果校验，WP 包缺少 picker 标记或方法时启用可见失败。Escape 在原生下拉展开时先归下拉处理，关闭后的适当焦点上可取消，Enter 单次确认。
- 开始选择前捕获项目、Canvas ticket 与会话身份。确认时先校验 ID、输入与当前作用域，只有确认后才生成持久化意图。确认尺寸固定到原 artifact／节点 ID。提交或投影及自动打开前复核原作用域。用既有画板 create 和 CanvasCommandPort 投影。重复确认加入原操作。响应不确定和投影失败保存原意图，重试沿用原尺寸及 ID。原 artifact 已提交且开窗失败时只重试打开。跨项目或锁定时禁止迟到结果抢焦点或创建新项目投影。
- 在 picker 状态下无正式文档绑定，生成面板延后到正式文档成功 open 后启动，并绑定实际 owner。保留创建后的既有面板和自动保存行为。返回在选择时可直接取消，在真正文档打开时继续执行保存／关闭合同。

- 确认后的创建、投影或打开仍在途时，返回与授权锁定同步撤销本次自动激活权。已接受的正式创建意图应保留并收敛，必要时以原 ID 重试。返回期间若 open 尚未发出，完成持久化后跳过激活。若 open 已发出，等待打开结论，成功则安全关闭文档后再销毁。重复返回共用同一个离开结果，失败保存继续保留内容。旧流程不能在返回后抢焦点或补开。

## 验收与验证

1. 固定包实窗从 ADA 正常创建入口看到 WP 预设窗口。尺寸选择等待超过普通 RPC 期限的语义用可控时钟验证，真实窗口覆盖按键、焦点、取消及两种非方形尺寸。取消不会创建 artifact、投影或调用模型、读取源图。双击及 Enter 只提交一次。
2. 覆盖非法结构、宽高及旧 picker 消息，授权锁定、项目切换、API 未知结果、投影失败和打开失败。确认后的重试三次校验原 ID、尺寸与投影数量。已有画板走原打开流程。分别阻塞 create、projection、open，触发返回与重复返回，验证原意图和一次收敛以及迟到激活权失效。
3. WP main 跑定向新建对话框／standalone 验证、P-TYPE。embedded 跑定向 mount 与 capability 测试并从 clean commit 构包。ADA 跑 controller、canvas-create、port/输出和类型测试，最后固定包 Web 实窗。真笔、IME、高 DPR 和正式 Desktop 单列。

## 独立设计审查与 Planner 裁定

Reviewer round 1，受审父任务 SHA-256 35A0EADE3B71405B967AFC88A993E1F265C9648C30D91FF2D959764568D714B9，基线 WP main b7bcedf、embedded 5398194、ADA 18bf864f。原结论 Changes Requested。发现 A-D1 选择跨普通 RPC 时限／leave 等待，A-D2 空态无 DialogHost 且 native gate 禁用本地新建，A-D3 迟到作用域和重试，A-D4 空态提前加载模型，A-D5 结果校验和固定包版本。Planner 接受五项，落实到上述合同。第二轮在 SHA-256 6ABDAF2C…3701C 的修订中确认 A-D2–D5 和确认前取消已覆盖，剩余 A-D1a，结论仍为 Changes Requested。Planner 接受并添加确认后返回的收敛规则与分段用例。

[独立设计三轮记录](../task_review/2026-11-18_01A_drawing-board-new-document-design-review.md)

## 执行

独立第三轮复审 Approved，受审设计 SHA-256 EE46E806…397D7。WP main 共用尺寸 UI 独立实现审查通过，原始 base b7bcedf，定向自动检查 76/76 与类型通过。独立重跑定向 3/3 与类型通过。本地 main 提交 714ba91。已同步 embedded ab5cee8。同步解决了两个旧自动保存文档冲突，保留 embedded 原阶段记录与 main 最终验收记录。嵌入适配和 ADA 实现及实窗验证继续。

WP embedded a827136 从干净源码构建 port 4/native 1、picker 1 固定包 993c936b…a608。WP 定向 26/26、类型，独立复跑 5/5。ADA 在首轮实现审查修复 A-I1 授权锁定时已有画板遗漏连续性，以及 A-I2 恢复提示阻断返回。复审 Approved，三组独立控制器测试通过。最终 ADA 提交 56894feb，Web 类型与定向套件正常，Web 构建通过且逐 SHA 核对 dist 的 137 个固定资源。

使用真实 Chrome、隔离 PostgreSQL 与固定包复验。正常 Canvas 入口显示 WP 选择器，默认 1920 × 1080、RGB8。超限与非整数拒绝。Escape 和外层返回分别零写入、零模型目录请求。键盘选择竖版并重复确认，仅建一个投影和一个正式 1080 × 1920 画板，iframe 和 Document 同一。落笔返回提交后，以原节点准确重开保存版本。最终证据在 ADA 独立工作树 `.packaging/drawing-board-stage-a/stage-a-browser-final.json`，开发 Desktop 与正式环境仍待独立验收。

[独立实现审查记录](../task_review/2026-11-18_01A_drawing-board-new-document-implementation-review.md)
