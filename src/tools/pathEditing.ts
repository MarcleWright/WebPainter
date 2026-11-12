import type {ToolHost, ToolPointer} from './tool';
import type {DocumentSession} from '../app/session';
import type {Layer} from '../document/types';
import type {PathKnot,VectorPath} from '../vector/types';
import {clonePath} from '../vector/types';
import {LambdaCommand, ReplaceLayerCommand} from '../commands/layerCommands';
import {cloneLayer} from '../document/clone';
import {renderShapeLayer} from '../layers/appearance';
import {newId} from '../document/ids';

export type PathTarget =
  | { kind: 'shape'; layerId: string }
  | { kind: 'vectorMask'; layerId: string }
  | { kind: 'path'; pathId: string };

export function getTarget(s: DocumentSession, create: boolean): PathTarget | null {
  const l = s.activeLayer();
  if (l?.kind === 'shape') return { kind: 'shape', layerId: l.id };
  if (l?.vectorMask && !s.activePathId) return { kind: 'vectorMask', layerId: l.id };
  const byId = s.activePathId ? s.doc.paths.find((p) => p.id === s.activePathId) : null;
  if (byId) return { kind: 'path', pathId: byId.id };
  const work = s.doc.paths.find((p) => p.kind === 'work');
  if (work) return { kind: 'path', pathId: work.id };
  if (!create) return null;
  const id = newId('path');
  s.doc.paths.unshift({ id, name: 'Work Path', kind: 'work', path: { subpaths: [], fillRule: 'nonzero' } });
  s.activePathId = id;
  s.doc.emit({ type: 'paths' });
  return { kind: 'path', pathId: id };
}

export function livePath(s: DocumentSession, t: PathTarget): VectorPath | null {
  if (t.kind === 'path') return s.doc.paths.find((p) => p.id === t.pathId)?.path ?? null;
  const l = s.doc.getLayer(t.layerId);
  if (!l) return null;
  if (t.kind === 'shape' && l.kind === 'shape') return l.path;
  return l.vectorMask?.path ?? null;
}

/** Captures the target before an edit and records an undoable command after. */
export class PathEdit {
  private before: VectorPath | Layer;
  constructor(private s: DocumentSession, readonly t: PathTarget, private label: string) {
    if (t.kind === 'path') this.before = clonePath(livePath(s, t)!);
    else this.before = cloneLayer(s.doc.getLayer(t.layerId)!);
  }
  path(): VectorPath {
    return livePath(this.s, this.t)!;
  }
  changed(): void {
    const t = this.t;
    if (t.kind === 'shape') {
      const l = this.s.doc.getLayer(t.layerId);
      if (l?.kind === 'shape') {
        l.origin = l.origin ? { ...l.origin, kind: 'custom' } : null;
        renderShapeLayer(this.s.doc, l);
        this.s.doc.emit({ type: 'layer', layerId: l.id });
      }
    } else if (t.kind === 'vectorMask') this.s.doc.emit({ type: 'mask', layerId: t.layerId, rect: null });
    else this.s.doc.emit({ type: 'paths' });
  }
  commit(): void {
    const s = this.s, t = this.t;
    if (t.kind === 'path') {
      const before = this.before as VectorPath;
      const after = clonePath(this.path());
      const id = t.pathId;
      s.push(new LambdaCommand(this.label, (d) => { const p = d.paths.find((x) => x.id === id); if (p) p.path = clonePath(after); d.emit({ type: 'paths' }); }, (d) => { const p = d.paths.find((x) => x.id === id); if (p) p.path = clonePath(before); d.emit({ type: 'paths' }); }), true);
      return;
    }
    const live = s.doc.getLayer(t.layerId);
    if (!live) return;
    s.push(new ReplaceLayerCommand(this.label, this.before as Layer, cloneLayer(live)), true);
  }
}

export function hitKnot(h: ToolHost, path: VectorPath, p: ToolPointer): { sp: number; i: number; part: 'anchor' | 'in' | 'out' } | null {
  const v = h.session.view;
  let best: { sp: number; i: number; part: 'anchor' | 'in' | 'out'; d: number } | null = null;
  path.subpaths.forEach((s, sp) =>
    s.knots.forEach((k, i) => {
      for (const [part, x, y] of [['anchor', k.x, k.y], ['in', k.inX, k.inY], ['out', k.outX, k.outY]] as const) {
        const q = v.docToScreen(x, y);
        const d = Math.hypot(q.x - p.sx, q.y - p.sy);
        if (d < 7 && (!best || d < best.d || (part === 'anchor' && best.part !== 'anchor' && d < best.d + 2))) best = { sp, i, part, d };
      }
    }),
  );
  return best;
}


/** Shared single-point geometry; callers own gestures, history and target admission. */
export function movePathKnot(k:PathKnot,o:PathKnot,part:'anchor'|'in'|'out',dx:number,dy:number,independent:boolean){
  if(part==='anchor'){k.x=o.x+dx;k.y=o.y+dy;k.inX=o.inX+dx;k.inY=o.inY+dy;k.outX=o.outX+dx;k.outY=o.outY+dy;return;}
  if(part==='in'){k.inX=o.inX+dx;k.inY=o.inY+dy;if(o.smooth&&!independent){const len=Math.hypot(o.outX-o.x,o.outY-o.y),a=Math.atan2(k.y-k.inY,k.x-k.inX);k.outX=k.x+Math.cos(a)*len;k.outY=k.y+Math.sin(a)*len;}}
  else {k.outX=o.outX+dx;k.outY=o.outY+dy;if(o.smooth&&!independent){const len=Math.hypot(o.inX-o.x,o.inY-o.y),a=Math.atan2(k.y-k.outY,k.x-k.outX);k.inX=k.x+Math.cos(a)*len;k.inY=k.y+Math.sin(a)*len;}}
  if(independent)k.smooth=false;
}
