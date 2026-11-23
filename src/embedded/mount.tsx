import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { App } from '../ui/App';
import { installSurface } from '../ui/surface';
import { initializeEditor } from './editor';
import { editor as editorModel } from '../app/editor';
import { releasePan } from '../app/heldPan';
import { captureWebCanvasKeyDown, enableWebCanvasInput, observeWebCanvasFocus, observeWebCanvasPointer, resetWebCanvasAlt, resetWebCanvasInput } from '../app/webCanvasInput';
import { resolveHostShortcutProfile, type EmbeddedEditor, type EmbeddedPageEditor, type HostPort, type NewDocumentPickerOptions, type NewDocumentPickerResult } from './contract';
import { NewDocumentSizeDialog } from '../ui/dialogs/NewDocumentSizeFields';
import { NATIVE_LIMITS } from '../document/native';
import css from '../ui/styles.css?inline';
import dockCss from 'flexlayout-react/style/dark.css?inline';
import { colorEngine } from '../color/cms';
import { fonts } from '../typography/fonts';
import { ui } from '../app/store';
import { useApp } from '../app/store';

type PickerRequest = {
  options: NewDocumentPickerOptions;
  finish: (size: NewDocumentPickerResult['size']) => void;
};
function EmbeddedApp({ picker }: { picker: PickerRequest | null }) {
  const sessions = useApp(s => s.sessions);
  if (sessions.length) return <App />;
  if (!picker) return <div className="empty">Open a work from the host.</div>;
  const { pickerId, maxWidth, maxHeight, locale } = picker.options;
  return <NewDocumentSizeDialog key={pickerId} limits={{ width: maxWidth, height: maxHeight }}
    locale={locale} confirm={picker.finish} cancel={() => picker.finish(null)} />;
}

/** Own React 19 root and styles; never renders WP elements with the host's React 18. */
export function mountDirect(container: HTMLElement, host: HostPort): EmbeddedEditor {
  return mountSurface(container, host, true).editor;
}
/** The iframe already owns its document/CSS/key scope. */
export function mountFrame(container: HTMLElement, host: HostPort): EmbeddedEditor {
  return mountSurface(container, host, false).editor;
}
export function mountPageSurface(container: HTMLElement, host: HostPort): EmbeddedPageEditor {
  const { editor, render } = mountSurface(container, host, false, true);
  let live = true;
  let opening = false;
  let picker: PickerRequest | null = null;
  return {
    ...editor,
    async open(binding, token) {
      if (picker || opening) throw new Error('Finish the current picker or open first');
      opening = true;
      try { await editor.open(binding, token); }
      finally { opening = false; }
    },
    destroy() {
      if (opening) throw new Error('Wait for the current open before destroy');
      const result = editor.destroy();
      live = false;
      picker = null;
      return result;
    },
    showNewDocumentPicker(options, settle) {
      if (!live || host.nativeVersion !== 1 || picker || opening || editor.state().open) {
        throw new Error('New document picker is unavailable');
      }
      const { pickerId, maxWidth, maxHeight, locale } = options;
      const maxAxis = Math.sqrt(NATIVE_LIMITS.pixels);
      if (typeof pickerId !== 'string' || !pickerId || pickerId.length > 128 || typeof settle !== 'function'
          || ![maxWidth, maxHeight].every(size => Number.isSafeInteger(size) && size >= 1 && size <= maxAxis)
          || locale !== undefined && locale !== 'en' && locale !== 'zh-CN') {
        throw new Error('Invalid new document picker options');
      }
      const request: PickerRequest = {
        options: { pickerId, maxWidth, maxHeight, locale },
        finish(size) {
          if (picker !== request) return;
          picker = null;
          render();
          settle({ pickerId, size });
        },
      };
      picker = request;
      render(picker);
    },
    cancelNewDocumentPicker(pickerId) {
      if (picker?.options.pickerId !== pickerId) return;
      picker = null;
      render();
    },
  };
}

function clearDocumentDiagnostics() {
  const diagnostics = window as unknown as { __celenneViewport?: unknown; __celenneRenderer?: string; __celennePanelOpen?: unknown };
  delete diagnostics.__celenneViewport;
  delete diagnostics.__celenneRenderer;
  delete diagnostics.__celennePanelOpen;
}

function mountSurface(container: HTMLElement, host: HostPort, isolated: boolean, reusable = false) {
  if (container.shadowRoot) throw new Error('Container already used');
  // Reject a malformed host profile before adding DOM or input listeners.
  const profile = resolveHostShortcutProfile(host.shortcutProfile);
  const webPage = reusable && profile === 'web';

  const surface = isolated ? container.attachShadow({ mode: 'open' }) : container;
  const style = document.createElement('style');
  style.textContent = (isolated ? css.replace(':root', ':host').replace('html, body, #root', ':host, #wp-root') : css) + '\n' + dockCss;
  // An external single-document owner with disabled Close has one visible exit.
  if(host.capabilityPolicy?.entries['action:file.close']?.enabled===false)style.textContent+='\n.doc-tabs{display:none}';
  const rootNode = document.createElement('div'); rootNode.id = 'wp-root';
  rootNode.style.cssText = 'height:100%;width:100%';
  const portals = document.createElement('div');
  surface.append(style, rootNode, portals);
  const restoreSurface = isolated ? installSurface({ portals, keys: container }) : () => {};
  const stop = (event: Event) => event.stopPropagation();
  // WP listeners run on this element; host document shortcuts never receive editor keys.
  if (isolated) { container.addEventListener('keydown', stop); container.addEventListener('keyup', stop); }
  const pointers=new Set<number>(),keys=new Set<string>(),listeners=new Set<()=>void>();let composing=false;
  const owns=(e:Event)=>(!reusable||!!editorModel.active)&&e.composedPath().some(n=>n===rootNode||n===portals);
  const wake=()=>setTimeout(()=>listeners.forEach(fn=>fn()),0);
  const pointerDown=(e:PointerEvent)=>{if(webPage)observeWebCanvasPointer(e);if(owns(e)){pointers.add(e.pointerId);wake();}};
  const pointerUp=(e:PointerEvent)=>{if(pointers.delete(e.pointerId))wake();};
  const keyDown=(e:KeyboardEvent)=>{
    if(webPage)captureWebCanvasKeyDown(e);
    if(owns(e)&&!['Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight'].includes(e.code)){keys.add(e.code);wake();}
  };
  const keyUp=(e:KeyboardEvent)=>{
    // An ADA panel may stop propagation after it receives the release.
    if(webPage)releasePan(e);
    if(keys.delete(e.code))wake();
  };
  const composition=(e:Event)=>{
    if(webPage&&e.type==='compositionstart')resetWebCanvasInput();
    if(owns(e)){composing=e.type==='compositionstart';wake();}
  };
  const focus=(e:FocusEvent)=>{if(webPage){if(e.type==='focusin')observeWebCanvasFocus(e);else resetWebCanvasAlt();}wake();};
  const resetInput=()=>{keys.clear();pointers.clear();composing=false;if(webPage)resetWebCanvasInput();};
  const blur=(event:Event)=>{if(event.target===window){resetInput();wake();}};
  const events:[string,EventListener][]=[['pointerdown',pointerDown as EventListener],['pointerup',pointerUp as EventListener],['pointercancel',pointerUp as EventListener],['keydown',keyDown as EventListener],['keyup',keyUp as EventListener],['compositionstart',composition],['compositionend',composition],['focusin',focus as EventListener],['focusout',focus as EventListener],['blur',blur]];
  for(const [type,fn]of events)window.addEventListener(type,fn,true);
  const api=initializeEditor(host,{
    busy(){return pointers.size>0||keys.size>0||composing;},
    subscribe(fn){listeners.add(fn);return()=>{listeners.delete(fn);};},
    releaseDocument: reusable ? () => {
      resetInput();
      // Make App/CanvasView owner teardown observable before another document can open.
      flushSync(() => render());
      clearDocumentDiagnostics();
    } : undefined,
  });
  const disableWebCanvasInput = webPage ? enableWebCanvasInput(rootNode) : undefined;
  const root = createRoot(rootNode);
  const render = (picker: PickerRequest | null = null) => root.render(<EmbeddedApp picker={picker} />);
  render();
  let live = true;
  void fonts.load().catch(e => { if (live) host.error({ generation: api.state().generation, message: String(e) }); });
  void colorEngine.init().then(() => { if (live) ui.bump('viewRev'); });
  const editor: EmbeddedEditor = { ...api, destroy() {
    if (api.state().open) throw new Error('Request close before destroy');
    live = false; for(const [type,fn]of events)window.removeEventListener(type,fn,true);listeners.clear();root.unmount();
    disableWebCanvasInput?.();
    container.removeEventListener('keydown', stop); container.removeEventListener('keyup', stop);
    restoreSurface(); api.destroy(); surface.replaceChildren();
    clearDocumentDiagnostics();
  } };
  return { editor, render };
}
