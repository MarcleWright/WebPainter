/** Lazy core import: the iframe host must not instantiate a second inactive WP kernel. */
export async function mountDirect(container: HTMLElement, host: HostPort): Promise<EmbeddedEditor> {
  return (await import('./mount')).mountDirect(container, host);
}
/** A composition page owns its document; the host may place its own UI beside WP. */
export async function mountPage(container: HTMLElement, host: HostPort): Promise<EmbeddedEditor> {
  return (await import('./mount')).mountFrame(container, host);
}
export type { EmbeddedEditor, HostPort, Output } from './contract';
import type { EmbeddedEditor, HostPort, EditorState } from './contract';
import { connectRpc } from './rpc';

export async function mountIframe(container: HTMLElement, host: HostPort, frameUrl: string): Promise<EmbeddedEditor> {
  const url = new URL(frameUrl, location.href);
  if (url.origin !== location.origin || location.origin === 'null') throw new Error('Local same-origin iframe required');
  const nonce = crypto.randomUUID(); url.hash = new URLSearchParams({ nonce }).toString();
  const frame = document.createElement('iframe'); frame.title = 'WebPainter comparison';
  frame.style.cssText = 'border:0;width:100%;height:100%';
  const channel = new MessageChannel();
  let cached: EditorState = { generation: 0, open: false, dirty: false };
  const rpc = connectRpc(channel.port1, nonce, {
    readResource: (...a) => host.readResource(a[0], a[1]), hostSave: o => host.save(o), hostExport: o => host.export(o),
    confirm: (...a) => host.confirm(a[0], a[1], a[2]), dirty: s => { cached = s; host.dirty(s); }, error: e => host.error(e),
  });
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', ready); };
    const timer = setTimeout(() => { cleanup(); rpc.dispose(); frame.remove(); reject(new Error('Iframe handshake timeout')); }, 15000);
    const ready = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || e.origin !== url.origin || e.data?.type !== 'wp-ready' || e.data?.version !== 1 || e.data?.nonce !== nonce) return;
      cleanup(); frame.contentWindow!.postMessage({ type: 'wp-connect', version: 1, nonce }, url.origin, [channel.port2]); resolve();
    };
    window.addEventListener('message', ready); frame.src = url.href; container.append(frame);
  });
  try { cached = await rpc.call('state'); }
  catch(e) { rpc.dispose(); frame.remove(); throw e; }
  let destroyed = false;
  return {
    open: (binding, token) => rpc.call('open', binding, token), save: () => rpc.call('save'), captureComposite: () => rpc.call('capture'),
    exportPng: () => rpc.call('exportPng'), command: command => rpc.call('command', command), state: () => cached,
    requestClose: () => rpc.call('close'),
    async destroy() {
      if (destroyed || cached.open) throw new Error('Close before destroy');
      destroyed = true;
      try { await rpc.call('destroy'); }
      finally { rpc.dispose(); frame.remove(); }
    },
  };
}
