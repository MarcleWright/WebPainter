import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CelenneDocument } from '../../src/document/document';
import { createFillLayer, createGroupLayer, createMask, createPixelLayer } from '../../src/document/layerFactory';
import { TILE_SIZE } from '../../src/image-engine/tiledRaster';
import { renderAlignedRasterThumbnail } from '../../src/rendering/thumbnail';

function fixture(width = 4096, height = 2304) {
  const doc = new CelenneDocument('Thumbnail', { width, height, resolution: 72, colorMode: 'rgb', bitDepth: 8 });
  const layer = createPixelLayer('Ink', 8);
  doc.insertLayer(layer);
  return { doc, layer };
}

const putImageData = vi.fn();
const drawImage = vi.fn();
const getImageData = vi.fn((_x: number, _y: number, width: number, height: number) => ({
  data: new Uint8ClampedArray(width * height * 4),
}));
const allocate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ImageData', class {
    constructor(readonly data: Uint8ClampedArray, readonly width: number, readonly height: number) {}
  });
  vi.stubGlobal('OffscreenCanvas', class {
    constructor(width: number, height: number) {
      allocate(width, height);
    }
    getContext() {
      return { putImageData, drawImage, getImageData };
    }
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('aligned raster thumbnail', () => {
  it('writes only in-canvas tiles straight to integer thumbnail rectangles', () => {
    const { doc, layer } = fixture();
    const pixels = new Uint8ClampedArray([30, 205, 100, 127]);
    for (const [x, y] of [[-1, 0], [0, -1], [257, 514], [4096, 0], [0, 2304], [4095, 2303]]) {
      layer.raster.writePixels({ x, y, w: 1, h: 1 }, pixels);
    }
    const result = renderAlignedRasterThumbnail(doc);
    expect(result).toMatchObject({ width: 512, height: 288 });
    expect(result?.data).toHaveLength(512 * 288 * 4);
    expect(allocate.mock.calls).toEqual([[512, 288], [TILE_SIZE, TILE_SIZE]]);
    expect(putImageData).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.calls.map(call => call.slice(1))).toEqual([[32, 64, 32, 32], [480, 256, 32, 32]]);
  });

  it.each([[1920, 1080], [3840, 2160], [2049, 667], [8192, 17], [8192, 2304], [512, 512]])(
    'rejects unsupported geometry %s × %s before allocating Canvas',
    (width, height) => {
      expect(renderAlignedRasterThumbnail(fixture(width, height).doc)).toBeNull();
      expect(allocate).not.toHaveBeenCalled();
    },
  );

  it('accepts an aligned short edge', () => {
    const { doc } = fixture(256, 8192);
    expect(renderAlignedRasterThumbnail(doc)).toMatchObject({ width: 16, height: 512 });
  });

  it('falls back if the one pixel layer has a hidden sibling', () => {
    const { doc } = fixture();
    const hidden = createGroupLayer('Hidden');
    hidden.visible = false;
    doc.insertLayer(hidden);
    expect(renderAlignedRasterThumbnail(doc)).toBeNull();
    expect(allocate).not.toHaveBeenCalled();
  });

  it.each<[(value: ReturnType<typeof fixture>) => void]>([
    [({ doc }) => doc.insertLayer(createPixelLayer('More ink', 8))],
    [({ doc, layer }) => { layer.visible = false; doc.insertLayer(createGroupLayer('Only a group')); }],
    [({ doc, layer }) => { layer.visible = false; doc.insertLayer(createFillLayer({ type: 'solid', color: { r: 1, g: 1, b: 1 } })); }],
    [({ doc }) => { doc.canvas.bitDepth = 16; }],
    [({ layer }) => { layer.x = 1; }],
    [({ layer }) => { layer.opacity = 0.99; }],
    [({ layer }) => { layer.fillOpacity = 0.99; }],
    [({ layer }) => { layer.clipping = true; }],
    [({ layer }) => { layer.blendMode = 'multiply'; }],
    [({ layer }) => { layer.mask = createMask(true); }],
    [({ layer }) => { layer.advanced.transparencyShapesLayer = false; }],
    [({ layer }) => { layer.raster.fill = 1; }],
  ])('falls back for unsupported document or layer state', modify => {
    const doc = fixture();
    modify(doc);
    expect(renderAlignedRasterThumbnail(doc.doc)).toBeNull();
    expect(allocate).not.toHaveBeenCalled();
  });

  it('falls back when browser Canvas is unavailable or throws', () => {
    const { doc } = fixture();
    vi.stubGlobal('OffscreenCanvas', undefined);
    expect(renderAlignedRasterThumbnail(doc)).toBeNull();
    vi.stubGlobal('OffscreenCanvas', class {
      constructor() { throw new Error('Canvas allocation failed'); }
    });
    expect(renderAlignedRasterThumbnail(doc)).toBeNull();
  });
});
