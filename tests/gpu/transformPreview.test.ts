// @vitest-environment jsdom
import { afterEach, afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { editor } from '../../src/app/editor';
import { beginTransform, commitTransform, cancelTransform, transformState, transformController, quickTransformLayer } from '../../src/tools/transformTool';
import { RenderEngine, setGpuCompositor } from '../../src/rendering/renderEngine';
import { GpuCompositor } from '../../src/gpu/compositor';
import { testDevice, maxDiff } from '../helpers/gpu';
import { newDoc, add, solidLayer } from '../helpers/build';
import { createMask, createGroupLayer } from '../../src/document/layerFactory';
import { TiledRaster } from '../../src/image-engine/tiledRaster';
import { ReplaceLayerCommand } from '../../src/commands/layerCommands';
import { warpLayerRaster } from '../../src/app/ops/imageOps';
import { affineToHomography, multiply, translation, rotation, scaling, type Affine } from '../../src/image-engine/matrix';
import { cloneLayer } from '../../src/document/clone';
import { encodeNative, decodeNative } from '../../src/document/native';
import { compositeRegion } from '../../src/rendering/compositor';
import type { ToolHost, ToolPointer } from '../../src/tools/tool';
let gpu: GpuCompositor;
beforeAll(async()=>{const d=await testDevice();if(!d)throw Error('GPU required');gpu=new GpuCompositor(d);setGpuCompositor(gpu);editor.registerModeController('transform',transformController);});
afterEach(()=>{vi.restoreAllMocks();cancelTransform();for(const s of [...editor.sessions])editor.removeSession(s.id);setGpuCompositor(gpu);});
afterAll(()=>{setGpuCompositor(null);gpu.dispose();});
const hash=(r:TiledRaster)=>createHash('sha256').update(new Uint8Array(r.readPixels({x:-64,y:-64,w:320,h:256}).buffer)).digest('hex');
function fixture(stack=false){
 const d=newDoc(128,96);
 if(stack)add(d,solidLayer(d,'under',0,0,128,96,[.1,.5,.2,1]));
 const l=solidLayer(d,'source',-24,-12,80,70,[.7,.2,.8,.7]);
 // Nonuniform transparent pixels expose mapping and premultiplied sampling errors.
 const pixels=new Uint8ClampedArray(80*70*4);
 for(let y=0;y<70;y++)for(let x=0;x<80;x++){
  const i=(y*80+x)*4;
  pixels.set([(x*13+y*7)%256,(x*3+y*17)%256,(x*19+y*5)%256,(x+y)%9===0?0:80+(x*11+y*3)%176],i);
 }
 l.raster.writePixels({x:0,y:0,w:80,h:70},pixels);add(d,l);
 if(stack)add(d,solidLayer(d,'above',20,16,30,22,[.2,.8,.1,.9]));
 const s=editor.addDocument(d);s.setActive(l.id);
 const h:ToolHost={editor,session:s,redraw(){},setCursor(){},viewportSize:()=>({w:800,h:600})};
 editor.hostFactory=()=>h;s.engine.lastVisible={level:0,tiles:[[0,0]]};return{d,l,s,h};
}
const point=(x:number,y:number):ToolPointer=>({x,y,sx:x,sy:y,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,alt:false,shift:false,mod:false,time:0,pointerType:'mouse',clickCount:1});
function setMatrix(M:Affine){const s=transformState()!;transformController.down({} as ToolHost,point(s.base.x+10,s.base.y+20));(s as any).M=M;transformController.move({redraw(){}} as ToolHost,point(s.base.x+10,s.base.y+20));}
// Use the real controller's move handle to request a translation without a copied preview implementation.
function translate(h:ToolHost,dx:number,dy:number){const s=transformState()!;const p=point(s.base.x+8,s.base.y+18);transformController.down(h,p);transformController.move(h,point(p.x+dx,p.y+dy));transformController.up(h,point(p.x+dx,p.y+dy));}
function drain(e:RenderEngine){let n=0;while(e.hasPendingWork()&&n++<300)e.process(20);expect(e.hasPendingWork()).toBe(false);}
it('CPU fallback stages a whole generation under budget, progresses during continuous requests, then settles exactly',()=>{
 setGpuCompositor(null);const {d,l,s}=fixture();d.canvas.width=512;s.engine.lastVisible={level:0,tiles:[[0,0],[1,0]]};s.engine.renderLevelSync(0);const initial=s.engine.getTile(0,0,0)!;
 let clock=0;vi.spyOn(performance,'now').mockImplementation(()=>clock++);
 const ov=(v:number)=>new Map([[l.id,{read:(r:{w:number;h:number})=>{const f=new Float32Array(r.w*r.h*4);for(let i=0;i<r.w*r.h;i++){f[i*4]=v;f[i*4+3]=1;}return f;}}]]);
 s.engine.setPreviewOverrides(ov(.2));s.engine.process(1);expect(s.engine.getTile(0,0,0)).toBe(initial);
 s.engine.setPreviewOverrides(ov(.8));s.engine.process(1);expect(s.engine.getTile(0,0,0)?.data[0]).toBe(51);expect(s.engine.getTile(0,1,0)?.data[0]).toBe(51);
 const version=s.engine.getTile(0,0,0)!.version;s.engine.process(1);s.engine.setPreviewOverrides(ov(.4));s.engine.process(1);expect(s.engine.getTile(0,0,0)?.data[0]).toBe(204);expect(s.engine.getTile(0,1,0)?.data[0]).toBe(204);expect(s.engine.getTile(0,0,0)!.version).toBeGreaterThan(version);
 vi.restoreAllMocks();drain(s.engine);expect(s.engine.getTile(0,0,0)?.data[0]).toBe(102);
 s.engine.setPreviewOverrides(new Map(),true);drain(s.engine);expect(s.engine.coherentPreview).toBe(false);expect(s.engine.getTile(0,0,0)?.data[0]).not.toBe(102);
});
it.each(['move','scale','rotate','flip'] as const)('stable full-source GPU %s preserves off-canvas pixels and layer order; CPU commit remains exact',async kind=>{
 const {d,l,s,h}=fixture(true),before=cloneLayer(l),original=hash(l.raster);beginTransform();
 let M:Affine=kind==='move'?[1,0,0,1,32,20]:kind==='scale'?[.7,0,0,.7,30,24]:kind==='flip'?[-1,0,0,1,65,5]:multiply(translation(42,25),rotation(.31));
 // Parameter edits are requested through the production controller (the public state's matrix is its UI model).
 const state=transformState()!;(state as any).M=M;translate(h,0,0);
 const ov=s.engine.getOverride(l.id)!;expect(ov.gpu?.affine).toBeTruthy();drain(s.engine);
 const r={x:0,y:0,w:128,h:96},cpu=compositeRegion(d,r,{level:0,overrides:new Map([[l.id,{read:ov.read,includesMask:true}]])});
 const actual=await gpu.compositeRead(d,r,{level:0,overrides:new Map([[l.id,ov]])});expect(actual).not.toBeNull();expect(maxDiff(actual!,cpu).max).toBeLessThan(2/255);
 const uploads=gpu.affineAtlasUploads;await gpu.compositeRead(d,r,{level:0,overrides:new Map([[l.id,ov]])});expect(gpu.affineAtlasUploads).toBe(uploads);expect(hash(l.raster)).toBe(original);
 const expected=warpLayerRaster(before.raster,before.x,before.y,affineToHomography(transformState()!.M),'bicubic');commitTransform();expect(transformState()).toBeNull();drain(s.engine);
 const live=s.doc.getLayer(l.id)!;if(live.kind!=='pixel')throw Error('pixel');expect(hash(live.raster)).toBe(hash(expected.raster));expect([live.x,live.y]).toEqual([expected.x,expected.y]);expect(s.history.entries).toHaveLength(2);
 expect(s.history.undo()).toBe(true);expect(hash((s.doc.getLayer(l.id) as typeof l).raster)).toBe(original);expect(s.history.redo()).toBe(true);
 const reopened=decodeNative(encodeNative(d)).doc.getLayer(l.id)as typeof l;expect(hash(reopened.raster)).toBe(hash(live.raster));
});
it.each(['mask','blend','group','capacity'] as const)('unsupported %s retains coherent CPU preview and cancellation',condition=>{
 const {d,l,s,h}=fixture();if(condition==='mask')l.mask=createMask(true);if(condition==='blend')l.blendMode='multiply';if(condition==='group'){const g=createGroupLayer('group');add(d,g);}if(condition==='capacity')vi.spyOn(gpu,'canPrepareAffine').mockReturnValue(false);
 const before=hash(l.raster);beginTransform();translate(h,9,4);expect(s.engine.getOverride(l.id)?.gpu?.affine).toBeUndefined();drain(s.engine);cancelTransform();drain(s.engine);expect(hash((d.getLayer(l.id)as typeof l).raster)).toBe(before);expect(s.history.canUndo).toBe(false);
});
it('GPU loss/source change falls back at current parameters, and document switch cancels resources',()=>{
 const {l,s,h}=fixture();beginTransform();translate(h,10,5);const M=[...transformState()!.M];setGpuCompositor(null);s.engine.checkPreview();expect(transformState()!.M).toEqual(M);expect(s.engine.getOverride(l.id)?.gpu?.affine).toBeUndefined();drain(s.engine);cancelTransform();drain(s.engine);
 setGpuCompositor(gpu);beginTransform();translate(h,8,2);l.raster.writePixels({x:0,y:0,w:1,h:1},new Uint8ClampedArray([1,2,3,255]));s.engine.checkPreview();expect(transformState()).not.toBeNull();expect(s.engine.getOverride(l.id)?.gpu?.affine).toBeUndefined();
 editor.addDocument(newDoc(16,16));expect(transformState()).toBeNull();expect((s.engine as any).coherent?.finishing).toBe(true);drain(s.engine);
});
it.each(['prepare','handoff','float-write'] as const)('failure at %s restores source/history, retains parameters, allows retry or Escape',kind=>{
 const {d,l,s,h}=fixture();if(kind==='float-write')d.selection.setRegion({x:2,y:2,w:8,h:8},new Float32Array(64).fill(1));
 const initial=hash(l.raster);beginTransform();translate(h,10,4);const params=[...transformState()!.M],cut=hash((d.getLayer(l.id)as typeof l).raster),entry=s.history.current.id;
 if(kind==='prepare') {const orig=TiledRaster.prototype.readFloat;let failed=false;vi.spyOn(TiledRaster.prototype,'readFloat').mockImplementation(function(this:TiledRaster,...a){if(!failed){failed=true;throw Error('CPU preparation');}return orig.apply(this,a);});}
 if(kind==='handoff'){const orig=ReplaceLayerCommand.prototype.do;let failed=false;vi.spyOn(ReplaceLayerCommand.prototype,'do').mockImplementation(function(this:ReplaceLayerCommand,doc){orig.call(this,doc);if(!failed){failed=true;throw Error('after first swap');}});}
 if(kind==='float-write'){const target=(d.getLayer(l.id)as typeof l).raster,orig=target.writeFloat.bind(target);vi.spyOn(target,'writeFloat').mockImplementation((...a)=>{orig(...a);throw Error('after partial float write');});}
 commitTransform();expect(transformState()).not.toBeNull();expect(transformState()!.M).toEqual(params);expect(s.history.current.id).toBe(entry);expect(hash((d.getLayer(l.id)as typeof l).raster)).toBe(cut);vi.restoreAllMocks();
 if(kind==='float-write'){cancelTransform();expect(hash((d.getLayer(l.id)as typeof l).raster)).toBe(initial);}else{commitTransform();expect(transformState()).toBeNull();expect(s.history.entries).toHaveLength(2);expect(s.history.undo()).toBe(true);expect(hash((d.getLayer(l.id)as typeof l).raster)).toBe(initial);}
});

it.each([1,2])('zoom level %i uses reusable premultiplied mips and matches the CPU preview',async level=>{
 const {d,l,s,h}=fixture(true);s.engine.lastVisible={level,tiles:[[0,0]]};beginTransform();translate(h,12,9);drain(s.engine);
 const ov=s.engine.getOverride(l.id)!,r={x:0,y:0,w:128>>level,h:96>>level};expect(ov.gpu?.affine).toBeTruthy();
 const cpu=compositeRegion(d,r,{level,overrides:new Map([[l.id,{read:ov.read,includesMask:true}]])});const actual=await gpu.compositeRead(d,r,{level,overrides:new Map([[l.id,ov]])});expect(actual).not.toBeNull();expect(maxDiff(actual!,cpu).max).toBeLessThan(2/255);
});
it('viewport/color changes invalidate only preparation and retain a complete prior image until replacement',()=>{
 setGpuCompositor(null);const {s,l}=fixture();s.engine.renderLevelSync(0);s.engine.setPreviewOverrides(new Map([[l.id,{read:r=>new Float32Array(r.w*r.h*4).fill(.5)}]]));drain(s.engine);const old=s.engine.getTile(0,0,0);
 s.engine.lastVisible={level:1,tiles:[[0,0]]};expect(s.engine.holdPreviewFrame).toBe(true);s.engine.process(20);drain(s.engine);expect(s.engine.holdPreviewFrame).toBe(false);expect(s.engine.getTile(1,0,0)).toBeTruthy();
 s.engine.setView({channels:{r:true,g:false,b:false}});drain(s.engine);expect(s.engine.getTile(1,0,0)).not.toBe(old);
});
it('failed source preparation retries the same unit; cancellation and the next transform release old source ownership',()=>{
 const {l,s,h}=fixture();beginTransform();translate(h,6,4);const source=s.engine.getOverride(l.id)!.gpu!.affine!.raster,bounds=source.contentBounds()!;
 const get=vi.spyOn(source,'levelTile').mockImplementationOnce(()=>{throw Error('source readback');});expect(()=>gpu.prepareAffine(source,bounds,1,20)).toThrow('source readback');get.mockRestore();
 while(!gpu.prepareAffine(source,bounds,1,20)){}drain(s.engine);expect((gpu as any).affineSources.has(source)).toBe(true);cancelTransform();expect((gpu as any).affineSources.has(source)).toBe(false);drain(s.engine);
 beginTransform();translate(h,2,3);expect(s.engine.getOverride(l.id)!.gpu!.affine!.raster).not.toBe(source);cancelTransform();drain(s.engine);expect(s.history.canUndo).toBe(false);
});
it('a notification error after history insertion is a completed commit, and retry cannot duplicate it',()=>{
 const {s,h}=fixture();beginTransform();translate(h,8,3);let first=true;const off=s.history.on(()=>{if(first){first=false;throw Error('observer');}});commitTransform();off();expect(transformState()).toBeNull();expect(s.history.entries).toHaveLength(2);commitTransform();expect(s.history.entries).toHaveLength(2);
});

it('a failed CPU preview tile never publishes a partial frame and can retry or accept newer parameters',()=>{
 setGpuCompositor(null);const {s,l}=fixture();s.engine.renderLevelSync(0);const original=s.engine.getTile(0,0,0);let fail=true;
 s.engine.setPreviewOverrides(new Map([[l.id,{read:r=>{if(fail){fail=false;throw Error('preview preparation');}return new Float32Array(r.w*r.h*4).fill(.6);}}]]));
 expect(()=>s.engine.process(20)).toThrow('preview preparation');expect(s.engine.getTile(0,0,0)).toBe(original);drain(s.engine);expect(s.engine.getTile(0,0,0)).not.toBe(original);expect(s.engine.getTile(0,0,0)?.data[3]).toBe(153);
});
