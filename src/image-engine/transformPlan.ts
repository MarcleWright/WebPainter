/** Shared admission for preview, background commit and explicitly supported CPU fallback. */
import { invertH, type Homography, type Quad } from './matrix';
import { roundOut, type Rect } from './rect';
import { tileRange } from './tiledRaster';

export const TRANSFORM_LIMITS = { peakBytes: 768 * 1024 * 1024, pixels: 32 * 1024 * 1024, side: 32768, coordinate: 1 << 22 };
export interface TransformInput { bounds: Rect; x: number; y: number; channels: 1 | 4; depth: 8 | 16 | 32; bytes: number }
export interface TransformPlan { bounds: Rect; output: Rect; inverse: Homography; peakBytes: number; outputBytes: number; logical: Rect[] }
const corners = (r: Rect) => [[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]];
export function safeDenominator(H: Homography, r: Rect): boolean {
  const w=corners(r).map(([x,y])=>H[6]*x+H[7]*y+H[8]), max=Math.max(...w.map(Math.abs));
  return max>0 && w.every(v=>Number.isFinite(v) && Math.abs(v)>max*1e-6 && Math.sign(v)===Math.sign(w[0]));
}
export function validateQuad(q: Quad): void {
  if(q.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('Non-finite transform');
  const cross=q.map((p,i)=>{const b=q[(i+1)%4],c=q[(i+2)%4];return(b.x-p.x)*(c.y-b.y)-(b.y-p.y)*(c.x-b.x);});
  if(cross.some(v=>Math.abs(v)<1e-5||Math.sign(v)!==Math.sign(cross[0])))throw Error('Transform quadrilateral is crossed or degenerate');
}
export function transformGeometry(H: Homography, bounds: Rect, x=0, y=0): Omit<TransformPlan,'peakBytes'|'outputBytes'> {
  if(H.length!==9||H.some(v=>!Number.isFinite(v)))throw Error('Non-finite transform');
  const [a,b,c,d,e,f,g,h,i]=H, det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
  const norm=Math.hypot(a,b,c)*Math.hypot(d,e,f)*Math.hypot(g,h,i);
  if(!norm||Math.abs(det)<1e-15||Math.abs(det)<=norm*1e-12)throw Error('Transform is singular or too close to singular');
  const src={...bounds,x:bounds.x+x,y:bounds.y+y};
  if(!safeDenominator(H,src))throw Error('Transform crosses or approaches the projection horizon');
  // Preserve warpLayerRaster's division order: multiplying by 1/w can change ceil by one.
  const q=corners(src).map(([sx,sy])=>{const w=H[6]*sx+H[7]*sy+H[8];return{x:(H[0]*sx+H[1]*sy+H[2])/w,y:(H[3]*sx+H[4]*sy+H[5])/w};}) as Quad;validateQuad(q);
  const output=roundOut(Math.min(...q.map(p=>p.x)),Math.min(...q.map(p=>p.y)),Math.max(...q.map(p=>p.x)),Math.max(...q.map(p=>p.y)));
  if(!Number.isSafeInteger(output.w*output.h)||output.w<=0||output.h<=0||output.w>TRANSFORM_LIMITS.side||output.h>TRANSFORM_LIMITS.side||
    corners(output).some(p=>p.some(v=>Math.abs(v)>TRANSFORM_LIMITS.coordinate)))throw Error('Transform output range exceeds safe limits');
  const inv=invertH(H);
  if(!safeDenominator(inv,output))throw Error('Transform output approaches an inverse projection horizon');
  const inverse:Homography=[inv[0]-x*inv[6],inv[1]-x*inv[7],inv[2]-x*inv[8],inv[3]-y*inv[6],inv[4]-y*inv[7],inv[5]-y*inv[8],inv[6],inv[7],inv[8]];
  const logical:Rect[]=[];
  for(let yy=output.y;yy<output.y+output.h;yy+=1024)for(let xx=output.x;xx<output.x+output.w;xx+=1024)
    logical.push({x:xx,y:yy,w:Math.min(1024,output.x+output.w-xx),h:Math.min(1024,output.y+output.h-yy)});
  return {bounds,output,inverse,logical};
}
function tileBytes(r:Rect,channels:number,bytes:number):number {const t=tileRange(r);return (t.tx1-t.tx0+1)*(t.ty1-t.ty0+1)*256*256*channels*bytes;}
/** Conservative operation peak, including both ends and the old kernel's largest source read. */
export function planTransforms(H:Homography, inputs:TransformInput[], quad?:Quad|null, additionalBytes=0):TransformPlan[] {
  if(quad)validateQuad(quad);
  if(!inputs.length)throw Error('No bounded transform source');
  if(!Number.isSafeInteger(additionalBytes)||additionalBytes<0)throw Error('Invalid transform working-memory budget');
  let peak=additionalBytes+3*256*256*16+1024*1024*16,pixels=0;
  const plans=inputs.map(src=>{
    if(!Object.values(src.bounds).every(Number.isFinite)||src.bounds.w<=0||src.bounds.h<=0)throw Error('Invalid source bounds');
    const geo=transformGeometry(H,src.bounds,src.x,src.y), bytes=src.depth/8;
    pixels+=geo.output.w*geo.output.h;
    let mips=0;
    for(let level=1;level<=8;level++){const sc=1<<level,b=src.bounds;mips+=tileBytes({x:Math.floor(b.x/sc),y:Math.floor(b.y/sc),w:Math.ceil((b.x+b.w)/sc)-Math.floor(b.x/sc),h:Math.ceil((b.y+b.h)/sc)-Math.floor(b.y/sc)},src.channels===1?4:src.channels,src.channels===1?4:bytes);}
    const outputBytes=tileBytes({x:0,y:0,w:geo.output.w,h:geo.output.h},src.channels,bytes);
    const sourceFloat=tileBytes({...src.bounds,x:src.bounds.x-2,y:src.bounds.y-2,w:src.bounds.w+4,h:src.bounds.h+4},4,4);
    // Authority, frozen preview source, and Worker/CPU-private source can each retain mips.
    peak+=src.bytes*2+mips*3+outputBytes*2+sourceFloat;
    if(src.channels===1)peak+=tileBytes(src.bounds,4,4)+src.bounds.w*src.bounds.h*20+geo.output.w*geo.output.h*20;
    return {...geo,peakBytes:0,outputBytes};
  });
  if(pixels>TRANSFORM_LIMITS.pixels||!Number.isSafeInteger(peak)||peak>TRANSFORM_LIMITS.peakBytes)throw Error('Transform exceeds the total pixel or memory budget');
  for(const p of plans)p.peakBytes=peak;
  return plans;
}
