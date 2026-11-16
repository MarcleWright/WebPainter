import type {DocumentSession} from '../src/app/session';
type Guard={protection:symbol;output?:symbol;pending?:Promise<boolean>};
const guards=new WeakMap<DocumentSession,Map<string,Guard>>();
/** Exclusive manual-output / close-cutoff fixtures replace the old assignable boolean/Promises.
 * Background-output tests reserve the real slot directly and do not use this edit protection.
 */
export function setGuard(s:DocumentSession,kind:string,value:unknown):unknown {
  let state=guards.get(s);if(!state){state=new Map();guards.set(s,state);}
  const old=state.get(kind);
  if(old){s.releaseEditProtection(old.protection);if(old.output)s.releaseOutput(old.output);if(kind==='closePending'&&old.pending)s.releaseClose(old.pending);state.delete(kind);}
  if(value){
    const pending=kind==='editProtected'?undefined:value as Promise<boolean>;
    const output=kind==='outputPending'?s.reserveOutput(pending!)??undefined:undefined;
    if(kind==='closePending')s.setClose(pending!);
    state.set(kind,{protection:s.acquireEditProtection(kind==='outputPending'?'manual-output-fixture':kind),output,pending});
  }
  return value;
}
export function clearGuards(s:DocumentSession):void {for(const kind of ['editProtected','outputPending','closePending'])setGuard(s,kind,null);}
