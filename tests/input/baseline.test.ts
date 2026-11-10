// @vitest-environment jsdom
import {afterEach, expect, it} from 'vitest';
import {inputSession, clearInputSessions} from './fixture';
import {chordFromEvent, keymap} from '../../src/app/shortcuts';
import {editor} from '../../src/app/editor';

afterEach(clearInputSessions);
it('registered layer arrange binding and real brush are available to event fixtures', () => {
  inputSession();
  editor.setTool('brush');
  const e = new KeyboardEvent('keydown', {key: ']', code: 'BracketRight', ctrlKey: true});
  expect(keymap.lookup(chordFromEvent(e))).toBe('layer.arrange.forward');
  expect(editor.currentTool?.id).toBe('brush');
});
