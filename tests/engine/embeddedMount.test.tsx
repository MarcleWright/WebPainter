// @vitest-environment jsdom
import {act,useEffect} from 'react';
import {createPortal} from 'react-dom';
import {afterEach,it,expect,vi} from 'vitest';
import {mountDirect,mountFrame,mountPageSurface} from '../../src/embedded/mount';
import {NumberField,Slider} from '../../src/ui/controls';
import {portalTarget,keyboardTarget} from '../../src/ui/surface';
import {editor} from '../../src/app/editor';
import {run} from '../../src/app/actions';
import {createNative,encodeNative} from '../../src/document/native';
import {SetLayerPropsCommand} from '../../src/commands/layerCommands';
import {ui} from '../../src/app/store';
const mounts = vi.hoisted(() => ({ released: 0 }));
vi.mock('../../src/embedded/checkpoint-output',()=>({
  checkpointOutput: async (document: Parameters<typeof encodeNative>[0]) => ({ bytes: encodeNative(document) }),
}));
vi.mock('../../src/ui/App',()=>({App:()=>{
  useEffect(()=>()=>{mounts.released++;},[]);
  return <><NumberField label="Number" value={100} onChange={v=>void run('layer.setOpacity',{value:v/100})}/>{createPortal(<Slider label="Slider" value={100} onChange={v=>void run('layer.setOpacity',{value:v/100})}/>,portalTarget())}</>;
}}));
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
  await act(async () => {
    const input = node.querySelector('input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r', bubbles: true }));
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    create.click();
    create.click();
  });
  expect(settle).toHaveBeenCalledExactlyOnceWith({
    pickerId: options.pickerId, size: { width: 1920, height: 1080 },
  });
  expect(node.querySelector('[role="dialog"]')).toBeNull();
  expect(page.state().open).toBe(false);

  await act(async () => page.open('binding', 'resource'));
  expect(page.state().open).toBe(true);
  expect(resource).toHaveBeenCalledTimes(1);
  expect(page.state().checkpointReady).toBe(true);
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


it('composition close retains live owners on failed save and releases them before warm reopen', async () => {
  node = document.createElement('div');
  document.body.append(node);
  const resource = vi.fn(async (_op: unknown, token: string) => ({
    name: 'drawing.wpnative', bytes: createNative(token === 'one' ? 24 : 32, 16),
  }));
  const saves: Array<{ started: Promise<void>; begin: () => void; result: Promise<void>; finish: (success: boolean) => void }> = [];
  const makeSave = () => {
    let begin!: () => void, finish!: (success: boolean) => void;
    const started = new Promise<void>(resolve => { begin = resolve; });
    const result = new Promise<void>((resolve, reject) => {
      finish = success => { if (success) resolve(); else reject(Error('save unavailable')); };
    });
    const save = { started, begin, result, finish };
    saves.push(save);
    return save;
  };
  const first = makeSave(), second = makeSave();
  const page = await act(async () => mountPageSurface(node, {
    nativeVersion: 1, readResource: resource, async save() {
      const save = saves.shift()!;
      save.begin();
      await save.result;
    },
    export: async () => {}, confirm: async () => 0, dirty() {}, error() {},
  }));
  api = page;
  await act(async () => page.open('old-binding', 'one'));
  const old = editor.active!, oldGeneration = page.state().generation;
  const tool = editor.tool('move');
  const dispose = vi.spyOn(old.engine, 'dispose');
  const oldStyle = node.querySelector('style');
  const oldClipboard = { kind: 'layers' as const, layers: [old.activeLayer()!], sourceDocId: old.doc.id };
  editor.clipboard = oldClipboard;
  const previousReleases = mounts.released;
  const diagnostics = window as Window & { __celenneViewport?: object; __celenneRenderer?: string; __celennePanelOpen?: object };
  diagnostics.__celenneViewport = {};
  diagnostics.__celenneRenderer = 'first';
  diagnostics.__celennePanelOpen = {};
  await act(async () => {
    const layer = old.activeLayer()!;
    old.push(new SetLayerPropsCommand('Opacity', layer.id, { opacity: 1 }, { opacity: .5 }));
    ui.openDialog('docInfo');
    ui.progress('Old drawing');
    ui.toast('info', 'Old drawing', undefined, 0);
  });

  const input = (start: boolean) => {
    const boundary = node.querySelector('#wp-root')!;
    const props = { bubbles: true, composed: true };
    const pointer = new MouseEvent(start ? 'pointerdown' : 'pointerup', props);
    Object.defineProperty(pointer, 'pointerId', { value: 13 });
    boundary.dispatchEvent(pointer);
    boundary.dispatchEvent(new KeyboardEvent(start ? 'keydown' : 'keyup', { ...props, code: 'KeyR', key: 'r' }));
    boundary.dispatchEvent(new CompositionEvent(start ? 'compositionstart' : 'compositionend', props));
  };
  await act(async () => {
    const close = page.requestClose();
    await first.started;
    input(true);
    first.finish(false);
    expect(await close).toBe(false);
  });
  expect(page.state()).toMatchObject({ open: true, generation: oldGeneration, dirty: true, checkpointReady: false });
  expect(editor.active).toBe(old);
  expect(dispose).not.toHaveBeenCalled();
  expect(editor.clipboard).toBe(oldClipboard);
  expect(editor.tool('move')).toBe(tool);
  expect(mounts.released).toBe(previousReleases);
  expect(ui.get()).toMatchObject({ dialogs: [{ type: 'docInfo' }], progress: [{ label: 'Old drawing' }], toasts: [{ message: 'Old drawing' }] });
  expect(diagnostics.__celenneViewport).toBeDefined();

  await act(async () => { input(false); });
  expect(page.state().checkpointReady).toBe(true);
  await act(async () => {
    const close = page.requestClose(), duplicate = page.requestClose();
    await second.started;
    input(true);  // No release events follow this final closing cutoff.
    second.finish(true);
    expect(await duplicate).toBe(true);
    expect(await close).toBe(true);
    expect(page.state().open).toBe(false);
    expect(mounts.released).toBe(previousReleases + 1);
    expect(node.querySelector('input')).toBeNull();
    expect(node.querySelector('style')).toBe(oldStyle);
    expect(editor.clipboard).toBeNull();
    expect(ui.get()).toMatchObject({ dialogs: [], progress: [], toasts: [] });
    expect(diagnostics.__celenneViewport).toBeUndefined();
    expect(diagnostics.__celenneRenderer).toBeUndefined();
    expect(diagnostics.__celennePanelOpen).toBeUndefined();
    await page.open('new-binding', 'two');
  });
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(editor.active).not.toBe(old);
  expect(editor.tool('move')).not.toBe(tool);
  expect(editor.active!.doc.width).toBe(32);
  expect(page.state()).toMatchObject({ open: true, dirty: false, checkpointReady: true, hasUncommittedChanges: false });
  expect(page.state().generation).not.toBe(oldGeneration);
  expect(resource.mock.calls.map(([op, token]) => [(op as { binding: string }).binding, token])).toEqual([
    ['old-binding', 'one'], ['new-binding', 'two'],
  ]);
});
