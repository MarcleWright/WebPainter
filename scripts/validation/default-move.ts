import { CelenneDocument } from '../../src/document/document';
import { createPixelLayer, createMask, createAdjustmentLayer } from '../../src/document/layerFactory';
import { TiledRaster } from '../../src/image-engine/tiledRaster';
import { defaultAdjustment } from '../../src/adjustments/types';
import type { Editor } from '../../src/app/editor';
import type { ToolPointer } from '../../src/tools/tool';
export async function run() {
 const e=(globalThis as unknown as {__celenneEditor:Editor}).__celenneEditor;
 const gpu=(globalThis as unknown as {__celenneGpu:{current():{compositor:{stats:{gpuPreviews:number};floatingAtlasUploads:number}}}}).__celenneGpu.current();
 const frame=()=>new Promise(requestAnimationFrame), out=[];
 const pt=(x:number,y:number):ToolPointer=>({x,y,sx:x,sy:y,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,shift:false,alt:false,mod:false,pointerType:'mouse',time:0,clickCount:1});
 for(const [w,h,effects] of [[1536,1024,false],[3072,1728,false],[1536,1024,true]] as const){
 const doc=new CelenneDocument('Default GPU validation',{width:3840,height:2160,resolution:72,colorMode:'rgb',bitDepth:8});
 const data=new Uint8ClampedArray(3840*2160*4);for(let i=0;i<data.length;i+=4){data[i]=i%251;data[i+1]=(i*3)%255;data[i+2]=(i*7)%255;data[i+3]=255;}
 if(effects)doc.insertLayer(createPixelLayer('background',8,TiledRaster.fromPixels(3840,2160,4,8,data)));
 const l=createPixelLayer('photo',8,TiledRaster.fromPixels(3840,2160,4,8,data));doc.insertLayer(l);
 if(effects){l.opacity=.65;l.blendMode='multiply';l.mask=createMask(true);l.mask.raster.writeFloat({x:0,y:0,w:3840,h:2160},Float32Array.from({length:3840*2160},(_,i)=>[0,.5,1][Math.floor(i%3840/128)%3]));const a=defaultAdjustment('curves');if(a.type==='curves')a.rgb=[{x:0,y:0},{x:128,y:160},{x:255,y:255}];doc.insertLayer(createAdjustmentLayer(a,'Curves'));}
 const s=e.addDocument(doc);s.setActive(l.id);s.fitted=true;s.view.zoom=.25;s.view.panX=0;s.view.panY=0;
 doc.selection.setRegion({x:128,y:128,w,h},new Float32Array(w*h).fill(1));e.setTool('move');await frame();await frame();
 const host=e.hostFactory!()!,t=e.tool('move')!;const rv=l.raster.version,sv=doc.selection.version,before=gpu.compositor.stats.gpuPreviews, uploads=gpu.compositor.floatingAtlasUploads;
 t.down!(host,pt(200,200));for(let k=1;k<=12;k++){t.move!(host,pt(200+k*3,200+k*2));await frame();}
 const hit=!!s.engine.getOverride(l.id)?.gpu?.floating,zero=l.raster.version===rv&&doc.selection.version===sv;
 const result=e.finishMove(s);const count=s.history.entries.length;t.up!(host,pt(236,224));
 s.view.zoom=1;host.redraw();await frame();await frame();
 out.push({w,h,effects,hit,zero,result,duplicateUp:s.history.entries.length===count,floatUploads:gpu.compositor.floatingAtlasUploads-uploads,gpuPreviews:gpu.compositor.stats.gpuPreviews-before});e.removeSession(s.id);
 }
 return {production:!('__celenneTest' in globalThis),autosaveMinutes:e.prefs.general.autosaveMinutes,cases:out};
}
