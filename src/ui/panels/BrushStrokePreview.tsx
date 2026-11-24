import { useEffect, useRef } from 'react';
import { DabEmitter, dabBounds, dabCoverage, makeTipSampler, type Dab } from '../../brush/engine';
import { BRUSH_SIZE_MAX, clampBrushHardness, clampBrushSize } from '../../brush/controls';
import { intersect } from '../../image-engine/rect';
import type { BrushSettings } from '../../tools/toolTypes';

const bounds = { x: 0, y: 0, w: 220, h: 60 };
const pixelBudget = 50000;

export function BrushStrokePreview({ brush }: { brush: BrushSettings }) {
  const preview = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const g = preview.current?.getContext('2d');
      if (!g) return;
      const { w, h } = bounds;
      const style = {
        ...brush,
        // Fit the full document-pixel range into the small preview without flattening it to a single size.
        size: 1 + 23 * Math.log(clampBrushSize(brush.size)) / Math.log(BRUSH_SIZE_MAX),
        hardness: clampBrushHardness(brush.hardness),
        count: Number.isFinite(brush.count) ? Math.max(1, Math.min(16, brush.count)) : 1,
      };
      const emitter = new DabEmitter(style, 0x9e3779b9);
      const tip = makeTipSampler(style);
      const sample = (i: number) => {
        const t = i / 32;
        const wave = Math.sin(t * Math.PI * 2);
        return { x: 12 + t * (w - 24), y: h / 2 + wave * 12, time: i * 14,
          pressure: 0.25 + 0.75 * Math.sin(t * Math.PI), tiltX: t * 60, tiltY: wave * 35, twist: 100 * t };
      };
      const dabs = emitter.begin(sample(0));
      for (let i = 1; i <= 32; i++) {
        dabs.push(...emitter.move(sample(i)));
        if (style.airbrush && i % 4 === 0) dabs.push(...emitter.repeat());
      }
      dabs.push(...emitter.end(sample(32)));
      const visible: { dab: Dab; area: ReturnType<typeof dabBounds> }[] = [];
      let largest = 1;
      for (const dab of dabs) {
        const area = intersect(bounds, dabBounds(dab));
        if (!area.w || !area.h) continue;
        visible.push({ dab, area });
        largest = Math.max(largest, area.w * area.h);
      }
      // Sample across the whole stroke at dense spacing. Each sample represents its group of
      // neighboring dabs, including their approximate flow accumulation.
      const samples = Math.min(visible.length, Math.max(1, Math.floor(pixelBudget / largest)));
      const pixels = g.createImageData(w, h);
      const accumulated = new Float32Array(w * h);
      for (let i = 0; i < samples; i++) {
        const first = Math.floor(i * visible.length / samples);
        const end = Math.floor((i + 1) * visible.length / samples);
        const represented = end - first;
        const { dab, area } = visible[Math.floor((first + end - 1) / 2)];
        const coverage = dabCoverage(dab, area, style, tip);
        for (let y = 0; y < area.h; y++) {
          for (let x = 0; x < area.w; x++) {
            const k = (area.y + y) * w + area.x + x;
            const strength = coverage[y * area.w + x] * dab.flow;
            if (strength <= 0) continue;
            const combined = represented === 1 ? strength : 1 - (1 - strength) ** represented;
            accumulated[k] += (1 - accumulated[k]) * combined;
            pixels.data[k * 4] = pixels.data[k * 4 + 1] = pixels.data[k * 4 + 2] = 230;
            pixels.data[k * 4 + 3] = accumulated[k] * dab.opacity * 255;
          }
        }
      }
      g.putImageData(pixels, 0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [brush]);
  return <canvas aria-label="Brush stroke preview" role="img" className="brush-stroke-preview" ref={preview} width={bounds.w} height={bounds.h} />;
}
