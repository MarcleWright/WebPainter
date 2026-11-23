export {NATIVE_CAPABILITIES} from './capabilities';
/** Lazy core import: the iframe host must not instantiate a second inactive WP kernel. */
export async function mountDirect(container: HTMLElement, host: HostPort): Promise<EmbeddedEditor> {
  return (await import('./mount')).mountDirect(container, host);
}
/** A composition page owns its document; the host may place its own UI beside WP. */
export async function mountPage(container: HTMLElement, host: HostPort): Promise<EmbeddedPageEditor> {
  return (await import('./mount')).mountPageSurface(container, host);
}
export type { EmbeddedEditor, EmbeddedPageEditor, GenerationReference, HostPort, NewDocumentPickerOptions, NewDocumentPickerResult, Output } from './contract';
export { GENERATION_REFERENCE_CAPTURE_VERSION, HOST_SHORTCUT_PROFILE_VERSION, NEW_DOCUMENT_PICKER_VERSION, PORT_VERSION } from './contract';
import { HOST_SHORTCUT_PROFILE_VERSION, resolveHostShortcutProfile } from './contract';
import type { EmbeddedEditor, EmbeddedPageEditor, HostPort, EditorState } from './contract';
import { connectRpc } from './rpc';

export async function mountIframe(container: HTMLElement, host: HostPort, frameUrl: string): Promise<EmbeddedEditor> {
  const shortcutProfile = resolveHostShortcutProfile(host.shortcutProfile);
  const url = new URL(frameUrl, location.href);
  if (url.origin !== location.origin || location.origin === 'null') throw new Error('Local same-origin iframe required');
  const nonce = crypto.randomUUID(); url.hash = new URLSearchParams({ nonce }).toString();
  const frame = document.createElement('iframe'); frame.title = 'WebPainter comparison';
  frame.style.cssText = 'border:0;width:100%;height:100%';
  const channel = new MessageChannel();
  let cached: EditorState = { generation: 0, open: false, dirty: false,outputBusy:false,checkpointReady:false,hasUncommittedChanges:false };
  const rpc = connectRpc(channel.port1, nonce, {
    readResource: (...a) => host.readResource(a[0], a[1]), hostSave: o => host.save(o), hostExport: o => host.export(o),
    confirm: (...a) => host.confirm(a[0], a[1], a[2]), dirty: s => { cached = s; host.dirty(s); }, error: e => host.error(e),
  });
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', ready); };
    const fail = (message: string) => {
      cleanup();
      rpc.dispose();
      channel.port2.close();
      frame.remove();
      reject(new Error(message));
    };
    const timer = setTimeout(() => fail('Iframe handshake timeout'), 15000);
    const ready = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || e.origin !== url.origin || e.data?.type !== 'wp-ready' || e.data?.version !== 4 || e.data?.nonce !== nonce) return;
      if (shortcutProfile === 'web' && e.data.shortcutProfileVersion !== HOST_SHORTCUT_PROFILE_VERSION) {
        fail('Embedded frame does not support the Web shortcut profile');
        return;
      }
      cleanup();
      frame.contentWindow!.postMessage({
        type: 'wp-connect', version: 4, nonce, nativeVersion: host.nativeVersion,
        capabilityPolicy: host.capabilityPolicy, shortcutProfile,
      }, url.origin, [channel.port2]);
      resolve();
    };
    window.addEventListener('message', ready); frame.src = url.href; container.append(frame);
  });
  try { cached = await rpc.call('state'); }
  catch(e) { rpc.dispose(); frame.remove(); throw e; }
  let destroyed = false;
  return {
    open: (binding, token) => rpc.call('open', binding, token), save: () => rpc.call('save'),saveBackground:()=>rpc.call('saveBackground'), captureComposite: () => rpc.call('capture'),
    exportPng: () => rpc.call('exportPng'), command: command => rpc.call('command', command), state: () => cached,
    captureNative:()=>rpc.call('captureNative'),saveAndCapture:()=>rpc.call('saveAndCapture'),addResource:token=>rpc.call('addResource',token),exportPsd:()=>rpc.call('exportPsd'),
    requestClose: () => rpc.call('close'),
    async destroy() {
      if (destroyed || cached.open) throw new Error('Close before destroy');
      destroyed = true;
      try { await rpc.call('destroy'); }
      finally { rpc.dispose(); frame.remove(); }
    },
  };
}

/** Derived preview may outlive the editing iframe. No editor singleton is imported here. */
export const NATIVE_PREVIEW_1024_VERSION=1 as const;
export function createNativePreviewWorker():Worker{return new Worker(new URL('./checkpoint-worker.ts',import.meta.url),{type:'module'});}
