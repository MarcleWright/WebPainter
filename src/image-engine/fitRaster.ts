import { fromFloat, toFloat, type PixelArray } from './pixels';
import type { Rect } from './rect';
import { TILE_SIZE, TiledRaster } from './tiledRaster';

const MAX_AXIS = 8192;

/** Fit decoded RGBA whose samples are confined to its image frame. Margins stay outside the raster. */
export function fitRasterToCanvas(source: TiledRaster, frame: Rect, width: number, height: number) {
  if (![frame.w, frame.h, width, height].every(axis => Number.isInteger(axis) && axis >= 1 && axis <= MAX_AXIS)
    || source.channels !== 4 || source.companion) throw new Error('Unsupported image dimensions or format for fitting');

  const scale = Math.min(width / frame.w, height / frame.h);
  const fittedWidth = Math.max(1, Math.min(width, Math.round(frame.w * scale)));
  const fittedHeight = Math.max(1, Math.min(height, Math.round(frame.h * scale)));
  const x = Math.floor((width - fittedWidth) / 2), y = Math.floor((height - fittedHeight) / 2);
  const unchanged = fittedWidth === frame.w && fittedHeight === frame.h;
  if (unchanged && source.depth === 8 && source.fill === 0 && frame.x === 0 && frame.y === 0)
    return { raster: source, x, y };

  const raster = new TiledRaster(4, 8);
  const read = (top: number, rows: number) => rgba8(source.readPixels({ x: frame.x, y: frame.y + top, w: frame.w, h: rows }));
  if (unchanged) {
    for (let top = 0; top < frame.h; top += TILE_SIZE) {
      const rows = Math.min(TILE_SIZE, frame.h - top);
      raster.writePixels({ x: 0, y: top, w: frame.w, h: rows }, read(top, rows));
    }
  } else {
    const input = new OffscreenCanvas(frame.w, frame.h);
    let output: OffscreenCanvas | undefined;
    try {
      output = new OffscreenCanvas(fittedWidth, fittedHeight);
      const from = input.getContext('2d'), to = output.getContext('2d', { willReadFrequently: true });
      if (!from || !to) throw new Error('Unable to fit image to canvas');
      for (let top = 0; top < frame.h; top += TILE_SIZE) {
        const rows = Math.min(TILE_SIZE, frame.h - top);
        from.putImageData(new ImageData(read(top, rows), frame.w, rows), 0, top);
      }
      to.imageSmoothingQuality = 'high';
      to.drawImage(input, 0, 0, fittedWidth, fittedHeight);
      for (let top = 0; top < fittedHeight; top += TILE_SIZE) {
        const rows = Math.min(TILE_SIZE, fittedHeight - top);
        raster.writePixels({ x: 0, y: top, w: fittedWidth, h: rows }, to.getImageData(0, top, fittedWidth, rows).data);
      }
    } finally {
      input.width = input.height = 1;
      if (output) output.width = output.height = 1;
    }
  }
  raster.compact();
  return { raster, x, y };
}

function rgba8(pixels: PixelArray): Uint8ClampedArray<ArrayBuffer> {
  if (pixels instanceof Uint8ClampedArray && pixels.buffer instanceof ArrayBuffer)
    return new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length);
  const normalized = new Float32Array(pixels.length);
  const out = new Uint8ClampedArray(pixels.length);
  toFloat(pixels, normalized);
  fromFloat(normalized, out);
  return out;
}
