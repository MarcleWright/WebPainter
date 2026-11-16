// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {initializeEditor} from '../../src/embedded/editor';
import {editor} from '../../src/app/editor';
import {ui} from '../../src/app/store';
import {createNative,decodeNative} from '../../src/document/native';
import {PenTool} from '../../src/tools/penTools';
import {readPenSession,finishPen} from '../../src/tools/penSession';
import {beginTransform,commitTransform,cancelTransform,setTransformNumbers,transformState} from '../../src/tools/transformTool';
import {TransformWorkerEngine} from '../../src/tools/transformWorker';
import {run,action} from '../../src/app/actions';
import type {HostPort,Output} from '../../src/embedded/contract';
import type {ToolPointer,ToolHost} from '../../src/tools/tool';
vi.mock('../../src/embedded/checkpoint-output',()=>({checkpointOutput:async(d:any,kind:string)=>({bytes:(await import('../../src/document/native')).encodeNative(d),preview:kind==='generation'?await (await import('../../src/formats/registry')).exporters.find(e=>e.id==='png')!.export(d,{}):undefined})}));
let api:ReturnType<typeof initializeEditor>|undefined;
afterEach(()=>{cancelTransform();for(const s of [...editor.sessions]){finishPen(s);editor.removeSession(s.id);}api?.destroy();api=undefined;editor.hostFactory=null;vi.restoreAllMocks();vi.unstubAllGlobals();ui.set({dialogs:[],progress:[],tool:'brush'});});
async function open(save:HostPort['save']=async()=>{},entries:NonNullable<HostPort['capabilityPolicy']>['entries']={}){
 const events:any[]=[];api=initializeEditor({nativeVersion:1,capabilityPolicy:{version:1,entries},readResource:async()=>({name:'fixture.wpnative',bytes:createNative(32,24)}),save,export:async()=>{},confirm:async()=>0,dirty:s=>events.push(s),error(){}});await api.open('same-edit-instance','resource');
 const s=editor.active!,h:ToolHost={editor,session:s,redraw(){},setCursor(){},viewportSize:()=>({w:320,h:240})};editor.hostFactory=()=>h;return{s,h,events};
}
const point=(x:number,y:number):ToolPointer=>({x,y,sx:x,sy:y,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,shift:false,alt:false,mod:false,pointerType:'mouse',time:0,clickCount:1});
function draft(h:ToolHost){editor.setTool('pen');ui.setToolOptions('pen',{mode:'path'});const pen=editor.currentTool as PenTool;for(const [x,y]of [[2,2],[20,2],[20,18]]){pen.down(h,point(x,y));pen.up();}return pen;}
it('real Pen between clicks defers background and recovery; explicit generation ends once and releases busy notification',async()=>{
 let saved:Output|undefined;const {s,h,events}=await open(async o=>{saved=o;});const pen=draft(h),owner=readPenSession(s),checkpoint=s.history.current.id;
 expect(pen.busy()).toBe(false);expect(api!.state().hasUncommittedChanges).toBe(true);expect(events.at(-1).hasUncommittedChanges).toBe(true);
 expect(await api!.saveBackground()).toBe('deferred');await expect(api!.captureNative()).rejects.toThrow('deferred');expect(readPenSession(s)).toBe(owner);expect(s.history.current.id).toBe(checkpoint);
 const output=await api!.saveAndCapture();expect(output).toBe(saved);expect(output.preview!.length).toBeGreaterThan(0);expect(readPenSession(s)).toBeNull();expect(s.history.entries).toHaveLength(2);expect(decodeNative(output.bytes).doc.paths[0].path.subpaths[0].knots).toHaveLength(3);expect(api!.state().hasUncommittedChanges).toBe(false);expect(events.at(-1).hasUncommittedChanges).toBe(false);
 await api!.save();expect(s.history.entries).toHaveLength(2);
});
class HeldWorker {
 static all:HeldWorker[]=[];onmessage:((e:any)=>void)|null=null;onerror:((e:any)=>void)|null=null;onmessageerror:any=null;held:(()=>void)|null=null;terminated=false;
 engine=new TransformWorkerEngine((m,t)=>{const data=structuredClone(m,{transfer:t as any??[]});setTimeout(()=>{if(data.type==='tile')data.data=new Uint8ClampedArray(data.data);if(!this.terminated)this.onmessage?.({data});},0);});
 constructor(){HeldWorker.all.push(this);}
 postMessage(m:any,t:any[]=[]){const data=structuredClone(m,{transfer:t});setTimeout(()=>{if(this.terminated)return;if(data.type==='source')data.data=new Uint8ClampedArray(data.data);const work=()=>void this.engine.receive(data).catch(e=>this.onerror?.({message:String(e)}));if(data.type==='start'){this.held=work;return;}work();},0);}
 terminate(){this.terminated=true;}
}
async function applying(){vi.stubGlobal('Worker',HeldWorker);HeldWorker.all=[];const l=editor.active!.activeLayer()!;if(l.kind!=='pixel')throw Error('fixture');l.raster.writePixels({x:1,y:1,w:3,h:3},new Uint8ClampedArray(36).fill(255));beginTransform();setTransformNumbers({x:7,y:8,w:6,h:6});commitTransform();await vi.waitFor(()=>expect(HeldWorker.all.at(-1)?.held).toBeTypeOf('function'));return HeldWorker.all.at(-1)!;}
it('applying keeps original instance/task and reserves explicit native output; late save receipt cannot mark later edits clean',async()=>{
 let release!:()=>void,output!:Output;const {s}=await open(async o=>{output=o;await new Promise<void>(r=>release=r);});const worker=await applying(),task=s.transformPending,generation=api!.state().generation;
 expect(await api!.saveBackground()).toBe('deferred');await expect(api!.captureNative()).rejects.toThrow('deferred');const save=api!.saveAndCapture();expect(s.canEdit()).toBe(false);await expect(api!.saveAndCapture()).rejects.toThrow('busy');expect(()=>api!.destroy()).toThrow('close');
 // Transport/epoch renewal is host-owned. Polling the live port must not rebuild or relabel it.
 expect(editor.active).toBe(s);expect(s.transformPending).toBe(task);expect(api!.state().generation).toBe(generation);worker.held!();expect(await task).toBe(true);await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
 const operation={generation:output.generation,operationId:output.operationId,binding:output.binding,checkpoint:output.checkpoint};expect(s.canEdit()).toBe(true);await run('layer.copyContext');expect(s.modified).toBe(true);release();expect(await save).toBe(output);expect(s.modified).toBe(true);expect({generation:output.generation,operationId:output.operationId,binding:output.binding,checkpoint:output.checkpoint}).toEqual(operation);expect(worker.terminated).toBe(true);
});
it('applying cancellation fails waiting output without saving; retry then close waits exact authority',async()=>{
 const writes:Output[]=[];const {s}=await open(async o=>{writes.push(o);});const old=await applying(),pending=api!.save();ui.get().progress.at(-1)!.cancel!();expect(await pending).toBe(false);expect(writes).toHaveLength(0);expect(old.terminated).toBe(true);expect(transformState()).not.toBeNull();
 commitTransform();await vi.waitFor(()=>expect(HeldWorker.all.at(-1)?.held).toBeTypeOf('function'));const next=HeldWorker.all.at(-1)!,close=api!.requestClose();expect(editor.active).toBe(s);next.held!();expect(await close).toBe(true);expect(editor.active).toBeNull();api!.destroy();api=undefined;
});
it('native policy admits finite path actions and context copy; disabled actions cannot mutate a live draft',async()=>{
 const {s,h}=await open(async()=>{}, {'action:path.toSelection':{visible:false,enabled:false},'action:layer.copyContext':{visible:false,enabled:false}});draft(h);const owner=readPenSession(s),count=s.doc.layerCount();expect(action('path.addToSelection')!.enabled!()).toBe(true);await run('path.toSelection');await run('layer.copyContext');expect(readPenSession(s)).toBe(owner);expect(s.doc.layerCount()).toBe(count);
 await run('path.addToSelection');expect(readPenSession(s)).toBeNull();expect(s.doc.selection.isEmpty()).toBe(false);await api!.save();expect(decodeNative((await api!.captureNative()).bytes).doc.paths).toHaveLength(1);
});

it('composite capture waits real applying authority and preserves another owner when encoding settles',async()=>{
 const {s}=await open(),worker=await applying();const capture=api!.captureComposite();expect(api!.state().outputBusy).toBe(true);expect(s.canEdit()).toBe(false);worker.held!();const output=await capture;expect(output.format).toBe('png');expect(output.bytes.length).toBeGreaterThan(0);expect(transformState()).toBeNull();expect(s.canEdit()).toBe(true);
 const other=s.acquireEditProtection('unrelated-owner');try{await expect(api!.captureComposite()).rejects.toThrow('busy');expect(s.canEdit()).toBe(false);}finally{s.releaseEditProtection(other);}expect(s.canEdit()).toBe(true);
 const {exporters}=await import('../../src/formats/registry'),png=exporters.find(e=>e.id==='png')!,encode=png.export;let release!:()=>void;
 vi.spyOn(png,'export').mockImplementation(async(d,o)=>{await new Promise<void>(r=>release=r);return encode(d,o);});
 const delayed=api!.captureComposite();await vi.waitFor(()=>expect(release).toBeTypeOf('function'));const later=s.acquireEditProtection('later-owner');release();expect((await delayed).format).toBe('png');expect(s.canEdit()).toBe(false);s.releaseEditProtection(later);expect(s.canEdit()).toBe(true);
});
