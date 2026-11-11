/** Application input dispatch. Local owners run only for explicitly claimed chords. */
import {editor} from './editor';
import {action, run} from './actions';
import {access} from './access';
import {useApp, ui} from './store';
import {chordFromEvent, keymap} from './shortcuts';
import {isComposing,isTextTarget,inputBlocked,installInputContext} from './inputContext';
import {beginPan,releasePan,invalidatePan,inputPointerRevision,inputPointerBusy,onInputPointerStart} from './heldPan';
import type {ToolId} from '../tools/toolTypes';
const BRUSH_TOOLS = new Set<ToolId>(['brush','pencil','eraser','bgEraser','cloneStamp','patternStamp','healing','spotHealing','remove','colorReplace','mixerBrush','blur','sharpen','smudge','dodge','burn','sponge','quickSelect']);
let pending: {digits: string; flow: boolean; timer: ReturnType<typeof setTimeout>; cancelSession: () => void} | null = null;
function cancelDigits() {if (pending) {clearTimeout(pending.timer);pending.cancelSession();pending = null;}}
function handleDigit(digit: string, flow: boolean) {
  const s = editor.active;
  if (!s) return;
  if (pending && pending.flow !== flow) cancelDigits();
  const digits = (pending?.digits ?? '') + digit;
  cancelDigits();
  const doc = s.doc, target = s.activeLayer(), mode = s.mode, layer = s.activeLayerId, mask = s.editMask, channel = s.activeChannelId, tool = editor.currentToolId;
  const interaction = inputPointerRevision(), brush = BRUSH_TOOLS.has(tool);
  const parameter = flow ? 'layer.setFillOpacity' : 'layer.setOpacity';
  const valid = () => editor.active === s && s.doc === doc && s.mode === mode && s.activeLayer() === target
    && s.activeLayerId === layer && s.editMask === mask && s.activeChannelId === channel && editor.currentToolId === tool
    && inputPointerRevision() === interaction && !inputPointerBusy() && !editor.currentTool?.busy?.()
    && !useApp.getState().dialogs.length && !isTextTarget(document.activeElement)
    && s.canEdit() && !s.outputPending && !s.closePending && access(`tool:${tool}`).enabled
    && (brush || action(parameter)?.enabled?.() !== false);
  const apply = () => {
    cancelDigits();
    if (!valid()) return;
    const value = digits.length >= 2 ? Number(digits.slice(0,2))/100 || 1 : digits === '0' ? 1 : Number(digits)/10;
    if (brush) ui.setBrush(flow ? {flow: value} : {opacity: value});
    else void run(parameter, {value});
  };
  if (digits.length >= 2) apply();
  else pending = {digits, flow, timer: setTimeout(apply,350), cancelSession: s.on(() => {if (!valid()) cancelDigits();})};
}
function localChord(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const id = editor.currentTool?.id ?? editor.currentToolId, mode = editor.active?.mode.kind;
  if (mode === 'transform') return !e.shiftKey && ['Enter','Escape'].includes(e.key);
  if (id === 'move') return /^Arrow(Left|Right|Up|Down)$/.test(e.key);
  if (e.shiftKey) return false;
  if (['crop','perspectiveCrop','pen','freeformPen','polyLasso','magneticLasso','type','typeVertical'].includes(id ?? '') && ['Enter','Escape'].includes(e.key)) return true;
  return ['polyLasso','magneticLasso','pathSelect','directSelect','slice'].includes(id ?? '') && ['Delete','Backspace'].includes(e.key);
}
function toolAllowed(): boolean {
  const allowed = access(`tool:${editor.currentToolId}`).enabled && (editor.active?.mode.kind !== 'transform' || access('action:edit.freeTransform').enabled);
  if (!allowed) ui.toast('info','The current tool is unavailable for this target.');
  return allowed;
}
function down(e: KeyboardEvent) {
  if (e.defaultPrevented || isComposing(e) || isTextTarget(e.target)) return;
  if (useApp.getState().dialogs.length || document.querySelector('[role="dialog"],[role="menu"]')) return;
  const host = editor.hostFactory?.();
  if (editor.hasPendingToolInteraction() && !toolAllowed()) {e.preventDefault();return;}
  const busy = !!editor.currentTool?.busy?.();
  // Local confirmation/cancellation and point removal retain ownership even while busy.
  // Move arrows wait until the active pointer transaction ends.
  if (host && localChord(e) && !(busy && editor.active?.mode.kind !== 'transform' && editor.currentTool?.id === 'move' && e.key.startsWith('Arrow'))) {
    if (inputBlocked() || !toolAllowed()) {e.preventDefault(); return;}
    if (editor.currentTool?.keyDown?.(host,e)) {e.preventDefault(); return;}
  }
  if (busy) {
    e.preventDefault();
    if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && !inputBlocked() && toolAllowed()) editor.cancelTool();
    return;
  }
  const binding = keymap.binding(chordFromEvent(e));
  if (binding) {
    e.preventDefault();
    if (binding.kind === 'held') {if (!inputBlocked() && toolAllowed() && access('tool:hand').enabled) beginPan(e); return;}
    if (binding.kind === 'digits') {if (!e.repeat && !inputBlocked() && toolAllowed()) handleDigit(binding.chord.slice(-1), binding.ids[0] === 'input.flow'); return;}
    if (binding.kind === 'exactTool' || binding.kind === 'toolGroup' || binding.kind === 'cycle') {
      if (e.repeat || inputBlocked()) return;
      const tool = keymap.toolFor(binding, useApp.getState().tool, useApp.getState().groupTool);
      if (tool) editor.setTool(tool); else ui.toast('info','This tool is unavailable.');
      return;
    }
    if (e.repeat && !/^view\.zoom|^brush\./.test(binding.ids[0])) return;
    if (!/^(file\.|view\.|window\.|app\.)/.test(binding.ids[0]) && inputBlocked()) return;
    const a = action(binding.ids[0]);
    if (a?.comingSoon || a?.enabled?.() !== false) void run(binding.ids[0]);
    else ui.toast('info', `${a.label.replace('…','')} is unavailable for the current target.`);
    return;
  }
  if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    e.preventDefault(); if (!inputBlocked() && toolAllowed()) editor.cancelTool();
  }
}
function up(e: KeyboardEvent) {
  releasePan(e);
  if (e.defaultPrevented || isComposing(e) || isTextTarget(e.target) || useApp.getState().dialogs.length) return;
  if (!editor.currentTool?.keyUp) return;
  const h = editor.hostFactory?.();
  if (h && h.session.canEdit() && toolAllowed()) editor.currentTool?.keyUp?.(h,e);
}
export function installInputDispatch(): () => void {
  const removeContext = installInputContext();
  const offPointer = onInputPointerStart(cancelDigits);
  const invalidate = () => {cancelDigits();invalidatePan();};
  const focus = (e: FocusEvent) => {if (isTextTarget(e.target) || e.target instanceof HTMLElement && e.target.closest('[role="dialog"],[role="menu"]')) invalidate();};
  const unsub = useApp.subscribe((state,prev) => {
    if (state.activeSessionId !== prev.activeSessionId || state.tool !== prev.tool || state.dialogs !== prev.dialogs) invalidate();
  });
  window.addEventListener('keydown',down);
  window.addEventListener('keyup',up);
  window.addEventListener('blur',invalidate);
  window.addEventListener('focusin',focus,true);
  window.addEventListener('compositionstart',invalidate,true);
  return () => {
    removeContext();offPointer();unsub();invalidate();
    window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);
    window.removeEventListener('blur',invalidate);window.removeEventListener('focusin',focus,true);window.removeEventListener('compositionstart',invalidate,true);
  };
}
