import type {CelenneDocument} from '../document/document';
import {checkpointWire,tileSlots} from './checkpoint-wire';
/** Copied tiles belong exclusively to the worker. Live/COW/history buffers are never transferred. */
export async function checkpointOutput(document:CelenneDocument,kind:'native'|'generation'):Promise<{bytes:Uint8Array;preview?:Uint8Array}>{
 const created=performance.now();const worker=new Worker(new URL('./checkpoint-worker.ts',import.meta.url),{type:'module'});
 performance.measure('wp:checkpoint:worker-create',{start:created,duration:performance.now()-created});
 let failure:Error|null=null;
 let resolve!:(v:any)=>void,reject!:(e:Error)=>void;
 const response=()=>failure?Promise.reject(failure):new Promise<any>((r,j)=>{resolve=r;reject=j;});
 const fail=(e:Error)=>{failure=e;reject(e);};
 let wait=response();
 const timer=setTimeout(()=>{fail(Error('Checkpoint worker timed out'));worker.terminate();},120000);
 worker.onmessage=e=>{e.data.error?fail(Error(e.data.error)):resolve(e.data);};worker.onerror=e=>fail(Error(e.message));
 try{
  const wired=performance.now();const wire=checkpointWire(document),slots=tileSlots(wire),sources=slots.map(s=>s[1]);for(const s of slots)s[1]=null;performance.measure('wp:checkpoint:wire',{start:wired,duration:performance.now()-wired});
  const posted=performance.now();worker.postMessage({type:'start',document:wire});performance.measure('wp:checkpoint:metadata-transfer',{start:posted,duration:performance.now()-posted});await wait;
  for(let offset=0;offset<sources.length;){
   wait=response();const start=performance.now(),batch:any[]=[];let bytes=0;
   do{const data=sources[offset];const copy=data.slice();batch.push(copy);bytes+=copy.byteLength;offset++;}while(offset<sources.length&&bytes<1024*1024&&performance.now()-start<3);
   worker.postMessage({type:'tiles',offset:offset-batch.length,tiles:batch},batch.map(b=>b.buffer));
   performance.measure('wp:checkpoint:tile-batch',{start,duration:performance.now()-start});await wait;
   await new Promise<void>(r=>setTimeout(r,0));
  }
  wait=response();worker.postMessage({type:'encode',kind});const result=await wait;
  for(const [name,duration]of Object.entries(result.timings??{}))performance.measure('wp:checkpoint:worker-'+name,{start:performance.now(),duration:duration as number});
  return{bytes:result.bytes,preview:result.preview};
 }finally{clearTimeout(timer);worker.terminate();}
}
