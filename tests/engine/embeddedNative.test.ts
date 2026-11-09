// @vitest-environment jsdom
import { afterEach,expect,it,vi } from 'vitest';
import { initializeEditor } from '../../src/embedded/editor';
import { editor } from '../../src/app/editor';
import { createNative,decodeNative } from '../../src/document/native';
import { SetLayerPropsCommand } from '../../src/commands/layerCommands';
import { exporters } from '../../src/formats/registry';
import { decodePNG } from '../../src/formats/codecs';
import { flattenToPixels } from '../../src/rendering/flatten';
import {nativePolicy} from '../../src/embedded/capabilities';
import {access} from '../../src/app/access';
import {run,action} from '../../src/app/actions';
import {newAdjustmentLayer} from '../../src/app/ops/layerOps';
import type { EmbeddedEditor,HostPort,Output } from '../../src/embedded/contract';
let api:EmbeddedEditor|undefined;
afterEach(()=>{if(api){for(const s of [...editor.sessions])editor.removeSession(s.id);api.destroy();api=undefined;}});
function host():HostPort{return{nativeVersion:1,readResource:vi.fn(async()=>({name:'work.wpnative',bytes:createNative(24,16)})),save:vi.fn(async()=>{}),export:vi.fn(async()=>{}),confirm:vi.fn(async()=>2),dirty:vi.fn(),error:vi.fn()};}
async function open(h:HostPort){api=initializeEditor(h);await api.open('opaque-work-session','work');return editor.active!;}
function edit(){const s=editor.active!,l=s.doc.allLayers()[0];s.push(new SetLayerPropsCommand('opacity',l.id,{opacity:l.opacity},{opacity:.4}));return s;}
it('native capability ceiling prevents depth and direct LUT panel mutations before save',async()=>{
 const h=host(),s=await open(h);await run('image.depth.16');expect(s.doc.canvas.bitDepth).toBe(8);expect(action('image.depth.16')!.enabled!()).toBe(false);
 const n=s.doc.layerCount();newAdjustmentLayer('colorLookup');expect(s.doc.layerCount()).toBe(n);expect(await api!.save()).toBe(true);
});
it('saves native and PNG from one protected history checkpoint; read-only recovery capture stays dirty',async()=>{
  const h=host();const s=await open(h);edit();const entry=s.history.current.id;
  const candidate=await api!.captureNative();expect(candidate.format).toBe('wpnative');expect(candidate.checkpoint).toBe(entry);expect(s.modified).toBe(true);expect(h.save).not.toHaveBeenCalled();
  const output=await api!.saveAndCapture();expect(output.checkpoint).toBe(entry);expect(s.modified).toBe(false);expect(h.save).toHaveBeenCalledTimes(1);
  const doc=decodeNative(output.bytes).doc;expect(doc.id).toBe(s.doc.id);expect(doc.allLayers()[0].opacity).toBe(.4);
  expect(Array.from(decodePNG(output.preview!).data)).toEqual(Array.from(flattenToPixels(doc).data));
  s.history.undo();expect(s.modified).toBe(true);s.history.redo();expect(s.modified).toBe(false);
});
it('delayed native receipt permits edits, retains newer dirty and rejects overlapping output',async()=>{
 const h=host(),s=await open(h);edit();let release!:()=>void;h.save=vi.fn(()=>new Promise<void>(r=>release=r));const pending=api!.save();await vi.waitFor(()=>expect(h.save).toHaveBeenCalled());const entry=s.history.current.id;
 s.push(new SetLayerPropsCommand('newer',s.activeLayerId!,{opacity:.4},{opacity:.7}));expect(s.history.current.id).not.toBe(entry);expect(s.canEdit()).toBe(true);await expect(api!.captureNative()).rejects.toThrow('busy');release();expect(await pending).toBe(true);expect(s.modified).toBe(true);s.history.undo();expect(s.modified).toBe(false);
});
it('close Save uses native owner, failed save preserves dirty, invalid choices always Cancel',async()=>{
  const h=host();const s=await open(h);edit();h.save=vi.fn(async()=>{throw Error('disk failure');});vi.mocked(h.confirm).mockResolvedValue(0);
  expect(await api!.requestClose()).toBe(false);expect(s.modified).toBe(true);expect(s.canEdit()).toBe(true);
  expect((vi.mocked(h.save).mock.calls[0][0] as Output).format).toBe('wpnative');
  for(const answer of [NaN,Infinity,-1,3,1.5]){vi.mocked(h.confirm).mockResolvedValue(answer);expect(await api!.requestClose()).toBe(false);expect(editor.active).toBe(s);expect(s.modified).toBe(true);}
  h.save=vi.fn(async()=>{});vi.mocked(h.confirm).mockResolvedValue(0);expect(await api!.requestClose()).toBe(true);expect(h.save).toHaveBeenCalledTimes(1);
});
it('failed manual output is retryable and recovery opens dirty without a second save writer',async()=>{
  const h=host();vi.mocked(h.readResource).mockResolvedValue({name:'recover.wpnative',bytes:createNative(24,16),recovered:true});const s=await open(h);
  expect(s.modified).toBe(true);h.save=vi.fn(async()=>{throw Error('offline');});expect(await api!.save()).toBe(false);expect(s.modified).toBe(true);
  h.save=vi.fn(async()=>{});expect(await api!.save()).toBe(true);expect(s.modified).toBe(false);
});
it('explicit image resource uses core command history, immutable provenance and native pixels; undo retains resource bytes',async()=>{
  const h=host();const s=await open(h),png=await exporters.find(x=>x.id==='png')!.export(s.doc,{});
  vi.mocked(h.readResource).mockResolvedValue({name:'reference.png',bytes:png,source:{id:'image-a',hash:'a'.repeat(64)}});
  await api!.addResource('resource-a');expect(s.doc.layerCount()).toBe(2);const added=s.doc.allLayers()[1];expect(added.metadata.custom?.source).toEqual({id:'image-a',hash:'a'.repeat(64)});
  const output=await api!.captureNative();expect(decodeNative(output.bytes).doc.getLayer(added.id)).toBeTruthy();
  s.history.undo();expect(s.doc.layerCount()).toBe(1);s.history.redo();expect(s.doc.getLayer(added.id)).toBeTruthy();
});
it('unsupported native content fails without clean/save; PSD export is separate and leaves dirty',async()=>{
  const h=host();const s=await open(h);edit();s.doc.allLayers()[0].effects={} as never;
  expect(await api!.save()).toBe(false);expect(h.save).not.toHaveBeenCalled();expect(s.modified).toBe(true);s.doc.allLayers()[0].effects=null;
  await api!.exportPsd();expect(vi.mocked(h.export).mock.calls[0][0].format).toBe('psd');expect(s.modified).toBe(true);
});
it('preview failure does not undo a native save; generation capture still requires its exact PNG',async()=>{
  const h=host();const s=await open(h);edit();const png=exporters.find(x=>x.id==='png')!,original=png.export;
  png.export=async()=>{throw Error('preview failed');};
  try{expect(await api!.save()).toBe(true);expect(s.modified).toBe(false);expect(vi.mocked(h.save).mock.calls[0][0].preview).toBeUndefined();edit();await expect(api!.saveAndCapture()).rejects.toThrow('preview failed');expect(s.modified).toBe(true);expect(h.save).toHaveBeenCalledTimes(1);}
  finally{png.export=original;}
});
it('a late native receipt cannot mark an untracked newer document mutation clean',async()=>{
  const h=host();const s=await open(h);edit();h.save=vi.fn(async()=>{s.doc.emit({type:'meta'});});
  expect(await api!.save()).toBe(false);expect(s.modified).toBe(true);expect(s.canEdit()).toBe(true);
});
it('oversized PNG is a preview failure, not a failed manual native save',async()=>{
  const h=host();const s=await open(h);edit();const png=exporters.find(x=>x.id==='png')!,original=png.export;png.export=async()=>new Uint8Array(32*1024*1024+1);
  try{expect(await api!.save()).toBe(true);expect(vi.mocked(h.save).mock.calls[0][0].preview===undefined).toBe(true);edit();await expect(api!.saveAndCapture()).rejects.toThrow('preview');expect(h.save).toHaveBeenCalledTimes(1);expect(s.modified).toBe(true);}finally{png.export=original;}
});

it('policy separates hidden from disabled, cannot exceed codec ceiling, and preserves legal data under tighter configuration',async()=>{
 const h=host();h.capabilityPolicy={version:1,entries:{'action:image.depth.16':{visible:true,enabled:true},'action:layer.new':{visible:false,enabled:true},'action:layer.newGroup':{visible:true,enabled:false},'tool:gradient':{visible:false,enabled:true},'panel:properties':{visible:true,enabled:false}}};
 const s=await open(h);expect(access('action:image.depth.16')).toEqual({visible:true,enabled:false});expect(action('layer.new')!.visible!()).toBe(false);
 const count=s.doc.layerCount();await run('layer.new');expect(s.doc.layerCount()).toBe(count+1);await action('layer.newGroup')!.run();expect(s.doc.layerCount()).toBe(count+1);expect(access('tool:gradient').enabled).toBe(true);expect(access('fill:gradient').enabled).toBe(false);
 for(const id of ['image.mode.cmyk','layer.style','layer.convertToSmartObject','select.save','layer.newFill.gradient','layer.newFill.pattern'])expect(action(id)!.enabled!(),id).toBe(false);
 edit();expect(await api!.save()).toBe(true);const o=vi.mocked(h.save).mock.calls[0][0];expect(decodeNative(o.bytes).doc.layerCount()).toBe(count+1);
 expect(()=>nativePolicy({version:1,entries:{bad:{visible:true,enabled:true}}},new Set())).toThrow();
});

it('F1 reverse line passes recovery capture, canonical save and generation snapshot, and native reopen editing',async()=>{
 const h=host(),s=await open(h);editor.setTool('line');const t=editor.tool('line')!,pointer=(x:number,y:number)=>({x,y,sx:x,sy:y,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,shift:false,alt:false,mod:false,pointerType:'mouse',time:1,clickCount:1}),toolHost={editor,session:s,redraw(){},setCursor(){},viewportSize:()=>({w:64,h:64})};
 t.down!(toolHost,pointer(40,40));t.up!(toolHost,pointer(10,10));const line=s.activeLayer()!;expect(line).toMatchObject({kind:'shape',origin:{x:40,y:40,w:-30,h:-30}});
 const captured=await api!.captureNative();expect(s.modified).toBe(true);expect(h.save).not.toHaveBeenCalled();const snapshot=await api!.saveAndCapture();expect(snapshot.checkpoint).toBe(captured.checkpoint);expect(h.save).toHaveBeenCalledTimes(1);expect(decodeNative(snapshot.bytes).doc.getLayer(line.id)).toMatchObject({kind:'shape',origin:{w:-30,h:-30}});expect(Array.from(decodePNG(snapshot.preview!).data)).toEqual(Array.from(flattenToPixels(s.doc).data));
 expect(await api!.requestClose()).toBe(true);h.readResource=async()=>({name:'reopen.wpnative',bytes:snapshot.bytes});await api!.open('reopened-line','work');expect(editor.active!.doc.getLayer(line.id)).toMatchObject({kind:'shape',origin:{w:-30,h:-30}});editor.active!.setActive(line.id);const {commitAppearance}=await import('../../src/app/ops/layerOps'),{pathFromOrigin}=await import('../../src/vector/shapes');commitAppearance(editor.active!,line.id,'Edit reopened line',l=>{if(l.kind==='shape'){l.origin={...l.origin!,w:-35};l.path=pathFromOrigin(l.origin);}});expect(await api!.save()).toBe(true);
});

vi.mock('../../src/embedded/checkpoint-output',()=>({checkpointOutput:async(d:any,kind:string)=>({bytes:(await import('../../src/document/native')).encodeNative(d),preview:kind==='generation'?await (await import('../../src/formats/registry')).exporters.find(e=>e.id==='png')!.export(d,{}):undefined})}));
