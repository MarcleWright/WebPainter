/** Synchronous, per-input-batch optimization of the ordinary RGBA8 Normal PaintOp. */
import { StrokeOp } from './paintOps';
import type { StrokeContext } from './paintOps';
import type { Dab } from './engine';
import { U8_TO_FLOAT } from '../image-engine/pixels';
import { tileRange, TILE_SIZE, TiledRaster } from '../image-engine/tiledRaster';
import { blendStraightPixel } from '../image-engine/blend';
import { union, type Rect } from '../image-engine/rect';
import type { RGB } from '../color/types';

const MAX_PIXELS = 1 << 20;
export class BatchedPaintOp extends StrokeOp {
  private stroke = new TiledRaster(1, 32);
  private coverage = new Float32Array(0);
  private original = new Float32Array(0);
  private output = new Float32Array(0);
  private merged = new Float32Array(0);
  private touched = new Uint8Array(0);
  private rects: Rect[] = [];
  private pending: Rect | null = null;
  private opacity = 1;
  private batching = false;
  constructor(ctx: StrokeContext, private color: RGB, private erase: boolean) { super(ctx); }
  beginBatch(): void { this.batching = true; }
  endBatch(): void { try { this.flush(); } finally { this.batching = false; } }
  private mix(out: Float32Array, i: number, amount: number): void {
    if (!(amount > 0)) return;
    if (this.erase) out[i + 3] *= 1 - amount;
    else blendStraightPixel('normal', out, i, this.color.r, this.color.g, this.color.b, amount, false);
  }
  protected dab(d: Dab, cov: Float32Array, r: Rect): void {
    const lr = this.local(r), n = lr.w * lr.h;
    // Bound every retained work buffer by a fixed maximum, not the number of input samples.
    if (n > MAX_PIXELS) throw new Error('Batched brush region exceeds its supported size');
    const next = union(this.pending, lr)!;
    // Different opacity must not be applied retroactively to a previous dab rectangle.
    if (this.pending && (d.opacity !== this.opacity || next.w * next.h > MAX_PIXELS || this.rects.length >= 128)) this.flush();
    if (this.coverage.length < n) this.coverage = new Float32Array(n);
    const S = this.stroke.readFloat(lr, 0, this.coverage);
    for (let i = 0; i < n; i++) { const c = cov[i] * d.flow; if (c > 0) S[i] = S[i] + (1 - S[i]) * c; }
    this.stroke.writeFloat(lr, S); // preserve per-dab Float32 rounding, even inside a batch
    if (this.batching) { this.pending = union(this.pending, lr); this.rects.push(lr); this.opacity = d.opacity; return; }
    if (this.erase) { this.writeErase(lr, S, d.opacity); return; }
    if (this.original.length < n * 4) this.original = new Float32Array(n * 4);
    const out = this.ctx.original.readFloat(lr, 0, this.original);
    for (let i = 0; i < n; i++) this.mix(out, i * 4, S[i] * d.opacity);
    this.ctx.target.raster.writeFloat(lr, out);
  }
  private writeErase(r: Rect, S: Float32Array, opacity: number, touched?: Uint8Array): void {
    const {tx0, ty0, tx1, ty1} = tileRange(r), ts = TILE_SIZE;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const src = this.ctx.original.getTile(tx, ty)?.data;
      const dst = this.ctx.target.raster.writableTile(tx, ty).data;
      for (let y = Math.max(r.y, ty * ts); y < Math.min(r.y + r.h, (ty + 1) * ts); y++) {
        for (let x = Math.max(r.x, tx * ts); x < Math.min(r.x + r.w, (tx + 1) * ts); x++) {
          const i = (y - r.y) * r.w + x - r.x;
          if (touched && !touched[i]) continue;
          const j = ((y - ty * ts) * ts + x - tx * ts) * 4 + 3, a = src?.[j] ?? 0, e = S[i] * opacity;
          // The old path rounds in Float32 before RGBA8 quantization. RGB is unchanged by erasing.
          dst[j] = e > 0 ? Math.fround(U8_TO_FLOAT[a] * (1 - e)) * 255 : a;
        }
      }
    }
  }
  private flush(): void {
    const r = this.pending; if (!r) return;
    const n = r.w * r.h;
    if (this.merged.length < n) this.merged = new Float32Array(n);
    if (this.touched.length < n) this.touched = new Uint8Array(n);
    const S = this.stroke.readFloat(r, 0, this.merged);
    this.touched.fill(0, 0, n);
    for (const q of this.rects) for (let y = q.y; y < q.y + q.h; y++) {
      const at = (y - r.y) * r.w + q.x - r.x; this.touched.fill(1, at, at + q.w);
    }
    if (this.erase) this.writeErase(r, S, this.opacity, this.touched);
    else {
      if (this.original.length < n * 4) this.original = new Float32Array(n * 4);
      if (this.output.length < n * 4) this.output = new Float32Array(n * 4);
      const original = this.ctx.original.readFloat(r, 0, this.original);
      const out = this.ctx.target.raster.readFloat(r, 0, this.output);
      for (let i = 0; i < n; i++) if (this.touched[i]) {
        this.mix(original, i * 4, S[i] * this.opacity);
        for (let c = 0; c < 4; c++) out[i * 4 + c] = original[i * 4 + c];
      }
      // Gaps retain the live target: a union must not reapply a new opacity to old stroke pixels.
      this.ctx.target.raster.writeFloat(r, out);
    }
    this.pending = null; this.rects = [];
  }
}
