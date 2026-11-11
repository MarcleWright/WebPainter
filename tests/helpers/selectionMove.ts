import {expect} from 'vitest';
import {editor} from '../../src/app/editor';
import {MoveTool} from '../../src/tools/moveTool';
import type {ToolHost, ToolPointer} from '../../src/tools/tool';
import {createPixelLayer} from '../../src/document/layerFactory';
import {TiledRaster} from '../../src/image-engine/tiledRaster';
import {Selection} from '../../src/selection/selection';
import type {BitDepth} from '../../src/image-engine/pixels';
import {add,newDoc} from './build';

export const movePoint=(x:number,y:number):ToolPointer=>({x,y,sx:x,sy:y,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,shift:false,alt:false,mod:false,pointerType:'mouse',time:0,clickCount:1});
export function fragmentFixture(depth:BitDepth=8) {
  const doc=newDoc(64,24,depth), raster=new TiledRaster(4,depth);
  // Offset layer, low-alpha ring with a transparent hole and a second, unselected figure.
  const data=new Float32Array(5*5*4);
  for(let y=0;y<5;y++)for(let x=0;x<5;x++){const i=(y*5+x)*4;data[i]=1;data[i+3]=x===2&&y===2?0:.25;}
  raster.writeFloat({x:2,y:2,w:5,h:5},data);
  raster.writeFloat({x:40,y:2,w:1,h:1},new Float32Array([0,1,0,1]));
  const layer=createPixelLayer('fragment',depth,raster);layer.x=3;layer.y=2;add(doc,layer);
  const session=editor.addDocument(doc);session.setActive(layer.id);
  doc.selection.combine({x:4,y:3,w:7,h:7},new Float32Array(49).fill(1),'replace');
  const host:ToolHost={editor,session,redraw(){},setCursor(){},viewportSize:()=>({w:200,h:100})};
  return {doc,layer,session,host,tool:new MoveTool(),region:{x:0,y:0,w:64,h:24}};
}

/** Same no-write preview lifecycle is required on both backends, including silent replacements. */
export async function checkFragmentOwnership(render?: (f:ReturnType<typeof fragmentFixture>)=>Promise<void>) {
  for(const change of ['pixels','selection','raster','mask','selectionObject','layer','override','session']) for(const tail of ['move','up','cancel']) {
    const f=fragmentFixture(),{tool,host,doc,layer,session,region}=f;
    const index=session.history.index;
    tool.down(host,movePoint(50,16));tool.move(host,movePoint(60,16));
    expect(session.engine.getOverride(layer.id)).toBeTruthy();expect(doc.selection.previewOutline).toBeTruthy();
    if(render)await render(f);
    let replacement: object|undefined;
    if(change==='pixels')layer.raster.writeFloat({x:0,y:0,w:1,h:1},new Float32Array([0,0,1,1]));
    if(change==='selection')doc.selection.setRegion({x:0,y:0,w:1,h:1},new Float32Array([.75]));
    if(change==='raster')layer.raster=layer.raster.clone();
    if(change==='mask')doc.selection.mask=doc.selection.mask.clone();
    if(change==='selectionObject'){const next=new Selection();next.mask=doc.selection.mask.clone();doc.selection=next;}
    if(change==='layer')doc.removeLayer(layer);
    if(change==='override'){replacement={read:()=>new Float32Array(4)};session.engine.setOverride(layer.id,replacement);}
    if(change==='session')editor.addDocument(newDoc(8,8));
    const raster=layer.raster,mask=doc.selection.mask,pixels=raster.readPixels(region).slice(),selection=mask.readPixels(region).slice();
    if(tail==='move')tool.move(host,movePoint(62,17));
    if(tail==='up')tool.up(host);
    if(tail==='cancel')tool.cancel(host);
    tool.move(host,movePoint(63,18));tool.up(host);tool.cancel(host);
    expect(layer.raster).toBe(raster);expect(doc.selection.mask).toBe(mask);
    expect(raster.readPixels(region)).toEqual(pixels);expect(mask.readPixels(region)).toEqual(selection);
    expect(session.history.index).toBe(index);expect(doc.selection.previewOutline).toBeNull();
    expect(session.engine.getOverride(layer.id)).toBe(replacement);
    if(change==='layer')expect(doc.getLayer(layer.id)).toBeNull();
    for(const s of [...editor.sessions])editor.removeSession(s.id);
  }
}
