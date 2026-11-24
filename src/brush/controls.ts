import type { BrushSettings } from '../tools/toolTypes';

export const BRUSH_SIZE_MIN = 1;
export const BRUSH_SIZE_MAX = 5000;
export const BRUSH_HARDNESS_MAX_PERCENT = 100;

export function clampBrushSize(value: number): number {
  return Number.isFinite(value) ? Math.max(BRUSH_SIZE_MIN, Math.min(BRUSH_SIZE_MAX, value)) : 40;
}

export function clampBrushHardness(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
/** Preset records retain their source values. Constrain only the active brush. */
export function constrainBrushControls(brush: BrushSettings): BrushSettings {
  const size = clampBrushSize(brush.size);
  const hardness = clampBrushHardness(brush.hardness);
  return size === brush.size && hardness === brush.hardness ? brush : { ...brush, size, hardness };
}
