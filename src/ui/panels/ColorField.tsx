import type { CSSProperties, PointerEvent } from 'react';
import { hsvToRgb, rgbCss, type HSV } from '../../color/convert';

export type ColorFieldMode = 'spectrum' | 'hue' | 'brightness';
export type ColorFieldPart = 'field' | 'strip';

export const colorFieldModes: { value: ColorFieldMode; label: string }[] = [
  { value: 'spectrum', label: 'RGB Spectrum' },
  { value: 'hue', label: 'Hue Cube' },
  { value: 'brightness', label: 'Brightness Cube' },
];

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const hueStops = '#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00';
export const hueTrack = `linear-gradient(to right, ${hueStops})`;
const spectrum = [
  'linear-gradient(to bottom, #fff, transparent 50%)',
  'linear-gradient(to top, #000, transparent 50%)',
  hueTrack,
].join(', ');

export function pickColorField(mode: ColorFieldMode, part: ColorFieldPart, hsv: HSV, x: number, y: number): HSV {
  x = clamp(x);
  y = clamp(y);
  if (mode === 'spectrum') return { h: x * 360, s: Math.min(1, y * 2), v: Math.min(1, (1 - y) * 2) };
  if (part === 'strip') return mode === 'hue' ? { ...hsv, h: (1 - y) * 360 } : { ...hsv, v: 1 - y };
  if (mode === 'hue') return { ...hsv, s: x, v: 1 - y };
  return { ...hsv, h: x * 360, s: 1 - y };
}

interface ColorFieldProps {
  mode: ColorFieldMode;
  hsv: HSV;
  onStart: (e: PointerEvent<HTMLDivElement>, part: ColorFieldPart) => void;
  onMove: (e: PointerEvent<HTMLDivElement>) => void;
  onEnd: (e: PointerEvent<HTMLDivElement>) => void;
  onNeutral: (white: boolean) => void;
}

export function ColorField({ mode, hsv, onStart, onMove, onEnd, onNeutral }: ColorFieldProps) {
  const hueColor = rgbCss(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
  const maxBrightness = rgbCss(hsvToRgb({ ...hsv, v: 1 }));
  const gray = rgbCss({ r: hsv.v, g: hsv.v, b: hsv.v });
  const tint = rgbCss({ r: 0, g: 0, b: 0 }, 1 - hsv.v);
  const fieldBackground = mode === 'spectrum' ? spectrum : mode === 'hue'
    ? `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`
    : `linear-gradient(to top, ${gray}, transparent), linear-gradient(${tint}, ${tint}), ${hueTrack}`;
  const stripBackground = mode === 'hue' ? `linear-gradient(to top, ${hueStops})`
    : `linear-gradient(to bottom, ${maxBrightness}, #000)`;
  const x = mode === 'hue' ? hsv.s : hsv.h / 360;
  const y = 1 - (mode === 'hue' ? hsv.v : hsv.s);
  const stripY = 1 - (mode === 'hue' ? hsv.h / 360 : hsv.v);
  const pointer = (part: ColorFieldPart) => ({
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => onStart(e, part),
    onPointerMove: onMove,
    onPointerUp: onEnd,
    onPointerCancel: onEnd,
    onLostPointerCapture: onEnd,
  });
  const marker = (left: number, top: number): CSSProperties => ({ left: `${left * 100}%`, top: `${top * 100}%` });

  return (
    <div className="color-pick-area">
      <div className="color-pick-surface" role="group" tabIndex={-1} aria-label={colorFieldModes.find((item) => item.value === mode)!.label}
        style={{ background: fieldBackground }} {...pointer('field')}>
        {mode !== 'spectrum' && <span className="color-pick-marker" style={marker(x, y)} />}
      </div>
      {mode === 'spectrum' ? (
        <div className="color-pick-neutrals">
          <button type="button" aria-label="Pick white" title="Pick white" onClick={() => onNeutral(true)} />
          <button type="button" aria-label="Pick black" title="Pick black" onClick={() => onNeutral(false)} />
        </div>
      ) : (
        <div className="color-pick-surface color-pick-strip" role="group" tabIndex={-1} aria-label={mode === 'hue' ? 'Hue strip' : 'Brightness strip'}
          style={{ background: stripBackground }} {...pointer('strip')}>
          <span className="color-pick-marker" style={marker(0.5, stripY)} />
        </div>
      )}
    </div>
  );
}
