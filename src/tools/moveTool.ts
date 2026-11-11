/**
 * Move tool: moves selected layers (snapping to guides, document and layer edges), auto-selects
 * layers under the cursor, Alt-drag duplicates, and moves selected pixels as a floating selection.
 */
import type { MoveResult, Tool, ToolHost, ToolPointer } from './tool';
import { drawSnapLines, opts, snapRectDelta, snapTargets, toast } from './helpers';
import { translateLayerDeep, TranslateLayersCommand, CompositeCommand, CreateLayerCommand } from '../commands/layerCommands';
import type { Layer } from '../document/types';
import { hasRaster } from '../document/types';
import { layerContentBounds, layerVisualBounds } from '../rendering/bounds';
import { Rect, union, expand, intersect, isEmpty } from '../image-engine/rect';
import { RasterEditCommand } from '../commands/rasterCommands';
import type { RasterSnapshot } from '../image-engine/tiledRaster';
import { TiledRaster, TILE_SIZE, tileRange } from '../image-engine/tiledRaster';
import { maxValue, type PixelArray } from '../image-engine/pixels';
import { cloneLayer } from '../document/clone';
import { beginTransform } from './transformTool';
import { ui, useApp } from '../app/store';
import { editor } from '../app/editor';
import { gpuCompositor } from '../rendering/renderEngine';
import { hasEnabledEffect } from '../effects/types';
import type { DocumentSession } from '../app/session';
import { onGpuLost } from '../gpu/device';
import type { LayerOverride } from '../rendering/compositor';

interface LayerDrag {
  kind: 'layers';
  ids: string[];
  /** Lift state: 'pending' until the first movement decides whether to lift. */
  lift: 'pending' | 'on' | 'off';
  start: { x: number; y: number };
  applied: { dx: number; dy: number };
  bounds: Rect | null;
  targets: { xs: number[]; ys: number[] };
  guides: { xs: number[]; ys: number[] };
}

interface FloatDrag {
  kind: 'float';
  layerId: string;
  start: { x: number; y: number };
  /** The layer and selection before this drag (its undo step). */
  before: RasterSnapshot;
  selBefore: RasterSnapshot;
  /** The float: the lifted pixels, their selection coverage, and the layer without them. */
  float: FloatPixels;
  floatCov: Float32Array;
  cutState: RasterSnapshot;
  /** Where the float was lifted from, and its offset from there when this drag started. */
  rect: Rect;
  ox: number;
  oy: number;
  /** The selection mask version the float was lifted with (the outline moves with the pixels). */
  baseSelVersion: number;
  dx: number;
  dy: number;
  lastDirty: Rect;
  preview?: {
    session: DocumentSession;
    doc: DocumentSession['doc'];
    layer: Layer;
    x: number;
    y: number;
    selection: DocumentSession['doc']['selection'];
    docRev: number;
    raster: TiledRaster;
    rasterVersion: number;
    mask: TiledRaster;
    maskVersion: number;
    gpu: ReturnType<typeof gpuCompositor>;
    outline: NonNullable<DocumentSession['doc']['selection']['previewOutline']>;
    cut: TiledRaster;
    pixels: TiledRaster;
    selectionVersion: number;
    stop: () => void;
    override: LayerOverride | null;
  };
}

/**
 * Pixels moved with the Move tool stay floating, as in Photoshop: dragging them again moves the
 * same pixels and shows what was under them before. Any other change to the layer or the
 * selection (painting, undo, a new selection, ...) drops the float and the next drag lifts afresh.
 */
interface Floating {
  layerId: string;
  layer: Layer;
  x: number;
  y: number;
  raster: object;
  rasterVersion: number;
  selVersion: number;
  mask: TiledRaster;
  float: FloatPixels;
  floatCov: Float32Array;
  cutState: RasterSnapshot;
  rect: Rect;
  ox: number;
  oy: number;
  baseSelVersion: number;
}

/** Lifted pixels at the layer's own depth: straight colour, and alpha with the selection applied. */
interface FloatPixels {
  px: PixelArray;
  alpha: Float32Array;
  w: number;
  h: number;
}

/**
 * Draws the float over `raster` at a layer-local position, straight into the tiles: opaque pixels
 * are copied, transparent ones skipped, and only partly covered pixels (soft edges) blended. This
 * runs on every pointer move, so it avoids converting the whole region to floats and back.
 */
function stampFloat(raster: TiledRaster, x0: number, y0: number, f: FloatPixels): void {
  const max = maxValue(raster.depth), round = raster.depth !== 32;
  const r = { x: x0, y: y0, w: f.w, h: f.h };
  const { tx0, ty0, tx1, ty1 } = tileRange(r);
  const TS = TILE_SIZE;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const bx = tx * TS, by = ty * TS;
      const ix0 = Math.max(r.x, bx), iy0 = Math.max(r.y, by), ix1 = Math.min(r.x + r.w, bx + TS), iy1 = Math.min(r.y + r.h, by + TS);
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      // Only tiles the float covers somewhere are touched.
      let any = false;
      for (let y = iy0; y < iy1 && !any; y++) { const o = (y - r.y) * f.w - r.x; for (let x = ix0; x < ix1; x++) if (f.alpha[o + x] > 0) { any = true; break; } }
      if (!any) continue;
      const d = raster.writableTile(tx, ty).data;
      for (let y = iy0; y < iy1; y++) {
        const so = (y - r.y) * f.w - r.x;
        const to = (y - by) * TS - bx;
        for (let x = ix0; x < ix1; x++) {
          const sa = f.alpha[so + x];
          if (sa <= 0) continue;
          const si = (so + x) * 4, di = (to + x) * 4;
          if (sa >= 1) {
            d[di] = f.px[si]; d[di + 1] = f.px[si + 1]; d[di + 2] = f.px[si + 2]; d[di + 3] = max;
            continue;
          }
          const da = d[di + 3] / max;
          const oa = sa + da * (1 - sa);
          const kd = (da * (1 - sa)) / oa, ks = sa / oa;
          for (let c = 0; c < 3; c++) { const v = f.px[si + c] * ks + d[di + c] * kd; d[di + c] = round ? Math.round(v) : v; }
          d[di + 3] = round ? Math.round(oa * max) : oa;
        }
      }
    }
  }
}

/** Top-most visible layer with opaque pixels under a document point. */
export function pickLayer(h: ToolHost, x: number, y: number, group: boolean): Layer | null {
  const doc = h.session.doc;
  const all = doc.allLayers().reverse();
  for (const l of all) {
    if (!doc.isEffectivelyVisible(l) || !hasRaster(l)) continue;
    const a = l.raster.readFloat({ x: Math.floor(x) - l.x, y: Math.floor(y) - l.y, w: 1, h: 1 })[3];
    if (a > 0.05) {
      if (!group) return l;
      let top: Layer = l;
      while (top.parent && top.parent !== doc.root) top = top.parent;
      return top;
    }
  }
  return null;
}

export class MoveTool implements Tool {
  id = 'move' as const;
  private drag: LayerDrag | FloatDrag | null = null;
  private floating: Floating | null = null;
  private moveHost: ToolHost | null = null;
  private moveResult: MoveResult = 'none';

  movingSession(s: DocumentSession): boolean { return this.moveHost?.session === s && !!this.drag; }

  finishMove(s: DocumentSession, commit: boolean): MoveResult {
    if (this.moveHost?.session !== s) return 'none';
    if (this.drag) {
      if (commit) {
        try { return this.up(this.moveHost); } catch (error) { console.warn('Move completion failed:', error); return this.moveResult = 'failed'; }
      }
      this.cancel(this.moveHost);
      return 'cancelled';
    }
    const result = this.moveResult; this.moveResult = 'none'; return result;
  }

  cursor() {
    return 'move';
  }

  busy() {
    return !!this.drag;
  }

  down(h: ToolHost, p: ToolPointer) {
    if (!h.session.canEdit()) { toast("This document is busy saving or closing."); return; }
    this.moveHost = h; this.moveResult = 'none';
    const s = h.session;
    const o = opts().move;
    if (o.autoSelect || p.mod) {
      const picked = pickLayer(h, p.x, p.y, o.autoSelectTarget === 'group');
      if (picked && picked.id !== s.activeLayerId) s.setActive(picked.id, p.shift);
    }
    // Transform handles of the bounding box start Free Transform.
    if (o.showTransformControls && this.hitHandle(h, p)) {
      beginTransform();
      return;
    }
    const active = s.activeLayer();
    if (!active) return;
    if (this.selectionDrag(h, active, s.selectedLayers())) {
      this.beginFloat(h, p, active);
      return;
    }
    let layers = s.selectedLayers().filter((l) => !l.locks.position && !l.locks.all);
    if (!layers.length) {
      toast(`"${active.name}" is locked.`);
      return;
    }
    // Remove descendants of selected groups (they move with the group).
    layers = layers.filter((l) => !layers.some((g) => g !== l && g.kind === 'group' && s.doc.isAncestor(g, l)));
    if (p.alt) {
      // Alt-drag: duplicate first, then move the copies.
      const cmds: CreateLayerCommand[] = [];
      const copies: Layer[] = [];
      for (const l of layers) {
        const c = cloneLayer(l, true);
        c.name = `${l.name} copy`;
        const parent = l.parent ?? s.doc.root;
        const cmd = new CreateLayerCommand('Duplicate', c, parent.id, parent.children.indexOf(l) + 1);
        cmd.do(s.doc);
        cmds.push(cmd);
        copies.push(c);
      }
      s.push(new CompositeCommand('Duplicate Layer', cmds), true);
      s.setActive(copies[0].id);
      copies.slice(1).forEach((c) => s.selectedIds.add(c.id));
      layers = copies;
    }
    let bounds: Rect | null = null;
    for (const l of layers) bounds = union(bounds, layerContentBounds(l) ?? undefined);
    const ids = layers.map((l) => l.id);
    const drag: LayerDrag = { kind: 'layers', ids, lift: 'pending', start: { x: p.x, y: p.y }, applied: { dx: 0, dy: 0 }, bounds, targets: snapTargets(s, new Set(ids)), guides: { xs: [], ys: [] } };
    this.drag = drag;
    editor.beginInteraction();
    // Prepare the lift now so its tiles render in spare frame time before the pointer moves.
    this.startLift(h, drag);
  }

  /** Lifts large layers onto their own GPU tile set so dragging needs no re-compositing. */
  private startLift(h: ToolHost, d: LayerDrag) {
    const s = h.session;
    // Prepared while the pointer hovered these layers: the drag starts at full speed.
    if (s.engine.preparedLift(d.ids, s.view.level(s.engine.maxLevel()))) { d.lift = 'on'; return; }
    d.lift = this.prepareLift(h, d.ids) ? 'on' : 'off';
  }

  private prepareLift(h: ToolHost, ids: string[]): boolean {
    const s = h.session;
    let vb: Rect | null = null;
    for (const id of ids) { const l = s.doc.getLayer(id); if (l) vb = union(vb, layerVisualBounds(l) ?? undefined); }
    const tilePx = 256 * (1 << s.view.level(s.engine.maxLevel()));
    // Small layers re-render in a few milliseconds; lifting only pays off for larger ones.
    const tiles = vb ? Math.ceil(vb.w / tilePx + 1) * Math.ceil(vb.h / tilePx + 1) : Infinity;
    return tiles >= 6 && s.engine.beginLift(ids, vb);
  }

  /** The layers a drag starting at `p` would move (no side effects); null = not a plain layer drag. */
  private dragTargets(h: ToolHost, p: ToolPointer): string[] | null {
    const s = h.session;
    const o = opts().move;
    if (p.alt) return null; // Alt-drag duplicates first
    let layers = s.selectedLayers();
    if (o.autoSelect || p.mod) {
      const picked = pickLayer(h, p.x, p.y, o.autoSelectTarget === 'group');
      if (picked && picked.id !== s.activeLayerId) layers = p.shift ? [...layers, picked] : [picked];
    }
    const active = layers[layers.length - 1];
    if (!active) return null;
    if (this.selectionDrag(h, active, layers)) return null;
    layers = layers.filter((l) => !l.locks.position && !l.locks.all);
    layers = layers.filter((l) => !layers.some((g) => g !== l && g.kind === 'group' && s.doc.isAncestor(g, l)));
    return layers.length ? layers.map((l) => l.id) : null;
  }

  private lastHover = 0;

  /** While hovering, prepares the lift for the layers a drag would move (in spare frame time). */
  hover(h: ToolHost, p: ToolPointer) {
    const now = performance.now();
    if (now - this.lastHover < 100) return;
    this.lastHover = now;
    const s = h.session;
    const ids = this.dragTargets(h, p);
    if (!ids) return;
    if (s.engine.preparedLift(ids, s.view.level(s.engine.maxLevel()))) return;
    s.engine.dropPreparedLift();
    if (!s.engine.lift) this.prepareLift(h, ids);
  }

  deactivate(h: ToolHost) {
    h.session.engine.dropPreparedLift();
  }

  /** Selection intent also owns rejected floats; never fall through into a whole-layer move. */
  private selectionDrag(h: ToolHost, active: Layer, layers: Layer[]): boolean {
    return layers.length === 1 && active.kind === 'pixel' && !h.session.doc.selection.isEmpty()
      && !h.session.editMask && !h.session.activeChannelId && !useApp.getState().quickMask;
  }

  private beginFloat(h: ToolHost, p: ToolPointer, layer: Layer) {
    const s = h.session;
    if (!hasRaster(layer)) return;
    if (layer.locks.pixels || layer.locks.all || layer.locks.position) {
      toast(`"${layer.name}" is locked.`);
      return;
    }
    const sel = s.doc.selection;
    if (s.engine.hasOverrides()) {toast("Another preview is active.");return;}
    const gpu = gpuCompositor();
    // A valid float can be entirely outside the canvas; its original dimensions remain authoritative.
    const candidate = this.floating;
    const f = candidate && !p.alt && candidate.layer === layer && candidate.x === layer.x && candidate.y === layer.y && candidate.layerId === layer.id && candidate.raster === layer.raster && candidate.rasterVersion === layer.raster.version && candidate.selVersion === sel.version && candidate.mask === sel.mask ? candidate : null;
    const initialBounds = f ? f.rect : sel.bounds(s.doc.bounds);
    if (!initialBounds) return;

    let fallback: string | null = null;
    {
      if (!gpu || gpu.disposed) fallback = 'WebGPU compositor unavailable';
      else if (gpu.viewSupported(s.doc, s.engine.view)) fallback = `unsupported view: ${gpu.viewSupported(s.doc, s.engine.view)}`;
      else if (s.engine.hasOverrides()) fallback = 'another preview is active';
      else if (s.doc.canvas.colorMode !== 'rgb' || s.doc.canvas.bitDepth !== 8) fallback = 'only RGB 8-bit documents are supported';
      else if (s.view.zoom < .25 || s.view.level(s.engine.maxLevel()) > 2) fallback = 'zoom level below 25%';
      else if (Math.ceil(initialBounds.w / TILE_SIZE) * Math.ceil(initialBounds.h / TILE_SIZE) > gpu.reserveFloatingAtlas()) fallback = 'floating atlas capacity';
      else if (!s.doc.root.children.every(l => !l.clipping && !hasEnabledEffect(l.effects) && !l.vectorMask && l.advanced.knockout === 'none' && (l.kind === 'pixel' || (l.kind === 'adjustment' && l.adjustment.type === 'curves')))) fallback = 'unsupported layer composition';
      if (fallback) console.info(`[Task 02] Using the existing Move path: ${fallback}`);
    }
    const supported = !fallback;
    const before = layer.raster.snapshot();
    const selBefore = sel.snapshot();
    // Still floating from the last drag: move the same pixels again (Alt-drag stamps a copy instead).
    if (f) {
      const at = { x: f.rect.x + f.ox, y: f.rect.y + f.oy, w: f.rect.w, h: f.rect.h };
      this.drag = { kind: 'float', layerId: layer.id, start: { x: p.x, y: p.y }, before, selBefore, float: f.float, floatCov: f.floatCov, cutState: f.cutState, rect: f.rect, ox: f.ox, oy: f.oy, baseSelVersion: f.baseSelVersion, dx: 0, dy: 0, lastDirty: at };
      try { this.prepareFloatPreview(h, this.drag as FloatDrag, layer, supported ? gpu : null); } catch (error) { this.drag = null; toast(`Move preview failed: ${String(error)}`); }
      return;
    }
    this.floating = null;
    const rect = initialBounds;
    const lr = { x: rect.x - layer.x, y: rect.y - layer.y, w: rect.w, h: rect.h };
    const px = layer.raster.readFloat(lr);
    const cov = sel.read(rect);
    const native = layer.raster.readPixels(lr);
    const max = maxValue(layer.raster.depth);
    const alpha = new Float32Array(rect.w * rect.h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = Math.min(native[i * 4 + 3] / max, cov[i]);
    if (!alpha.some(a => a > 0)) return;
    const float: FloatPixels = { px: native, alpha, w: rect.w, h: rect.h };
    const cut = layer.raster.clone();
    if (!p.alt) {
      // Paired source-over decomposition: fragment + remainder reconstruct the source.
      for (let i = 0; i < rect.w * rect.h; i++) px[i * 4 + 3] = alpha[i] < 1 ? Math.max(0, (px[i * 4 + 3] - alpha[i]) / (1 - alpha[i])) : 0;
      cut.writeFloat(lr, px);
    }
    const cutState = cut.snapshot();
    this.drag = { kind: 'float', layerId: layer.id, start: { x: p.x, y: p.y }, before, selBefore, float, floatCov: alpha, cutState, rect, ox: 0, oy: 0, baseSelVersion: sel.version, dx: 0, dy: 0, lastDirty: rect };
    try { this.prepareFloatPreview(h, this.drag, layer, supported ? gpu : null); } catch (error) { this.drag = null; toast(`Move preview failed: ${String(error)}`); }
  }

  private prepareFloatPreview(h: ToolHost, d: FloatDrag, layer: Layer & {raster:TiledRaster}, gpu: ReturnType<typeof gpuCompositor>) {
    const s = h.session, raster = layer.raster;
    const cut = new TiledRaster(4, raster.depth); cut.restore(d.cutState);
    const data = new Float32Array(gpu ? d.float.w * d.float.h * 4 : 0);
    for (let i = 0; gpu && i < d.float.alpha.length; i++) {
      data[i * 4] = d.float.px[i * 4] / maxValue(raster.depth); data[i * 4 + 1] = d.float.px[i * 4 + 1] / maxValue(raster.depth);
      data[i * 4 + 2] = d.float.px[i * 4 + 2] / maxValue(raster.depth); data[i * 4 + 3] = d.float.alpha[i];
    }
    const pixels = gpu ? TiledRaster.fromPixels(d.float.w, d.float.h, 4, 32, data) : new TiledRaster(4, 32);
    const invalidate = () => {
      if (this.drag !== d || this.validPreview(h, d)) return;
      this.clearFloatPreview(d); this.floating = null; this.drag = null; this.moveResult = 'cancelled'; h.redraw();
    };
    const outline = {mask: new TiledRaster(1, 8), bounds: d.rect, dx: d.ox, dy: d.oy};
    outline.mask.writeFloat(d.rect, d.floatCov);
    const stopDoc = s.doc.on(invalidate), stopGpu = gpu ? onGpuLost(invalidate) : () => {};
    d.preview = { session: s, doc: s.doc, layer, x: layer.x, y: layer.y, selection: s.doc.selection, outline, docRev: s.doc.rev, raster, rasterVersion: raster.version, mask: s.doc.selection.mask, maskVersion: s.doc.selection.mask.version, selectionVersion: s.doc.selection.version, gpu, cut, pixels, stop: () => { stopDoc(); stopGpu(); }, override: null };
    editor.beginInteraction();
  }

  private validPreview(h: ToolHost, d: FloatDrag): boolean {
    const p = d.preview, s = h.session, l = s.doc.getLayer(d.layerId);
    if (!p || p.session !== s || editor.active !== s || s.doc !== p.doc || s.doc.rev !== p.docRev) return false;
    if (s.doc.selection !== p.selection || s.doc.selection.mask !== p.mask || p.mask.version !== p.maskVersion) return false;
    if (s.activeLayerId !== d.layerId || s.selectedLayers().length !== 1 || s.editMask || s.activeChannelId || useApp.getState().quickMask) return false;
    if (l !== p.layer || !l || !hasRaster(l) || l.x !== p.x || l.y !== p.y || l.raster !== p.raster || l.raster.version !== p.rasterVersion) return false;
    if (l.locks.pixels || l.locks.position || l.locks.all || p.override && s.engine.getOverride(d.layerId) !== p.override) return false;
    return !p.gpu || s.view.zoom >= .25 && s.view.level(s.engine.maxLevel()) <= 2 && gpuCompositor() === p.gpu && !p.gpu.disposed;
  }

  private clearFloatPreview(d: FloatDrag) {
    const p = d.preview;
    if (!p) return;
    p.stop();
    if (p.override && p.session.engine.getOverride(d.layerId) === p.override) p.session.engine.setOverride(d.layerId, null);
    if (p.selection.previewOutline === p.outline) p.selection.previewOutline = null;
    p.gpu?.releaseFloating(p.cut, p.pixels);
    editor.endInteraction();
    d.preview = undefined;
  }

  /** The float's selection outline at offset (dx, dy) from where it was lifted. */
  private floatSelection(d: FloatDrag, dx: number, dy: number): RasterSnapshot {
    const m = new TiledRaster(1, 8, 0);
    m.writeFloat({ x: d.rect.x + dx, y: d.rect.y + dy, w: d.rect.w, h: d.rect.h }, d.floatCov);
    return m.snapshot();
  }

  move(h: ToolHost, p: ToolPointer) {
    const d = this.drag;
    if (!d) return;
    const s = h.session;
    let dx = Math.round(p.x - d.start.x), dy = Math.round(p.y - d.start.y);
    if (p.shift) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    if (d.kind === 'layers') {
      if (d.bounds && opts().move.snap) {
        const snapped = snapRectDelta(h, d.bounds, dx, dy, d.targets);
        dx = Math.round(snapped.dx);
        dy = Math.round(snapped.dy);
        d.guides = { xs: snapped.guidesX, ys: snapped.guidesY };
      }
      const ddx = dx - d.applied.dx, ddy = dy - d.applied.dy;
      if (!ddx && !ddy) return;
      if (d.lift === 'on' && s.engine.lift && !s.engine.lift.wantActive) s.engine.activateLift();
      else if (d.lift === 'on' && !s.engine.lift) d.lift = 'off'; // prepared lift was discarded
      let dirty: Rect | null = null;
      for (const id of d.ids) {
        const l = s.doc.getLayer(id);
        if (!l) continue;
        const before = layerVisualBounds(l);
        translateLayerDeep(l, ddx, ddy);
        const after = layerVisualBounds(l);
        dirty = union(dirty, union(before, after) ?? undefined);
      }
      d.applied = { dx, dy };
      s.doc.emit(...d.ids.map((id) => ({ type: 'pixels' as const, layerId: id, rect: dirty })));
      if (d.lift === 'on') s.engine.setLiftOffset(dx, dy);
      h.redraw();
      return;
    }
    // Floating pixels (offset from where they were lifted).
    const layer = s.doc.getLayer(d.layerId);
    if (!layer || !hasRaster(layer)) { if (d.preview) { this.clearFloatPreview(d); this.floating = null; this.drag = null; this.moveResult = 'cancelled'; h.redraw(); } return; }
    if (!this.validPreview(h, d)) { this.clearFloatPreview(d); this.floating = null; this.drag = null; this.moveResult = 'cancelled'; h.redraw(); return; }
    if (dx === d.dx && dy === d.dy) return;
    const moved0 = !d.dx && !d.dy;
    d.dx = dx;
    d.dy = dy;
    dx += d.ox;
    dy += d.oy;
    if (d.preview && !this.validPreview(h, d)) { this.clearFloatPreview(d); this.floating = null; this.drag = null; this.moveResult = 'cancelled'; h.redraw(); return; }
    const dest = { x: d.rect.x + dx, y: d.rect.y + dy, w: d.rect.w, h: d.rect.h };
    // Redraw only where the float was and where it is (and, the first time, the hole it leaves),
    // not the box spanning them, which grows with the distance dragged.
    const rects = [d.lastDirty, dest];
    if (moved0 && !d.ox && !d.oy) rects.push(d.rect);
    d.lastDirty = dest;
    // The outline follows as an offset; the selection mask itself is written when the drag ends.
    const sel = s.doc.selection;
    // The private alpha mask is built once; pointermove only changes its display offset.
    if (d.preview) {d.preview.outline.dx = dx; d.preview.outline.dy = dy; sel.previewOutline = d.preview.outline;}
    if (d.preview) {
      const preview = d.preview;
      if (!d.dx && !d.dy) {
        if (preview.override && s.engine.getOverride(layer.id) === preview.override) s.engine.setOverride(layer.id, null);
        preview.override = null; if (sel.previewOutline === preview.outline) sel.previewOutline = null; h.redraw(); return;
      }
      let cpu: TiledRaster | null = null;
      const override: LayerOverride = {
        interaction: { valid: () => this.drag === d && this.validPreview(h, d), abort: () => { if (this.drag === d) { this.clearFloatPreview(d); this.floating = null; this.drag = null; this.moveResult = 'cancelled'; h.redraw(); } } },
        read: (r, level) => {
          if (!cpu) { cpu = new TiledRaster(4, layer.raster.depth); cpu.restore(d.cutState); stampFloat(cpu, dest.x - layer.x, dest.y - layer.y, d.float); }
          const scale = 1 << level;
          return cpu.readFloat({ x: r.x - Math.round(layer.x / scale), y: r.y - Math.round(layer.y / scale), w: r.w, h: r.h }, level);
        },
        gpu: preview.gpu ? { floating: { cut: preview.cut, pixels: preview.pixels, x: dest.x - layer.x, y: dest.y - layer.y } } : undefined,
      };
      preview.override = override;
      s.engine.setOverride(layer.id, override, union(union(rects[0], rects[1])!, d.rect));
    } else s.doc.emit(...rects.map((rect) => ({ type: 'pixels' as const, layerId: layer.id, rect })));
    h.redraw();
  }

  up(h: ToolHost): MoveResult {
    const d = this.drag;
    this.drag = null;
    if (!d) return 'none';
    this.moveResult = 'committed';
    const s = h.session;
    if (d.kind === 'layers') {
      // A click without movement keeps the prepared lift for the next drag.
      if (d.lift === 'on' && s.engine.lift && !s.engine.lift.wantActive) { /* still prepared */ }
      else if (d.lift === 'on') {
        let fb: Rect | null = null;
        for (const id of d.ids) { const l = s.doc.getLayer(id); if (l) fb = union(fb, layerVisualBounds(l) ?? undefined); }
        s.engine.endLift(fb);
      }
      editor.endInteraction();
      if (d.applied.dx || d.applied.dy) s.push(new TranslateLayersCommand(d.ids, d.applied.dx, d.applied.dy, { action: 'layer.translate', args: { dx: d.applied.dx, dy: d.applied.dy } }), true);
      h.redraw();
      return this.moveResult;
    }
    const layer = s.doc.getLayer(d.layerId);
    if (!layer || !hasRaster(layer)) { if (d.preview) this.clearFloatPreview(d); return this.moveResult = 'cancelled'; }
    const sel = s.doc.selection;
    if (!this.validPreview(h, d)) { this.clearFloatPreview(d); this.floating = null; h.redraw(); return this.moveResult = 'cancelled'; }
    if (!d.dx && !d.dy) {
      // No movement: nothing changed (a float stays floating).
      if (d.preview) this.clearFloatPreview(d);
      if (this.floating) { this.floating.rasterVersion = layer.raster.version; this.floating.selVersion = sel.version; }
      return this.moveResult;
    }
    const ox = d.ox + d.dx, oy = d.oy + d.dy;
    if (d.preview) {
      // Prepare both results privately before touching the session's authoritative state.
      try {
        const next = new TiledRaster(4, layer.raster.depth); next.restore(d.cutState);
        stampFloat(next, d.rect.x + ox - layer.x, d.rect.y + oy - layer.y, d.float);
        const after = next.snapshot(), selAfter = this.floatSelection(d, ox, oy);
        const from = { ...d.rect, x: d.rect.x + d.ox, y: d.rect.y + d.oy }, to = { ...d.rect, x: d.rect.x + ox, y: d.rect.y + oy };
        const dirty = expand(union(union(from, to)!, d.rect)!, 1);
        const command = new CompositeCommand('Move', [new RasterEditCommand('Move', { kind: 'layer', layerId: layer.id }, d.before, after, dirty), new RasterEditCommand('Move', { kind: 'selection' }, d.selBefore, selAfter, dirty)]);
        // Last ownership check before authoritative writes. Track each resource's last own version.
        if (!this.validPreview(h, d)) {this.clearFloatPreview(d); this.floating = null; return this.moveResult = 'cancelled';}
        const owner = d.preview!;
        this.clearFloatPreview(d);
        let rasterVersion = owner.rasterVersion, maskVersion = owner.maskVersion;
        try {
          owner.raster.restore(after); rasterVersion = owner.raster.version;
          owner.mask.restore(selAfter); maskVersion = owner.mask.version;
          // The contour changed shape: never reuse an unpainted, pre-drag wide outline.
          sel.moved = null;
          s.push(command, true);
        } catch (error) {
          if (s.history.current.command === command) {
            // History has committed and normally discarded redo; an observer failed afterwards.
            console.warn('Move committed, but a history notification failed:', error);
          } else {
            // A failing observer/write may have transferred one resource to an external owner.
            if (s.doc.getLayer(layer.id) === layer && layer.raster === owner.raster && owner.raster.version === rasterVersion) owner.raster.restore(d.before);
            if (s.doc.selection.mask === owner.mask && owner.mask.version === maskVersion) owner.mask.restore(d.selBefore);
            this.floating = null;
            throw error;
          }
        }
        this.floating = { layerId: layer.id, layer, x: layer.x, y: layer.y, raster: layer.raster, rasterVersion: layer.raster.version, selVersion: sel.version, mask: sel.mask, float: d.float, floatCov: d.floatCov, cutState: d.cutState, rect: d.rect, ox, oy, baseSelVersion: d.baseSelVersion };
        try { s.doc.emit({ type: 'pixels', layerId: layer.id, rect: dirty }, { type: 'selection' }); }
        catch (error) { console.warn('Move committed, but a document listener failed:', error); }
      } catch (error) {
        if (d.preview) this.clearFloatPreview(d);
        this.moveResult = 'failed';
        toast(`Move failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      h.redraw();
      return this.moveResult;
    }
    return this.moveResult = 'cancelled';
  }

  cancel(h: ToolHost) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const s = h.session;
    if (d.kind === 'layers') {
      for (const id of d.ids) {
        const l = s.doc.getLayer(id);
        if (l) translateLayerDeep(l, -d.applied.dx, -d.applied.dy);
      }
      editor.endInteraction();
      // A structural change also discards any lift and re-renders exactly.
      s.doc.emit({ type: 'structure' });
    } else {
      if (!this.validPreview(h, d)) this.floating = null;
      this.clearFloatPreview(d); h.redraw();
    }
  }

  keyDown(h: ToolHost, e: KeyboardEvent): boolean {
    const step = e.shiftKey ? 10 : 1;
    const map: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = map[e.key];
    if (!m) return false;
    const s = h.session;
    const ids = s.selectedLayers().filter((l) => !l.locks.position && !l.locks.all).map((l) => l.id);
    if (!ids.length) return true;
    s.push(new TranslateLayersCommand(ids, m[0], m[1], { action: 'layer.translate', args: { dx: m[0], dy: m[1] } }));
    return true;
  }

  private bbox(h: ToolHost): Rect | null {
    const l = h.session.activeLayer();
    return l ? layerContentBounds(l) : null;
  }

  private hitHandle(h: ToolHost, p: ToolPointer): boolean {
    const b = this.bbox(h);
    if (!b) return false;
    const v = h.session.view;
    const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h], [b.x + b.w / 2, b.y], [b.x + b.w, b.y + b.h / 2], [b.x + b.w / 2, b.y + b.h], [b.x, b.y + b.h / 2]];
    return pts.some(([x, y]) => {
      const sp = v.docToScreen(x, y);
      return Math.abs(sp.x - p.sx) < 6 && Math.abs(sp.y - p.sy) < 6;
    });
  }

  drawOverlay(h: ToolHost, g: CanvasRenderingContext2D) {
    if (this.drag?.kind === 'layers') drawSnapLines(h, g, this.drag.guides.xs, this.drag.guides.ys);
    if (!opts().move.showTransformControls) return;
    const b = this.bbox(h);
    if (!b) return;
    const v = h.session.view;
    const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => v.docToScreen(x, y));
    g.save();
    g.strokeStyle = '#3d8bfd';
    g.lineWidth = 1;
    g.beginPath();
    corners.forEach((c, i) => (i ? g.lineTo(c.x + 0.5, c.y + 0.5) : g.moveTo(c.x + 0.5, c.y + 0.5)));
    g.closePath();
    g.stroke();
    const mids = [[b.x + b.w / 2, b.y], [b.x + b.w, b.y + b.h / 2], [b.x + b.w / 2, b.y + b.h], [b.x, b.y + b.h / 2]].map(([x, y]) => v.docToScreen(x, y));
    g.fillStyle = '#fff';
    for (const c of [...corners, ...mids]) { g.fillRect(c.x - 3.5, c.y - 3.5, 7, 7); g.strokeRect(c.x - 3.5, c.y - 3.5, 7, 7); }
    g.restore();
  }
}

export { intersect, isEmpty, ui };
