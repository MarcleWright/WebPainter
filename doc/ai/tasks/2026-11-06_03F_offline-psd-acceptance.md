# Task 03F: 离线、PSD 与首版产品验收

## Status

Planned / 待审查及实施授权。依赖 [03D](2026-11-06_03D_ada-document-workflow.md), 最终完整验收需 [03E](2026-11-06_03E_editor-generation.md)。父任务 [03](2026-11-06_03_ada-integration-architecture.md)。不是发布授权。

## Task Brief And Scope

对已确认的本地 iframe 做有限真实产品验收, 补齐本地资源和 PSD 交换必需接线。只修导致既定首版不能工作的局部缺口, 不扩工具矩阵/格式范围或重做引擎; 发现架构问题回到对应 owner。

## Branch Scope

固定 main 来源/embedded commit/bundle hash/端口与 native 版本/ADA commit, 对真实配套包验收。独立 WP 与 ADA 嵌入是两个交付入口, 不能只验后者。修复按 main 通用、embedded 嵌入、ADA 业务的 owner 回写, 更新包后只重跑受影响检查; 不在包内打补丁。上游 PR 和发布不在当前授权内。

## Change Contract

- 将固定 commit 的编辑器资源随 ADA 打包, 不链接开发目录/服务或运行时下载 GitHub; 清点字体、笔刷、worker/WASM、色彩资源、许可证及原品牌资源。embedded 不携带第二个 Electron 或独立更新服务。
- 在干净 Profile/无在线缓存且阻断公网环境打开 4K 作品, 绘画、文字、选区移动/变换、蒙版/调整、保存重开、恢复、PSD/PNG 导出可完成。AI 未配置时明确不可用而不阻塞编辑。
- 固定非均匀 sRGB RGBA8、约 5-10 层 sketch 和一个透明边缘小 fixture; 使用真实手绘板检查压力/长线/焦点, 25% 和一次 100% 拖动/交接/撤销。沿用既有有限性能口径, 不建设设备矩阵或 FPS 仪表盘。
- 冻结 PSD 属性映射: 哪些层可编辑、哪些明确栅格化、哪些拒绝。复用现有 ag-psd/export, 不重新实现 PSD 库。用目标 Photoshop 打开核对合成画面和承诺的可编辑属性; 未有 Photoshop 环境则此项 Pending, 不以第三方预览器替代。
- 实际打包窗口返回 Canvas/重进、保存时关闭/取消、退出重启与恢复至少各一次。原工作区不丢位置/选择, 编辑器监听/GPU/句柄有正常释放, 不要求量化所有资源。
- WP main 与嵌入分支的独立入口均做有限本地打开/保存/恢复/退出回归, 不接 ADA 也能运行; 证明嵌入改造未替换本地能力。检查 ADA 未改固定包内部代码, 版本记录可定位实际来源; 升级演练证据复用 03D, 不额外做完整版本矩阵。
- 联网并配置允许的 provider 后才验证生成与 Results; 离线可用和 AI 实测分别记录。真实 provider 未授权/未配置则保留待验收, 不发起付费调用来补形式门槛。

## Validation And Delivery

承接 03C 未验收的人工 IME/焦点/压感、真实业务工作区与正式宿主检查, 复用 03D 已有证据并补实际打包窗口验收。原 Inconclusive 不等于需要重新选择 A/B; Direct 无须重复完整产品验收。正式 3D 与未运行 GLB 探针单列后续, 不伪称通过, 不扩进本次二维闭环。

共用 P-DOC/P-BUILD 及前置任务已有定向测试结果; 只在实际修改受影响逻辑后重跑对应项。ADA 使用所选生产包构建与资源审计, 不以 dev 可启动代替离线打包。记录精确源版本/构建、硬件/输入设备、样例/导出、实际通过/失败/Pending 和用户试用, 不把当前源码的后续修改追认到旧包验收。

产出首版验收结论与已知限制, 原始截图/样例在 material 本地材料区。Go 仅限明确验收范围; 发布、安装给用户、推送和正式 3D 不由本任务自动授权。

## Execution Report

未执行。产品可用性、真实模型、Photoshop、离线和打包结论分别列出, 缺失项指定后续 owner。

## Authorized Execution Progress

Owner已授权03B→D→E→F连续实施。ADA03E阶段提交ae42e37f，实际正式Desktop+app协议+同iframe、受控HTTP Provider完整链路已执行，Provider次数1且S图像hash与实际multipart一致；不作真实/付费模型验收。03F开始补资源/独立入口与真正打包。

embedded资源构建新增实际Rollup module归属清单与16份实际依赖许可证（含两版pako），WP原LICENSE/MIT/Apache，以及LibRaw0.22.2源码archive、桥接CPP、许可证/COPYRIGHT/README与构建脚本；包内worker与harfbuzz/lcms/libraw三个WASM保留，无新增字体分发或品牌替换。未直接修改固定vendor包。类型、包构建与端口native/RPC11/11通过后提交构建脚本，随后清洁重建替换ADA并重验；上述是资源清点和技术检查，不替代人工/法律发行验收。
