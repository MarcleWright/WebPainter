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
