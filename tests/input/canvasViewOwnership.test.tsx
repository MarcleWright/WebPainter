// @vitest-environment jsdom
import {act} from 'react';
import {flushSync} from 'react-dom';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {CanvasView} from '../../src/ui/CanvasView';
import {gpuCompositor} from '../../src/rendering/renderEngine';
import {editor} from '../../src/app/editor';
import {installInputDispatch} from '../../src/app/inputDispatch';
import {captureWebCanvasKeyDown,enableWebCanvasInput,resetWebCanvasAlt} from '../../src/app/webCanvasInput';
import {ui} from '../../src/app/store';
import {clearInputSessions,inputSession} from './fixture';

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

const diagnostics=window as Window & {__celenneRenderer?:string;__celenneViewport?:{renderer:Renderer;canvas:HTMLCanvasElement}};
const frames=new Map<number,FrameRequestCallback>();
let nextFrame=0,root:Root,container:HTMLDivElement;
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
beforeEach(()=>{
  surfaces.mounts.length=0;
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

it('cancels Alt release after a focused Web viewport handles zoom, while delivering the release to Pen first', async () => {
  const {session}=inputSession();
  await act(async()=>root.render(<CanvasView/>));
  const viewport=container.querySelector<HTMLElement>('.viewport')!;
  const key=(type: string, init: KeyboardEventInit={})=>{
    const event=new KeyboardEvent(type,{key:'Alt',code:'AltLeft',altKey:type==='keydown',bubbles:true,cancelable:true,...init});
    viewport.dispatchEvent(event);
    return event;
  };
  const wheel=(deltaY: number, init: WheelEventInit={})=>viewport.querySelector('canvas')!.dispatchEvent(
    new WheelEvent('wheel',{altKey:true,deltaY,bubbles:true,cancelable:true,...init}),
  );
  const disable=enableWebCanvasInput(container);
  const dispose=installInputDispatch();
  window.addEventListener('keydown',captureWebCanvasKeyDown,true);
  try{
    await act(async()=>{
      viewport.focus();
      editor.setTool('pen');
      const releases: boolean[]=[];
      const observeTool=vi.spyOn(editor.currentTool!,'keyUp');
      observeTool.mockImplementation((_host,event)=>{releases.push(event.defaultPrevented);return false;});

      key('keydown');
      expect(key('keyup').defaultPrevented).toBe(false);

      key('keydown');
      const before=session.view.zoom;
      wheel(-80);
      expect(session.view.zoom).toBeGreaterThan(before);
      expect(key('keyup').defaultPrevented).toBe(true);
      expect(releases).toEqual([false,false]);

      session.view.zoom=128;
      key('keydown');
      wheel(-80);
      expect(session.view.zoom).toBe(128);
      expect(key('keyup').defaultPrevented).toBe(true);

      key('keydown');
      wheel(0);
      expect(key('keyup').defaultPrevented).toBe(false);

      key('keydown',{ctrlKey:true});
      wheel(80,{ctrlKey:true});
      expect(key('keyup').defaultPrevented).toBe(false);

      key('keydown');
      wheel(80);
      expect(key('keyup',{code:'AltRight'}).defaultPrevented).toBe(false);

      key('keydown');
      wheel(80);
      resetWebCanvasAlt();
      expect(key('keyup').defaultPrevented).toBe(false);

      disable();
      key('keydown');
      wheel(80);
      expect(key('keyup').defaultPrevented).toBe(false);
    });
  }finally{
    window.removeEventListener('keydown',captureWebCanvasKeyDown,true);
    dispose();
    disable();
  }
});
