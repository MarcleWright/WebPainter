// @vitest-environment jsdom
import {act} from 'react';
import {createPortal} from 'react-dom';
import {afterEach,it,expect,vi} from 'vitest';
import {mountDirect,mountFrame} from '../../src/embedded/mount';
import {NumberField,Slider} from '../../src/ui/controls';
import {portalTarget,keyboardTarget} from '../../src/ui/surface';
import {editor} from '../../src/app/editor';
import {run} from '../../src/app/actions';
import {createNative} from '../../src/document/native';
vi.mock('../../src/ui/App',()=>({App:()=> <><NumberField label="Number" value={100} onChange={v=>void run('layer.setOpacity',{value:v/100})}/>{createPortal(<Slider label="Slider" value={100} onChange={v=>void run('layer.setOpacity',{value:v/100})}/>,portalTarget())}</>}));
vi.mock('../../src/typography/fonts',()=>({fonts:{load:async()=>{},list:()=>[]}}));
vi.mock('../../src/color/cms',()=>({colorEngine:{init:async()=>{}}}));
let api:ReturnType<typeof mountFrame>|undefined,node:HTMLDivElement;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
afterEach(async()=>{for(const s of [...editor.sessions])editor.removeSession(s.id);if(api)await act(async()=>api!.destroy());api=undefined;node?.remove();});
for(const shadow of [false,true])it((shadow?'Shadow':'Frame')+' mount wakes after final owner commit, never treats focus as draft',async()=>{
 node=document.createElement('div');document.body.append(node);const events:any[]=[];await act(async()=>{api=(shadow?mountDirect:mountFrame)(node,{nativeVersion:1,readResource:async()=>({name:'a.wpnative',bytes:createNative(24,16)}),save:async()=>{},export:async()=>{},confirm:async()=>0,dirty:s=>events.push(s),error(){}});await api.open('binding','resource');});
 const surface=shadow?node.shadowRoot!:node,number=surface.querySelector<HTMLInputElement>('input.num')!,range=(shadow?surface:document).querySelector<HTMLInputElement>('input[type=range]')!;expect(keyboardTarget()).toBe(shadow?node:window);
 const change=(el:HTMLInputElement,value:string)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));};
 await act(async()=>number.focus());expect(api!.state().checkpointReady).toBe(true);
 await act(async()=>{number.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,composed:true}));change(number,'42');number.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,composed:true}));});expect(api!.state().hasUncommittedChanges).toBe(true);expect(await api!.saveBackground()).toBe('deferred');const n=events.length;
 await act(async()=>number.blur());await vi.waitFor(()=>expect(events.slice(n).some(s=>s.checkpointReady)).toBe(true));expect(editor.active!.activeLayer()!.opacity).toBe(.42);
 await act(async()=>{number.focus();number.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',bubbles:true,composed:true}));});expect(api!.state().checkpointReady).toBe(false);const before=events.length;
 await act(async()=>number.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowDown',code:'ArrowDown',bubbles:true,composed:true})));await vi.waitFor(()=>expect(events.slice(before).some(s=>s.checkpointReady)).toBe(true));expect((shadow?node.shadowRoot!.activeElement:document.activeElement)).toBe(number);
 await act(async()=>{number.blur();range.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,composed:true}));});expect(api!.state().checkpointReady).toBe(false);const last=events.length;await act(async()=>range.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,composed:true})));await vi.waitFor(()=>expect(events.slice(last).some(s=>s.checkpointReady)).toBe(true));
 await act(async()=>range.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true,composed:true})));expect(api!.state().checkpointReady).toBe(true);
});
