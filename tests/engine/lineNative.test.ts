// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {editor} from '../../src/app/editor';
import {ShapeTool} from '../../src/tools/shapeTools';
import type {ToolHost,ToolPointer} from '../../src/tools/tool';
import {createNative,decodeNative,encodeNative} from '../../src/document/native';
import {flattenToPixels} from '../../src/rendering/flatten';
import {pathFromOrigin} from '../../src/vector/shapes';
import {commitAppearance} from '../../src/app/ops/layerOps';
import {ui} from '../../src/app/store';
export const pointer=(x:number,y:number):ToolPointer=>({x,y,sx:x,sy:y,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,shift:false,alt:false,mod:false,pointerType:'mouse',time:1,clickCount:1});
afterEach(()=>{for(const s of [...editor.sessions])editor.removeSession(s.id);});
for(const [x,y] of [[10,10],[70,10],[10,70],[70,70],[10,40],[70,40],[40,10],[40,70]])it(`real line to ${x},${y} preserves signed geometry/composite and remains editable after native reopen`,()=>{
 ui.setToolOptions('shape',{mode:'shape',lineWeight:4,strokeWidth:0});const s=editor.addDocument(decodeNative(createNative(96,96)).doc),h={editor,session:s,redraw(){},setCursor(){},viewportSize:()=>({w:96,h:96})} as ToolHost,t=new ShapeTool('line');t.down(h,pointer(40,40));t.up(h,pointer(x,y));
 const l=s.activeLayer()!;if(l.kind!=='shape')throw Error('Expected editable shape');expect(l.origin).toMatchObject({kind:'line',x:40,y:40,w:x-40,h:y-40});expect(l.path).toEqual(pathFromOrigin(l.origin!));const before=flattenToPixels(s.doc).data,copy=decodeNative(encodeNative(s.doc)).doc,shape=copy.getLayer(l.id)!;expect(shape.kind).toBe('shape');if(shape.kind!=='shape')throw Error();expect(shape.origin).toEqual(l.origin);expect(shape.path).toEqual(l.path);expect(flattenToPixels(copy).data).toEqual(before);
 editor.removeSession(s.id);const reopened=editor.addDocument(copy);commitAppearance(reopened,shape.id,'Edit line endpoint',layer=>{if(layer.kind==='shape'){layer.origin={...layer.origin!,w:layer.origin!.w-5};layer.path=pathFromOrigin(layer.origin);}});expect(reopened.modified).toBe(true);const edited=encodeNative(copy);expect(decodeNative(edited).doc.getLayer(shape.id)).toMatchObject({kind:'shape',origin:{w:x-45,h:y-40}});reopened.history.undo();expect(flattenToPixels(copy).data).toEqual(before);reopened.history.redo();expect(encodeNative(copy)).toEqual(edited);
});
it('negative dimensions remain invalid for non-line shapes; nonfinite line geometry remains invalid',()=>{
 const s=editor.addDocument(decodeNative(createNative(96,96)).doc),h={editor,session:s,redraw(){}} as ToolHost,t=new ShapeTool('line');t.down(h,pointer(40,40));t.up(h,pointer(10,10));const l=s.activeLayer()!;if(l.kind!=='shape')throw Error();l.origin!.kind='rectangle';expect(()=>encodeNative(s.doc)).toThrow();l.origin!.kind='line';l.origin!.w=Infinity;expect(()=>encodeNative(s.doc)).toThrow();
});
