/** Exact bicubic kernel for the admitted RGBA8 transform Worker, not preview/resize. */
import {applyH, type Homography} from '../image-engine/matrix';
import {warpSampleContext} from '../image-engine/resample';
import type {Rect} from '../image-engine/rect';
import type {TiledRaster} from '../image-engine/tiledRaster';

function cubic(t:number):[number,number,number,number]{
  const t2=t*t,t3=t2*t;
  return [(-t3+2*t2-t)/2,(3*t3-5*t2+2)/2,(-3*t3+4*t2+t)/2,(t3-t2)/2];
}

function sample(src:Float32Array,w:number,h:number,u:number,v:number,out:Float32Array,o:number):void{
  const x0=Math.floor(u),y0=Math.floor(v),wx=cubic(u-x0),wy=cubic(v-y0);
  if(x0>=1&&y0>=1&&x0+2<w&&y0+2<h){
    // Test the complete support once, then reuse row addresses across all four channels.
    // Keep the original 0 + tap0 + tap1 + tap2 + tap3, then 0 + row0 + ... order.
    const stride=w*4,base=((y0-1)*w+x0-1)*4;
    for(let c=0;c<4;c++){
      let s=0;
      for(let j=0;j<4;j++){
        const i=base+j*stride+c;
        let row=0;
        row+=src[i]*wx[0];row+=src[i+4]*wx[1];row+=src[i+8]*wx[2];row+=src[i+12]*wx[3];
        s+=row*wy[j];
      }
      out[o+c]=s;
    }
  }else{
    // Source-window edges retain zero extension, including each zero-weight operation.
    for(let c=0;c<4;c++){
      let s=0;
      for(let j=0;j<4;j++){
        let row=0;
        for(let i=0;i<4;i++){
          const x=x0-1+i,y=y0-1+j;
          row+=(x<0||y<0||x>=w||y>=h?0:src[(y*w+x)*4+c])*wx[i];
        }
        s+=row*wy[j];
      }
      out[o+c]=s;
    }
  }
  // These writes intentionally round to Float32 before clamping and unpremultiplying.
  const a=Math.max(0,Math.min(1,out[o+3]));
  out[o+3]=a;
  for(let c=0;c<3;c++)out[o+c]=Math.max(0,Math.min(a,out[o+c]));
}

/** `dst` is the original output-origin 1024 logical region, never a transport tile. */
export function warpTransformRaster(src:TiledRaster,srcBounds:Rect,inv:Homography,dst:Rect):Float32Array{
  const out=new Float32Array(dst.w*dst.h*4);
  if(dst.w<=0||dst.h<=0||srcBounds.w<=0||srcBounds.h<=0)return out;
  const context=warpSampleContext(srcBounds,inv,dst);
  if(!context)return out;
  const {level,region:lr}=context,ls=1<<level;
  if(lr.w*lr.h>400e6)throw new Error('Transform is too extreme to render');
  const buf=src.readFloat(lr,level);
  for(let i=0;i<lr.w*lr.h;i++){
    const a=buf[i*4+3];
    buf[i*4]*=a;buf[i*4+1]*=a;buf[i*4+2]*=a;
  }
  for(let y=0;y<dst.h;y++)for(let x=0;x<dst.w;x++){
    const p=applyH(inv,dst.x+x+0.5,dst.y+y+0.5);
    const u=p.x/ls-lr.x-0.5,v=p.y/ls-lr.y-0.5,o=(y*dst.w+x)*4;
    sample(buf,lr.w,lr.h,u,v,out,o);
    const a=out[o+3];
    if(a>1e-6){const k=1/a;out[o]*=k;out[o+1]*=k;out[o+2]*=k;}
    else out[o]=out[o+1]=out[o+2]=out[o+3]=0;
  }
  return out;
}
