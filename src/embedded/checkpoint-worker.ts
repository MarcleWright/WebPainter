import {reviveCheckpoint} from './checkpoint-wire';
import {decodeNative,encodeNative} from '../document/native';
import {flattenToPixels} from '../rendering/flatten';
import {encodePNG} from '../formats/codecs';
self.onmessage=async({data:m})=>{try{const d=m.native?decodeNative(m.native).doc:reviveCheckpoint(m.document);let bytes:Uint8Array,preview:Uint8Array|undefined;const timings:Record<string,number>={};const start=performance.now();
 if(m.kind==='preview'){const p=flattenToPixels(d,{depth:8}),scale=Math.min(1,512/Math.max(p.width,p.height)),canvas=new OffscreenCanvas(Math.max(1,Math.round(p.width*scale)),Math.max(1,Math.round(p.height*scale))),source=new OffscreenCanvas(p.width,p.height);source.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(p.data),p.width,p.height),0,0);canvas.getContext('2d')!.drawImage(source,0,0,canvas.width,canvas.height);bytes=new Uint8Array(await(await canvas.convertToBlob({type:'image/png'})).arrayBuffer());}
 else{let t=performance.now();bytes=encodeNative(d);timings.native=performance.now()-t;if(m.kind==='generation'){t=performance.now();const p=flattenToPixels(d,{depth:8});timings.composite=performance.now()-t;t=performance.now();preview=encodePNG(p.width,p.height,p.data as Uint8ClampedArray,8);timings.png=performance.now()-t;}}
 self.postMessage({bytes,preview,timings,ms:performance.now()-start}, {transfer:[bytes.buffer,...(preview?[preview.buffer]:[])]});
 }catch(e){self.postMessage({error:String(e)});}};
