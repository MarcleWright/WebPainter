// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { initializeEditor } from '../../src/embedded/editor';
import { editor } from '../../src/app/editor';
import { platform } from '../../src/app/platform/platform';
import { exportPsd } from '../../src/psd/export';
import { newDoc, solidLayer, add } from '../helpers/build';
import { SetLayerPropsCommand } from '../../src/commands/layerCommands';
import type { HostPort, EmbeddedEditor, Output } from '../../src/embedded/contract';
import { action, run } from '../../src/app/actions';
import { validArgs } from '../../src/embedded/rpc';

let api: EmbeddedEditor | undefined;
afterEach(async () => { if (api) { for (const s of [...editor.sessions]) editor.removeSession(s.id); api.destroy(); api = undefined; } });
function fixture() {
  const doc = newDoc(24, 16); add(doc, solidLayer(doc, 'pixels', 0, 0, 24, 16, [.2,.4,.8,1]));
  const bytes = exportPsd(doc, { maximizeCompatibility: false });
  const host: HostPort = { readResource: vi.fn(async () => ({ name: 'fixture.psd', bytes })), save: vi.fn(async () => {}),
    export: vi.fn(async () => {}), confirm: vi.fn(async () => 2), dirty: vi.fn(), error: vi.fn() };
  return host;
}
function edit() { const s = editor.active!; s.push(new SetLayerPropsCommand('Opacity', s.activeLayerId!, { opacity: 1 }, { opacity: .5 })); expect(s.activeLayer()!.opacity).toBe(.5); return s; }
it('uses real history, retries failure, preserves undo and close Cancel; restores default services on destroy/reopen', async () => {
  const originalPlatform = platform(), originalSave = action('file.save');
  const host = fixture(); api = initializeEditor(host);
  expect(() => initializeEditor(host)).toThrow();
  await api.open('opaque-a', 'resource'); const s = edit();
  vi.mocked(host.save).mockRejectedValueOnce(new Error('injected write failure'));
  expect(await api.save()).toBe(false); expect(s.modified).toBe(true); expect(s.canEdit()).toBe(true);
  expect(await api.requestClose()).toBe(false); expect(api.state().open).toBe(true);
  expect(() => api!.destroy()).toThrow('Request close');
  const before = s.history.current.id;
  expect(await api.save()).toBe(true); expect(s.modified).toBe(false); expect(s.history.current.id).toBe(before);
  await api.command('undo'); expect(s.modified).toBe(true); await api.command('redo'); expect(s.modified).toBe(false);
  expect(await api.requestClose()).toBe(true); api.destroy(); api = undefined;
  expect(platform()).toBe(originalPlatform); expect(action('file.save')).toBe(originalSave);
  api = initializeEditor(fixture()); await api.open('opaque-b','resource'); expect(editor.sessions).toHaveLength(1);
});
it('delayed save blocks close/open/destroy and cannot mark a subsequent session clean', async () => {
  const host = fixture(); api = initializeEditor(host); await api.open('one', 'resource'); const s = edit();
  let release!: () => void, started!: () => void;
  const ready = new Promise<void>(r => started = r);
  vi.mocked(host.save).mockImplementationOnce(async () => { started(); await new Promise<void>(r => release = r); });
  const saving = api.save(); await ready;
  expect(s.canEdit()).toBe(false); expect(() => api!.destroy()).toThrow();
  await expect(api.open('two','resource')).rejects.toThrow();
  const closing = api.requestClose(); release(); expect(await saving).toBe(true); expect(await closing).toBe(true);
  await api.open('two', 'resource'); const next = edit(); expect(next.modified).toBe(true); expect(next).not.toBe(s);
  const out = vi.mocked(host.save).mock.calls[0][0]; expect(out.binding).toBe('one'); expect(out.generation).not.toBe(api.state().generation);
});
it('disposal invalidates an outstanding resource read without installing a late session', async () => {
  const host = fixture(); let release!: (value: Awaited<ReturnType<HostPort['readResource']>>) => void;
  const resource = await host.readResource({ generation: 0, operationId: '', binding: '' }, '');
  vi.mocked(host.readResource).mockImplementation(() => new Promise(r => release = r));
  api = initializeEditor(host); const opening = api.open('old','token'); api.destroy(); api = undefined;
  const nextHost = fixture(); api = initializeEditor(nextHost); await api.open('new','token');
  release(resource); await expect(opening).rejects.toThrow('Stale open'); expect(editor.sessions).toHaveLength(1); expect(api.state().open).toBe(true);
});
it('captures the real stable composite without marking saved, and rejects disabled file entry points', async () => {
  const host = fixture(); api = initializeEditor(host); await api.open('opaque','resource'); const s = edit();
  const before = s.history.current.id; const output: Output = await api.captureComposite();
  expect(output.format).toBe('png'); expect(output.bytes[0]).toBe(137); expect(s.modified).toBe(true); expect(s.history.current.id).toBe(before);
  await run('file.new'); expect(editor.sessions).toHaveLength(1); expect(action('file.open')?.enabled?.()).toBe(false);
  expect(validArgs('command',['constructor'])).toBe(false); expect(validArgs('hostSave',[{...output, bytes:'bad'}])).toBe(false);
  expect(validArgs('hostSave',[output])).toBe(true); expect(validArgs('open',['one'])).toBe(false);
});
it('releases tool instances and document observers across destroy/reopen', async () => {
  const count=editor.documentAdded.size;
  api=initializeEditor(fixture()); const previous=editor.tool('move');
  await api.open('one','token'); await api.requestClose(); api.destroy(); api=undefined;
  expect(editor.documentAdded.size).toBe(count);
  api=initializeEditor(fixture()); expect(editor.tool('move')).not.toBe(previous);
});
it('a failed dirty observer cannot interrupt document mutation or opening', async () => {
  const host=fixture(); host.dirty=()=>{throw Error('observer failure');};
  api=initializeEditor(host); await api.open('one','token'); const s=edit(); expect(s.modified).toBe(true);
});
it('does not call the host for preview/pixel notifications without a dirty transition', async () => {
  const host=fixture();api=initializeEditor(host);await api.open('one','token');
  const calls=vi.mocked(host.dirty).mock.calls.length,s=editor.active!;
  for(let i=0;i<100;i++)s.doc.emit({type:'pixels',layerId:s.activeLayerId!,rect:{x:0,y:0,w:1,h:1}});
  expect(vi.mocked(host.dirty).mock.calls.length).toBe(calls);
  edit();expect(vi.mocked(host.dirty).mock.calls.length).toBeLessThanOrEqual(calls+2);
});
