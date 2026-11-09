/** Optional local surface admission. Independent WP has no restrictions by default. */
export type Access = { visible: boolean; enabled: boolean };
export type AccessPolicy = (entry: string) => Access;
const full: AccessPolicy = () => ({visible:true,enabled:true});
let policy = full;
export function access(entry:string):Access{
 const own=policy(entry);let feature:string|undefined;
 if(/^action:layer\.newAdjustment(?:\.|$)/.test(entry))feature='masks';
 else if(/^action:layer\.(addMask|mask\.|deleteMask|applyMask|toggleMask|linkMask|invertMask|editMaskToggle|addVectorMask|deleteVectorMask)/.test(entry))feature='masks';
 else if(/^action:layer\.(style|setStyle|copyStyle|pasteStyle|clearStyle|rasterizeStyle)/.test(entry))feature='effects';
 else if(/^action:layer\.(convertToSmartObject|editContents|replaceContents|relink)$/.test(entry))feature='smartObject';
 const dependencies=feature?['feature:'+feature]:[];
 if(entry.startsWith('action:layer.newAdjustment.'))dependencies.push('action:layer.newAdjustment','adjustment:'+entry.slice('action:layer.newAdjustment.'.length));
 if(entry.startsWith('action:layer.newFill.'))dependencies.push('action:layer.newFill','fill:'+entry.slice('action:layer.newFill.'.length));
 return dependencies.reduce((state,key)=>{const required=policy(key);return{visible:state.visible&&required.visible,enabled:state.enabled&&required.enabled};},own);
}
export function installAccessPolicy(next:AccessPolicy):()=>void{
  const previous=policy;policy=next;return()=>{if(policy===next)policy=previous;};
}
