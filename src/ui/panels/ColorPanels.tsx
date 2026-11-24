/** Color, Swatches, Gradients, Navigator and Info panels. */
import { colorFromCmyk, colorFromLab, exactCmyk, isCmykDoc, isLabDoc, labFor, srgbToCmyk } from '../../color/plates';
import { uiCmykProfile } from '../../app/colorSettings';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import { useApp, ui } from '../../app/store';
import { isComposing } from '../../app/inputContext';
import { editor } from '../../app/editor';
import { useSession } from '../hooks';
import type { RGB } from '../../color/types';
import { hexToRgb, hslToRgb, hsvToRgb, rgbCss, rgbToHex, rgbToHsl, rgbToHsv, type HSV } from '../../color/convert';
import { NumberField, Select, IconButton } from '../controls';
import { gradientPresets, setCustomGradient } from '../../tools/fillSampleTools';
import { GradientPreview } from '../OptionsBar';
import { compositeRegion } from '../../rendering/compositor';
import { colorEngine } from '../../color/cms';
import { sampleColor } from '../../tools/fillSampleTools';
import { ColorField, colorFieldModes, hueTrack, pickColorField, type ColorFieldMode, type ColorFieldPart } from './ColorField';

export type ColorModel = 'rgb' | 'hsb' | 'hsl' | 'lab' | 'cmyk' | 'gray';

/** CMYK ink (0..1) of a UI colour: its exact values, else through the UI CMYK profile. */
export function cmykOfUi(c: RGB): [number, number, number, number] {
  return exactCmyk(c) ?? srgbToCmyk(c, uiCmykProfile());
}

function ColorSliders({ color, hsv, onChange, onChangeHsv, model }: {
  color: RGB; hsv: HSV; onChange: (c: RGB) => void; onChangeHsv: (c: HSV) => void; model: ColorModel;
}) {
  const row = (label: string, value: number, max: number, set: (v: number) => void, bg: string, min = 0, unit = '') => (
    <div className="color-slider-row" key={label}>
      <span className="lbl" aria-hidden="true">{label}</span>
      <input type="range" className="color-slider" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} style={{ background: bg }} aria-label={label} />
      <NumberField value={value} onChange={set} min={min} max={max} width={40} />
      <span className="faint" aria-hidden="true">{unit}</span>
    </div>
  );
  const grad = (a: RGB, b: RGB) => `linear-gradient(to right, ${rgbCss(a)}, ${rgbCss(b)})`;
  switch (model) {
    case 'rgb': {
      const { r, g, b } = color;
      return <>{row('R', Math.round(r * 255), 255, (v) => onChange({ ...color, r: v / 255 }), grad({ r: 0, g, b }, { r: 1, g, b }))}{row('G', Math.round(g * 255), 255, (v) => onChange({ ...color, g: v / 255 }), grad({ r, g: 0, b }, { r, g: 1, b }))}{row('B', Math.round(b * 255), 255, (v) => onChange({ ...color, b: v / 255 }), grad({ r, g, b: 0 }, { r, g, b: 1 }))}</>;
    }
    case 'hsb': {
      const h = hsv;
      return <>
        {row('H', Math.round(h.h), 360, (v) => onChangeHsv({ ...h, h: v }), hueTrack, 0, '°')}
        {row('S', Math.round(h.s * 100), 100, (v) => onChangeHsv({ ...h, s: v / 100 }), grad(hsvToRgb({ ...h, s: 0 }), hsvToRgb({ ...h, s: 1 })), 0, '%')}
        {row('B', Math.round(h.v * 100), 100, (v) => onChangeHsv({ ...h, v: v / 100 }), grad({ r: 0, g: 0, b: 0 }, hsvToRgb({ ...h, v: 1 })), 0, '%')}
      </>;
    }
    case 'hsl': {
      const h = rgbToHsl(color);
      return <>{row('H', Math.round(h.h), 360, (v) => onChange(hslToRgb({ ...h, h: v })), 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)')}{row('S', Math.round(h.s * 100), 100, (v) => onChange(hslToRgb({ ...h, s: v / 100 })), grad(hslToRgb({ ...h, s: 0 }), hslToRgb({ ...h, s: 1 })))}{row('L', Math.round(h.l * 100), 100, (v) => onChange(hslToRgb({ ...h, l: v / 100 })), `linear-gradient(to right,#000,${rgbCss(hslToRgb({ ...h, l: 0.5 }))},#fff)`)}</>;
    }
    case 'lab': {
      // CIE Lab (D50) with exact values kept.
      const l = labFor(color);
      const set = (i: number, v: number) => { const n = [...l] as [number, number, number]; n[i] = v; onChange(colorFromLab(n)); };
      return <>{row('L', Math.round(l[0]), 100, (v) => set(0, v), 'linear-gradient(to right,#000,#fff)')}{row('a', Math.round(l[1]), 127, (v) => set(1, v), 'linear-gradient(to right,#0a8,#888,#d0a)', -128)}{row('b', Math.round(l[2]), 127, (v) => set(2, v), 'linear-gradient(to right,#28f,#888,#ec2)', -128)}</>;
    }
    case 'cmyk': {
      // Through the CMYK profile, with exact ink values kept.
      const ink = cmykOfUi(color);
      const c = { c: ink[0], m: ink[1], y: ink[2], k: ink[3] };
      const set = (k: 'c' | 'm' | 'y' | 'k', v: number) => { const n = { ...c, [k]: v / 100 }; onChange(colorFromCmyk([n.c, n.m, n.y, n.k], uiCmykProfile())); };
      return <>{row('C', Math.round(c.c * 100), 100, (v) => set('c', v), 'linear-gradient(to right,#fff,#0ff)')}{row('M', Math.round(c.m * 100), 100, (v) => set('m', v), 'linear-gradient(to right,#fff,#f0f)')}{row('Y', Math.round(c.y * 100), 100, (v) => set('y', v), 'linear-gradient(to right,#fff,#ff0)')}{row('K', Math.round(c.k * 100), 100, (v) => set('k', v), 'linear-gradient(to right,#fff,#000)')}</>;
    }
    case 'gray': {
      const g = 1 - (0.3 * color.r + 0.59 * color.g + 0.11 * color.b);
      return row('K', Math.round(g * 100), 100, (v) => onChange({ r: 1 - v / 100, g: 1 - v / 100, b: 1 - v / 100 }), 'linear-gradient(to right,#fff,#000)');
    }
  }
}

type ColorTarget = 'fg' | 'bg';

/** Gray and black cannot encode hue, and black cannot encode saturation. */
function displayHsv(color: RGB, remembered?: HSV): HSV {
  const hsv = rgbToHsv(color);
  if (remembered && hsv.s === 0) hsv.h = remembered.h;
  if (remembered && hsv.v === 0) hsv.s = remembered.s;
  // Red at 360° and red at 0° are the same RGB, but opposite ends of the hue strip.
  if (remembered?.h === 360 && hsv.h === 0) hsv.h = 360;
  return hsv;
}

function HexColor({ color, onChange }: { color: RGB; onChange: (color: RGB) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const start = useRef<RGB | null>(null);
  const cancel = useRef(false);
  return (
    <label className="field color-panel-hex">
      <span className="lbl">#</span>
      <input className="txt" aria-label="Hex color" value={draft ?? rgbToHex(color)} spellCheck={false}
        onFocus={() => { start.current = color; cancel.current = false; setDraft(rgbToHex(color)); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const original = start.current;
          const parsed = draft !== null && original === color && draft !== rgbToHex(original) && hexToRgb(draft);
          if (!cancel.current && parsed) onChange(parsed);
          start.current = null;
          setDraft(null);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (isComposing(e)) return;
          if (e.key === 'Escape') cancel.current = true;
          if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

interface ColorDrag {
  id: number;
  element: HTMLDivElement;
  mode: ColorFieldMode;
  part: ColorFieldPart;
  target: ColorTarget;
  hsv: HSV;
  expected: RGB;
}

export function ColorPanel() {
  const fg = useApp((s) => s.fg);
  const bg = useApp((s) => s.bg);
  const recent = useApp((s) => s.recentColors);
  const [target, setTarget] = useState<ColorTarget>('fg');
  const [mode, setMode] = useState<ColorFieldMode>('spectrum');
  const docMode = useSession()?.doc.canvas.colorMode;
  const [model, setModel] = useState<ColorModel>(docMode === 'cmyk' ? 'cmyk' : docMode === 'lab' ? 'lab' : 'hsb');
  const c = target === 'fg' ? fg : bg;
  const memory = useRef({ fg: rgbToHsv(fg), bg: rgbToHsv(bg) });
  const hsv = displayHsv(c, memory.current[target]);
  const drag = useRef<ColorDrag | null>(null);

  function stopDrag() {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (current.element.hasPointerCapture?.(current.id)) current.element.releasePointerCapture(current.id);
  }

  useLayoutEffect(() => {
    const unsubscribe = useApp.subscribe((state, previous) => {
      for (const key of ['fg', 'bg'] as const) {
        if (state[key] === previous[key]) continue;
        if (drag.current?.target === key && drag.current.expected !== state[key]) stopDrag();
        memory.current[key] = displayHsv(state[key], memory.current[key]);
      }
    });
    window.addEventListener('blur', stopDrag);
    return () => {
      unsubscribe();
      window.removeEventListener('blur', stopDrag);
      stopDrag();
    };
  }, []);

  // Panel color edits update the shared tool colors without filling the recent-color list.
  function writeColor(key: ColorTarget, color: RGB, hsv?: HSV) {
    if (hsv) memory.current[key] = hsv;
    ui.set(key === 'fg' ? { fg: color } : { bg: color });
  }

  const set = (color: RGB) => { stopDrag(); writeColor(target, color); };
  const setHsv = (next: HSV) => { stopDrag(); writeColor(target, hsvToRgb(next), next); };
  const selectTarget = (key: ColorTarget) => { stopDrag(); setTarget(key); };
  const sampleField = (e: PointerEvent<HTMLDivElement>) => {
    const owner = drag.current;
    if (!owner || owner.id !== e.pointerId || owner.element !== e.currentTarget) return;
    const rect = owner.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) { stopDrag(); return; }
    const next = pickColorField(owner.mode, owner.part, owner.hsv, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    const rgb = hsvToRgb(next);
    owner.expected = rgb;
    writeColor(owner.target, rgb, next);
  };
  const startField = (e: PointerEvent<HTMLDivElement>, part: ColorFieldPart) => {
    if (e.button !== 0 || drag.current) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    const expected = useApp.getState()[target];
    drag.current = { id: e.pointerId, element: e.currentTarget, mode, part, target, hsv: displayHsv(expected, memory.current[target]), expected };
    e.currentTarget.setPointerCapture(e.pointerId);
    sampleField(e);
  };
  const endField = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId && drag.current.element === e.currentTarget) stopDrag();
  };

  return (
    <div className="panel color-panel">
      <div className="panel-body color-panel-body">
        <div className="color-panel-values">
          <div className="color-panel-chips">
            {(['bg', 'fg'] as const).map((key) => {
              const purpose = key === 'fg' ? 'foreground' : 'background';
              const label = key === 'fg' ? 'Foreground color' : 'Background color';
              return (
                <button type="button" className={`color-panel-chip color-panel-chip-${key}`} key={key}
                  aria-label={label} title={label} aria-pressed={target === key}
                  style={{ backgroundColor: rgbCss(key === 'fg' ? fg : bg) }}
                  onClick={() => selectTarget(key)} onDoubleClick={() => { stopDrag(); ui.openDialog('colorPicker', { purpose }); }} />
              );
            })}
          </div>
          <div className="color-panel-sliders"><ColorSliders color={c} hsv={hsv} onChange={set} onChangeHsv={setHsv} model={model} /></div>
        </div>
        <div className="color-panel-controls">
          <Select ariaLabel="Color value format" value={model} onChange={(value) => { stopDrag(); setModel(value); }} options={[{ value: 'hsb', label: 'HSB' }, { value: 'rgb', label: 'RGB' }, { value: 'hsl', label: 'HSL' }, { value: 'lab', label: 'Lab' }, { value: 'cmyk', label: 'CMYK' }, { value: 'gray', label: 'Grayscale' }]} />
          <Select ariaLabel="Color picker mode" value={mode} onChange={(value) => { stopDrag(); setMode(value); }} options={colorFieldModes} />
          <HexColor key={target} color={c} onChange={set} />
        </div>
        {model === 'cmyk' && <div className="faint">CMYK through {uiCmykProfile().name}{colorEngine.ready ? '' : ' (device formula until colour management loads)'}.</div>}
        <ColorField mode={mode} hsv={hsv} onStart={startField} onMove={sampleField} onEnd={endField}
          onNeutral={(white) => { const n = white ? 1 : 0; set({ r: n, g: n, b: n }); }} />
        {recent.length > 0 && (
          <div className="swatches-grid">
            {recent.map((x, i) => <div key={i} className="sw" style={{ background: rgbCss(x) }} onClick={() => set(x)} title={`#${rgbToHex(x)}`} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function SwatchesPanel() {
  const sw = useApp((s) => s.swatches);
  return (
    <div className="panel">
      <div className="panel-body">
        <div className="swatches-grid">
          {sw.map((c, i) => (
            <div key={i} className="sw" style={{ background: rgbCss(c) }} title={`#${rgbToHex(c)} (click: foreground, Alt+click: delete, Ctrl+click: background)`}
              onClick={(e) => {
                if (e.altKey) ui.set({ swatches: sw.filter((_, k) => k !== i) });
                else if (e.ctrlKey || e.metaKey) editor.setBackground(c);
                else editor.setForeground(c);
              }} />
          ))}
        </div>
      </div>
      <div className="panel-toolbar">
        <div className="spacer" />
        <IconButton icon="plus" title="Add foreground color as swatch" onClick={() => ui.set((s) => ({ swatches: [...s.swatches, s.fg] }))} />
      </div>
    </div>
  );
}

export function GradientsPanel() {
  useApp((s) => s.fg);
  useApp((s) => s.bg);
  const idx = useApp((s) => s.toolOptions.gradient.presetIndex);
  return (
    <div className="panel">
      <div className="panel-body">
        {gradientPresets().map((g, i) => (
          <div key={i} className="row" style={{ cursor: 'pointer' }} onClick={() => { ui.setToolOptions('gradient', { presetIndex: i }); setCustomGradient(null); editor.setTool('gradient'); }}>
            <GradientPreview lutSource={g} active={i === idx} width={90} />
            <span>{g.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NavigatorPanel() {
  const s = useSession();
  useApp((st) => st.viewRev);
  useApp((st) => st.historyRev);
  const ref = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<{ key: string; img: ImageData; scale: number } | null>(null);
  const [thumbRev, setThumbRev] = useState(0);
  const W = 240;
  // The thumbnail is re-composited only after edits settle (not every frame of a drag, not on a timer).
  const docKey = s ? `${s.id}:${s.doc.rev}:${s.doc.width}x${s.doc.height}` : '';
  useEffect(() => {
    if (!s || thumb.current?.key === docKey) return;
    const t = setTimeout(() => {
      const d = s.doc;
      const scale = Math.min(W / d.width, 180 / d.height);
      const lvl = Math.max(0, Math.floor(Math.log2(1 / scale)));
      const sc = 1 << lvl;
      const r = { x: 0, y: 0, w: Math.ceil(d.width / sc), h: Math.ceil(d.height / sc) };
      if (r.w * r.h > 4e6) return;
      const buf = compositeRegion(d, r, { level: lvl });
      const tw = Math.max(1, Math.round(d.width * scale)), th = Math.max(1, Math.round(d.height * scale));
      const img = new ImageData(tw, th);
      for (let y = 0; y < th; y++)
        for (let x = 0; x < tw; x++) {
          const sx = Math.min(r.w - 1, Math.floor((x / tw) * r.w)), sy = Math.min(r.h - 1, Math.floor((y / th) * r.h));
          const i = (sy * r.w + sx) * 4, o = (y * tw + x) * 4;
          const a = buf[i + 3], chk = ((x >> 3) + (y >> 3)) % 2 ? 0.8 : 1;
          img.data[o] = (buf[i] + chk * (1 - a)) * 255; img.data[o + 1] = (buf[i + 1] + chk * (1 - a)) * 255; img.data[o + 2] = (buf[i + 2] + chk * (1 - a)) * 255; img.data[o + 3] = 255;
        }
      thumb.current = { key: docKey, img, scale };
      setThumbRev((n) => n + 1);
    }, thumb.current ? 250 : 0);
    return () => clearTimeout(t);
  }, [s, docKey]);
  // Cheap redraw: cached thumbnail + view rectangle (pan/zoom).
  useEffect(() => {
    const c = ref.current, th = thumb.current;
    if (!c || !s || !th) return;
    if (c.width !== th.img.width || c.height !== th.img.height) { c.width = th.img.width; c.height = th.img.height; }
    const g = c.getContext('2d')!;
    g.putImageData(th.img, 0, 0);
    const host = editor.hostFactory?.();
    if (host) {
      const { w, h } = host.viewportSize();
      const vis = s.view.visibleDocRect(w, h);
      g.strokeStyle = '#ff3b3b';
      g.lineWidth = 2;
      g.strokeRect(vis.x * th.scale, vis.y * th.scale, vis.w * th.scale, vis.h * th.scale);
    }
  }, [s, thumbRev, s?.view.zoom, s?.view.panX, s?.view.panY]);
  if (!s) return <div className="panel"><div className="empty">No document</div></div>;
  const center = (e: React.PointerEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const d = s.doc;
    const x = ((e.clientX - r.left) / r.width) * d.width, y = ((e.clientY - r.top) / r.height) * d.height;
    const host = editor.hostFactory?.();
    if (!host) return;
    const { w, h } = host.viewportSize();
    const p = s.view.docToScreen(x, y);
    s.view.panX += w / 2 - p.x;
    s.view.panY += h / 2 - p.y;
    ui.bump('viewRev');
  };
  return (
    <div className="panel">
      <div className="panel-body">
        <canvas ref={ref} className="navigator-canvas" onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); center(e); }} onPointerMove={(e) => { if (e.buttons) center(e); }} />
        <div className="row">
          <IconButton icon="minus" title="Zoom out" onClick={() => { const h = editor.hostFactory?.(); if (h) { s.view.zoomStep(h.viewportSize().w / 2, h.viewportSize().h / 2, -1); ui.bump('viewRev'); } }} />
          <input type="range" className="slider" min={-7} max={7} step={0.01} value={Math.log2(s.view.zoom)} onChange={(e) => { const h = editor.hostFactory?.(); if (h) { s.view.setZoomCentered(Math.pow(2, Number(e.target.value)), h.viewportSize().w, h.viewportSize().h); ui.bump('viewRev'); } }} aria-label="Zoom" />
          <IconButton icon="plus" title="Zoom in" onClick={() => { const h = editor.hostFactory?.(); if (h) { s.view.zoomStep(h.viewportSize().w / 2, h.viewportSize().h / 2, 1); ui.bump('viewRev'); } }} />
          <span className="muted" style={{ width: 52, textAlign: 'right' }}>{(s.view.zoom * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export function InfoPanel() {
  const s = useSession();
  const cur = useApp((st) => st.cursor);
  const samplers = useApp((st) => st.samplers);
  const measure = useApp((st) => st.measure);
  useApp((st) => st.historyRev);
  if (!s) return <div className="panel"><div className="empty">No document</div></div>;
  const host = editor.hostFactory?.();
  const sample = (x: number, y: number) => (host ? sampleColor(host, x, y, true, 1) : null);
  const px = cur.inside ? sample(cur.x, cur.y) : null;
  const fmt = (c: { r: number; g: number; b: number; a: number } | null) => (c ? `R ${Math.round(c.r * 255)}  G ${Math.round(c.g * 255)}  B ${Math.round(c.b * 255)}  A ${Math.round(c.a * 100)}%` : '—');
  const ink = px ? cmykOfUi(px) : null;
  const cmyk = ink ? { c: ink[0], m: ink[1], y: ink[2], k: ink[3] } : null;
  const lab = px && isLabDoc(s.doc) ? labFor(px) : null;
  const sel = s.doc.selection.bounds(s.doc.bounds);
  const mem = s.engine.cacheBytes() + s.history.memoryBytes();
  return (
    <div className="panel">
      <div className="panel-body">
        <div className="grid2">
          <span className="lbl">RGB</span><span>{fmt(px)}</span>
          <span className="lbl">CMYK</span><span>{cmyk ? `C ${Math.round(cmyk.c * 100)}  M ${Math.round(cmyk.m * 100)}  Y ${Math.round(cmyk.y * 100)}  K ${Math.round(cmyk.k * 100)}${isCmykDoc(s.doc) ? '' : ' (proof)'}` : '—'}</span>
          {lab && <><span className="lbl">Lab</span><span>{`L ${lab[0].toFixed(1)}  a ${lab[1].toFixed(1)}  b ${lab[2].toFixed(1)}`}</span></>}
          <span className="lbl">X / Y</span><span>{cur.inside ? `${Math.floor(cur.x)} , ${Math.floor(cur.y)} px` : '—'}</span>
          <span className="lbl">Selection</span><span>{sel ? `${sel.w} × ${sel.h} px @ ${sel.x}, ${sel.y}` : '—'}</span>
          {measure && <><span className="lbl">Measure</span><span>{Math.hypot(measure.x1 - measure.x0, measure.y1 - measure.y0).toFixed(1)} px, {((-Math.atan2(measure.y1 - measure.y0, measure.x1 - measure.x0) * 180) / Math.PI).toFixed(1)}°</span></>}
        </div>
        {samplers.length > 0 && (
          <div className="grid2">
            {samplers.flatMap((sp, i) => [<span className="lbl" key={`l${i}`}>#{i + 1}</span>, <span key={`v${i}`}>{fmt(sample(sp.x, sp.y))}</span>])}
          </div>
        )}
        <div className="grid2">
          <span className="lbl">Document</span><span>{s.doc.width} × {s.doc.height} px, {s.doc.canvas.bitDepth}-bit, {s.doc.canvas.resolution} ppi</span>
          <span className="lbl">Profile</span><span>{s.doc.profile.name}</span>
          <span className="lbl">Memory</span><span>{(mem / 1048576).toFixed(1)} MB (tiles + history)</span>
          <span className="lbl">Renderer</span><span>{(window as unknown as { __celenneRenderer?: string }).__celenneRenderer === 'webgl2' ? 'GPU (WebGL 2)' : 'CPU (Canvas 2D)'}</span>
        </div>
      </div>
    </div>
  );
}
