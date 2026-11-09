// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {initializeEditor} from '../../src/embedded/editor';
import {editor} from '../../src/app/editor';
import {createNative} from '../../src/document/native';
import {exporters} from '../../src/formats/registry';
import {SetLayerPropsCommand} from '../../src/commands/layerCommands';
let api:ReturnType<typeof initializeEditor>;
afterEach(()=>{vi.restoreAllMocks();for(const s of [...editor.sessions])editor.removeSession(s.id);api?.destroy();});
function edit(opacity:number){const s=editor.active!,l=s.doc.allLayers()[0];s.push(new SetLayerPropsCommand('edit',l.id,{opacity:l.opacity},{opacity}));}
async function open(save=async()=>{}){api=initializeEditor({nativeVersion:1,readResource:async()=>({name:'a.wpnative',bytes:createNative(24,16)}),save,export:async()=>{},confirm:async()=>2,dirty(){},error(){}});await api.open('work','work');edit(.3);return editor.active!;}
it('autosave and recovery never invoke PNG exporter',async()=>{await open();const png=vi.spyOn(exporters.find(x=>x.id==='png')!,'export');await api.captureNative();expect(png).not.toHaveBeenCalled();await api.save();expect(png).not.toHaveBeenCalled();});
it('edits and undo remain available during host IO; receipt marks only captured checkpoint',async()=>{let release!:()=>void;const s=await open(()=>new Promise<void>(r=>release=r));const captured=s.history.current.id,pending=api.save();await vi.waitFor(()=>expect(release).toBeTypeOf('function'));expect(s.canEdit()).toBe(true);edit(.7);expect(s.history.current.id).not.toBe(captured);release();expect(await pending).toBe(true);expect(s.modified).toBe(true);s.history.undo();expect(s.modified).toBe(false);});

it('worker wire reuses codec without changing bytes or detaching live tiles',async()=>{const {checkpointWire,reviveCheckpoint}=await import('../../src/embedded/checkpoint-wire');const {encodeNative,decodeNative}=await import('../../src/document/native');const s=await open();const l=s.doc.allLayers()[0];if(l.kind!=='pixel')throw Error('fixture');l.raster.writableTile(0,0).data[0]=123;const snapshot=(await import('../../src/document/clone')).snapshotDocument(s.doc);const wire=structuredClone(checkpointWire(snapshot));l.raster.writableTile(0,0).data[0]=42;const restored=reviveCheckpoint(wire);expect(encodeNative(restored)).toEqual(encodeNative(snapshot));expect(decodeNative(encodeNative(restored)).doc.id).toBe(s.doc.id);expect(l.raster.getTile(0,0)!.data[0]).toBe(42);});

it('failed or uncertain save after undo to the former clean entry cannot allow a clean exit',async()=>{let reject!:(e:Error)=>void;const s=await open(()=>new Promise<void>((_,r)=>reject=r));const pending=api.save();await vi.waitFor(()=>expect(reject).toBeTypeOf('function'));s.history.undo();expect(s.modified).toBe(false);reject(Error('receipt lost or CAS conflict'));expect(await pending).toBe(false);expect(s.modified).toBe(true);expect(s.canEdit()).toBe(true);expect(await api.requestClose()).toBe(false);});
