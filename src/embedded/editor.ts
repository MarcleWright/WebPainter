import {textEditState,onTextEdit} from '../tools/typeTool';
import {MENUS} from '../app/menus';
import {checkpointOutput} from './checkpoint-output';
import {installAccessPolicy} from '../app/access';
import {nativePolicy} from './capabilities';
import { editor } from '../app/editor';
import { actionDefinitions, register, run } from '../app/actions';
import { closeSession, prepareMoveOutput, save } from '../app/fileOps';
import { installPlatform, type Platform } from '../app/platform/platform';
import { snapshotDocument, cloneLayer } from '../document/clone';
import { decodeNative, isNative } from '../document/native';
import { CreateLayerCommand } from '../commands/layerCommands';
import { adoptLayers, spaceOfDoc } from '../color/convertDocument';
import { findImporter, exporters } from '../formats/registry';
import { registerTools } from '../tools/registry';
import { keymap } from '../app/shortcuts';
import { installTextEngine } from '../app/textEngine';
import { ui } from '../app/store';
import type { EmbeddedEditor, HostPort, Operation, Output } from './contract';

let active = false;
let nextGeneration = 0;
/** One active editor per JS realm; no desktop boot, recovery, updater or plugin activation. */
export function initializeEditor(host: HostPort, boundary:{busy():boolean;subscribe(fn:()=>void):()=>void}={busy:()=>false,subscribe:()=>()=>{}}): EmbeddedEditor {
  if (active || editor.sessions.length) throw new Error('An editor is already active');
  const original=actionDefinitions();
  const policy=host.nativeVersion===1?nativePolicy(host.capabilityPolicy,new Set(original.filter(a=>!a.comingSoon).map(a=>a.id))):null;
  const fileIndex=MENUS.findIndex(m=>m.id==='file'),fileMenu=MENUS[fileIndex];
  const hostFiles=!!policy&&['file.save','file.close','file.closeAll'].every(id=>{const a=policy('action:'+id);return !a.visible&&!a.enabled;});
  if(hostFiles&&fileIndex>=0)MENUS.splice(fileIndex,1);
  active = true;
  const stopAccess=policy?installAccessPolicy(policy):()=>{};
  let generation = ++nextGeneration, sequence = 0, binding = '', disposed = false, opening = false;
  let offSession = () => {};
  let change=0;
  const busy=()=>boundary.busy()||!!editor.active?.outputPending||!!editor.currentTool?.busy?.()||!!textEditState()||editor.active?.mode.kind!=='none';
  const assertLive = () => { if (disposed) throw new Error('Editor disposed'); };
  const operation = (): Operation => ({ generation, operationId: `${generation}:${++sequence}`, binding });
  const valid = (op: Operation) => !disposed && op.generation === generation && op.binding === binding;
  const state = () => ({ busy:!!editor.active&&busy(), change, generation, open: !!editor.active, dirty: !!editor.active?.modified, checkpoint: editor.active?.history.current.id ?? null });
  let lastState: ReturnType<typeof state> | null = null;
  const notify = () => {
    if (disposed) return;
    const current = state();
    if (lastState && current.generation === lastState.generation && current.open === lastState.open && current.dirty === lastState.dirty && current.checkpoint === lastState.checkpoint && current.change===lastState.change && current.busy===lastState.busy) return;
    lastState = current;
    try { host.dirty(current); }
    catch (e) { try { host.error({ generation, message: String(e) }); } catch { /* Observers do not own edits. */ } }
  };
  const stopBoundary=boundary.subscribe(notify),stopTextState=onTextEdit(notify);
  const unsupported = async (): Promise<never> => { throw new Error('Capability unavailable in embedded mode'); };
  const services: Platform = {
    kind: 'browser', canWriteInPlace: true, bridge: null,
    openFiles: unsupported, readPath: unsupported, fileFromDrop: unsupported,
    chooseSavePath: async () => `${generation}.psd`,
    writePath: async (_path, bytes) => {
      const op = operation();
      await host.save({ ...op, format: 'psd-test', bytes });
      if (!valid(op)) throw new Error('Stale output receipt');
    },
    async confirm(message,detail,buttons=['OK','Cancel']) {
      const answer=await host.confirm(message,detail,buttons);
      // Keep the core's close gate/output reservation. Native Save happens here, then the
      // core may finish closing only after a confirmed, still-current clean checkpoint.
      if(host.nativeVersion===1 && buttons.length===3 && buttons[0]==='Save' && buttons[1]==='Don’t Save') {
        if(answer===0){try{await nativeCheckpoint(true,true,false);return editor.active?.modified?2:1;}catch(e){host.error({generation,message:String(e)});return 2;}}
        return answer===1?1:2;
      }
      return Number.isInteger(answer)&&answer>=0&&answer<buttons.length?answer:buttons.length-1;
    },
    recovery: { list: async () => [], save: unsupported, load: unsupported, remove: async () => {} },
    scratch: { put: unsupported, get: unsupported, remove: async () => {}, clear: async () => {}, location: async () => 'Unavailable' },
    setTitle() {}, setEdited: notify, onCloseRequested() {}, confirmClose() {}, onOpenFile() {},
    launchFiles: async () => [], memory: async () => null,
  };
  const restorePlatform = installPlatform(services);
  registerTools();
  if(policy&&!policy('tool:'+editor.currentToolId).enabled)editor.setTool('brush');
  const stopText = installTextEngine();
  // A bounded capability list applies to menu, shortcut and command-palette calls alike.

  for (const a of original) {
    if (/^(file\.|app\.)/.test(a.id) || ['edit.preferences', 'window.actions'].includes(a.id)) {
      const allowed = ['file.save', 'file.close', 'file.closeAll'].includes(a.id);
      register({ ...a, enabled: () => allowed && !!editor.active,
        run: a.id === 'file.save' ? () => api.save() : allowed ? () => api.requestClose() : unsupported });
    }
  }
  keymap.rebuild();
  async function capture(format:'png'|'psd'='png'): Promise<Output> {
    assertLive();
    const s = editor.active;
    if (opening || !s || s.outputPending || s.closePending || !prepareMoveOutput(s)) throw new Error('Editor busy or unavailable');
    const op = operation();
    s.editProtected = true; s.notify();
    const pending = Promise.resolve().then(async () => {
      const checkpoint = snapshotDocument(s.doc);
      const bytes = await exporters.find(x => x.id === format)!.export(checkpoint, {});
      if (!valid(op) || editor.session(s.id) !== s) throw new Error('Stale capture');
      return { ...op, format, bytes };
    });
    s.outputPending = pending.then(() => true, () => false);
    try { return await pending; }
    finally { s.outputPending = null; s.editProtected = false; s.notify(); }
  }
  async function nativeCheckpoint(publish:boolean, closing=false,requirePreview=true,background=false):Promise<Output> {
    assertLive();const s=editor.active;
    if(background&&s&&busy())throw Error('Checkpoint deferred: operation in progress');
    if(host.nativeVersion!==1 || opening || !s || s.outputPending || (s.closePending&&!closing) || (background?busy():!prepareMoveOutput(s)))throw Error('Native editor busy or unavailable');
    s.history.seal();
    const op=operation(),entry=s.history.current.id,revision=s.doc.rev,protectedBefore=s.editProtected;
    const captureStart=performance.now();s.editProtected=true;
    let checkpoint:ReturnType<typeof snapshotDocument>;
    try{checkpoint=snapshotDocument(s.doc);}finally{s.editProtected=protectedBefore;s.notify();performance.measure('wp:checkpoint:snapshot-lock',{start:captureStart,duration:performance.now()-captureStart});}
    const pending=Promise.resolve().then(async()=>{
      const encoded=await checkpointOutput(checkpoint,requirePreview?'generation':'native');
      if(encoded.preview&&encoded.preview.byteLength>32*1024*1024)throw Error('Composite preview exceeds 32 MiB portable limit');
      const output:Output={...op,format:'wpnative',...encoded,...(!requirePreview?{transfer:true as const}:{}),checkpoint:entry};
      if(!valid(op)||editor.session(s.id)!==s)throw Error('Stale native checkpoint');
      if(publish){await host.save(output);if(!valid(op)||editor.session(s.id)!==s)throw Error('Stale native receipt');
        if(s.history.current.id===entry&&s.doc.rev!==revision)throw Error('Untracked mutation during native save');
        s.markSaved(entry);
      }
      return output;
    });
    s.outputPending=pending.then(()=>true,()=>false);s.notify();
    try{return await pending;}catch(e){if(publish&&valid(op)&&editor.session(s.id)===s)s.markUnsaved();throw e;}finally{s.outputPending=null;s.notify();}
  }
  const api: EmbeddedEditor = {
    async open(nextBinding, token) {
      assertLive();
      if (opening || editor.active) throw new Error('Close the current work before opening another');
      opening = true; binding = nextBinding; generation = ++nextGeneration;
      const op = operation();
      try {
        const resource = await host.readResource(op, token);
        if (!valid(op)) throw new Error('Stale open');
        const importer = findImporter(resource.bytes, resource.name);
        const native=isNative(resource.bytes);
        if(native && host.nativeVersion!==1)throw Error('Native host capability required');
        if(!native&&!importer?.available)throw Error('Unsupported resource');
        const result=native?decodeNative(resource.bytes):await importer!.import(resource.bytes, resource.name, {});
        if (!valid(op)) throw new Error('Stale open');
        result.doc.filePath = null;
        const s = editor.addDocument(result.doc);
        if(resource.recovered)s.markUnsaved();
        const offState=s.on(notify),offHistory=s.history.on(()=>{change++;notify();});offSession=()=>{offState();offHistory();}; notify();
      } catch (e) { if (valid(op)) host.error({ generation, message: String(e) }); throw e; }
      finally { opening = false; }
    },
    async save() {
      assertLive();if(opening)return false;
      if(host.nativeVersion===1){try{await nativeCheckpoint(true,false,false);notify();return true;}catch(e){host.error({generation,message:String(e)});return false;}}
      const ok=await save();notify();return ok;
    },
    async saveBackground(){if(busy()||editor.active?.outputPending)return 'deferred';try{await nativeCheckpoint(true,false,false,true);return 'saved';}catch(e){host.error({generation,message:String(e)});return 'failed';}},
    captureComposite: capture,
    captureNative:()=>nativeCheckpoint(false,false,false,true),saveAndCapture:()=>nativeCheckpoint(true),
    async exportPng() { const output = await capture(); await host.export(output); if (!valid(output)) throw new Error('Stale export receipt'); },
    async exportPsd() { const output=await capture('psd');await host.export(output);if(!valid(output))throw Error('Stale export receipt'); },
    async addResource(token) {
      assertLive();const s=editor.active;
      if(opening||!s||s.outputPending||s.closePending||!s.canEdit())throw Error('Editor busy');
      const op=operation();s.editProtected=true;s.notify();
      const pending=(async()=>{
        const resource=await host.readResource(op,token),importer=findImporter(resource.bytes,resource.name);
        if(resource.source && (!resource.source.id || !/^[a-f0-9]{64}$/.test(resource.source.hash)))throw Error('Invalid immutable resource source');
        if(!importer?.available||importer.id==='psd'||isNative(resource.bytes))throw Error('Only raster image resources can be added');
        const result=await importer.import(resource.bytes,resource.name,{}),layers=result.doc.allLayers();
        if(layers.length!==1||layers[0].kind!=='pixel'||result.doc.width*result.doc.height>8192*8192)throw Error('Unsupported image resource');
        if(!valid(op)||editor.session(s.id)!==s)throw Error('Stale resource');
        const layer=cloneLayer(layers[0],true);adoptLayers(s.doc,spaceOfDoc(result.doc),[layer]);
        if(resource.source)layer.metadata.custom={source:{...resource.source}};
        // The owner-held reservation protects the async read; release only for this command.
        s.editProtected=false;s.push(new CreateLayerCommand('Add image resource',layer,null,s.doc.root.children.length));s.editProtected=true;s.setActive(layer.id);
      })();
      s.outputPending=pending.then(()=>true,()=>false);s.notify();
      try{await pending;}finally{s.outputPending=null;s.editProtected=false;s.notify();}
    },
    async command(command) {
      assertLive();
      const ids = { undo: 'edit.undo', redo: 'edit.redo', layerViaCopy: 'layer.viaCopy', transform: 'edit.freeTransform' };
      if (!Object.hasOwn(ids, command)) throw new Error('Unsupported command');
      await run(ids[command]);
    },
    state,
    async requestClose() {
      assertLive(); if (opening) return false;
      const ok = await closeSession();
      if (ok) { offSession(); offSession = () => {}; binding = ''; generation = ++nextGeneration; notify(); }
      return ok;
    },
    destroy() {
      assertLive();
      if (editor.sessions.length) throw new Error('Request close before destroy');
      disposed = true; generation = ++nextGeneration; offSession(); stopText(); stopBoundary(); stopTextState();
      editor.hostFactory = null; editor.clipboard = null;
      editor.releaseToolInstances();
      for (const a of original) register(a);
      if(hostFiles&&fileMenu&&!MENUS.includes(fileMenu))MENUS.splice(fileIndex,0,fileMenu);
      keymap.rebuild(); restorePlatform(); stopAccess(); active = false;
      ui.set({ dialogs: [], toasts: [], progress: [] });
    },
  };
  return api;
}
