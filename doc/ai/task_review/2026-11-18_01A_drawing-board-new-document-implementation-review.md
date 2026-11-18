# A · 在 WP 内新建 ADA 画板实现审查

Reviewer 为本任务独立审查代理 `/root/review_a`。结论按各工作树和实际候选分别绑定。

[阶段 A 任务](../tasks/2026-11-18_01A_drawing-board-new-document.md) · [阶段 A 设计审查](2026-11-18_01A_drawing-board-new-document-design-review.md)

## WP main · Approved

基线 `b7bcedfb41e186627d431b8745fb40cefa781c9c`。受审文件内容 SHA-256 如下。

| 文件 | SHA-256 |
| --- | --- |
| `src/ui/controls.tsx` | `AF59211C709DD9EA3F5142F460BA5C23FC63D88846F77976129F8605456B8687` |
| `src/ui/dialogs/Modal.tsx` | `01C32FDD015B9D465526B5C6ADABCE8248A1A1D60E05464DAF7331106138233E` |
| `src/ui/dialogs/DocumentDialogs.tsx` | `A3EC9B94F6A63E03383B28D169342A89915165FCCED57C1CE86FCA4D5A5102D7` |
| `src/ui/dialogs/NewDocumentSizeFields.tsx` | `FD0A10C14EE0525F7740C7F49557E33120BF37B3487261AF8B4408905D30CA8A` |
| `tests/input/newDocumentSize.test.tsx` | `0EDA82B75792FBF569DB71CA0450492CF3C5F7E11C1ED778AF4AA911AD713B7D` |

检查了新建对话框、Modal 键盘及焦点、调用方和本地 `newDocument` 链路。独立版沿用印刷预设、单位、位深、配置及本地文档所有权。宿主只使用合法像素宽高，输入不裁剪，创建交给回调，取消不创建本地文档。独立复跑 P-TYPE 与 `newDocumentSize.test.tsx` 3/3，范围内 diff 检查通过。结论为 **Approved，限共用 UI 代码**。

## WP embedded · Approved

基线 `ab5cee88af5a59e748a1fd01ad142643266fa274`。受审路径为 `src/embedded/client.ts`、`src/embedded/contract.ts`、`src/embedded/mount.tsx` 和 `tests/engine/embeddedMount.test.tsx`。范围内 binary diff SHA-256 为 `e9a879459cab1a6563fe11842dcc704b89e5054d4c42e5041081e5c5aef2a1f6`。

选择器以新增能力接入 `mountPage`。检查了保留的 direct、旧 iframe port v4、本地动作禁用、空态挂载、同 ID 已撤销回执、双确认，以及打开与销毁并发。独立复跑嵌入 React root 的 jsdom 用例 5/5。结论为 **Approved，限嵌入选择器实现**。普通安装客户端、浏览器首帧、ADA 跨端消息和持久化由独立证据覆盖。

## ADA 第一轮 · Changes Requested

基线 `18bf864f1516c532dab6a153b0d823af7f15acd1`。受审源文件 seal SHA-256 为 `2408D95E508FB455BF68E082437380D88C275422ADAFBEA1030A956D70301A98`，包含 15 个文件及两份固定包指针，指向 embedded `a827136` / bundle `993c936b…`。核对了作用域票据、选择和持久化阶段、同 iframe 打开、创建／投影同 ID 重试，以及成对 RPC 的 nonce、选择 ID 和尺寸检查。

| ID | 归因与影响 | 最小修正 |
| --- | --- | --- |
| A-I1 | 实现遗漏，P2。普通已有画板的 `api.open` 延迟期间授权锁定时，打开成功后的授权分支提前返回。解锁只恢复可见性和保存，生成面板与定时恢复备份从未初始化。 | 记录实际已打开的文档会话，在同 scope 重新授权时完成绑定、面板及恢复定时器初始化，且每个会话只启动一次。 |
| A-I2 | 实现遗漏，P2。重试原 artifact 并遇到打开恢复提示时，授权锁定隐藏提示后调用 `leave`。离开等待正在打开的 promise，提示却需要可见的交互才能结算。实际离开或作用域变化也会等待旧提示。 | 开文档时恢复提示由原打开流程持有，Return、锁定或作用域离开可取消。先保证旧按钮无法丢弃候选，再安全结算并拆除会话。 |

原结论为 **Changes Requested**。此轮未见其余有依据的阻断。

## ADA 第二轮 · Approved

原 seal 中 13 个文件保持一致。仅以下两个文件变化。

| 文件 | SHA-256 |
| --- | --- |
| `apps/web/src/editor/controller.ts` | `3C8F6C83ED10EDC553A24FBBFCD1A760C0C14A80D0FFCEF5F1E60F9420D4FE47` |
| `apps/web/src/editor/new-document-controller.self-test.ts` | `794AB19437AE6DECFE869113D78659872661D8CD9D79C6B04F9A1D5D034AA08A` |

A-I1 由正式已打开绑定和 `resumeOpened` 关闭。验证了延迟打开、锁定、两次解锁后，原会话一次初始化面板并继续自动保存与周期备份。A-I2 由可撤销的打开恢复决策及离开检查关闭。针对 Return、锁定、作用域失效分别阻止迟到的放弃回调，并检查零丢弃、零开窗和退出。独立复跑 `new-document-controller.self-test.ts`、`hybrid-authorization.self-test.ts`、`recovery.self-test.ts`，均通过。

结论为 **Approved，限上述源文件候选和独立复跑范围**。本记录没有审查真实浏览器结果，也没有验收正式 Web、Desktop、真笔或 IME。
