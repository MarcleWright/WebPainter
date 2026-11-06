/** One deterministic native v1 4K probe; no user files or host application. */
import { performance } from 'node:perf_hooks';
import { encodeNative, decodeNative } from '../src/document/native';
import { CelenneDocument } from '../src/document/document';
import { createPixelLayer, createMask, createTextLayer, createAdjustmentLayer, createGroupLayer } from '../src/document/layerFactory';
import { defaultAdjustment } from '../src/adjustments/types';
import { TiledRaster } from '../src/image-engine/tiledRaster';
const d=new CelenneDocument('Native 4K six-layer sketch',{width:4096,height:4096,resolution:72,colorMode:'rgb',bitDepth:8});
const pixels=new Uint8ClampedArray(4096*4096*4);
for(let y=0;y<4096;y++)for(let x=0;x<4096;x++){const i=(y*4096+x)*4;pixels[i]=(x*7+y*3)%256;pixels[i+1]=(x^y)%256;pixels[i+2]=(x*3+y*11)%256;pixels[i+3]=(x+y)%9?255:128;}
const p=createPixelLayer('Nonuniform reference',8,TiledRaster.fromPixels(4096,4096,4,8,pixels));d.insertLayer(p);p.mask=createMask(true);p.mask.raster.writeFloat({x:100,y:100,w:512,h:512},new Float32Array(512*512).fill(.5));
const group=createGroupLayer('Sketch');d.insertLayer(group);
for(let j=0;j<2;j++){const l=createPixelLayer('Sketch '+j,8);l.raster.writeFloat({x:400+j*30,y:900,w:1500,h:24},new Float32Array(1500*24*4).fill(.45));d.insertLayer(l,group);}
d.insertLayer(createTextLayer('Native 4K',8,100,100));const curves=defaultAdjustment('curves');if(curves.type==='curves')curves.rgb=[{x:0,y:0},{x:128,y:148},{x:255,y:255}];d.insertLayer(createAdjustmentLayer(curves));
const t=performance.now(),bytes=encodeNative(d),encoded=performance.now(),copy=decodeNative(bytes).doc,decoded=performance.now();
let tiles=0;for(const l of d.allLayers())if('raster'in l){const r=(copy.getLayer(l.id) as typeof l).raster;for(const[k,tile]of l.raster.tiles){if(Buffer.compare(Buffer.from(tile.data.buffer,tile.data.byteOffset,tile.data.byteLength),Buffer.from(r.tiles.get(k)!.data.buffer))!==0)throw Error('Pixel mismatch');tiles++;}}
console.log(JSON.stringify({width:d.width,height:d.height,layers:d.layerCount(),bytes:bytes.length,encodeMs:encoded-t,decodeMs:decoded-encoded,verifiedPixelTiles:tiles,processLifetimeMaxRssKiB:process.resourceUsage().maxRSS,memoryAfter:process.memoryUsage(),limit:'synchronous CPU codec; lifetime RSS includes startup and fixture; not GPU/desktop latency'}));
