# 03B main 通用 Native Codec

2026-11-06 Owner 授权；main 从 `ef3eea87beb00b2c79c6f1e4902e4a5739ef8557` 在隔离 `WebPainter_main_native` worktree 开发，原 `integration/embedded` 的 reviewer 文档交接已由该分支单独提交，不反向合入 main。无 ADA/embedded/桌面依赖，既有 PSD/恢复默认行为不变。

实现、格式和精确支持/拒绝边界归 [Native v1](../../engineering/NATIVE_FORMAT.md)。稳定文档ID由构造参数恢复，snapshot保留内容身份；native使用显式manifest与checksummed raw blocks。支持属性/半透明像素、蒙版、常规文字/appearance、路径与有限调整，未知版本/类型/字段/索引/损坏拒绝，不改当前session。通用 `createNative`/`inspectNative` 供宿主使用同一格式验证，inspect不分配raster副本；宿主业务身份/权限不由codec解释。

## 本阶段实际检查

- 首轮native 17项+core/regressions/GPU moveOutput组合 **75/75**，保留真实保存/关闭/恢复输出保护回归。追加通用create/inspect后 native **18/18** 与typecheck通过。
- `npm run build` 的类型/renderer/Electron通过，保留既有WASM/Node外部模块警告。
- 确定性4096² RGB8、6层、非均匀半透明参考/局部手绘/蒙版/文字/curves：输出 **71,388,421 bytes**；同步CPU encode **1004.44ms** / decode **445.20ms**，270个像素tiles逐字节相同。进程生命周期maxRSS **327,868KiB**，包含启动/fixture，不是codec独占峰值或GPU/窗口延迟；脚本 `scripts/native-codec-probe.ts` 可复现。
- 小fixture全量合成像素、字段/ID/二进制再编码一致；实际DocumentSession命令编辑/undo/redo/重存通过；缺字体返回requiredFonts及已知missingFonts告警，未证明跨机器字体外观。

主线阶段提交后单向合入embedded，端口/固定包与ADA配套另记。此阶段不是正式ADA保存、完整工具/格式、Photoshop/手绘板/人工或发布验收。本地提交不推送。
