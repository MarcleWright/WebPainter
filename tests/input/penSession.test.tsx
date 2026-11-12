// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('../../src/app/platform/platform',()=>({platform:()=>({kind:'electron',bridge:null,setTitle(){},setEdited(){}})}));
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
