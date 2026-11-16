/** Stable checkpoint admission. Output occupancy is deliberately independent of editing. */
import {editor} from './editor';
import type {DocumentSession} from './session';
import {readPenSession} from '../tools/penSession';
import {textEditState,onTextEdit} from '../tools/typeTool';
import {inputPointerBusy} from './heldPan';
import {snapshotDocument} from '../document/clone';

export function hasUncommittedChanges(s:DocumentSession):boolean {
  return s.hasLocalUncommitted || !!readPenSession(s) || textEditState()?.sessionId===s.id
    || s.mode.kind!=='none' || !!s.transformPending || editor.moving(s)
    || editor.active===s && (inputPointerBusy() || editor.hasPendingToolInteraction());
}
export function checkpointReady(s:DocumentSession):boolean {
  return editor.session(s.id)===s && s.canEdit() && !hasUncommittedChanges(s);
}
/** Never capture reentrantly from doc.emit or before the current tool handler has completed. */
export function onCheckpointChange(s:DocumentSession,listener:()=>void):()=>void {
  let queued=false,alive=true;
  const changed=()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;if(alive)listener();});}};
  const off=s.on(changed),offText=onTextEdit(changed);
  return ()=>{alive=false;off();offText();};
}
/** Caller owns the output reservation. All identity and snapshot reads share one synchronous boundary. */
export function captureCheckpoint(s:DocumentSession) {
  if(!checkpointReady(s))return null;
  s.history.seal();
  const entry=s.history.current.id,revision=s.doc.rev;
  const protection=s.acquireEditProtection('checkpoint');
  try{return {document:snapshotDocument(s.doc),entry,revision};}
  finally{s.releaseEditProtection(protection);}
}
