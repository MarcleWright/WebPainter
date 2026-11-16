/** Shared guards for local React handlers and the application listener. */
import {editor} from './editor';
import {ui, useApp} from './store';
import {chordFromEvent, keymap} from './shortcuts';
import {run} from './actions';
const composing = new WeakSet<EventTarget>();
type KeyLike = {key: string; isComposing?: boolean; keyCode?: number; target: EventTarget | null; nativeEvent?: KeyboardEvent; composedPath?: () => EventTarget[]};
/** Browsers retarget composed events to the shadow host outside its root. */
export function inputEventTarget(e: {target: EventTarget | null; composedPath?: () => EventTarget[]}): EventTarget | null {
  return e.composedPath?.()[0] ?? e.target;
}
export function isComposing(e: KeyLike): boolean {
  const n = e.nativeEvent ?? e;
  return !!n.isComposing || n.keyCode === 229 || ['Process', 'Dead', 'Unidentified'].includes(e.key) || !!inputEventTarget(n) && composing.has(inputEventTarget(n)!);
}
export function isTextTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
}
export function inputBlocked(): boolean {
  const s = editor.active;
  if (s && (!s.canEdit() || !!s.outputPending || !!s.closePending)) {ui.toast('info', 'This document is busy saving or closing.'); return true;}
  return false;
}
export const MODAL_VIEW = new Set(['view.zoomIn', 'view.zoomOut', 'view.fit', 'view.fill', 'view.100']);
export function installInputContext(target: EventTarget = window): () => void {
  const start = (e: CompositionEvent) => {const origin=inputEventTarget(e); if (origin) composing.add(origin);};
  const end = (e: CompositionEvent) => {const origin=inputEventTarget(e); if (origin) composing.delete(origin);};
  // Only save crosses a text control's stopPropagation; modal/menu boundaries still own input.
  const down = (e: KeyboardEvent) => {
    if (e.defaultPrevented || isComposing(e) || !isTextTarget(inputEventTarget(e))) return;
    if (useApp.getState().dialogs.length || document.querySelector('[role="dialog"],[role="menu"]')) return;
    if (keymap.lookup(chordFromEvent(e)) !== 'file.save') return;
    e.preventDefault(); e.stopPropagation();
    if (!e.repeat) void run('file.save');
  };
  target.addEventListener('compositionstart', start as EventListener, true);
  target.addEventListener('compositionend', end as EventListener, true);
  target.addEventListener('keydown', down as EventListener, true);
  return () => {
    target.removeEventListener('compositionstart', start as EventListener, true);
    target.removeEventListener('compositionend', end as EventListener, true);
    target.removeEventListener('keydown', down as EventListener, true);
  };
}
