// @vitest-environment jsdom
import { beforeAll, afterEach, afterAll, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({ chooseSavePath: vi.fn(), writePath: vi.fn(), confirm: vi.fn(), recovery: { save: vi.fn(), remove: vi.fn() }, setTitle() {}, setEdited() {}, kind: 'electron', canWriteInPlace: true, bridge: null }));
vi.mock('../../src/app/platform/platform', () => ({ platform: () => io }));
import { editor } from '../../src/app/editor';
import { MoveTool } from '../../src/tools/moveTool';
import { save, saveAs, exportAs, closeSession } from '../../src/app/fileOps';
import { autosaveNow } from '../../src/app/autosave';
import { testDevice } from '../helpers/gpu';
import { GpuCompositor } from '../../src/gpu/compositor';
import { setGpuCompositor } from '../../src/rendering/renderEngine';
import { newDoc, add } from '../helpers/build';
import { createPixelLayer, createGroupLayer } from '../../src/document/layerFactory';
import { TiledRaster } from '../../src/image-engine/tiledRaster';
import { importPsd } from '../../src/psd/import';
import { decode } from 'fast-png';
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
 s.doc.emit({type:'meta'});release();expect(await saving).toBe(true);expect(s.modified).toBe(true);expect(io.recovery.remove).not.toHaveBeenCalled();
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
 const pending=saveAs(s);start();choose('after-dialog.psd');expect(await pending).toBe(true);expect(editor.moving(s)).toBe(false);
 let release!:()=>void;let began!:()=>void;const ready=new Promise<void>(r=>began=r);io.chooseSavePath.mockResolvedValue('closed.psd');io.writePath.mockImplementation(()=>{began();return new Promise<void>(r=>release=r);});
 const saving=saveAs(s);await ready;const name=s.doc.name;editor.removeSession(s.id);release();expect(await saving).toBe(true);expect(s.doc.name).toBe(name);
});
