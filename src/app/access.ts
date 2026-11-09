/** Optional local surface admission. Independent WP has no restrictions by default. */
export type Access = { visible: boolean; enabled: boolean };
export type AccessPolicy = (entry: string) => Access;
const full: AccessPolicy = () => ({visible:true,enabled:true});
let policy = full;
export function access(entry:string):Access{return policy(entry);}
export function installAccessPolicy(next:AccessPolicy):()=>void{
  const previous=policy;policy=next;return()=>{if(policy===next)policy=previous;};
}
