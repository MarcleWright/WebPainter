import { editor } from './editor';
import { inputEventTarget, isComposing, isTextTarget } from './inputContext';
import type { DocumentSession } from './session';
import { useApp } from './store';

type AltGesture = {
  code: string;
  target: HTMLElement;
  session: DocumentSession;
  document: DocumentSession['doc'];
  viewport: HTMLElement | null;
  interrupted: boolean;
};

let root: HTMLElement | null = null;
let alt: AltGesture | null = null;
let toastOwner: {session: DocumentSession; document: DocumentSession['doc']} | null = null;

export function enableWebCanvasInput(owner: HTMLElement): () => void {
  root = owner;
  return () => {
    if (root === owner) {
      resetWebCanvasInput();
      root = null;
    }
  };
}

export function resetWebCanvasAlt(): void {
  alt = null;
}

export function resetWebCanvasInput(): void {
  resetWebCanvasAlt();
  toastOwner = null;
}

export function observeWebCanvasPointer(event: PointerEvent): void {
  resetWebCanvasInput();
  const session = editor.active;
  const target = inputEventTarget(event);
  if (session && target instanceof Element && root?.contains(target) && target.closest('[data-wp-notifications]')) {
    toastOwner = {session, document: session.doc};
  }
}

export function observeWebCanvasFocus(event: FocusEvent): void {
  resetWebCanvasAlt();
  const target = inputEventTarget(event);
  if (!(target instanceof Element) || !target.closest('[data-wp-notifications]')) toastOwner = null;
}

export function webControlOwnsActivation(event: KeyboardEvent): boolean {
  const target = inputEventTarget(event);
  return (event.key === ' ' || event.key === 'Enter') && !event.altKey && !hasOtherModifiers(event)
    && target instanceof HTMLElement && !!root?.contains(target)
    && !!target.closest('button, a[href], [role="button"]');
}

function ownsFocus(target: HTMLElement, session: DocumentSession): boolean {
  const ownerDocument = target.ownerDocument;
  const knownToastFallback = target === ownerDocument.body && toastOwner?.session === session && toastOwner.document === session.doc;
  return (knownToastFallback || !!root?.contains(target)) && ownerDocument.activeElement === target
    && ownerDocument.hasFocus() && !useApp.getState().dialogs.length
    && !ownerDocument.querySelector('[role="dialog"],[role="menu"]');
}

function hasOtherModifiers(event: KeyboardEvent | WheelEvent): boolean {
  return event.ctrlKey || event.shiftKey || event.metaKey || event.getModifierState('AltGraph');
}

export function captureWebCanvasKeyDown(event: KeyboardEvent): void {
  const previous = alt;
  resetWebCanvasAlt();
  if (!root) return;
  if (event.key !== 'Alt') {toastOwner = null; return;}
  const target = inputEventTarget(event), session = editor.active;
  if (!['AltLeft', 'AltRight'].includes(event.code)
    || !event.altKey || hasOtherModifiers(event) || isComposing(event)
    || !(target instanceof HTMLElement) || isTextTarget(target) || !session || !ownsFocus(target, session)) return;

  if (previous) {
    if (event.repeat && previous.code === event.code && previous.target === target
      && previous.session === session && previous.document === session.doc) alt = previous;
    return;
  }
  if (!event.repeat) alt = { code: event.code, target, session, document: session.doc, viewport: null, interrupted: false };
}

export function interruptWebCanvasBareAlt(): void {
  if (alt) alt.interrupted = true;
}

export function noteWebCanvasAltZoom(event: WheelEvent, viewport: HTMLElement, session: DocumentSession): void {
  if (!alt || !root?.contains(viewport) || alt.session !== session || alt.document !== session.doc
    || !event.altKey || hasOtherModifiers(event) || !event.deltaY
    || isTextTarget(inputEventTarget(event)) || !ownsFocus(alt.target, session)) return;
  alt.viewport = viewport;
}

export function finishWebCanvasAlt(event: KeyboardEvent): void {
  const gesture = alt;
  resetWebCanvasAlt();
  if (!gesture || event.key !== 'Alt' || event.code !== gesture.code || !event.cancelable
    || hasOtherModifiers(event) || isComposing(event) || inputEventTarget(event) !== gesture.target
    || isTextTarget(gesture.target) || !ownsFocus(gesture.target, gesture.session)
    || editor.active !== gesture.session || gesture.session.doc !== gesture.document) return;

  if (!gesture.viewport) {
    if (!gesture.interrupted) event.preventDefault();
    return;
  }
  if (!root?.contains(gesture.viewport)) return;
  event.preventDefault();
  toastOwner = null;
  if (gesture.target !== gesture.viewport) gesture.viewport.focus({preventScroll:true});
}
