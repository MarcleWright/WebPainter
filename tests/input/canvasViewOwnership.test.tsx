// @vitest-environment jsdom
import {act} from 'react';
import {flushSync} from 'react-dom';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CanvasView} from '../../src/ui/CanvasView';
import {editor} from '../../src/app/editor';
import {inputPointerBusy} from '../../src/app/heldPan';
import {gpuCompositor} from '../../src/rendering/renderEngine';
import {ui} from '../../src/app/store';
import {openContextMenu} from '../../src/ui/menu/Menu';
import {clearInputSessions,inputSession,key} from './fixture';

type Renderer = {kind:'webgpu'|'canvas2d';resize:()=>void;dispose:()=>void};
const surfaces = vi.hoisted(() => ({
  mounts: [] as Array<{canvas:HTMLCanvasElement;resolve:(renderer:Renderer)=>void}>,
  compositor: {disposed:false},
}));
vi.mock('../../src/rendering/viewportRenderer',()=>({
  createViewportRendererAsync:(canvas:HTMLCanvasElement)=>new Promise(resolve=>{
    surfaces.mounts.push({canvas,resolve:renderer=>resolve({renderer,canvas})});
  }),
}));
vi.mock('../../src/gpu/device',async importOriginal=>{
  const actual=await importOriginal<typeof import('../../src/gpu/device')>();
  return {...actual,currentGpu:()=>({compositor:surfaces.compositor})};
});
vi.mock('../../src/ui/menu/Menu',async importOriginal=>{
  const actual=await importOriginal<typeof import('../../src/ui/menu/Menu')>();
  return {...actual,openContextMenu:vi.fn()};
});

const diagnostics=window as Window & {__celenneRenderer?:string;__celenneViewport?:{renderer:Renderer;canvas:HTMLCanvasElement}};
const frames=new Map<number,FrameRequestCallback>();
let nextFrame=0,root:Root,container:HTMLDivElement;
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
beforeEach(()=>{
  surfaces.mounts.length=0;
  vi.mocked(openContextMenu).mockClear();
  vi.stubGlobal('ResizeObserver',class {
    constructor(private readonly update:()=>void){}
    observe(){this.update();}
    disconnect(){}
  });
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(new DOMRect(0,0,320,240));
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(()=>new Proxy({},{get:()=>()=>{}}) as any);
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{
    const id=++nextFrame;frames.set(id,callback);return id;
  });
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>{frames.delete(id);});
  container=document.createElement('div');
  document.body.append(container);
  root=createRoot(container);
});
afterEach(async()=>{
  await act(async()=>root.unmount());
  clearInputSessions();
  container.remove();
  frames.clear();
  delete diagnostics.__celenneRenderer;
  delete diagnostics.__celenneViewport;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('does not publish a renderer disposed during asynchronous GPU lookup',async()=>{
  inputSession();
  await act(async()=>root.render(<CanvasView key="old"/>));
  const first=surfaces.mounts[0]!;
  const old={kind:'webgpu' as const,dispose:vi.fn(),resize:vi.fn(()=>{
    // Creation has resolved and resize runs before the asynchronous GPU lookup.
    queueMicrotask(()=>flushSync(()=>root.render(<CanvasView key="replacement"/>)));
  })};
  await act(async()=>{first.resolve(old);await vi.dynamicImportSettled();});
  expect(old.resize).toHaveBeenCalledTimes(1);
  expect(old.dispose).toHaveBeenCalledTimes(1);
  expect(first.canvas.isConnected).toBe(false);
  expect(surfaces.mounts).toHaveLength(2);
  expect(gpuCompositor()).toBeNull();
  expect(diagnostics.__celenneRenderer).toBeUndefined();
  expect(diagnostics.__celenneViewport).toBeUndefined();

  const second=surfaces.mounts[1]!;
  const replacement={kind:'canvas2d' as const,dispose:vi.fn(),resize:vi.fn()};
  await act(async()=>second.resolve(replacement));
  expect(diagnostics.__celenneViewport).toEqual({renderer:replacement,canvas:second.canvas});
});

it('drops cursor frames from the previous document and cancels a pending frame on viewport unmount',async()=>{
  inputSession();
  await act(async()=>root.render(<CanvasView/>));
  const renderer={kind:'canvas2d' as const,dispose:vi.fn(),resize:vi.fn()};
  await act(async()=>surfaces.mounts[0]!.resolve(renderer));
  const cursor={x:900,y:800,inside:false};
  const schedule=async()=>{
    const before=new Set(frames.keys());
    await act(async()=>container.querySelector('.viewport')!.dispatchEvent(
      new MouseEvent('pointermove',{bubbles:true,clientX:150,clientY:125}),
    ));
    const ids=[...frames.keys()].filter(id=>!before.has(id));
    expect(ids).toHaveLength(1);
    return ids[0]!;
  };

  await act(async()=>ui.set({cursor}));
  const old=await schedule();
  await act(async()=>{inputSession();});
  const stale=frames.get(old)!;
  frames.delete(old);
  await act(async()=>stale(0));
  expect(ui.get().cursor).toEqual(cursor);

  const pending=await schedule(),late=frames.get(pending)!;
  await act(async()=>root.render(null));
  expect(frames.has(pending)).toBe(false);
  await act(async()=>late(0));
  expect(ui.get().cursor).toEqual(cursor);
});

async function mountBrush(tool: 'brush' | 'pencil' | 'eraser' = 'brush') {
  const {session}=inputSession();
  await act(async()=>{
    editor.setTool(tool);
    ui.setToolOptions('eraser',{mode:'brush'});
    ui.setBrush({size:24.25,hardness:0.45,opacity:1,flow:1});
    root.render(<CanvasView/>);
  });
  const viewport=container.querySelector<HTMLElement>('.viewport')!;
  let captured: number | null = null;
  viewport.setPointerCapture=(id)=>{captured=id;};
  viewport.hasPointerCapture=(id)=>captured===id;
  viewport.releasePointerCapture=()=>{captured=null;};
  const pointer=(type: string, init: MouseEventInit = {}, id=1, pointerType='mouse')=>{
    const event = new MouseEvent(type,{bubbles:true,cancelable:true,clientX:100,clientY:100,...init});
    Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:pointerType},pressure:{value:1}});
    viewport.dispatchEvent(event);
    return event;
  };
  const start=()=>pointer('pointerdown',{altKey:true,button:2,buttons:2});
  const move=(clientX:number,clientY:number,buttons=2,button=-1)=>pointer('pointermove',{clientX,clientY,button,buttons});
  const brush=()=>({size:ui.get().brush.size,hardness:ui.get().brush.hardness});
  return {session,viewport,pointer,start,move,brush,captured:()=>captured};
}

it.each([1,2])('scrubs at %sx with independent axes, clamps and leaves pixels and history unchanged',async zoom=>{
  const {session,pointer,start,move,brush,captured}=await mountBrush();
  session.view.zoom=zoom;
  const layer=session.activeLayer()!;
  if(layer.kind!=='pixel') throw Error('Expected a pixel layer');
  const pixels=()=>layer.raster.readPixels({x:0,y:0,w:session.doc.width,h:session.doc.height});
  const before=pixels();
  const current=session.history.current.id;
  await act(async()=>{
    expect(start().defaultPrevented).toBe(true);
    expect(captured()).toBe(1);
    expect(inputPointerBusy()).toBe(true);
    move(110,100);
    expect(brush()).toEqual({size:24.25+20/zoom,hardness:0.45});
    move(110,126);
    expect(brush().hardness).toBeCloseTo(0.58);
    move(100,126);
    expect(brush().size).toBe(24.25);
    move(10100,-1000);
    expect(brush()).toEqual({size:5000,hardness:0});
    move(-100,1000);
    expect(brush()).toEqual({size:1,hardness:1});
    pointer('pointerup',{button:2});
  });
  expect(captured()).toBeNull();
  expect(inputPointerBusy()).toBe(false);
  expect(pixels()).toEqual(before);
  expect(session.history.current.id).toBe(current);
  expect(session.history.index).toBe(0);
  expect(session.hasLocalUncommitted).toBe(false);
});

it.each(['right','left'])('retains ownership of a mouse chord with %s released first and suppresses only its right-click menu',async first=>{
  const {session,pointer,start,move,brush,captured}=await mountBrush();
  session.view.zoom=1;
  await act(async()=>{
    start();
    move(110,120,3,0);
    move(120,140,first==='right'?1:2,first==='right'?2:0);
    expect(brush().size).toBe(first==='right'?44.25:64.25);
    move(130,150,first==='right'?1:2);
    expect(brush().size).toBe(first==='right'?44.25:84.25);
    expect(captured()).toBe(1);
    pointer('pointerup',{button:first==='right'?0:2});
    pointer('contextmenu',{button:2});
    expect(openContextMenu).not.toHaveBeenCalled();
    pointer('pointerdown',{button:2,buttons:2});
    pointer('pointerup',{button:2});
    pointer('contextmenu',{button:2});
  });
  expect(captured()).toBeNull();
  expect(openContextMenu).toHaveBeenCalledTimes(1);
  expect(session.history.index).toBe(0);
});

it.each(['escape','blur','capture','cancel','tool','eraser mode','dialog','protected','document'])('keeps the last settings and ignores the old drag after %s',async ending=>{
  const {session,viewport,pointer,start,move,brush}=await mountBrush(ending==='eraser mode'?'eraser':'brush');
  session.view.zoom=1;
  await act(async()=>{
    start(); move(110,120);
    const settings=brush();
    const stop=()=>{
      switch(ending){
        case 'escape': expect(key(viewport,'Escape',{altKey:true}).defaultPrevented).toBe(true); break;
        case 'blur': window.dispatchEvent(new Event('blur')); break;
        case 'capture': pointer('lostpointercapture',{buttons:2}); break;
        case 'cancel': pointer('pointercancel'); break;
        case 'tool': editor.setTool('pencil'); break;
        case 'eraser mode': ui.setToolOptions('eraser',{mode:'block'}); break;
        case 'dialog': { const id=ui.openDialog('about'); ui.closeDialog(id); break; }
        case 'protected': {const token=session.acquireEditProtection('fixture');session.releaseEditProtection(token);break;}
        case 'document': inputSession(); break;
      }
    };
    stop();
    move(220,204);
    pointer('pointerup',{button:2});
    expect(brush()).toEqual(settings);
    pointer('contextmenu',{button:2});
    expect(openContextMenu).not.toHaveBeenCalled();
    pointer('pointerdown',{button:2,buttons:2});
    pointer('pointerup',{button:2});
    pointer('contextmenu',{button:2});
  });
  expect(inputPointerBusy()).toBe(false);
  expect(session.history.index).toBe(0);
  expect(openContextMenu).toHaveBeenCalledTimes(1);
});

it('keeps Pencil hardness fixed and preserves context menu on the non-paint Eraser',async()=>{
  const {session,pointer,start,move,brush}=await mountBrush('pencil');
  session.view.zoom=1;
  await act(async()=>{
    start();move(100,170);
    expect(brush()).toEqual({size:24.25,hardness:0.45});
    ui.setBrush({hardness:0.65});
    move(130,170);
    expect(brush()).toEqual({size:84.25,hardness:0.65});
    pointer('pointerup',{button:2});
    editor.setTool('eraser');
    ui.setToolOptions('eraser',{mode:'block'});
    expect(start().defaultPrevented).toBe(false);
    move(230,240);
    pointer('pointerup',{button:2});
    pointer('contextmenu',{button:2});
  });
  expect(brush()).toEqual({size:84.25,hardness:0.65});
  expect(openContextMenu).toHaveBeenCalledTimes(1);
});

it.each(['stroke','pan'])('never takes a right-button chord from an existing %s',async owner=>{
  const {session,pointer,move,brush}=await mountBrush();
  const prior=brush();
  const button=owner==='stroke'?0:1;
  const bit=owner==='stroke'?1:4;
  const pan=session.view.panX;
  await act(async()=>{
    pointer('pointerdown',{button,buttons:bit});
    expect(inputPointerBusy()).toBe(true);
    pointer('pointermove',{altKey:true,button:2,buttons:bit|2,clientX:120,clientY:150});
    move(130,150,bit,2);
    expect(brush()).toEqual(prior);
    expect(inputPointerBusy()).toBe(true);
    pointer('pointerup',{button});
    pointer('contextmenu',{button:2});
  });
  expect(inputPointerBusy()).toBe(false);
  if(owner==='pan') expect(session.view.panX).toBe(pan+30);
  expect(openContextMenu).toHaveBeenCalledTimes(1);
});

it.each([
  { next: 'pen', exit: 'lost capture', outsideUp: false },
  { next: 'touch', exit: 'lost capture', outsideUp: true },
  { next: 'pen', exit: 'blur', outsideUp: true },
  { next: 'touch', exit: 'document change', outsideUp: false },
])('admits a fresh $next after $exit and isolates the previous mouse tail',async ({next,exit,outsideUp})=>{
  const {session,pointer,start,move,brush,captured}=await mountBrush();
  session.view.zoom=1;
  const tool=editor.tool('brush')!;
  const down=vi.spyOn(tool,'down');
  const toolMove=vi.spyOn(tool,'moveBatch');
  const up=vi.spyOn(tool,'up');
  await act(async()=>{
    start();
    move(115,124);
    const settings=brush();
    if(exit==='lost capture') pointer('lostpointercapture',{buttons:2});
    else if(exit==='blur') window.dispatchEvent(new Event('blur'));
    else inputSession();
    expect(captured()).toBeNull();
    expect(inputPointerBusy()).toBe(false);
    if(outsideUp){
      const upOutside=new MouseEvent('pointerup',{button:2,bubbles:true});
      Object.defineProperty(upOutside,'pointerId',{value:1});
      document.body.dispatchEvent(upOutside);
    }
    pointer('pointerdown',{button:0,buttons:1},7,next);
    expect(down).toHaveBeenCalledTimes(1);
    expect(captured()).toBe(7);

    move(180,150);
    move(184,160,0);
    pointer('pointerup',{button:2});
    pointer('lostpointercapture',{button:2});
    pointer('contextmenu',{button:2});
    expect(openContextMenu).not.toHaveBeenCalled();
    expect(toolMove).not.toHaveBeenCalled();
    expect(up).not.toHaveBeenCalled();
    expect(inputPointerBusy()).toBe(true);
    expect(brush()).toEqual(settings);

    pointer('pointermove',{buttons:1},7,next);
    pointer('pointerup',{button:0},7,next);
    expect(toolMove).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledTimes(1);
    pointer('pointerdown',{button:2,buttons:2});
    pointer('pointerup',{button:2});
    pointer('contextmenu',{button:2});
    expect(openContextMenu).toHaveBeenCalledTimes(1);
  });
  expect(inputPointerBusy()).toBe(false);
});
