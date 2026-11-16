import {finishPen,readPenSession} from '../tools/penSession';
/**
 * DocumentSession — one open document: model + history + renderer + view + editing state.
 */
import { maybeOffload, scratchAvailable } from '../history/scratch';
import { CelenneDocument } from '../document/document';
import { newId } from '../document/ids';
import type { Layer, LayerId } from '../document/types';
import { hasRaster } from '../document/types';
import { Command, History } from '../history/history';
import { RenderEngine } from '../rendering/renderEngine';
import { ViewTransform } from '../rendering/viewport';
import type { RasterTarget } from '../commands/rasterTarget';

export type SessionMode =
  | { kind: 'none' }
  | { kind: 'transform'; layerIds: LayerId[] }
  | { kind: 'crop' }
  | { kind: 'text'; layerId: LayerId; isNew: boolean };

const historyHooks: ((s: DocumentSession) => void)[] = [];

/** Runs after every history change (push, undo, redo) of every session. */
export function addHistoryHook(h: (s: DocumentSession) => void): void {
  historyHooks.push(h);
}

export class DocumentSession {
  readonly id = newId('sess');
  readonly history: History;
  outputPending: Promise<boolean> | null = null;
  closePending: Promise<boolean> | null = null;
  editProtected = false;
  private disposed = false;
  canEdit(): boolean { return !this.editProtected && !this.disposed; }

  /** Serialize recovery writes/removal for this document only. */
  recoveryWrite: Promise<void> = Promise.resolve();
  readonly engine: RenderEngine;
  readonly view = new ViewTransform();
  activeLayerId: LayerId | null = null;
  selectedIds = new Set<LayerId>();
  /** Paint on the active layer's mask instead of its pixels. */
  private _editMask: boolean = false;
  get editMask(): boolean {return this._editMask;}
  set editMask(value: boolean) {if(value!==this._editMask&&!finishPen(this))return;this._editMask=value;}
  /** Paint into an alpha channel (Channels panel selection). */
  private _activeChannelId: string | null = null;
  get activeChannelId(): string | null {return this._activeChannelId;}
  set activeChannelId(value: string | null) {if(value!==this._activeChannelId&&!finishPen(this))return;this._activeChannelId=value;}
  /** Path targeted by pen tools / Paths panel (null = work path or active shape layer). */
  private _activePathId: string | null = null;
  get activePathId(): string | null {return this._activePathId;}
  set activePathId(value: string | null) {
    if(value!==this._activePathId&&!finishPen(this))return;
    this._activePathId=value;
    if(value&&this.doc.paths.some(p=>p.id===value&&p.kind==='work'))this.hiddenWorkPath=null;
  }
  /** Session-only display state: never part of document snapshots, dirty state or files. */
  private hiddenWorkPath: {entry:DocumentSession['doc']['paths'][number];content:string}|null=null;
  private workPathContent(p:DocumentSession['doc']['paths'][number]):string {
    return JSON.stringify([p.path.fillRule,p.path.subpaths.map(s=>[s.closed,s.op,s.knots.map(k=>[k.x,k.y,k.inX,k.inY,k.outX,k.outY,k.smooth])])]);
  }
  isWorkPathHidden(p:DocumentSession['doc']['paths'][number]):boolean {
    return p.kind==='work'&&this.hiddenWorkPath?.entry===p&&this.hiddenWorkPath.content===this.workPathContent(p);
  }
  /** Success-only cleanup after the conversion owner has already finished Pen and rechecked identity. */
  completeDocumentPathSelection():void {
    if(readPenSession(this))return;
    const work=this.doc.paths.find(p=>p.kind==='work');
    this.hiddenWorkPath=work?{entry:work,content:this.workPathContent(work)}:null;
    this._activePathId=null;
    try{this.notify();}catch(error){console.warn('Path selection display updated; a session observer failed:',error);}
  }
  mode: SessionMode = { kind: 'none' };
  fitted = false;
  private savedEntryId: string;
  private listeners = new Set<() => void>();
  private unsub: (() => void)[] = [];

  constructor(
    readonly doc: CelenneDocument,
    initialLabel = 'Open',
  ) {
    this.history = new History(doc, initialLabel);
    this.history.canMutate = () => this.canEdit();
    doc.editingAllowed = () => this.canEdit();
    this.engine = new RenderEngine(doc);
    this.savedEntryId = this.history.current.id;
    const top = doc.root.children[doc.root.children.length - 1];
    if (top) this.setActive(top.id);
    this.unsub.push(
      doc.on(() => {
        if (this.activeLayerId && !doc.getLayer(this.activeLayerId)) {
          const t = doc.root.children[doc.root.children.length - 1];
          this.setActive(t?.id ?? null);
        }
        for (const id of [...this.selectedIds]) if (!doc.getLayer(id)) this.selectedIds.delete(id);
        this.notify();
      }),
    );
    this.unsub.push(this.history.on(() => { for (const h of historyHooks) h(this); this.notify(); this.scheduleOffload(); }));
  }

  private offloadTimer: ReturnType<typeof setTimeout> | null = null;

  /** Pages old history tiles to the scratch disk once editing pauses (see history/scratch.ts). */
  private scheduleOffload(): void {
    if (!scratchAvailable()) return;
    if (this.offloadTimer) clearTimeout(this.offloadTimer);
    this.offloadTimer = setTimeout(() => { this.offloadTimer = null; maybeOffload(this.doc, this.history); }, 2000);
  }

  on(l: () => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  notify(): void {
    for (const l of this.listeners) l();
  }

  get name(): string {
    return this.doc.name;
  }

  get modified(): boolean {
    return this.history.current.id !== this.savedEntryId;
  }

  markSaved(entry = this.history.current.id): void {
    this.savedEntryId = entry;
    this.notify();
  }

  /** Marks the document as having unsaved changes (e.g. recovered from auto-save). */
  markUnsaved(): void {
    this.savedEntryId = '';
    this.notify();
  }

  activeLayer(): Layer | null {
    return this.doc.getLayer(this.activeLayerId);
  }

  setActive(id: LayerId | null, additive = false): boolean {
    if ((id!==this.activeLayerId||this.activeChannelId) && !finishPen(this)) return false;
    if (!additive) this.selectedIds.clear();
    this.activeLayerId = id;
    if (id) this.selectedIds.add(id);
    const l = id ? this.doc.getLayer(id) : null;
    if (!l?.mask) this.editMask = false;
    this.activeChannelId = null;
    this.notify();
    return true;
  }

  toggleSelected(id: LayerId): void {
    if (!finishPen(this)) return;
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
      if (this.activeLayerId === id) this.activeLayerId = [...this.selectedIds].pop() ?? null;
    } else {
      this.selectedIds.add(id);
      this.activeLayerId = id;
    }
    this.notify();
  }

  selectedLayers(): Layer[] {
    const out: Layer[] = [];
    for (const l of this.doc.walk()) if (this.selectedIds.has(l.id)) out.push(l);
    if (!out.length) {
      const a = this.activeLayer();
      if (a) out.push(a);
    }
    return out;
  }

  /** Where painting tools write. Null when the target is not paintable. */
  paintTarget(quickMask: boolean): RasterTarget | null {
    if (!this.canEdit()) return null;
    if (quickMask) return { kind: 'selection' };
    if (this.activeChannelId) return { kind: 'channel', channelId: this.activeChannelId };
    const l = this.activeLayer();
    if (!l) return null;
    if (this.editMask && l.mask) return { kind: 'mask', layerId: l.id };
    if (l.kind === 'pixel') return { kind: 'layer', layerId: l.id };
    if (l.kind === 'adjustment' || l.kind === 'fill') return l.mask ? { kind: 'mask', layerId: l.id } : null;
    return null;
  }

  /** Why painting is not possible (for user-facing messages). */
  paintBlockReason(quickMask: boolean): string | null {
    if (!this.canEdit()) return "This document is busy saving or closing.";
    if (quickMask || this.activeChannelId) return null;
    const l = this.activeLayer();
    if (!l) return 'Select a layer to paint on.';
    if (this.editMask && l.mask) return null;
    if (l.locks.all || l.locks.pixels) return `"${l.name}" is locked (pixels).`;
    if (!l.visible) return `"${l.name}" is hidden. Show the layer to paint on it.`;
    if (l.kind === 'text') return 'Text layers must be rasterized before painting (Layer › Rasterize › Type).';
    if (l.kind === 'shape') return 'Shape layers must be rasterized before painting (Layer › Rasterize › Shape).';
    if (l.kind === 'smartObject') return 'Smart objects must be rasterized or edited via Layer › Smart Objects › Edit Contents.';
    if (l.kind === 'group') return 'Cannot paint on a group. Select a pixel layer inside the group.';
    if ((l.kind === 'adjustment' || l.kind === 'fill') && !l.mask) return 'Add a layer mask to paint on this layer.';
    if (!hasRaster(l)) return 'This layer cannot be painted on.';
    return null;
  }

  push(cmd: Command, alreadyApplied = false): void {
    this.history.push(cmd, alreadyApplied);
  }

  dispose(): void {
    this.disposed = true;
    this.hiddenWorkPath=null;
    if (this.offloadTimer) clearTimeout(this.offloadTimer);
    this.unsub.forEach((u) => u());
    this.engine.dispose();
  }
}
