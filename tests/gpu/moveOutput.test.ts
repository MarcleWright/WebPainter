// @vitest-environment jsdom
import { beforeAll, afterEach, afterAll, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ chooseSavePath: vi.fn(), writePath: vi.fn(), confirm: vi.fn(), recovery: { save: vi.fn(), remove: vi.fn() }, setTitle() {}, setEdited() {}, kind: 'electron', canWriteInPlace: true, bridge: null }));
vi.mock('../../src/app/platform/platform', () => ({ platform: () => io }));
import { editor } from '../../src/app/editor';
import { MoveTool } from '../../src/tools/moveTool';
import { save, saveAs, saveCopy, exportAs, closeSession, closeAll } from '../../src/app/fileOps';
import { autosaveNow } from '../../src/app/autosave';
import { testDevice } from '../helpers/gpu';
import { GpuCompositor } from '../../src/gpu/compositor';
import { setGpuCompositor } from '../../src/rendering/renderEngine';
import { newDoc, add } from '../helpers/build';
import { createPixelLayer, createGroupLayer } from '../../src/document/layerFactory';
import { TiledRaster } from '../../src/image-engine/tiledRaster';
import { importPsd } from '../../src/psd/import';
import { decode } from 'fast-png';
import { PaintTool } from '../../src/tools/paintTools';
import { setOpacity } from '../../src/app/ops/layerOps';
import { undo } from '../../src/app/ops/editOps';
import { extraFilters } from '../../src/filters/builtin';
import { applyFilter } from '../../src/app/ops/filterOps';
import { exporters } from '../../src/formats/registry';
import { flattenToPixels } from '../../src/rendering/flatten';
import type { ToolHost, ToolPointer } from '../../src/tools/tool';
let gpu: GpuCompositor;
beforeAll(async () => { const d=await testDevice(); if(!d) throw Error('GPU required'); gpu=new GpuCompositor(d);setGpuCompositor(gpu);editor.registerTool('move',()=>new MoveTool()); });
afterEach(()=>{for(const s of [...editor.sessions]){editor.finishMove(s,false);editor.removeSession(s.id);}vi.clearAllMocks();});
afterAll(()=>{setGpuCompositor(null);gpu.dispose();});
const pt=(x:number,y:number):ToolPointer=>({x,y,sx:x,sy:y,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,shift:false,alt:false,mod:false,pointerType:'mouse',time:0,clickCount:1});
function fixture(){
 io.recovery.remove.mockResolvedValue(undefined);
 const doc=newDoc(24,16);const data=new Uint8ClampedArray(24*16*4);for(let i=0;i<24*16;i++){data[i*4]=i%251;data[i*4+3]=255;}
 const l=createPixelLayer('pixels',8,TiledRaster.fromPixels(24,16,4,8,data));add(doc,l);
 const s=editor.addDocument(doc);s.setActive(l.id);doc.selection.setRegion({x:2,y:2,w:4,h:4},new Float32Array(16).fill(1));
 const h:ToolHost={editor,session:s,redraw(){},setCursor(){},viewportSize:()=>({w:200,h:100})};
 editor.hostFactory=()=>h;editor.setTool('move');const t=editor.tool('move') as MoveTool;
 const start=()=>{const b=doc.selection.bounds(doc.bounds)!;t.down(h,pt(b.x+1,b.y+1));t.move(h,pt(b.x+7,b.y+1));expect(s.engine.getOverride(l.id)?.gpu?.floating).toBeTruthy();};
 return {doc,l,s,h,t,start};
}
it('Save and PNG Export commit the real Move once and serialize the final pixels',async()=>{
 const {l,s,t,h,start}=fixture();start();io.chooseSavePath.mockResolvedValue('test.psd');io.writePath.mockResolvedValue(undefined);
 expect(await saveAs(s)).toBe(true);const n=s.history.entries.length;t.up(h);expect(s.history.entries.length).toBe(n);
 const saved=io.writePath.mock.calls[0][1];const reopened=importPsd(saved,'test.psd').doc;
 expect((reopened.allLayers().find(x=>x.kind==='pixel') as typeof l).raster.readPixels({x:0,y:0,w:24,h:16})).toEqual(l.raster.readPixels({x:0,y:0,w:24,h:16}));
 start();expect(await save(s)).toBe(true);
 start();io.chooseSavePath.mockResolvedValue('test.png');expect(await exportAs(s,'png')).toBe(true);
 const png=decode(io.writePath.mock.calls.at(-1)![1]);expect(Array.from(png.data)).toEqual(Array.from(flattenToPixels(s.doc,{depth:8}).data));
});
it('write failure and cancelled dialogs do not output, while newer edits stay modified during delayed writes',async()=>{
 const {s,l,start}=fixture();start();const restore=l.raster.restore.bind(l.raster);let k=0;l.raster.restore=x=>{if(k++===0)throw Error('injected');restore(x);};
 expect(await saveAs(s)).toBe(false);expect(io.writePath).not.toHaveBeenCalled();l.raster.restore=restore;
 start();io.chooseSavePath.mockResolvedValue(null);expect(await saveAs(s)).toBe(false);expect(io.writePath).not.toHaveBeenCalled();
 io.chooseSavePath.mockResolvedValue('delayed.psd');let release!:()=>void;let began!:()=>void;const begun=new Promise<void>(r=>began=r);
 io.writePath.mockImplementation(()=>{began();return new Promise<void>(r=>release=r);});const saving=saveAs(s);await begun;
 s.doc.emit({type:'meta'});release();expect(await saving).toBe(true);expect(s.modified).toBe(true);expect(s.doc.filePath).toBe('delayed.psd');expect(io.recovery.remove).not.toHaveBeenCalled();
});
it('autosave skips the target during Move including after yield, then saves after release; close cancels',async()=>{
 const {s,start,t,h}=fixture();start();expect(await autosaveNow()).toBe(0);expect(t.busy()).toBe(true);t.up(h);
 const pending=autosaveNow();start();expect(await pending).toBe(0);expect(io.recovery.save).not.toHaveBeenCalled();t.up(h);
 io.recovery.save.mockResolvedValue(undefined);expect(await autosaveNow()).toBe(1);
 start();const id=s.history.current.id;io.confirm.mockResolvedValue(2);expect(await closeSession(s)).toBe(false);expect(t.busy()).toBe(false);expect(s.history.current.id).toBe(id);
});

it('automatically falls back for low zoom, groups and unavailable GPU',()=>{
 for(const mode of ['zoom','group','backend']){
 const {s,doc,l,t,h}=fixture();if(mode==='zoom')s.view.zoom=.125;if(mode==='group')doc.insertLayer(createGroupLayer('unsupported'));if(mode==='backend')setGpuCompositor(null);
 const version=l.raster.version;t.down(h,pt(3,3));t.move(h,pt(9,3));expect(s.engine.getOverride(l.id)).toBeUndefined();expect(l.raster.version).toBeGreaterThan(version);t.cancel(h);setGpuCompositor(gpu);
 }
});
it('backend loss before submission cancels output; backend loss after commit preserves history',async()=>{
 const {s,l,start,t,h}=fixture();const initial=l.raster.readPixels({x:0,y:0,w:24,h:16});start();setGpuCompositor(null);
 expect(await saveAs(s)).toBe(false);expect(io.writePath).not.toHaveBeenCalled();expect(l.raster.readPixels({x:0,y:0,w:24,h:16})).toEqual(initial);
 setGpuCompositor(gpu);start();t.up(h);const id=s.history.current.id;setGpuCompositor(null);expect(s.history.current.id).toBe(id);setGpuCompositor(gpu);
});
it('saving another target does not finish the active document Move',async()=>{
 const a=fixture(),b=fixture();editor.activate(a.s.id);editor.hostFactory=()=>a.h;a.start();io.chooseSavePath.mockResolvedValue('other.psd');io.writePath.mockResolvedValue(undefined);
 expect(await saveAs(b.s)).toBe(true);expect(editor.moving(a.s)).toBe(true);expect(a.s.history.canUndo).toBe(false);
});

it('rechecks Move after a pending dialog and avoids late state writes to a closed target',async()=>{
 const {s,start}=fixture();let choose!:(x:string)=>void;io.chooseSavePath.mockImplementation(()=>new Promise<string>(r=>choose=r));io.writePath.mockResolvedValue(undefined);
 const pending=saveAs(s);await Promise.resolve();start();choose('after-dialog.psd');expect(await pending).toBe(true);expect(editor.moving(s)).toBe(false);
 let release!:()=>void;let began!:()=>void;const ready=new Promise<void>(r=>began=r);io.chooseSavePath.mockResolvedValue('closed.psd');io.writePath.mockImplementation(()=>{began();return new Promise<void>(r=>release=r);});
 const saving=saveAs(s);await ready;const name=s.doc.name;editor.removeSession(s.id);release();expect(await saving).toBe(true);expect(s.doc.name).toBe(name);
});

it('locks real editing while saving, binds Save As independently and keeps undo savepoints',async()=>{
 const {s,l,t,h,start}=fixture();s.doc.filePath='A.psd';start();t.up(h);io.chooseSavePath.mockResolvedValue('B.psd');
 let release!:()=>void, began!:()=>void;const ready=new Promise<void>(r=>began=r);io.writePath.mockImplementation(()=>{began();return new Promise<void>(r=>release=r);});
 const pending=saveAs(s);await ready;const region={x:0,y:0,w:24,h:16},pixels=l.raster.readPixels(region),id=s.history.current.id;
 t.down(h,pt(9,3));t.move(h,pt(15,3));new PaintTool('brush','brush').down(h,pt(12,8));setOpacity(l.id,.2);undo();
 expect(l.opacity).toBe(1);expect(s.history.current.id).toBe(id);expect(l.raster.readPixels(region)).toEqual(pixels);expect(await save(s)).toBe(false);expect(io.writePath).toHaveBeenCalledTimes(1);
 release();expect(await pending).toBe(true);expect(s.doc.filePath).toBe('B.psd');expect(s.modified).toBe(false);
 io.writePath.mockResolvedValue(undefined);start();t.up(h);expect(s.modified).toBe(true);expect(s.history.undo()).toBe(true);expect(s.modified).toBe(false);
 expect(await save(s)).toBe(true);expect(io.writePath.mock.calls.at(-1)![0]).toBe('B.psd');
 start();t.up(h);io.chooseSavePath.mockResolvedValue('copy.psd');expect(await saveCopy(s)).toBe(true);expect(s.doc.filePath).toBe('B.psd');expect(s.modified).toBe(true);
});
it('close waits for output and protects confirmation/final cleanup, and rejects unexpected newer state',async()=>{
 const {s,t,h,start}=fixture();start();t.up(h);io.chooseSavePath.mockResolvedValue('close.psd');io.confirm.mockResolvedValue(0);
 let release!:()=>void,began!:()=>void;const ready=new Promise<void>(r=>began=r);io.writePath.mockImplementation(()=>{began();return new Promise<void>(r=>release=r);});
 const closing=closeSession(s);await ready;expect(s.canEdit()).toBe(false);s.doc.emit({type:'meta'});release();expect(await closing).toBe(false);expect(editor.session(s.id)).toBe(s);expect(s.modified).toBe(true);expect(io.recovery.remove).not.toHaveBeenCalled();
 let cleaned!:()=>void, removing!:()=>void;const cleaning=new Promise<void>(r=>removing=r);io.recovery.remove.mockImplementation(()=>{removing();return new Promise<void>(r=>cleaned=r);});io.confirm.mockResolvedValue(1);
 const discard=closeSession(s);await cleaning;setOpacity(s.activeLayerId!,.2);expect(s.canEdit()).toBe(false);expect(editor.session(s.id)).toBe(s);cleaned();expect(await discard).toBe(true);expect(editor.session(s.id)).toBeUndefined();
});
it('rejects path competitors, isolates documents and waits rather than force-closing a writer',async()=>{
 const a=fixture(),b=fixture();a.s.doc.filePath='A.psd';b.s.doc.filePath='B.psd';io.chooseSavePath.mockResolvedValue('B.psd');expect(await saveAs(a.s)).toBe(false);expect(io.writePath).not.toHaveBeenCalled();
 io.chooseSavePath.mockResolvedValue('same.psd');let release!:()=>void,began!:()=>void;const ready=new Promise<void>(r=>began=r);io.writePath.mockImplementation(()=>{began();return new Promise<void>(r=>release=r);});
 const pending=saveAs(a.s);await ready;expect(await saveAs(b.s)).toBe(false);setOpacity(b.l.id,.5);expect(b.l.opacity).toBe(.5);
 const closing=closeSession(a.s,true);expect(editor.session(a.s.id)).toBe(a.s);release();expect(await pending).toBe(true);expect(await closing).toBe(true);
});
it('rejects an actual asynchronous filter result while the target is protected',async()=>{
 const {s,l,t,h,start}=fixture();let finish!:(v:any)=>void,began!:()=>void;const started=new Promise<void>(r=>began=r);
 extraFilters.push({id:'save-test',name:'Save Test',category:'Other',space:'straight',params:[],padding:()=>0,apply:img=>img,runAsync:img=>{began();return new Promise(r=>finish=()=>r({...img,data:new Float32Array(img.data.length).fill(1)}));}});
 const filtering=applyFilter('save-test',{});await started;io.chooseSavePath.mockResolvedValue('filter.psd');let release!:()=>void,written!:()=>void;const writing=new Promise<void>(r=>written=r);io.writePath.mockImplementation(()=>{written();return new Promise<void>(r=>release=r);});
 const pending=saveAs(s);await writing;const before=l.raster.readPixels({x:0,y:0,w:24,h:16});finish(null);expect(await filtering).toBe(false);expect(l.raster.readPixels({x:0,y:0,w:24,h:16})).toEqual(before);release();expect(await pending).toBe(true);extraFilters.pop();
});

it('releases all reservations after encode/write errors and close-all does not discard a failed writer',async()=>{
 const {s,t,h,start}=fixture();start();t.up(h);s.doc.filePath='old.psd';io.chooseSavePath.mockResolvedValue('retry.psd');
 const encoder=vi.spyOn(exporters.find(e=>e.id==='psd')!,'export').mockRejectedValueOnce(new Error('encode'));
 expect(await saveAs(s)).toBe(false);expect(s.doc.filePath).toBe('old.psd');expect(s.modified).toBe(true);expect(s.canEdit()).toBe(true);expect(s.outputPending).toBeNull();encoder.mockRestore();
 let reject!:(e:Error)=>void,began!:()=>void;const ready=new Promise<void>(r=>began=r);io.writePath.mockImplementation(()=>{began();return new Promise<void>((_,r)=>reject=r);});
 const writing=saveAs(s);await ready;const closing=closeAll();reject(new Error('write refused'));expect(await writing).toBe(false);expect(await closing).toBe(false);expect(editor.session(s.id)).toBe(s);expect(io.recovery.remove).not.toHaveBeenCalled();expect(s.canEdit()).toBe(true);
 io.writePath.mockResolvedValue(undefined);expect(await saveAs(s)).toBe(true);expect(s.doc.filePath).toBe('retry.psd');
});
it('orders an already-started recovery before close removal and skips protected recovery',async()=>{
 const {s,t,h,start}=fixture();start();t.up(h);let finish!:()=>void,began!:()=>void;const ready=new Promise<void>(r=>began=r);const order:string[]=[];
 io.recovery.save.mockImplementation(()=>{order.push('save');began();return new Promise<void>(r=>finish=r);});
 const recovery=autosaveNow();await ready;io.confirm.mockResolvedValue(1);io.recovery.remove.mockImplementation(async()=>{order.push('remove');});
 const closing=closeSession(s);expect(await autosaveNow()).toBe(0);expect(io.recovery.remove).not.toHaveBeenCalled();finish();await recovery;expect(await closing).toBe(true);expect(order).toEqual(['save','remove']);expect(editor.session(s.id)).toBeUndefined();
});

it('protects the close confirmation and merges repeated close requests',async()=>{
 const {s,l,t,h,start}=fixture();start();t.up(h);const id=s.history.current.id;
 let answer!:(v:number)=>void,began!:()=>void;const ready=new Promise<void>(r=>began=r);io.confirm.mockImplementation(()=>{began();return new Promise<number>(r=>answer=r);});
 const closing=closeSession(s);await ready;const repeated=closeSession(s,true);t.down(h,pt(9,3));t.move(h,pt(15,3));setOpacity(l.id,.3);expect(s.history.undo()).toBe(false);expect(l.opacity).toBe(1);expect(s.history.current.id).toBe(id);expect(io.confirm).toHaveBeenCalledTimes(1);
 answer(2);expect(await closing).toBe(false);expect(await repeated).toBe(false);expect(editor.session(s.id)).toBe(s);expect(s.canEdit()).toBe(true);expect(io.recovery.remove).not.toHaveBeenCalled();
});

it('keeps the session when recovery cleanup fails and permits retry',async()=>{
 const {s,t,h,start}=fixture();start();t.up(h);io.confirm.mockResolvedValue(1);io.recovery.remove.mockRejectedValueOnce(new Error('recovery cleanup refused'));
 expect(await closeSession(s)).toBe(false);expect(editor.session(s.id)).toBe(s);expect(s.canEdit()).toBe(true);io.recovery.remove.mockResolvedValue(undefined);expect(await closeSession(s)).toBe(true);
});
