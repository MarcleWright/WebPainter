/** Shared guards for local React handlers and the application listener. */
import {editor} from './editor';
import {ui, useApp} from './store';
import {chordFromEvent, keymap} from './shortcuts';
import {run} from './actions';
const composing = new WeakSet<EventTarget>();
type KeyLike = {key: string; isComposing?: boolean; keyCode?: number; target: EventTarget | null; nativeEvent?: KeyboardEvent};
export function isComposing(e: KeyLike): boolean {
  const n = e.nativeEvent ?? e;
  return !!n.isComposing || n.keyCode === 229 || ['Process', 'Dead', 'Unidentified'].includes(e.key) || !!e.target && composing.has(e.target);
}
export function isTextTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
}
export function inputBlocked(): boolean {
  const s = editor.active;
  if (s && !s.canEdit()) {ui.toast('info', 'This document is busy saving or closing.'); return true;}
  return false;
}
export const MODAL_VIEW = new Set(['view.zoomIn', 'view.zoomOut', 'view.fit', 'view.fill', 'view.100']);
export function installInputContext(): () => void {
  const start = (e: CompositionEvent) => {if (e.target) composing.add(e.target);};
  const end = (e: CompositionEvent) => {if (e.target) composing.delete(e.target);};
  // Only save crosses a text control's stopPropagation; modal/menu boundaries still own input.
  const down = (e: KeyboardEvent) => {
    if (e.defaultPrevented || isComposing(e) || !isTextTarget(e.target)) return;
    if (useApp.getState().dialogs.length || document.querySelector('[role="dialog"],[role="menu"]')) return;
    if (keymap.lookup(chordFromEvent(e)) !== 'file.save') return;
    e.preventDefault(); e.stopPropagation();
    if (!e.repeat) void run('file.save');
  };
  window.addEventListener('compositionstart', start, true);
  window.addEventListener('compositionend', end, true);
  window.addEventListener('keydown', down, true);
  return () => {
    window.removeEventListener('compositionstart', start, true);
    window.removeEventListener('compositionend', end, true);
    window.removeEventListener('keydown', down, true);
  };
}
