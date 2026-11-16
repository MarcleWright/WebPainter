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
import {TypeTool,cancelTextEdit} from '../../src/tools/typeTool';
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
import {makePathSelection,canPathSelection} from '../../src/app/ops/pathSelectionOps';
import {readPenSession,registerPen} from '../../src/tools/penSession';
import * as raster from '../../src/vector/rasterize';

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
 await act(async()=>root.render(<App/>));const path=()=>kind==='shape'?(l as ReturnType<typeof createShapeLayer>).path:kind==='mask'?l.vectorMask!.path:doc.paths.find(p=>kind==='saved'?p.id==='a':p.kind==='work')!.path;
 const click=async(x:number,y:number)=>{await act(async()=>{tool.down(h,pt(x,y));tool.up();});};
 return {doc,s,l,other,h,tool,path,click};
}
const triangle=(x=10,y=10):VectorPath=>({fillRule:'nonzero',subpaths:[{closed:false,op:'combine',knots:[knot(x,y),knot(x+30,y),knot(x+30,y+30)]}]});
const sample=(f:Awaited<ReturnType<typeof fixture>>,x=30,y=15)=>f.doc.selection.coverageAt(x,y);
async function convert(op:'replace'|'add'|'subtract'='replace',args?:unknown){let result!:ReturnType<typeof makePathSelection>;await act(async()=>{result=makePathSelection(op,args);});return result;}
it.each(['work','saved','shape','mask'])('P1 %s live Pen finishes once, preserves open geometry and two history steps',async kind=>{
 const f=await fixture(kind);await f.click(10,10);await f.click(40,10);await f.click(40,40);const before=clonePath(f.path()),base=f.s.history.index;
 expect(await convert()).toBe('changed');expect(readPenSession(f.s)).toBeNull();expect(f.path()).toEqual(before);expect(sample(f)).toBe(1);expect(sample(f,15,35)).toBe(0);expect(f.s.history.index).toBe(base+2);
 await act(async()=>{await run('edit.undo');});expect(sample(f)).toBe(0);expect(f.path()).toEqual(before);
 await act(async()=>run('edit.undo'));expect(f.path().subpaths).toHaveLength(0);
 await act(async()=>{await run('edit.redo');await run('edit.redo');});expect(f.path()).toEqual(before);expect(sample(f)).toBe(1);
});
it.each([undefined,1,-1,NaN,Infinity,'0',null])('P1 explicit invalid feather %s preserves draft/local/document history and selection',async feather=>{
 const f=await fixture();await f.click(10,10);await f.click(40,10);await f.click(40,40);const owner=readPenSession(f.s),path=clonePath(f.path());
 expect(await convert('replace',{feather})).toBe('rejected');expect(readPenSession(f.s)).toBe(owner);expect(f.path()).toEqual(path);expect(f.s.history.index).toBe(0);expect(sample(f)).toBe(0);
 await act(async()=>run('edit.undo'));expect(f.path().subpaths[0].knots).toHaveLength(2);
});
it('P1 omitted and numeric zero feather agree; unchanged selection creates no history',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle();expect(await convert()).toBe('changed');const pixels=f.doc.selection.read(f.doc.bounds),index=f.s.history.index;
 expect(await convert('replace',{feather:0,target:{kind:'path',pathId:'a'}})).toBe('unchanged');expect(f.doc.selection.read(f.doc.bounds)).toEqual(pixels);expect(f.s.history.index).toBe(index);
});
it('P1 explicit B finishes A once and wins over active Shape; missing/invalid target never falls back',async()=>{
 const f=await fixture('saved');f.doc.paths[1].path=triangle(50,50);await f.click(10,10);await f.click(40,10);await f.click(40,40);const owner=readPenSession(f.s)!;const finish=vi.spyOn(owner,'finish');
 expect(await convert('replace',{target:{kind:'path',pathId:'gone'}})).toBe('rejected');expect(finish).not.toHaveBeenCalled();
 expect(await convert('replace',{target:{kind:'path',pathId:'b'}})).toBe('changed');expect(finish).toHaveBeenCalledTimes(1);expect(f.s.activePathId).toBeNull();expect(sample(f)).toBe(0);expect(sample(f,70,55)).toBe(1);
});
it('P1 singleton draft and pointer drag reject without ending or loading a saved fallback',async()=>{
 const f=await fixture('saved');f.doc.paths[1].path=triangle(50,50);await f.click(10,10);const owner=readPenSession(f.s);
 expect(await convert('replace',{target:{kind:'path',pathId:'b'}})).toBe('rejected');expect(readPenSession(f.s)).toBe(owner);
 await f.click(40,10);await act(async()=>f.tool.down(f.h,pt(40,40)));expect(await convert()).toBe('rejected');expect(f.tool.busy()).toBe(true);await act(async()=>f.tool.up());expect(await convert()).toBe('changed');
});
it.each(['replace','add','subtract'] as const)('P1 valid off-canvas %s honors zero coverage and no-op history',async op=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle(200,200);f.doc.selection.selectAll();expect(await convert(op)).toBe(op==='replace'?'changed':'unchanged');expect(sample(f)).toBe(op==='replace'?0:1);expect(f.s.history.index).toBe(op==='replace'?1:0);
});
it('P1 empty subtract stays empty; add, anti-aliasing, open curve and evenodd hole preserve coverage',async()=>{
 const f=await fixture('saved');const p=triangle(10.3,10.3);p.subpaths[0].knots[0].outY=0;f.doc.paths[0].path=p;
 expect(await convert('subtract')).toBe('unchanged');expect(f.s.history.index).toBe(0);expect(await convert('add',{target:{kind:'path',pathId:'a'}})).toBe('changed');const values=f.doc.selection.read(f.doc.bounds);expect([...values].some(v=>v>0&&v<1)).toBe(true);expect(p.subpaths[0].closed).toBe(false);
 const square=(a:number,b:number)=>({closed:true,op:'combine' as const,knots:[knot(a,a),knot(b,a),knot(b,b),knot(a,b)]});f.doc.paths[0].path={fillRule:'evenodd',subpaths:[square(10,80),square(30,60)]};f.s.activePathId='a';
 expect(await convert()).toBe('changed');expect(sample(f,20,20)).toBe(1);expect(sample(f,40,40)).toBe(0);expect(sample(f,90,90)).toBe(0);
});
it('P1 finish failure leaves draft, raster failure preserves finished Pen and retry creates only selection',async()=>{
 const f=await fixture();await f.click(10,10);await f.click(40,10);await f.click(40,40);const owner=readPenSession(f.s)!;const finish=vi.spyOn(owner,'finish').mockReturnValue(false);
 expect(await convert()).toBe('rejected');expect(f.s.history.index).toBe(0);expect(readPenSession(f.s)).toBe(owner);finish.mockRestore();
 const rasterize=vi.spyOn(raster,'rasterizePath').mockImplementation(()=>{throw Error('injected raster failure');});expect(await convert()).toBe('failed');expect(f.s.history.index).toBe(1);expect(readPenSession(f.s)).toBeNull();expect(sample(f)).toBe(0);rasterize.mockRestore();
 expect(await convert()).toBe('changed');expect(f.s.history.index).toBe(2);
});
it.each(['replaceObject','mutatePath','switchDoc','replaceOwner'])('P1 finish reentry %s cannot retarget or write a selection',async mutation=>{
 const f=await fixture();await f.click(10,10);await f.click(40,10);await f.click(40,40);const owner=readPenSession(f.s)!;let detach:()=>void=()=>{};
 const off=f.s.history.on(()=>{off();if(mutation==='replaceObject')f.doc.paths[0]={...f.doc.paths[0]};else if(mutation==='mutatePath')f.doc.paths[0].path.subpaths[0].knots[0].x=11;else if(mutation==='switchDoc')editor.activeId=editor.addDocument(newDoc(10,10)).id;else detach=registerPen({...owner});});
 expect(await convert()).toBe('rejected');expect(sample(f)).toBe(0);expect(f.s.history.index).toBe(1);detach();
});
it('P1 finish identity check rejects captured owner replacement; pure admission leaves invalid owner intact',async()=>{
 const f=await fixture();await f.click(10,10);await f.click(40,10);const owner=readPenSession(f.s)!;const detach=registerPen({...owner});expect(finishPen(f.s,false,owner)).toBe(false);detach();registerPen(owner);
});
it('P1 selection history failure restores original selection and keeps finished path',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle();f.doc.selection.selectAll();const push=vi.spyOn(f.s,'push').mockImplementation(()=>{throw Error('injected selection commit failure');});expect(await convert()).toBe('failed');expect(sample(f,90,90)).toBe(1);expect(f.s.history.index).toBe(0);push.mockRestore();expect(await convert()).toBe('changed');
});
it('P1 default priority uses explicit Saved/Clipping then Work before Shape or Vector Mask',async()=>{
 const f=await fixture('shape');const shape=f.l as ReturnType<typeof createShapeLayer>;shape.path=triangle(50,50);f.doc.paths.push({id:'work',kind:'work',name:'Work',path:triangle()},{id:'saved',kind:'clipping',name:'Saved',path:triangle(50,50)});
 f.s.activePathId='saved';expect(await convert()).toBe('changed');expect(sample(f,70,55)).toBe(1);expect(sample(f)).toBe(0);
 f.s.activePathId='work';f.s.activePathId=null;expect(await convert()).toBe('changed');expect(sample(f)).toBe(1);expect(sample(f,70,55)).toBe(0);
 f.doc.paths=[];expect(await convert()).toBe('changed');expect(sample(f,70,55)).toBe(1);
});
it('P1 action access, mask access, save/close/mode protection preserve the live draft',async()=>{
 const f=await fixture('mask');await f.click(10,10);await f.click(40,10);await f.click(40,40);const owner=readPenSession(f.s);
 for(const field of ['editProtected','outputPending','closePending'] as const){field==='editProtected'?f.s.editProtected=true:f.s[field]=Promise.resolve(true);expect(await convert()).toBe('rejected');field==='editProtected'?f.s.editProtected=false:f.s[field]=null;expect(readPenSession(f.s)).toBe(owner);}
 const {installAccessPolicy}=await import('../../src/app/access');for(const denied of ['action:path.toSelection','feature:masks','tool:pen']){const restore=installAccessPolicy(e=>({visible:true,enabled:e!==denied}));expect(await convert()).toBe('rejected');restore();expect(readPenSession(f.s)).toBe(owner);}
 expect(f.s.history.index).toBe(0);expect(sample(f)).toBe(0);
});
it.each([
 ['path.toSelection',{},0],['path.addToSelection',{shiftKey:true},1],['path.subtractFromSelection',{altKey:true},1],
] as const)('P2 actual App/Canvas default %s uses fixed op, repeat suppression and document Undo',async(id,modifiers,outside)=>{
 const f=await fixture();await f.click(10,10);await f.click(40,10);await f.click(40,40);f.doc.selection.selectAll();const viewport=container.querySelector('.viewport')!;
 await act(async()=>{key(viewport,'Enter',{ctrlKey:true,...modifiers});key(viewport,'Enter',{ctrlKey:true,...modifiers,repeat:true});});
 expect(readPenSession(f.s)).toBeNull();expect(sample(f,90,90)).toBe(outside);expect(sample(f)).toBe(id==='path.subtractFromSelection'?0:1);expect(f.s.history.index).toBe(id==='path.addToSelection'?1:2);
 await act(async()=>key(viewport,'z',{ctrlKey:true}));expect(readPenSession(f.s)).toBeNull();expect(f.s.history.index).toBe(id==='path.addToSelection'?0:1);
});
it('P2 public Actions ignore op override, accept zero only and preserve user removal/rebinding',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle();const viewport=container.querySelector('.viewport')!;
 keymap.set('path.toSelection',['F7']);await act(async()=>key(viewport,'Enter',{ctrlKey:true}));expect(f.s.history.index).toBe(0);
 await act(async()=>key(viewport,'F7'));expect(sample(f)).toBe(1);expect(f.s.history.index).toBe(1);
 await act(async()=>{await run('path.subtractFromSelection',{op:'add',feather:0,target:{kind:'path',pathId:'a'}});});expect(sample(f)).toBe(0);
 keymap.set('path.toSelection',[]);await act(async()=>{key(viewport,'F7');key(viewport,'Enter',{ctrlKey:true});});expect(sample(f)).toBe(0);expect(f.s.history.index).toBe(2);
 for(const id of ['path.toSelection','path.addToSelection','path.subtractFromSelection']){await act(async()=>run(id,{feather:1}));expect(f.s.history.index).toBe(2);}
});
const loadButton=()=>container.querySelector<HTMLButtonElement>('[title="Load path as a selection"]')!;
async function contextRow(name:string){const row=[...container.querySelectorAll<HTMLElement>('[data-paths] .list-item')].find(el=>el.textContent===name)!;await act(async()=>row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})));return [...document.querySelectorAll<HTMLElement>('[role=menuitem]')].find(el=>el.textContent?.includes('Make Selection'))!;}
it('P2 mounted PathsPanel context B goes through public Action even when default A empty',async()=>{
 const f=await fixture('saved');f.doc.paths[1].path=triangle(50,50);await act(async()=>ui.bump('docRev'));expect(loadButton().disabled).toBe(true);expect(action('path.toSelection')!.enabled!()).toBe(true);
 const item=await contextRow('Path B');expect(item.getAttribute('aria-disabled')).toBe('false');await act(async()=>item.click());expect(sample(f,70,55)).toBe(1);expect(sample(f)).toBe(0);expect(f.s.activePathId).toBeNull();
 await act(async()=>run('path.toSelection',{target:{kind:'path',pathId:'a'}}));expect(sample(f,70,55)).toBe(1);expect(f.s.history.index).toBe(1);
});
it('P2 mounted load button finishes A and actual nonactive B row never switches the target',async()=>{
 const f=await fixture('saved');f.doc.paths[1].path=triangle(50,50);await f.click(10,10);await f.click(40,10);await f.click(40,40);expect(loadButton().disabled).toBe(false);
 await act(async()=>loadButton().click());expect(sample(f)).toBe(1);expect(f.s.history.index).toBe(2);expect(readPenSession(f.s)).toBeNull();
 const item=await contextRow('Path B');await act(async()=>item.click());expect(sample(f,70,55)).toBe(1);expect(f.s.activePathId).toBeNull();expect(f.s.history.index).toBe(3);
});
it('P2 actual B context finishes draft A once and access blocks button/context/handler consistently',async()=>{
 const f=await fixture('saved');f.doc.paths[1].path=triangle(50,50);await f.click(10,10);await f.click(40,10);await f.click(40,40);const owner=readPenSession(f.s)!,finish=vi.spyOn(owner,'finish');
 const {installAccessPolicy}=await import('../../src/app/access');const restore=installAccessPolicy(e=>({visible:true,enabled:e!=='action:path.toSelection'}));await act(async()=>ui.bump('docRev'));expect(loadButton().disabled).toBe(true);const disabled=await contextRow('Path B');expect(disabled.getAttribute('aria-disabled')).toBe('true');await act(async()=>{disabled.click();await run('path.toSelection',{target:{kind:'path',pathId:'b'}});});expect(finish).not.toHaveBeenCalled();restore();
 await act(async()=>document.querySelector<HTMLElement>('[role=menu]')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));const item=await contextRow('Path B');await act(async()=>item.click());expect(finish).toHaveBeenCalledTimes(1);expect(sample(f,70,55)).toBe(1);expect(f.s.activePathId).toBeNull();
});
it('P2 stale explicit B after context opening cannot fall back to valid A',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle();f.doc.paths[1].path=triangle(50,50);await act(async()=>ui.bump('docRev'));const item=await contextRow('Path B');f.doc.paths.pop();await act(async()=>item.click());expect(f.doc.selection.isEmpty()).toBe(true);expect(f.s.history.index).toBe(0);
});
it('P2 actual text/contenteditable/IME/Modal owners keep Ctrl+Enter; drag keeps pointer owner and late up stays inert',async()=>{
 const f=await fixture();await f.click(10,10);await f.click(40,10);await f.click(40,40);const owner=readPenSession(f.s),viewport=container.querySelector('.viewport')!;
 for(const tag of ['input','textarea','div']){const el=document.createElement(tag);if(tag==='div')el.setAttribute('contenteditable','true');container.append(el);await act(async()=>key(el,'Enter',{ctrlKey:true}));expect(readPenSession(f.s)).toBe(owner);el.remove();}
 await act(async()=>key(viewport,'Enter',{ctrlKey:true,isComposing:true}));expect(readPenSession(f.s)).toBe(owner);
 await act(async()=>ui.openDialog('newDocument'));await act(async()=>key(viewport,'Enter',{ctrlKey:true}));expect(readPenSession(f.s)).toBe(owner);await act(async()=>ui.set({dialogs:[]}));
 await act(async()=>{f.tool.down(f.h,pt(40,40,{mod:true}));f.tool.move(f.h,pt(45,45,{mod:true}));key(viewport,'Enter',{ctrlKey:true});});expect(f.tool.busy()).toBe(true);expect(readPenSession(f.s)).toBe(owner);
 await act(async()=>{f.tool.up();key(viewport,'Enter',{ctrlKey:true});});expect(readPenSession(f.s)).toBeNull();const after=clonePath(f.path()),index=f.s.history.index;await act(async()=>{f.tool.up();key(viewport,'Control');viewport.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true,ctrlKey:true}));});expect(f.path()).toEqual(after);expect(f.s.history.index).toBe(index);
});
it('P2 semi-transparent combine uses max/add and multiplicative subtract with quantized numerical expectations',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle(10.3,10.3);await convert();const values=f.doc.selection.read(f.doc.bounds),i=[...values].findIndex(v=>v>0&&v<1),x=i%96,y=Math.floor(i/96),coverage=values[i];
 f.doc.selection.clear();f.doc.selection.mask.writeFloat({x,y,w:1,h:1},new Float32Array([.6]));const old=sample(f,x,y);expect(await convert('add',{target:{kind:'path',pathId:'a'}})).toBe('changed');expect(sample(f,x,y)).toBeCloseTo(Math.round(Math.max(old,coverage)*255)/255,6);
 f.doc.selection.clear();f.doc.selection.mask.writeFloat({x,y,w:1,h:1},new Float32Array([.6]));expect(await convert('subtract',{target:{kind:'path',pathId:'a'}})).toBe('changed');expect(sample(f,x,y)).toBeCloseTo(Math.round(old*(1-coverage)*255)/255,6);
});
it('P2 last pre-write target/access guard rejects mutation during raster generation',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle();const original=raster.rasterizePath;const spy=vi.spyOn(raster,'rasterizePath').mockImplementation((...args)=>{const v=original(...args);f.doc.paths[0].path.subpaths[0].knots[0].x++;return v;});expect(await convert()).toBe('rejected');expect(f.s.history.index).toBe(0);expect(sample(f)).toBe(0);spy.mockRestore();
});
it('P3 real text session owns its Ctrl+Enter confirmation with a convertible saved target',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle();const {createTextLayer}=await import('../../src/document/layerFactory');const {startTextEdit,textEditState}=await import('../../src/tools/typeTool');const layer=createTextLayer('Text',8,0,0);f.doc.insertLayer(layer);
 await act(async()=>{editor.setTool('type');startTextEdit(f.s,layer.id,false);});const input=container.querySelector<HTMLTextAreaElement>('textarea.text-editor')!;expect(input).toBeTruthy();expect(action('path.toSelection')!.enabled!()).toBe(false);const before=f.s.history.index;
 await act(async()=>key(input,'Enter',{ctrlKey:true,isComposing:true}));expect(textEditState()?.layerId).toBe(layer.id);expect(f.doc.selection.isEmpty()).toBe(true);
 await act(async()=>key(input,'Enter',{ctrlKey:true}));expect(textEditState()).toBeNull();expect(f.s.mode.kind).toBe('none');expect(f.doc.selection.isEmpty()).toBe(true);expect(f.s.history.index).toBe(before);
});
it('P3 keymap conflicts and reassignment expose/remove the same public defaults',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle();expect(keymap.conflict('Ctrl+Enter','color.reset')).toBe('path.toSelection');
 await act(async()=>keymap.reassign('color.reset','Ctrl+Enter'));expect(keymap.bindingsFor('path.toSelection')).toEqual([]);await act(async()=>key(container.querySelector('.viewport')!,'Enter',{ctrlKey:true}));expect(f.s.history.index).toBe(0);expect(f.doc.selection.isEmpty()).toBe(true);
});
it('P3 legal finish removes a one-point tail and converts the re-read final path without an empty Pen history',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle();await f.click(70,70);expect(f.path().subpaths).toHaveLength(2);expect(await convert()).toBe('changed');expect(f.path()).toEqual(triangle());expect(readPenSession(f.s)).toBeNull();expect(f.s.history.index).toBe(1);expect(sample(f)).toBe(1);expect(sample(f,70,70)).toBe(0);
});
it('P3 valid zero-area path clears selection to logical empty and outside-only old selection is cleared',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path={fillRule:'nonzero',subpaths:[{closed:false,op:'combine',knots:[knot(10,10),knot(40,40)]}]};f.doc.selection.selectAll();expect(await convert()).toBe('changed');expect(f.doc.selection.isEmpty()).toBe(true);const index=f.s.history.index;expect(await convert('replace',{target:{kind:'path',pathId:'a'}})).toBe('unchanged');expect(f.s.history.index).toBe(index);
 f.doc.selection.mask.writeFloat({x:200,y:200,w:1,h:1},new Float32Array([1]));f.doc.paths[0].path=triangle(300,300);expect(await convert('replace',{target:{kind:'path',pathId:'a'}})).toBe('changed');expect(f.doc.selection.isEmpty()).toBe(true);
});
// F1 keeps geometry assertions on assets, independently of default target/display admission.
function workFor(f:Awaited<ReturnType<typeof fixture>>){let w=f.doc.paths.find(p=>p.kind==='work');if(!w){w={id:'work-f1',kind:'work',name:'Work Path',path:triangle()};f.doc.paths.unshift(w);}return w;}
async function typeGesture(f:Awaited<ReturnType<typeof fixture>>,drag=false){
 const tool=new TypeTool(),start=pt(25,10),end=drag?pt(65,45):start;
 let text!:ReturnType<typeof f.doc.allLayers>[number];
 await act(async()=>{tool.down(f.h,start);if(drag)tool.move(f.h,end);tool.up(f.h,end);text=f.doc.allLayers().find(l=>l.kind==='text')!;});
 try{expect(text?.kind).toBe('text');if(text.kind!=='text')throw new Error('TypeTool did not create text');return structuredClone(text.text);}
 finally{await act(async()=>cancelTextEdit());f.s.setActive(f.l.id);}
}
it.each([false,true])('F1 hidden Work does not capture TypeTool click/drag (drag=%s), and explicit Work restores path text',async drag=>{
 const f=await fixture(),w=workFor(f);f.s.activePathId=w.id;expect(await convert()).toBe('changed');expect(f.s.isWorkPathHidden(w)).toBe(true);
 const text=await typeGesture(f,drag);expect(text.path).toBeUndefined();expect(text.kind).toBe(drag?'paragraph':'point');if(drag)expect(text.box).toEqual({x:0,y:0,w:40,h:35});
 expect(f.s.isWorkPathHidden(w)).toBe(true);f.s.activePathId=w.id;
 const restored=await typeGesture(f,drag);expect(restored.path?.subpath).toEqual(w.path.subpaths[0]);expect(restored.kind).toBe('point');expect(restored.box).toBeNull();
});
it.each(['saved','shape'])('F1 TypeTool retains %s path candidate while default Work is hidden',async kind=>{
 const f=await fixture(kind),w=workFor(f);f.s.activePathId=w.id;expect(await convert()).toBe('changed');
 const path=triangle();if(kind==='saved'){f.doc.paths.find(p=>p.id==='a')!.path=path;f.s.activePathId='a';}else{(f.l as ReturnType<typeof createShapeLayer>).path=path;}
 expect(f.s.isWorkPathHidden(w)).toBe(true);const text=await typeGesture(f,true);expect(text.path?.subpath).toEqual(path.subpaths[0]);expect(text.kind).toBe('point');expect(text.box).toBeNull();
});
function overlayCalls(f:Awaited<ReturnType<typeof fixture>>,id:'pen'|'directSelect'|'pathSelect'|'addAnchor'='pen'){
 const line=vi.fn(),point=vi.fn(),g=new Proxy({bezierCurveTo:line,strokeRect:point},{get:(o,k)=>Reflect.get(o,k)??(()=>{})}) as any;editor.tool(id)!.drawOverlay?.(f.h,g);return {lines:line.mock.calls.length,points:point.mock.calls.length};
}
it.each(['work','saved','clipping'].flatMap(kind=>(['replace','add','subtract'] as const).map(op=>({kind,op}))))('F1 $kind $op success deselects document paths and removes actual editor geometry',async({kind,op})=>{
 const f=await fixture('saved'),w=workFor(f),target=kind==='work'?w:f.doc.paths.find(p=>p.id==='a')!;target.kind=kind as typeof target.kind;target.path=triangle(50,50);f.s.activePathId=target.id;
 if(op!=='add')f.doc.selection.selectAll();const paths=structuredClone(f.doc.paths),layer=f.s.activeLayerId;expect(overlayCalls(f).points).toBeGreaterThan(0);
 expect(await convert(op)).toBe('changed');expect(f.s.activePathId).toBeNull();expect(f.s.isWorkPathHidden(w)).toBe(true);expect(f.doc.paths).toEqual(paths);expect(f.s.activeLayerId).toBe(layer);
 expect(sample(f,70,55)).toBe(op==='subtract'?0:1);expect(sample(f,90,90)).toBe(op==='subtract'?1:0);for(const tool of ['pen','directSelect','pathSelect','addAnchor'] as const)expect(overlayCalls(f,tool)).toEqual({lines:0,points:0});
 const index=f.s.history.index;expect(await convert()).toBe('rejected');expect(f.s.history.index).toBe(index);expect(f.doc.paths).toEqual(paths);
});
it.each(['shape','mask'])('F1 %s exception preserves document selection/hiding state and layer overlay',async kind=>{
 const f=await fixture(kind);if(kind==='shape')(f.l as ReturnType<typeof createShapeLayer>).path=triangle();else f.l.vectorMask!.path=triangle();const w=workFor(f);f.s.completeDocumentPathSelection();f.s.activePathId='saved-external';const before=overlayCalls(f,'directSelect');
 expect(await convert('replace',{target:{kind:kind==='shape'?'shape':'vectorMask',layerId:f.l.id}})).toBe('changed');expect(f.s.activePathId).toBe('saved-external');expect(f.s.isWorkPathHidden(w)).toBe(true);expect(f.s.activeLayerId).toBe(f.l.id);expect(overlayCalls(f,'directSelect')).toEqual(before);
 f.s.activePathId=null;expect(await convert()).toBe('unchanged');expect(overlayCalls(f,'directSelect').points).toBeGreaterThan(0);
});
it('F1 hidden Work excluded from default conversion/direct/anchor editing; explicit target remains admitted',async()=>{
 const f=await fixture('saved'),w=workFor(f);f.s.activePathId=w.id;const geometry=clonePath(w.path);expect(await convert()).toBe('changed');expect(canPathSelection('replace')).toBe(false);expect(canPathSelection('replace',{target:{kind:'path',pathId:w.id}})).toBe(true);
 for(const id of ['directSelect','pathSelect','deleteAnchor','addAnchor','convertPoint'] as const){const tool=editor.tool(id)!;await act(async()=>{tool.down?.(f.h,pt(10,10));tool.move?.(f.h,pt(20,20));tool.up?.(f.h,pt(20,20));});}expect(w.path).toEqual(geometry);expect(f.s.history.index).toBe(1);
 expect(await convert('replace',{target:{kind:'path',pathId:'missing'}})).toBe('rejected');expect(await convert('replace',{target:{kind:'path',pathId:w.id}})).toBe('unchanged');expect(f.s.history.index).toBe(1);expect(f.s.isWorkPathHidden(w)).toBe(true);
});
it('F1 hide/restoration is content-bound and session-local; metadata, selection undo and tools do not restore it',async()=>{
 const f=await fixture('saved'),w=workFor(f);f.s.activePathId=w.id;expect(await convert()).toBe('changed');const original=clonePath(w.path),index=f.s.history.index;
 await act(async()=>{f.s.history.undo();f.s.history.redo();f.doc.emit({type:'paths'});editor.setTool('directSelect');editor.setTool('pen');});expect(f.s.isWorkPathHidden(w)).toBe(true);expect(getTarget(f.s,false)).toBeNull();
 w.path.subpaths[0].knots[0].x++;expect(getTarget(f.s,false)).toEqual({kind:'path',pathId:w.id});w.path=clonePath(original);expect(getTarget(f.s,false)).toBeNull();
 const other=editor.addDocument(newDoc(96,96));other.doc.paths.push({...structuredClone(w)});expect(getTarget(other,false)).toEqual({kind:'path',pathId:w.id});await act(async()=>editor.activate(f.s.id));expect(getTarget(f.s,false)).toBeNull();
 f.doc.paths[f.doc.paths.indexOf(w)]={...w,path:clonePath(w.path)};expect(getTarget(f.s,false)).toEqual({kind:'path',pathId:w.id});expect(f.s.history.index).toBe(index);
});
it('F1 explicit Work row restores display; Saved row does not release Work hiding',async()=>{
 const f=await fixture('saved'),w=workFor(f);f.doc.paths.find(p=>p.id==='a')!.path=triangle(50,50);f.s.activePathId=w.id;await convert();await act(async()=>ui.bump('docRev'));
 const row=(name:string)=>[...container.querySelectorAll<HTMLElement>('[data-paths] .list-item')].find(el=>el.textContent===name)!;
 await act(async()=>row('Path A').click());expect(f.s.isWorkPathHidden(w)).toBe(true);expect(f.s.activePathId).toBe('a');expect(overlayCalls(f).points).toBeGreaterThan(0);
 await act(async()=>row('Work Path').click());expect(f.s.isWorkPathHidden(w)).toBe(false);expect(getTarget(f.s,false)).toEqual({kind:'path',pathId:w.id});expect(f.s.history.index).toBe(1);
});
it('F1 hidden Work -> visible new Pen draft uses undoable Work replacement and preserves Saved asset',async()=>{
 const f=await fixture('saved'),w=workFor(f);f.doc.paths.find(p=>p.id==='a')!.path=triangle(50,50);const saved=clonePath(f.doc.paths.find(p=>p.id==='a')!.path),original=clonePath(w.path);f.s.activePathId=w.id;await convert();
 await f.click(60,60);await f.click(80,60);expect(readPenSession(f.s)).toBeTruthy();expect(w.path.subpaths).toHaveLength(1);expect(w.path.subpaths[0].knots.map(k=>[k.x,k.y])).toEqual([[60,60],[80,60]]);expect(overlayCalls(f).points).toBe(2);expect(f.doc.paths.find(p=>p.id==='a')!.path).toEqual(saved);
 await act(async()=>finishPen(f.s));expect(f.s.history.index).toBe(3);await act(async()=>f.s.history.undo());expect(w.path.subpaths).toHaveLength(0);await act(async()=>f.s.history.undo());expect(w.path).toEqual(original);await act(async()=>{f.s.history.redo();f.s.history.redo();});expect(w.path.subpaths[0].knots).toHaveLength(2);expect(f.doc.paths.find(p=>p.id==='a')!.path).toEqual(saved);
});
it.each(['unchanged','zero'] as const)('F1 %s success performs cleanup without empty selection history or dirty',async kind=>{
 const f=await fixture('saved'),w=workFor(f);f.s.activePathId=w.id;if(kind==='zero')w.path=triangle(300,300);else{await convert();f.s.activePathId=w.id;}f.s.markSaved();const index=f.s.history.index;
 expect(await convert(kind==='zero'?'subtract':'replace')).toBe('unchanged');expect(f.s.activePathId).toBeNull();expect(f.s.isWorkPathHidden(w)).toBe(true);expect(f.s.history.index).toBe(index);expect(f.s.modified).toBe(false);expect(overlayCalls(f)).toEqual({lines:0,points:0});
});
it.each(['raster','history','finish','parameter','protection'])('F1 %s failure leaves row/overlay/hidden state untouched and retry retains history semantics',async failure=>{
 const f=await fixture('saved'),w=workFor(f);await f.click(10,10);await f.click(40,10);await f.click(40,40);const owner=readPenSession(f.s)!,before=overlayCalls(f),beforePath=clonePath(f.path());let restore=()=>{};
 if(failure==='raster'){const spy=vi.spyOn(raster,'rasterizePath').mockImplementation(()=>{throw Error('injected raster');});restore=()=>spy.mockRestore();}
 if(failure==='history'){const push=f.s.push.bind(f.s),spy=vi.spyOn(f.s,'push').mockImplementation((cmd,applied)=>{if(cmd.label==='Make Selection')throw Error('injected selection history');push(cmd,applied);});restore=()=>spy.mockRestore();}
 if(failure==='finish'){const spy=vi.spyOn(owner,'finish').mockReturnValue(false);restore=()=>spy.mockRestore();}
 if(failure==='protection'){f.s.editProtected=true;restore=()=>{f.s.editProtected=false;};}
 expect(await convert('replace',failure==='parameter'?{feather:1}:undefined)).toBe(['raster','history'].includes(failure)?'failed':'rejected');expect(f.s.activePathId).toBe('a');expect(f.s.isWorkPathHidden(w)).toBe(false);expect(overlayCalls(f).points).toBe(before.points);expect(overlayCalls(f).lines).toBeGreaterThanOrEqual(2);expect(f.path()).toEqual(beforePath);expect(sample(f)).toBe(0);restore();expect(await convert()).toBe('changed');expect(f.s.history.index).toBe(2);expect(f.s.activePathId).toBeNull();expect(f.s.isWorkPathHidden(w)).toBe(true);
});
it('F1 successful selection observer switching the session does not hide or deselect either new context',async()=>{
 const f=await fixture('saved'),w=workFor(f);f.doc.paths.find(p=>p.id==='a')!.path=triangle();let other!:typeof f.s;const off=f.doc.on(changes=>{if(!changes.some(c=>c.type==='selection'))return;off();other=editor.addDocument(newDoc(96,96));other.doc.paths.push({id:'new',kind:'work',name:'New',path:triangle()});other.activePathId='new';});
 expect(await convert()).toBe('changed');expect(editor.active).toBe(other);expect(other.activePathId).toBe('new');expect(other.isWorkPathHidden(other.doc.paths[0])).toBe(false);expect(f.s.activePathId).toBe('a');expect(f.s.isWorkPathHidden(w)).toBe(false);
});
it('F1 native serialization and close/reopen do not persist or leak display hiding',async()=>{
 const f=await fixture('saved'),w=workFor(f);f.s.activePathId=w.id;await convert();const {encodeNative,decodeNative}=await import('../../src/document/native');const hiddenBytes=encodeNative(f.doc);f.s.activePathId=w.id;expect(encodeNative(f.doc)).toEqual(hiddenBytes);f.s.completeDocumentPathSelection();expect(f.s.isWorkPathHidden(w)).toBe(true);
 await act(async()=>editor.removeSession(f.s.id));expect(f.s.isWorkPathHidden(w)).toBe(false);let reopened!:typeof f.s;await act(async()=>{reopened=editor.addDocument(decodeNative(hiddenBytes).doc);});const loaded=reopened.doc.paths.find(p=>p.kind==='work')!;expect(reopened.isWorkPathHidden(loaded)).toBe(false);expect(getTarget(reopened,false)).toEqual({kind:'path',pathId:loaded.id});expect(reopened.modified).toBe(false);
});
const pathList=()=>container.querySelector<HTMLElement>('[data-paths] .list')!;
async function blank(init:MouseEventInit={}){await act(async()=>{pathList().dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,...init}));});}
it('F2 real panel blank clears Saved highlight only; visible Work remains default and coverage/history/dirty unchanged',async()=>{
 const f=await fixture('saved'),w=workFor(f);f.doc.paths.find(p=>p.id==='a')!.path=triangle(50,50);f.doc.selection.selectAll();await act(async()=>ui.bump('docRev'));f.s.markSaved();const layer=f.s.activeLayerId,pixels=f.doc.selection.read(f.doc.bounds);
 await blank();await act(async()=>ui.bump('docRev'));expect(f.s.activePathId).toBeNull();expect(pathList().querySelector('.active')).toBeNull();expect(f.s.isWorkPathHidden(w)).toBe(false);expect(getTarget(f.s,false)).toEqual({kind:'path',pathId:w.id});expect(overlayCalls(f).points).toBeGreaterThan(0);expect(f.s.activeLayerId).toBe(layer);expect(f.doc.selection.read(f.doc.bounds)).toEqual(pixels);expect(f.s.history.index).toBe(0);expect(f.s.modified).toBe(false);
 await blank();expect(f.s.history.index).toBe(0);
});
it('F2 blank preserves hidden Work after selecting Saved; reselect Work then blank keeps ordinary Work visible',async()=>{
 const f=await fixture('saved'),w=workFor(f);f.doc.paths.find(p=>p.id==='a')!.path=triangle(50,50);f.s.activePathId=w.id;await convert();await act(async()=>ui.bump('docRev'));
 const row=(name:string)=>[...pathList().querySelectorAll<HTMLElement>('.list-item')].find(x=>x.textContent===name)!;
 await act(async()=>row('Path A').click());await blank();expect(f.s.isWorkPathHidden(w)).toBe(true);expect(getTarget(f.s,false)).toBeNull();expect(overlayCalls(f)).toEqual({lines:0,points:0});
 await act(async()=>row('Work Path').click());await blank();expect(f.s.isWorkPathHidden(w)).toBe(false);expect(f.s.activePathId).toBeNull();expect(overlayCalls(f).points).toBeGreaterThan(0);expect(f.s.history.index).toBe(1);
});
it('F2 row icon/name/rename, context menu, scrollbar events and toolbar action do not bubble into blank cancellation',async()=>{
 const f=await fixture('saved');f.doc.paths[0].path=triangle();await act(async()=>ui.bump('docRev'));const row=[...pathList().querySelectorAll<HTMLElement>('.list-item')].find(x=>x.textContent==='Path A')!;
 for(const node of [row,row.querySelector('svg')!,row.querySelector('span')!]){expect(node).toBeTruthy();await act(async()=>node.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0})));expect(f.s.activePathId).toBe('a');}
 await act(async()=>{pathList().dispatchEvent(new Event('scroll',{bubbles:true}));pathList().dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:50}));});expect(f.s.activePathId).toBe('a');
 const item=await contextRow('Path A');expect(item).toBeTruthy();expect(f.s.activePathId).toBe('a');await act(async()=>document.querySelector<HTMLElement>('[role=menu]')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 await act(async()=>row.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,button:0})));const input=pathList().querySelector<HTMLInputElement>('input')!;await act(async()=>input.click());expect(f.s.activePathId).toBe('a');
 await act(async()=>container.querySelector<HTMLButtonElement>('[data-paths] [title="Create new path"]')!.click());expect(f.s.activePathId).toBe(f.doc.paths.at(-1)!.id);expect(f.s.activePathId).not.toBeNull();expect(f.s.history.index).toBe(1);expect(f.doc.selection.isEmpty()).toBe(true);
});
it.each([{button:1},{button:2},{ctrlKey:true},{altKey:true},{shiftKey:true},{metaKey:true}])('F2 only ordinary primary blank click may deselect (%j)',async init=>{
 const f=await fixture('saved');await blank(init);expect(f.s.activePathId).toBe('a');expect(f.s.history.index).toBe(0);
});
it('F2 blank idle draft finishes once before deselection without converting pixels',async()=>{
 const f=await fixture('saved'),w=workFor(f);await f.click(10,10);await f.click(40,10);await f.click(40,40);const owner=readPenSession(f.s)!,finish=vi.spyOn(owner,'finish'),path=clonePath(f.path());await blank();expect(finish).toHaveBeenCalledTimes(1);expect(readPenSession(f.s)).toBeNull();expect(f.s.activePathId).toBeNull();expect(f.path()).toEqual(path);expect(f.s.history.index).toBe(1);expect(f.doc.selection.isEmpty()).toBe(true);expect(f.s.isWorkPathHidden(w)).toBe(false);
 await act(async()=>f.s.history.undo());expect(f.path().subpaths).toHaveLength(0);await act(async()=>f.s.history.redo());expect(f.path()).toEqual(path);
});
it('F2 failed idle finish preserves selection/draft/hidden; retry finishes only once successfully',async()=>{
 const f=await fixture('saved'),w=workFor(f);await f.click(10,10);await f.click(40,10);const owner=readPenSession(f.s)!,finish=vi.spyOn(owner,'finish').mockReturnValueOnce(false);await blank();expect(finish).toHaveBeenCalledTimes(1);expect(f.s.activePathId).toBe('a');expect(readPenSession(f.s)).toBe(owner);expect(f.s.history.index).toBe(0);expect(f.s.isWorkPathHidden(w)).toBe(false);
 await blank();expect(finish).toHaveBeenCalledTimes(2);expect(f.s.activePathId).toBeNull();expect(f.s.history.index).toBe(1);expect(f.doc.selection.isEmpty()).toBe(true);
});
it('F2 drag and no-selected-row preserve Pen ownership, then normal release stays recoverable',async()=>{
 const f=await fixture('saved');await f.click(10,10);await f.click(40,10);const owner=readPenSession(f.s)!,finish=vi.spyOn(owner,'finish');await act(async()=>{f.tool.down(f.h,pt(40,40));f.tool.move(f.h,pt(45,45));});await blank();expect(finish).not.toHaveBeenCalled();expect(f.tool.busy()).toBe(true);expect(f.s.activePathId).toBe('a');await act(async()=>f.tool.up());await blank();expect(finish).toHaveBeenCalledTimes(1);
 const w=workFor(f);f.s.activePathId=w.id;f.s.activePathId=null;await f.click(60,60);const idle=readPenSession(f.s)!,idleFinish=vi.spyOn(idle,'finish');await blank();expect(idleFinish).not.toHaveBeenCalled();expect(readPenSession(f.s)).toBe(idle);
});
it.each(['editProtected','outputPending','closePending','text','transform'] as const)('F2 blank respects %s protection and keeps selected row',async state=>{
 const f=await fixture('saved');if(state==='editProtected')f.s.editProtected=true;else if(state==='outputPending'||state==='closePending')f.s[state]=Promise.resolve(true);else f.s.mode=state==='text'?{kind:'text',layerId:f.l.id,isNew:false}:{kind:'transform',layerIds:[f.l.id]};
 await blank();expect(f.s.activePathId).toBe('a');expect(f.s.history.index).toBe(0);f.s.editProtected=false;f.s.outputPending=f.s.closePending=null;f.s.mode={kind:'none'};
});
it('F2 actual rename IME composition blocks blank focus/deselection until local composition ends',async()=>{
 const f=await fixture('saved');const row=[...pathList().querySelectorAll<HTMLElement>('.list-item')].find(x=>x.textContent==='Path A')!;await act(async()=>row.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,button:0})));const input=pathList().querySelector<HTMLInputElement>('input')!;
 await act(async()=>{input.focus();input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}));});const down=new MouseEvent('mousedown',{button:0,bubbles:true,cancelable:true});await act(async()=>pathList().dispatchEvent(down));expect(down.defaultPrevented).toBe(true);await blank();expect(f.s.activePathId).toBe('a');expect(document.activeElement).toBe(input);expect(f.s.history.index).toBe(0);
 await act(async()=>input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中'})));await blank();expect(f.s.activePathId).toBeNull();expect(f.s.history.index).toBe(0);
});
it.each(['keyboard','button','context'])('F1 actual %s document-path entry hides coexisting Work and ends row highlight',async entry=>{
 const f=await fixture('saved'),w=workFor(f);f.doc.paths.find(p=>p.id==='a')!.path=triangle(50,50);f.doc.paths.find(p=>p.id==='b')!.path=triangle(50,50);await act(async()=>ui.bump('docRev'));
 if(entry==='keyboard')await act(async()=>key(container.querySelector('.viewport')!,'Enter',{ctrlKey:true}));else if(entry==='button')await act(async()=>loadButton().click());else{const item=await contextRow('Path B');await act(async()=>item.click());}
 await act(async()=>ui.bump('docRev'));expect(sample(f,70,55)).toBe(1);expect(f.s.activePathId).toBeNull();expect(pathList().querySelector('.active')).toBeNull();expect(f.s.isWorkPathHidden(w)).toBe(true);expect(overlayCalls(f)).toEqual({lines:0,points:0});expect(f.doc.paths).toHaveLength(3);expect(f.s.history.index).toBe(1);
});
it.each(['action','output','close'])('F1 %s refusal preserves document row and visible Work',async reason=>{
 const f=await fixture('saved'),w=workFor(f);f.doc.paths.find(p=>p.id==='a')!.path=triangle();const {installAccessPolicy}=await import('../../src/app/access');const restore=reason==='action'?installAccessPolicy(e=>({visible:true,enabled:e!=='action:path.toSelection'})):()=>{};
 if(reason==='output')f.s.outputPending=Promise.resolve(true);if(reason==='close')f.s.closePending=Promise.resolve(true);expect(await convert()).toBe('rejected');expect(f.s.activePathId).toBe('a');expect(f.s.isWorkPathHidden(w)).toBe(false);expect(overlayCalls(f).points).toBeGreaterThan(0);expect(f.s.history.index).toBe(0);restore();f.s.outputPending=f.s.closePending=null;
});
it.each(['target','row'])('F1 committed selection with observer changing %s must not clear the new display context',async reason=>{
 const f=await fixture('saved'),w=workFor(f);f.doc.paths.find(p=>p.id==='a')!.path=triangle();const off=f.doc.on(changes=>{if(!changes.some(c=>c.type==='selection'))return;off();if(reason==='target')f.doc.paths[f.doc.paths.findIndex(p=>p.id==='a')]={...f.doc.paths.find(p=>p.id==='a')!};else f.s.activePathId='b';});
 expect(await convert()).toBe('changed');expect(f.s.activePathId).toBe(reason==='row'?'b':'a');expect(f.s.isWorkPathHidden(w)).toBe(false);expect(f.s.history.index).toBe(1);
});
