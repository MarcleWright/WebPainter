import { editor } from './editor';
import { inputEventTarget, isComposing, isTextTarget } from './inputContext';
import type { DocumentSession } from './session';
import { useApp } from './store';

type AltGesture = {
  code: string;
  target: HTMLElement;
  session: DocumentSession;
  document: DocumentSession['doc'];
  zoomed: boolean;
};

let root: HTMLElement | null = null;
let alt: AltGesture | null = null;

export function enableWebCanvasInput(owner: HTMLElement): () => void {
  root = owner;
  return () => {
    if (root === owner) {
      resetWebCanvasAlt();
      root = null;
    }
  };
}

export function resetWebCanvasAlt(): void {
  alt = null;
}

function ownsFocus(target: HTMLElement): boolean {
  const ownerDocument = target.ownerDocument;
  return !!root?.contains(target) && ownerDocument.activeElement === target
    && ownerDocument.hasFocus() && !useApp.getState().dialogs.length
    && !ownerDocument.querySelector('[role="dialog"],[role="menu"]');
}

function hasOtherModifiers(event: KeyboardEvent | WheelEvent): boolean {
  return event.ctrlKey || event.shiftKey || event.metaKey || event.getModifierState('AltGraph');
}

export function captureWebCanvasKeyDown(event: KeyboardEvent): void {
  const previous = alt;
  resetWebCanvasAlt();
  const target = inputEventTarget(event), session = editor.active;
  if (!root || event.key !== 'Alt' || !['AltLeft', 'AltRight'].includes(event.code)
    || !event.altKey || hasOtherModifiers(event) || isComposing(event)
    || !(target instanceof HTMLElement) || isTextTarget(target) || !ownsFocus(target) || !session) return;

  if (previous) {
    if (event.repeat && previous.code === event.code && previous.target === target
      && previous.session === session && previous.document === session.doc) alt = previous;
    return;
  }
  if (!event.repeat) alt = { code: event.code, target, session, document: session.doc, zoomed: false };
}

export function noteWebCanvasAltZoom(event: WheelEvent, viewport: HTMLElement, session: DocumentSession): void {
  if (!alt || alt.target !== viewport || alt.session !== session || alt.document !== session.doc
    || !event.altKey || hasOtherModifiers(event) || !event.deltaY
    || isTextTarget(inputEventTarget(event)) || !ownsFocus(viewport)) return;
  alt.zoomed = true;
}

export function finishWebCanvasAlt(event: KeyboardEvent): void {
  const gesture = alt;
  resetWebCanvasAlt();
  if (!gesture?.zoomed || event.key !== 'Alt' || event.code !== gesture.code || !event.cancelable
    || hasOtherModifiers(event) || isComposing(event) || inputEventTarget(event) !== gesture.target
    || !ownsFocus(gesture.target) || editor.active !== gesture.session || gesture.session.doc !== gesture.document) return;
  event.preventDefault();
}
