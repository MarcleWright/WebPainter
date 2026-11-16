/** Pen-only owner bridge; keeps panel/session dependencies out of the drawing implementation. */
import type {DocumentSession} from '../app/session';
import {ui} from '../app/store';
import type {PathTarget} from './pathEditing';
export interface PenOwner {
  session:DocumentSession;
  layerId:string|null;
  readonly target:Readonly<PathTarget>;
  busy():boolean;
  valid():boolean;
  abandon():void;
  finish():boolean;
  interrupt():void;
  undo(redo:boolean):void;
}
let owner:PenOwner|null=null;
let finishing:PenOwner|null=null;
export function registerPen(ownerNext:PenOwner):()=>void {owner=ownerNext;ownerNext.session.notify();return()=>{if(owner===ownerNext){owner=null;ownerNext.session.notify();}};}
export function penSession(s:DocumentSession|null|undefined):PenOwner|null {
  if(!owner||owner.session!==s)return null;
  if(!owner.valid()){const old=owner;owner=null;old.abandon();old.session.notify();return null;}return owner;
}
/** Pure inspection for target admission; unlike penSession it never clears an invalid owner. */
export function readPenSession(s:DocumentSession|null|undefined):PenOwner|null {return owner?.session===s?owner:null;}
export function finishPen(s:DocumentSession|null|undefined,expected?:PenOwner):boolean {
  if(finishing?.session===s)return false;
  if(expected){
    if(owner!==expected||expected.session!==s)return false;
    if(!expected.valid()){penSession(s);return false;}
  }
  const current=expected??penSession(s);if(!current)return true;
  finishing=current;try{return current.finish();}finally{finishing=null;}
}
export function penHistoryAllowed(s:DocumentSession):boolean {
  if(!penSession(s))return true;
  ui.toast('info','Please finish the current path before operating document history.');return false;
}
export function interruptPen(s:DocumentSession|null|undefined){penSession(s)?.interrupt();}

/** Full-layer snapshot commands must not capture a live Pen path as an unrelated baseline. */
export function finishPenLayer(doc:DocumentSession['doc'],id:string):boolean {
  if(!owner||owner.session.doc!==doc||owner.layerId!==id)return true;
  return finishPen(owner.session);
}
