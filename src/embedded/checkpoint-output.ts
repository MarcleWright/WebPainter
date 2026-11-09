import type {CelenneDocument} from '../document/document';
import {checkpointWire} from './checkpoint-wire';
import {encodeNative} from '../document/native';
import {exporters} from '../formats/registry';
/** A single bounded worker per output. No live buffers are transferred or detached. */
export async function checkpointOutput(document:CelenneDocument,kind:'native'|'generation'|'preview'):Promise<{bytes:Uint8Array;preview?:Uint8Array}>{
 if(typeof Worker==='undefined'){if(kind==='preview')throw Error('Preview worker unavailable');const bytes=encodeNative(document);return{bytes,preview:kind==='generation'?await exporters.find(x=>x.id==='png')!.export(document,{}):undefined};}
 const workerStart=performance.now();const worker=new Worker(new URL('./checkpoint-worker.ts',import.meta.url),{type:'module'});
 performance.measure('wp:checkpoint:worker-create',{start:workerStart,duration:performance.now()-workerStart});
 try{return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Checkpoint worker timed out')),120000);worker.onmessage=e=>{clearTimeout(timer);for(const [name,duration]of Object.entries(e.data.timings??{}))performance.measure('wp:checkpoint:worker-'+name,{start:performance.now(),duration:duration as number});e.data.error?reject(Error(e.data.error)):resolve(e.data);};worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};const wireStart=performance.now(),wire=checkpointWire(document);performance.measure('wp:checkpoint:wire',{start:wireStart,duration:performance.now()-wireStart});const postStart=performance.now();worker.postMessage({kind,document:wire});performance.measure('wp:checkpoint:worker-copy',{start:postStart,duration:performance.now()-postStart});});}finally{worker.terminate();}
}
