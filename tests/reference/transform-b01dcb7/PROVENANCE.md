# Frozen transform oracle

Source: b01dcb79922279744de987d7fce1c4a2454f2390, captured before implementation on 2026-11-12.

resample.ts, matrix.ts, tiledRaster.ts, pixels.ts and rect.ts are verbatim independent copies of src/image-engine. warpLayerRaster.ts retains the original function body from src/app/ops/imageOps.ts with imports redirected to these copies and rasterContentBounds mapped to contentBounds for these RGBA raster fixtures. No application source imports are permitted here. This freezes sampling, mapping, mip generation, Float32 writes, quantization, logical partitions, output geometry and compaction independently of the candidate.

SHA-256 at capture:

- matrix.ts: `1f789987a05947e59ef14440e887f717cd0306e3910e7539cf73e2a82eb65ca1`
- pixels.ts: `f53cea401b3462cf6011af873e003b215eb42e12928909084bb913aa175e911d`
- rect.ts: `cbe276ef8c5808ba9ed03fc629298757b6d9fdb231307b094359234563da5ac2`
- resample.ts: `a3ddbcbfcfc01b49e80ae0e9344acfe18bc4051d1c234f731729ce78c0d69c78`
- tiledRaster.ts: `4859bdff536d9b86b04bbecf3199c7206dab3b505e484a3d8c0dabddad14c0d0`
- warpLayerRaster.ts: `b6cf989dba5a348536c22f27db2405a790a87cb4dd88632eb594e71c255f256a`
