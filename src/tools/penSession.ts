/** Pen-only owner bridge; keeps panel/session dependencies out of the drawing implementation. */
import type {DocumentSession} from '../app/session';
import {ui} from '../app/store';
export interface PenOwner {
  session:DocumentSession;
  layerId:string|null;
  valid():boolean;
  abandon():void;
  finish(output?:boolean):boolean;
  interrupt():void;
  undo(redo:boolean):void;
}
let owner:PenOwner|null=null;
export function registerPen(ownerNext:PenOwner):()=>void {owner=ownerNext;return()=>{if(owner===ownerNext)owner=null;};}
export function penSession(s:DocumentSession|null|undefined):PenOwner|null {
  if(!owner||owner.session!==s)return null;
  if(!owner.valid()){const old=owner;owner=null;old.abandon();return null;}return owner;
}
export function finishPen(s:DocumentSession|null|undefined,output=false):boolean {return penSession(s)?.finish(output)??true;}
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
