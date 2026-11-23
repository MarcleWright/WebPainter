import {reviveCheckpoint,tileSlots} from './checkpoint-wire';
import {decodeNative,encodeNative} from '../document/native';
import {flattenToPixels} from '../rendering/flatten';
import {renderAlignedRasterThumbnail,renderCompositeThumbnail} from '../rendering/thumbnail';
import {builtinProfileICC} from '../color/icc';
import {embedJpegICC,encodePNG,encodeWithPlatform} from '../formats/codecs';
import {supportsDirectNativePreview} from './preview-engine';
type WorkerBrowser = WorkerNavigator & { userAgentData?: { brands?: readonly { brand: string; version: string }[] } };
let staged:any,slots:any[]=[];
self.onmessage=async({data:m})=>{try{if(m.type==='start'){staged=m.document;slots=tileSlots(staged);self.postMessage({ready:true});return;}if(m.type==='tiles'){m.tiles.forEach((t:any,i:number)=>slots[m.offset+i][1]=t);self.postMessage({ready:true});return;}if(m.type==='encode'){m.document=staged;staged=null;slots=[];}const d=m.native?decodeNative(m.native).doc:reviveCheckpoint(m.document);let bytes:Uint8Array,preview:Uint8Array|undefined;const sourceHash=m.native?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',m.native)),b=>b.toString(16).padStart(2,'0')).join(''):undefined;const pngOptions={icc:d.profile.icc??(d.profile.builtin?builtinProfileICC(d.profile.builtin):undefined),resolution:d.canvas.resolution};const timings:Record<string,number>={};const start=performance.now();
 if(m.kind==='reference'){
   const p=flattenToPixels(d,{depth:8});
   timings.referenceComposite=performance.now()-start;
   const encodeStart=performance.now();
   bytes=await encodeWithPlatform(p.width,p.height,p.data as Uint8ClampedArray,'image/jpeg',0.95,[255,255,255]);
   if (bytes[0]!==0xff||bytes[1]!==0xd8) throw Error('JPEG encoder is unavailable');
   // Native boards are RGB8. Preserve an assigned RGB profile in the uploaded bytes.
   if(d.canvas.colorMode==='rgb'&&pngOptions.icc)bytes=embedJpegICC(bytes,pngOptions.icc);
   timings.referenceJpeg=performance.now()-encodeStart;
 }
 else if(m.kind==='preview'){
   const maxEdge=m.maxEdge===undefined?512:m.maxEdge;
   if(maxEdge!==512&&maxEdge!==1024)throw Error('Unsupported native preview edge');
   const browser=navigator as WorkerBrowser;
   let thumbnail:Uint8Array|undefined;
   if(maxEdge===512&&supportsDirectNativePreview(browser.userAgent,browser.userAgentData?.brands)){
     try{
       const small=renderAlignedRasterThumbnail(d);
       if(small){
         thumbnail=encodePNG(small.width,small.height,small.data,8,pngOptions);
         timings.previewDirect=performance.now()-start;
       }
     }catch{/* The optional renderer may fail; use the original preview path. */}
   }
   if(thumbnail)bytes=thumbnail;
   else{
     const image=renderCompositeThumbnail(d,maxEdge);
     bytes=encodePNG(image.width,image.height,image.data,8,pngOptions);
     timings.previewFallback=performance.now()-start;
   }
 }
 else{let t=performance.now();bytes=encodeNative(d);timings.native=performance.now()-t;if(m.kind==='generation'){t=performance.now();const p=flattenToPixels(d,{depth:8});timings.composite=performance.now()-t;t=performance.now();preview=encodePNG(p.width,p.height,p.data as Uint8ClampedArray,8,pngOptions);timings.png=performance.now()-t;}}
 self.postMessage({bytes,preview,sourceHash,timings,ms:performance.now()-start}, {transfer:[bytes.buffer,...(preview?[preview.buffer]:[])]});
 }catch(e){self.postMessage({error:String(e)});}};
