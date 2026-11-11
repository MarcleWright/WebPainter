import { TiledRaster, Tile, nextGen, tileKey } from '../image-engine/tiledRaster';
import type { TransformPlan } from '../image-engine/transformPlan';

export class TransformWorkerUnavailable extends Error {}
export interface TransformMetrics { operation:string; snapshotMs:number; admitMs:number; computeWallMs:number; packMs:number; transferWaitMs:number; assembleMs:number; computeMs:number; totalMs:number; installMs:number; maxPackUnitMs:number; peakInFlightBytes:number; estimatedPeakBytes:number; cancelled:boolean }
export interface TransformTask { promise:Promise<TiledRaster>; cancel():void; metrics:TransformMetrics }
export function startTransformTask(source:TiledRaster,plan:TransformPlan,id:string,onProgress:(f:number)=>void,
  create:()=>Worker=()=>new Worker(new URL('./transformWorker.ts',import.meta.url),{type:'module'})):TransformTask {
  const started=performance.now();
  const metrics:TransformMetrics={operation:id,snapshotMs:0,admitMs:0,computeWallMs:0,packMs:0,transferWaitMs:0,assembleMs:0,computeMs:0,totalMs:0,installMs:0,maxPackUnitMs:0,peakInFlightBytes:0,estimatedPeakBytes:plan.peakBytes,cancelled:false};
  let worker:Worker|null=null,closed=false,ready=false,resolveWait:(()=>void)|null=null,rejectWait:((e:Error)=>void)|null=null;
  let rejectResult:(e:Error)=>void=()=>{},resolveResult:(r:TiledRaster)=>void=()=>{};
  const out=new TiledRaster(4,8),seen=new Set<number>();let block=0,blockTiles=0,pixels=0;
  const promise=new Promise<TiledRaster>((resolve,reject)=>{resolveResult=resolve;rejectResult=reject;});
  let startupTimer:ReturnType<typeof setTimeout>|null=null;
  const finish=(error?:Error)=>{
    if(closed)return;closed=true;if(startupTimer)clearTimeout(startupTimer);worker?.terminate();metrics.totalMs=performance.now()-started;
    if(error){rejectWait?.(error);rejectWait=null;rejectResult(error);}else resolveResult(out);
  };
  const wait=()=>new Promise<void>((resolve,reject)=>{resolveWait=resolve;rejectWait=reject;});
  const ack=()=>{resolveWait?.();resolveWait=null;rejectWait=null;};
  try {
    worker=create();
    worker.onerror=e=>finish(ready?Error(e.message||'Transform worker failed'):new TransformWorkerUnavailable(e.message||'Transform worker failed to load'));
    worker.onmessageerror=()=>finish(Error('Transform worker message could not be decoded'));
    worker.onmessage=e=>{
      if(closed||e.data.id!==id)return;
      const m=e.data;
      try{
        if(m.type==='ready'){if(ready)throw Error('Duplicate worker readiness');ready=true;if(startupTimer)clearTimeout(startupTimer);ack();}
        else if(m.type==='sourceAck')ack();
        else if(m.type==='tile'){
          const start=performance.now(),r=plan.logical[block];
          if(!r||m.index!==block||!Number.isInteger(m.tx)||!Number.isInteger(m.ty)||m.tx<0||m.ty<0||m.tx>=Math.ceil(plan.output.w/256)||m.ty>=Math.ceil(plan.output.h/256)||
            m.tx*256<r.x-plan.output.x||m.tx*256>=r.x-plan.output.x+r.w||m.ty*256<r.y-plan.output.y||m.ty*256>=r.y-plan.output.y+r.h||
            (!ArrayBuffer.isView(m.data)||Object.prototype.toString.call(m.data)!=='[object Uint8ClampedArray]')||m.data.length!==256*256*4)throw Error('Invalid transform result tile');
          const key=tileKey(m.tx,m.ty);if(seen.has(key))throw Error('Duplicate transform result tile');
          seen.add(key);out.tiles.set(key,new Tile(m.data,nextGen()));blockTiles++;
          metrics.peakInFlightBytes=Math.max(metrics.peakInFlightBytes,m.data.byteLength);
          metrics.assembleMs+=performance.now()-start;worker!.postMessage({type:'ack',id});
        }else if(m.type==='block'){
          const r=plan.logical[block];if(!r||m.index!==block||m.emitted!==blockTiles||m.total!==Math.ceil(r.w/256)*Math.ceil(r.h/256)||m.emitted>m.total||m.pixels!==pixels+r.w*r.h)throw Error('Invalid transform block receipt');
          pixels=m.pixels;block++;blockTiles=0;onProgress(block/plan.logical.length);
        }else if(m.type==='done'){
          if(block!==plan.logical.length||pixels!==plan.output.w*plan.output.h||m.pixels!==pixels||JSON.stringify(m.output)!==JSON.stringify(plan.output)||!Number.isFinite(m.computeMs))throw Error('Incomplete transform result');
          metrics.computeMs=m.computeMs;metrics.computeWallMs=m.computeWallMs;finish();
        }else if(m.type==='error')finish(Error(m.message));
        else throw Error('Unknown transform worker message');
      }catch(error){finish(error instanceof Error?error:Error(String(error)));}
    };
    void(async()=>{
      try{
        const initialized=wait();startupTimer=setTimeout(()=>finish(new TransformWorkerUnavailable('Transform worker startup timed out')),5000);
        worker!.postMessage({type:'init',id,plan});await initialized;
        for(const [key,tile]of source.tiles){
          if(closed)return;
          const start=performance.now(),data=tile.data.slice() as Uint8ClampedArray;
          const unit=performance.now()-start;metrics.packMs+=unit;metrics.maxPackUnitMs=Math.max(metrics.maxPackUnitMs,unit);
          metrics.peakInFlightBytes=Math.max(metrics.peakInFlightBytes,data.byteLength);
          const acknowledged=wait(),sent=performance.now();worker!.postMessage({type:'source',id,key,data},[data.buffer]);await acknowledged;
          metrics.transferWaitMs+=performance.now()-sent;
          // Even an immediately acknowledged test/backend must yield between private tile copies.
          await new Promise(resolve=>setTimeout(resolve,0));
        }
        if(!closed)worker!.postMessage({type:'start',id});
      }catch(error){finish(error instanceof Error?error:Error(String(error)));}
    })();
  }catch(error){finish(new TransformWorkerUnavailable(String(error)));}
  return {promise,metrics,cancel:()=>{metrics.cancelled=true;finish(Error('Transform cancelled'));}};
}
