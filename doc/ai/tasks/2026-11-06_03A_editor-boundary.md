# Task 03A: 编辑边界与共用宿主端口

## Status

Implemented / 2026-11-06 本轮 Owner 授权下完成隔离实现，待独立代码 review 与未覆盖人工验收。父任务 [03](2026-11-06_03_ada-integration-architecture.md); 约束见 [集成架构](../../architecture/ADA_INTEGRATION.md)。03B 未实施。

## Task Brief And Goal

将独立桌面启动与嵌入编辑生命周期分开, 保留现有内核。让 A 直接挂载和 B iframe 使用相同的会话/输出合同, 后续不必各实现一套保存、生成和关闭逻辑。

## Branch Scope

主要实现于获授权后建立的 `integration/embedded`, 独立 `main` 不自动变成嵌入 SDK。若发现共享 bug/通用清理, 单独在 main 验证后合入; 03A 不能要求把整个 embedded 合回 main。分支与更新规则见 [父任务](2026-11-06_03_ada-integration-architecture.md#branch-and-repository-ownership)。

## Evidence And Owners

源码入口: `src/main.tsx`, `src/app/editor.ts`, `session.ts`, `fileOps.ts`, `platform/platform.ts`, `src/ui/App.tsx`。当前启动安装全局动作/恢复/更新/窗口事件, 不等于已有可销毁 SDK。复用 Session 与现有保存保护, 不复制 History。

## Change Contract

- 确认并记录首版工具和 native 可恢复属性清单, 对照真实代码核实钢笔转选区、Ctrl+T 与 Layer via Copy。Ctrl+J 若纳入首版, 本任务只指定真实命令及后续 03D 修复范围, 不将已知问题记作通过。
- 建立最小 embedded 初始化/打开/请求关闭/销毁及宿主端口类型。明确编辑器命令与宿主回调; 不用任意执行字符串通道。open/save/read resource/export/capture composite/dirty/error DTO 独立于 React/Window/Electron 和 ADA 包。
- WP 只捕获 session generation、操作身份和 opaque host binding/token; 不解释 Profile/Project/Artifact/Results。ADA adapter 负责实际身份/epoch/权限/revision 校验。操作均异步成功/失败, 端口不是 GPU 纹理接口, 热路径不调用宿主。
- 复用稳定检查点取得与会话输出保护。保存/生成确认有效临时操作; 关闭按原语义先取消未确认 Move, 再处理保存/放弃/取消。不在宿主另建像素或历史副本。
- 嵌入模式不注册独立更新器/窗口退出/文件启动/恢复调度, 通过宿主服务接入; 独立桌面模式照常运行。采用简单能力清单, 菜单/快捷键/调用入口一致, 不建设 SDK 插件系统。
- 现有 singleton/global listeners 先清点; 至少保证一个活动编辑实例可销毁后重开, 不重复注册。A 的 DOM/root/CSS、B 的握手和消息校验留到 03C。

## Failure And Lifecycle

销毁使旧会话回调失效并解除监听, 不卸载整个 ADA; 未保存时只允许通过关闭合同销毁。输出失败保留 dirty 与重试可能, 释放自身保护。只对自有操作做完成/取消检查, 不引入全局调度器。03A 的隔离宿主可用受控 I/O, 不宣称已经接入平台。

## Acceptance And Validation

- 用真实 DocumentSession/History 执行打开、编辑、稳定捕获、失败重试和关闭 Cancel; 重复初始化/销毁/重开不重复事件。
- 延迟保存期间切换/销毁后旧回执不能标新文档 clean; 输出后撤销语义不变。
- 独立正常入口仍能启动、绘画和输出, embedded boot 不启动独立服务。
- main 与 embedded 各自构建/独立入口的必要回归有对应版本证据; 编译或依赖检查确认 main 不依赖 embedded 文件, WP 通用端口不导入 ADA contracts/API。独立本地文件行为不能被注入宿主的默认值覆盖。
- P-BUILD、P-MOVE、现有 moveOutput/保存生命周期相关测试及上述新增生命周期风险检查。人工首次验证归 03C, 不以类型检查替代。

## Execution Report

本轮从 main `ef3eea87beb00b2c79c6f1e4902e4a5739ef8557` 创建 `integration/embedded`；保留原规划 dirty，未提交/推送/合并。API、首版工具核对、03B native 属性输入及 singleton 清点归 [Embedded Port v1](../../architecture/EMBEDDED_PORT_V1.md)。

- 新增 `src/embedded/contract.ts`、`editor.ts`；03C 的 root/frame/消息适配复用该会话，没有复制 History 或 renderer。host DTO 无 ADA/React/Window/Electron import。
- 原 `Platform` 增可逆安装 seam；原 editor 的 title/dirty 不再跨异步 import 延迟落到已恢复的 Platform，增加仅关闭后可释放 tool instances 的入口；字体 installer 可解除。原 standalone 默认 I/O 不变。
- A 所需 CSS/portal/key surface seam 在 integration 分支中实现，均有 standalone 默认值；未向 main 反向合并，也未做通用功能/算法修复。需要上游化时单独整理，不得整体合并 embedded。
- 保存仍经过原 `fileOps.save` / `outputPending` / editProtected / stable snapshot；关闭仍经过原 `closeSession`。`psd-test` 是受控测试输出，不是 native 或正式平台保存；captureComposite 不代表已产生 Artifact/生成请求。
- 延迟读取后销毁/重建拒绝旧结果；延迟保存期间关闭等待，禁止换作品/销毁，旧回执不会标新文档 clean。host dirty 异常不阻断编辑；写失败保留 dirty 与重试。
- 增补回归先复现 tool 实例保留、dirty observer 抛异常及每次像素通知调用宿主，再修复验证；状态不变的 100 次像素通知不调用宿主，防止绘画热路径走 RPC。无跨实例调度器。

### Validation Results

| 检查 | 本轮结果 |
| --- | --- |
| `vitest run tests/engine/embeddedLifecycle.test.ts tests/engine/embeddedRpc.test.ts tests/engine/moveSelection.test.ts tests/gpu/moveOutput.test.ts` | **36/36**；其中生命周期 7、RPC 2、既有 Move/输出 27 |
| integration standalone `npm run build` | 通过；含 typecheck/renderer/Electron；未增加依赖或更改 lockfile |
| `node scripts/build-embedded.mjs` | 通过；端口 v1，nativeVersion=null；固定文件 manifest 和 SHA256，详见 03C |
| main 固定 HEAD archive 中 `npm run build` | 通过；与工作分支输出分开；main 没有 embedded 模块依赖 |
| main 原生独立入口 `CELENNE_SMOKE=1` + 同一 4K PSD | 可见窗口通过：bridge=true、nodeExposed=false、3 层、WebGPU、errors=[]；独立临时 userData/temp |
| standalone/嵌入实窗 | 03C 的相同内核对照通过有限鼠标/输出/快捷键/关闭重开场景；不是完整设备验收 |

原始构建记录位于本地 `doc/material/03c-main-build.log`、`03c-standalone-build.log`、`03c-build.log`；main smoke 图在 `doc/material/03c-main-smoke/main.png`。不将材料加入上游 docs。

### Reviewer Notes / Unaccepted

本段为实施自查，不是独立 Approved。既有保存/关闭前置任务仍按其独立 review/人工状态管理，本轮自动回归没有替代该验收。真实手绘板、IME、全部工具、完全断网、PSD/Photoshop 往返、正式 native/CAS/恢复及生成未验收。当前试验 UI 不是首版发布工具裁剪，Ctrl+J 缺口仍在。正式部署前必须收口；本轮只交付隔离边界与有限承载验证。
