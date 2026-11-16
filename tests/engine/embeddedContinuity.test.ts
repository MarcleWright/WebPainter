// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {initializeEditor} from '../../src/embedded/editor';
import {editor} from '../../src/app/editor';
import {createNative,encodeNative,decodeNative} from '../../src/document/native';
import {tileSlots,reviveCheckpoint} from '../../src/embedded/checkpoint-wire';
import {installInputDispatch} from '../../src/app/inputDispatch';
import {panHeld} from '../../src/app/heldPan';
import {ui,useApp} from '../../src/app/store';
import {readPenSession,finishPen} from '../../src/tools/penSession';
import {SetLayerPropsCommand} from '../../src/commands/layerCommands';
let api:ReturnType<typeof initializeEditor>|undefined,off=()=>{};
let phase='prepare',release:()=>void;
class SlowWorker {
 onmessage:any;onerror:any;wire:any;slots:any[]=[];terminated=false;
 postMessage(message:any,transfer:Transferable[]=[]){const m=structuredClone(message,{transfer:transfer as any});const work=()=>{if(this.terminated)return;if(m.type==='start'){this.wire=m.document;this.slots=tileSlots(this.wire);}if(m.type==='tiles')m.tiles.forEach((b:any,i:number)=>this.slots[m.offset+i][1]=b);this.onmessage({data:m.type==='encode'?{bytes:encodeNative(reviveCheckpoint(this.wire))}:{ready:true}});};if((phase==='prepare'&&m.type==='start')||(phase==='encode'&&m.type==='encode'))release=work;else setTimeout(work,0);}
 terminate(){this.terminated=true;}
}
afterEach(()=>{off();for(const s of [...editor.sessions]){finishPen(s);editor.removeSession(s.id);}api?.destroy();api=undefined;editor.hostFactory=null;vi.unstubAllGlobals();ui.set({dialogs:[],tool:'brush',toasts:[]});});
function key(key:string,code:string,extra:KeyboardEventInit={}){window.dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true,cancelable:true,...extra}));window.dispatchEvent(new KeyboardEvent('keyup',{key,code,bubbles:true,...extra}));}
const point=(x:number,y:number)=>({x,y,sx:x,sy:y,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,shift:false,alt:false,mod:false,pointerType:'mouse',time:0,clickCount:1});
for(const stage of ['prepare','encode','host'])it('real dispatcher and Pen remain usable during '+stage+'; checkpoint stays fixed',async()=>{
 phase=stage;release=undefined as any;vi.stubGlobal('Worker',SlowWorker);let output:any;const events:any[]=[];
 api=initializeEditor({nativeVersion:1,readResource:async()=>({name:'a.wpnative',bytes:createNative(32,24)}),save:async o=>{output=o;if(stage==='host')await new Promise<void>(r=>release=r);},export:async()=>{},confirm:async()=>0,dirty:s=>events.push(s),error(){}});await api.open('binding','resource');const s=editor.active!,h={editor,session:s,redraw(){},setCursor(){},viewportSize:()=>({w:320,h:240})};editor.hostFactory=()=>h;off=installInputDispatch(window);editor.setTool('brush');
 const l=s.activeLayer()!;s.push(new SetLayerPropsCommand('opacity',l.id,{opacity:l.opacity},{opacity:.4}));const entry=s.history.current.id,pending=api.saveBackground();await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
 expect(api.state().outputBusy).toBe(true);expect(s.canEdit()).toBe(true);expect(await api.saveBackground()).toBe('deferred');
 const fg={r:.2,g:.3,b:.4},bg={r:.8,g:.7,b:.6};ui.set({fg,bg});key('x','KeyX');expect(useApp.getState().fg).toEqual(bg);key('d','KeyD');expect(useApp.getState().fg).toEqual({r:0,g:0,b:0});
 ui.setBrush({size:20,hardness:.5});key(']','BracketRight');expect(useApp.getState().brush.size).toBeGreaterThan(20);key('[','BracketLeft');expect(useApp.getState().brush.size).toBe(20);key(']','BracketRight',{shiftKey:true});expect(useApp.getState().brush.hardness).toBeGreaterThan(.5);key('[','BracketLeft',{shiftKey:true});expect(useApp.getState().brush.hardness).toBe(.5);
 key('e','KeyE');expect(editor.currentToolId).toBe('eraser');window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space'}));expect(panHeld(s)).toBe(true);window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space'}));expect(panHeld(s)).toBe(false);
 editor.setTool('pen');ui.setToolOptions('pen',{mode:'path'});const pen=editor.currentTool!;for(const [x,y]of [[2,2],[20,2],[20,18]]){pen.down!(h,point(x,y));pen.up!(h,point(x,y));}expect(readPenSession(s)).not.toBeNull();key('Enter','Enter',{ctrlKey:true});expect(readPenSession(s)).toBeNull();expect(s.doc.selection.isEmpty()).toBe(false);expect(s.doc.paths[0].path.subpaths[0].knots).toHaveLength(3);
 s.push(new SetLayerPropsCommand('new opacity',l.id,{opacity:l.opacity},{opacity:.7}));release();expect(await pending).toBe('saved');expect(output.checkpoint).toBe(entry);expect(decodeNative(output.bytes).doc.getLayer(l.id)!.opacity).toBe(.4);expect(decodeNative(output.bytes).doc.paths).toHaveLength(0);expect(s.modified).toBe(true);expect(api.state().outputBusy).toBe(false);expect(ui.get().toasts.some(t=>/busy|unavailable/i.test(t.message??''))).toBe(false);
});

it('the six finite native actions remain subject to product-disabled policy through keys and Toolbar',async()=>{
 const ids=['color.reset','color.swap','brush.size.decrease','brush.size.increase','brush.hardness.decrease','brush.hardness.increase'];const {action,run}=await import('../../src/app/actions');
 api=initializeEditor({nativeVersion:1,capabilityPolicy:{version:1,entries:Object.fromEntries(ids.map(id=>['action:'+id,{visible:true,enabled:false}]))},readResource:async()=>({name:'a.wpnative',bytes:createNative(32,24)}),save:async()=>{},export:async()=>{},confirm:async()=>0,dirty(){},error(){}});await api.open('binding','resource');off=installInputDispatch(window);ui.set({fg:{r:.2,g:.3,b:.4},bg:{r:.7,g:.8,b:.9}});ui.setBrush({size:20,hardness:.5});const before={fg:useApp.getState().fg,bg:useApp.getState().bg,brush:{...useApp.getState().brush}};
 for(const id of ids){expect(action(id)!.enabled!()).toBe(false);await run(id);}for(const [value,code]of [['x','KeyX'],['d','KeyD'],[']','BracketRight'],['[','BracketLeft']]){key(value,code);key(value,code,{shiftKey:true});}
 const {Toolbar}=await import('../../src/ui/Toolbar'),{createRoot}=await import('react-dom/client'),{createElement,act}=await import('react');const container=document.createElement('div');document.body.append(container);const root=createRoot(container);try{await act(async()=>root.render(createElement(Toolbar)));await act(async()=>{container.querySelector<HTMLButtonElement>('[title^="Swap colors"]')!.click();container.querySelector<HTMLButtonElement>('[title^="Default colors"]')!.click();});}finally{await act(async()=>root.unmount());container.remove();}
 expect(useApp.getState().fg).toEqual(before.fg);expect(useApp.getState().bg).toEqual(before.bg);expect(useApp.getState().brush).toEqual(before.brush);
});
