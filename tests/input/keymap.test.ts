// @vitest-environment jsdom
import {afterEach, expect, it} from 'vitest';
import {Keymap, chordFromEvent} from '../../src/app/shortcuts';
afterEach(() => localStorage.clear());
it('logical letters, physical punctuation, Shift digits and exact modifiers', () => {
  expect(chordFromEvent(new KeyboardEvent('keydown',{key:'}',code:'BracketRight',ctrlKey:true,shiftKey:true}))).toBe('Ctrl+Shift+]');
  expect(chordFromEvent(new KeyboardEvent('keydown',{key:'+',code:'Equal',ctrlKey:true,shiftKey:true}))).toBe('Ctrl+Shift+=');
  expect(chordFromEvent(new KeyboardEvent('keydown',{key:'!',code:'Digit1',shiftKey:true}))).toBe('Shift+1');
  expect(chordFromEvent(new KeyboardEvent('keydown',{key:'j',code:'KeyK',ctrlKey:true}))).toBe('Ctrl+J');
  expect(chordFromEvent(new KeyboardEvent('keydown',{key:'j',ctrlKey:true,metaKey:true}))).toBe('');
});
it('atomic validation refuses malformed/user conflicts/reserved keys and preserves prior settings', () => {
  const k=new Keymap({}); k.set('file.save',['F6']);const before=k.exportJSON();
  for(const data of [[],{'file.save':[1]},{'file.save':['Ctrl+Banana']},{'file.save':['Alt+F4']},{'file.save':['F6'],'file.open':['F6']},{'file.save':['F7','F6'],'file.open':['F6']}]) {
    expect(()=>k.importJSON(JSON.stringify(data))).toThrow();expect(k.exportJSON()).toBe(before);expect(k.lookup('F6')).toBe('file.save');
  }
  k.set('file.open',['Ctrl+S']);expect(k.lookup('Ctrl+S')).toBe('file.open');expect(k.bindingsFor('file.save')).toEqual(['F6']);
  k.set('file.save',[]); expect(k.bindingsFor('file.save')).toEqual([]);
  expect(new Keymap(JSON.parse(k.exportJSON())).bindingsFor('file.save')).toEqual([]);
});
it('derived groups/digits/held are visible conflicts; reassignment atomically releases every default member',()=>{
 const k=new Keymap({});expect(k.conflicts('B')).toContain('tool:pencil');expect(k.binding('Shift+B')?.kind).toBe('cycle');
 k.set('file.open',['Shift+B']);expect(k.binding('Shift+B')?.kind).toBe('command');expect(k.binding('B')?.kind).toBe('toolGroup');
 k.reassign('file.save','B');expect(k.binding('Shift+B')?.ids).toEqual(['file.open']);expect(k.bindingsFor('tool:brush')).toEqual([]);expect(k.bindingsFor('tool:pencil')).toEqual([]);
 expect(k.lookup('Space')).toBe('input.pan');expect(k.lookup('1')).toBe('input.opacity');k.reassign('file.open','Space');expect(k.bindingsFor('input.pan')).toEqual([]);
 k.set('file.save',['1']); expect(k.lookup('1')).toBe('file.save');expect(k.bindingsFor('input.opacity')).not.toContain('1');
});
it('single reset refuses collision, reset all restores validated defaults; explicit B stays exact',()=>{
 const k=new Keymap({});k.set('file.save',['F6']);k.set('file.open',['Ctrl+S']);expect(()=>k.reset('file.save')).toThrow();expect(k.lookup('F6')).toBe('file.save');
 k.reset();expect(k.lookup('Ctrl+S')).toBe('file.save');k.set('tool:pencil',['B']);expect(k.binding('B')?.kind).toBe('exactTool');expect(k.bindingsFor('tool:brush')).toEqual([]);
});
it('context copy legacy overrides including empty arrays persist without reviving defaults; reset all opts in',()=>{
 for(const old of [{'layer.duplicate':[]},{'layer.viaCopy':['F6']},{'file.open':['Ctrl+J']}] as Record<string,string[]>[]) {
  const k=new Keymap(old);expect(k.bindingsFor('layer.copyContext')).toEqual([]);const next=new Keymap(JSON.parse(k.exportJSON()));expect(next.bindingsFor('layer.copyContext')).toEqual([]);
  expect(JSON.parse(k.exportJSON())['layer.copyContext']).toEqual([]);k.reset();expect(k.lookup('Ctrl+J')).toBe('layer.copyContext');
 }
 const k=new Keymap({});k.set('edit.fillForeground',[]);expect(k.bindingsFor('edit.fillForeground')).toEqual([]);k.set('edit.fillBackground',['F8']);expect(k.bindingsFor('edit.fillBackground')).toEqual(['F8']);
});
it('failed storage write preserves effective map and emits no partial update',()=>{
 const k=new Keymap({});k.set('file.save',['F6']);const before=k.exportJSON();let notifications=0;k.on(()=>notifications++);
 const original=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('quota');};
 try {expect(()=>k.importJSON('{"file.save":["F7"]}')).toThrow('quota');expect(k.exportJSON()).toBe(before);expect(k.lookup('F6')).toBe('file.save');expect(notifications).toBe(0);}finally{Storage.prototype.setItem=original;}
});

it('resolves Web host defaults and reserves browser tab/window chords only in the Web profile', () => {
  const keymap = new Keymap({});
  expect(keymap.lookup('Ctrl+T')).toBe('edit.freeTransform');
  expect(keymap.lookup('Ctrl+Shift+N')).toBe('layer.new');
  const restore = keymap.installHostProfile('web');
  expect(keymap.bindingsFor('edit.freeTransform')).toEqual(['Ctrl+Shift+F']);
  expect(keymap.bindingsFor('layer.new')).toEqual(['Shift+F2']);
  expect(keymap.lookup('Ctrl+Shift+F')).toBe('edit.freeTransform');
  expect(keymap.lookup('Shift+F2')).toBe('layer.new');
  expect(keymap.lookup('Ctrl+F')).toBe('edit.commandPalette');
  for (const chord of ['Ctrl+T','Ctrl+Shift+T','Ctrl+N','Ctrl+Shift+N','Ctrl+W','Ctrl+Shift+W','Ctrl+F4','Ctrl+Tab','Ctrl+Shift+Tab','Ctrl+PageUp','Ctrl+PageDown']) {
    expect(keymap.lookup(chord)).toBeUndefined();
    expect(keymap.conflicts(chord)).toEqual([]);
  }
  keymap.rebuild();
  expect(keymap.lookup('Shift+F2')).toBe('layer.new');
  restore();
  restore();
  expect(keymap.lookup('Ctrl+T')).toBe('edit.freeTransform');
  expect(keymap.lookup('Ctrl+Shift+N')).toBe('layer.new');
  expect(keymap.lookup('Ctrl+Shift+F')).toBeUndefined();
  const releaseDesktop = keymap.installHostProfile('desktop');
  expect(keymap.lookup('Ctrl+Shift+N')).toBe('layer.new');
  releaseDesktop();
  const releaseSecondWeb = keymap.installHostProfile('web');
  restore(); // A repeated cleanup from the first mount must not undo the second.
  expect(keymap.lookup('Shift+F2')).toBe('layer.new');
  releaseSecondWeb();
  expect(keymap.lookup('Ctrl+Shift+N')).toBe('layer.new');
});

it('keeps stored overrides reversible and suppresses reserved entries without reviving defaults', () => {
  const keymap = new Keymap({});
  keymap.set('edit.freeTransform', ['Ctrl+T']);
  keymap.set('layer.new', ['Ctrl+Shift+N','F8']);
  keymap.set('file.open', ['Ctrl+Shift+F']);
  const stored = localStorage.getItem('celenne.shortcuts.v1');
  const restore = keymap.installHostProfile('web');
  expect(keymap.bindingsFor('edit.freeTransform')).toEqual([]);
  expect(keymap.bindingsFor('layer.new')).toEqual(['F8']);
  expect(keymap.lookup('Ctrl+Shift+F')).toBe('file.open');
  expect(localStorage.getItem('celenne.shortcuts.v1')).toBe(stored);
  expect(JSON.parse(keymap.exportJSON())).toEqual(JSON.parse(stored!));
  expect(() => keymap.set('file.open', ['Ctrl+T'])).toThrow(/Shortcut conflict/);
  expect(localStorage.getItem('celenne.shortcuts.v1')).toBe(stored);
  const overrides = JSON.parse(keymap.exportJSON());
  keymap.importJSON(JSON.stringify({...overrides, 'file.open':['Ctrl+W','Ctrl+Shift+F']}));
  expect(keymap.bindingsFor('file.open')).toEqual(['Ctrl+Shift+F']);
  expect(JSON.parse(keymap.exportJSON())['file.open']).toEqual(['Ctrl+W','Ctrl+Shift+F']);
  keymap.reassign('layer.new','F9');
  expect(keymap.bindingsFor('layer.new')).toEqual(['F8','F9']);
  restore();
  expect(keymap.bindingsFor('edit.freeTransform')).toEqual(['Ctrl+T']);
  expect(keymap.bindingsFor('layer.new')).toEqual(['Ctrl+Shift+N','F8','F9']);
  expect(keymap.bindingsFor('file.open')).toEqual(['Ctrl+W','Ctrl+Shift+F']);
});

it('does not persist or remove another host default when reassigning or editing Web shortcuts', () => {
  const keymap = new Keymap({});
  const restore = keymap.installHostProfile('web');

  keymap.reassign('edit.undo', 'Shift+F2');
  expect(keymap.lookup('Shift+F2')).toBe('edit.undo');
  expect(keymap.bindingsFor('layer.new')).toEqual([]);
  keymap.reassign('edit.freeTransform', 'F8');
  expect(keymap.bindingsFor('edit.freeTransform')).toEqual(['F8']);
  keymap.remove('edit.freeTransform', 'F8');
  expect(keymap.bindingsFor('edit.freeTransform')).toEqual([]);

  const preferences = JSON.parse(localStorage.getItem('celenne.shortcuts.v1')!);
  expect(preferences['layer.new']).toEqual(['Ctrl+Shift+N']);
  expect(preferences['edit.freeTransform']).toEqual(['Ctrl+T']);
  restore();
  expect(keymap.lookup('Ctrl+Shift+N')).toBe('layer.new');
  expect(keymap.lookup('Ctrl+T')).toBe('edit.freeTransform');
  expect(keymap.bindingsFor('edit.undo')).toEqual(['Ctrl+Z','Shift+F2']);
});
