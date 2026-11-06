/** Comparison-only instrumentation around the unchanged standalone boot. */
import '../main';
import { openBytes, prepareMoveOutput } from '../app/fileOps';
import { editor } from '../app/editor';
import { snapshotDocument } from '../document/clone';
import { exporters } from '../formats/registry';
Object.assign(window, {
  async __wpProbeOpen() {
    const r=await fetch(new URL('../fixture.psd',location.href));
    if(!r.ok)throw Error('Missing shared fixture');
    await openBytes('03c.psd',null,new Uint8Array(await r.arrayBuffer()));
  },
  async __wpProbeOutput() {
    const s=editor.active!; if(!prepareMoveOutput(s))throw Error('Busy');
    return (await exporters.find(e=>e.id==='png')!.export(snapshotDocument(s.doc),{})).length;
  },
});
