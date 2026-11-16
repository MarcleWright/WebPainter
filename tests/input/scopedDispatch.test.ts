// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('../../src/app/platform/platform',()=>({platform:()=>({setTitle(){},setEdited(){}})}));
import {installInputDispatch} from '../../src/app/inputDispatch';
import {installInputContext,isComposing} from '../../src/app/inputContext';
import {inputSession,clearInputSessions} from './fixture';
import {register,actionDefinitions} from '../../src/app/actions';
import {keymap} from '../../src/app/shortcuts';
import {ui,useApp} from '../../src/app/store';
import {editor} from '../../src/app/editor';
import {panHeld} from '../../src/app/heldPan';
const originalSave=actionDefinitions().find(a=>a.id==='file.save')!;
let host:HTMLDivElement,shadow:ShadowRoot,canvas:HTMLDivElement,input:HTMLInputElement,dispose:()=>void;
const key=(target:EventTarget,value:string,init:KeyboardEventInit={})=>{const e=new KeyboardEvent('keydown',{key:value,bubbles:true,composed:true,cancelable:true,...init});target.dispatchEvent(e);return e;};
beforeEach(()=>{keymap.reset();ui.set({dialogs:[],tool:'move'});inputSession();host=document.createElement('div');document.body.append(host);shadow=host.attachShadow({mode:'open'});canvas=document.createElement('div');input=document.createElement('input');shadow.append(canvas,input);dispose=()=>{};});
afterEach(()=>{dispose();host.remove();clearInputSessions();register(originalSave);keymap.reset();vi.restoreAllMocks();});
it.each(['root','element'] as const)('scoped %s owns canvas keys while host keys remain untouched and dispose removes listeners',kind=>{
 dispose=installInputDispatch(kind==='root'?shadow:canvas);
 const outside=key(document.body,'b');expect(outside.defaultPrevented).toBe(false);expect(useApp.getState().tool).toBe('move');
 expect(key(canvas,'b').defaultPrevented).toBe(true);expect(useApp.getState().tool).toBe('brush');
 dispose();dispose=()=>{};editor.setTool('move');expect(key(canvas,'b').defaultPrevented).toBe(false);expect(useApp.getState().tool).toBe('move');
});
it.each([false,true])('shadow text capture preserves Ctrl+S/IME and ignores drawing keys with window=%s',standalone=>{
 let saves=0;register({id:'file.save',label:'Save',shortcut:'Ctrl+S',run:()=>{saves++;}});keymap.rebuild();dispose=installInputDispatch(standalone?window:shadow);
 input.addEventListener('keydown',e=>e.stopPropagation());
 expect(key(input,'b').defaultPrevented).toBe(false);expect(useApp.getState().tool).toBe('move');
 expect(key(input,'s',{ctrlKey:true}).defaultPrevented).toBe(true);expect(saves).toBe(1);
 input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,composed:true}));
 expect(key(input,'s',{ctrlKey:true}).defaultPrevented).toBe(false);expect(saves).toBe(1);
 input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,composed:true}));
 key(input,'s',{ctrlKey:true});expect(saves).toBe(2);key(input,'s',{ctrlKey:true,repeat:true});expect(saves).toBe(2);
 dispose();dispose=()=>{};expect(key(input,'s',{ctrlKey:true}).defaultPrevented).toBe(false);expect(saves).toBe(2);
});
it('context alone uses original non-text composition identity across retargeting and removes capture handlers',()=>{
 dispose=installInputContext(window);let composing=false;window.addEventListener('keydown',function check(e){composing=isComposing(e);window.removeEventListener('keydown',check);});
 canvas.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,composed:true}));key(canvas,'b');expect(composing).toBe(true);
 canvas.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,composed:true}));
});
it('local held pan still clears on window blur and text focus within the shadow root',()=>{
 dispose=installInputDispatch(shadow);const s=editor.active!;key(canvas,' ',{code:'Space'});expect(panHeld(s)).toBe(true);
 window.dispatchEvent(new Event('blur'));expect(panHeld(s)).toBe(false);
 key(canvas,' ',{code:'Space'});input.dispatchEvent(new FocusEvent('focusin',{bubbles:true,composed:true}));expect(panHeld(s)).toBe(false);
});


it('shadow keyup reaches the retained tool only from non-text local input',()=>{
 editor.setTool('pen');const tool=editor.currentTool!,up=vi.spyOn(tool,'keyUp');dispose=installInputDispatch(shadow);
 const release=(target:EventTarget)=>target.dispatchEvent(new KeyboardEvent('keyup',{key:'Control',bubbles:true,composed:true}));
 release(document.body);release(input);expect(up).not.toHaveBeenCalled();release(canvas);expect(up).toHaveBeenCalledTimes(1);
 dispose();dispose=()=>{};release(canvas);expect(up).toHaveBeenCalledTimes(1);
});
