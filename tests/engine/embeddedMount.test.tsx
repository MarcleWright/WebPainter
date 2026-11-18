// @vitest-environment jsdom
import {act} from 'react';
import {createPortal} from 'react-dom';
import {afterEach,it,expect,vi} from 'vitest';
import {mountDirect,mountFrame,mountPageSurface} from '../../src/embedded/mount';
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

it('composition picker settles once and leaves formal document open to the host', async () => {
  node = document.createElement('div');
  document.body.append(node);
  const resource = vi.fn(async () => ({ name: 'picked.wpnative', bytes: createNative(24, 16) }));
  const page = await act(async () => mountPageSurface(node, {
    nativeVersion: 1, readResource: resource, save: async () => {}, export: async () => {},
    confirm: async () => 0, dirty() {}, error() {},
  }));
  api = page;
  const options = { pickerId: 'draft-1', maxWidth: 8192, maxHeight: 8192, locale: 'zh-CN' } as const;
  const settle = vi.fn();
  await act(async () => page.showNewDocumentPicker(options, settle));
  expect(node.querySelector('[aria-label="新建画板"]')).not.toBeNull();
  expect(() => page.showNewDocumentPicker({ ...options, pickerId: 'draft-2' }, settle)).toThrow();
  await expect(page.open('binding', 'resource')).rejects.toThrow();
  await act(async () => { await run('file.new'); });
  expect(editor.sessions).toHaveLength(0);
  expect(resource).not.toHaveBeenCalled();

  const create = node.querySelector<HTMLButtonElement>('button.primary')!;
  await act(async () => { create.click(); create.click(); });
  expect(settle).toHaveBeenCalledExactlyOnceWith({
    pickerId: options.pickerId, size: { width: 1920, height: 1080 },
  });
  expect(node.querySelector('[role="dialog"]')).toBeNull();
  expect(page.state().open).toBe(false);

  await act(async () => page.open('binding', 'resource'));
  expect(page.state().open).toBe(true);
  expect(resource).toHaveBeenCalledTimes(1);
  expect(() => page.showNewDocumentPicker(options, settle)).toThrow();
});

it('composition picker cancels via UI and revokes in-flight selections without late settlement', async () => {
  node = document.createElement('div');
  document.body.append(node);
  const page = await act(async () => mountPageSurface(node, {
    nativeVersion: 1,
    readResource: async () => ({ name: 'picked.wpnative', bytes: createNative(24, 16) }),
    save: async () => {}, export: async () => {}, confirm: async () => 0, dirty() {}, error() {},
  }));
  api = page;
  const options = { pickerId: 'draft-1', maxWidth: 8192, maxHeight: 8192 };
  const settle = vi.fn();
  expect(() => page.showNewDocumentPicker({ ...options, maxWidth: -1 }, settle)).toThrow();
  await act(async () => page.showNewDocumentPicker(options, settle));
  await act(async () => page.cancelNewDocumentPicker('stale'));
  expect(node.querySelector('[role="dialog"]')).not.toBeNull();
  const dimension = node.querySelector<HTMLInputElement>('input')!;
  await act(async () => {
    dimension.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    page.cancelNewDocumentPicker(options.pickerId);
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  expect(settle).not.toHaveBeenCalled();
  expect(node.querySelector('[role="dialog"]')).toBeNull();

  await act(async () => page.showNewDocumentPicker({ ...options, pickerId: 'draft-2' }, settle));
  await act(async () => node.querySelector<HTMLInputElement>('input')!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
  ));
  expect(settle).toHaveBeenCalledExactlyOnceWith({ pickerId: 'draft-2', size: null });
  expect(node.querySelector('[role="dialog"]')).toBeNull();

  await act(async () => page.showNewDocumentPicker({ ...options, pickerId: 'draft-3' }, settle));
  await act(async () => page.destroy());
  api = undefined;
  expect(settle).toHaveBeenCalledTimes(1);
  expect(node.childElementCount).toBe(0);
  expect(() => page.showNewDocumentPicker(options, settle)).toThrow();
});

it('composition picker and destroy cannot compete with an opening document', async () => {
  node = document.createElement('div');
  document.body.append(node);
  let release!: () => void;
  const page = await act(async () => mountPageSurface(node, {
    nativeVersion: 1,
    readResource: () => new Promise(resolve => {
      release = () => resolve({ name: 'picked.wpnative', bytes: createNative(24, 16) });
    }),
    save: async () => {}, export: async () => {}, confirm: async () => 0, dirty() {}, error() {},
  }));
  api = page;
  const opening = page.open('binding', 'resource');
  expect(() => page.showNewDocumentPicker({ pickerId: 'draft-1', maxWidth: 8192, maxHeight: 8192 }, vi.fn())).toThrow();
  expect(() => page.destroy()).toThrow();
  await act(async () => { release(); await opening; });
  expect(page.state().open).toBe(true);
});
