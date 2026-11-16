// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({setTitle(){},setEdited(){},memory:vi.fn(async()=>null),recovery:{save:vi.fn(),remove:vi.fn()}}));
vi.mock('../../src/app/platform/platform',()=>({platform:()=>io}));
import {editor} from '../../src/app/editor';
import {startAutosave,forgetAutosave} from '../../src/app/autosave';
import {NumberField} from '../../src/ui/controls';
import {createNative,decodeNative} from '../../src/document/native';
import {SetLayerPropsCommand} from '../../src/commands/layerCommands';
import {importPsd} from '../../src/psd/import';
import {ui} from '../../src/app/store';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,container:HTMLDivElement,minutes:number;
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(Date.now()+10000);minutes=editor.prefs.general.autosaveMinutes;editor.prefs.general.autosaveMinutes=1;ui.set({progress:[],dialogs:[]});io.recovery.save.mockResolvedValue(undefined);container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());for(const s of [...editor.sessions]){forgetAutosave(s.id);editor.removeSession(s.id);}container.remove();editor.prefs.general.autosaveMinutes=minutes;vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();vi.clearAllMocks();});
async function deferred(otherReady=false){
 const s=editor.addDocument(decodeNative(createNative(8,8)).doc);s.markUnsaved();
 await act(async()=>root.render(<NumberField value={100} onChange={v=>{const l=s.activeLayer()!;s.push(new SetLayerPropsCommand('Opacity',l.id,{opacity:l.opacity},{opacity:v/100}));}} onCommit={()=>s.history.seal()}/>));
 const input=container.querySelector('input')!;
 await act(async()=>{input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'42');input.dispatchEvent(new Event('input',{bubbles:true}));});
 let other:typeof s|undefined;if(otherReady){other=editor.addDocument(decodeNative(createNative(8,8)).doc);other.markUnsaved();}
 startAutosave();await act(async()=>vi.advanceTimersByTimeAsync(60000+(otherReady?1:0)));expect(io.recovery.save).toHaveBeenCalledTimes(otherReady?1:0);
 return {s,input,other};
}
it('due recovery retains a real NumberField draft and saves on the final blur with no later input or period',async()=>{
 const {s,input}=await deferred();await act(async()=>{input.blur();await vi.advanceTimersByTimeAsync(1);});
 expect(io.recovery.save).toHaveBeenCalledTimes(1);expect(s.activeLayer()!.opacity).toBe(.42);const copy=importPsd(io.recovery.save.mock.calls[0][1],'recovery.psd').doc;expect(copy.allLayers()[0].opacity).toBe(Math.round(.42*255)/255);
 await act(async()=>{s.notify();await vi.advanceTimersByTimeAsync(1000);});expect(io.recovery.save).toHaveBeenCalledTimes(1);
});
it('failed deferred recovery is not retried by its output cleanup or repeated stable notifications',async()=>{
 const {s,input}=await deferred();io.recovery.save.mockRejectedValue(Error('disk unavailable'));vi.spyOn(console,'warn').mockImplementation(()=>{});
 await act(async()=>{input.blur();await vi.advanceTimersByTimeAsync(1);});expect(io.recovery.save).toHaveBeenCalledTimes(1);expect(s.outputBusy).toBe(false);
 await act(async()=>{s.notify();s.notify();await vi.advanceTimersByTimeAsync(1000);});expect(io.recovery.save).toHaveBeenCalledTimes(1);
});
it('a deferred recovery waits for close-owner cancellation and resumes after its final release',async()=>{
 const {s,input}=await deferred();const closing=new Promise<boolean>(()=>{});s.setClose(closing);const token=s.acquireEditProtection('close');
 // A close cutoff cannot submit a different owner's field. Retain the request until close is cancelled.
 await act(async()=>{s.releaseEditProtection(token);input.blur();await vi.advanceTimersByTimeAsync(1);});expect(io.recovery.save).not.toHaveBeenCalled();
 await act(async()=>{s.releaseClose(closing);await vi.advanceTimersByTimeAsync(1);});expect(io.recovery.save).toHaveBeenCalledTimes(1);
});
it('disposing a deferred target clears its subscription and cannot resurrect a recovery write',async()=>{
 const {s,input}=await deferred();await act(async()=>{editor.removeSession(s.id);input.blur();await vi.advanceTimersByTimeAsync(1000);});expect(io.recovery.save).not.toHaveBeenCalled();expect(editor.session(s.id)).toBeUndefined();
});

it('retained recovery respects an occupied output slot and wakes only when its owner releases it',async()=>{
 const {s,input}=await deferred();const slot=s.reserveOutput(Promise.resolve(true))!;
 await act(async()=>{input.blur();await vi.advanceTimersByTimeAsync(1);});expect(io.recovery.save).not.toHaveBeenCalled();
 await act(async()=>{s.releaseOutput(Symbol('stale'));await vi.advanceTimersByTimeAsync(1);});expect(io.recovery.save).not.toHaveBeenCalled();
 await act(async()=>{s.releaseOutput(slot);await vi.advanceTimersByTimeAsync(1);});expect(io.recovery.save).toHaveBeenCalledTimes(1);
});

it('another deferred target waking cannot retry a different session whose due recovery failed',async()=>{
 io.recovery.save.mockRejectedValueOnce(Error('one target failed'));vi.spyOn(console,'warn').mockImplementation(()=>{});
 const {s,input,other}=await deferred(true);expect(io.recovery.save.mock.calls[0][0].id).toBe(other!.id);
 await act(async()=>{input.blur();await vi.advanceTimersByTimeAsync(1);});expect(io.recovery.save).toHaveBeenCalledTimes(2);expect(io.recovery.save.mock.calls[1][0].id).toBe(s.id);
 await act(async()=>{other!.notify();await vi.advanceTimersByTimeAsync(1000);});expect(io.recovery.save).toHaveBeenCalledTimes(2);
});
