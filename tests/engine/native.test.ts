import { describe, expect, it } from 'vitest';
import { encodeNative, decodeNative, nativeChecksum, inspectNative, createNative } from '../../src/document/native';
import { newDoc, add, solidLayer } from '../helpers/build';
import { createAdjustmentLayer, createGroupLayer, createMask, createShapeLayer, createTextLayer, createFillLayer } from '../../src/document/layerFactory';
import { defaultAdjustment } from '../../src/adjustments/types';
import { knot } from '../../src/vector/types';
import { flattenToPixels } from '../../src/rendering/flatten';
import { DocumentSession } from '../../src/app/session';
import { SetLayerPropsCommand } from '../../src/commands/layerCommands';
import { TiledRaster } from '../../src/image-engine/tiledRaster';
import { exportPsd } from '../../src/psd/export';
import { importPsd } from '../../src/psd/import';
const sameBytes=(a:Uint8Array,b:Uint8Array)=>Buffer.compare(Buffer.from(a),Buffer.from(b))===0;

function fixture() {
  const d=newDoc(32,24,8,'Native 中文 sketch');d.metadata={author:'test',keywords:['native','sketch']};d.profile.icc=new Uint8Array([1,2,3,4]);
  const g=createGroupLayer('group');g.opacity=.8;add(d,g);
  const p=solidLayer(d,'reference',-2,1,32,24,[.15,.5,.7,.6]);p.mask=createMask(true);p.mask.raster.writeFloat({x:0,y:0,w:12,h:10},new Float32Array(120).fill(.35));p.mask.feather=.5;p.mask.density=.8;p.locks.position=true;p.colorTag='blue';p.fillOpacity=.7;p.blendMode='multiply';p.metadata.custom={source:{id:'resource-a',hash:'a'.repeat(64)}};add(d,p,g);
  const t=createTextLayer('汽车 A',8,3,6);t.text.runs[0].style.fontFamily='Deliberately missing font';t.text.runs[0].style.fontSize=18;t.raster=solidLayer(d,'text appearance',0,0,6,5,[1,0,0,.5]).raster;t.usingPreservedPixels=true;t.missingFonts=['Deliberately missing font'];add(d,t);
  const path={fillRule:'evenodd' as const,subpaths:[{closed:true,op:'combine' as const,knots:[knot(1,1),knot(12,2),knot(5,12)]}]};
  const s=createShapeLayer('shape',path,null,8);s.fill={type:'solid',color:{r:0,g:1,b:0}};s.stroke.enabled=true;s.stroke.width=2;add(d,s);
  d.paths.push({id:'path-stable',name:'work path',kind:'saved',path});p.vectorMask={path,enabled:true,invert:false,linked:true,density:.9,feather:0};
  add(d,createFillLayer({type:'solid',color:{r:.3,g:.2,b:.1}},'fill'));
  const a=defaultAdjustment('curves');if(a.type==='curves')a.rgb=[{x:0,y:12},{x:120,y:155},{x:255,y:250}];add(d,createAdjustmentLayer(a));
  d.guides=[{id:'guide-stable',orientation:'vertical',position:7}];return d;
}
function rewrite(bytes:Uint8Array,edit:(m:any)=>void) {
  const old=new DataView(bytes.buffer,bytes.byteOffset,bytes.length),n=old.getUint32(8,true),m=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+n)));edit(m);
  const json=new TextEncoder().encode(JSON.stringify(m)),out=new Uint8Array(bytes.length-n+json.length);out.set(bytes.subarray(0,20));new DataView(out.buffer).setUint32(8,json.length,true);new DataView(out.buffer).setUint32(12,nativeChecksum(json),true);out.set(json,20);out.set(bytes.subarray(20+n),20+json.length);return out;
}
it('round-trips stable identity, all declared fields, alpha/mask tiles, text/path/adjustment and exact small composite; remains editable',()=>{
  const d=fixture(),bytes=encodeNative(d),result=decodeNative(bytes),copy=result.doc;
  expect(copy.id).toBe(d.id);expect(copy.allLayers().map(l=>l.id)).toEqual(d.allLayers().map(l=>l.id));
  expect(inspectNative(bytes)).toMatchObject({id:d.id,width:32,height:24,sources:[{id:'resource-a',hash:'a'.repeat(64)}]});
  expect(sameBytes(encodeNative(copy),bytes)).toBe(true);expect(flattenToPixels(copy).data).toEqual(flattenToPixels(d).data);
  expect(result.requiredFonts).toContain('Deliberately missing font');expect(result.warnings[0]).toMatch(/Missing font/);
  const s=new DocumentSession(copy),p=copy.allLayers().find(l=>l.kind==='pixel')!;const saved=encodeNative(copy);
  s.push(new SetLayerPropsCommand('opacity',p.id,{opacity:p.opacity},{opacity:.25}));expect(s.modified).toBe(true);expect(sameBytes(encodeNative(copy),saved)).toBe(false);
  s.history.undo();expect(sameBytes(encodeNative(copy),saved)).toBe(true);s.history.redo();expect(decodeNative(encodeNative(copy)).doc.getLayer(p.id)?.opacity).toBe(.25);s.dispose();
});
it('creates a valid editable transparent work without a host',()=>{const d=decodeNative(createNative(80,60,'new')).doc;expect(d.allLayers().map(l=>l.kind)).toEqual(['pixel']);expect(d.width).toBe(80);expect(()=>createNative(0,60)).toThrow();});
describe('hostile input never changes an existing document/session',()=>{
  const mutations:Record<string,(m:any)=>void>={
    version:m=>m.schemaVersion=99, dimensions:m=>m.canvas.width=1e9, depth:m=>m.canvas.bitDepth=16, unknown:m=>m.extra=true,
    duplicateLayer:m=>m.root.children.push(m.root.children[0]),layerKind:m=>m.root.children[0].kind='video',
    blockIndex:m=>m.root.children[0].children[0].raster.tiles[0][1]=999999,
    tileLength:m=>m.blocks[0].length=1,duplicateTile:m=>m.root.children[0].children[0].mask.raster.tiles.push(m.root.children[0].children[0].mask.raster.tiles[0]),
    badOpacity:m=>m.root.opacity=2, missingField:m=>delete m.root.locks,
    textRuns:m=>m.root.children[1].text.runs[0].length=100000,
    unknownAdjust:m=>m.root.children[4].adjustment.type='unknown',
  };
  for(const [name,mutate]of Object.entries(mutations))it(name,()=>{
    const d=fixture(),s=new DocumentSession(d),bytes=encodeNative(d),history=s.history.current.id;
    expect(()=>decodeNative(rewrite(bytes,mutate))).toThrow();expect(s.doc).toBe(d);expect(s.history.current.id).toBe(history);expect(sameBytes(encodeNative(d),bytes)).toBe(true);s.dispose();
  });
});
it('rejects truncation, trailing bytes, malformed UTF8 and checksum corruption',()=>{
  const b=encodeNative(fixture());for(const n of [0,7,19,20,b.length-1])expect(()=>decodeNative(b.slice(0,n))).toThrow();
  const more=new Uint8Array(b.length+1);more.set(b);expect(()=>decodeNative(more)).toThrow();
  const corrupt=b.slice();corrupt[corrupt.length-1]^=1;expect(()=>decodeNative(corrupt)).toThrow(/checksum/);
  const json=b.slice();json[22]^=1;expect(()=>decodeNative(json)).toThrow(/checksum/);
});
it('rejects unsupported features instead of silently flattening or dropping them',()=>{
  const d=fixture();d.canvas.bitDepth=16;expect(()=>encodeNative(d)).toThrow(/RGB8/);d.canvas.bitDepth=8;
  const p=d.allLayers()[1];p.effects={} as any;expect(()=>encodeNative(d)).toThrow(/effects/);p.effects=null;
  d.psd={isPsb:true};expect(()=>encodeNative(d)).toThrow(/PSD/);d.psd={};
  d.channels.push({} as any);expect(()=>encodeNative(d)).toThrow(/channels/);
});
it('native is additive: PSD save/import remains independent',async()=>{
  const d=newDoc(20,12);add(d,solidLayer(d,'pixels',0,0,20,12,[.3,.4,.5,.7]));
  const before=exportPsd(d,{}),native=encodeNative(d);const opened=await importPsd(before,'local.psd',{});
  expect(opened.doc.width).toBe(20);expect(opened.doc.allLayers()[0].name).toBe('pixels');expect(decodeNative(native).doc.id).toBe(d.id);
});
