// @vitest-environment jsdom
import { afterEach,expect,it,vi } from 'vitest';
import { initializeEditor } from '../../src/embedded/editor';
import { editor } from '../../src/app/editor';
import { createNative,decodeNative } from '../../src/document/native';
import { SetLayerPropsCommand } from '../../src/commands/layerCommands';
import { exporters } from '../../src/formats/registry';
import { decodePNG } from '../../src/formats/codecs';
import { flattenToPixels } from '../../src/rendering/flatten';
import type { EmbeddedEditor,HostPort,Output } from '../../src/embedded/contract';
let api:EmbeddedEditor|undefined;
afterEach(()=>{if(api){for(const s of [...editor.sessions])editor.removeSession(s.id);api.destroy();api=undefined;}});
function host():HostPort{return{nativeVersion:1,readResource:vi.fn(async()=>({name:'work.wpnative',bytes:createNative(24,16)})),save:vi.fn(async()=>{}),export:vi.fn(async()=>{}),confirm:vi.fn(async()=>2),dirty:vi.fn(),error:vi.fn()};}
async function open(h:HostPort){api=initializeEditor(h);await api.open('opaque-work-session','work');return editor.active!;}
function edit(){const s=editor.active!,l=s.doc.allLayers()[0];s.push(new SetLayerPropsCommand('opacity',l.id,{opacity:l.opacity},{opacity:.4}));return s;}
it('saves native and PNG from one protected history checkpoint; read-only recovery capture stays dirty',async()=>{
  const h=host();const s=await open(h);edit();const entry=s.history.current.id;
  const candidate=await api!.captureNative();expect(candidate.format).toBe('wpnative');expect(candidate.checkpoint).toBe(entry);expect(s.modified).toBe(true);expect(h.save).not.toHaveBeenCalled();
  const output=await api!.saveAndCapture();expect(output.checkpoint).toBe(entry);expect(s.modified).toBe(false);expect(h.save).toHaveBeenCalledTimes(1);
  const doc=decodeNative(output.bytes).doc;expect(doc.id).toBe(s.doc.id);expect(doc.allLayers()[0].opacity).toBe(.4);
  expect(Array.from(decodePNG(output.preview!).data)).toEqual(Array.from(flattenToPixels(doc).data));
  s.history.undo();expect(s.modified).toBe(true);s.history.redo();expect(s.modified).toBe(false);
});
it('delayed receipt protects edits, joins close, and cannot leak into a re-open',async()=>{
  const h=host();const s=await open(h);edit();let release!:()=>void;h.save=vi.fn(()=>new Promise<void>(r=>release=r));
  const pending=api!.save();await vi.waitFor(()=>expect(h.save).toHaveBeenCalled());const entry=s.history.current.id;
  edit();expect(s.history.current.id).toBe(entry);await expect(api!.addResource('a')).rejects.toThrow('busy');await expect(api!.captureNative()).rejects.toThrow('busy');
  await expect(api!.open('other','other')).rejects.toThrow();expect(()=>api!.destroy()).toThrow();
  const close=api!.requestClose();release();expect(await pending).toBe(true);expect(await close).toBe(true);expect(editor.sessions).toHaveLength(0);
  await api!.open('new-work','work');expect(editor.active).not.toBe(s);expect(editor.active!.modified).toBe(false);
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
