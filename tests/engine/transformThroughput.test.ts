import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import {TiledRaster,Tile,nextGen} from '../../src/image-engine/tiledRaster';
import {TiledRaster as OldRaster,Tile as OldTile,nextGen as oldGen} from '../reference/transform-b01dcb7/tiledRaster';
import {warpRaster as oldWarp} from '../reference/transform-b01dcb7/resample';
import {warpLayerRaster as oldLayer} from '../reference/transform-b01dcb7/warpLayerRaster';
import {planTransforms} from '../../src/image-engine/transformPlan';
import {TransformWorkerEngine} from '../../src/tools/transformWorker';
import {type Homography} from '../../src/image-engine/matrix';

function fixture(w:number,h:number,alpha:'opaque'|'mixed'|'empty',negative=false){
  const r=new TiledRaster(4,8),bytes=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    bytes.set([(x*13+y*7)%256,(x*3+y*17)%256,(x*19+y*5)%256,
      alpha==='empty'?0:alpha==='opaque'?255:(x+y)%9===0?0:1+(x*11+y*3)%255],i);
  }
  r.writePixels({x:negative?-259:0,y:negative?-17:0,w,h},bytes);
  const old=new OldRaster(4,8);
  for(const [key,t]of r.tiles)old.tiles.set(key,new OldTile(t.data.slice(),oldGen()));
  return {r,old};
}
const digest=(r:{tiles:Map<number,{data:ArrayBufferView}>})=>[...r.tiles].sort(([a],[b])=>a-b)
  .map(([k,t])=>[k,createHash('sha256').update(new Uint8Array(t.data.buffer,t.data.byteOffset,t.data.byteLength)).digest('hex')]);
async function run(r:TiledRaster,p:ReturnType<typeof planTransforms>[0]){
  const out=new TiledRaster(4,8);
  const engine=new TransformWorkerEngine(m=>{
    if(m.type==='tile'){
      const data=m.data.slice();out.tiles.set((m.ty+32768)*65536+m.tx+32768,new Tile(data,nextGen()));
      queueMicrotask(()=>void engine.receive({type:'ack',id:'oracle'}));
    }
  });
  await engine.receive({type:'init',id:'oracle',plan:p});
  for(const [key,tile]of r.tiles)await engine.receive({type:'source',id:'oracle',key,data:tile.data.slice()});
  await engine.receive({type:'start',id:'oracle'});
  return out;
}
const cases:{name:string;w:number;h:number;H:Homography;negative?:boolean}[]=[
  {name:'fractional translation and source boundary',w:39,h:31,H:[1,0,17.25,0,1,-9.75,0,0,1]},
  {name:'rotation and negative/off-canvas source',w:257,h:67,negative:true,H:[.97,-.24,9.5,.24,.97,3.125,0,0,1]},
  {name:'flip',w:65,h:33,H:[-1,0,150.125,0,1,-4.25,0,0,1]},
  {name:'one pixel',w:1,h:1,H:[3.1,0,-2.25,0,2.7,4.75,0,0,1]},
  {name:'narrow strip',w:2,h:519,H:[1.7,.17,-4.5,.09,.83,2.2,0,0,1]},
  {name:'mip threshold below',w:259,h:79,H:[1/1.499,0,0,0,1/1.499,0,0,0,1]},
  {name:'mip threshold above',w:259,h:79,H:[1/1.501,0,0,0,1/1.501,0,0,0,1]},
  {name:'deep minification',w:519,h:259,H:[.12,0,-2.7,0,.13,-.5,0,0,1]},
  {name:'projective cross 1024 and mip',w:4096,h:71,H:[1,0,-10,0,1,7,.0003,0,1]},
  {name:'second projective axis',w:71,h:2207,H:[1,.07,3.5,.03,1,-5.25,0,.0002,1]},
];
it.each(cases)('fixed b01dcb7 oracle: $name',async({w,h,H,negative})=>{
  for(const alpha of ['mixed','opaque','empty'] as const){
    const {r,old}=fixture(w,h,alpha,negative),bounds=r.contentBounds()??{x:0,y:0,w,h};
    const p=planTransforms(H,[{bounds,x:-12,y:7,channels:4,depth:8,bytes:r.byteSize()}])[0];
    const expected=oldLayer(old,-12,7,H,'bicubic',undefined,bounds);
    const out=await run(r,p);
    expect([p.output.x,p.output.y]).toEqual([expected.x,expected.y]);
    expect(digest(out)).toEqual(digest(expected.raster));
    expect(out.contentBounds()).toEqual(expected.raster.contentBounds());
    // Imported dynamically so the frozen oracle cannot resolve through the candidate.
    const {warpTransformRaster}=await import('../../src/tools/transformResample');
    for(const region of p.logical){
      const before=oldWarp(old,bounds,p.inverse,region,'bicubic');
      const after=warpTransformRaster(r,bounds,p.inverse,region);
      expect(Buffer.from(after.buffer).equals(Buffer.from(before.buffer))).toBe(true);
    }
  }
},30000);
