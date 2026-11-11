// @vitest-environment jsdom
import {afterEach,afterAll,beforeAll,expect,it,vi}from'vitest';
import {createHash}from'node:crypto';
import {editor}from'../../src/app/editor';
import {beginTransform,commitTransform,cancelTransform,transformState,transformController}from'../../src/tools/transformTool';
import {setGpuCompositor}from'../../src/rendering/renderEngine';
import {GpuCompositor}from'../../src/gpu/compositor';
import {testDevice,maxDiff}from'../helpers/gpu';
import {newDoc,add,solidLayer}from'../helpers/build';
import {TiledRaster}from'../../src/image-engine/tiledRaster';
import {warpLayerRaster}from'../../src/app/ops/imageOps';
import {rectToQuad,multiplyH,applyH,type Quad,type Homography}from'../../src/image-engine/matrix';
import {compositeRegion}from'../../src/rendering/compositor';
import type {ToolHost,ToolPointer}from'../../src/tools/tool';
let gpu:GpuCompositor;
beforeAll(async()=>{const d=await testDevice();if(!d)throw Error('GPU required');gpu=new GpuCompositor(d);setGpuCompositor(gpu);editor.registerModeController('transform',transformController);});
afterEach(()=>{vi.restoreAllMocks();cancelTransform();for(const s of [...editor.sessions])editor.removeSession(s.id);setGpuCompositor(gpu);});
afterAll(()=>{setGpuCompositor(null);gpu.dispose();});
const hash=(r:TiledRaster)=>createHash('sha256').update(new Uint8Array(r.readPixels(r.tileBounds()??{x:0,y:0,w:1,h:1}).buffer)).digest('hex');
const point=(x:number,y:number,combined=false):ToolPointer=>({x,y,sx:x,sy:y,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,mod:true,alt:combined,shift:combined,time:0,pointerType:'mouse',clickCount:1});
function fixture(w=160,h=130,canvasW=176,canvasH=128){const d=newDoc(canvasW,canvasH);add(d,solidLayer(d,'under',0,0,canvasW,canvasH,[.1,.5,.2,1]));const l=solidLayer(d,'source',-12,7,w,h,[.7,.2,.8,.7]);const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;data.set([(x*13+y*7)%256,(x*3+y*17)%256,(x*19+y*5)%256,(x+y)%9===0?0:80+(x*11+y*3)%176],i);}l.raster.clear();l.raster.writePixels({x:-31,y:-17,w,h},data);add(d,l);add(d,solidLayer(d,'above',20,16,30,22,[.2,.8,.1,.9]));const s=editor.addDocument(d);s.setActive(l.id);const host:ToolHost={editor,session:s,redraw(){},setCursor(){},viewportSize:()=>({w:800,h:600})};editor.hostFactory=()=>host;s.engine.lastVisible={level:0,tiles:[[0,0]]};return{d,l,s,host};}
function drag(host:ToolHost,combined=false,dx=-30,dy=-12){const b=transformState()!.base,p=point(b.x+b.w,b.y+b.h,combined);transformController.down(host,p);transformController.move(host,point(p.x+dx,p.y+dy,combined));transformController.up(host,point(p.x+dx,p.y+dy,combined));}
function drain(s:ReturnType<typeof fixture>['s']){let n=0;while(s.engine.hasPendingWork()&&n++<500)s.engine.process(20);expect(s.engine.hasPendingWork()).toBe(false);}
function H(){const s=transformState()!;return multiplyH(rectToQuad(s.base.w,s.base.h,s.quad!),[1,0,-s.base.x,0,1,-s.base.y,0,0,1]);}
it.each([false,true])('real Ctrl corner path combined=%s is projective, ordered and exact at commit',async combined=>{
 const {d,l,s,host}=fixture(),before=hash(l.raster);beginTransform();drag(host,combined);expect(transformState()!.quad).not.toBeNull();const ov=s.engine.getOverride(l.id)!;expect(ov.gpu?.affine?.projective).toBe(true);drain(s);
 const r={x:0,y:0,w:176,h:128},cpu=compositeRegion(d,r,{level:0,overrides:new Map([[l.id,{read:ov.read,includesMask:true}]])}),actual=await gpu.compositeRead(d,r,{level:0,overrides:new Map([[l.id,ov]])});expect(actual).not.toBeNull();expect(maxDiff(actual!,cpu).max).toBeLessThan(4/255);expect(hash(l.raster)).toBe(before);
 const expected=warpLayerRaster(l.raster,l.x,l.y,H(),'bicubic');commitTransform();expect(transformState()).toBeNull();drain(s);const live=d.getLayer(l.id)as typeof l;expect(hash(live.raster)).toBe(hash(expected.raster));expect([live.x,live.y]).toEqual([expected.x,expected.y]);expect(s.history.entries).toHaveLength(2);s.history.undo();expect(hash((d.getLayer(l.id)as typeof l).raster)).toBe(before);s.history.redo();expect(hash((d.getLayer(l.id)as typeof l).raster)).toBe(hash(expected.raster));
});
it.each([1,2])('projective zoom level %i preserves premultiplied transparent edges',async level=>{
 const {d,l,s,host}=fixture();s.engine.lastVisible={level,tiles:[[0,0]]};beginTransform();drag(host);drain(s);const ov=s.engine.getOverride(l.id)!,r={x:0,y:0,w:176>>level,h:128>>level};const cpu=compositeRegion(d,r,{level,overrides:new Map([[l.id,{read:ov.read,includesMask:true}]])}),actual=await gpu.compositeRead(d,r,{level,overrides:new Map([[l.id,ov]])});expect(actual).not.toBeNull();expect(maxDiff(actual!,cpu).max).toBeLessThan(4/255);
});
it('spatial projective minification prepares multiple stable mips and does not reupload unchanged source',async()=>{
 const {d,l,s,host}=fixture(4096,127,2048,160);l.x=0;l.y=0;const sourceBounds=l.raster.contentBounds()!,forward:Homography=[1,0,0,0,1,0,.0003,0,1];beginTransform();const state=transformState()as any,b=state.base;
 state.quad=[{x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h}].map(p=>applyH(forward,p.x,p.y));
 s.engine.lastVisible={level:0,tiles:Array.from({length:8},(_,x)=>[x,0]as[number,number])};const p=point(100,40);p.mod=false;transformController.down(host,p);transformController.move(host,p);transformController.up(host,p);drain(s);
 const ov=s.engine.getOverride(l.id)!;expect(ov.gpu?.affine?.projective).toBe(true);const levels=(gpu as any).affineSources.get(ov.gpu!.affine!.raster)as Map<number,unknown>;expect(levels.has(0)).toBe(true);expect([...levels.keys()].some(n=>n>0)).toBe(true);const uploads=gpu.affineAtlasUploads;
 for(const x of [0,1024,1536]){const r={x,y:0,w:256,h:160},cpu=compositeRegion(d,r,{level:0,overrides:new Map([[l.id,{read:ov.read,includesMask:true}]])}),actual=await gpu.compositeRead(d,r,{level:0,overrides:new Map([[l.id,ov]])});expect(actual).not.toBeNull();expect(maxDiff(actual!,cpu).max).toBeLessThan(4/255);}
 expect(gpu.affineAtlasUploads).toBe(uploads);expect(gpu.canPrepareProjective({...sourceBounds,w:100000},8)).toBe(false);
});
it('continuous quad requests publish frozen complete generations while latest parameters continue advancing',()=>{
 const {d,s,host}=fixture(160,130,512,256);s.engine.lastVisible={level:0,tiles:[[0,0],[1,0]]};beginTransform();drain(s);let clock=0;vi.spyOn(performance,'now').mockImplementation(()=>clock++);const revisions=new Set<number>();
 const b=transformState()!.base,p=point(b.x+b.w,b.y+b.h);transformController.down(host,p);
 for(let i=1;i<=24;i++){transformController.move(host,point(p.x-i,p.y-i*.3));s.engine.process(8);const c=(s.engine as any).coherent;if(c?.presented){revisions.add(c.presented);const tiles=s.engine.lastVisible.tiles.map(([x,y])=>s.engine.getTile(0,x,y));expect(new Set(tiles.map(t=>t?.previewRevision)).size).toBe(1);}}
 vi.restoreAllMocks();expect(revisions.size).toBeGreaterThan(2);transformController.up(host,point(p.x-24,p.y-7.2));drain(s);expect(s.history.entries).toHaveLength(1);
});
it('invalid/crossed or over-capacity parameters allocate neither new GPU work nor CPU preview and remain recoverable',()=>{
 const {l,s,host}=fixture();beginTransform();drain(s);const old=s.engine.getOverride(l.id),prepare=vi.spyOn(gpu,'prepareAffine'),read=vi.spyOn(TiledRaster.prototype,'readFloat');const b=transformState()!.base,p=point(b.x+b.w,b.y+b.h);transformController.down(host,p);transformController.move(host,point(b.x-30,b.y-30));expect(transformState()!.previewError).toBeTruthy();expect(s.engine.getOverride(l.id)).toBe(old);expect(prepare).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();commitTransform();expect(s.history.entries).toHaveLength(1);expect(transformState()).not.toBeNull();transformController.move(host,point(p.x-20,p.y-10));expect(transformState()!.previewError).toBeUndefined();drain(s);cancelTransform();drain(s);expect(s.history.entries).toHaveLength(1);
});
it.each(['capacity','device']as const)('safe projective %s fallback preserves the current quad and releases ownership',condition=>{
 const {l,s,host}=fixture();beginTransform();if(condition==='capacity')vi.spyOn(gpu,'canPrepareProjective').mockReturnValue(false);drag(host);const q=structuredClone(transformState()!.quad);if(condition==='device'){setGpuCompositor(null);s.engine.checkPreview();}expect(s.engine.getOverride(l.id)?.gpu?.affine).toBeUndefined();expect(transformState()!.quad).toEqual(q);drain(s);cancelTransform();drain(s);expect(s.history.entries).toHaveLength(1);
});
