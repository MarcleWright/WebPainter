// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
const io=vi.hoisted(()=>({kind:'electron',canWriteInPlace:true,bridge:null,setTitle(){},setEdited(){},chooseSavePath:vi.fn(),writePath:vi.fn(),confirm:vi.fn(),recovery:{save:vi.fn(),remove:vi.fn()}}));
vi.mock('../../src/app/platform/platform',()=>({platform:()=>io}));
import {TransformWorkerEngine} from '../../src/tools/transformWorker';
import {startTransformTask} from '../../src/tools/transformTask';
import {planTransforms} from '../../src/image-engine/transformPlan';
import {TiledRaster} from '../../src/image-engine/tiledRaster';
import {warpLayerRaster} from '../../src/app/ops/imageOps';
import * as imageOps from '../../src/app/ops/imageOps';
import {affineToHomography,rectToQuad,multiplyH,type Homography} from '../../src/image-engine/matrix';
import {editor} from '../../src/app/editor';
import {beginTransform,commitTransform,cancelTransform,transformState,setTransformNumbers,transformController,transformLayersByMatrix} from '../../src/tools/transformTool';
import {newDoc,add} from '../helpers/build';
import {createPixelLayer} from '../../src/document/layerFactory';
import {cloneLayer} from '../../src/document/clone';
import {SetLayerPropsCommand,ReplaceLayerCommand} from '../../src/commands/layerCommands';
import {encodeNative,decodeNative} from '../../src/document/native';
import {saveAs,closeSession} from '../../src/app/fileOps';
import {autosaveNow} from '../../src/app/autosave';
import {ui} from '../../src/app/store';
class FakeWorker {
 static all:FakeWorker[]=[];static mode='normal';
 onmessage:((e:any)=>void)|null=null;onerror:((e:any)=>void)|null=null;onmessageerror:(()=>void)|null=null;
 terminated=false;held:(()=>void)|null=null;
 engine=new TransformWorkerEngine((m,t)=>{if(FakeWorker.mode==='corrupt'&&m.type==='done')m.pixels++;const data=structuredClone(m,{transfer:t as any??[]});setTimeout(()=>{if(data.type==='tile')data.data=new Uint8ClampedArray(data.data);if(!this.terminated)this.onmessage?.({data});},0);});
 constructor(){FakeWorker.all.push(this);}
 postMessage(m:any,t:any[]=[]){const data=structuredClone(m,{transfer:t});setTimeout(()=>{
  if(this.terminated)return;
  if(data.type==='init'&&FakeWorker.mode==='unavailable'){this.onerror?.({message:'load failed'});return;}
  if(data.type==='start'&&FakeWorker.mode==='fail'){this.onmessage?.({data:{id:data.id,type:'error',message:'runtime failure'}});return;}
  if(data.type==='source')data.data=new Uint8ClampedArray(data.data);
  const run=()=>void this.engine.receive(data).catch(e=>this.onerror?.({message:String(e)}));
  if(data.type==='start'&&FakeWorker.mode==='hold'){this.held=run;return;}run();
 },0);}
 terminate(){this.terminated=true;}
}
const hash=(r:TiledRaster)=>createHash('sha256').update(new Uint8Array(r.readPixels(r.tileBounds()??{x:0,y:0,w:1,h:1}).buffer)).digest('hex');
function source(w=129,h=97){const a=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;a.set([(x*13+y*7)%256,(x*3+y*17)%256,(x*19+y*5)%256,(x+y)%9===0?0:80+(x*11+y*3)%176],i);}return TiledRaster.fromPixels(w,h,4,8,a);}
function plan(r:TiledRaster,H:Homography,x=0,y=0){return planTransforms(H,[{bounds:r.contentBounds()!,x,y,channels:4,depth:8,bytes:r.tiles.size*r.tileLength}])[0];}
const sleep=()=>new Promise(r=>setTimeout(r,5));
async function held(){for(let i=0;i<200&&!FakeWorker.all.at(-1)?.held;i++)await sleep();expect(FakeWorker.all.at(-1)?.held).toBeTruthy();}
function fixture(){const d=newDoc(256,192),l=createPixelLayer('source',8,source());l.x=-12;l.y=-8;add(d,l);const s=editor.addDocument(d);s.setActive(l.id);editor.hostFactory=()=>({editor,session:s,redraw(){},setCursor(){},viewportSize:()=>({w:800,h:600})});beginTransform();setTransformNumbers({w:73,h:81,angle:17,x:90,y:65});return{d,l,s};}
beforeEach(()=>{vi.stubGlobal('Worker',FakeWorker);FakeWorker.all=[];FakeWorker.mode='normal';io.chooseSavePath.mockResolvedValue('background.psd');io.writePath.mockResolvedValue(undefined);io.recovery.remove.mockResolvedValue(undefined);io.confirm.mockResolvedValue(1);});
afterEach(()=>{cancelTransform();for(const s of [...editor.sessions])editor.removeSession(s.id);vi.restoreAllMocks();vi.unstubAllGlobals();vi.clearAllMocks();ui.set({progress:[]});});
it.each(['move','scale','rotate','flip','quad'] as const)('private worker %s matches the untouched CPU reference including transparent/off-canvas source',async kind=>{
 const r=source(),before=hash(r),H:Homography=kind==='move'?[1,0,17,0,1,-9,0,0,1]:kind==='scale'?[.73,0,2,0,.83,-4,0,0,1]:kind==='rotate'?[.97,-.24,9,.24,.97,3,0,0,1]:kind==='flip'?[-1,0,150,0,1,4,0,0,1]:rectToQuad(129,97,[{x:-5,y:2},{x:125,y:-8},{x:115,y:90},{x:0,y:99}]);
 const p=plan(r,H,-12,-8),task=startTransformTask(r,p,'test-'+kind,()=>{},()=>new FakeWorker() as any),actual=await task.promise;
 const expected=warpLayerRaster(r,-12,-8,H,'bicubic');expect([p.output.x,p.output.y]).toEqual([expected.x,expected.y]);expect(hash(actual)).toBe(hash(expected.raster));expect(hash(r)).toBe(before);expect(task.metrics.peakInFlightBytes).toBeLessThanOrEqual(256*256*4);expect(FakeWorker.all[0].terminated).toBe(true);
});
it('preserves original 1024 sampling context across projective mip thresholds, rather than sampling each transfer tile',async()=>{
 const r=source(4096,127),H:Homography=[1,0,-10,0,1,7,.0003,0,1],p=plan(r,H),expected=warpLayerRaster(r,0,0,H,'bicubic');
 const task=startTransformTask(r,p,'mip',()=>{},()=>new FakeWorker()as any),out=await task.promise;expect(p.logical.length).toBeGreaterThan(1);expect(hash(out)).toBe(hash(expected.raster));
 const {warpRaster}=await import('../../src/image-engine/resample'),wrong=new TiledRaster(4,8);
 for(let y=p.output.y;y<p.output.y+p.output.h;y+=256)for(let x=p.output.x;x<p.output.x+p.output.w;x+=256){const b={x,y,w:Math.min(256,p.output.x+p.output.w-x),h:Math.min(256,p.output.y+p.output.h-y)};wrong.writeFloat({...b,x:x-p.output.x,y:y-p.output.y},warpRaster(r,p.bounds,p.inverse,b,'bicubic'));}
 expect(hash(wrong)).not.toBe(hash(out));
});
it('holds external editing/history closed through its own one-step commit; undo/redo/native are exact',async()=>{
 const {d,l,s}=fixture(),original=hash(l.raster),H=affineToHomography(transformState()!.M),expected=warpLayerRaster(l.raster,l.x,l.y,H,'bicubic');let observed=false;
 const off=d.on(()=>{if(!s.transformPending)return;observed=true;expect(s.canEdit()).toBe(false);expect(s.history.undo()).toBe(false);const n=s.history.entries.length;s.push(new SetLayerPropsCommand('external',l.id,{opacity:1},{opacity:.2}));expect(s.history.entries.length).toBe(n);});
 commitTransform();const pending=s.transformPending;expect(pending).not.toBeNull();expect(s.canEdit()).toBe(false);commitTransform();expect(FakeWorker.all).toHaveLength(1);expect(await pending).toBe(true);off();expect(observed).toBe(true);expect(s.canEdit()).toBe(true);expect(s.history.entries).toHaveLength(2);
 const live=d.getLayer(l.id)as typeof l;expect(hash(live.raster)).toBe(hash(expected.raster));expect([live.x,live.y]).toEqual([expected.x,expected.y]);expect(s.history.undo()).toBe(true);expect(hash((d.getLayer(l.id)as typeof l).raster)).toBe(original);expect(s.history.redo()).toBe(true);expect(hash((decodeNative(encodeNative(d)).doc.getLayer(l.id)as typeof l).raster)).toBe(hash(expected.raster));
});
it.each(['huge','singular','nonfinite','memory','quad'] as const)('rejects %s before Worker or synchronous CPU mutation and retains parameters',condition=>{
 const {l,s}=fixture(),before=hash(l.raster),state=transformState()as any;
 if(condition==='huge')state.M=[10000,0,0,10000,0,0];if(condition==='singular')state.M=[1,0,0,0,0,0];if(condition==='nonfinite')state.M=[NaN,0,0,1,0,0];if(condition==='memory')state.M=[60,0,0,60,0,0];if(condition==='quad')state.quad=[{x:0,y:0},{x:100,y:100},{x:100,y:0},{x:0,y:100}];
 const cpu=vi.spyOn(imageOps,'warpLayerRaster');commitTransform();expect(cpu).not.toHaveBeenCalled();expect(FakeWorker.all).toHaveLength(0);expect(hash(l.raster)).toBe(before);expect(s.history.entries).toHaveLength(1);expect(transformState()).toBe(state);expect(s.canEdit()).toBe(true);
});
it.each(['cancel','switch','close-direct'] as const)('%s terminates a live job, settles waiters and ignores late results',async kind=>{
 FakeWorker.mode='hold';const {l,s}=fixture(),before=hash(l.raster);commitTransform();const pending=s.transformPending!;await held();const worker=FakeWorker.all[0];
 if(kind==='cancel')ui.get().progress.at(-1)!.cancel!();else if(kind==='switch')editor.addDocument(newDoc(8,8));else editor.removeSession(s.id);
 expect(await pending).toBe(false);expect(worker.terminated).toBe(true);worker.onmessage?.({data:{type:'done',id:'old',pixels:1}});expect(hash(l.raster)).toBe(before);expect(s.history.entries).toHaveLength(1);expect(s.transformPending).toBeNull();if(kind==='cancel'){expect(transformState()).not.toBeNull();expect(s.canEdit()).toBe(true);FakeWorker.mode='normal';commitTransform();expect(await s.transformPending).toBe(true);expect(s.history.entries).toHaveLength(2);}
});
it('runtime worker failure ends a waiting save without CPU fallback or a false save, then allows retry',async()=>{
 FakeWorker.mode='hold';const {l,s}=fixture(),before=hash(l.raster);commitTransform();const pending=s.transformPending!;await held();const saving=saveAs(s);await sleep();expect(io.writePath).not.toHaveBeenCalled();expect(s.canEdit()).toBe(false);
 const worker=FakeWorker.all[0];worker.onerror?.({message:'runtime failed'});expect(await pending).toBe(false);expect(await saving).toBe(false);expect(io.writePath).not.toHaveBeenCalled();expect(hash(l.raster)).toBe(before);expect(s.canEdit()).toBe(true);expect(transformState()).not.toBeNull();expect(s.history.entries).toHaveLength(1);
 FakeWorker.mode='normal';commitTransform();expect(await s.transformPending).toBe(true);expect(await saveAs(s)).toBe(true);
});
it('successful save/close wait for the transform without releasing its protection',async()=>{
 FakeWorker.mode='hold';const {s}=fixture();commitTransform();const pending=s.transformPending!;await held();const saving=saveAs(s);await sleep();expect(s.editProtected).toBe(true);FakeWorker.all[0].held!();expect(await pending).toBe(true);expect(await saving).toBe(true);expect(s.modified).toBe(false);expect(await closeSession(s)).toBe(true);
});
it('owner release cannot release another owner and an already open output dialog cannot unlock a new transform',async()=>{
 const {s}=fixture();cancelTransform();const a=s.acquireEditProtection('output'),b=s.acquireEditProtection('transform');s.releaseEditProtection(a);s.editProtected=false;expect(s.canEdit()).toBe(false);s.releaseEditProtection(b);expect(s.canEdit()).toBe(true);
});
it('partial authority swap failure restores pixels/history and permits retry; post-history notification error does not duplicate',async()=>{
 const {l,s}=fixture(),before=hash(l.raster),orig=ReplaceLayerCommand.prototype.do;let fail=true;vi.spyOn(ReplaceLayerCommand.prototype,'do').mockImplementation(function(this:ReplaceLayerCommand,d){orig.call(this,d);if(fail){fail=false;throw Error('partial swap');}});commitTransform();expect(await s.transformPending).toBe(false);expect(hash((s.doc.getLayer(l.id)as typeof l).raster)).toBe(before);expect(s.history.entries).toHaveLength(1);expect(transformState()).not.toBeNull();vi.restoreAllMocks();
 let first=true;const off=s.history.on(()=>{if(first){first=false;throw Error('notification');}});commitTransform();expect(await s.transformPending).toBe(true);off();expect(s.history.entries).toHaveLength(2);expect(transformState()).toBeNull();commitTransform();expect(s.history.entries).toHaveLength(2);
});
it('loaded capability failure may use the bounded CPU path once, while stale source results never install',async()=>{
 FakeWorker.mode='unavailable';const {l,s}=fixture();commitTransform();expect(await s.transformPending).toBe(true);expect(s.history.entries).toHaveLength(2);cancelTransform();
 beginTransform();setTransformNumbers({x:100});FakeWorker.mode='hold';commitTransform();const pending=s.transformPending!;await held();(s.doc.getLayer(l.id)as typeof l).raster.writePixels({x:0,y:0,w:1,h:1},new Uint8ClampedArray([1,2,3,255]));FakeWorker.all.at(-1)!.held!();expect(await pending).toBe(false);expect(s.history.entries).toHaveLength(2);expect(transformState()).not.toBeNull();
});

it('rejects total memory and inverse horizons before allocation even for an otherwise finite transform',()=>{
 expect(()=>planTransforms([1,0,0,0,1,0,0,0,1],[{bounds:{x:0,y:0,w:4096,h:4096},x:0,y:0,channels:4,depth:32,bytes:4096*4096*16}])).toThrow(/budget/);
 expect(()=>planTransforms([1,0,0,0,1,0,-.02,0,1],[{bounds:{x:0,y:0,w:100,h:100},x:0,y:0,channels:4,depth:8,bytes:65536*4}])).toThrow(/horizon/);
});
it('Worker absence still applies common admission; legal CPU fallback is explicit and exact',()=>{
 vi.stubGlobal('Worker',undefined);const {l,s}=fixture(),state=transformState()as any,original=[...state.M];state.M=[1e5,0,0,1e5,0,0];const cpu=vi.spyOn(imageOps,'warpLayerRaster');commitTransform();expect(cpu).not.toHaveBeenCalled();state.M=original;commitTransform();expect(cpu).toHaveBeenCalledTimes(1);expect(transformState()).toBeNull();expect(s.history.entries).toHaveLength(2);
});
it.each([false,true])('close waits for a running job and handles failure=%s without unlocking early',async failed=>{
 FakeWorker.mode='hold';const {s}=fixture();commitTransform();const job=s.transformPending!;await held();const closing=closeSession(s);await sleep();expect(s.canEdit()).toBe(false);expect(editor.session(s.id)).toBe(s);
 if(failed)FakeWorker.all[0].onerror?.({message:'worker died'});else FakeWorker.all[0].held!();expect(await job).toBe(!failed);expect(await closing).toBe(!failed);if(failed){expect(s.closePending).toBeNull();expect(s.canEdit()).toBe(true);expect(transformState()).not.toBeNull();}else expect(editor.session(s.id)).toBeUndefined();
});
it('autosave waits for the stable transformed authority and ignores failed preview jobs',async()=>{
 FakeWorker.mode='hold';const {s}=fixture();commitTransform();const job=s.transformPending!;await held();const saving=autosaveNow();await sleep();expect(io.recovery.save).not.toHaveBeenCalled();FakeWorker.all[0].held!();expect(await job).toBe(true);expect(await saving).toBe(1);expect(io.recovery.save).toHaveBeenCalledTimes(1);
});
it('bad result receipts never install partial output and retain retryable parameters',async()=>{
 FakeWorker.mode='corrupt';const {l,s}=fixture(),before=hash(l.raster);commitTransform();expect(await s.transformPending).toBe(false);expect(hash(l.raster)).toBe(before);expect(s.history.entries).toHaveLength(1);expect(transformState()).not.toBeNull();expect(s.canEdit()).toBe(true);
});
it('external source edits before Enter are recaptured at the current parameters',async()=>{
 const {l,s}=fixture();l.raster.writePixels({x:0,y:0,w:1,h:1},new Uint8ClampedArray([7,8,9,255]));const expected=warpLayerRaster(l.raster,l.x,l.y,affineToHomography(transformState()!.M),'bicubic');commitTransform();expect(await s.transformPending).toBe(true);expect(hash((s.doc.getLayer(l.id)as typeof l).raster)).toBe(hash(expected.raster));
});
it('cancelled output-dialog cleanup cannot release another operation owner',async()=>{
 const {s}=fixture();cancelTransform();let choose!:(path:string|null)=>void;io.chooseSavePath.mockImplementation(()=>new Promise(r=>choose=r));const saving=saveAs(s);await sleep();beginTransform();expect(transformState()).toBeNull();const token=s.acquireEditProtection('transform');choose(null);expect(await saving).toBe(false);expect(s.canEdit()).toBe(false);s.releaseEditProtection(token);expect(s.canEdit()).toBe(true);
});

it('budgets all three source mip owners and complete floating placement buffers',()=>{
 const input={bounds:{x:0,y:0,w:4096,h:4096},x:0,y:0,channels:4 as const,depth:8 as const,bytes:4096*4096*4};
 expect(()=>planTransforms([1.32,0,0,0,1.32,0,0,0,1],[input])).toThrow(/budget/);
 expect(()=>planTransforms([1,0,0,0,1,0,0,0,1],[input],null,4096*4096*32)).toThrow(/budget/);
});

it('retains the CPU division order at symmetric perspective ceil boundaries',async()=>{
 const r=source(128,128),H=rectToQuad(128,128,[{x:0,y:0},{x:143,y:0},{x:113,y:120.5},{x:0,y:128}]),p=plan(r,H),expected=warpLayerRaster(r,0,0,H,'bicubic');expect(p.output.w).toBe(143);const actual=await startTransformTask(r,p,'roundoff',()=>{},()=>new FakeWorker()as any).promise;expect(hash(actual)).toBe(hash(expected.raster));
});

it('identity confirmation starts no Worker and records no history',()=>{
 const {s}=fixture();cancelTransform();beginTransform();commitTransform();expect(FakeWorker.all).toHaveLength(0);expect(transformState()).toBeNull();expect(s.history.entries).toHaveLength(1);expect(s.canEdit()).toBe(true);
});
it('the explicit synchronous fallback also protects external editing during its own history write',()=>{
 vi.stubGlobal('Worker',undefined);const {l,s}=fixture();let observed=false;const off=s.doc.on(()=>{observed=true;expect(s.canEdit()).toBe(false);expect(s.history.undo()).toBe(false);});commitTransform();off();expect(observed).toBe(true);expect(s.history.entries).toHaveLength(2);expect(s.canEdit()).toBe(true);
});

it('matrix replay uses the same capacity admission and cannot bypass an unsafe transform',()=>{
 const {l,s}=fixture();cancelTransform();const before=hash(l.raster),cpu=vi.spyOn(imageOps,'warpLayerRaster');expect(transformLayersByMatrix(s,[l.id],[1e5,0,0,0,1e5,0,0,0,1],true)).toBe(false);expect(cpu).not.toHaveBeenCalled();expect(hash(l.raster)).toBe(before);expect(s.history.entries).toHaveLength(1);
 expect(transformLayersByMatrix(s,[l.id],[1,0,7,0,1,3,0,0,1],true)).toBe(true);expect(s.history.entries).toHaveLength(2);expect(s.history.current.command?.record?.action).toBe('edit.freeTransformApply');
});
