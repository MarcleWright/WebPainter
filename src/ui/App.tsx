/** Application shell: menu bar, options bar, toolbar, dock workspace, status bar and hosts. */
import { useEffect, useState } from 'react';
import { MenuBar, ContextMenuHost } from './menu/Menu';
import { OptionsBar } from './OptionsBar';
import { Toolbar } from './Toolbar';
import { Workspace } from './Workspace';
import { DialogHost } from './dialogs/DialogHost';
import { useApp, ui } from '../app/store';
import { editor } from '../app/editor';
import { run } from '../app/actions';
import {installInputDispatch} from '../app/inputDispatch';
import { useSession, useViewRev } from './hooks';
import { zoomTo } from '../app/ops/viewOps';
import { Icon } from './icons';
import {isComposing} from '../app/inputContext';

export function App() {
  const screenMode = useApp((s) => s.screenMode);
  const [panelsHidden, setPanelsHidden] = useState(false);
  useEffect(() => {
    const removeInput = installInputDispatch();
    const toggle = () => setPanelsHidden((v) => !v);
    window.addEventListener('celenne:togglePanels', toggle);
    return () => {
      removeInput();
      window.removeEventListener('celenne:togglePanels', toggle);
    };
  }, []);
  return (
    <div className={`app${screenMode === 'full' ? ' full-screen' : ''}${panelsHidden ? ' panels-hidden' : ''}`}>
      <MenuBar />
      {!panelsHidden && <OptionsBar />}
      <div className="main" style={panelsHidden ? { gridTemplateColumns: '1fr' } : undefined}>
        {!panelsHidden && <Toolbar />}
        <Workspace />
      </div>
      <StatusBar />
      <DialogHost />
      <ContextMenuHost />
      <ToastHost />
      <ProgressHost />
    </div>
  );
}

function StatusBar() {
  const s = useSession();
  useViewRev();
  useApp((st) => st.docRev);
  useApp((st) => st.historyRev);
  const cursor = useApp((st) => st.cursor);
  const [zoomText, setZoomText] = useState('');
  const [editing, setEditing] = useState(false);
  const zoomPct = s ? Math.round(s.view.zoom * 10000) / 100 : 0;
  const renderer = (window as unknown as { __celenneRenderer?: string }).__celenneRenderer;
  const onGpu = !!renderer && renderer !== 'canvas2d';
  const rendererLabel = renderer?.startsWith('webgpu') ? 'WebGPU' : renderer === 'webgl2' ? 'WebGL 2' : 'CPU renderer';
  if (!s) {
    return (
      <div className="statusbar" role="status">
        <span>No document</span>
        <span className="spacer" />
        {renderer && <span className={`gpu${onGpu ? '' : ' off'}`}>{onGpu ? 'GPU' : 'CPU'}</span>}
      </div>
    );
  }
  const c = s.doc.canvas;
  const memBytes = c.width * c.height * 4 * (c.bitDepth / 8);
  // Informational notes ("editable") are not warnings.
  const notEditable = s.doc.compatibility.filter((i) => i.status !== 'editable').length;
  return (
    <div className="statusbar" role="status">
      <input
        className="zoom"
        aria-label="Zoom level"
        value={editing ? zoomText : `${zoomPct}%`}
        onFocus={(e) => { setEditing(true); setZoomText(String(zoomPct)); requestAnimationFrame(() => e.target.select()); }}
        onChange={(e) => setZoomText(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (isComposing(e)) return;
          if (e.key === 'Enter') {
            const v = parseFloat(zoomText.replace('%', ''));
            if (isFinite(v) && v > 0) zoomTo(Math.max(0.01, Math.min(64, v / 100)));
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
        }}
      />
      <span className="item">{c.width} × {c.height} px · {c.resolution} ppi</span>
      <span className="item">{c.duotone ? 'Duotone' : ({ rgb: 'RGB', grayscale: 'Gray', cmyk: 'CMYK', lab: 'Lab', indexed: 'Index', bitmap: 'Bitmap', multichannel: 'Multichannel' } as Record<string, string>)[c.colorMode] ?? c.colorMode.toUpperCase()}/{c.bitDepth}{c.bitDepth === 32 ? ' (float)' : ''}</span>
      <button className="link item" title="Assign or convert the document profile" onClick={() => run('edit.convertProfile')}>{s.doc.profile.name}</button>
      <span className="item">Doc: {(memBytes / 1048576).toFixed(1)} MB</span>
      {cursor.inside && <span className="item">X: {Math.floor(cursor.x)} Y: {Math.floor(cursor.y)}</span>}
      {notEditable > 0 && (
        <button className="link item" style={{ color: 'var(--warning)' }} title="Some features are preserved but not editable" onClick={() => ui.openDialog('compatibility')}>
          <Icon name="warning" /> {notEditable} compatibility note{notEditable === 1 ? '' : 's'}
        </button>
      )}
      <span className="spacer" />
      <span className="item">{s.modified ? 'Unsaved changes' : 'Saved'}</span>
      {renderer && <button className={`link gpu${onGpu ? '' : ' off'}`} title="GPU information" onClick={() => ui.openDialog('gpuInfo')}>{rendererLabel}</button>}
    </div>
  );
}

function ToastHost() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <div className="toast-head">
            <span className="msg">{t.message}</span>
            <button className="icon-x" aria-label="Dismiss" onClick={() => ui.dismissToast(t.id)}>×</button>
          </div>
          {t.detail && <div className="detail">{t.detail}</div>}
        </div>
      ))}
    </div>
  );
}

function ProgressHost() {
  const items = useApp((s) => s.progress);
  // Short operations do not flash a progress box.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!items.length) { setVisible(false); return; }
    const t = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(t);
  }, [items.length]);
  if (!visible || !items.length) return null;
  return (
    <div className="progress-host" aria-live="polite">
      {items.map((p) => (
        <div key={p.id} className="progress" role="progressbar" aria-valuenow={p.fraction === null ? undefined : Math.round(p.fraction * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={p.label}>
          <div className="row">
            <span className="label">{p.label}</span>
            {p.cancel && <button className="btn small" onClick={p.cancel}>Cancel</button>}
          </div>
          <div className={`bar${p.fraction === null ? ' indeterminate' : ''}`}><i style={{ width: `${Math.round((p.fraction ?? 0) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
