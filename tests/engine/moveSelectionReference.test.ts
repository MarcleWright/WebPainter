// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {editor} from '../../src/app/editor';
import type {BitDepth} from '../../src/image-engine/pixels';
import {overlapFeatherFixture,expectFixedOverlap,movePoint} from '../helpers/selectionMove';

// Independent fixed product example, not an oracle recomputed with the implementation formula.
it.each([8,16,32] as BitDepth[])('F1 %i-bit overlap: half left, source-over target and coverage reference',depth=>{
  const {doc,layer,session,host,tool}=overlapFeatherFixture(depth),region={x:1,y:1,w:3,h:1};
  const original=layer.raster.readPixels(region).slice(),mask=doc.selection.mask.readPixels(region).slice();
  tool.down(host,movePoint(6,2));tool.move(host,movePoint(7,2));
  expectFixedOverlap(session.engine.getOverride(layer.id)!.read!(region,0));
  expect(layer.raster.readPixels(region)).toEqual(original);expect(doc.selection.mask.readPixels(region)).toEqual(mask);
  tool.up(host);expectFixedOverlap(layer.raster.readFloat(region));
  const coverage=doc.selection.read(region);for(const [i,value] of [0,.5,.25].entries())expect(Math.abs(coverage[i]-value)).toBeLessThanOrEqual(1/255+1e-6);
  expect(session.history.index).toBe(1);session.history.undo();expect(layer.raster.readPixels(region)).toEqual(original);expect(doc.selection.mask.readPixels(region)).toEqual(mask);
  session.history.redo();expectFixedOverlap(layer.raster.readFloat(region));editor.removeSession(session.id);
});
