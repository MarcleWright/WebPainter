// Frozen from b01dcb79922279744de987d7fce1c4a2454f2390, RGB/RGBA oracle only.
import {TiledRaster} from './tiledRaster';
import {affineToHomography,invertH,type Homography} from './matrix';
import {roundOut,intersect,isEmpty,type Rect} from './rect';
import {warpRaster,type Interpolation} from './resample';
const rasterContentBounds=(r:TiledRaster)=>r.contentBounds();
export function warpLayerRaster(raster: TiledRaster, ox: number, oy: number, H: Homography, interp: Interpolation, clip?: Rect, bounds?: Rect | null): { raster: TiledRaster; x: number; y: number } {
  const b = bounds !== undefined ? bounds : rasterContentBounds(raster);
  const out = new TiledRaster(raster.channels, raster.depth, raster.fill);
  // CMYK: the K plate is resampled with plate 0's bounds so both land at the same origin.
  if (raster.companion) out.companion = b ? warpLayerRaster(raster.companion, ox, oy, H, interp, clip, b).raster : new TiledRaster(4, raster.depth, raster.fill);
  if (!b) return { raster: out, x: 0, y: 0 };
  const docB = { x: b.x + ox, y: b.y + oy, w: b.w, h: b.h };
  const pts = [[docB.x, docB.y], [docB.x + docB.w, docB.y], [docB.x + docB.w, docB.y + docB.h], [docB.x, docB.y + docB.h]].map(([x, y]) => {
    const w = H[6] * x + H[7] * y + H[8];
    return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
  });
  let nb = roundOut(Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y)));
  if (clip) nb = intersect(nb, clip);
  if (isEmpty(nb)) return { raster: out, x: 0, y: 0 };
  // Inverse: new document → old document → raster local.
  const inv = invertH(H);
  const toLocal: Homography = [inv[0] - ox * inv[6], inv[1] - ox * inv[7], inv[2] - ox * inv[8], inv[3] - oy * inv[6], inv[4] - oy * inv[7], inv[5] - oy * inv[8], inv[6], inv[7], inv[8]];
  if (raster.channels === 4) {
    const TS = 1024;
    for (let y = nb.y; y < nb.y + nb.h; y += TS)
      for (let x = nb.x; x < nb.x + nb.w; x += TS) {
        const r = { x, y, w: Math.min(TS, nb.x + nb.w - x), h: Math.min(TS, nb.y + nb.h - y) };
        const px = warpRaster(raster, b, toLocal, r, interp);
        out.writeFloat({ x: r.x - nb.x, y: r.y - nb.y, w: r.w, h: r.h }, px);
      }
    out.compact();
    return { raster: out, x: nb.x, y: nb.y };
  }
  // Single channel (masks): expand to RGBA with value in R and full alpha.
  const tmp = new TiledRaster(4, 32, 0);
  const vals = raster.readFloat(b);
  const rgba = new Float32Array(b.w * b.h * 4);
  for (let i = 0; i < vals.length; i++) { rgba[i * 4] = vals[i]; rgba[i * 4 + 3] = 1; }
  tmp.writeFloat(b, rgba);
  const px = warpRaster(tmp, b, toLocal, nb, interp);
  const m = new Float32Array(nb.w * nb.h);
  const f = raster.fill;
  for (let i = 0; i < m.length; i++) m[i] = f + (px[i * 4] - f) * px[i * 4 + 3];
  out.writeFloat({ x: 0, y: 0, w: nb.w, h: nb.h }, m);
  out.compact();
  return { raster: out, x: nb.x, y: nb.y };
}
