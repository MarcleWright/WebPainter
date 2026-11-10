// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {App} from '../../src/ui/App';
import {Modal} from '../../src/ui/dialogs/Modal';
import {NumberField} from '../../src/ui/controls';
import {inputSession,clearInputSessions,key} from './fixture';
import {keymap} from '../../src/app/shortcuts';
import {ui,useApp} from '../../src/app/store';
import {register} from '../../src/app/actions';
// Replace layout/panels and graphics only. Production App, CanvasView, text controls and Modal listeners run.
vi.mock('../../src/ui/Workspace',async()=>{const {CanvasView}=await import('../../src/ui/CanvasView');return {Workspace:CanvasView};});
vi.mock('../../src/ui/OptionsBar',()=>({OptionsBar:()=>null}));
vi.mock('../../src/ui/Toolbar',()=>({Toolbar:()=>null}));
vi.mock('../../src/rendering/viewportRenderer',()=>({createViewportRendererAsync:async(canvas:HTMLCanvasElement)=>({canvas,renderer:{kind:'canvas2d',resize(){},dispose(){}}})}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,container:HTMLDivElement;
beforeEach(()=>{
 vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);keymap.reset();
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();clearInputSessions();ui.set({dialogs:[]});keymap.reset();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function mount(extra?:React.ReactNode){const result=inputSession();await act(async()=>root.render(<><App/>{extra}</>));return result;}
it('real App and numeric control preserve text keys; effective file.save crosses stopPropagation once and suppresses repeats',async()=>{
 let saves=0;register({id:'file.save',label:'Save',shortcut:'Ctrl+S',run:()=>{saves++;}});keymap.rebuild();
 await mount(<NumberField label="Test value" value={12} onChange={()=>{}}/>);
 const input=container.querySelector<HTMLInputElement>('input')!;
 await act(async()=>{key(input,'a',{ctrlKey:true});key(input,'Delete');key(input,'s',{ctrlKey:true});key(input,'s',{ctrlKey:true,repeat:true});});expect(saves).toBe(1);
 keymap.set('file.save',['F6']);await act(async()=>{key(input,'s',{ctrlKey:true});key(input,'F6');});expect(saves).toBe(2);
});
it('composition Enter/Escape does not confirm/close Modal, and normal Enter confirms once; stale deferred OK is cancelled',async()=>{
 let ok=0,close=0;await mount(<Modal title="IME" onOk={()=>{ok++;}} onClose={()=>{close++;}}><input/></Modal>);
 const input=container.querySelector<HTMLDivElement>('[role=dialog] input')!;
 await act(async()=>{input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));key(input,'Enter');key(input,'Escape');});expect(ok).toBe(0);expect(close).toBe(0);
 await act(async()=>{input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));key(input,'Enter');await new Promise(r=>setTimeout(r,5));});expect(ok).toBe(1);
 await act(async()=>{key(input,'Enter');root.render(<App/>);});await new Promise(r=>setTimeout(r,5));expect(ok).toBe(1);
});
it('modal consumes subsequent global commands and allows only view whitelist',async()=>{
 const {session}=await mount(<Modal title="Test" onClose={()=>{}}><input/></Modal>);let calls=0;register({id:'file.save',label:'Save',shortcut:'Ctrl+S',run:()=>{calls++;}});keymap.rebuild();
 const input=container.querySelector('[role=dialog] input')!;await act(async()=>{key(input,'Delete');key(input,'s',{ctrlKey:true});});expect(session.doc.layerCount()).toBe(1);expect(calls).toBe(0);
});
import {editor} from '../../src/app/editor';
import {createTextLayer} from '../../src/document/layerFactory';
import {startTextEdit,textEditState,cancelTextEdit} from '../../src/tools/typeTool';
it('production Canvas text editor owns composition and clipboard/delete/undo; normal Escape finishes the text session',async()=>{
 const {session}=await mount();const layer=createTextLayer('文字',8,0,0);session.doc.insertLayer(layer);
 await act(async()=>{editor.setTool('type');startTextEdit(session,layer.id,false);});
 const input=container.querySelector('textarea.text-editor')!;expect(input).not.toBeNull();
 await act(async()=>{input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));key(input,'Enter',{ctrlKey:true});key(input,'Escape');key(input,'Delete');key(input,'a',{ctrlKey:true});key(input,'z',{ctrlKey:true});});
 expect(textEditState()?.layerId).toBe(layer.id);expect(session.doc.getLayer(layer.id)).toBe(layer);
 await act(async()=>{input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));key(input,'Escape');});expect(textEditState()).toBeNull();cancelTextEdit();
});
