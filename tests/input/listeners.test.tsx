// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({kind:'electron',canWriteInPlace:true,bridge:null,setTitle(){},setEdited(){},writePath:vi.fn(),chooseSavePath:vi.fn(),confirm:vi.fn(),recovery:{remove:vi.fn(),save:vi.fn()}}));
vi.mock('../../src/app/platform/platform',()=>({platform:()=>io}));
import {App} from '../../src/ui/App';
import {Modal} from '../../src/ui/dialogs/Modal';
import {NumberField} from '../../src/ui/controls';
import {inputSession,clearInputSessions,key} from './fixture';
import {keymap} from '../../src/app/shortcuts';
import {ui,useApp} from '../../src/app/store';
import {register,actionDefinitions} from '../../src/app/actions';
const originalSave=actionDefinitions().find(a=>a.id==='file.save')!;
// Replace layout/panels and graphics only. Production App, CanvasView, text controls and Modal listeners run.
vi.mock('../../src/ui/Workspace',async()=>{const {CanvasView}=await import('../../src/ui/CanvasView');return {Workspace:CanvasView};});
vi.mock('../../src/ui/OptionsBar',()=>({OptionsBar:()=>null}));
vi.mock('../../src/ui/Toolbar',()=>({Toolbar:()=>null}));
vi.mock('../../src/rendering/viewportRenderer',()=>({createViewportRendererAsync:async(canvas:HTMLCanvasElement)=>({canvas,renderer:{kind:'canvas2d',resize(){},dispose(){}}})}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,container:HTMLDivElement;
beforeEach(()=>{
 HTMLElement.prototype.setPointerCapture=()=>{};HTMLElement.prototype.releasePointerCapture=()=>{};HTMLElement.prototype.hasPointerCapture=()=>false;
 vi.stubGlobal('__APP_VERSION__','test');
 vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(()=>new Proxy({measureText:()=>({width:10}),createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h})},{get:(object,key)=>Reflect.get(object,key)??(()=>{})}) as any);
 vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);keymap.reset();ui.set({groupTool:{}, tool:'move'});
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();clearInputSessions();ui.set({dialogs:[]});register(originalSave);keymap.reset();vi.clearAllMocks();vi.restoreAllMocks();vi.unstubAllGlobals();});
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
import {createPixelLayer} from '../../src/document/layerFactory';
import {installAccessPolicy,access} from '../../src/app/access';
function pointer(target:EventTarget,type:string,x:number,y:number) {
 const event=new MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1});
 Object.defineProperty(event,'pointerId',{value:1});target.dispatchEvent(event);
}
it('real brush Ctrl+] arranges one layer without resizing; public bracket action releases its old key',async()=>{
 const {session}=await mount();const bottom=session.activeLayer()!;session.doc.insertLayer(createPixelLayer('Top',8));session.setActive(bottom.id);
 await act(async()=>{editor.setTool('brush');ui.setBrush({size:40});key(container.querySelector('.viewport')!,']',{code:'BracketRight',ctrlKey:true});});
 expect(useApp.getState().brush.size).toBe(40);expect(session.doc.root.children.at(-1)?.id).toBe(bottom.id);
 keymap.set('brush.size.increase',['F6']);await act(async()=>{key(window,']',{code:'BracketRight'});});expect(useApp.getState().brush.size).toBe(40);
 await act(async()=>{key(window,'F6');});expect(useApp.getState().brush.size).toBe(45);
});
it('explicit pencil key ignores brush group memory; reassigned Shift+B and digits no longer reach old consumers',async()=>{
 await mount();await act(async()=>editor.setTool('brush'));keymap.set('tool:pencil',['F6']);
 await act(async()=>key(window,'F6'));expect(useApp.getState().tool).toBe('pencil');
 keymap.reassign('color.reset','Shift+B');await act(async()=>key(window,'B',{shiftKey:true}));expect(useApp.getState().tool).toBe('pencil');
 keymap.reassign('color.swap','1');const opacity=useApp.getState().brush.opacity;await act(async()=>key(window,'1'));await new Promise(r=>setTimeout(r,380));expect(useApp.getState().brush.opacity).toBe(opacity);
});
it('delayed numeric applies two digits once, and cancels on layer/tool/document/focus/modal changes',async()=>{
 const {session}=await mount();await act(async()=>{editor.setTool('brush');key(window,'2');key(window,'5');});expect(useApp.getState().brush.opacity).toBe(.25);
 for (const change of [()=>session.setActive(null),()=>editor.setTool('pencil'),()=>ui.openDialog('about'),()=>{const input=document.createElement('input');container.append(input);input.focus();},()=>inputSession()]) {
  await act(async()=>{ui.set({dialogs:[]});document.querySelectorAll('input').forEach(i=>i.blur());key(window,'7');change();});
  await new Promise(r=>setTimeout(r,380));expect(useApp.getState().brush.opacity).toBe(.25);
 }
});
it('held pan keeps pointer owner after keyup; repeat, blur, new document and explicit tool selection invalidate safely',async()=>{
 const {session}=await mount();const canvas=container.querySelector('.viewport')!;await act(async()=>editor.setTool('brush'));
 const history=session.history.current.id, before=session.view.panX;
 await act(async()=>{key(canvas,' ',{code:'Space'});key(canvas,' ',{code:'Space',repeat:true});pointer(canvas,'pointerdown',2,2);window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space'}));pointer(canvas,'pointermove',12,2);pointer(canvas,'pointerup',12,2);});
 expect(session.view.panX-before).toBe(10);expect(session.history.current.id).toBe(history);expect(useApp.getState().tool).toBe('brush');
 await act(async()=>{key(canvas,' ',{code:'Space'});pointer(canvas,'pointerdown',2,2);window.dispatchEvent(new Event('blur'));pointer(canvas,'pointermove',20,2);pointer(canvas,'pointerup',20,2);});expect(session.view.panX-before).toBe(10);
 await act(async()=>{key(canvas,' ',{code:'Space'});editor.setTool('pencil');window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space'}));});expect(useApp.getState().tool).toBe('pencil');
 keymap.reassign('color.reset','Space');await act(async()=>{key(canvas,' ',{code:'Space'});pointer(canvas,'pointerdown',2,2);pointer(canvas,'pointerup',2,2);});expect(session.view.panX-before).toBe(10);
});
it('protected real text session rejects Escape/tool switch/undo; non-target doc remains editable and access cannot bypass',async()=>{
 const {session}=await mount();const layer=createTextLayer('保护',8,0,0);session.doc.insertLayer(layer);
 await act(async()=>{editor.setTool('type');startTextEdit(session,layer.id,false);});const input=container.querySelector('textarea.text-editor')!;
 session.editProtected=true;const history=session.history.current.id;
 await act(async()=>{key(input,'Escape');key(window,'b');key(window,'z',{ctrlKey:true});});expect(textEditState()?.layerId).toBe(layer.id);expect(useApp.getState().tool).toBe('type');expect(session.history.current.id).toBe(history);
 session.editProtected=false;await act(async()=>key(input,'Escape'));expect(textEditState()).toBeNull();
 const restore=installAccessPolicy(id=>({visible:true,enabled:id!=='tool:brush'}));await act(async()=>key(window,'b'));expect(useApp.getState().tool).not.toBe('brush');restore();
 session.editProtected=true;let other!:ReturnType<typeof inputSession>;await act(async()=>{other=inputSession();key(window,'b');});expect(useApp.getState().tool).toBe('pencil');expect(other.session.canEdit()).toBe(true);
 session.editProtected=false;
});
it('actual transform Enter/Escape protects local context and normal confirmation/cancel stays local',async()=>{
 const {session}=await mount();const layer=session.activeLayer()!;if(layer.kind!=='pixel')throw Error('fixture');layer.raster.writeFloat({x:0,y:0,w:2,h:2},new Float32Array(16).fill(1));
 await act(async()=>key(window,'t',{ctrlKey:true}));expect(session.mode.kind).toBe('transform');const history=session.history.current.id;
 session.editProtected=true;await act(async()=>{key(window,'Enter');key(window,'Escape');key(window,'b');});expect(session.mode.kind).toBe('transform');expect(session.history.current.id).toBe(history);
 session.editProtected=false;await act(async()=>key(window,'Escape'));expect(session.mode.kind).toBe('none');
 await act(async()=>key(window,'t',{ctrlKey:true}));await act(async()=>key(window,'Enter'));expect(session.mode.kind).toBe('none');
});
import {importPsd} from '../../src/psd/import';
import {run} from '../../src/app/actions';
it('real keyboard undo→save and save→undo preserve snapshot order during delayed output, tool and local edits are blocked',async()=>{
 const {session}=await mount();const l=session.activeLayer()!;if(l.kind!=='pixel')throw Error('fixture');l.raster.writeFloat({x:0,y:0,w:2,h:2},new Float32Array(16).fill(1));
 session.doc.filePath='input-save.psd';session.doc.fileFormat='psd';
 await run('layer.setOpacity',{value:.4});await act(async()=>key(window,'z',{ctrlKey:true}));expect(session.activeLayer()!.opacity).toBe(1);
 let release!:()=>void, began!:()=>void;const ready=new Promise<void>(r=>began=r);io.writePath.mockImplementation(()=>{began();return new Promise<void>(r=>release=r);});io.recovery.remove.mockResolvedValue(undefined);
 await act(async()=>{key(window,'s',{ctrlKey:true});await ready;});expect(session.canEdit()).toBe(false);
 const entry=session.history.current.id;await act(async()=>{key(window,'z',{ctrlKey:true});key(window,'b');key(window,'ArrowRight');key(window,'Escape');});expect(session.history.current.id).toBe(entry);expect(useApp.getState().tool).toBe('move');
 const saved=importPsd(io.writePath.mock.calls[0][1],'input-save.psd').doc;expect(saved.allLayers().find(x=>x.kind==='pixel')!.opacity).toBe(1);
 let other!:ReturnType<typeof inputSession>;await act(async()=>{other=inputSession();key(window,'b');});expect(useApp.getState().tool).toBe('brush');expect(other.session.canEdit()).toBe(true);
 const saving=session.outputPending!;release();await act(async()=>{await saving;});expect(session.canEdit()).toBe(true);
});
it('actual Move pointer transaction rejects global undo/Space mid-drag and creates one history entry',async()=>{
 const {session}=await mount();const l=session.activeLayer()!;if(l.kind!=='pixel')throw Error('fixture');l.raster.writeFloat({x:0,y:0,w:4,h:4},new Float32Array(64).fill(1));
 const canvas=container.querySelector('.viewport')!;await act(async()=>editor.setTool('move'));const count=session.history.entries.length;
 await act(async()=>{pointer(canvas,'pointerdown',1,1);pointer(canvas,'pointermove',5,1);key(canvas,'z',{ctrlKey:true});key(canvas,' ',{code:'Space'});pointer(canvas,'pointerup',5,1);});
 expect(session.history.entries.length).toBe(count+1);expect(session.view.panX).toBe(0);expect(editor.currentTool?.busy?.()).toBe(false);
});
it('async transform entry cancels when its original target changes before module continuation',async()=>{
 const {session}=await mount();const l=session.activeLayer()!;if(l.kind!=='pixel')throw Error('fixture');l.raster.writeFloat({x:0,y:0,w:2,h:2},new Float32Array(16).fill(1));
 let other!:ReturnType<typeof inputSession>;await act(async()=>{key(window,'t',{ctrlKey:true});other=inputSession();});expect(other.session.mode.kind).toBe('none');expect(session.mode.kind).toBe('none');
});
it('busy polygon selection keeps local Delete/Enter ownership, and save protection preserves its unfinished points',async()=>{
 const {session}=await mount();const canvas=container.querySelector('.viewport')!;await act(async()=>editor.setTool('polyLasso'));
 await act(async()=>{pointer(canvas,'pointerdown',1,1);pointer(canvas,'pointerup',1,1);pointer(canvas,'pointerdown',9,1);pointer(canvas,'pointerup',9,1);pointer(canvas,'pointerdown',9,9);pointer(canvas,'pointerup',9,9);});
 expect(editor.currentTool?.busy?.()).toBe(true);session.editProtected=true;await act(async()=>{key(canvas,'Enter');key(canvas,'Escape');});expect(editor.currentTool?.busy?.()).toBe(true);expect(session.doc.selection.isEmpty()).toBe(true);
 session.editProtected=false;await act(async()=>key(canvas,'Enter'));expect(editor.currentTool?.busy?.()).toBe(false);expect(session.doc.selection.isEmpty()).toBe(false);
});
it('rebound held key works, while late events after document change cannot move either view',async()=>{
 const {session}=await mount();const canvas=container.querySelector('.viewport')!;keymap.set('input.pan',['F7']);
 await act(async()=>{key(canvas,'F7',{code:'F7'});pointer(canvas,'pointerdown',1,1);pointer(canvas,'pointermove',5,1);});expect(session.view.panX).toBe(4);
 let other!:ReturnType<typeof inputSession>;await act(async()=>{other=inputSession();window.dispatchEvent(new KeyboardEvent('keyup',{key:'F7',code:'F7'}));pointer(canvas,'pointermove',10,1);pointer(canvas,'pointerup',10,1);});expect(other.session.view.panX).toBe(0);expect(session.view.panX).toBe(4);
});
it('real paint stroke and pen point interaction retain their own history and protected Enter/Escape',async()=>{
 const {session}=await mount();const canvas=container.querySelector('.viewport')!;await act(async()=>{editor.setTool('brush');ui.setBrush({opacity:1,flow:1,size:2});});const count=session.history.entries.length;
 await act(async()=>{pointer(canvas,'pointerdown',2,2);pointer(canvas,'pointermove',8,2);key(canvas,'z',{ctrlKey:true});pointer(canvas,'pointerup',8,2);});expect(session.history.entries.length).toBe(count+1);
 await act(async()=>{editor.setTool('pen');pointer(canvas,'pointerdown',1,1);pointer(canvas,'pointerup',1,1);pointer(canvas,'pointerdown',10,6);pointer(canvas,'pointerup',10,6);});
 const entry=session.history.current.id, paths=JSON.stringify(session.doc.paths);session.editProtected=true;await act(async()=>{key(canvas,'Enter');key(canvas,'Escape');key(canvas,'b');});expect(session.history.current.id).toBe(entry);expect(JSON.stringify(session.doc.paths)).toBe(paths);expect(useApp.getState().tool).toBe('pen');
 session.editProtected=false;await act(async()=>key(canvas,'Enter'));expect(session.history.current.id).not.toBe(entry);
});
import {createMask,createGroupLayer} from '../../src/document/layerFactory';
const pixels=(layer:ReturnType<typeof createPixelLayer>)=>layer.raster.readFloat({x:0,y:0,w:16,h:12});
function paintFixture(session:ReturnType<typeof inputSession>['session']) {
 const layer=session.activeLayer()!;if(layer.kind!=='pixel')throw Error('fixture');
 const data=new Float32Array(16*12*4);for(let i=0;i<16*12;i++){data[i*4]=.2;data[i*4+1]=.4;data[i*4+2]=.6;data[i*4+3]=1;}layer.raster.writeFloat({x:0,y:0,w:16,h:12},data);return layer;
}
it('Ctrl+J copies soft selection once with final business macro, rebind migrates context behavior, Cut undo/redo preserves coverage',async()=>{
 const {session}=await mount();const source=paintFixture(session);session.doc.selection.setRegion({x:1,y:1,w:2,h:2},new Float32Array([.25,.5,.75,1]));const original=pixels(source), count=session.history.entries.length;
 await act(async()=>key(window,'j',{ctrlKey:true}));expect(session.doc.layerCount()).toBe(2);expect(pixels(source)).toEqual(original);expect(session.history.entries.length).toBe(count+1);expect(session.history.current.command?.record?.action).toBe('layer.viaCopy');
 const copied=session.activeLayer()!;if(copied.kind!=='pixel')throw Error('fixture');const alpha=copied.raster.readFloat({x:1,y:1,w:2,h:2});expect(alpha[3]).toBeCloseTo(.25,2);expect(alpha[7]).toBeCloseTo(.5,2);expect(copied.raster.readFloat({x:0,y:0,w:1,h:1})[3]).toBe(0);
 await act(async()=>key(window,'z',{ctrlKey:true}));expect(session.doc.layerCount()).toBe(1);await act(async()=>key(window,'z',{ctrlKey:true,shiftKey:true}));expect(session.doc.layerCount()).toBe(2);
 await act(async()=>key(window,'z',{ctrlKey:true}));session.setActive(source.id);keymap.set('layer.copyContext',['F6']);await act(async()=>key(window,'j',{ctrlKey:true}));expect(session.doc.layerCount()).toBe(1);await act(async()=>key(window,'F6'));expect(session.doc.layerCount()).toBe(2);
 await act(async()=>key(window,'z',{ctrlKey:true}));session.setActive(source.id);await act(async()=>key(window,'j',{ctrlKey:true,shiftKey:true}));expect(session.history.current.command?.record?.action).toBe('layer.viaCut');expect(source.raster.readFloat({x:1,y:1,w:1,h:1})[3]).toBeCloseTo(.75,2);
 await act(async()=>key(window,'z',{ctrlKey:true}));expect(pixels(source)).toEqual(original);await act(async()=>key(window,'z',{ctrlKey:true,shiftKey:true}));expect(source.raster.readFloat({x:1,y:1,w:1,h:1})[3]).toBeCloseTo(.75,2);
});
it('context copy duplicates no-selection/non-pixel/multi-layer targets; empty intersection and denied final action never fall back',async()=>{
 const {session}=await mount();const source=paintFixture(session);
 await act(async()=>key(window,'j',{ctrlKey:true}));expect(session.history.current.command?.record?.action).toBe('layer.duplicate');await act(async()=>key(window,'z',{ctrlKey:true}));session.setActive(source.id);
 session.doc.selection.setRegion({x:40,y:40,w:2,h:2},new Float32Array(4).fill(1));await act(async()=>key(window,'j',{ctrlKey:true}));expect(session.doc.layerCount()).toBe(1);
 session.doc.selection.setRegion({x:1,y:1,w:2,h:2},new Float32Array(4).fill(1));const restore=installAccessPolicy(id=>({visible:true,enabled:id!=='action:layer.viaCopy'}));await act(async()=>key(window,'j',{ctrlKey:true}));expect(session.doc.layerCount()).toBe(1);expect(useApp.getState().toasts.at(-1)?.message).toMatch(/unavailable/);restore();
 const group=createGroupLayer('Group');session.doc.insertLayer(group);session.setActive(group.id);await act(async()=>key(window,'j',{ctrlKey:true}));expect(session.history.current.command?.record?.action).toBe('layer.duplicate');await act(async()=>key(window,'z',{ctrlKey:true}));
 session.setActive(source.id);session.selectedIds.add(group.id);const n=session.doc.layerCount();await act(async()=>key(window,'j',{ctrlKey:true}));expect(session.doc.layerCount()).toBe(n+2);expect(session.history.current.command?.record?.action).toBe('layer.duplicate');
});
it('foreground/background aliases and Fill dialog each use one history entry, preserve selection, mask targets and pixel locks',async()=>{
 const {session}=await mount();let layer=paintFixture(session);session.doc.selection.setRegion({x:1,y:1,w:1,h:1},new Float32Array([.5]));ui.set({fg:{r:1,g:0,b:0},bg:{r:0,g:0,b:1}});const original=pixels(layer);
 for (const [value,init] of [['Backspace',{altKey:true}],['Delete',{altKey:true}],['Backspace',{ctrlKey:true}],['Delete',{ctrlKey:true}]] as [string,KeyboardEventInit][]) {
  const n=session.history.index;await act(async()=>key(window,value,init));expect(session.history.index).toBe(n+1);expect(pixels(layer)).not.toEqual(original);expect(layer.raster.readFloat({x:0,y:0,w:1,h:1})[0]).toBeCloseTo(.2,2);await act(async()=>key(window,'z',{ctrlKey:true}));expect(pixels(layer)).toEqual(original);
 }
 layer.locks.pixels=true;const entry=session.history.current.id;await act(async()=>key(window,'Delete',{altKey:true}));expect(session.history.current.id).toBe(entry);expect(pixels(layer)).toEqual(original);layer.locks.pixels=false;
 layer.mask=createMask(true);session.editMask=true;await act(async()=>key(window,'Delete',{altKey:true}));expect(pixels(layer)).toEqual(original);expect(layer.mask.raster.readFloat({x:1,y:1,w:1,h:1})[0]).not.toBe(1);await act(async()=>key(window,'z',{ctrlKey:true}));expect(layer.mask.raster.readFloat({x:1,y:1,w:1,h:1})[0]).toBe(1);session.editMask=false;
 for(const [value,init] of [['F5',{shiftKey:true}],['Backspace',{shiftKey:true}],['Delete',{shiftKey:true}]] as [string,KeyboardEventInit][]) {
  await act(async()=>key(window,value,init));expect(container.querySelector('[role=dialog]')?.getAttribute('aria-label')).toBe('Fill');const before=session.history.current.id;await act(async()=>container.querySelector<HTMLButtonElement>('[role=dialog] button.primary')!.click());expect(session.history.current.id).not.toBe(before);expect(session.history.current.command?.record?.action).toBe('edit.fill');await act(async()=>key(window,'z',{ctrlKey:true}));
 }
});
async function modifyAdjustment(kind:string) {
 if(kind==='curves') {
  const canvas=container.querySelector<HTMLCanvasElement>('.curve-editor')!;vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:240,height:240,right:240,bottom:240,x:0,y:0,toJSON(){}});
  await act(async()=>{pointer(canvas,'pointerdown',110,65);pointer(canvas,'pointerup',110,65);});
 } else {
  const label=kind==='hueSaturation'?'Lightness':kind==='levels'?'Gamma':'Cyan ↔ Red';const input=container.querySelector<HTMLInputElement>(`input[type=range][aria-label="${label}"]`)!;expect(input).not.toBeNull();
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,kind==='levels'?'2':'25');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
 }
}
it.each([['u','hueSaturation','Hue/Saturation'],['m','curves','Curves'],['l','levels','Levels'],['b','colorBalance','Color Balance']])('Ctrl+%s real adjustment preview/cancel/confirm changes pixels once and retains undo/redo',async(value,kind,title)=>{
 const {session}=await mount();const layer=paintFixture(session), original=pixels(layer), index=session.history.index;
 await act(async()=>key(window,value,{ctrlKey:true}));expect(container.querySelector('[role=dialog]')?.getAttribute('aria-label')).toBe(title);await modifyAdjustment(kind);
 expect(pixels(layer)).toEqual(original);expect(session.history.index).toBe(index);const preview=session.engine.getOverride(layer.id)!;expect(preview).toBeTruthy();expect(preview.read!({x:0,y:0,w:1,h:1},0)).not.toEqual(original.slice(0,4));
 await act(async()=>key(container.querySelector('[role=dialog]')!,'Escape'));expect(session.engine.getOverride(layer.id)).toBeFalsy();expect(pixels(layer)).toEqual(original);expect(session.history.index).toBe(index);
 await act(async()=>key(window,value,{ctrlKey:true}));await modifyAdjustment(kind);await act(async()=>{key(container.querySelector('[role=dialog]')!,'Enter');await new Promise(r=>setTimeout(r,5));});
 expect(session.history.index).toBe(index+1);expect(session.history.current.command?.record?.action).toBe('image.adjust');expect(session.doc.layerCount()).toBe(1);const adjusted=pixels(layer);expect(adjusted).not.toEqual(original);
 await act(async()=>key(window,'z',{ctrlKey:true}));expect(pixels(layer)).toEqual(original);await act(async()=>key(window,'z',{ctrlKey:true,shiftKey:true}));expect(pixels(layer)).toEqual(adjusted);
});
it('context menu displays rebound copy entry and invokes the same action; direct legacy Duplicate remains whole-layer',async()=>{
 const {session}=await mount();const layer=paintFixture(session);session.doc.selection.setRegion({x:1,y:1,w:1,h:1},new Float32Array([1]));keymap.set('layer.copyContext',['F6']);
 await act(async()=>{[...container.querySelectorAll<HTMLElement>('.menu-title')].find(e=>e.textContent==='Layer')!.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));});
 const entry=[...document.querySelectorAll<HTMLElement>('[role=menuitem]')].find(e=>e.textContent?.includes('复制选区或图层'))!;expect(entry.textContent).toContain('F6');await act(async()=>entry.click());expect(session.history.current.command?.record?.action).toBe('layer.viaCopy');
 await act(async()=>key(window,'z',{ctrlKey:true}));session.setActive(layer.id);await run('layer.duplicate');const copy=session.activeLayer()!;if(copy.kind!=='pixel')throw Error('fixture');expect(copy.raster.readFloat({x:0,y:0,w:1,h:1})[3]).toBe(1);expect(session.history.current.command?.record?.action).toBe('layer.duplicate');
});
it('new adjustment/fill keys do not cross text or numeric focus; unsupported layer disables pixel adjustment',async()=>{
 const {session}=await mount(<NumberField label="Focus" value={1} onChange={()=>{}}/>);const input=container.querySelector('input')!;
 await act(async()=>{key(input,'u',{ctrlKey:true});key(input,'Delete',{altKey:true});key(input,'Delete',{shiftKey:true});});expect(container.querySelector('[role=dialog]')).toBeNull();
 const group=createGroupLayer('Group');session.doc.insertLayer(group);session.setActive(group.id);await act(async()=>key(window,'u',{ctrlKey:true}));expect(container.querySelector('[role=dialog]')).toBeNull();expect(useApp.getState().toasts.at(-1)?.message).toMatch(/unavailable/);
});
it('adjustment confirmation cannot act on a changed document; modal keys stay isolated during protection',async()=>{
 const {session}=await mount();paintFixture(session);await act(async()=>key(window,'u',{ctrlKey:true}));await modifyAdjustment('hueSaturation');
 const index=session.history.index;session.editProtected=true;await act(async()=>{key(container.querySelector('[role=dialog]')!,'Escape');key(container.querySelector('[role=dialog]')!,'Enter');await new Promise(r=>setTimeout(r,5));});expect(session.history.index).toBe(index);expect(container.querySelector('[role=dialog]')).not.toBeNull();session.editProtected=false;
 let other!:ReturnType<typeof inputSession>;await act(async()=>{other=inputSession();});const entry=other.session.history.current.id;await act(async()=>container.querySelector<HTMLButtonElement>('[role=dialog] button.primary')!.click());expect(other.session.history.current.id).toBe(entry);expect(session.history.index).toBe(index);await act(async()=>ui.set({dialogs:[]}));
});
it('adjustment selection coverage changes only selected pixels and undo/redo restores exact raster values',async()=>{
 const {session}=await mount();const layer=paintFixture(session), original=pixels(layer);session.doc.selection.setRegion({x:1,y:1,w:1,h:1},new Float32Array([.5]));
 await act(async()=>key(window,'u',{ctrlKey:true}));await modifyAdjustment('hueSaturation');await act(async()=>container.querySelector<HTMLButtonElement>('[role=dialog] button.primary')!.click());const adjusted=pixels(layer);
 expect(layer.raster.readFloat({x:0,y:0,w:1,h:1})).toEqual(original.slice(0,4));expect(layer.raster.readFloat({x:1,y:1,w:1,h:1})[0]).not.toBe(original[0]);expect(session.doc.selection.read({x:1,y:1,w:1,h:1})[0]).toBeCloseTo(.5,2);
 await act(async()=>key(window,'z',{ctrlKey:true}));expect(pixels(layer)).toEqual(original);await act(async()=>key(window,'z',{ctrlKey:true,shiftKey:true}));expect(pixels(layer)).toEqual(adjusted);
});
it('access-disabled pending pen edit cannot be discarded by tool switching or local Escape',async()=>{
 const {session}=await mount();const canvas=container.querySelector('.viewport')!;await act(async()=>{editor.setTool('pen');pointer(canvas,'pointerdown',1,1);pointer(canvas,'pointerup',1,1);pointer(canvas,'pointerdown',10,6);pointer(canvas,'pointerup',10,6);});
 expect(editor.currentToolId).toBe('pen');expect(editor.currentTool?.hasPendingEdit?.()).toBe(true);
 const restore=installAccessPolicy(id=>({visible:true,enabled:id!=='tool:pen'}));const history=session.history.current.id,path=JSON.stringify(session.doc.paths);
 expect(access('tool:pen').enabled).toBe(false);expect(editor.currentTool).toBeNull();
 await act(async()=>{editor.setTool('brush');});expect(useApp.getState().tool).toBe('pen');
 await act(async()=>{key(canvas,'b');key(canvas,'Escape');});expect(useApp.getState().tool).toBe('pen');expect(session.history.current.id).toBe(history);expect(JSON.stringify(session.doc.paths)).toBe(path);restore();await act(async()=>key(canvas,'Enter'));
});
it('disabled point-edit owner consumes Delete instead of falling back to global layer Clear',async()=>{
 const {session}=await mount();const layer=paintFixture(session), before=pixels(layer), canvas=container.querySelector('.viewport')!;
 await act(async()=>editor.setTool('directSelect'));
 const restore=installAccessPolicy(id=>({visible:true,enabled:id!=='tool:directSelect'}));const entry=session.history.current.id;
 try {await act(async()=>key(canvas,'Delete'));expect(session.history.current.id).toBe(entry);expect(pixels(layer)).toEqual(before);}finally{restore();}
});
it('disabled transform ownership rejects tool switching and local confirmation without discarding the mode',async()=>{
 const {session}=await mount();paintFixture(session);await act(async()=>key(window,'t',{ctrlKey:true}));expect(session.mode.kind).toBe('transform');
 const restore=installAccessPolicy(id=>({visible:true,enabled:id!=='action:edit.freeTransform'}));
 try {await act(async()=>{key(window,'b');key(window,'Enter');key(window,'Escape');});expect(session.mode.kind).toBe('transform');expect(useApp.getState().tool).toBe('move');}finally{restore();}
 await act(async()=>key(window,'Escape'));
});
it('real curve point Delete belongs to the dialog, respects IME/protection, and never clears layer pixels',async()=>{
 const {session}=await mount();const layer=paintFixture(session), before=pixels(layer), entry=session.history.current.id;
 await act(async()=>key(window,'m',{ctrlKey:true}));await modifyAdjustment('curves');const canvas=container.querySelector('.curve-editor')!;
 const added=session.engine.getOverride(layer.id)!.gpu!.adjustment as any;expect(added.rgb.length).toBe(3);
 await act(async()=>{canvas.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));key(canvas,'Delete');});expect((session.engine.getOverride(layer.id)!.gpu!.adjustment as any).rgb.length).toBe(3);
 await act(async()=>canvas.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));session.editProtected=true;await act(async()=>key(canvas,'Delete'));expect((session.engine.getOverride(layer.id)!.gpu!.adjustment as any).rgb.length).toBe(3);
 session.editProtected=false;await act(async()=>key(canvas,'Delete'));expect((session.engine.getOverride(layer.id)!.gpu!.adjustment as any).rgb.length).toBe(2);expect(pixels(layer)).toEqual(before);expect(session.history.current.id).toBe(entry);
 await act(async()=>key(container.querySelector('[role=dialog]')!,'Escape'));
});
it('vertical text owner retains its session when its own tool access is disabled',async()=>{
 const {session}=await mount();const layer=createTextLayer('Vertical',8,0,0);session.doc.insertLayer(layer);
 await act(async()=>{editor.setTool('typeVertical');startTextEdit(session,layer.id,false);});const input=container.querySelector('textarea.text-editor')!;
 const restore=installAccessPolicy(id=>({visible:true,enabled:id!=='tool:typeVertical'}));
 try {await act(async()=>{key(input,'Escape');key(input,'Enter',{ctrlKey:true});});expect(textEditState()?.layerId).toBe(layer.id);}finally{restore();}
 await act(async()=>key(input,'Escape'));expect(textEditState()).toBeNull();
});
