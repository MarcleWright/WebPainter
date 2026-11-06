/** Deterministic shared 4K fixture; PSD test transport, not the future native codec. */
import { writeFileSync } from 'node:fs';
import { CelenneDocument } from '../src/document/document';
import { createPixelLayer, createMask, createAdjustmentLayer } from '../src/document/layerFactory';
import { TiledRaster } from '../src/image-engine/tiledRaster';
import { defaultAdjustment } from '../src/adjustments/types';
import { exportPsd } from '../src/psd/export';
const size = 4096;
const doc = new CelenneDocument('03C shared 4K', {width:size,height:size,resolution:72,colorMode:'rgb',bitDepth:8});
for (let layer = 0; layer < 2; layer++) {
  const raster = new TiledRaster(4,8);
  for (let y = 0; y < size; y += 256) for (let x = 0; x < size; x += 256) {
    const data = new Uint8ClampedArray(256*256*4);
    for (let j=0;j<256;j++) for(let i=0;i<256;i++) {
      const k=(j*256+i)*4, xx=x+i, yy=y+j;
      data[k]=(xx*7+yy*3)%256; data[k+1]=(xx^yy)%256; data[k+2]=(xx*3+yy*5)%256;
      data[k+3]=layer ? ((Math.floor(xx/96)+Math.floor(yy/96))%3===0 ? 155 : 0) : 255;
    }
    raster.writePixels({x,y,w:256,h:256},data);
  }
  const l=createPixelLayer(layer ? 'Linework and transparency' : 'Nonuniform reference',8,raster);
  if(layer) { l.mask=createMask(true); l.mask.raster.writeFloat({x:1000,y:1000,w:256,h:256},new Float32Array(256*256).fill(.4)); }
  doc.insertLayer(l);
}
doc.insertLayer(createAdjustmentLayer(defaultAdjustment('curves'),'Adjustment'));
writeFileSync(process.argv[2],exportPsd(doc,{maximizeCompatibility:false}));
console.log('4K fixture written');
