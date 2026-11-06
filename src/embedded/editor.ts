import { editor } from '../app/editor';
import { allActions, register, run } from '../app/actions';
import { closeSession, prepareMoveOutput, save } from '../app/fileOps';
import { installPlatform, type Platform } from '../app/platform/platform';
import { snapshotDocument } from '../document/clone';
import { findImporter, exporters } from '../formats/registry';
import { registerTools } from '../tools/registry';
import { keymap } from '../app/shortcuts';
import { installTextEngine } from '../app/textEngine';
import { ui } from '../app/store';
import type { EmbeddedEditor, HostPort, Operation, Output } from './contract';

let active = false;
let nextGeneration = 0;
/** One active editor per JS realm; no desktop boot, recovery, updater or plugin activation. */
export function initializeEditor(host: HostPort): EmbeddedEditor {
  if (active || editor.sessions.length) throw new Error('An editor is already active');
  active = true;
  let generation = ++nextGeneration, sequence = 0, binding = '', disposed = false, opening = false;
  let offSession = () => {};
  const assertLive = () => { if (disposed) throw new Error('Editor disposed'); };
  const operation = (): Operation => ({ generation, operationId: `${generation}:${++sequence}`, binding });
  const valid = (op: Operation) => !disposed && op.generation === generation && op.binding === binding;
  const state = () => ({ generation, open: !!editor.active, dirty: !!editor.active?.modified });
  let lastState: ReturnType<typeof state> | null = null;
  const notify = () => {
    if (disposed) return;
    const current = state();
    if (lastState && current.generation === lastState.generation && current.open === lastState.open && current.dirty === lastState.dirty) return;
    lastState = current;
    try { host.dirty(current); }
    catch (e) { try { host.error({ generation, message: String(e) }); } catch { /* Observers do not own edits. */ } }
  };
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
    confirm: (...args) => host.confirm(args[0], args[1], args[2] ?? ['OK', 'Cancel']),
    recovery: { list: async () => [], save: unsupported, load: unsupported, remove: async () => {} },
    scratch: { put: unsupported, get: unsupported, remove: async () => {}, clear: async () => {}, location: async () => 'Unavailable' },
    setTitle() {}, setEdited: notify, onCloseRequested() {}, confirmClose() {}, onOpenFile() {},
    launchFiles: async () => [], memory: async () => null,
  };
  const restorePlatform = installPlatform(services);
  registerTools();
  const stopText = installTextEngine();
  // A bounded capability list applies to menu, shortcut and command-palette calls alike.
  const original = allActions();
  for (const a of original) {
    if (/^(file\.|app\.)/.test(a.id) || ['edit.preferences', 'window.actions'].includes(a.id)) {
      const allowed = ['file.save', 'file.close', 'file.closeAll'].includes(a.id);
      register({ ...a, enabled: () => allowed && !!editor.active,
        run: a.id === 'file.save' ? () => api.save() : allowed ? () => api.requestClose() : unsupported });
    }
  }
  keymap.rebuild();
  async function capture(): Promise<Output> {
    assertLive();
    const s = editor.active;
    if (opening || !s || s.outputPending || s.closePending || !prepareMoveOutput(s)) throw new Error('Editor busy or unavailable');
    const op = operation();
    s.editProtected = true; s.notify();
    const pending = Promise.resolve().then(async () => {
      const checkpoint = snapshotDocument(s.doc);
      const bytes = await exporters.find(x => x.id === 'png')!.export(checkpoint, {});
      if (!valid(op) || editor.session(s.id) !== s) throw new Error('Stale capture');
      return { ...op, format: 'png' as const, bytes };
    });
    s.outputPending = pending.then(() => true, () => false);
    try { return await pending; }
    finally { s.outputPending = null; s.editProtected = false; s.notify(); }
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
        if (!importer?.available) throw new Error('Unsupported resource');
        const result = await importer.import(resource.bytes, resource.name, {});
        if (!valid(op)) throw new Error('Stale open');
        result.doc.filePath = null;
        const s = editor.addDocument(result.doc);
        offSession = s.on(notify); notify();
      } catch (e) { if (valid(op)) host.error({ generation, message: String(e) }); throw e; }
      finally { opening = false; }
    },
    async save() { assertLive(); if (opening) return false; const ok = await save(); notify(); return ok; },
    captureComposite: capture,
    async exportPng() { const output = await capture(); await host.export(output); if (!valid(output)) throw new Error('Stale export receipt'); },
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
      disposed = true; generation = ++nextGeneration; offSession(); stopText();
      editor.hostFactory = null; editor.clipboard = null;
      editor.releaseToolInstances();
      for (const a of original) register(a);
      keymap.rebuild(); restorePlatform(); active = false;
      ui.set({ dialogs: [], toasts: [], progress: [] });
    },
  };
  return api;
}
