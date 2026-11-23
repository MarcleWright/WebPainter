import type { CelenneDocument } from '../document/document';
import { defaultAdvanced } from '../document/layerFactory';
import type { AdvancedBlending } from '../document/types';
import { keyToTile, TILE_SIZE } from '../image-engine/tiledRaster';
import { flattenToPixels } from './flatten';

const THUMBNAIL_EDGE = 512;
const MAX_SOURCE_AREA = 4096 * 4096;
const DEFAULT_ADVANCED_ENTRIES = Object.entries(defaultAdvanced()) as [keyof AdvancedBlending, unknown][];

/** Composite with the normal document renderer, then downsample without enlarging the document. */
export function renderCompositeThumbnail(doc: CelenneDocument, maxEdge: number) {
  if (!Number.isSafeInteger(maxEdge) || maxEdge < 1) throw new RangeError('Invalid thumbnail edge');
  const {width, height, data} = flattenToPixels(doc, {depth: 8});
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const output = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  const source = new OffscreenCanvas(width, height);
  source.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  const context = output.getContext('2d')!;
  context.drawImage(source, 0, 0, output.width, output.height);
  return {width: output.width, height: output.height, data: context.getImageData(0, 0, output.width, output.height).data};
}

function hasDefaultAdvanced(advanced: AdvancedBlending): boolean {
  return Object.keys(advanced).length === DEFAULT_ADVANCED_ENTRIES.length
    && DEFAULT_ADVANCED_ENTRIES.every(([key, value]) => JSON.stringify(advanced[key]) === JSON.stringify(value));
}

/**
 * Draw a single normal raster straight to the thumbnail. Tile boundaries must also be exact
 * output-pixel boundaries so Canvas filters each tile with the same scale as the whole raster.
 * Callers select a verified Canvas renderer and use full composition when this returns null.
 */
export function renderAlignedRasterThumbnail(doc: CelenneDocument): {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
} | null {
  const { width, height, colorMode, bitDepth } = doc.canvas;
  const divisor = Math.max(width, height) / THUMBNAIL_EDGE;
  if (colorMode !== 'rgb' || bitDepth !== 8 || width < TILE_SIZE || height < TILE_SIZE
    || width % TILE_SIZE || height % TILE_SIZE || width * height > MAX_SOURCE_AREA
    || ![2, 4, 8, 16].includes(divisor)) return null;

  const [layer] = doc.root.children;
  if (doc.root.children.length !== 1 || !layer.visible || layer.kind !== 'pixel' || layer.x !== 0 || layer.y !== 0
    || layer.blendMode !== 'normal' || layer.opacity !== 1 || layer.fillOpacity !== 1
    || layer.clipping || layer.mask || layer.vectorMask || layer.effects || !hasDefaultAdvanced(layer.advanced)
    || layer.raster.fill !== 0 || layer.raster.channels !== 4 || layer.raster.depth !== 8
    || layer.raster.companion) return null;

  if (typeof OffscreenCanvas === 'undefined' || typeof ImageData === 'undefined') return null;
  const outputWidth = width / divisor;
  const outputHeight = height / divisor;
  try {
    const output = new OffscreenCanvas(outputWidth, outputHeight).getContext('2d');
    const tileCanvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const source = tileCanvas.getContext('2d');
    if (!output || !source) return null;
    const tileEdge = TILE_SIZE / divisor;
    for (const [key, tile] of layer.raster.tiles) {
      const [tx, ty] = keyToTile(key);
      if (tx < 0 || ty < 0 || tx >= width / TILE_SIZE || ty >= height / TILE_SIZE) continue;
      const pixels = tile.data;
      if (!(pixels instanceof Uint8ClampedArray) || !(pixels.buffer instanceof ArrayBuffer)) return null;
      const rgba = new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length);
      source.putImageData(new ImageData(rgba, TILE_SIZE, TILE_SIZE), 0, 0);
      output.drawImage(tileCanvas, tx * tileEdge, ty * tileEdge, tileEdge, tileEdge);
    }
    return { width: outputWidth, height: outputHeight, data: output.getImageData(0, 0, outputWidth, outputHeight).data };
  } catch {
    return null;
  }
}
