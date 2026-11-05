import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { MoveTool } from '../../src/tools/moveTool';
import type { ToolHost, ToolPointer } from '../../src/tools/tool';
import { DocumentSession } from '../../src/app/session';
import { editor } from '../../src/app/editor';
import { add, newDoc } from '../helpers/build';
import { createPixelLayer } from '../../src/document/layerFactory';
import { compositeRegion } from '../../src/rendering/compositor';
import { TiledRaster } from '../../src/image-engine/tiledRaster';

// Oracle captured from MoveTool at a6599003, before the experimental implementation.
it('C2 old-path raster and selection reference', () => {
  const w = 24, h = 16, doc = newDoc(w, h);
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    pixels[i] = (x * 37 + y * 11) % 256; pixels[i + 1] = (x * 7 + y * 29) % 256;
    pixels[i + 2] = (x * 13 + y * 19) % 256; pixels[i + 3] = [0, 64, 128, 255][(x + y) % 4];
  }
  const layer = createPixelLayer('C2', 8, TiledRaster.fromPixels(w, h, 4, 8, pixels));
  add(doc, layer);
  const s = new DocumentSession(doc); s.setActive(layer.id);
  const host: ToolHost = { editor, session: s, redraw() {}, setCursor() {}, viewportSize: () => ({ w: 200, h: 100 }) };
  const cov = new Float32Array(8 * 6);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) cov[y * 8 + x] = x === 0 || y === 0 || x === 7 || y === 5 ? 0.5 : 1;
  doc.selection.combine({ x: 2, y: 2, w: 8, h: 6 }, cov, 'replace');
  const pt = (x: number, y: number): ToolPointer => ({ x, y, sx: x, sy: y, pressure: 1, tiltX: 0, tiltY: 0, twist: 0, button: 0, buttons: 1, shift: false, alt: false, mod: false, pointerType: 'mouse', time: 0, clickCount: 1 });
  const t = new MoveTool(); t.down(host, pt(4, 4)); t.move(host, pt(10, 7)); t.up(host);
  const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const raster = layer.raster.readPixels({ x: 0, y: 0, w, h });
  const mask = doc.selection.mask.readPixels({ x: 0, y: 0, w, h });
  const composite = compositeRegion(doc, { x: 0, y: 0, w, h }, { level: 0 });
  const digest = [hash(new Uint8Array(raster.buffer, raster.byteOffset, raster.byteLength)), hash(new Uint8Array(mask.buffer, mask.byteOffset, mask.byteLength)), hash(new Uint8Array(composite.buffer, composite.byteOffset, composite.byteLength))];
  expect(digest).toEqual(['2b25e8a12a305e931b99d7b8cf73ff9cad4fea5570a3deb6562aa3f910256c85', 'bcb886f547c4855c500d0c01f1c94fcc58d361bd860fae4a091f116b3bdcd0da', '55d7d6b246aa6247c6f83c61d7ac286871039063f72698c65ba1e10339ba559a']);
  s.dispose();
});
