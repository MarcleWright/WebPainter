// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { MoveTool } from '../../src/tools/moveTool';
import type { ToolHost, ToolPointer } from '../../src/tools/tool';
import { editor } from '../../src/app/editor';
import { add, newDoc } from '../helpers/build';
import { createPixelLayer } from '../../src/document/layerFactory';
import { compositeRegion } from '../../src/rendering/compositor';
import { TiledRaster } from '../../src/image-engine/tiledRaster';

// The pre-change product-alpha hash is superseded by the approved min-alpha contract.
// Independent byte-array oracle includes overlap, feathering and transparent pixels.
it('C2 paired min-alpha raster and selection reference', () => {
  const w = 24, h = 16, doc = newDoc(w, h);
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    pixels[i] = (x * 37 + y * 11) % 256; pixels[i + 1] = (x * 7 + y * 29) % 256;
    pixels[i + 2] = (x * 13 + y * 19) % 256; pixels[i + 3] = [0, 64, 128, 255][(x + y) % 4];
  }
  const layer = createPixelLayer('C2', 8, TiledRaster.fromPixels(w, h, 4, 8, pixels));
  add(doc, layer);
  const s = editor.addDocument(doc); s.setActive(layer.id);
  const host: ToolHost = { editor, session: s, redraw() {}, setCursor() {}, viewportSize: () => ({ w: 200, h: 100 }) };
  const cov = new Float32Array(8 * 6);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) cov[y * 8 + x] = x === 0 || y === 0 || x === 7 || y === 5 ? 0.5 : 1;
  doc.selection.combine({ x: 2, y: 2, w: 8, h: 6 }, cov, 'replace');
  const pt = (x: number, y: number): ToolPointer => ({ x, y, sx: x, sy: y, pressure: 1, tiltX: 0, tiltY: 0, twist: 0, button: 0, buttons: 1, shift: false, alt: false, mod: false, pointerType: 'mouse', time: 0, clickCount: 1 });
  const originalCoverage = doc.selection.mask.readFloat({x:2,y:2,w:8,h:6});
  const expected = new Uint8ClampedArray(pixels), mask = new Uint8ClampedArray(w*h);
  // Build the remaining base, then independently place the fragment over it.
  for (let y=0;y<6;y++) for (let x=0;x<8;x++) {
    const i=((y+2)*w+x+2)*4, a=pixels[i+3]/255, f=Math.min(a,originalCoverage[y*8+x]);
    expected[i+3]=Math.round(255*(f===1?0:(a-f)/(1-f)));
  }
  for (let y=0;y<6;y++) for (let x=0;x<8;x++) {
    const i=((y+2)*w+x+2)*4,j=((y+5)*w+x+8)*4;
    const f=Math.min(pixels[i+3]/255,originalCoverage[y*8+x]), b=expected[j+3]/255, a=f+b*(1-f);
    if (f>0) {for(let c=0;c<3;c++) expected[j+c]=Math.round((pixels[i+c]*f+expected[j+c]*b*(1-f))/a);expected[j+3]=Math.round(a*255);}
    mask[(y+5)*w+x+8]=Math.round(f*255);
  }
  const t = new MoveTool(); t.down(host, pt(4, 4)); t.move(host, pt(10, 7)); t.up(host);
  expect(layer.raster.readPixels({x:0,y:0,w,h})).toEqual(expected);
  expect(doc.selection.mask.readPixels({x:0,y:0,w,h})).toEqual(mask);
  const composite = compositeRegion(doc,{x:0,y:0,w,h},{level:0});
  for(let i=0;i<w*h;i++) expect(composite[i*4+3]).toBeCloseTo(expected[i*4+3]/255,5);
  editor.removeSession(s.id);
});
