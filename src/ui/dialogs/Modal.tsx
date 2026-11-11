import {isComposing, isTextTarget, MODAL_VIEW} from '../../app/inputContext';
import {keymap, chordFromEvent} from '../../app/shortcuts';
import {run} from '../../app/actions';
import {editor} from '../../app/editor';
import {ui,useApp} from '../../app/store';
/** Modal dialog frame (draggable, Esc/Enter aware, focus-trapped). */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton } from '../controls';

// Session-only public shell state. No preferences or command queue.
export const DialogType = createContext<string | null>(null);
const positions = new Map<string,{x:number;y:number}>();
const owners: {token:object;clear:()=>void}[] = [];

export function Modal({ title, children, onClose, onOk, okLabel = 'OK', footerLeft, width, okDisabled, noFooter, positionKey }: {
  positionKey?: string;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onOk?: () => void;
  okLabel?: string;
  footerLeft?: ReactNode;
  width?: number;
  okDisabled?: boolean;
  noFooter?: boolean;
}) {
  const type = useContext(DialogType), key = positionKey ?? type ?? title;
  const [off, setOff] = useState(() => positions.get(key) ?? {x:0,y:0});
  const backdrop = useRef<HTMLDivElement>(null), token = useRef({}).current;
  const target = useRef({session:editor.active,doc:editor.active?.doc}).current;
  const held = useRef<string|null>(null);
  const pan = useRef<{x:number;y:number;pointer:number}|null>(null);
  const titleStop = useRef<(()=>void)|null>(null);
  const top = () => owners.at(-1)?.token === token;
  const clear = () => {held.current=null;const drag=pan.current;pan.current=null;if(drag && backdrop.current?.hasPointerCapture?.(drag.pointer)) backdrop.current.releasePointerCapture(drag.pointer);titleStop.current?.();titleStop.current=null;};
  const valid = () => top() && editor.active === target.session && editor.active?.doc === target.doc && !!target.session?.canEdit() && !target.session.outputPending && !target.session.closePending;
  const popup = () => {if(document.querySelector('[role="menu"],[role="listbox"],.select-popup,[aria-expanded="true"]'))return true;try{return !!document.querySelector('select:open');}catch{return false;}};
  const exposed = (x:number,y:number) => {const el=document.querySelector<HTMLElement>('.viewport');if(!el||popup())return false;const r=el.getBoundingClientRect();return x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom;};
  const clamp = (value:{x:number;y:number}) => {const r=ref.current?.getBoundingClientRect();const x=Math.max(0,(window.innerWidth-(r?.width||360))/2-20),y=Math.max(0,(window.innerHeight-(r?.height||200))/2-20);return {x:Math.max(-x,Math.min(x,value.x)),y:Math.max(-y,Math.min(y,value.y))};};
  const remember = (value:{x:number;y:number}) => {const next=clamp(value);positions.set(key,next);setOff(next);};

  const ref = useRef<HTMLDivElement>(null);
  const alive = useRef(false);
  const pending = useRef(false);
  const okRef = useRef(onOk);
  okRef.current = onOk;
  useEffect(() => {
    alive.current=true;owners.at(-1)?.clear();owners.push({token,clear});
    const up=(e:KeyboardEvent)=>{if(held.current===(e.code||e.key))held.current=null;};
    const resize=()=>setOff(value=>{const next=clamp(value);positions.set(key,next);return next;});
    const wheel=(e:WheelEvent)=>{if(e.target!==backdrop.current||!valid()||!exposed(e.clientX,e.clientY))return;e.preventDefault();const s=target.session!;const r=document.querySelector('.viewport')!.getBoundingClientRect();
      if(e.ctrlKey||e.altKey)s.view.zoomAt(e.clientX-r.left,e.clientY-r.top,s.view.zoom*Math.pow(1.0015,-e.deltaY*(e.deltaMode===1?30:1)));
      else if(e.shiftKey)s.view.panX-=e.deltaY+e.deltaX;else{s.view.panX-=e.deltaX;s.view.panY-=e.deltaY;}ui.bump('viewRev');};
    const stop=useApp.subscribe((s,p)=>{if(s.activeSessionId!==p.activeSessionId||s.dialogs!==p.dialogs)clear();});
    window.addEventListener('keyup',up);window.addEventListener('blur',clear);window.addEventListener('resize',resize);backdrop.current?.addEventListener('wheel',wheel,{passive:false});resize();
    return()=>{alive.current=false;clear();stop();const i=owners.findIndex(o=>o.token===token);if(i>=0)owners.splice(i,1);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);window.removeEventListener('resize',resize);backdrop.current?.removeEventListener('wheel',wheel);};
  }, []);
  useEffect(() => {
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('input, select, textarea, button.primary');
    first?.focus();
  }, []);
  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (!top()) {e.preventDefault();return;}
    if (e.defaultPrevented || isComposing(e)) return;
    if (e.key === 'Tab') {
      const controls = [...(ref.current?.querySelectorAll<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),[tabindex="0"],a[href]') ?? [])].filter(el => !el.closest('[hidden]'));
      const next = controls.indexOf(document.activeElement as HTMLElement) + (e.shiftKey ? -1 : 1);
      if (!controls.length || next < 0 || next >= controls.length) {e.preventDefault();(controls[e.shiftKey ? controls.length-1 : 0] ?? ref.current)?.focus();}
      return;
    }
    if (!isTextTarget(e.target) && keymap.binding(chordFromEvent(e.nativeEvent))?.kind==='held' && valid() && !popup()) {e.preventDefault();if(!e.repeat)held.current=e.code||e.key;return;}
    const target = e.target instanceof Element ? e.target : null;
    const control = target?.closest('button,a[href],[role="button"],[role="checkbox"],[role="radio"],[role="switch"],[role="slider"],[role="spinbutton"],[role="combobox"],[role="listbox"],[role="option"],[role="textbox"],[role="menuitem"]');
    if (e.key === 'Escape') {e.preventDefault();if (!e.repeat) onClose();return;}
    if (e.key === 'Enter') {
      // Multiline editing and native control activation precede modal submission and view keys.
      if (control || target?.matches('textarea,select') || target?.closest('[contenteditable]:not([contenteditable="false"])')) return;
      if (e.repeat) {e.preventDefault();return;}
      if (onOk && !okDisabled) {
        e.preventDefault();(document.activeElement as HTMLElement | null)?.blur();if (pending.current) return;
        pending.current = true;
        const session = editor.active, dialog = useApp.getState().dialogs.at(-1);
        setTimeout(() => {pending.current = false; if (alive.current && top() && editor.active === session && useApp.getState().dialogs.at(-1) === dialog) okRef.current?.();}, 0);
      }
      return;
    }
    // Text/select controls retain editing chords; other controls retain activation/navigation.
    // An unclaimed view chord may still work on a non-text control (e.g. Ctrl+= on a button).
    const controlNavigation = [' ','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key);
    const textLikeControl = control?.matches('[role="textbox"],[role="combobox"],[role="listbox"],[role="option"],[role="menuitem"]');
    if (e.key === 'Tab' || isTextTarget(e.target) || textLikeControl || control && controlNavigation) return;
    const bound = keymap.lookup(chordFromEvent(e.nativeEvent));
    if (bound && MODAL_VIEW.has(bound)) {e.preventDefault(); void run(bound);}
  };
  return (
    <div className="modal-backdrop" ref={backdrop} onMouseDown={e=>{if(e.target===e.currentTarget)e.preventDefault();}}
      onClickCapture={e=>{if(!top()){e.preventDefault();e.stopPropagation();}}}
      onPointerDown={e=>{if(e.target!==e.currentTarget||!valid()||!exposed(e.clientX,e.clientY))return;e.preventDefault();if(e.button===1||(e.button===0&&held.current)){pan.current={x:e.clientX,y:e.clientY,pointer:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);}}}
      onPointerMove={e=>{const p=pan.current;if(!p||p.pointer!==e.pointerId)return;if(!valid()){clear();return;}target.session!.view.panX+=e.clientX-p.x;target.session!.view.panY+=e.clientY-p.y;pan.current={...p,x:e.clientX,y:e.clientY};ui.bump('viewRev');}}
      onPointerUp={e=>{if(pan.current?.pointer===e.pointerId)pan.current=null;}} onPointerCancel={()=>{pan.current=null;}}
      onKeyDown={onKey}>
      <div className="modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} style={{ width, transform: `translate(${off.x}px, ${off.y}px)` }}>
        <div
          className="modal-head"
          onPointerDown={(e) => {
            if (!top() || (e.target as HTMLElement).closest('button')) return;
            const sx=e.clientX-off.x,sy=e.clientY-off.y,el=e.currentTarget;
            el.setPointerCapture(e.pointerId);
            const mv=(ev:PointerEvent)=>remember({x:ev.clientX-sx,y:ev.clientY-sy});
            const up=()=>{el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);titleStop.current=null;};
            titleStop.current=up;el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
          }}
        >
          {title}
          <span className="x"><IconButton icon="close" title="Close" onClick={onClose} /></span>
        </div>
        <div className="modal-body">{children}</div>
        {!noFooter && (
          <div className="modal-foot">
            <div className="left">{footerLeft}</div>
            <button className="btn" onClick={onClose}>Cancel</button>
            {onOk && <button className="btn primary" disabled={okDisabled} onClick={onOk}>{okLabel}</button>}
          </div>
        )}
      </div>
    </div>
  );
}
