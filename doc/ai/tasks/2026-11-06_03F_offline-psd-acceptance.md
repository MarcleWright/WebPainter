# Task 03F: 离线、PSD 与首版产品验收

## Status

Implemented / 本轮已授权实施；有限自动、打包实窗与PSD检查完成，待统一 review 和 Owner 人工验收。依赖 [03D](2026-11-06_03D_ada-document-workflow.md), 最终完整验收需 [03E](2026-11-06_03E_editor-generation.md)。父任务 [03](2026-11-06_03_ada-integration-architecture.md)。不是发布授权。

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

有限技术验证见下；真实模型、人工输入和设备体验不由自动检查推定通过。

## Authorized Execution Progress

Owner已授权03B→D→E→F连续实施。ADA03E阶段提交ae42e37f，实际正式Desktop+app协议+同iframe、受控HTTP Provider完整链路已执行，Provider次数1且S图像hash与实际multipart一致；不作真实/付费模型验收。03F开始补资源/独立入口与真正打包。

embedded资源构建新增实际Rollup module归属清单与16份实际依赖许可证（含两版pako），WP原LICENSE/MIT/Apache，以及LibRaw0.22.2源码archive、桥接CPP、许可证/COPYRIGHT/README与构建脚本；包内worker与harfbuzz/lcms/libraw三个WASM保留，无新增字体分发或品牌替换。未直接修改固定vendor包。类型、包构建与端口native/RPC11/11通过后提交构建脚本，随后清洁重建替换ADA并重验；上述是资源清点和技术检查，不替代人工/法律发行验收。


## Final Pair And Finite Acceptance (2026-11-07)

| 配套项 | 实际值 |
| --- | --- |
| WP main / main base | 1b00ef79c3701ba4e65b5a7e12e4d3cca2fd443e（初始main ef3eea87；codec 6cf7d073；只有main→embedded） |
| WP embedded构建源 | efcfd66af386d94e5a8c9bb00f740039d72ef33a，clean；后续仅文档提交不能重标此来源 |
| bundleHash | 1c75b3f5865185f5d2661d5099f2f961df5f1a188dc9f0a556719fbb465b739d |
| sourceHash / versions | 4396ba83911f5da00c3963189eb57645263f40e7cdb91622224de8746ef58a39；port2 / native1 |
| ADA实际生产构建commit | 0b4e1db17ac392468c9a42b1bbd96801c3b2defb，clean；后续测试脚本/文档HEAD另记 |
| 本地测试包 | drawing-4cda1527 / 0.5.4 / Electron44.9.0；ephemeral test signature，无发布或zip/latest更新 |
| app.asar SHA256 | e073734c45b9e504bc3c6508f62bd8f17936e8a0859226512082108499428779 |

实际复用production build/字节码/Sharp/compute staging/Electron Builder、原native完整性launcher与ASAR审计。350项程序审计、3个bytecode目标、3个Sharp解包例外、签名与compute scope、SQLite/Sharp smoke通过。仅固定WP包和正式入口随包，旧实验/旧vendor/项目fixtures不入包。根许可证、16个实际module依赖的license及LibRaw源归属材料随包；同包JS、worker、harfbuzz/lcms/libraw WASM保留，字体来自本机浏览器/OS字体，没有运行时下载WP或复制内核。

Windows10.0.19045 / NVIDIA RTX A5000 driver32.0.15.9636（另有虚拟显示器）；实际窗口WebGPU标签可见。独立temp userData/Profile/DB/作品、无在线缓存，浏览器级阻断公网、仅允许loopback平台/受控Provider；未改CSP响应、未mock保存/引用/发布。正式app协议lcms WASM实际200/application/wasm。实际六层4096²非均匀RGBA、128×96透明边缘小图、文字、像素/蒙版/曲线、选区Move/Ctrl+T、25%与100%视图拖动、保存/重开、受控生成/Results显式加层和undo/redo、PNG/PSD/native下载、注册sidecar后崩溃并重启、显式恢复dirty后保存均执行通过。恢复不覆盖Primary；最终同nativeId/r5、preview ready、sidecar清空。数据/截图在ADA本地忽略材料.packaging/03b-f。不是量化FPS、压力长线或多GPU矩阵。

本轮实窗暴露的两项局部问题已回owner修复、重建：0514a3ee清理显式恢复的旧会话候选（只按原session/hash条件删除，保留并发新候选）；0b4e1db1在ADA页面有限协调前台输出与后台恢复捕获（最多一个前台及合并只读，不积累队列或重试Provider）。原bfa6d64f/0514a3ee测试包的失败或较小场景只保留原范围，不追认为最终包。测试脚本也已修正：等待真实output完成而不是仅clean、正确识别transform mode、重开后不检查旧history，以及可见Canvas命中；探针失败不当产品通过。

WP main及embedded独立入口分别完整build，并在实际Electron44.4.5、各自temp userData/scratch、原app:// main/preload跑过PSD打开/真实写盘保存/重开、dirty原生窗口关闭Cancel保留history、真实autosave文件、renderer crash与原恢复UI、恢复dirty再保存及正常退出。仅原生对话选项受控，没有替换文件/恢复owner。两边errors=[]。最终native/embedded/lifecycle/RPC/selection/move组合70/70、PSD roundtrip/textEngine24/24；main native24/24。没有反向合并或推送。

### Finite PSD Mapping

| 数据 | 当前出口与检查范围 |
| --- | --- |
| RGB8像素、透明度、图层/组、普通混合/不透明度 | ag-psd写可编辑层；native与PSD定向自动检查。此样例Photoshop实际打开6层 |
| 像素蒙版/向量蒙版/路径 | 原mask/vectorMask/path映射；自动往返检查；此PS样例实测两处user mask，路径样例实窗另待人工 |
| 普通文字/样式/transform | 原TySh/Txt2及外观；本例PS仍是TEXT，内容Packaged native text、Arial可读。复杂字体/排版不外推 |
| solid shape / 曲线等支持的调整 | 原vector fill/stroke与adjustmentToPsd；本例PS为CURVES。其它形状/调整实窗不外推 |
| 超出native v1的数据 | effects/高级blend-if、smartObject/video、channels/patterns/slices、非RGB/深位深/未知字段等native明确拒绝，不静默扁平化；完整PSD私有块往返不属于ADA首版承诺 |

Photoshop2026实际27.0.0本地脚本API打开同场景r4导出的116,495,215字节PSD，4096²/RGB8/sRGB、6层、TEXT/CURVES/user masks成立，另存PNG与WP同次导出PNG比较：全67,108,864通道MAE0.00238885/255，最大差2/255，差>3通道0。无保存关闭该测试PSD，恢复原活动文档，既有文档数前后相同。原始PSD/PNG/native与PS渲染只留本地材料。它是有限实际目标软件检查，不是完整PSD往返或人工排版验收。

### Pending / Inconclusive And Reproduction

- Owner/人工IME及焦点：在正式包作品内使用系统中文/日文IME，组合期间按B/Z/Space/Enter，切模型/预览/画板并回退/重开，核对文字与快捷键；自动Composition事件/ASCII输入不替代此项。Owner实际试用仍Pending。
- 手绘板/长线/压感：同4096²六层样例，25%与100%画压力长线、交接/撤销/视图切换；记录实际设备/驱动与体验。缺物理输入证据，性能/手感总体Inconclusive。没有用脚本输入当人工验收。
- 真实/付费Provider：须另获授权、在测试Profile配置获准模型，沿D/r→S→B→Results→显式加层核对效果/错误/计费。不以受控HTTP成功声称真实模型已验收。
- Photoshop人工多语言字体/路径/其它承诺属性：打开本例PSD及有限path小样，检查文字可编辑、外观与蒙版边缘；本次27.0.0脚本检查只覆盖上述样例。完整PSD往返、正式3D/GLB和设备矩阵仍不在本轮范围。
- 正常托盘退出/人工多面板场景：真实Desktop quit Cancel owner已有D阶段实窗；最终包本轮实测work返回/重开与崩溃重启恢复。Owner可在dirty作品时从托盘退出依次试Cancel/Save，再重启，保留原Session/Canvas/Gallery与Profile上下文。自动化不替代这一人工操作验收。

空凭据Profile编辑及非默认Canvas上下文的附加包实窗结论以ADA统一任务最终记录为准；不由上面的旧03C或开发窗口证据推定。完成统一review请求后暂停，等待review与Owner验收；不推送、不发布、不合入ADA main/dev，不再进入新任务。

2026-11-07附加实窗已通过：同一drawing-4cda1527从原native outer launcher正常启动，在另一空凭据temp Profile跑过五层4K、文字/蒙版/调整、选区Move/transform/undo/redo；dirty作品Return→Cancel保持内容/历史，Return→显式Save-close后重开clean。原root对象恢复，进一步用可见Canvas真实中键平移、实际XYFlow节点click选择后重开/返回，translate(-20px,-30px)/scale1及非空选中节点完整保持；空模型只禁用生成，Provider调用0、errors=[]。实际命令ADA scripts/drawing-package-window.mjs <test-package> --unconfigured --launcher；证据packaged-unconfigured.json及packaged-unconfigured-owner-final.log。首轮指针位于Gallery覆盖区、用旧history检查新开的会话等探针失败没有计通过，已修正目标与同步。该附加结果不改人工托盘退出/手绘板/IME验收边界。
