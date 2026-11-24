import type { MouseEvent, PointerEvent } from 'react';
import { access } from '../app/access';
import { editor } from '../app/editor';
import { inputPointerBusy, panHeld, setInputPointerBusy } from '../app/heldPan';
import type { DocumentSession } from '../app/session';
import { ui, useApp } from '../app/store';
import { BRUSH_HARDNESS_MAX_PERCENT, clampBrushHardness, clampBrushSize } from '../brush/controls';
import type { BrushSettings } from '../tools/toolTypes';

const RIGHT_BUTTON = 2;
const dialogOrMenu = '[role="dialog"], [role="menu"]';
type BrushTool = 'brush' | 'eraser' | 'pencil';
type Gesture = {
  session: DocumentSession;
  doc: DocumentSession['doc'];
  tool: BrushTool;
  pointer: number;
  element: Element;
  zoom: number;
  startSize: number;
  startHardness: number;
  startX: number;
  startY: number;
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  unsubscribe?: () => void;
};

function toolSupportsResize(tool: string): tool is BrushTool {
  return tool === 'brush' || tool === 'pencil'
    || (tool === 'eraser' && useApp.getState().toolOptions.eraser.mode === 'brush');
}

export class BrushResize {
  private gesture: Gesture | null = null;
  // Keep consuming this pointer after right is released if another button is still held.
  private sequence: Pick<Gesture, 'pointer' | 'element'> | null = null;
  // A retired mouse pointer can still send late move/up events after losing capture.
  // A fresh down for that same ID starts a new pointer sequence.
  private retiredPointer: number | null = null;
  // Native contextmenu may follow pointerup, with Alt already released.
  private menuPointer: number | null = null;

  constructor(private redraw: () => void) {}

  get active(): boolean { return this.gesture !== null; }

  down(e: PointerEvent, busy: boolean): boolean {
    // A mouse pointerdown starts a fresh button sequence. Chords arrive on pointermove.
    if (this.sequence?.pointer === e.pointerId) this.retireSequence();
    if (this.sequence) return this.active;
    if (this.retiredPointer === e.pointerId) this.retiredPointer = null;
    if (e.pointerType === 'mouse' || this.menuPointer === e.pointerId) this.menuPointer = null;
    const s = editor.active;
    const tool = editor.currentToolId;
    if (busy || inputPointerBusy() || !s || panHeld(s) || e.pointerType !== 'mouse'
      || !e.altKey || e.button !== RIGHT_BUTTON || e.buttons !== RIGHT_BUTTON
      || !toolSupportsResize(tool) || !this.canResize(s, tool)) return false;
    const rect = e.currentTarget.getBoundingClientRect();
    const { size, hardness } = useApp.getState().brush;
    const anchorX = e.clientX - rect.left;
    const anchorY = e.clientY - rect.top;
    const gesture: Gesture = {
      session: s, doc: s.doc, tool, pointer: e.pointerId, element: e.currentTarget, zoom: s.view.zoom,
      startSize: clampBrushSize(size), startHardness: clampBrushHardness(hardness), startX: e.clientX, startY: e.clientY,
      anchorX, anchorY, x: anchorX, y: anchorY,
    };
    this.sequence = { pointer: e.pointerId, element: e.currentTarget };
    this.menuPointer = e.pointerId;
    this.gesture = gesture;
    gesture.unsubscribe = s.on(this.validate);
    e.currentTarget.setPointerCapture(e.pointerId);
    setInputPointerBusy(true);
    this.redraw();
    return true;
  }

  move(e: PointerEvent, busy: boolean): boolean {
    if (!this.sequence) return this.retiredPointer === e.pointerId && (e.buttons !== 0 || busy);
    if (e.pointerId !== this.sequence.pointer) return this.active;
    if ((e.buttons & RIGHT_BUTTON) === 0) this.stopAdjusting();
    if (e.buttons === 0) this.retireSequence();
    this.validate();
    const g = this.gesture;
    if (!g) return true;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    const current = useApp.getState().brush;
    const size = clampBrushSize(g.startSize + 2 * dx / g.zoom);
    const hardness = clampBrushHardness(g.startHardness + dy / 200);
    const settings: Partial<BrushSettings> = {};
    if (g.x !== g.anchorX + dx && size !== current.size) settings.size = size;
    if (g.tool !== 'pencil' && g.y !== g.anchorY + dy && hardness !== current.hardness) settings.hardness = hardness;
    g.x = g.anchorX + dx;
    g.y = g.anchorY + dy;
    if (settings.size !== undefined || settings.hardness !== undefined) ui.setBrush(settings);
    this.redraw();
    return true;
  }

  up(e: PointerEvent): boolean {
    if (!this.sequence) return this.retiredPointer === e.pointerId;
    if (e.pointerId !== this.sequence.pointer) return this.active;
    if ((e.buttons & RIGHT_BUTTON) === 0) this.stopAdjusting();
    if (e.buttons === 0) this.retireSequence();
    return true;
  }

  cancel(e: PointerEvent): boolean {
    if (this.retiredPointer === e.pointerId) return true;
    if (!this.sequence || e.pointerId !== this.sequence.pointer) return false;
    this.retireSequence();
    return true;
  }

  suppressMenu(e: MouseEvent): boolean {
    if (this.menuPointer === null || e.button !== RIGHT_BUTTON) return false;
    const pointer = (e.nativeEvent as globalThis.PointerEvent).pointerId;
    return pointer === undefined || pointer === 0 || pointer === this.menuPointer;
  }

  listen(): () => void {
    const escape = (e: KeyboardEvent) => {
      if (!this.gesture || e.key !== 'Escape') return;
      e.preventDefault();
      this.retireSequence();
    };
    const focus = (e: FocusEvent) => {
      if (this.sequence && e.target instanceof Element && !this.sequence.element.contains(e.target)) this.retireSequence();
    };
    const unsubscribe = useApp.subscribe(this.validate);
    window.addEventListener('keydown', escape, true);
    window.addEventListener('blur', this.retireSequence);
    window.addEventListener('focusin', focus, true);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('blur', this.retireSequence);
      window.removeEventListener('focusin', focus, true);
      this.retireSequence();
      this.retiredPointer = null;
      this.menuPointer = null;
    };
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number): boolean {
    const gesture = this.gesture;
    if (!gesture) return false;
    const brush = useApp.getState().brush;
    const size = clampBrushSize(brush.size);
    const { anchorX, anchorY } = gesture;
    const radius = size * gesture.session.view.zoom / 2;
    const effectiveHardness = gesture.tool === 'pencil' ? 1 : clampBrushHardness(brush.hardness);
    g.save();
    g.beginPath();
    g.arc(anchorX, anchorY, radius, 0, Math.PI * 2);
    const gradient = g.createRadialGradient(anchorX, anchorY, 0, anchorX, anchorY, radius);
    gradient.addColorStop(effectiveHardness, 'rgba(240,64,54,0.55)');
    gradient.addColorStop(1, effectiveHardness === 1 ? 'rgba(240,64,54,0.55)' : 'rgba(240,64,54,0)');
    g.fillStyle = gradient;
    g.fill();
    g.strokeStyle = '#181818';
    g.lineWidth = 3;
    g.stroke();
    g.strokeStyle = '#fff';
    g.lineWidth = 1;
    g.stroke();

    const label = `${Number(size.toFixed(1))} px · Hardness ${Math.round(effectiveHardness * BRUSH_HARDNESS_MAX_PERCENT)}%${gesture.tool === 'pencil' ? ' (fixed)' : ''}`;
    g.font = '12px system-ui, sans-serif';
    const width = g.measureText(label).width + 16;
    const x = Math.max(0, Math.min(w - width, gesture.x + 16));
    const y = Math.max(0, Math.min(h - 24, gesture.y + 16));
    g.fillStyle = '#242424';
    g.fillRect(x, y, width, 24);
    g.fillStyle = '#fff';
    g.textBaseline = 'middle';
    g.fillText(label, x + 8, y + 12);
    g.restore();
    return true;
  }

  private canResize(s: DocumentSession, tool: BrushTool): boolean {
    return s.canEdit() && s.mode.kind === 'none' && !editor.currentTool?.busy?.()
      && access(`tool:${tool}`).enabled && !useApp.getState().dialogs.length && !document.querySelector(dialogOrMenu);
  }

  private validate = (): void => {
    const g = this.gesture;
    if (g && (editor.active !== g.session || g.session.doc !== g.doc || editor.currentToolId !== g.tool
      || !toolSupportsResize(g.tool) || !this.canResize(g.session, g.tool))) this.retireSequence();
  };

  private stopAdjusting = (): void => {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;
    g.unsubscribe?.();
    setInputPointerBusy(false);
    this.redraw();
  };

  private retireSequence = (): void => {
    const sequence = this.sequence;
    if (!sequence) return;
    this.sequence = null;
    this.retiredPointer = sequence.pointer;
    this.stopAdjusting();
    if (sequence.element.hasPointerCapture(sequence.pointer)) sequence.element.releasePointerCapture(sequence.pointer);
  };
}
