/** Path-to-selection owner: synchronous target binding, Pen finish and one selection command. */
import {editor} from '../editor';
import {access} from '../access';
import {ui} from '../store';
import type {DocumentSession} from '../session';
import type {PathTarget} from '../../tools/pathEditing';
import type {VectorPath} from '../../vector/types';
import {finishPen,penSession,readPenSession} from '../../tools/penSession';
import {inputPointerBusy} from '../heldPan';
import {pathToSelection} from './selectOps';

export type PathSelectionOp='replace'|'add'|'subtract';
export const PATH_SELECTION_ACTIONS={replace:'path.toSelection',add:'path.addToSelection',subtract:'path.subtractFromSelection'} as const;
interface Binding {target:PathTarget;object:object;path:VectorPath;mask:object|null;fingerprint:string}

/** No target-dependent enabled check here: explicit B must work when default A is invalid. */
export function pathSelectionContext():boolean {
  const s=editor.active,pen=readPenSession(s);
  return !!s&&s.canEdit()&&s.mode.kind==='none'
    &&!inputPointerBusy()&&!editor.currentTool?.busy?.()&&!pen?.busy()
    &&(!!pen||!editor.hasPendingToolInteraction());
}
function validArgs(args:unknown):args is Record<string,unknown>|undefined {
  if(args===undefined)return true;
  if(!args||typeof args!=='object'||Array.isArray(args))return false;
  return !Object.hasOwn(args,'feather')||typeof (args as Record<string,unknown>).feather==='number'&&(args as Record<string,unknown>).feather===0;
}
function descriptor(value:unknown):PathTarget|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const t=value as Record<string,unknown>;
  if(t.kind==='path'&&typeof t.pathId==='string'&&t.pathId&&Object.keys(t).every(k=>k==='kind'||k==='pathId'))return {kind:'path',pathId:t.pathId};
  if((t.kind==='shape'||t.kind==='vectorMask')&&typeof t.layerId==='string'&&t.layerId&&Object.keys(t).every(k=>k==='kind'||k==='layerId'))return {kind:t.kind,layerId:t.layerId};
  return null;
}
function binding(s:DocumentSession,t:PathTarget):Binding|null {
  if(t.kind==='path'){
    const p=s.doc.paths.find(p=>p.id===t.pathId);return p?{target:t,object:p,path:p.path,mask:null,fingerprint:JSON.stringify(p.path)}:null;
  }
  const l=s.doc.getLayer(t.layerId);if(!l)return null;
  if(t.kind==='shape'&&l.kind==='shape')return {target:t,object:l,path:l.path,mask:null,fingerprint:JSON.stringify(l.path)};
  if(t.kind==='vectorMask'&&l.vectorMask&&access('feature:masks').enabled)return {target:t,object:l,path:l.vectorMask.path,mask:l.vectorMask,fingerprint:JSON.stringify(l.vectorMask.path)};
  return null;
}
function convertible(path:VectorPath){return path.subpaths.some(sp=>sp.knots.length>1);}
function same(s:DocumentSession,b:Binding,content=true):boolean {
  const now=binding(s,b.target);return !!now&&now.object===b.object&&now.path===b.path&&now.mask===b.mask&&(!content||now.fingerprint===b.fingerprint);
}
function resolve(s:DocumentSession,args:Record<string,unknown>|undefined):PathTarget|null {
  if(args&&Object.hasOwn(args,'target'))return descriptor(args.target);
  const pen=readPenSession(s);if(pen)return {...pen.target};
  if(s.activePathId)return {kind:'path',pathId:s.activePathId};
  const work=s.doc.paths.find(p=>p.kind==='work'&&!s.isWorkPathHidden(p));if(work)return {kind:'path',pathId:work.id};
  const l=s.activeLayer();return l?.kind==='shape'?{kind:'shape',layerId:l.id}:l?.vectorMask?{kind:'vectorMask',layerId:l.id}:null;
}
function prepare(op:PathSelectionOp,args:unknown){
  if(!validArgs(args)||!pathSelectionContext()||!access('action:'+PATH_SELECTION_ACTIONS[op]).enabled)return null;
  const s=editor.active!,pen=readPenSession(s);
  if(pen){const source=binding(s,{...pen.target});if(!pen.valid()||!source||!convertible(source.path))return null;}
  const target=resolve(s,args);if(!target)return null;const bound=binding(s,target);
  if(!bound||!convertible(bound.path))return null;
  return {s,doc:s.doc,pen,bound,selection:s.doc.selection,mask:s.doc.selection.mask,selectionVersion:s.doc.selection.version};
}
/** Pure target-level UI admission; never finishes or abandons a draft. */
export function canPathSelection(op:PathSelectionOp,args?:unknown):boolean{return !!prepare(op,args);}

export function makePathSelection(op:PathSelectionOp,args?:unknown):'changed'|'unchanged'|'rejected'|'failed' {
  const request=prepare(op,args);
  if(!request){
    // Invalid parameters never touch the draft. A genuinely lost owner follows its existing cleanup.
    if(validArgs(args)){const old=readPenSession(editor.active);if(old&&!old.valid())penSession(editor.active);}
    ui.toast('info','This path cannot be converted to a selection for the current target.');return 'rejected';
  }
  const {s,doc,pen,bound,selection,mask,selectionVersion}=request;
  const activePath=s.activePathId,activeLayer=s.activeLayerId;
  const sessionValid=(beforeWrite=true)=>editor.active===s&&editor.session(s.id)===s&&s.doc===doc&&pathSelectionContext()&&access('action:'+PATH_SELECTION_ACTIONS[op]).enabled
    &&doc.selection===selection&&selection.mask===mask&&(!beforeWrite||mask.version===selectionVersion);
  try{
    if(!sessionValid()||!same(s,bound))return 'rejected';
    if(pen){
      if(readPenSession(s)!==pen||!finishPen(s,pen))return 'rejected';
      // The captured owner's pure validity also works after disposal: its own final fingerprint
      // accepts legal finish cleanup, but rejects reentrant external writes or session changes.
      if(readPenSession(s)||!pen.valid())return 'rejected';
    }
    const isOwn=pen&&JSON.stringify(pen.target)===JSON.stringify(bound.target);
    if(!sessionValid()||!same(s,bound,!isOwn))return 'rejected';
    const final=binding(s,bound.target);if(!final||!convertible(final.path))return 'rejected';
    const canApply=()=>sessionValid()&&!readPenSession(s)&&same(s,final)&&(!pen||pen.valid());
    const result=pathToSelection(final.path,op,0,s,canApply);
    // A committed selection has a NEW version. Recheck ownership without the old-version permit.
    if((result==='changed'||result==='unchanged')&&final.target.kind==='path'
      &&sessionValid(false)&&s.activePathId===activePath&&s.activeLayerId===activeLayer
      &&!readPenSession(s)&&same(s,final)&&(!pen||pen.valid()))s.completeDocumentPathSelection();
    if(result==='rejected')ui.toast('info','The path target changed before the selection could be applied.');
    return result;
  }catch(error){ui.toast('error','Could not make a path selection',error instanceof Error?error.message:String(error));return 'failed';}
}
