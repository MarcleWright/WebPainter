import { createRoot } from 'react-dom/client';
import { App } from '../ui/App';
import { installSurface } from '../ui/surface';
import { initializeEditor } from './editor';
import type { EmbeddedEditor, HostPort } from './contract';
import css from '../ui/styles.css?inline';
import dockCss from 'flexlayout-react/style/dark.css?inline';
import { colorEngine } from '../color/cms';
import { fonts } from '../typography/fonts';
import { ui } from '../app/store';
import { useApp } from '../app/store';

function EmbeddedApp() {
  const sessions = useApp(s => s.sessions);
  return sessions.length ? <App /> : <div className="empty">Open a work from the host.</div>;
}

/** Own React 19 root and styles; never renders WP elements with the host's React 18. */
export function mountDirect(container: HTMLElement, host: HostPort): EmbeddedEditor {
  return mountSurface(container, host, true);
}
/** The iframe already owns its document/CSS/key scope. */
export function mountFrame(container: HTMLElement, host: HostPort): EmbeddedEditor {
  return mountSurface(container, host, false);
}
function mountSurface(container: HTMLElement, host: HostPort, isolated: boolean): EmbeddedEditor {
  if (container.shadowRoot) throw new Error('Container already used');

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
  const owns=(e:Event)=>e.composedPath().some(n=>n===rootNode||n===portals);
  const wake=()=>setTimeout(()=>listeners.forEach(fn=>fn()),0);
  const pointerDown=(e:PointerEvent)=>{if(owns(e)){pointers.add(e.pointerId);wake();}};
  const pointerUp=(e:PointerEvent)=>{if(pointers.delete(e.pointerId))wake();};
  const keyDown=(e:KeyboardEvent)=>{if(owns(e)){keys.add(e.code);wake();}};
  const keyUp=(e:KeyboardEvent)=>{if(keys.delete(e.code))wake();};
  const composition=(e:Event)=>{if(owns(e)){composing=e.type==='compositionstart';wake();}};
  const focus=()=>wake();
  const events:[string,EventListener][]=[['pointerdown',pointerDown as EventListener],['pointerup',pointerUp as EventListener],['pointercancel',pointerUp as EventListener],['keydown',keyDown as EventListener],['keyup',keyUp as EventListener],['compositionstart',composition],['compositionend',composition],['focusin',focus],['focusout',focus]];
  for(const [type,fn]of events)window.addEventListener(type,fn,true);
  const api=initializeEditor(host,{busy(){const el=(surface instanceof ShadowRoot?surface.activeElement:document.activeElement) as HTMLElement|null;return pointers.size>0||keys.size>0||composing||!!(el&&(rootNode.contains(el)||portals.contains(el))&&el.matches('textarea,[contenteditable=true],input:not([type=range]):not([type=checkbox]):not([type=button])'));},subscribe(fn){listeners.add(fn);return()=>{listeners.delete(fn);};}});
  const root = createRoot(rootNode); root.render(<EmbeddedApp />);
  let live = true;
  void fonts.load().catch(e => { if (live) host.error({ generation: api.state().generation, message: String(e) }); });
  void colorEngine.init().then(() => { if (live) ui.bump('viewRev'); });
  return { ...api, destroy() {
    if (api.state().open) throw new Error('Request close before destroy');
    live = false; for(const [type,fn]of events)window.removeEventListener(type,fn,true);listeners.clear();root.unmount();
    container.removeEventListener('keydown', stop); container.removeEventListener('keyup', stop);
    restoreSurface(); api.destroy(); surface.replaceChildren();
    const diagnostics = window as unknown as { __celenneViewport?: unknown; __celenneRenderer?: string; __celennePanelOpen?: unknown };
    delete diagnostics.__celenneViewport; delete diagnostics.__celenneRenderer; delete diagnostics.__celennePanelOpen;
  } };
}
