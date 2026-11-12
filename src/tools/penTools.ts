import {access} from '../app/access';
import {PenDraft,type PenState} from './penDraft';
import {registerPen} from './penSession';
import {getTarget, livePath, PathEdit, hitKnot, movePathKnot} from './pathEditing';
/**
 * Pen tool family: Pen, Freeform Pen, Add/Delete Anchor, Convert Point, Path Selection,
 * Direct Selection. Edits target (in order): the active shape layer's path, the active
 * vector mask (when the active layer has one and no shape), the path selected in the Paths
 * panel, or the work path.
 */
import type { Tool, ToolHost, ToolPointer } from './tool';
import { opts, toast } from './helpers';
import type { PathKnot, VectorPath } from '../vector/types';
import { clonePath, knot } from '../vector/types';
import { CreateLayerCommand } from '../commands/layerCommands';
import { fitSmooth, nearestSegment, splitSegment, bezierPoint } from '../vector/shapes';
import { simplify } from '../selection/ops';
import { createShapeLayer } from '../document/layerFactory';
import { insertionPoint, nextLayerName } from '../app/ops/common';
import { ui, useApp } from '../app/store';

function drawPath(h: ToolHost, g: CanvasRenderingContext2D, path: VectorPath | null, selected: Set<string>, showHandles: boolean) {
  if (!path) return;
  const v = h.session.view;
  g.save();
  g.strokeStyle = '#2f8bff';
  g.lineWidth = 1;
  for (const s of path.subpaths) {
    if (!s.knots.length) continue;
    g.beginPath();
    const k0 = v.docToScreen(s.knots[0].x, s.knots[0].y);
    g.moveTo(k0.x, k0.y);
    const n = s.closed ? s.knots.length : s.knots.length - 1;
    for (let i = 0; i < n; i++) {
      const a = s.knots[i], b = s.knots[(i + 1) % s.knots.length];
      const c1 = v.docToScreen(a.outX, a.outY), c2 = v.docToScreen(b.inX, b.inY), e = v.docToScreen(b.x, b.y);
      g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y);
    }
    if (s.closed) g.closePath();
    g.stroke();
  }
  path.subpaths.forEach((s, sp) =>
    s.knots.forEach((k, i) => {
      const a = v.docToScreen(k.x, k.y);
      const sel = selected.has(`${sp}:${i}`);
      if (showHandles || sel) {
        for (const [hx, hy] of [[k.inX, k.inY], [k.outX, k.outY]]) {
          if (hx === k.x && hy === k.y) continue;
          const q = v.docToScreen(hx, hy);
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(q.x, q.y); g.stroke();
          g.beginPath(); g.arc(q.x, q.y, 3, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.stroke();
        }
      }
      g.fillStyle = sel ? '#2f8bff' : '#fff';
      g.fillRect(a.x - 3.5, a.y - 3.5, 7, 7);
      g.strokeRect(a.x - 3.5, a.y - 3.5, 7, 7);
    }),
  );
  g.restore();
}

// ---------------------------------------------------------------------------------------------
// Pen
// ---------------------------------------------------------------------------------------------
export class PenTool implements Tool {
  id='pen' as const;
  private draft:PenDraft|null=null;
  private detach:(()=>void)|null=null;
  private spIndex=-1;
  private gesture:{before:PenState;sp:number;index:number;kind:'add'|'edit'|'convert';part:'anchor'|'in'|'out';start:ToolPointer;independent:boolean;moved:boolean}|null=null;
  private hoverPt:ToolPointer|null=null;
  private selected=new Set<string>();
  hasPendingEdit(){return !!this.draft;}
  busy(){return !!this.gesture;}
  private closing(h:ToolHost,p:ToolPointer|null=this.hoverPt){
    const d=this.draft,sp=d?.path.subpaths[this.spIndex];
    if(!d||!d.allowed()||!sp||sp.closed||sp.knots.length<2||this.gesture||!p||p.mod||p.alt)return false;
    const f=h.session.view.docToScreen(sp.knots[0].x,sp.knots[0].y);return Math.hypot(f.x-p.sx,f.y-p.sy)<8;
  }
  cursor(h:ToolHost,p:ToolPointer|null=this.hoverPt){
    if(!this.ensure())return 'crosshair';
    if(this.gesture)return this.gesture.kind==='edit'?'move':this.gesture.kind==='convert'?'alias':'crosshair';
    if(this.draft&&(p?.mod||p?.alt))return p.mod?'move':'alias';
    if(this.closing(h,p))return 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2228%22 height=%2228%22%3E%3Cpath d=%22M8 0v16M0 8h16%22 stroke=%22white%22 stroke-width=%223%22/%3E%3Cpath d=%22M8 0v16M0 8h16%22 stroke=%22black%22/%3E%3Ccircle cx=%2220%22 cy=%2220%22 r=%224%22 fill=%22white%22 stroke=%22black%22/%3E%3C/svg%3E") 8 8, crosshair';
    return 'crosshair';
  }
  private feedback(h:ToolHost){h.setCursor(this.cursor(h));h.redraw();}
  private releasePointer(){if(typeof window!=='undefined')window.dispatchEvent(new Event('celenne:penInterrupted'));}

  private reset(){this.draft?.host.setCursor('crosshair');this.draft?.dispose();this.draft=null;this.detach?.();this.detach=null;this.gesture=null;this.spIndex=-1;this.hoverPt=null;this.selected.clear();this.releasePointer();ui.bump('historyRev');}
  private abandon=()=>{this.reset();toast('The current path target changed; the old Pen draft has ended.');};
  private ensure(){if(this.draft&&!this.draft.valid()){this.abandon();return false;}return true;}
  private interrupt=()=>{if(!this.ensure())return;const d=this.draft;if(d&&this.gesture){d.restore(this.gesture.before);this.spIndex=this.gesture.before.sp;}this.gesture=null;this.hoverPt=null;this.selected.clear();this.releasePointer();if(d)this.feedback(d.host);};
  private finish=(output=false):boolean=>{
    if(!this.ensure())return true;const d=this.draft;if(!d)return true;
    if(!d.allowed(output)){toast('The current path cannot be finished while its target is unavailable or busy.');return false;}
    this.interrupt();
    const sp=d.path.subpaths[this.spIndex];if(sp&&sp.knots.length<2&&!sp.closed){d.path.subpaths.splice(this.spIndex,1);d.changed();}
    if(!d.commit())return false;this.reset();d.host.redraw();return true;
  };
  private undo=(redo:boolean)=>{if(!this.ensure())return;const d=this.draft;if(!d||!d.allowed())return;
    if(this.gesture){if(!redo)this.interrupt();return;}
    const state=d.step(redo);if(state)this.spIndex=state.sp;
  };
  down(h:ToolHost,p:ToolPointer){
    if(!this.ensure()||!access('tool:pen').enabled)return;
    const hadDraft=!!this.draft;
    if(!this.draft){
      const target=getTarget(h.session,false),layer=target&&target.kind!=='path'?h.session.doc.getLayer(target.layerId):null;
      if(layer&&(layer.locks.all||target?.kind==='shape'&&layer.locks.pixels)){toast('The path target is locked.');return;}
      if(!h.session.canEdit()||h.session.outputPending||h.session.closePending)return;
      if(opts().pen.mode==='shape'&&h.session.activeLayer()?.kind!=='shape'){
        const s=h.session,layer=createShapeLayer(nextLayerName(s,'Shape'),{subpaths:[],fillRule:'nonzero'},null,s.doc.canvas.bitDepth);
        layer.fill={type:'solid',color:{...useApp.getState().fg}};const {parentId,index}=insertionPoint(s);
        const cmd=new CreateLayerCommand('Pen Shape',layer,parentId,index);cmd.do(s.doc);s.push(cmd,true);s.setActive(layer.id);
      }
      this.draft=new PenDraft(h,this.abandon);this.detach=registerPen({session:h.session,valid:()=>!!this.draft?.valid(),abandon:this.abandon,finish:this.finish,interrupt:this.interrupt,undo:this.undo});
    }
    const d=this.draft;if(!d.allowed())return;
    this.hoverPt=p;
    const path=d.path,sp=path.subpaths[this.spIndex];
    if(hadDraft&&(p.mod||p.alt)){
      const hit=hitKnot(h,path,p);this.selected.clear();
      if(hit){this.selected.add(`${hit.sp}:${hit.i}`);this.gesture={before:d.state(this.spIndex),sp:hit.sp,index:hit.i,kind:!p.mod&&hit.part==='anchor'?'convert':'edit',part:hit.part,start:p,independent:p.alt,moved:false};}
      this.feedback(h);return;
    }
    if(sp?.closed){this.finish();return;}
    if(this.closing(h,p)){sp.closed=true;d.changed();this.finish();return;}
    const before=d.state(this.spIndex);
    if(this.spIndex<0){path.subpaths.push({knots:[],closed:false,op:'combine'});this.spIndex=path.subpaths.length-1;}
    const knots=path.subpaths[this.spIndex].knots;knots.push(knot(p.x,p.y));
    this.selected.clear();this.gesture={before,sp:this.spIndex,index:knots.length-1,kind:'add',part:'anchor',start:p,independent:p.alt,moved:false};d.changed();this.feedback(h);
  }
  move(h:ToolHost,p:ToolPointer){
    if(!this.ensure())return;const d=this.draft;if(!d)return;
    const g=this.gesture;
    if(g){
      if(!d.allowed()){this.interrupt();return;}
      const k=d.path.subpaths[g.sp].knots[g.index],dx=p.x-g.start.x,dy=p.y-g.start.y;
      if(dx||dy)g.moved=true;
      if(p.alt)g.independent=true;
      if(g.kind==='add'||g.kind==='convert'){
        if(g.moved){k.outX=p.x;k.outY=p.y;
          if(g.kind==='convert'||!g.independent){k.inX=2*k.x-p.x;k.inY=2*k.y-p.y;}
          k.smooth=g.kind==='convert'||!g.independent&&!!(p.x-k.x||p.y-k.y);d.changed();}
      }else if(g.moved){const o=g.before.path.subpaths[g.sp].knots[g.index];if(!g.independent&&!dx&&!dy)Object.assign(k,o);else movePathKnot(k,o,g.part,dx,dy,g.independent);d.changed();}
    }
    this.hoverPt=p;this.feedback(h);
  }
  hover(h:ToolHost,p:ToolPointer){if(!this.ensure())return;this.hoverPt=p;this.feedback(h);}
  up(){
    if(!this.ensure())return;const d=this.draft,g=this.gesture;if(!d||!g)return;
    if(!d.allowed()){this.interrupt();return;}
    if(g.kind==='convert'&&!g.moved){const k=d.path.subpaths[g.sp].knots[g.index];k.inX=k.outX=k.x;k.inY=k.outY=k.y;k.smooth=false;d.changed();}
    this.gesture=null;d.record(this.spIndex);this.feedback(d.host);
  }
  keyDown(h:ToolHost,e:KeyboardEvent){
    if(!this.ensure()||!this.draft)return false;
    if(['Control','Meta','Alt','Shift'].includes(e.key)){
      if(!this.draft.allowed())return true;
      if(e.altKey&&this.gesture)this.gesture.independent=true;
      if(this.hoverPt)this.hoverPt={...this.hoverPt,mod:e.ctrlKey||e.metaKey,alt:e.altKey,shift:e.shiftKey};
      this.feedback(h);return true;
    }
    if(e.key==='Escape'&&this.gesture){this.interrupt();return true;}
    if(e.key==='Enter'||e.key==='Escape'){this.finish();h.redraw();return true;}return false;
  }
  keyUp(h:ToolHost,e:KeyboardEvent){if(!this.ensure()||!this.draft)return false;if(['Control','Meta','Alt','Shift'].includes(e.key)){if(this.hoverPt)this.hoverPt={...this.hoverPt,mod:e.ctrlKey||e.metaKey,alt:e.altKey,shift:e.shiftKey};this.feedback(h);return true;}return false;}
  cancelPointer(){this.interrupt();}
  cancel(){this.finish();}
  deactivate(){this.finish();}
  drawOverlay(h:ToolHost,g:CanvasRenderingContext2D){
    if(!this.ensure())return;const d=this.draft,t=d?.target??getTarget(h.session,false),path=t?livePath(h.session,t):null;
    drawPath(h,g,path,this.selected,true);
    const sp=d?.path.subpaths[this.spIndex],last=sp?.knots.at(-1),closing=this.closing(h);
    if(last&&this.hoverPt&&!this.gesture){
      const v=h.session.view,a=v.docToScreen(last.x,last.y),c=v.docToScreen(last.outX,last.outY),end=closing?sp!.knots[0]:this.hoverPt,b=v.docToScreen(end.x,end.y),incoming=closing?v.docToScreen(sp!.knots[0].inX,sp!.knots[0].inY):b;
      g.save();g.strokeStyle='rgba(47,139,255,0.6)';g.beginPath();g.moveTo(a.x,a.y);g.bezierCurveTo(c.x,c.y,incoming.x,incoming.y,b.x,b.y);g.stroke();
      if(closing){g.strokeStyle='#2f8bff';g.lineWidth=2;g.beginPath();g.arc(b.x,b.y,6,0,Math.PI*2);g.stroke();}g.restore();
    }
  }
}

export class FreeformPenTool implements Tool {
  id = 'freeformPen' as const;
  private pts: { x: number; y: number }[] = [];
  private active = false;
  cursor() {
    return 'crosshair';
  }
  busy() {
    return this.active;
  }
  down(_h: ToolHost, p: ToolPointer) {
    this.active = true;
    this.pts = [{ x: p.x, y: p.y }];
  }
  move(h: ToolHost, p: ToolPointer) {
    if (!this.active) return;
    this.pts.push({ x: p.x, y: p.y });
    h.redraw();
  }
  up(h: ToolHost) {
    this.active = false;
    if (this.pts.length < 3) return;
    const flat: number[] = [];
    for (const q of this.pts) flat.push(q.x, q.y);
    const simp = simplify(flat, 2 / h.session.view.zoom);
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < simp.length; i += 2) pts.push({ x: simp[i], y: simp[i + 1] });
    const first = pts[0], last = pts[pts.length - 1];
    const closed = Math.hypot(first.x - last.x, first.y - last.y) * h.session.view.zoom < 10;
    if (closed) pts.pop();
    const t = getTarget(h.session, true);
    if (!t) return;
    const edit = new PathEdit(h.session, t, 'Freeform Pen');
    edit.path().subpaths.push(fitSmooth(pts, closed));
    edit.changed();
    edit.commit();
    this.pts = [];
    h.redraw();
  }
  drawOverlay(h: ToolHost, g: CanvasRenderingContext2D) {
    if (this.pts.length < 2) return;
    const v = h.session.view;
    g.save();
    g.strokeStyle = '#2f8bff';
    g.beginPath();
    this.pts.forEach((q, i) => { const s = v.docToScreen(q.x, q.y); if (i) g.lineTo(s.x, s.y); else g.moveTo(s.x, s.y); });
    g.stroke();
    g.restore();
  }
}

// ---------------------------------------------------------------------------------------------
// Anchor editing and selection
// ---------------------------------------------------------------------------------------------
export class AnchorTool implements Tool {
  constructor(readonly id: 'addAnchor' | 'deleteAnchor' | 'convertPoint') {}
  private drag: { edit: PathEdit; k: PathKnot } | null = null;
  cursor() {
    return 'crosshair';
  }
  down(h: ToolHost, p: ToolPointer) {
    const s = h.session;
    const t = getTarget(s, false);
    if (!t) return toast('There is no path to edit. Draw one with the Pen tool.');
    const edit = new PathEdit(s, t, this.id === 'addAnchor' ? 'Add Anchor Point' : this.id === 'deleteAnchor' ? 'Delete Anchor Point' : 'Convert Point');
    const path = edit.path();
    if (this.id === 'addAnchor') {
      const near = nearestSegment(path, p.x, p.y);
      if (!near || near.d * s.view.zoom > 8) return;
      const sp = path.subpaths[near.sp];
      const a = sp.knots[near.i], b = sp.knots[(near.i + 1) % sp.knots.length];
      sp.knots.splice(near.i + 1, 0, splitSegment(a, b, near.t));
    } else {
      const hk = hitKnot(h, path, p);
      if (!hk || hk.part !== 'anchor') return;
      const sp = path.subpaths[hk.sp];
      const k = sp.knots[hk.i];
      if (this.id === 'deleteAnchor') {
        sp.knots.splice(hk.i, 1);
        if (sp.knots.length < 2) path.subpaths.splice(hk.sp, 1);
      } else if (k.smooth || k.inX !== k.x || k.outX !== k.x || k.inY !== k.y || k.outY !== k.y) {
        k.inX = k.outX = k.x; k.inY = k.outY = k.y; k.smooth = false;
      } else {
        this.drag = { edit, k };
        k.smooth = true;
        return;
      }
    }
    edit.changed();
    edit.commit();
    h.redraw();
  }
  move(h: ToolHost, p: ToolPointer) {
    if (!this.drag) return;
    const k = this.drag.k;
    k.outX = p.x; k.outY = p.y; k.inX = 2 * k.x - p.x; k.inY = 2 * k.y - p.y;
    this.drag.edit.changed();
    h.redraw();
  }
  up() {
    if (this.drag) this.drag.edit.commit();
    this.drag = null;
  }
  drawOverlay(h: ToolHost, g: CanvasRenderingContext2D) {
    const t = getTarget(h.session, false);
    drawPath(h, g, t ? livePath(h.session, t) : null, new Set(), true);
  }
}

export class PathSelectTool implements Tool {
  private selected = new Set<string>();
  private drag: { edit: PathEdit; start: ToolPointer; orig: VectorPath; part: 'anchor' | 'in' | 'out' | 'whole'; sp: number; i: number } | null = null;
  constructor(readonly id: 'pathSelect' | 'directSelect') {}
  cursor() {
    return 'default';
  }
  busy() {
    return !!this.drag;
  }
  down(h: ToolHost, p: ToolPointer) {
    const s = h.session;
    const t = getTarget(s, false);
    if (!t) return;
    const edit = new PathEdit(s, t, this.id === 'pathSelect' ? 'Path Selection' : 'Direct Selection');
    const path = edit.path();
    if (this.id === 'directSelect') {
      const hk = hitKnot(h, path, p);
      if (hk) {
        const key = `${hk.sp}:${hk.i}`;
        if (!p.shift && !this.selected.has(key)) this.selected.clear();
        this.selected.add(key);
        this.drag = { edit, start: p, orig: clonePath(path), part: hk.part, sp: hk.sp, i: hk.i };
        h.redraw();
        return;
      }
    }
    const near = nearestSegment(path, p.x, p.y);
    if (near && near.d * s.view.zoom < 10) {
      if (!p.shift) this.selected.clear();
      path.subpaths[near.sp].knots.forEach((_, i) => this.selected.add(`${near.sp}:${i}`));
      this.drag = { edit, start: p, orig: clonePath(path), part: 'whole', sp: near.sp, i: 0 };
    } else this.selected.clear();
    h.redraw();
  }
  move(h: ToolHost, p: ToolPointer) {
    const d = this.drag;
    if (!d) return;
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    const path = d.edit.path();
    const orig = d.orig;
    const moveKnot = (sp: number, i: number) => {
      const o = orig.subpaths[sp].knots[i], k = path.subpaths[sp].knots[i];
      movePathKnot(k,o,'anchor',dx,dy,false);
    };
    if (d.part === 'whole' || d.part === 'anchor') {
      for (const key of this.selected) {
        const [sp, i] = key.split(':').map(Number);
        if (path.subpaths[sp]?.knots[i]) moveKnot(sp, i);
      }
    } else {
      const o = orig.subpaths[d.sp].knots[d.i], k = path.subpaths[d.sp].knots[d.i];
      movePathKnot(k,o,d.part,dx,dy,p.alt);
    }
    d.edit.changed();
    h.redraw();
  }
  up() {
    if (this.drag) {
      const moved = JSON.stringify(this.drag.orig) !== JSON.stringify(this.drag.edit.path());
      if (moved) this.drag.edit.commit();
    }
    this.drag = null;
  }
  keyDown(h: ToolHost, e: KeyboardEvent): boolean {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected.size) {
      const t = getTarget(h.session, false);
      if (!t) return false;
      const edit = new PathEdit(h.session, t, 'Delete Anchor Points');
      const path = edit.path();
      const bySub = new Map<number, number[]>();
      for (const key of this.selected) { const [sp, i] = key.split(':').map(Number); bySub.set(sp, [...(bySub.get(sp) ?? []), i]); }
      for (const [sp, idxs] of [...bySub.entries()].sort((a, b) => b[0] - a[0])) {
        const knots = path.subpaths[sp]?.knots;
        if (!knots) continue;
        for (const i of idxs.sort((a, b) => b - a)) knots.splice(i, 1);
        if (knots.length < 2) path.subpaths.splice(sp, 1);
      }
      this.selected.clear();
      edit.changed();
      edit.commit();
      h.redraw();
      return true;
    }
    return false;
  }
  drawOverlay(h: ToolHost, g: CanvasRenderingContext2D) {
    const t = getTarget(h.session, false);
    drawPath(h, g, t ? livePath(h.session, t) : null, this.selected, this.id === 'directSelect');
  }
}

export { bezierPoint };
