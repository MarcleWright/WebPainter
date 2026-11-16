import {checkpointReady,hasUncommittedChanges,captureCheckpoint,onCheckpointChange} from '../app/checkpoint';
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
import { ui,useApp } from '../app/store';
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
  let change=0,historyRevision=0;
  const ready=()=>!!editor.active&&!boundary.busy()&&checkpointReady(editor.active);
  class DeferredCheckpoint extends Error {}
  let closeCapture:{token:symbol;entry:string;revision:number}|null=null;
  const assertLive = () => { if (disposed) throw new Error('Editor disposed'); };
  const operation = (): Operation => ({ generation, operationId: `${generation}:${++sequence}`, binding });
  const valid = (op: Operation) => !disposed && op.generation === generation && op.binding === binding;
  const state = () => ({ outputBusy:!!editor.active?.outputBusy, checkpointReady:ready(), hasUncommittedChanges:!!editor.active&&(boundary.busy()||hasUncommittedChanges(editor.active)), change, generation, open: !!editor.active, dirty: !!editor.active?.modified, checkpoint: editor.active?.history.current.id ?? null });
  let lastState: ReturnType<typeof state> | null = null;
  const notify = () => {
    if (disposed) return;
    const current = state();
    if (lastState && current.generation === lastState.generation && current.open === lastState.open && current.dirty === lastState.dirty && current.checkpoint === lastState.checkpoint && current.change===lastState.change && current.outputBusy===lastState.outputBusy && current.checkpointReady===lastState.checkpointReady && current.hasUncommittedChanges===lastState.hasUncommittedChanges) return;
    lastState = current;
    try { host.dirty(current); }
    catch (e) { try { host.error({ generation, message: String(e) }); } catch { /* Observers do not own edits. */ } }
  };
  const stopBoundary=boundary.subscribe(notify);
  const stopToolState=useApp.subscribe((state,prev)=>{if(state.historyRev!==prev.historyRev||state.tool!==prev.tool)notify();});
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
  async function awaitAuthority(s: NonNullable<typeof editor.active>) {
    const transform=s.transformPending;
    if(transform && !(await transform))throw Error('Transform was not committed; confirm or cancel the retained preview');
    if(editor.session(s.id)!==s)throw Error('Stale output session');
  }
  async function capture(format:'png'|'psd'='png'): Promise<Output> {
    assertLive();const s=editor.active;
    if(opening||!s||s.outputBusy||s.closeRequested)throw Error('Editor busy or unavailable');
    const op=operation();
    const pending=Promise.resolve().then(async()=>{
      await awaitAuthority(s);
      if(!prepareMoveOutput(s)||boundary.busy()||!checkpointReady(s))throw Error('Editor busy or unavailable');
      const protection=s.acquireEditProtection('embedded-capture');s.notify();
      try {
        const checkpoint=snapshotDocument(s.doc);
        const bytes=await exporters.find(x=>x.id===format)!.export(checkpoint,{});
        if(!valid(op)||editor.session(s.id)!==s)throw Error('Stale capture');
        return {...op,format,bytes};
      }finally{s.releaseEditProtection(protection);s.notify();}
    });
    const reservation=s.reserveOutput(pending.then(()=>true,()=>false));if(!reservation)throw Error('Output already reserved');
    try{return await pending;}finally{s.releaseOutput(reservation);}
  }
  async function nativeCheckpoint(publish:boolean,requirePreview:boolean,intent:'background'|'explicit'|'close'='explicit'):Promise<Output> {
    const background=intent==='background',closing=intent==='close';
    assertLive();const s=editor.active;
    if(background&&(!ready()||s?.outputBusy||s?.closeRequested))throw new DeferredCheckpoint('Checkpoint deferred');
    if(host.nativeVersion!==1||opening||!s||s.outputBusy||(s.closeRequested&&!closing))throw Error('Native editor busy or unavailable');
    const op=operation();
    const pending=Promise.resolve().then(async()=>{
      if(!valid(op)||editor.session(s.id)!==s||!s.ownsOutput(reservation!))throw Error('Stale checkpoint');
      if(!background&&!closing){await awaitAuthority(s);if(!prepareMoveOutput(s))throw Error('Editor unavailable');}
      let captured:ReturnType<typeof captureCheckpoint>;
      const captureStart=performance.now();
      if(closing){
        const cutoff=closeCapture;
        if(!cutoff||!s.ownsEditProtection(cutoff.token)||s.history.current.id!==cutoff.entry||s.doc.rev!==cutoff.revision)throw Error('Stale close cutoff');
        captured={document:snapshotDocument(s.doc),entry:cutoff.entry,revision:cutoff.revision};
      }else{
        if(boundary.busy())throw new DeferredCheckpoint('Checkpoint deferred');
        captured=captureCheckpoint(s);
        if(!captured)throw new DeferredCheckpoint('Checkpoint deferred');
      }
      performance.measure('wp:checkpoint:snapshot-lock',{start:captureStart,duration:performance.now()-captureStart});
      const {document:checkpoint,entry,revision}=captured;
      const encoded=await checkpointOutput(checkpoint,requirePreview?'generation':'native');
      if(encoded.preview&&encoded.preview.byteLength>32*1024*1024)throw Error('Composite preview exceeds 32 MiB portable limit');
      const output:Output={...op,format:'wpnative',...encoded,...(!requirePreview?{transfer:true as const}:{}),checkpoint:entry};
      if(!valid(op)||editor.session(s.id)!==s||!s.ownsOutput(reservation!))throw Error('Stale native checkpoint');
      if(publish){await host.save(output);if(!valid(op)||editor.session(s.id)!==s||!s.ownsOutput(reservation!))throw Error('Stale native receipt');
        if(s.history.current.id===entry&&s.doc.rev!==revision&&s.doc.rev!==historyRevision)throw Error('Untracked mutation during native save');
        s.markSaved(entry);
      }
      return output;
    });
    const reservation=s.reserveOutput(pending.then(()=>true,()=>false));if(!reservation)throw Error('Output already reserved');
    try{return await pending;}catch(e){
      // This valid reservation is the only writer: no newer receipt can have confirmed a saved point.
      if(!(e instanceof DeferredCheckpoint)&&publish&&valid(op)&&editor.session(s.id)===s&&s.ownsOutput(reservation!))s.markUnsaved();
      throw e;
    }finally{s.releaseOutput(reservation);}
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
        historyRevision=s.doc.rev;const offState=onCheckpointChange(s,notify),offHistory=s.history.on(()=>{change++;historyRevision=s.doc.rev;notify();});offSession=()=>{offState();offHistory();}; notify();
      } catch (e) { if (valid(op)) host.error({ generation, message: String(e) }); throw e; }
      finally { opening = false; }
    },
    async save() {
      assertLive();if(opening)return false;const issued=generation;
      if(host.nativeVersion===1){try{await nativeCheckpoint(true,false);notify();return true;}catch(e){if(!disposed&&generation===issued)host.error({generation:issued,message:String(e)});return false;}}
      const ok=await save();notify();return ok;
    },
    async saveBackground(){const issued=generation;if(!ready()||editor.active?.outputBusy||editor.active?.closeRequested)return 'deferred';try{await nativeCheckpoint(true,false,'background');return 'saved';}catch(e){if(e instanceof DeferredCheckpoint)return 'deferred';if(!disposed&&generation===issued)host.error({generation:issued,message:String(e)});return 'failed';}},
    captureComposite: capture,
    captureNative:()=>nativeCheckpoint(false,false,'background'),saveAndCapture:()=>nativeCheckpoint(true,true),
    async exportPng() { const output = await capture(); await host.export(output); if (!valid(output)) throw new Error('Stale export receipt'); },
    async exportPsd() { const output=await capture('psd');await host.export(output);if(!valid(output))throw Error('Stale export receipt'); },
    async addResource(token) {
      assertLive();const s=editor.active;
      if(opening||!s||s.outputBusy||s.closeRequested||!s.canEdit())throw Error('Editor busy');
      const op=operation();const protection=s.acquireEditProtection('embedded-resource');s.notify();
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
        s.releaseEditProtection(protection);s.push(new CreateLayerCommand('Add image resource',layer,null,s.doc.root.children.length));s.setActive(layer.id);
      })();
      const reservation=s.reserveOutput(pending.then(()=>true,()=>false));if(!reservation)throw Error('Output already reserved');
      try{await pending;}finally{s.releaseOutput(reservation);s.releaseEditProtection(protection);}
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
      const s=editor.active;
      let ok:boolean;
      if(host.nativeVersion!==1||!s)ok=await closeSession();
      else {
        const existing=s.joinClose();if(existing)return existing;
        let protection:symbol|undefined;
        const closing=Promise.resolve().then(async()=>{
          const output=s.joinOutput();if(output&&!(await output))return false;
          await awaitAuthority(s);
          if(!prepareMoveOutput(s)||!ready())return false;
          s.history.seal();protection=s.acquireEditProtection('embedded-close');
          closeCapture={token:protection,entry:s.history.current.id,revision:s.doc.rev};
          if(s.modified){
            const answer=await host.confirm('Save changes before closing?',undefined,['Save','Cancel']);
            if(answer!==0)return false;
            await nativeCheckpoint(true,false,'close');
          }
          if(editor.session(s.id)!==s||s.history.current.id!==closeCapture.entry||s.doc.rev!==closeCapture.revision||s.modified)return false;
          editor.removeSession(s.id);return true;
        }).catch(e=>{host.error({generation,message:String(e)});return false;});
        s.setClose(closing);
        try{ok=await closing;}finally{closeCapture=null;s.releaseClose(closing);if(protection)s.releaseEditProtection(protection);}
      }
      if (ok) { offSession(); offSession = () => {}; binding = ''; generation = ++nextGeneration; notify(); }
      return ok;
    },
    destroy() {
      assertLive();
      if (editor.sessions.length) throw new Error('Request close before destroy');
      disposed = true; generation = ++nextGeneration; offSession(); stopText(); stopBoundary(); stopToolState();
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
