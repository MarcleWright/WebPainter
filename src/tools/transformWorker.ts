/** Dedicated, disposable transform worker. Logical sampling partitions match warpLayerRaster. */
import { TiledRaster, Tile, nextGen, keyToTile } from '../image-engine/tiledRaster';
import { warpTransformRaster } from './transformResample';
import type { TransformPlan } from '../image-engine/transformPlan';

export class TransformWorkerEngine {
  private source=new TiledRaster(4,8);
  private plan!:TransformPlan;
  private id='';
  private acknowledge:(()=>void)|null=null;
  constructor(private send:(message:any,transfer?:Transferable[])=>void){}
  async receive(m:any):Promise<void>{
    if(m.type==='init'){this.id=m.id;this.plan=m.plan;this.send({type:'ready',id:this.id});return;}
    if(m.id!==this.id)return;
    if(m.type==='ack'){this.acknowledge?.();this.acknowledge=null;return;}
    if(m.type==='source'){
      this.source.tiles.set(m.key,new Tile(m.data,nextGen()));
      this.send({type:'sourceAck',id:this.id});return;
    }
    if(m.type!=='start')return;
    const start=performance.now();let pixels=0,computeMs=0;
    for(let index=0;index<this.plan.logical.length;index++){
      const r=this.plan.logical[index];
      const unit=performance.now();
      const px=warpTransformRaster(this.source,this.plan.bounds,this.plan.inverse,r);
      const part=new TiledRaster(4,8);
      part.writeFloat({x:0,y:0,w:r.w,h:r.h},px);part.compact();
      computeMs+=performance.now()-unit;
      const emitted=part.tiles.size;
      for(const [key,tile]of part.tiles){
        const [tx,ty]=keyToTile(key),data=tile.data;
        const ack=new Promise<void>(resolve=>this.acknowledge=resolve);
        this.send({type:'tile',id:this.id,index,tx:tx+(r.x-this.plan.output.x)/256,ty:ty+(r.y-this.plan.output.y)/256,data},[data.buffer as ArrayBuffer]);
        await ack;
      }
      pixels+=r.w*r.h;
      this.send({type:'block',id:this.id,index,emitted,total:Math.ceil(r.w/256)*Math.ceil(r.h/256),pixels});
    }
    this.send({type:'done',id:this.id,pixels,computeMs,computeWallMs:performance.now()-start,output:this.plan.output});
  }
}
if(typeof self!=='undefined' && typeof Window==='undefined'){
  const engine=new TransformWorkerEngine((m,t)=>self.postMessage(m,t??[]));
  self.onmessage=e=>{void engine.receive(e.data).catch(error=>self.postMessage({type:'error',id:e.data.id,message:String(error)}));};
}
