// @vitest-environment jsdom
// Opt-in diagnostic, never a unit-test performance acceptance threshold.
import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {importPsd} from '../../src/psd/import';
import {snapshotDocument} from '../../src/document/clone';
import {decodeNative,encodeNative} from '../../src/document/native';
import {flattenToPixels} from '../../src/rendering/flatten';
import {encodePNG} from '../../src/formats/codecs';
it.skipIf(!process.env.WP_PERFORMANCE_FIXTURE)('measures exact standalone/formal fixture pipeline, separately from pointer-up',async()=>{const file=process.env.WP_PERFORMANCE_FIXTURE!;if(!file.includes('ada-drawing-window-'))throw Error('isolated fixture only');const doc=file.endsWith('.wpnative')?decodeNative(new Uint8Array(readFileSync(file))).doc:importPsd(new Uint8Array(readFileSync(file)),'performance.psd').doc,rows=[];expect(doc.width).toBe(4096);for(let i=0;i<3;i++){const row:Record<string,number>={};let start=performance.now();const snapshot=snapshotDocument(doc);row.snapshot=performance.now()-start;start=performance.now();const bytes=encodeNative(snapshot);row.native=performance.now()-start;start=performance.now();const pixels=flattenToPixels(snapshot,{depth:8});row.composite=performance.now()-start;start=performance.now();const png=encodePNG(pixels.width,pixels.height,pixels.data as Uint8ClampedArray,8);row.png=performance.now()-start;start=performance.now();structuredClone(bytes);row.copy=performance.now()-start;row.nativeBytes=bytes.length;row.pngBytes=png.length;rows.push(row);await new Promise(r=>setTimeout(r,20));}writeFileSync('doc/material/autosave-segments.json',JSON.stringify({fixture:file,width:doc.width,layers:doc.allLayers().length,environment:'Node/Vitest diagnostic - not Electron acceptance',rows},null,2));},120000);
