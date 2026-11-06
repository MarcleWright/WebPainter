// @vitest-environment jsdom
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { testDevice, maxDiff } from '../helpers/gpu';
import { GpuCompositor } from '../../src/gpu/compositor';
import { setGpuCompositor } from '../../src/rendering/renderEngine';
import { compositeRegion } from '../../src/rendering/compositor';
import { editor } from '../../src/app/editor';
import { MoveTool } from '../../src/tools/moveTool';
import type { ToolHost, ToolPointer } from '../../src/tools/tool';
import { add, newDoc } from '../helpers/build';
import { createPixelLayer, createMask, createAdjustmentLayer } from '../../src/document/layerFactory';
import { defaultAdjustment, type Adjustment } from '../../src/adjustments/types';
import { TiledRaster } from '../../src/image-engine/tiledRaster';

let gpu: GpuCompositor | null = null;
beforeAll(async () => { const d = await testDevice(); if (d) gpu = new GpuCompositor(d); });
afterAll(() => { setGpuCompositor(null); gpu?.dispose(); });
const pt = (x: number, y: number): ToolPointer => ({ x, y, sx: x, sy: y, pressure: 1, tiltX: 0, tiltY: 0, twist: 0, button: 0, buttons: 1, shift: false, alt: false, mod: false, pointerType: 'mouse', time: 0, clickCount: 1 });
it('composes float on GPU before layer effects and preserves formal pixels during movement', async () => {
  if (!gpu) throw new Error('GPU unavailable: this test requires a real WebGPU adapter');
  setGpuCompositor(gpu);
  (globalThis as unknown as { __webPainterTask02: boolean }).__webPainterTask02 = true;
  const doc = newDoc(64, 48); const data = new Uint8ClampedArray(64*48*4);
  for(let i=0;i<64*48;i++) { data[i*4]=i%251; data[i*4+1]=(i*7)%256; data[i*4+2]=(i*11)%256; data[i*4+3]=[0,64,128,255][i%4]; }
  const layer=createPixelLayer('test',8,TiledRaster.fromPixels(64,48,4,8,data)); add(doc,layer);
  const session=editor.addDocument(doc); session.setActive(layer.id); session.view.zoom=.25;
  doc.selection.combine({x:4,y:4,w:24,h:20}, Float32Array.from({length:480},(_,i)=>i%5===0?.5:1), 'replace');
  const h: ToolHost={editor,session,redraw(){},setCursor(){},viewportSize:()=>({w:200,h:100})};
  const t=new MoveTool(), rv=layer.raster.version, sv=doc.selection.mask.version;
  t.down(h,pt(6,6)); t.move(h,pt(13,11));
  expect(layer.raster.version).toBe(rv); expect(doc.selection.mask.version).toBe(sv);
  const ov=session.engine.getOverride(layer.id); expect(ov?.gpu?.floating).toBeTruthy();
  const previews: Float32Array[]=[];
  for(let level=0;level<=2;level++) {
    const r={x:0,y:0,w:64>>level,h:48>>level};
    const before=gpu.stats.gpuPreviews;
    const v=await gpu.compositeRead(doc,r,{level,overrides:new Map([[layer.id,ov!]])});
    expect(gpu.stats.gpuPreviews).toBeGreaterThan(before); expect(v).not.toBeNull(); expect(v!.every(Number.isFinite)).toBe(true); previews.push(v!);
  }
  t.up(h);
  expect(gpu.floatingAtlasResidentTiles).toBe(0);
  for(let level=0;level<=2;level++) {
    const r={x:0,y:0,w:64>>level,h:48>>level};
    expect(maxDiff(previews[level],compositeRegion(doc,r,{level})).max).toBeLessThan(2/255);
  }
  const rect = { x: 0, y: 0, w: 64, h: 48 };
  const b = layer.raster.readPixels(rect).slice();
  const bsel = doc.selection.mask.readPixels(rect).slice();
  t.down(h, pt(13,11)); t.move(h, pt(20,15)); t.up(h); t.up(h);
  const c = layer.raster.readPixels(rect).slice();
  expect(c).not.toEqual(b);
  expect(session.history.undo()).toBe(true);
  expect(layer.raster.readPixels(rect)).toEqual(b); expect(doc.selection.mask.readPixels(rect)).toEqual(bsel);
  expect(session.history.undo()).toBe(true); expect(layer.raster.readPixels(rect)).toEqual(data);
  expect(session.history.redo()).toBe(true); expect(session.history.redo()).toBe(true); expect(layer.raster.readPixels(rect)).toEqual(c);
  for (let i=0;i<2;i++) {
    t.down(h, pt(20,15)); t.move(h, pt(23,18));
    const current=session.engine.getOverride(layer.id)!;
    await gpu.compositeRead(doc,{x:0,y:0,w:32,h:24},{level:0,overrides:new Map([[layer.id,current]])});
    expect(gpu.floatingAtlasResidentTiles).toBeGreaterThan(0);
    t.cancel(h); expect(gpu.floatingAtlasResidentTiles).toBe(0); expect(layer.raster.readPixels(rect)).toEqual(c);
  }
  // Alt copies, Shift constrains the move, and a boundary crossing remains undoable.
  const bounds = doc.selection.bounds(doc.bounds)!;
  t.down(h, {...pt(20,15), alt:true}); t.move(h, {...pt(28,18), shift:true}); t.up(h);
  expect(doc.selection.bounds(doc.bounds)?.y).toBe(bounds.y);
  expect(session.history.undo()).toBe(true); expect(layer.raster.readPixels(rect)).toEqual(c);
  t.down(h, pt(20,15)); t.move(h, pt(-20,-15)); t.up(h);
  expect(session.history.undo()).toBe(true); expect(layer.raster.readPixels(rect)).toEqual(c);
  const historyId = session.history.current.id;
  t.down(h, pt(20,15)); t.up(h); expect(session.history.current.id).toBe(historyId);
  // An external write must invalidate the preview and survive its cancellation.
  t.down(h, pt(20,15)); t.move(h, pt(24,18));
  layer.raster.writeFloat({x:0,y:0,w:1,h:1}, new Float32Array([1,0,0,1]));
  doc.emit({type:'pixels',layerId:layer.id,rect:{x:0,y:0,w:1,h:1}});
  t.up(h); expect(layer.raster.readPixels({x:0,y:0,w:1,h:1})).toEqual(new Uint8ClampedArray([255,0,0,255]));
  expect(session.engine.getOverride(layer.id)).toBeUndefined(); expect(session.history.current.id).toBe(historyId);
  editor.removeSession(session.id); delete (globalThis as {__webPainterTask02?:boolean}).__webPainterTask02;
});

it('C2 experimental commit matches the pre-change raster and selection oracle', () => {
  if (!gpu) throw new Error('GPU unavailable');
  setGpuCompositor(gpu);
  (globalThis as unknown as { __webPainterTask02: boolean }).__webPainterTask02 = true;
  const w=24,h=16,doc=newDoc(w,h),pixels=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) { const i=(y*w+x)*4; pixels[i]=(x*37+y*11)%256; pixels[i+1]=(x*7+y*29)%256; pixels[i+2]=(x*13+y*19)%256; pixels[i+3]=[0,64,128,255][(x+y)%4]; }
  const layer=createPixelLayer('C2',8,TiledRaster.fromPixels(w,h,4,8,pixels)); add(doc,layer);
  const session=editor.addDocument(doc);session.setActive(layer.id);
  const hst: ToolHost={editor,session,redraw(){},setCursor(){},viewportSize:()=>({w:200,h:100})};
  const cov=new Float32Array(48); for(let y=0;y<6;y++)for(let x=0;x<8;x++)cov[y*8+x]=x===0||y===0||x===7||y===5?.5:1;
  doc.selection.combine({x:2,y:2,w:8,h:6},cov,'replace');
  const t=new MoveTool();t.down(hst,pt(4,4));t.move(hst,pt(10,7));
  expect(session.engine.getOverride(layer.id)?.gpu?.floating).toBeTruthy(); t.up(hst);
  const hash=(bytes: ArrayBufferView)=>createHash('sha256').update(new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength)).digest('hex');
  const r={x:0,y:0,w,h};
  expect([hash(layer.raster.readPixels(r)),hash(doc.selection.mask.readPixels(r)),hash(compositeRegion(doc,r,{level:0}))]).toEqual([
    '2b25e8a12a305e931b99d7b8cf73ff9cad4fea5570a3deb6562aa3f910256c85',
    'bcb886f547c4855c500d0c01f1c94fcc58d361bd860fae4a091f116b3bdcd0da',
    '55d7d6b246aa6247c6f83c61d7ac286871039063f72698c65ba1e10339ba559a']);
  editor.removeSession(session.id);delete (globalThis as {__webPainterTask02?:boolean}).__webPainterTask02;
});

it('C1 GPU preview retains mask, multiply, opacity, and curves at 25 percent', async () => {
  if (!gpu) throw new Error('GPU unavailable'); setGpuCompositor(gpu);
  (globalThis as unknown as { __webPainterTask02: boolean }).__webPainterTask02 = true;
  const doc=newDoc(128,96);const rgba=new Uint8ClampedArray(128*96*4);
  for(let i=0;i<128*96;i++){rgba[i*4]=i%251;rgba[i*4+1]=(i*7)%256;rgba[i*4+2]=(i*19)%256;rgba[i*4+3]=255;}
  add(doc,createPixelLayer('background',8,TiledRaster.fromPixels(128,96,4,8,rgba)));
  const l=createPixelLayer('photo',8,TiledRaster.fromPixels(128,96,4,8,rgba));l.opacity=.65;l.blendMode='multiply';l.mask=createMask(true);
  l.mask.raster.writeFloat({x:0,y:0,w:128,h:96},Float32Array.from({length:128*96},(_,i)=>[0,.5,1][Math.floor((i%128)/32)%3]));add(doc,l);
  const curves=defaultAdjustment('curves') as Extract<Adjustment, {type:'curves'}>;curves.rgb=[{x:0,y:0},{x:128,y:160},{x:255,y:255}];add(doc,createAdjustmentLayer(curves,'curves'));
  const maskBefore=l.mask!.raster.readPixels({x:0,y:0,w:128,h:96}).slice();
  const session=editor.addDocument(doc);session.setActive(l.id);session.view.zoom=.25;
  doc.selection.combine({x:8,y:8,w:64,h:48},new Float32Array(64*48).fill(1),'replace');
  const host:ToolHost={editor,session,redraw(){},setCursor(){},viewportSize:()=>({w:200,h:100})};
  const t=new MoveTool();t.down(host,pt(20,20));t.move(host,pt(35,27));
  const ov=session.engine.getOverride(l.id);expect(ov?.gpu?.floating).toBeTruthy();
  const rect={x:0,y:0,w:32,h:24}, before=gpu.stats.gpuPreviews;
  const preview=await gpu.compositeRead(doc,rect,{level:2,overrides:new Map([[l.id,ov!]])});
  expect(gpu.stats.gpuPreviews).toBeGreaterThan(before); expect(preview).not.toBeNull(); expect(preview!.every(Number.isFinite)).toBe(true);
  t.up(host);expect(gpu.floatingAtlasResidentTiles).toBe(0);const exact=compositeRegion(doc,rect,{level:2});
  expect(maxDiff(preview!,exact).max).toBeLessThan(2/255);
  expect(l.opacity).toBe(.65);expect(l.blendMode).toBe('multiply');expect(l.mask?.enabled).toBe(true);expect(l.mask!.raster.readPixels({x:0,y:0,w:128,h:96})).toEqual(maskBefore);
  editor.removeSession(session.id);delete (globalThis as {__webPainterTask02?:boolean}).__webPainterTask02;
});

it('commit failure rolls back pixels, selection and history', () => {
  if (!gpu) throw new Error('GPU unavailable');setGpuCompositor(gpu);
  (globalThis as unknown as { __webPainterTask02: boolean }).__webPainterTask02 = true;
  const doc=newDoc(32,24), data=new Uint8ClampedArray(32*24*4).fill(127);
  const l=createPixelLayer('failure',8,TiledRaster.fromPixels(32,24,4,8,data));add(doc,l);
  const session=editor.addDocument(doc);session.setActive(l.id);
  doc.selection.combine({x:4,y:4,w:8,h:8},new Float32Array(64).fill(1),'replace');
  const host:ToolHost={editor,session,redraw(){},setCursor(){},viewportSize:()=>({w:200,h:100})};
  const region={x:0,y:0,w:32,h:24},original=l.raster.readPixels(region).slice(),mask=doc.selection.mask.readPixels(region).slice(), id=session.history.current.id;
  const t=new MoveTool();t.down(host,pt(6,6));t.move(host,pt(12,10));
  expect(session.engine.getOverride(l.id)?.gpu?.floating).toBeTruthy();
  const restore=l.raster.restore.bind(l.raster);let calls=0;
  l.raster.restore=(snap)=>{if(calls++===0)throw new Error('injected commit failure');restore(snap);};
  t.up(host);l.raster.restore=restore;
  expect(l.raster.readPixels(region)).toEqual(original);expect(doc.selection.mask.readPixels(region)).toEqual(mask);
  expect(session.history.current.id).toBe(id);expect(session.engine.getOverride(l.id)).toBeUndefined();
  editor.removeSession(session.id);delete (globalThis as {__webPainterTask02?:boolean}).__webPainterTask02;
});

it('switching documents cancels the active preview and releases its tiles', async () => {
  if (!gpu) throw new Error('GPU unavailable');setGpuCompositor(gpu);
  (globalThis as unknown as { __webPainterTask02: boolean }).__webPainterTask02 = true;
  const doc=newDoc(32,24), data=new Uint8ClampedArray(32*24*4).fill(127);
  const l=createPixelLayer('switch',8,TiledRaster.fromPixels(32,24,4,8,data));add(doc,l);
  const first=editor.addDocument(doc);first.setActive(l.id);doc.selection.combine({x:4,y:4,w:8,h:8},new Float32Array(64).fill(1),'replace');
  const oldFactory=editor.hostFactory;
  editor.hostFactory=()=>({editor,session:editor.active!,redraw(){},setCursor(){},viewportSize:()=>({w:200,h:100})});
  editor.registerTool('move', () => new MoveTool()); editor.setTool('move');const tool=editor.tool('move')!, host=editor.hostFactory()!;
  const original=l.raster.readPixels({x:0,y:0,w:32,h:24}).slice(),id=first.history.current.id;
  tool.down!(host,pt(6,6));tool.move!(host,pt(12,10));
  const ov=first.engine.getOverride(l.id)!;expect(ov?.gpu?.floating).toBeTruthy();
  await gpu.compositeRead(doc,{x:0,y:0,w:32,h:24},{level:0,overrides:new Map([[l.id,ov]])});
  expect(gpu.floatingAtlasResidentTiles).toBeGreaterThan(0);
  const second=editor.addDocument(newDoc(8,8));
  expect(first.engine.getOverride(l.id)).toBeUndefined();expect(gpu.floatingAtlasResidentTiles).toBe(0);
  expect(l.raster.readPixels({x:0,y:0,w:32,h:24})).toEqual(original);expect(first.history.current.id).toBe(id);
  editor.removeSession(second.id);editor.removeSession(first.id);editor.hostFactory=oldFactory;
  delete (globalThis as {__webPainterTask02?:boolean}).__webPainterTask02;
});

it('unsupported 16-bit documents use the existing path', () => {
  if (!gpu) throw new Error('GPU unavailable');setGpuCompositor(gpu);
  (globalThis as unknown as { __webPainterTask02: boolean }).__webPainterTask02 = true;
  const doc=newDoc(32,24,16), data=new Uint16Array(32*24*4).fill(32768);
  const l=createPixelLayer('16-bit',16,TiledRaster.fromPixels(32,24,4,16,data));add(doc,l);
  const session=editor.addDocument(doc);session.setActive(l.id);doc.selection.combine({x:4,y:4,w:8,h:8},new Float32Array(64).fill(1),'replace');
  const host:ToolHost={editor,session,redraw(){},setCursor(){},viewportSize:()=>({w:200,h:100})};
  const t=new MoveTool(),version=l.raster.version;t.down(host,pt(6,6));t.move(host,pt(12,10));
  expect(session.engine.getOverride(l.id)).toBeUndefined();expect(l.raster.version).toBeGreaterThan(version);t.cancel(host);
  editor.removeSession(session.id);delete (globalThis as {__webPainterTask02?:boolean}).__webPainterTask02;
});

it('reuses a fully off-canvas float in the GPU path, including cancellation and history', () => {
  if (!gpu) throw new Error('GPU unavailable'); setGpuCompositor(gpu);
  (globalThis as unknown as { __webPainterTask02: boolean }).__webPainterTask02 = true;
  const doc = newDoc(64,48), pixels = new Uint8ClampedArray(64*48*4);
  for (let i=0;i<64*48;i++) { pixels[i*4]=i%251; pixels[i*4+1]=100; pixels[i*4+3]=255; }
  const l=createPixelLayer('outside',8,TiledRaster.fromPixels(64,48,4,8,pixels)); add(doc,l);
  const session=editor.addDocument(doc);session.setActive(l.id);
  doc.selection.combine({x:4,y:4,w:8,h:8},new Float32Array(64).fill(1),'replace');
  const host:ToolHost={editor,session,redraw(){},setCursor(){},viewportSize:()=>({w:200,h:100})};
  const region={x:0,y:0,w:160,h:48}, state=()=>({pixels:l.raster.readPixels(region),selection:doc.selection.mask.readPixels(region)});
  const a=state(), t=new MoveTool();
  t.down(host,pt(6,6));t.move(host,pt(106,6));expect(session.engine.getOverride(l.id)?.gpu?.floating).toBeTruthy();t.up(host);
  expect(doc.selection.bounds(doc.bounds)).toBeNull();const b=state();
  t.down(host,pt(106,6));expect(t.busy()).toBe(true);t.move(host,pt(6,6));expect(session.engine.getOverride(l.id)?.gpu?.floating).toBeTruthy();t.cancel(host);expect(state()).toEqual(b);
  t.down(host,pt(106,6));t.move(host,pt(6,6));expect(session.engine.getOverride(l.id)?.gpu?.floating).toBeTruthy();t.up(host);expect(state()).toEqual(a);
  expect(session.history.undo()).toBe(true);expect(state()).toEqual(b);expect(session.history.undo()).toBe(true);expect(state()).toEqual(a);
  expect(session.history.redo()).toBe(true);expect(state()).toEqual(b);expect(session.history.redo()).toBe(true);expect(state()).toEqual(a);
  editor.removeSession(session.id);delete (globalThis as {__webPainterTask02?:boolean}).__webPainterTask02;
});

it('preserves redo on write failure and keeps the committed move on history notification failure', () => {
  if (!gpu) throw new Error('GPU unavailable'); setGpuCompositor(gpu);
  (globalThis as unknown as { __webPainterTask02: boolean }).__webPainterTask02 = true;
  const doc=newDoc(64,48),pixels=new Uint8ClampedArray(64*48*4);
  for(let i=0;i<64*48;i++){pixels[i*4]=i%251;pixels[i*4+1]=80;pixels[i*4+3]=255;}
  const l=createPixelLayer('history',8,TiledRaster.fromPixels(64,48,4,8,pixels));add(doc,l);
  const session=editor.addDocument(doc);session.setActive(l.id);doc.selection.combine({x:4,y:4,w:8,h:8},new Float32Array(64).fill(1),'replace');
  const host:ToolHost={editor,session,redraw(){},setCursor(){},viewportSize:()=>({w:200,h:100})};
  const region={x:0,y:0,w:64,h:48},state=()=>({pixels:l.raster.readPixels(region),selection:doc.selection.mask.readPixels(region)});
  const t=new MoveTool();t.down(host,pt(6,6));t.move(host,pt(18,6));t.up(host);
  const redoState=state();expect(session.history.undo()).toBe(true);const before=state();
  const entries=session.history.entries.slice(), index=session.history.index;expect(session.history.canRedo).toBe(true);
  t.down(host,pt(6,6));t.move(host,pt(12,6));expect(session.engine.getOverride(l.id)?.gpu?.floating).toBeTruthy();
  const restore=l.raster.restore.bind(l.raster);let calls=0;l.raster.restore=snap=>{if(calls++===0)throw new Error('write failed');restore(snap);};
  t.up(host);l.raster.restore=restore;expect(state()).toEqual(before);expect(session.history.entries).toEqual(entries);expect(session.history.index).toBe(index);expect(session.history.canRedo).toBe(true);
  expect(session.history.redo()).toBe(true);expect(state()).toEqual(redoState);expect(session.history.undo()).toBe(true);
  t.down(host,pt(6,6));t.move(host,pt(14,6));expect(session.engine.getOverride(l.id)?.gpu?.floating).toBeTruthy();
  let notifications=0;const stop=session.history.on(()=>{if(notifications++===0)throw new Error('observer failed');});
  const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});t.up(host);t.up(host);stop();
  expect(warning).toHaveBeenCalledWith('Move committed, but a history notification failed:',expect.any(Error));warning.mockRestore();
  const committed=state();expect(committed).not.toEqual(before);expect(session.history.canRedo).toBe(false);expect(session.history.index).toBe(index+1);
  expect(session.history.undo()).toBe(true);expect(state()).toEqual(before);expect(session.history.redo()).toBe(true);expect(state()).toEqual(committed);
  expect(session.history.undo()).toBe(true);expect(session.history.canRedo).toBe(true);
  t.down(host,pt(6,6));t.move(host,pt(16,6));t.up(host);
  expect(session.history.canRedo).toBe(false);const count=session.history.entries.length;t.up(host);expect(session.history.entries.length).toBe(count);
  editor.removeSession(session.id);delete (globalThis as {__webPainterTask02?:boolean}).__webPainterTask02;
});
