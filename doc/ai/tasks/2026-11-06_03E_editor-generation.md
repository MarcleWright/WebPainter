# Task 03E: 编辑器生成与持久 Results

## Status

Implemented / 本轮已授权实施；有限检查通过，待统一独立 review 与 Owner 验收。依赖 [03D](2026-11-06_03D_ada-document-workflow.md)。父任务 [03](2026-11-06_03_ada-integration-architecture.md), 规则归 [集成架构](../../architecture/ADA_INTEGRATION.md#6-编辑器内生成)。

## Task Brief And Owners

在原 ADA GenerationRuntime/Artifact 发布和交付 owner 内新增 editor-origin, 从当前作品发起生成并把正式结果归入原作品 Results。正式 UI 使用已确认的 iframe 宿主通信, 快照、执行和交付语义不依赖 Direct 实验。

## Branch Scope

本任务的底部悬浮 UI、快照 Artifact、Provider/Results/来源/重试均属于 ADA worktree, WP 只提供通用捕获和加层命令。首版复用 WP UI, ADA 面板位于同一全屏编辑页面底部; 已选 iframe, 面板与 WP 一起在 iframe 内运行, 经宿主 adapter 通信。不要求 WP main 或 embedded 导入 ADA 的生成合同, 不在 vendor 包中直接修改专用 UI。端口扩展在 embedded, 底层通用修复仍先 main。

## Change Contract

- 面板提供提示词、模型选择、生成提交及进度/失败反馈和 Results 查看入口; 不提供 Agent 对话, 不要求打开 Session。沿用 ADA 的模型可用性/参数/准入规则, 选项读取和生成命令通过宿主 adapter 接入既有 owner; 未配置模型只禁用生成, 普通绘画/保存保持可用。03C 的夹具与测试按钮在正式接线中替换, 不混作真实执行结果。
- Results 在编辑空间内查看, 读取 Artifact 经宿主校验原 Profile/Project/作品绑定, 不使用失效的临时 URL 作为持久身份, 不给 WP 暴露平台凭证。选中/预览和“添加到图层”分开; 面板草稿不作为像素文档真源, 不把按键输入当作品图层编辑。
- 面板输入/IME/模型下拉/结果操作不触发画板和后台快捷键, 回到画板恢复绘画; 面板弹出层关闭与作品退出分开。控制底部遮挡并验证窗口缩放下操作可达, 不扩展成重新设计整套编辑器 UI。

- 结束有效临时交互并捕获稳定检查点, 保存 D 到 r, 从同一内容发布不可变图像快照 S, 记录 D/r 与来源。实际 request reference 为 S, 不是只引用最初参考 A。捕获失败不调用 Provider; 无内容变化不另增 D 修订。
- 生成请求捕获 Profile/Project/D/S、操作身份和交付目标, 使用既有 provider adapter/准入/取消/诊断。编辑器不直连模型, 不另建工作队列或自动静默切云端。
- 结果 B 为正式 Artifact, 经原执行与作品关联持久进入 Results, 不自动插层/建 Canvas 节点。Results 不是临时 React 数组或新增资产库; 关闭重开可找回。
- 用户明确添加才读取 B 并通过作品命令新增引用层, undo 移除层而保留 B/Results。候选选择/预览不改文档或保存修订。显式添加到 Canvas 才复用 B 身份投影。
- 发布后交付失败按原执行/B 重试关联, 不重复 Provider 调用。关闭/切作品仍投递原 D; D 删除时保留已发布结果并显示可恢复交付失败, 不自动投递新活动作品。
- 不沿 canvas-origin 先创建节点再隐藏, 不定义 Gallery input/output 分类或快照默认可见性; 不添加 ComfyUI/LLM adapter、Agent 编辑工具或评分收藏。

## Acceptance And Validation

- 在复用 WP UI 的真实编辑页面内, 从底部面板选择模型、输入提示词、提交并查看状态/结果, 再明确添加为图层; 全程无需 Session/Agent 对话。核对实际提交的模型/提示词、Artifact 读取身份和失败反馈, 覆盖提示词输入与画板快捷键切换。03C 受控往返不能替代本任务平台 owner 验证。

- 捕获时有手绘和文字: 验证发送 adapter 的实际图像字节与 S 一致, 来源为正确 D/r; 随后继续编辑不改变 S 或请求。
- 生成中切 D/退出, 完成后重开原 D 可见 B, 新活动作品和 Canvas 均不自动变化。
- 发布成功后关联失败 -> 重试仅补交付, Provider 调用次数不增加; 添加/undo/redo 图层与 Results 引用一致。
- 使用真实平台发布/关联 owner 与受控 provider 验证链路, 不以 UI mock 代替。真实 provider 实测需在执行任务授权范围内另行明确, 未调用如实 Pending。
- ADA contracts/API/web 受影响类型与定向生成/Artifact/交付测试, P-BUILD 和相关编辑命令检查。最终人工生成路径归 03F, 不重跑所有供应商矩阵。

## Execution Report

本轮执行见下。03C 原型证据不追认为正式业务接线；真实/付费 Provider 未调用。


## 2026-11-07 Implementation And Evidence

ADA阶段 ae42e37f 接入原模型配置/GenerationRuntime/Artifact/Results；最终运行代码构建自干净 0b4e1db17ac392468c9a42b1bbd96801c3b2defb。共用同iframe薄面板，Direct仍为03C实验。准确保存回执D/r加PNG发布不可变S，system execution无Canvas目标；B发布事务保存原D/r/S/execution证明，原relation owner完成Results。关闭面板不取消已受理业务，交付失败只补原交付，显式加层可undo/redo且B仍在Results，不自动插层或创建Canvas节点。没有另建业务队列/Artifact库/插件框架。

真实临时SQLite/Artifact/GenerationRuntime/HTTP受控Provider组合及旧生成回归通过，最终受影响API组合57/57；其中drawing owner+client+generation14/14。真正production ASAR/Electron44.9、正式app协议/CSP与Canvas页面跑通六层4096²非均匀RGBA+文字/蒙版/曲线、D/r→S→Provider实际multipart→B/Results→显式加层及退出重开。只读提取实际隔离库核对：D doc-fw7qc-1；S来自r2，图像SHA256 dd79f167db8a56be45ad09982c7cd222f580b98472ffe64102ac97c04f15d133，8,108,529字节，和实际image[]完全一致；Provider调用1。唯一execution为system/succeeded，canvas_id与target_projection_id均null，Canvas仅原drawing节点1个。

S采用既有derived发布枚举描述技术派生，Gallery Input/Output分类、默认可见性与保留政策仍未决定，也未新增过滤/清理规则。真实模型效果/计费/限流及人工输入不是本次受控测试通过项。固定包/实际ADA构建/PSD与离线证据归[03F](2026-11-06_03F_offline-psd-acceptance.md)及ADA统一03BDEF任务。
