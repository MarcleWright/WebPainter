# Native Document v1

通用 codec 位于 `src/document/native.ts`，无 embedded/ADA/Electron 依赖，独立 WP 的 PSD 默认保存/恢复不变。输出从同步 COW 文档快照读取，doc/layer/path 身份保留；解码构建新文档，失败不接触当前 session。平台 revision、历史、selection、GPU、缓存、路径和凭证不进入载荷。

## Container And Supported Data

`WPNAT001` 8字节标识 + manifest长度/CRC32/二进制payload长度（3个LE uint32）+ UTF-8 schemaVersion=1 manifest + 顺序原始二进制块。manifest 显式列出 document、layers、rasters 和 block 长度/CRC32；不是直接 JSON 化类实例。无压缩解包/任意路径。CRC用于损坏检测，不是身份认证。

- RGB8，稳定文档ID/name/canvas尺寸/分辨率、RGB profile名称/builtin/ICC/untagged；图层树/顺序/ID/name/visible/opacity/fillOpacity/blend/clipping/位置/locks/colorTag；支持常规默认 advanced blending。
- Pixel/group/text/shape/adjustment/solid fill；稀疏8位RGBA tile与单通道mask fill/像素/位置/enabled/linked/density/feather，vector mask与saved/work/clipping path。
- 常规文字内容、runs/paragraphs/字体样式、transform/box/orientation/AA/firstBaseline与已知PS断行信息，保留文字appearance raster/usingPreservedPixels/missingFonts。返回requiredFonts和已知缺字体告警；codec不伪装字体可用性，不嵌入系统字体。文字warp/path text暂拒绝。
- 非默认curves/levels/brightnessContrast/exposure/vibrance/hueSaturation/colorBalance/blackWhite/photoFilter/channelMixer/invert/posterize/threshold/gradientMap/selectiveColor。colorLookup/LUT暂拒绝。
- guides、metadata、grid/ruler/globalLight；通用JSON custom provenance可保留来源id/hash，像素内嵌，不读取外部源或解释宿主权限。
- shape当前仅solid fill/stroke。effects、advanced blend-if、smartObject/video、独立channels、patterns、slices、PSD原始保留块、深位深/非RGB、未定义字段/种类明确拒绝；不静默扁平化。复用完整UI不表示上述功能可native保存。

边界：文件≤512MiB、manifest≤4MiB、≤256层（含root）/16层树深、≤8192 binary blocks，画布≤16384单边且总像素≤8192²。tile固定256²、坐标-256..255，字节数/索引/引用唯一性/CRC检查；每块被引用一次，不接受孤立、重复、缺失或尾随数据。JSON层数/节点/字符串、非有限数和原型字段受限。schema/native版本不是平台revision；未知版本拒绝，不做降级。

## Verification

`npm exec -- vitest run tests/engine/native.test.ts`：精确半透明小图合成/字段/像素往返、继续编辑/undo/redo/重存、非法输入拒绝、原session保留及独立PSD保存导入。`node scripts/run-ts.mjs scripts/native-codec-probe.ts`：一次确定性6层4K大小/CPU编解码/像素tile/RSS诊断，RSS是进程生命周期最大值而非codec独占或GPU内存。实际结果归本轮任务/context/log；无Photoshop/手绘板验收含义。
