// @vitest-environment jsdom
/**
 * Moving selected pixels with the Move tool: the pixels stay floating between drags (as in
 * Photoshop), so moving them A → B → C leaves a hole only at A, and B shows what it showed before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoveTool } from '../../src/tools/moveTool';
import type { ToolHost, ToolPointer } from '../../src/tools/tool';
import { editor } from '../../src/app/editor';
import { add, newDoc } from '../helpers/build';
import { createPixelLayer } from '../../src/document/layerFactory';
import { TiledRaster } from '../../src/image-engine/tiledRaster';
import type { PixelLayer } from '../../src/document/types';

afterEach(() => {for (const s of [...editor.sessions]) editor.removeSession(s.id);});
const W = 64, H = 24;

/** A layer whose red channel encodes x, so every column is recognisable. */
function setup() {
  const doc = newDoc(W, H);
  const px = new Float32Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; px[i] = x / (W - 1); px[i + 1] = 0.5; px[i + 3] = 1; }
  const r = new TiledRaster(4, 8);
  r.writeFloat({ x: 0, y: 0, w: W, h: H }, px);
  const l = add(doc, createPixelLayer('Layer', 8, r)) as PixelLayer;
  const s = editor.addDocument(doc);
  s.setActive(l.id);
  const h: ToolHost = { editor, session: s, redraw() {}, setCursor() {}, viewportSize: () => ({ w: 200, h: 100 }) };
  // Select an 8 × 8 square at A (x 4–11).
  doc.selection.combine({ x: 4, y: 8, w: 8, h: 8 }, new Float32Array(64).fill(1), 'replace');
  return { doc, s, l, h };
}

const pt = (x: number, y: number): ToolPointer => ({ x, y, sx: x, sy: y, pressure: 1, tiltX: 0, tiltY: 0, twist: 0, button: 0, buttons: 1, shift: false, alt: false, mod: false, pointerType: 'mouse', time: 0, clickCount: 1 });

function drag(t: MoveTool, h: ToolHost, from: [number, number], to: [number, number]) {
  t.down(h, pt(...from));
  for (let k = 1; k <= 4; k++) t.move(h, pt(from[0] + ((to[0] - from[0]) * k) / 4, from[1] + ((to[1] - from[1]) * k) / 4));
  t.up(h);
}

/** Red (column marker) and alpha of a pixel. */
const at = (l: PixelLayer, x: number, y: number) => { const p = l.raster.readFloat({ x, y, w: 1, h: 1 }); return { r: Math.round(p[0] * (W - 1)), a: p[3] }; };

describe('moving selected pixels', () => {
  it('keeps the moved pixels floating: A → B → C leaves a hole only at A', () => {
    const { l, h } = setup();
    const t = new MoveTool();
    drag(t, h, [8, 12], [28, 12]); // A → B (+20)
    expect(at(l, 6, 12).a).toBe(0); // hole at A
    expect(at(l, 26, 12)).toEqual({ r: 6, a: 1 }); // A's pixels at B
    drag(t, h, [28, 12], [48, 12]); // B → C (+20 more)
    expect(at(l, 6, 12).a).toBe(0); // still a hole at A
    expect(at(l, 26, 12)).toEqual({ r: 26, a: 1 }); // B shows what it showed before
    expect(at(l, 46, 12)).toEqual({ r: 6, a: 1 }); // A's pixels at C
  });

  it('moves the selection outline with the pixels, and each drag is one undo step', () => {
    const { doc, s, l, h } = setup();
    const t = new MoveTool();
    drag(t, h, [8, 12], [28, 12]);
    drag(t, h, [28, 12], [48, 12]);
    expect(doc.selection.bounds(doc.bounds)).toEqual({ x: 44, y: 8, w: 8, h: 8 });
    s.history.undo();
    expect(at(l, 26, 12)).toEqual({ r: 6, a: 1 }); // back to the pixels at B
    expect(doc.selection.bounds(doc.bounds)).toEqual({ x: 24, y: 8, w: 8, h: 8 });
    s.history.undo();
    expect(at(l, 6, 12)).toEqual({ r: 6, a: 1 }); // nothing moved
  });

  it('lifts afresh after the layer changed in another way', () => {
    const { l, h } = setup();
    const t = new MoveTool();
    drag(t, h, [8, 12], [28, 12]);
    // Another edit to the layer drops the float: the next drag cuts what is now at B.
    l.raster.writeFloat({ x: 0, y: 0, w: 1, h: 1 }, new Float32Array([0, 0, 0, 1]));
    drag(t, h, [28, 12], [48, 12]);
    expect(at(l, 26, 12).a).toBe(0);
    expect(at(l, 46, 12)).toEqual({ r: 6, a: 1 });
  });
  it('can drag a floating selection completely outside and back, with separate history and cancellation', () => {
    const { doc, s, l, h } = setup(); const t = new MoveTool();
    const region = { x: 0, y: 0, w: 160, h: H };
    const state = () => ({ pixels: l.raster.readPixels(region), selection: doc.selection.mask.readPixels(region) });
    const a = state();
    drag(t, h, [8, 12], [108, 12]);
    expect(doc.selection.bounds(doc.bounds)).toBeNull();
    const b = state();
    t.down(h, pt(108, 12)); expect(t.busy()).toBe(true); t.move(h, pt(8, 12)); t.cancel(h);
    expect(state()).toEqual(b);
    drag(t, h, [108, 12], [8, 12]); expect(state()).toEqual(a);
    expect(s.history.undo()).toBe(true); expect(state()).toEqual(b);
    expect(s.history.undo()).toBe(true); expect(state()).toEqual(a);
    expect(s.history.redo()).toBe(true); expect(state()).toEqual(b);
    expect(s.history.redo()).toBe(true); expect(state()).toEqual(a);
    s.dispose();
  });

});

import {fragmentFixture,movePoint,checkFragmentOwnership} from '../helpers/selectionMove';
import {maxValue,type BitDepth} from '../../src/image-engine/pixels';

it.each([8,16,32] as BitDepth[])('B2 %i-bit paired alpha, feather, contour and undo use native encoding', depth=>{
  const f=fragmentFixture(depth),{doc,layer,session,host,tool}=f;
  const values=[0,.25,.5,1],coverages=[0,.25,.5,1,.37],data=new Float32Array(5*4*4),cov=new Float32Array(20);
  for(let y=0;y<4;y++)for(let x=0;x<5;x++){const i=y*5+x;data[i*4]=.7;data[i*4+1]=.3;data[i*4+3]=values[y];cov[i]=coverages[x];}
  layer.raster.clear();layer.raster.writeFloat({x:2,y:2,w:5,h:4},data);
  doc.selection.setRegion({x:5,y:4,w:5,h:4},cov);
  const source=layer.raster.readFloat({x:2,y:2,w:5,h:4}),coverage=doc.selection.read({x:5,y:4,w:5,h:4});
  const original=layer.raster.readPixels(f.region).slice(),originalMask=doc.selection.mask.readPixels(f.region).slice(),rv=layer.raster.version,sv=doc.selection.version;
  tool.down(host,movePoint(50,15));tool.move(host,movePoint(70,15));
  expect(layer.raster.version).toBe(rv);expect(doc.selection.version).toBe(sv);
  const temp=doc.selection.previewOutline!;expect(temp.dx).toBe(20);
  const preview=session.engine.getOverride(layer.id)!.read!({x:0,y:0,w:64,h:24},0);
  tool.up(host);expect(doc.selection.previewOutline).toBeNull();
  const left=layer.raster.readFloat({x:2,y:2,w:5,h:4}),moved=layer.raster.readFloat({x:22,y:2,w:5,h:4}),selection=doc.selection.read({x:25,y:4,w:5,h:4});
  const tolerance=depth===32?1e-6:1/maxValue(depth)+1e-6;
  for(let i=0;i<20;i++){
    const a=source[i*4+3],fragment=Math.min(a,coverage[i]),remaining=fragment===1?0:(a-fragment)/(1-fragment);
    expect(moved[i*4+3]).toBeCloseTo(fragment,depth===8?2:4);
    expect(Math.abs(left[i*4+3]-remaining)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(left[i*4+3]*(1-fragment)+fragment-a)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(selection[i]-fragment)).toBeLessThanOrEqual(1/255+1e-6);
    expect(temp.mask.readFloat({x:5+i%5,y:4+Math.floor(i/5),w:1,h:1})[0]).toBe(selection[i]);
    expect(preview[((4+Math.floor(i/5))*64+25+i%5)*4+3]).toBeCloseTo(moved[i*4+3],5);
  }
  expect(session.history.undo()).toBe(true);expect(layer.raster.readPixels(f.region)).toEqual(original);expect(doc.selection.mask.readPixels(f.region)).toEqual(originalMask);
  expect(session.history.redo()).toBe(true);expect(doc.selection.read({x:25,y:4,w:5,h:4})).toEqual(selection);
});

it('B1/B3 low-alpha ring, outside/hole starts and cache-free redrag preserve shape, source bounds and two undo steps',()=>{
  const {tool,host,doc,layer,session,region}=fragmentFixture();const original=layer.raster.readPixels(region).slice(),wide=doc.selection.mask.readPixels(region).slice();
  const lift=vi.spyOn(session.engine,'beginLift'),prepare=vi.spyOn(session.engine,'preparedLift');
  tool.hover(host,movePoint(50,16));expect(lift).not.toHaveBeenCalled();expect(prepare).not.toHaveBeenCalled();
  tool.down(host,movePoint(50,16));tool.move(host,movePoint(60,16));
  expect(doc.selection.previewOutline!.mask.readFloat({x:7,y:6,w:1,h:1})[0]).toBe(0);expect(doc.selection.previewOutline!.mask.readFloat({x:5,y:4,w:1,h:1})[0]).toBeCloseTo(.25,2);
  tool.up(host);const first=layer.raster.readPixels(region).slice(),firstMask=doc.selection.mask.readPixels(region).slice();
  expect(layer.x).toBe(3);expect(doc.selection.bounds(doc.bounds)).toEqual({x:15,y:4,w:5,h:5});
  // A fresh tool has no floating cache. Start over the transparent hole at the new location.
  const next=new MoveTool();next.down(host,movePoint(17,6));next.move(host,movePoint(27,6));next.up(host);next.up(host);
  expect(layer.raster.readFloat({x:22,y:2,w:1,h:1})[3]).toBeCloseTo(.25,2);
  expect(layer.raster.readFloat({x:12,y:2,w:1,h:1})[3]).toBe(0);
  expect(layer.raster.readFloat({x:40,y:2,w:1,h:1})[3]).toBe(1);
  expect(session.history.index).toBe(2);session.history.undo();expect(layer.raster.readPixels(region)).toEqual(first);expect(doc.selection.mask.readPixels(region)).toEqual(firstMask);
  session.history.undo();expect(layer.raster.readPixels(region)).toEqual(original);expect(doc.selection.mask.readPixels(region)).toEqual(wide);
});

it('B3 Alt, cancel, click, return to origin, empty fragment and locked rejection leave no accidental history',()=>{
  const {tool,host,doc,layer,session,region}=fragmentFixture(),original=layer.raster.readPixels(region).slice(),mask=doc.selection.mask.readPixels(region).slice();
  for(const mode of ['click','zero','cancel']){
    tool.down(host,movePoint(50,16));if(mode!=='click'){tool.move(host,movePoint(60,16));if(mode==='zero')tool.move(host,movePoint(50,16));}
    if(mode==='cancel')tool.cancel(host);else tool.up(host);
    expect(layer.raster.readPixels(region)).toEqual(original);expect(doc.selection.mask.readPixels(region)).toEqual(mask);expect(session.history.index).toBe(0);expect(session.engine.getOverride(layer.id)).toBeUndefined();expect(doc.selection.previewOutline).toBeNull();
  }
  tool.down(host,{...movePoint(50,16),alt:true});tool.move(host,movePoint(60,16));tool.up(host);
  expect(layer.raster.readFloat({x:2,y:2,w:1,h:1})[3]).toBeCloseTo(.25,2);expect(layer.raster.readFloat({x:12,y:2,w:1,h:1})[3]).toBeCloseTo(.25,2);session.history.undo();
  doc.selection.setRegion({x:30,y:10,w:2,h:2},new Float32Array(4).fill(1));tool.down(host,movePoint(50,16));tool.move(host,movePoint(60,16));tool.up(host);expect(session.history.index).toBe(0);expect(layer.x).toBe(3);
  doc.selection.setRegion({x:4,y:3,w:7,h:7},new Float32Array(49).fill(1));layer.locks.pixels=true;
  tool.down(host,movePoint(50,16));tool.move(host,movePoint(60,16));tool.up(host);expect(layer.x).toBe(3);expect(session.history.index).toBe(0);
});

it('B5 CPU preview discards only owned state after external takeover and every late tail',async()=>{await checkFragmentOwnership();});

it.each(['pixels','selection'])('B5 commit failure rolls back only resources still owned after external %s takeover',resource=>{
  const {tool,host,doc,layer,session,region}=fragmentFixture(),before=layer.raster.readPixels(region).slice(),maskBefore=doc.selection.mask.readPixels(region).slice();
  tool.down(host,movePoint(50,16));tool.move(host,movePoint(60,16));
  let externalPixels=before,externalMask=maskBefore;
  const push=vi.spyOn(session,'push').mockImplementation(()=>{
    if(resource==='pixels')layer.raster.writeFloat({x:0,y:0,w:1,h:1},new Float32Array([0,0,1,1]));
    else doc.selection.setRegion({x:0,y:0,w:1,h:1},new Float32Array([.75]));
    externalPixels=layer.raster.readPixels(region).slice();externalMask=doc.selection.mask.readPixels(region).slice();
    throw new Error('injected failed commit with external takeover');
  });
  expect(tool.up(host)).toBe('failed');push.mockRestore();
  expect(layer.raster.readPixels(region)).toEqual(resource==='pixels'?externalPixels:before);
  expect(doc.selection.mask.readPixels(region)).toEqual(resource==='selection'?externalMask:maskBefore);
  expect(session.history.index).toBe(0);expect(session.engine.getOverride(layer.id)).toBeUndefined();expect(doc.selection.previewOutline).toBeNull();
});

import {traceContours} from '../../src/selection/ops';
it('B1/B3 low-alpha display contour includes the ring hole rather than its bounding rectangle',()=>{
  const {tool,host,doc}=fragmentFixture();tool.down(host,movePoint(50,16));tool.move(host,movePoint(60,16));
  const outline=doc.selection.previewOutline!,data=outline.mask.readFloat(outline.bounds);
  expect(traceContours(data,7,7,Number.MIN_VALUE)).toHaveLength(2);
  tool.up(host);const formal=doc.selection.read({x:14,y:3,w:7,h:7});expect(traceContours(formal,7,7,Number.MIN_VALUE)).toHaveLength(2);
});
