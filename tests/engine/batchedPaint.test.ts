// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { PaintOp } from '../../src/brush/paintOps';
import { BatchedPaintOp } from '../../src/brush/batchedPaintOp';
import { DabEmitter, dabBounds, dabCoverage, type Dab } from '../../src/brush/engine';
import { defaultBrush } from '../../src/tools/toolTypes';
import { TiledRaster } from '../../src/image-engine/tiledRaster';
import { newDoc, add } from '../helpers/build';
import { createPixelLayer, createMask } from '../../src/document/layerFactory';
import { DocumentSession } from '../../src/app/session';
import { RasterEditCommand } from '../../src/commands/rasterCommands';
import { encodeNative, decodeNative } from '../../src/document/native';
import { PaintTool } from '../../src/tools/paintTools';
import { editor } from '../../src/app/editor';
import { useApp } from '../../src/app/store';
import type { ToolHost, ToolPointer } from '../../src/tools/tool';
afterEach(()=>{vi.restoreAllMocks();for(const s of [...editor.sessions])editor.removeSession(s.id);});
function fixture() { const px=new Uint8ClampedArray(384*256*4);for(let i=0;i<px.length;i++)px[i]=(i*13+Math.floor(i/7))%256;return TiledRaster.fromPixels(384,256,4,8,px); }
const pixels=(r:TiledRaster)=>createHash('sha256').update(new Uint8Array(r.readPixels({x:-160,y:-160,w:800,h:640}).buffer)).digest('hex');
const color={r:.13,g:.52,b:.79};
it.each([30,300])('matches independent, unchanged PaintOp after every batch: %ipx, pressure/opacity/flow, overlap/gaps and erase',size=>{
 for(const erase of [false,true]){
  const r=fixture(),ref=r.clone(),ctx=(t:TiledRaster)=>({target:{raster:t,x:0,y:0,channels:4 as const},original:t.clone(),selection:null,canvas:{x:0,y:0,w:512,h:512},lockAlpha:false});
  const old=new PaintOp(ctx(ref),color,'normal',erase,color),next=new BatchedPaintOp(ctx(r),color,erase);
  const b={...defaultBrush(),size,flow:.17,opacity:.64,dynamics:{...defaultBrush().dynamics,opacityPressure:true,flowPressure:true}};
  const e=new DabEmitter(b),input=(i:number)=>({x:80+Math.sin(i*.7)*110,y:80+Math.sin(i*.39)*90,pressure:.1+(i%7)/8,tiltX:0,tiltY:0,twist:0,time:i*19});
  const groups=[e.begin(input(0)),...Array.from({length:14},(_,i)=>e.move(input(i+1)))];
  for(const group of groups){next.beginBatch();for(const d of group){const rect=dabBounds(d),cov=dabCoverage(d,rect,b,null);old.apply(d,cov,rect);next.apply(d,cov,rect);}next.endBatch();expect(pixels(r)).toEqual(pixels(ref));}
 }
});
it('preserves last-rectangle opacity even when a later union contains gaps from earlier strokes',()=>{
 const r=fixture(),ref=r.clone(),ctx=(t:TiledRaster)=>({target:{raster:t,x:0,y:0,channels:4 as const},original:t.clone(),selection:null,canvas:{x:0,y:0,w:512,h:512},lockAlpha:false});
 const a=new PaintOp(ctx(ref),color,'normal',false,color),b=new BatchedPaintOp(ctx(r),color,false);
 const groups=[[{x:100,y:100,opacity:.9}],[{x:70,y:100,opacity:.2},{x:130,y:100,opacity:.2}],[{x:80,y:100,opacity:.7},{x:110,y:100,opacity:.1}]];
 for(const group of groups){b.beginBatch();for(const p of group){const d:Dab={...p,radius:7,roundness:1,angle:0,flow:.2,pressure:1};const rect=dabBounds(d),cov=new Float32Array(rect.w*rect.h).fill(.5);a.apply(d,cov,rect);b.apply(d,cov,rect);}b.endBatch();expect(pixels(r)).toEqual(pixels(ref));}
});
it('reduces target writes/original reads, reuses caller-owned buffers and leaves no final-up work',()=>{
 const r=fixture(),original=r.clone(),op=new BatchedPaintOp({target:{raster:r,x:0,y:0,channels:4},original,selection:null,canvas:{x:0,y:0,w:512,h:512},lockAlpha:false},color,false);
 const reads=vi.spyOn(original,'readFloat'),writes=vi.spyOn(r,'writeFloat');
 op.beginBatch();for(let i=0;i<10;i++){const d:Dab={x:100+i,y:100,radius:15,roundness:1,angle:0,flow:.2,opacity:.4,pressure:1},rect=dabBounds(d);op.apply(d,new Float32Array(rect.w*rect.h).fill(.5),rect);}op.endBatch();
 expect(reads).toHaveBeenCalledTimes(1);expect(writes).toHaveBeenCalledTimes(1);expect(reads.mock.calls[0][2]).toBeInstanceOf(Float32Array);op.endBatch();expect(writes).toHaveBeenCalledTimes(1);
});
it('real erase batch -> history undo/redo -> native reopen preserves pixels',()=>{
 const d=newDoc(384,256),l=createPixelLayer('pixels',8,fixture());add(d,l);const s=new DocumentSession(d),before=l.raster.snapshot(),initial=pixels(l.raster),op=new BatchedPaintOp({target:{raster:l.raster,x:0,y:0,channels:4},original:l.raster.clone(),selection:null,canvas:d.bounds,lockAlpha:false},color,true);
 op.beginBatch();for(let i=0;i<3;i++){const dab:Dab={x:130+i*5,y:120,radius:150,roundness:1,angle:0,flow:1,opacity:1,pressure:1},r=dabBounds(dab);op.apply(dab,new Float32Array(r.w*r.h).fill(1),r);}op.endBatch();const final=pixels(l.raster);s.push(new RasterEditCommand('Erase', {kind:'layer',layerId:l.id},before,l.raster.snapshot(),op.dirty),true);
 expect(s.history.undo()).toBe(true);expect(pixels(l.raster)).toEqual(initial);expect(s.history.redo()).toBe(true);expect(pixels(l.raster)).toEqual(final);
 const reopened=decodeNative(encodeNative(d)).doc.getLayer(l.id)!;if(reopened.kind!=='pixel')throw Error('pixel');expect(pixels(reopened.raster)).toEqual(final);s.dispose();
});
const point=(x:number):ToolPointer=>({x,y:120,sx:x,sy:120,pressure:.7,tiltX:0,tiltY:0,twist:0,time:x,pointerType:'pen',button:0,buttons:1,alt:false,mod:false,shift:false,clickCount:1});
it.each(['normal','mask','selection','lockAlpha','multiply','16bit'] as const)('real tool qualifies/falls back and cancels safely: %s',condition=>{
 const d=newDoc(384,256,condition==='16bit'?16:8),l=createPixelLayer('pixels',d.canvas.bitDepth,condition==='16bit'?new TiledRaster(4,16):fixture());add(d,l);const s=editor.addDocument(d);s.setActive(l.id);if(condition==='mask')l.mask=createMask(true);if(condition==='selection')d.selection.selectAll();if(condition==='lockAlpha')l.locks.transparency=true;
 useApp.setState({brush:{...defaultBrush(),size:300,smoothing:0,blendMode:condition==='multiply'?'multiply':'normal'}});const h:ToolHost={editor,session:s,redraw(){},setCursor(){},viewportSize:()=>({w:1000,h:900})},t=new PaintTool('brush','brush'),initial=pixels(l.raster);
 t.down(h,point(100));expect((t as any).op instanceof BatchedPaintOp).toBe(condition==='normal');t.moveBatch(h,[point(110),point(120),point(130)]);t.cancel(h);expect(pixels(l.raster)).toEqual(initial);expect(s.history.canUndo).toBe(false);
});

it('RGBA8 erasing avoids repeated RGBA float reads/writes while preserving native rounding and COW',()=>{
 const r=fixture(),ref=r.clone(),original=r.clone(),ctx=(t:TiledRaster,o:TiledRaster)=>({target:{raster:t,x:0,y:0,channels:4 as const},original:o,selection:null,canvas:{x:0,y:0,w:512,h:512},lockAlpha:false});
 const oldOriginal=ref.clone(),old=new PaintOp(ctx(ref,oldOriginal),color,'normal',true,color),next=new BatchedPaintOp(ctx(r,original),color,true);
 const oldReads=vi.spyOn(oldOriginal,'readFloat'),oldWrites=vi.spyOn(ref,'writeFloat'),reads=vi.spyOn(original,'readFloat'),writes=vi.spyOn(r,'writeFloat');
 next.beginBatch();for(let i=0;i<10;i++){const d:Dab={x:100+i,y:100,radius:15,roundness:1,angle:0,flow:.13,opacity:.41,pressure:1},rect=dabBounds(d),cov=new Float32Array(rect.w*rect.h).fill(.33);old.apply(d,cov,rect);next.apply(d,cov,rect);}next.endBatch();
 expect(oldReads).toHaveBeenCalledTimes(10);expect(oldWrites).toHaveBeenCalledTimes(10);expect(reads).not.toHaveBeenCalled();expect(writes).not.toHaveBeenCalled();expect(pixels(r)).toBe(pixels(ref));
});
