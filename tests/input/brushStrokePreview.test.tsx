// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import * as engine from '../../src/brush/engine';
import { defaultBrush } from '../../src/tools/toolTypes';
import { BrushStrokePreview } from '../../src/ui/panels/BrushStrokePreview';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('bounds dense brush preview raster work and keeps spacing, scatter, texture and transfer visible', async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  const coverage = vi.spyOn(engine, 'dabCoverage');
  const putImageData = vi.fn<(image: ImageData) => void>();
  const ctx = {
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as unknown as HTMLCanvasElement['getContext']);
  let draw: FrameRequestCallback = () => {};
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { draw = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const dense = { ...defaultBrush(), size: 5000, spacing: 0.01, count: 16, texture: 'chalk' as const, textureDepth: 1 };
  const render = async (brush: typeof dense | ReturnType<typeof defaultBrush>) => {
    coverage.mockClear();
    await act(async () => root.render(<BrushStrokePreview brush={brush} />));
    draw(0);
    const pixels = coverage.mock.calls.reduce((sum, [, area]) => sum + area.w * area.h, 0);
    expect(pixels).toBeGreaterThan(0);
    expect(pixels).toBeLessThanOrEqual(50000);
    return putImageData.mock.lastCall![0].data;
  };
  try {
    const baseline = await render(dense);
    expect(await render({ ...dense, spacing: 0.9 })).not.toEqual(baseline);
    expect(await render({ ...dense, scatter: 1 })).not.toEqual(baseline);
    expect(await render({ ...dense, texture: 'none' })).not.toEqual(baseline);
    expect(await render({ ...dense, dynamics: { ...dense.dynamics, flowPressure: true, opacityPressure: true } })).not.toEqual(baseline);
    expect(await render({ ...dense, size: 12 })).not.toEqual(baseline);
  } finally {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
});
