/** Held pan is a view override, never a normal setTool/deactivate round trip. */
import {editor} from './editor';
import type {DocumentSession} from './session';
import type {ToolId} from '../tools/toolTypes';
import {useApp} from './store';
let held: {session: DocumentSession; doc: object; tool: ToolId; key: string} | null = null;
let pointerBusy = false;
export function setInputPointerBusy(value: boolean) {pointerBusy = value;}
export function panHeld(s: DocumentSession): boolean {return !!held && held.session === s && held.doc === s.doc && held.tool === useApp.getState().tool;}
export function beginPan(e: KeyboardEvent): void {
  if (held || e.repeat || pointerBusy || editor.currentTool?.busy?.() || !editor.active) return;
  held = {session: editor.active, doc: editor.active.doc, tool: useApp.getState().tool, key: e.code || e.key};
}
export function releasePan(e: KeyboardEvent): void {if (held?.key === (e.code || e.key)) held = null;}
export function invalidatePan(): void {
  held = null;
  // Only the temporary view drag is discarded. Content interactions are untouched.
  window.dispatchEvent(new Event('celenne:clearHeldPan'));
}
