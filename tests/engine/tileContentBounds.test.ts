import { afterEach, expect, it, vi } from 'vitest';
import { TiledRaster, Tile, TILE_SIZE as TS, tileKey, keyToTile, setTilePager } from '../../src/image-engine/tiledRaster';
import { allocPixels, maxValue, type BitDepth } from '../../src/image-engine/pixels';
import { type Rect } from '../../src/image-engine/rect';
import { newDoc, add, solidLayer } from '../helpers/build';
import { DocumentSession } from '../../src/app/session';
import { editRaster } from '../../src/commands/rasterCommands';
import { encodeNative, decodeNative } from '../../src/document/native';
import { PaintOp } from '../../src/brush/paintOps';
import { Selection } from '../../src/selection/selection';

// Independent scalar oracle: no contentBounds, render cache, or cached rectangle is consulted.
function exact(r: TiledRaster): Rect | null {
  const points: number[] = [Infinity, Infinity, -Infinity, -Infinity];
  const fill = r.channels === 4 ? 0 : r.fill * maxValue(r.depth);
  for (const [key, tile] of r.tiles) {
    const [tx, ty] = keyToTile(key), data = tile.data;
    for (let i = 0; i < TS * TS; i++) {
      if (!(Math.abs(data[i * r.channels + (r.channels === 4 ? 3 : 0)] - fill) > (r.depth === 32 ? 1e-6 : .5))) continue;
      const x = tx * TS + i % TS, y = ty * TS + Math.floor(i / TS);
      points[0] = Math.min(points[0], x); points[1] = Math.min(points[1], y);
      points[2] = Math.max(points[2], x); points[3] = Math.max(points[3], y);
    }
  }
  return points[2] < points[0] ? null : { x: points[0], y: points[1], w: points[2] - points[0] + 1, h: points[3] - points[1] + 1 };
}
const check = (r: TiledRaster) => expect(r.contentBounds()).toEqual(exact(r));
function sample(r: TiledRaster, x: number, y: number, value: number) {
  const p = allocPixels(r.depth, r.channels); p[r.channels === 4 ? 3 : 0] = value;
  r.writePixels({ x, y, w: 1, h: 1 }, p);
}
afterEach(() => { vi.restoreAllMocks(); setTilePager(null); });

it.each([8, 16, 32] as BitDepth[])('matches exact samples at %i bits, both channel interpretations and thresholds', depth => {
  for (const ch of [1, 4] as const) {
    const r = new TiledRaster(ch, depth, ch === 1 ? .25 : 0);
    check(r); r.writableTile(0, 0); check(r); // includes allocated empty results
    const m = maxValue(depth); sample(r, -260, -1, m); sample(r, 300, 260, m); check(r); check(r);
    if (ch === 4) { const t = r.writableTile(-2, -1); t.data[0] = m; t.data[3] = 0; check(r); }
    const t = r.writableTile(0, 0), f = ch === 4 ? 0 : r.fill * m, a = ch === 4 ? 3 : 0;
    if (depth === 32) { t.data[a] = f + .9e-6; t.data[a + ch] = f + 1.1e-6; }
    else { t.data[a] = Math.round(f); t.data[a + ch] = Math.round(f) + 1; }
    check(r);
    const dense = new TiledRaster(ch, depth, r.fill); dense.writableTile(-1, 1).data.fill(m); check(dense);
    const b = r.contentBounds()!; b.x = 99999; check(r); // callers cannot mutate cached local rectangles
  }
});
it('reuses 256 tiles, scans only 1/K changed tiles and caches empty results', () => {
  const r = new TiledRaster(4, 8);
  for (let i = 0; i < 256; i++) sample(r, (i % 16) * TS + 4, Math.floor(i / 16) * TS + 8, 255);
  const reads = vi.spyOn(Tile.prototype, 'data', 'get');
  r.contentBounds(); expect(reads).toHaveBeenCalledTimes(256);
  reads.mockClear(); r.contentBounds(); r.contentBounds(); expect(reads.mock.calls.length).toBe(0);
  sample(r, 4, 8, 0); reads.mockClear(); r.contentBounds(); expect(reads).toHaveBeenCalledTimes(1);
  const same = r.getTile(0, 0); sample(r, 4, 8, 255); expect(r.getTile(0, 0)).toBe(same);
  for (const x of [TS + 4, TS * 2 + 4, TS * 3 + 4]) sample(r, x, 8, 0);
  reads.mockClear(); r.contentBounds(); expect(reads).toHaveBeenCalledTimes(4);
  reads.mockClear(); r.contentBounds(); expect(reads.mock.calls.length).toBe(0);
});
it('shrinks/erases, replaces/adds/removes tiles, repositions shared identity, compacts and clears', () => {
  const r = new TiledRaster(4, 8); sample(r, -1, -1, 255); sample(r, 500, 600, 255); check(r);
  sample(r, 500, 600, 0); expect(r.contentBounds()).toEqual({x:-1,y:-1,w:1,h:1});
  r.tiles.set(tileKey(4, 5), r.getTile(-1, -1)!); check(r);
  r.tiles.delete(tileKey(-1, -1)); check(r);
  const empty = new Tile(allocPixels(8, TS * TS * 4), 0); r.tiles.set(tileKey(4, 5), empty); check(r);
  r.writableTile(4, 5).data[3] = 255; check(r); r.writableTile(4, 5).data[3] = 0; check(r);
  r.compact(); expect(r.tiles.size).toBe(0); check(r);
  sample(r, 3, 7, 255); check(r); r.clear(); check(r);
});
it('touch invalidates unknown-range writes without a revision change, fill semantics stay exact', () => {
  const r = new TiledRaster(1, 32, .25), tile = r.writableTile(0, 0), data = tile.data;
  check(r); const rev = tile.rev; data[1] = .75; r.touch(); expect(tile.rev).toBe(rev); check(r);
  r.fill = .75; check(r); r.touch(); check(r);
  sample(r, 2, 3, NaN); sample(r, 5, 6, Infinity); check(r); r.fill = NaN; check(r); check(r); r.clear(1); check(r);
  const s = new Selection(); s.mask.writePixels({x:1,y:2,w:1,h:1}, new Uint8ClampedArray([255])); check(s.mask);
  s.invert(); expect(s.mask.fill).toBe(1); check(s.mask); s.invert(); check(s.mask);
});
it('keeps COW snapshot/restore, independent clones and per-raster touch caches correct', () => {
  const r = new TiledRaster(4, 16); sample(r, 8, 9, 65535); check(r);
  const snap = r.snapshot(), clone = r.clone(); check(clone); sample(r, 8, 9, 0); check(r); check(clone);
  sample(clone, -2, -3, 65535); check(clone); r.restore(snap); check(r);
  const reads = vi.spyOn(Tile.prototype, 'data', 'get'); r.contentBounds(); clone.contentBounds(); reads.mockClear();
  r.touch(); r.contentBounds(); expect(reads).toHaveBeenCalledTimes(1); reads.mockClear(); clone.contentBounds(); expect(reads.mock.calls.length).toBe(0);
});
it('hot paged tiles avoid readSync, cold/invalid reads retry after failure and retain exact results', () => {
  const r = new TiledRaster(4, 8); sample(r, 7, 9, 255); const tile = r.getTile(0, 0)!, bytes = new Uint8Array(tile.data).slice();
  check(r); const readSync = vi.fn(() => bytes); setTilePager({readSync}); tile.evict('isolated');
  expect(r.contentBounds()).toEqual({x:7,y:9,w:1,h:1}); expect(readSync).not.toHaveBeenCalled(); expect(tile.resident).toBe(false);
  r.touch(); check(r); expect(readSync).toHaveBeenCalledTimes(1);
  tile.evict('isolated'); r.touch(); setTilePager({readSync:()=>null}); expect(()=>r.contentBounds()).toThrow(/scratch/); expect(()=>r.contentBounds()).toThrow(/scratch/);
  setTilePager({readSync}); check(r); expect(readSync).toHaveBeenCalledTimes(2);
  const clone = r.clone(); tile.evict('isolated'); check(clone); expect(readSync).toHaveBeenCalledTimes(3);
});
it('real erase/undo/redo and native reopen preserve exact pixels/bounds without serializing the cache', () => {
  const doc = newDoc(300, 40), layer = solidLayer(doc, 'erase', 0, 0, 280, 20, [1, .2, .3, 1]); add(doc, layer);
  const s = new DocumentSession(doc); check(layer.raster); const before = layer.raster.readPixels({x:0,y:0,w:300,h:40});
  const cmd = editRaster(doc, {kind:'layer',layerId:layer.id}, 'Erase edge', r => {
    const erase = new PaintOp({target:{raster:r,x:0,y:0,channels:4},original:r.clone(),selection:null,canvas:doc.bounds,lockAlpha:false}, {r:0,g:0,b:0}, 'normal', true, {r:1,g:1,b:1});
    erase.apply({x:240,y:10,radius:40,angle:0,roundness:1,flow:1,opacity:1,pressure:1}, new Float32Array(80*20).fill(1), {x:200,y:0,w:80,h:20}); return erase.dirty;
  })!;
  s.push(cmd, true); expect(layer.raster.contentBounds()).toEqual({x:0,y:0,w:200,h:20}); check(layer.raster);
  expect(s.history.undo()).toBe(true); expect(layer.raster.readPixels({x:0,y:0,w:300,h:40})).toEqual(before); check(layer.raster);
  expect(s.history.redo()).toBe(true); check(layer.raster); const bytes = encodeNative(doc); layer.raster.contentBounds(); expect(encodeNative(doc)).toEqual(bytes);
  const reopened = decodeNative(bytes).doc.getLayer(layer.id)!; if(reopened.kind !== 'pixel')throw Error('pixel');
  expect(reopened.raster.readPixels({x:0,y:0,w:300,h:40})).toEqual(layer.raster.readPixels({x:0,y:0,w:300,h:40}));
  expect(reopened.raster.contentBounds()).toEqual(layer.raster.contentBounds()); check(reopened.raster); s.dispose();
});
