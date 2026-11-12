// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({kind:'electron',bridge:null,canWriteInPlace:true,setTitle(){},setEdited(){},chooseSavePath:vi.fn(),writePath:vi.fn(),confirm:vi.fn(),recovery:{remove:vi.fn()}}));
vi.mock('../../src/app/platform/platform',()=>({platform:()=>io}));
vi.mock('../../src/ui/Workspace',async()=>{const {CanvasView}=await import('../../src/ui/CanvasView');const {HistoryPanel,PathsPanel}=await import('../../src/ui/panels/DocPanels');const {LayersPanel}=await import('../../src/ui/panels/LayersPanel');return{Workspace:()=> <><CanvasView/><section data-history><HistoryPanel/></section><section data-paths><PathsPanel/></section><section data-layers><LayersPanel/></section></>};});
vi.mock('../../src/ui/panels/Thumb',()=>({RasterThumb:()=>null,LayerThumb:({kind,onClick}:any)=><button data-kind={kind} onClick={onClick}>Thumbnail</button>}));
vi.mock('../../src/ui/OptionsBar',()=>({OptionsBar:()=>null}));vi.mock('../../src/ui/Toolbar',()=>({Toolbar:()=>null}));
vi.mock('../../src/rendering/viewportRenderer',()=>({createViewportRendererAsync:async(canvas:HTMLCanvasElement)=>({canvas,renderer:{kind:'canvas2d',resize(){},dispose(){}}})}));
import {App} from '../../src/ui/App';
import {editor} from '../../src/app/editor';
import {ui} from '../../src/app/store';
import {registerTools} from '../../src/tools/registry';
import {PenTool} from '../../src/tools/penTools';
import {penSession,finishPen,interruptPen} from '../../src/tools/penSession';
import {livePath,getTarget} from '../../src/tools/pathEditing';
import {createPixelLayer,createShapeLayer,createMask} from '../../src/document/layerFactory';
import {newDoc,add} from '../helpers/build';
import {knot,clonePath,type VectorPath} from '../../src/vector/types';
import type {ToolHost,ToolPointer} from '../../src/tools/tool';
import {run,action} from '../../src/app/actions';
import {keymap} from '../../src/app/shortcuts';
import {prepareMoveOutput} from '../../src/app/fileOps';
import {key} from './fixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,container:HTMLDivElement;
beforeEach(()=>{
 io.chooseSavePath.mockReset().mockResolvedValue('qa-pen.psd');io.writePath.mockReset().mockResolvedValue(undefined);io.confirm.mockReset().mockResolvedValue(0);io.recovery.remove.mockReset().mockResolvedValue(undefined);
 vi.stubGlobal('__APP_VERSION__','test');vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
 HTMLElement.prototype.setPointerCapture=()=>{};HTMLElement.prototype.releasePointerCapture=()=>{};HTMLElement.prototype.hasPointerCapture=()=>false;
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(()=>new Proxy({measureText:()=>({width:10}),createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h})},{get:(o,k)=>Reflect.get(o,k)??(()=>{})}) as any);
 container=document.createElement('div');document.body.append(container);root=createRoot(container);registerTools();keymap.reset();ui.set({dialogs:[],tool:'pen'});ui.setToolOptions('pen',{mode:'path'});
});
afterEach(async()=>{await act(async()=>{for(const s of [...editor.sessions]){s.editProtected=false;finishPen(s,true);}root.unmount();for(const s of [...editor.sessions])editor.removeSession(s.id);});container.remove();editor.hostFactory=null;keymap.reset();vi.restoreAllMocks();vi.unstubAllGlobals();});
const empty=():VectorPath=>({subpaths:[],fillRule:'nonzero'});
export const pt=(x:number,y:number,extra:Partial<ToolPointer>={}):ToolPointer=>({x,y,sx:x,sy:y,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,shift:false,alt:false,mod:false,pointerType:'mouse',time:0,clickCount:1,...extra});
async function fixture(kind='work'){
 const doc=newDoc(96,96);const l=kind==='shape'?createShapeLayer('Source',empty(),null,8):createPixelLayer('Source',8);add(doc,l);const other=createPixelLayer('Other',8);other.mask=createMask(true);add(doc,other);
 if(kind==='mask')l.vectorMask={path:empty(),enabled:true,invert:false,linked:true,density:1,feather:0};
 if(kind==='saved'){doc.paths.push({id:'a',kind:'saved',name:'Path A',path:empty()},{id:'b',kind:'saved',name:'Path B',path:empty()});}
 const s=editor.addDocument(doc);s.setActive(l.id);if(kind==='saved')s.activePathId='a';
 const h:ToolHost={editor,session:s,redraw(){},setCursor(){},viewportSize:()=>({w:400,h:300})};editor.hostFactory=()=>h;const tool=editor.tool('pen') as PenTool;
 await act(async()=>root.render(<App/>));const path=()=>livePath(s,getTarget(s,false)!)!;
 const click=async(x:number,y:number)=>{await act(async()=>{tool.down(h,pt(x,y));tool.up();});};
 return {doc,s,l,other,h,tool,path,click};
}
it.each(['work','saved','shape','mask'])('P1 %s local history stays in one target and ends as one path command',async kind=>{
 const f=await fixture(kind),{s,tool,h,path,l}=f;
 await f.click(10,10);await f.click(40,10);await f.click(40,40);expect(s.history.index).toBe(0);expect(action('edit.undo')!.enabled!()).toBe(true);
 const id=s.activePathId;await act(async()=>{await run('edit.undo');await run('edit.undo');await run('edit.undo');await run('edit.undo');});expect(path().subpaths).toHaveLength(0);expect(s.activePathId).toBe(id);expect(penSession(s)).toBeTruthy();
 await act(async()=>{await run('edit.redo');await run('edit.stepForward');await run('edit.redo');});expect(path().subpaths[0].knots).toHaveLength(3);
 l.opacity=.42;await act(async()=>{tool.keyDown(h,new KeyboardEvent('keydown',{key:'Enter'}));tool.cancel();tool.deactivate();});expect(penSession(s)).toBeNull();expect(s.history.index).toBe(1);
 const result=clonePath(path());s.history.undo();expect(path().subpaths).toHaveLength(0);expect(l.opacity).toBe(.42);s.history.redo();expect(path()).toEqual(result);expect(s.doc.getLayer(l.id)?.opacity).toBe(.42);
});
it('P1 rebound Action undo during a drag cancels only that gesture; zero-point redo and branch truncation survive',async()=>{
 const f=await fixture(),{tool,h,path,s}=f;await f.click(10,10);await f.click(40,10);
 keymap.set('edit.undo',['F6']);await act(async()=>{tool.down(h,pt(50,50));tool.move(h,pt(60,60));key(container.querySelector('.viewport')!,'F6');});expect(path().subpaths[0].knots).toHaveLength(2);expect(tool.busy()).toBe(false);expect(s.history.index).toBe(0);
 await act(async()=>{tool.up();await run('edit.undo');});expect(path().subpaths[0].knots).toHaveLength(1);await f.click(20,40);await act(async()=>run('edit.redo'));expect(path().subpaths[0].knots.at(-1)?.x).toBe(20);
});
it('P1 mounted HistoryPanel blocks state/snapshot baseline mutations throughout a zero-point redo session',async()=>{
 const f=await fixture(),{s,path}=f;s.history.createSnapshot('Before Pen');await act(async()=>ui.bump('historyRev'));
 await f.click(10,10);await f.click(40,10);const state=clonePath(path()),entries=s.history.entries.length,snapshots=s.history.snapshots.length;
 for(const row of [...container.querySelectorAll<HTMLElement>('[data-history] .list-item')])await act(async()=>row.click());
 for(const button of [...container.querySelectorAll<HTMLButtonElement>('[data-history] button')]){expect(button.disabled).toBe(true);await act(async()=>button.click());}
 expect(path()).toEqual(state);expect(s.history.entries).toHaveLength(entries);expect(s.history.snapshots).toHaveLength(snapshots);
 await act(async()=>{await run('edit.undo');await run('edit.undo');});expect(penSession(s)).toBeTruthy();expect(container.querySelector('[data-history] [aria-disabled=true]')).toBeTruthy();
 await act(async()=>{await run('edit.redo');await run('edit.redo');finishPen(s);});expect(container.querySelector<HTMLButtonElement>('[data-history] button')!.disabled).toBe(false);
});
it('P1 actual PathsPanel target switch commits open A before B; return then document undo/redo preserves A',async()=>{
 const f=await fixture('saved'),{doc,s}=f;await f.click(10,10);await f.click(40,10);await f.click(40,40);
 const a=clonePath(doc.paths[0].path);const row=(name:string)=>[...container.querySelectorAll<HTMLElement>('[data-paths] .list-item')].find(el=>el.textContent===name)!;
 await act(async()=>row('Path A').click());expect(penSession(s)).toBeTruthy();
 s.editProtected=true;await act(async()=>row('Path B').click());expect(s.activePathId).toBe('a');expect(penSession(s)).toBeTruthy();s.editProtected=false;
 await act(async()=>row('Path B').click());expect(s.activePathId).toBe('b');expect(penSession(s)).toBeNull();expect(s.history.index).toBe(1);expect(doc.paths[1].path.subpaths).toHaveLength(0);
 await act(async()=>row('Path A').click());s.history.undo();expect(doc.paths[0].path.subpaths).toHaveLength(0);s.history.redo();expect(doc.paths[0].path).toEqual(a);expect(a.subpaths[0].closed).toBe(false);
});
it('P1 actual layer selection and document tabs finish before switching, preserving undoable source',async()=>{
 const f=await fixture(),{s,doc,other}=f;await f.click(10,10);await f.click(40,10);const original=clonePath(doc.paths[0].path);
 const row=[...container.querySelectorAll<HTMLElement>('[data-layers] .layer-row')].find(el=>el.textContent?.includes('Other'))!;
 await act(async()=>row.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));expect(s.activeLayerId).toBe(other.id);expect(s.history.index).toBe(1);s.history.undo();expect(doc.paths[0].path.subpaths).toHaveLength(0);s.history.redo();expect(doc.paths[0].path).toEqual(original);
 await f.click(50,50);await f.click(60,50);let next!:typeof s;await act(async()=>{finishPen(s);next=editor.addDocument(newDoc(20,20));editor.activate(s.id);});
 await f.click(30,30);await f.click(60,30);const index=s.history.index;await act(async()=>container.querySelectorAll('.doc-tab')[1].dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0})));expect(editor.active).toBe(next);expect(s.history.index).toBe(index+1);expect(penSession(s)).toBeNull();
});
it('P1 external replacement discards ownership; interruption preserves completed steps and output finishes once',async()=>{
 const f=await fixture('saved'),{doc,s,tool,h}=f;await f.click(10,10);await f.click(40,10);
 await act(async()=>{tool.down(h,pt(50,30));interruptPen(s);tool.up();});expect(doc.paths[0].path.subpaths[0].knots).toHaveLength(2);expect(penSession(s)).toBeTruthy();
 const external={subpaths:[{knots:[knot(7,7),knot(8,8)],closed:false,op:'combine' as const}],fillRule:'nonzero' as const};await act(async()=>{doc.paths[0].path=external;doc.emit({type:'paths'});tool.move(h,pt(60,60));tool.up();});expect(doc.paths[0].path).toBe(external);expect(s.history.index).toBe(0);expect(penSession(s)).toBeNull();
 await f.click(20,20);await f.click(40,20);expect(prepareMoveOutput(s)).toBe(true);expect(s.history.index).toBe(1);expect(prepareMoveOutput(s)).toBe(true);expect(s.history.index).toBe(1);
});

it('P1 failed finish retains draft/target, Shape creation remains one separate history step',async()=>{
 const f=await fixture(),{s,tool,h}=f;ui.setToolOptions('pen',{mode:'shape'});await f.click(10,10);await f.click(40,10);expect(s.activeLayer()?.kind).toBe('shape');const id=s.activeLayerId;
 expect(s.history.index).toBe(1);const push=vi.spyOn(s,'push').mockImplementation(()=>{throw Error('injected commit failure');});
 expect(finishPen(s)).toBe(false);expect(s.activeLayerId).toBe(id);expect(penSession(s)).toBeTruthy();push.mockRestore();expect(finishPen(s)).toBe(true);expect(s.history.index).toBe(2);
 tool.cancel();tool.deactivate();expect(s.history.index).toBe(2);s.history.undo();expect((s.activeLayer() as any).path.subpaths).toHaveLength(0);s.history.undo();expect(s.doc.getLayer(id)).toBeNull();
});

it('P2 continuous Pen Ctrl/Alt editing keeps the endpoint, frozen owner and one final document command',async()=>{
 const f=await fixture(),{tool,h,path,s}=f;const cursor=vi.spyOn(h,'setCursor');
 await act(async()=>{tool.down(h,pt(10,10));tool.move(h,pt(20,10));tool.up();});await f.click(50,10);await f.click(50,50);
 await act(async()=>{tool.down(h,pt(10,10,{mod:true}));tool.move(h,pt(15,15));tool.up();});
 let k=path().subpaths[0].knots[0];expect([k.x,k.y,k.inX,k.outX]).toEqual([15,15,5,25]);expect(path().subpaths[0].knots).toHaveLength(3);
 await act(async()=>{tool.down(h,pt(25,15,{mod:true}));tool.move(h,pt(30,25,{mod:true}));});
 const opposite=[k.inX,k.inY];await act(async()=>{tool.move(h,pt(35,35,{alt:true}));tool.move(h,pt(40,40));tool.up();});expect([k.inX,k.inY]).toEqual(opposite);expect(k.smooth).toBe(false);
 await act(async()=>{tool.down(h,pt(15,15,{alt:true}));tool.up();});expect([k.inX,k.inY,k.outX,k.outY,k.smooth]).toEqual([15,15,15,15,false]);
 await act(async()=>{tool.down(h,pt(15,15,{alt:true}));tool.move(h,pt(30,20));tool.up();});expect([k.inX,k.inY,k.outX,k.outY,k.smooth]).toEqual([0,10,30,20,true]);
 await act(async()=>{tool.down(h,pt(30,20,{alt:true}));tool.move(h,pt(35,25));tool.up();});expect([k.inX,k.inY,k.outX,k.outY,k.smooth]).toEqual([0,10,35,25,false]);
 await act(async()=>{tool.down(h,pt(50,50,{mod:true,alt:true}));tool.move(h,pt(55,55));tool.up();});expect(path().subpaths[0].knots.at(-1)?.x).toBe(55);
 await f.click(70,65);expect(path().subpaths[0].knots).toHaveLength(4);expect(path().subpaths[0].knots.at(-1)?.x).toBe(70);expect(s.history.index).toBe(0);
 await act(async()=>{tool.down(h,pt(15,15,{mod:true}));tool.move(h,pt(20,20));tool.up();tool.hover(h,pt(20,20));});expect(tool.cursor(h)).toContain('%3Ccircle');
 await act(async()=>{tool.down(h,pt(20,20));tool.up();});expect(path().subpaths[0].closed).toBe(true);expect(path().subpaths[0].knots).toHaveLength(4);expect(s.history.index).toBe(1);expect(penSession(s)).toBeNull();expect(tool.cursor(h)).toBe('crosshair');expect(cursor).toHaveBeenLastCalledWith('crosshair');
});
it.each([.25,1,2])('P2 close feedback and hit use the same 8 CSS px at zoom %s',async zoom=>{
 const f=await fixture(),{tool,h,path,s}=f;await f.click(10,10);await f.click(50,10);await f.click(50,50);s.view.zoom=zoom;
 const point=(offset:number,extra:Partial<ToolPointer>={})=>pt(10+offset/zoom,10,{sx:10*zoom+offset,sy:10*zoom,...extra});
 const curve=vi.fn(),arc=vi.fn(),g=new Proxy({bezierCurveTo:curve,arc},{get:(o,k)=>Reflect.get(o,k)??(()=>{})}) as any;
 tool.hover(h,point(7.9));expect(tool.cursor(h)).toContain('%3Ccircle');tool.drawOverlay(h,g);expect(curve.mock.calls.at(-1)?.slice(-2)).toEqual([10*zoom,10*zoom]);expect(arc).toHaveBeenCalled();
 tool.hover(h,point(8));expect(tool.cursor(h)).toBe('crosshair');
 tool.hover(h,point(0,{mod:true}));expect(tool.cursor(h)).toBe('move');tool.down(h,point(0,{mod:true}));tool.up();expect(path().subpaths[0].closed).toBe(false);
 tool.hover(h,point(7.9));tool.down(h,point(7.9));tool.up();expect(path().subpaths[0].closed).toBe(true);expect(path().subpaths[0].knots).toHaveLength(3);
});
it('P2 blank temporary edit, no-op corner/drag and returning a moved anchor do not add local history',async()=>{
 const f=await fixture(),{tool,h,path}=f;await f.click(10,10);await f.click(50,10);await f.click(50,50);
 const before=clonePath(path());await act(async()=>{
   for(const extra of [{mod:true},{alt:true},{mod:true,alt:true}]){tool.down(h,pt(80,80,extra));tool.move(h,pt(90,90));tool.up();}
   tool.down(h,pt(10,10,{alt:true}));tool.up();tool.down(h,pt(50,10,{mod:true}));tool.move(h,pt(60,20));tool.move(h,pt(50,10));tool.up();
 });expect(path()).toEqual(before);await act(async()=>run('edit.undo'));expect(path().subpaths[0].knots).toHaveLength(2);
});
it('P2 modifiers refresh cursor without pointer movement; text/IME and Modal/blur clear only unfinished gesture',async()=>{
 const f=await fixture(),{tool,h,path,s}=f;await f.click(10,10);await f.click(50,10);await f.click(50,50);
 const canvas=container.querySelector<HTMLElement>('.viewport')!;tool.hover(h,pt(10,10));
 await act(async()=>key(canvas,'Control',{ctrlKey:true}));expect(canvas.style.cursor).toBe('move');
 await act(async()=>canvas.dispatchEvent(new KeyboardEvent('keyup',{key:'Control',bubbles:true})));expect(canvas.style.cursor).toContain('%3Ccircle');
 const input=document.createElement('input');container.append(input);await act(async()=>{input.focus();key(input,'Control',{ctrlKey:true});input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));key(input,'Escape');});expect(penSession(s)).toBeTruthy();expect(path().subpaths[0].knots).toHaveLength(3);
 await act(async()=>{input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));input.blur();tool.down(h,pt(10,10,{mod:true}));tool.move(h,pt(20,20));window.dispatchEvent(new Event('blur'));tool.move(h,pt(60,60));tool.up();});expect(path().subpaths[0].knots[0].x).toBe(10);expect(penSession(s)).toBeTruthy();
 await act(async()=>{tool.down(h,pt(10,10,{alt:true}));tool.move(h,pt(20,10));ui.openDialog('about');tool.move(h,pt(60,60));tool.up();});expect(path().subpaths[0].knots[0].outX).toBe(10);expect(s.history.index).toBe(0);expect(penSession(s)).toBeTruthy();input.remove();
});
it.each(['pointercancel','lostpointercapture'])('P2 actual Canvas %s cancels Pen gesture exactly once, including late tails',async event=>{
 const f=await fixture(),{path,s}=f;await f.click(10,10);await f.click(50,10);await f.click(50,50);const canvas=container.querySelector<HTMLElement>('.viewport')!;
 vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:400,height:300,right:400,bottom:300,x:0,y:0,toJSON(){}});
 const pointer=(type:string,x:number,y:number,ctrl=false)=>{const ev=new MouseEvent(type,{clientX:x,clientY:y,bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,ctrlKey:ctrl});Object.defineProperty(ev,'pointerId',{value:11});canvas.dispatchEvent(ev);};
 await act(async()=>{pointer('pointerdown',10,10,true);pointer('pointermove',20,20);pointer(event,20,20);pointer('pointerup',20,20);pointer('pointermove',70,70);});expect(path().subpaths[0].knots[0].x).toBe(10);expect(path().subpaths[0].knots).toHaveLength(3);expect(s.history.index).toBe(0);
 await act(async()=>run('edit.undo'));expect(path().subpaths[0].knots).toHaveLength(2);
});
it.each(['work','saved','shape','mask'])('P2 %s target edit never writes a different finished path; external replacement keeps new state',async kind=>{
 const f=await fixture(kind),{tool,h,path,doc,s,l}=f;await f.click(10,10);await f.click(50,10);const current=path();doc.paths.push({id:'other-finished',name:'Other finished',kind:'saved',path:{subpaths:[{knots:[knot(80,80),knot(90,90)],closed:false,op:'combine'}],fillRule:'nonzero'}});
 await act(async()=>{tool.down(h,pt(80,80,{mod:true}));tool.move(h,pt(85,85));tool.up();});expect(doc.paths.at(-1)!.path.subpaths[0].knots[0].x).toBe(80);expect(current.subpaths[0].knots[0].x).toBe(10);
 const replacement={subpaths:[],fillRule:'evenodd' as const};await act(async()=>{tool.down(h,pt(10,10,{mod:true}));tool.move(h,pt(20,20));if(kind==='shape'&&l.kind==='shape')l.path=replacement;else if(kind==='mask')l.vectorMask={...l.vectorMask!,path:replacement};else doc.paths.find(p=>p.path===current)!.path=replacement;doc.emit({type:'paths'});tool.move(h,pt(70,70));tool.up();tool.cancelPointer();});expect(penSession(s)).toBeNull();expect(s.history.index).toBe(0);expect(path()).toBe(replacement);
});

it('P2 smooth handle return is exactly a no-op and independent tools retain their own history',async()=>{
 const f=await fixture(),{tool,h,path,s}=f;
 await act(async()=>{tool.down(h,pt(10,10));tool.move(h,pt(20,10));tool.up();});await f.click(50,10);await f.click(50,50);
 const before=clonePath(path());await act(async()=>{tool.down(h,pt(20,10,{mod:true}));tool.move(h,pt(30,35));tool.move(h,pt(20,10));tool.up();});expect(path()).toEqual(before);
 await act(async()=>run('edit.undo'));expect(path().subpaths[0].knots).toHaveLength(2);await act(async()=>{run('edit.redo');finishPen(s);});
 const {PathSelectTool,AnchorTool}=await import('../../src/tools/penTools'),direct=new PathSelectTool('directSelect'),anchor=new AnchorTool('convertPoint');
 const index=s.history.index;direct.down(h,pt(10,10));direct.move(h,pt(15,15));direct.up();expect(s.history.index).toBe(index+1);expect(path().subpaths[0].knots[0].x).toBe(15);
 anchor.down(h,pt(15,15));anchor.up();expect(s.history.index).toBe(index+2);expect(path().subpaths[0].knots[0].smooth).toBe(false);
});
it('P2 initial locked Shape and denied Pen access cannot start or fall through to adding',async()=>{
 const f=await fixture('shape'),{l,tool,h,path,s}=f;l.locks.all=true;tool.down(h,pt(10,10));tool.up();expect(penSession(s)).toBeNull();expect(path().subpaths).toHaveLength(0);l.locks.all=false;
 const {installAccessPolicy}=await import('../../src/app/access');const dispose=installAccessPolicy(()=>({enabled:false,visible:true}));
 try{tool.down(h,pt(10,10));tool.up();expect(path().subpaths).toHaveLength(0);expect(penSession(s)).toBeNull();}finally{dispose();}
});

it('P2 active layer replacement/deletion commands finish the original path before changing its baseline',async()=>{
 const f=await fixture('shape'),{s,doc,l}=f;await f.click(10,10);await f.click(40,10);const {deleteLayers,newLayer}=await import('../../src/app/ops/layerOps');
 await act(async()=>deleteLayers());expect(doc.getLayer(l.id)).toBeNull();expect(s.history.entries.map(e=>e.label)).toEqual(['Open','Pen','Delete Layer']);
 s.history.undo();expect((doc.getLayer(l.id) as any).path.subpaths[0].knots).toHaveLength(2);s.history.undo();expect((doc.getLayer(l.id) as any).path.subpaths).toHaveLength(0);s.history.redo();
 await act(async()=>{s.setActive(l.id);});await f.click(50,30);await f.click(60,30);const index=s.history.index;
 await act(async()=>newLayer());expect(s.history.entries.slice(index+1).map(e=>e.label)).toEqual(['Pen','New Layer']);expect(penSession(s)).toBeNull();
});

it('P3 actual mask selection and document switch protection preserve old draft until a successful finish',async()=>{
 const f=await fixture(),{s,other,doc}=f;await f.click(10,10);await f.click(50,10);const a=clonePath(doc.paths[0].path);const maskButton=container.querySelector<HTMLButtonElement>('[data-layers] [data-kind=mask]')!;
 s.editProtected=true;await act(async()=>maskButton.click());expect(s.activeLayerId).not.toBe(other.id);expect(s.editMask).toBe(false);expect(penSession(s)).toBeTruthy();s.editProtected=false;
 await act(async()=>maskButton.click());expect(s.activeLayerId).toBe(other.id);expect(s.editMask).toBe(true);expect(s.history.index).toBe(1);s.history.undo();expect(doc.paths[0].path.subpaths).toHaveLength(0);s.history.redo();expect(doc.paths[0].path).toEqual(a);
});
it('P3 normal native save/close checkpoint includes completed paths; open gesture is cancelled once',async()=>{
 const f=await fixture('saved'),{s,tool,h,doc}=f;await f.click(10,10);await f.click(50,10);await act(async()=>{tool.down(h,pt(60,50));tool.move(h,pt(70,50));});
 const {encodeNative,decodeNative}=await import('../../src/document/native');expect(prepareMoveOutput(s)).toBe(true);const reopened=decodeNative(encodeNative(doc)).doc;expect(reopened.paths[0].path.subpaths[0].knots).toHaveLength(2);expect(s.history.index).toBe(1);expect(penSession(s)).toBeNull();
 const {closeSession}=await import('../../src/app/fileOps');await f.click(30,50);await f.click(60,50);await act(async()=>{expect(await closeSession(s,true)).toBe(true);});expect(editor.session(s.id)).toBeUndefined();expect(doc.paths[0].path.subpaths).toHaveLength(2);
});
it('P3 actual Canvas switching documents drops old tails and external deletion never resurrects a path',async()=>{
 const f=await fixture('saved'),{s,doc}=f;await f.click(10,10);await f.click(50,10);let second!:typeof s;await act(async()=>{finishPen(s);second=editor.addDocument(newDoc(96,96));editor.activate(s.id);});await f.click(20,40);await f.click(60,40);
 const canvas=container.querySelector<HTMLElement>('.viewport')!;vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:400,height:300,right:400,bottom:300,x:0,y:0,toJSON(){}});
 const event=(type:string,x:number,y:number)=>{const ev=new MouseEvent(type,{clientX:x,clientY:y,ctrlKey:true,button:0,buttons:1,bubbles:true,cancelable:true});Object.defineProperty(ev,'pointerId',{value:14});canvas.dispatchEvent(ev);};
 await act(async()=>{event('pointerdown',10,10);event('pointermove',20,20);container.querySelectorAll('.doc-tab')[1].dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));event('pointermove',60,60);event('pointerup',60,60);});expect(editor.active).toBe(second);expect(doc.paths[0].path.subpaths[0].knots[0].x).toBe(10);expect(second.doc.paths).toHaveLength(0);
 await act(async()=>editor.activate(s.id));await f.click(30,60);await f.click(60,60);const id=s.history.current.id;await act(async()=>{doc.paths=doc.paths.filter(p=>p.id!=='a');doc.emit({type:'paths'});event('pointerup',70,70);});expect(doc.paths.find(p=>p.id==='a')).toBeUndefined();expect(s.history.current.id).toBe(id);expect(penSession(s)).toBeNull();
});

it('P3 actual saveAs and normal Save-on-close write the visible path, which PSD import reopens',async()=>{
 const f=await fixture('saved'),{s,tool,h}=f;await f.click(10,10);await f.click(50,10);
 const {saveAs,closeSession}=await import('../../src/app/fileOps'),{importPsd}=await import('../../src/psd/import');
 await act(async()=>{expect(await saveAs(s)).toBe(true);});expect(s.history.index).toBe(1);expect(penSession(s)).toBeNull();
 let bytes=io.writePath.mock.calls.at(-1)![1];let reopened=importPsd(bytes,'qa-pen.psd').doc;expect(reopened.paths.find(p=>p.name==='Path A')?.path.subpaths[0].knots).toHaveLength(2);
 await f.click(20,40);await f.click(60,40);await act(async()=>{tool.down(h,pt(80,80));tool.move(h,pt(90,90));expect(await closeSession(s)).toBe(true);});
 expect(editor.session(s.id)).toBeUndefined();expect(io.confirm).toHaveBeenCalled();bytes=io.writePath.mock.calls.at(-1)![1];reopened=importPsd(bytes,'qa-pen.psd').doc;
 expect(reopened.paths.find(p=>p.name==='Path A')?.path.subpaths.map(sp=>sp.knots.length)).toEqual([2,2]);expect(s.history.index).toBe(2);
});

it('P3 external Shape origin takeover is preserved even if the draft returned to its baseline',async()=>{
 const f=await fixture('shape'),{l,s,tool,h}=f;await f.click(10,10);await f.click(50,10);await act(async()=>{await run('edit.undo');await run('edit.undo');});
 const origin={kind:'custom' as const,x:7,y:8,w:20,h:30};if(l.kind!=='shape')throw Error('fixture');
 await act(async()=>{l.origin=origin;s.doc.emit({type:'layer',layerId:l.id});tool.cancel();tool.up();});expect(l.origin).toBe(origin);expect(s.history.index).toBe(0);expect(penSession(s)).toBeNull();
});

it('P3 full-layer UI appearance command cannot snapshot a live Shape path into overlapping history',async()=>{
 const f=await fixture('shape'),{s,l,doc}=f;await f.click(10,10);await f.click(50,10);const {commitAppearance}=await import('../../src/app/ops/layerOps');
 await act(async()=>commitAppearance(s,l.id,'Appearance fixture',layer=>{layer.opacity=.35;}));expect(penSession(s)).toBeNull();expect(s.history.entries.map(e=>e.label)).toEqual(['Open','Pen','Appearance fixture']);
 s.history.undo();expect((doc.getLayer(l.id) as any).path.subpaths[0].knots).toHaveLength(2);s.history.undo();expect((doc.getLayer(l.id) as any).path.subpaths).toHaveLength(0);s.history.redo();expect((doc.getLayer(l.id) as any).path.subpaths[0].knots).toHaveLength(2);
});

it('P3 existing Saved Path A edits its original points before an actual B switch; undo restores the original baseline',async()=>{
 const f=await fixture('saved'),{doc,s,tool,h}=f;doc.paths[0].path.subpaths.push({knots:[knot(10,70),knot(40,70)],closed:false,op:'combine'});const baseline=clonePath(doc.paths[0].path);
 await f.click(10,10);await f.click(50,10);await act(async()=>{tool.down(h,pt(10,70,{mod:true}));tool.move(h,pt(15,75));tool.up();});
 const edited=clonePath(doc.paths[0].path);expect(edited.subpaths[0].knots[0].x).toBe(15);expect(edited.subpaths[1].knots.at(-1)?.x).toBe(50);
 const row=(text:string)=>[...container.querySelectorAll<HTMLElement>('[data-paths] .list-item')].find(x=>x.textContent===text)!;
 await act(async()=>row('Path B').click());expect(s.activePathId).toBe('b');expect(s.history.index).toBe(1);expect(doc.paths[1].path.subpaths).toHaveLength(0);
 await act(async()=>{row('Path A').click();await run('edit.undo');});expect(doc.paths[0].path).toEqual(baseline);
 await act(async()=>run('edit.redo'));expect(doc.paths[0].path).toEqual(edited);expect(penSession(s)).toBeNull();
});
it('P3 actual PathsPanel delete finishes A before removing it and preserves both undo steps',async()=>{
 const f=await fixture('saved'),{doc,s}=f;await f.click(10,10);await f.click(50,10);const final=clonePath(doc.paths[0].path);
 await act(async()=>container.querySelector<HTMLButtonElement>('[data-paths] [title="Delete path"]')!.click());expect(doc.paths.find(x=>x.id==='a')).toBeUndefined();expect(s.history.entries.map(x=>x.label)).toEqual(['Open','Pen','Delete Path']);
 s.history.undo();expect(doc.paths.find(x=>x.id==='a')!.path).toEqual(final);s.history.undo();expect(doc.paths.find(x=>x.id==='a')!.path.subpaths).toHaveLength(0);
});
it.each([.25,1,2])('P3 ordinary click outside the 8 CSS px close boundary adds a point without closing at zoom %s',async zoom=>{
 const f=await fixture(),{tool,h,path,s}=f;await f.click(10,10);await f.click(50,10);await f.click(50,50);s.view.zoom=zoom;
 const point=pt(10+8/zoom,10,{sx:10*zoom+8,sy:10*zoom});await act(async()=>{tool.hover(h,point);tool.down(h,point);tool.up();});expect(path().subpaths[0].closed).toBe(false);expect(path().subpaths[0].knots).toHaveLength(4);expect(s.history.index).toBe(0);
});

it('P3 a bypassed external history-baseline replacement invalidates the old draft without restoring its snapshots',async()=>{
 const f=await fixture('saved'),{s,doc,tool,h}=f;await f.click(10,10);await f.click(50,10);const visible=clonePath(doc.paths[0].path);
 await act(async()=>{s.history.clear('External baseline');tool.move(h,pt(70,70));tool.up();tool.cancelPointer();});expect(doc.paths[0].path).toEqual(visible);expect(s.history.entries).toHaveLength(1);expect(s.history.current.label).toBe('External baseline');expect(penSession(s)).toBeNull();
});

it('P3 Alt conversion dragged back to a corner is a no-op, not a zero-length smooth point',async()=>{
 const f=await fixture(),{tool,h,path}=f;await f.click(10,10);await f.click(50,10);await f.click(50,50);const before=clonePath(path());
 await act(async()=>{tool.down(h,pt(10,10,{alt:true}));tool.move(h,pt(20,20));tool.move(h,pt(10,10));tool.up();});expect(path()).toEqual(before);
 await act(async()=>run('edit.undo'));expect(path().subpaths[0].knots).toHaveLength(2);
});
it('P3 pressing Alt during an already moved handle unlinks it even if the pointer then stays still',async()=>{
 const f=await fixture(),{tool,h,path}=f;await act(async()=>{tool.down(h,pt(10,10));tool.move(h,pt(20,10));tool.up();});await f.click(50,10);
 await act(async()=>{tool.down(h,pt(20,10,{mod:true}));tool.move(h,pt(25,15,{mod:true}));tool.keyDown(h,new KeyboardEvent('keydown',{key:'Alt',altKey:true,ctrlKey:true}));tool.keyUp(h,new KeyboardEvent('keyup',{key:'Alt',ctrlKey:true}));tool.up();});expect(path().subpaths[0].knots[0].smooth).toBe(false);const final=clonePath(path());
 await act(async()=>run('edit.undo'));expect(path().subpaths[0].knots[0].smooth).toBe(true);await act(async()=>run('edit.redo'));expect(path()).toEqual(final);
});
