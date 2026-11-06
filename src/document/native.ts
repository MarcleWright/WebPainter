/** Native v1: explicit bounded manifest + checksummed raw binary blocks. Never serializes a live object graph. */
import { CelenneDocument } from './document';
import { snapshotDocument } from './clone';
import { defaultAdvanced, createPixelLayer } from './layerFactory';
import { Tile, TiledRaster, TILE_SIZE, keyToTile, nextGen } from '../image-engine/tiledRaster';
import type { GroupLayer, Layer } from './types';
import * as v from './native-validation';

export const NATIVE_VERSION = 1;
export const NATIVE_MIME = 'application/vnd.webpainter.document';
export const NATIVE_LIMITS = { bytes: 512 * 1024 * 1024, manifest: 4 * 1024 * 1024, layers: 256, blocks: 8192, pixels: 8192 * 8192 } as const;
export function createNative(width:number,height:number,name='Untitled'):Uint8Array {
  const doc=new CelenneDocument(name,{width,height,resolution:72,colorMode:'rgb',bitDepth:8});doc.insertLayer(createPixelLayer('Sketch',8));return encodeNative(doc);
}
const MAGIC = new TextEncoder().encode('WPNAT001'), HEADER = 20;
const crcTable = Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function nativeChecksum(bytes: Uint8Array): number { let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0; }
export function isNative(bytes: Uint8Array): boolean { return MAGIC.every((b,i)=>bytes[i]===b); }
type Block = { length: number; checksum: number };

/** Caller stabilizes temporary tools. This synchronous COW checkpoint precedes all encoding. */
export function encodeNative(document: CelenneDocument): Uint8Array {
  v.check(!document.channels.length && !document.smartSources.size && !document.patterns.size && !document.slices.length && !Object.keys(document.psd).length, 'channels, patterns, smart sources, slices or PSD preservation unsupported');
  const doc = snapshotDocument(document), blocks: Uint8Array[] = [];
  v.check(doc.canvas.colorMode === 'rgb' && doc.canvas.bitDepth === 8, 'only RGB8 supported');
  v.check(!doc.channels.length && !doc.smartSources.size && !doc.patterns.size && !doc.slices.length && !Object.keys(doc.psd).length, 'channels, patterns, smart sources, slices or PSD preservation unsupported');
  const put = (bytes: Uint8Array) => { const index=blocks.length; blocks.push(bytes); return index; };
  const raster = (r: TiledRaster) => {
    v.check(r.depth===8 && !r.companion, 'only RGB8/8-bit masks supported');
    return { channels:r.channels, fill:r.fill, tiles:[...r.tiles].map(([key,t])=>{
      v.check(t.data instanceof Uint8ClampedArray && t.data.length===r.tileLength,'tile storage mismatch');
      return [key,put(new Uint8Array(t.data.buffer,t.data.byteOffset,t.data.byteLength))];
    }) };
  };
  const layer = (l: Layer): any => {
    v.check(l.effects === null && !l.metadata.unsupported.length && !Object.keys(l.metadata.psd??{}).length, 'layer effects/PSD preservation unsupported');
    const advanced=defaultAdvanced();
    v.check(Object.keys(l.advanced).length===Object.keys(advanced).length && Object.entries(advanced).every(([k,x])=>JSON.stringify((l.advanced as any)[k])===JSON.stringify(x)), 'advanced blending unsupported');
    const base:any={ id:l.id,name:l.name,kind:l.kind,visible:l.visible,opacity:l.opacity,fillOpacity:l.fillOpacity,blendMode:l.blendMode,locks:structuredClone(l.locks),clipping:l.clipping,x:l.x,y:l.y,
      mask:l.mask?{...l.mask,raster:raster(l.mask.raster)}:null,vectorMask:l.vectorMask?structuredClone(l.vectorMask):null,colorTag:l.colorTag,
      metadata:{unsupported:[],...(l.metadata.custom?{custom:structuredClone(l.metadata.custom)}:{})} };
    switch(l.kind){
      case 'pixel':return{...base,raster:raster(l.raster)};
      case 'group':return{...base,expanded:l.expanded,children:l.children.map(layer)};
      case 'text':v.check(!l.psdPathText,'unsupported PSD path text');return{...base,text:structuredClone(l.text),raster:raster(l.raster),usingPreservedPixels:l.usingPreservedPixels,missingFonts:[...l.missingFonts]};
      case 'shape':return{...base,path:structuredClone(l.path),origin:structuredClone(l.origin),fill:structuredClone(l.fill),stroke:structuredClone(l.stroke),raster:raster(l.raster),usingPreservedPixels:l.usingPreservedPixels};
      case 'adjustment':return{...base,adjustment:structuredClone(l.adjustment)};
      case 'fill':return{...base,fill:structuredClone(l.fill)};
      default:return v.fail(`unsupported layer ${l.kind}`);
    }
  };
  const root=layer(doc.root);
  const profile={...doc.profile,icc:doc.profile.icc?put(doc.profile.icc):null};
  const manifest={schemaVersion:1,id:doc.id,name:doc.name,canvas:doc.canvas,profile,root,paths:doc.paths,guides:doc.guides,metadata:doc.metadata,
    rulerOrigin:doc.rulerOrigin,rulerUnit:doc.rulerUnit,grid:doc.grid,globalLight:doc.globalLight,
    blocks:blocks.map(bytes=>({length:bytes.length,checksum:nativeChecksum(bytes)}))};
  // Encoder and decoder enforce exactly the same supported data contract.
  validateManifest(manifest);
  const json=new TextEncoder().encode(JSON.stringify(manifest));
  v.check(json.length<=NATIVE_LIMITS.manifest,'manifest too large');
  const payload=blocks.reduce((n,b)=>n+b.length,0), total=HEADER+json.length+payload;
  v.check(total<=NATIVE_LIMITS.bytes,'file too large');
  const out=new Uint8Array(total), header=new DataView(out.buffer);
  out.set(MAGIC);header.setUint32(8,json.length,true);header.setUint32(12,nativeChecksum(json),true);header.setUint32(16,payload,true);out.set(json,HEADER);
  let offset=HEADER+json.length;for(const b of blocks){out.set(b,offset);offset+=b.length;}
  return out;
}
function validateManifest(m:any): void {
  v.json(m);
  v.object(m,['schemaVersion','id','name','canvas','profile','root','paths','guides','metadata','rulerOrigin','rulerUnit','grid','globalLight','blocks']);
  v.check(m.schemaVersion===1,'unsupported version');v.string(m.id,256);v.check(m.id.length>0,'empty document ID');v.string(m.name,1000);
  v.object(m.canvas,['width','height','resolution','colorMode','bitDepth']);v.integer(m.canvas.width,1,16384);v.integer(m.canvas.height,1,16384);v.check(m.canvas.width*m.canvas.height<=NATIVE_LIMITS.pixels,'canvas pixel limit');v.number(m.canvas.resolution,1,9600);v.check(m.canvas.colorMode==='rgb'&&m.canvas.bitDepth===8,'only RGB8 supported');
  v.object(m.profile,['name','builtin','icc','untagged'],['name','icc']);v.string(m.profile.name,1000);if(m.profile.builtin!==undefined)v.choice(m.profile.builtin,['srgb','displayP3','adobeRGB','proPhotoRGB','linearSRGB']);if(m.profile.untagged!==undefined)v.choice(m.profile.untagged,[true,false]);
  v.array(m.blocks,NATIVE_LIMITS.blocks,b=>{v.object(b,['length','checksum']);v.integer(b.length,1,4*1024*1024);v.integer(b.checksum,0,0xffffffff);});
  v.check(m.blocks.reduce((n:number,b:Block)=>n+b.length,0)<=NATIVE_LIMITS.bytes,'block byte limit');
  const used=new Set<number>();
  const block=(i:any,length?:number)=>{v.integer(i,0,m.blocks.length-1);v.check(!used.has(i),'duplicate block reference');used.add(i);if(length!==undefined)v.check(m.blocks[i].length===length,'tile block size');};
  if(m.profile.icc!==null){block(m.profile.icc);v.check(m.blocks[m.profile.icc].length<=4*1024*1024,'ICC limit');}
  const raster=(r:any,channels:number)=>{
    v.object(r,['channels','fill','tiles']);v.check(r.channels===channels,'raster channel count');v.number(r.fill,0,1);const keys=new Set<number>();
    v.array(r.tiles,8192,t=>{v.check(Array.isArray(t)&&t.length===2,'tile descriptor');v.integer(t[0],0,0xffffffff);const [x,y]=keyToTile(t[0]);v.integer(x,-256,255);v.integer(y,-256,255);v.check(!keys.has(t[0]),'duplicate tile');keys.add(t[0]);block(t[1],TILE_SIZE*TILE_SIZE*channels);});
  };
  let count=0;const ids=new Set<string>();
  const layer=(l:any,depth:number)=>{
    v.check(++count<=NATIVE_LIMITS.layers && depth<=16,'layer tree limit');v.layerData(l);v.check(!ids.has(l.id),'duplicate layer ID');ids.add(l.id);
    if(l.mask)raster(l.mask.raster,1);if(l.raster)raster(l.raster,4);
    if(l.kind==='group')v.array(l.children,NATIVE_LIMITS.layers,c=>layer(c,depth+1));
  };
  v.check(m.root?.kind==='group' && m.root.id==='root','root group required');layer(m.root,0);v.check(used.size===m.blocks.length,'unreferenced block');
  const pathIds=new Set<string>();v.array(m.paths,256,p=>{v.object(p,['id','name','kind','path']);v.string(p.id,256);v.check(!pathIds.has(p.id),'duplicate path');pathIds.add(p.id);v.string(p.name,1000);v.choice(p.kind,['work','saved','clipping']);v.path(p.path);});
  v.array(m.guides,1024,g=>{v.object(g,['id','orientation','position']);v.string(g.id,256);v.choice(g.orientation,['horizontal','vertical']);v.number(g.position);});
  v.object(m.metadata,['title','author','description','keywords','copyright','copyrighted','url','xmp','created','modified'],[]);
  for(const [k,x]of Object.entries(m.metadata)){if(k==='keywords')v.array(x,100,a=>v.string(a,1000));else if(k==='copyrighted')v.choice(x,[true,false]);else v.string(x,100000);}
  v.object(m.rulerOrigin,['x','y']);v.number(m.rulerOrigin.x);v.number(m.rulerOrigin.y);v.choice(m.rulerUnit,['px','in','cm','mm','pt','pica','percent']);
  v.object(m.grid,['spacing','unit','subdivisions','color','style']);v.number(m.grid.spacing,.001,1e6);v.integer(m.grid.subdivisions,1,1000);v.choice(m.grid.unit,['px','in','cm','mm','pt','pica','percent']);v.choice(m.grid.style,['lines','dashed','dots']);v.object(m.grid.color,['r','g','b','a']);for(const x of Object.values(m.grid.color))v.number(x,0,1);
  v.object(m.globalLight,['angle','altitude']);v.number(m.globalLight.angle,-360,360);v.number(m.globalLight.altitude,-90,90);
}
function readNative(bytes: Uint8Array):{manifest:any;blocks:Uint8Array[]} {
  v.check(bytes instanceof Uint8Array && bytes.length>=HEADER && bytes.length<=NATIVE_LIMITS.bytes && isNative(bytes),'invalid header/size');
  const header=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=header.getUint32(8,true),payload=header.getUint32(16,true);
  v.check(length>0 && length<=NATIVE_LIMITS.manifest && HEADER+length+payload===bytes.length,'truncated/trailing data');
  const json=bytes.subarray(HEADER,HEADER+length);v.check(nativeChecksum(json)===header.getUint32(12,true),'manifest checksum');
  const m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(json));validateManifest(m);
  v.check(m.blocks.reduce((n:number,b:Block)=>n+b.length,0)===payload,'payload length mismatch');
  let offset=HEADER+length;const blocks=m.blocks.map((b:Block)=>{const data=bytes.subarray(offset,offset+b.length);offset+=b.length;v.check(nativeChecksum(data)===b.checksum,'block checksum');return data;});
  return{manifest:m,blocks};
}
/** Inspect the same validated format without allocating raster copies; source identities are opaque to WP. */
export function inspectNative(bytes:Uint8Array):{id:string;width:number;height:number;layerCount:number;sources:{id:string;hash:string}[]} {
  const {manifest:m}=readNative(bytes),sources:{id:string;hash:string}[]=[];let layerCount=0;
  const visit=(l:any)=>{layerCount++;if(l.metadata.custom?.source)sources.push({...l.metadata.custom.source});if(l.kind==='group')l.children.forEach(visit);};visit(m.root);
  return{id:m.id,width:m.canvas.width,height:m.canvas.height,layerCount:layerCount-1,sources};
}
export function decodeNative(bytes: Uint8Array): { doc:CelenneDocument; requiredFonts:string[]; warnings:string[] } {
  const {manifest:m,blocks}=readNative(bytes);
  const raster=(r:any)=>{const out=new TiledRaster(r.channels,8,r.fill);for(const [key,index]of r.tiles)out.tiles.set(key,new Tile(new Uint8ClampedArray(blocks[index]),nextGen()));return out;};
  const requiredFonts=new Set<string>(),warnings:string[]=[];
  const layer=(data:any,parent:GroupLayer|null):Layer=>{
    const out:any={...data,parent,rev:0,effects:null,advanced:defaultAdvanced()};
    if(data.mask)out.mask={...data.mask,raster:raster(data.mask.raster)};if(data.raster)out.raster=raster(data.raster);
    if(data.kind==='group')out.children=data.children.map((c:any)=>layer(c,out));
    if(data.kind==='text'){for(const r of data.text.runs)requiredFonts.add(r.style.fontFamily);for(const f of data.missingFonts)warnings.push(`Missing font: ${f}; saved appearance retained until edited`);}
    return out;
  };
  const doc=new CelenneDocument(m.name,m.canvas,m.id);doc.root=layer(m.root,null) as GroupLayer;
  doc.profile={...m.profile};delete (doc.profile as any).icc;if(m.profile.icc!==null)doc.profile.icc=new Uint8Array(blocks[m.profile.icc]);
  doc.paths=m.paths;doc.guides=m.guides;doc.metadata=m.metadata;doc.rulerOrigin=m.rulerOrigin;doc.rulerUnit=m.rulerUnit;doc.grid=m.grid;doc.globalLight=m.globalLight;doc.fileFormat='wpnative';
  return{doc,requiredFonts:[...requiredFonts],warnings};
}
