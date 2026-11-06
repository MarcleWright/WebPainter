import { mountFrame } from './mount';
import { connectRpc } from './rpc';
import type { HostPort } from './contract';

const nonce = new URLSearchParams(location.hash.slice(1)).get('nonce');
// Local same-origin resources only. An opaque file:// deployment needs explicit future design.
if (!nonce || location.origin === 'null' || window.parent === window) throw new Error('Invalid embedded origin');
const handshake = (event: MessageEvent) => {
  if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'wp-connect' || event.data?.version !== 2 || event.data?.nonce !== nonce || event.ports.length !== 1) return;
  window.removeEventListener('message', handshake);
  const rpc = connectRpc(event.ports[0], nonce, {
    open: (binding, token) => api.open(binding, token), save: () => api.save(), capture: () => api.captureComposite(),
    exportPng: () => api.exportPng(), command: command => api.command(command), state: () => api.state(),
    close: () => api.requestClose(), destroy: async () => { await api.destroy(); setTimeout(() => rpc.dispose(), 0); },
    captureNative:()=>api.captureNative(),saveAndCapture:()=>api.saveAndCapture(),addResource:token=>api.addResource(token),exportPsd:()=>api.exportPsd(),
  });
  const host: HostPort = {
    nativeVersion:event.data.nativeVersion===1?1:undefined,
    readResource: (...a) => rpc.call('readResource', ...a), save: o => rpc.call('hostSave', o), export: o => rpc.call('hostExport', o),
    confirm: (...a) => rpc.call('confirm', ...a),
    dirty: s => { void rpc.call('dirty', s).catch(() => {}); }, error: e => { void rpc.call('error', e).catch(() => {}); },
  };
  const api = mountFrame(document.getElementById('root')!, host);
};
window.addEventListener('message', handshake);
parent.postMessage({ type: 'wp-ready', version: 2, nonce }, location.origin);
