# Task 03B: 共用原生图层文档 Codec

## Status

2026-11-06 当前实施：Owner 已授权 B→D→E→F 连续执行。通用codec已在main `6cf7d0738361b941c985d4fd0fcc9176ce500628` 实施并通过阶段检查，单向合入embedded `eb4e4a07efa2994ccbdf379d76e434031453054f`；main不依赖embedded/ADA。reviewer的iframe交接文档先原样提交 `168da86`，合入只解决context/log冲突并保留双方记录。详见[main执行证据](2026-11-06_03B_native-codec.md)及[精确格式/支持边界](../../engineering/NATIVE_FORMAT.md)。下方 Planned 为历史状态。

embedded增加通用 nativeVersion=1 宿主能力、受保护 native+PNG 检查点、read-only恢复捕获、saveAndCapture、带通用来源id/hash的图片加层及PSD导出；核心closeSession保留关闭队列，通过宿主保存门接通native，不另建关闭队列。端口显式升级v2，拒绝旧协议包；实验host未声明native仍保留旧PSD-test路径。新增纯codec构建入口供宿主消费同一格式而非复制解析内核。

本阶段实际 native/embedded/native生命周期/RPC **33/33** 与typecheck通过。main既有阶段75项组合及18项native、构建、6层4K的原范围保留。下一步提交此端口后从干净commit重建固定包，配套hash和ADA消费检查后续补记；阶段提交不等于正式产品/人工验收。

Planned / 待审查及实施授权。依赖 [03A](2026-11-06_03A_editor-boundary.md) 首版数据合同, 与承载 A/B 无关。父任务 [03](2026-11-06_03_ada-integration-architecture.md)。

## Task Brief And Evidence

现有 PSD/PSB 文件与恢复不能直接表达已规划的 ADA 图层文档和来源关系。新增有限 native codec, 保存后能继续编辑同一作品, 不以合成图或 TS 对象直接 JSON 化代替。

源码 owner: `src/document/types.ts`, `document.ts`, `clone.ts`, `src/image-engine/tiledRaster.ts`, `src/typography`, `src/vector`, `src/adjustments`。包容器/编码在本任务开工前固定到任务报告, 不建设永久内容寻址或版本仓库。

## Branch Scope

通用 codec 在 WP main 实现, 不导入 03A 的 embedded 模块。03A 提供的数据清单是规格依赖, 不是代码/分支依赖。main 上的 codec 可独立构建与测试, 不改变既有 PSD 默认打开/保存/恢复; 本任务不强制新增完整 native 文件菜单。之后把 main 合入 embedded 接通端口, 分别记录 commit 并重跑受影响检查。ADA 的 Artifact 身份/引用/权限映射留 03D。

## Change Contract

- 使用 schemaVersion=1 的受支持 manifest 和二进制数据, 覆盖 03A 清单: 画布/色彩、稳定图层 ID/顺序/属性、像素/蒙版、文字/字体信息、路径及调整参数。通用资源描述保留来源标识/内容 hash 和必要内嵌像素; ADA 映射与受约束来源扩展由 adapter 校验, codec 不解释平台权限。不让外部源更新悄悄改变作品。
- history/GPU/cache/平台凭证不进入载荷; 重开重建运行时。文档身份、内部 schemaVersion、平台保存 revision 分开。
- 稳定捕获在编码前完成, 不边读取活跃 mutable tiles 边写出。编码器不直接调用 ADA 或 Electron, 输出可由函数或消息适配器交付的独立二进制数据。
- 拒绝不支持的版本、图层和非法块/尺寸/索引, 加入实际输入边界限制; 失败不得清空当前会话。不是通过静默丢字段来通过往返。
- PSD 导出继续使用现有管线, native 不以 PSD 为唯一事实载荷。无历史版本管理或跨重启 undo。

## Acceptance And Validation

- 真实模型创建含图像、手绘、文字、路径、蒙版和非默认调整的作品; encode -> decode 后比较支持字段、像素/coverage 与原合成, 再编辑/撤销/重存证明可编辑。
- 透明/半透明小 fixture 全量像素对比; 非均匀 4K 代表作记录大小、编码/解码耗时和内存峰值, 不建 benchmark 平台。
- 缺块、截断、未知版本和未支持类型明确拒绝, 原会话仍可用; 字体不可用明确提示或使用已约定回退, 不假装外观一致。
- 聚焦 codec 测试 + P-BUILD。无平台 CAS 测试, 无需等待 A/B 选择。真实 Photoshop 验收归 03F。
- main 独立入口既有 PSD 保存/恢复回归; main 合入 embedded 后检查 codec/端口兼容, 不用 main 测试代替嵌入包检查。未知新版本拒绝加载且不改写文件, 不自动降级。

## Execution Report

未执行。输出精确受支持属性清单与包格式、已知损失及测量限制; 不将小图往返当 4K 验收。

03D 端口补强：保存时同时核对 doc.rev 与历史检查点；迟到原生回执不能把未入历史的较新变更标 clean。先复现 1 failed/7 passed，修复后端口三文件17/17及类型通过。dirty 通知增加稳定 history checkpoint，用于宿主恢复候选去重，不逐像素上报。
