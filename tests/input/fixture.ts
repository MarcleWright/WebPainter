import {editor} from '../../src/app/editor';
import {createNative, decodeNative} from '../../src/document/native';
import {registerTools} from '../../src/tools/registry';
import type {ToolHost} from '../../src/tools/tool';

/** Real session/tools; UI tests mount the production listeners separately. */
export function inputSession() {
  registerTools();
  const session = editor.addDocument(decodeNative(createNative(16, 12)).doc);
  const host: ToolHost = {editor, session, redraw() {}, setCursor() {}, viewportSize: () => ({w: 320, h: 240})};
  editor.hostFactory = () => host;
  return {session, host};
}

export function key(target: EventTarget, value: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {key: value, bubbles: true, cancelable: true, ...init});
  target.dispatchEvent(event);
  return event;
}

export function clearInputSessions() {
  editor.hostFactory = null;
  for (const s of [...editor.sessions]) { s.editProtected = false; editor.removeSession(s.id); }
}

