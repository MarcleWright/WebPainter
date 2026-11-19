import { expect, it } from 'vitest';
import { fitRasterToCanvas } from '../../src/image-engine/fitRaster';
import { TiledRaster } from '../../src/image-engine/tiledRaster';

it('keeps existing RGB8 samples when only the placement changes', () => {
  const frame = { x: 0, y: 0, w: 4, h: 2 };
  const raster = TiledRaster.fromPixels(4, 2, 4, 8, new Uint8ClampedArray(32).fill(127));
  expect(fitRasterToCanvas(raster, frame, 4, 5)).toEqual({ raster, x: 0, y: 1 });
});

it('normalizes equal-size 16-bit RGBA to native 8-bit without using Canvas', () => {
  const frame = { x: 0, y: 0, w: 1, h: 1 };
  const source = TiledRaster.fromPixels(1, 1, 4, 16, Uint16Array.of(65535, 32768, 0, 16384));
  const { raster, x, y } = fitRasterToCanvas(source, frame, 1, 1);
  expect([x, y, raster.depth]).toEqual([0, 0, 8]);
  expect(raster.readPixels(frame)).toEqual(Uint8ClampedArray.of(255, 128, 0, 64));
  expect(source.readPixels(frame)).toEqual(Uint16Array.of(65535, 32768, 0, 16384));
});

it('rejects oversized axes before reading pixels or allocating Canvas', () => {
  const source = new TiledRaster(4, 8);
  expect(() => fitRasterToCanvas(source, { x: 0, y: 0, w: 8193, h: 1 }, 1, 1)).toThrow('Unsupported image');
});

it('keeps a source fill inside the fitted frame only', () => {
  const source = new TiledRaster(4, 8, 1);
  const { raster, y } = fitRasterToCanvas(source, { x: 0, y: 0, w: 4, h: 2 }, 4, 4);
  expect(y).toBe(1);
  expect(raster.readPixels({ x: 0, y: 0, w: 1, h: 3 })).toEqual(Uint8ClampedArray.of(
    255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0,
  ));
});
