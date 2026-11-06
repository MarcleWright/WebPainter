/** Bounded native v1 data validators. No application, host, transport or platform imports. */
import { defaultAdjustment, type AdjustmentType, ADJUSTMENT_LABELS } from '../adjustments/types';
import { defaultCharacterStyle, defaultParagraphStyle } from '../typography/types';
import { BLEND_MODES } from '../image-engine/blend';

export const fail = (message: string): never => { throw Error(`Native v1: ${message}`); };
export function check(ok: unknown, message: string): asserts ok { if (!ok) fail(message); }
export function object(v: any, keys: string[], required = keys): void {
  check(v && typeof v === 'object' && !Array.isArray(v), 'object required');
  check(Object.keys(v).every(k => keys.includes(k)) && required.every(k => Object.hasOwn(v, k)), 'unknown or missing field');
}
export function number(v: any, min = -1e7, max = 1e7): void { check(typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max, 'number out of range'); }
export function integer(v: any, min: number, max: number): void { number(v, min, max); check(Number.isSafeInteger(v), 'integer required'); }
export function string(v: any, max = 10000): void { check(typeof v === 'string' && v.length <= max, 'string required/too long'); }
export function choice(v: any, values: readonly unknown[]): void { check(values.includes(v), 'unsupported value'); }
export function array(v: any, max: number, visit: (x: any) => void): void { check(Array.isArray(v) && v.length <= max, 'array limit'); v.forEach(visit); }
export function json(v: any, depth = 0, budget = { remaining: 150000 }): void {
  check(depth <= 32 && --budget.remaining >= 0, 'JSON complexity limit');
  if (v === null || typeof v === 'boolean') return;
  if (typeof v === 'number') { number(v, -1e12, 1e12); return; }
  if (typeof v === 'string') { string(v, 1_000_000); return; }
  check(v && typeof v === 'object' && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null), 'plain data required');
  for (const [k, value] of Object.entries(v)) { check(!['__proto__','prototype','constructor'].includes(k), 'unsafe field'); json(value, depth + 1, budget); }
}
/** Fixed structure, preserving all supplied values. Empty maps/nullable fields are bounded JSON. */
function shape(v: any, template: any): void {
  if (template === null) { json(v); return; }
  if (Array.isArray(template)) { array(v, 4096, x => template.length ? shape(x, template[0]) : json(x)); return; }
  if (typeof template === 'object') {
    if (!Object.keys(template).length) { json(v); return; }
    object(v, Object.keys(template)); for (const k of Object.keys(template)) shape(v[k], template[k]); return;
  }
  if (typeof template === 'number') number(v);
  else check(typeof v === typeof template, 'wrong property type');
}
export function path(v: any): void {
  object(v, ['fillRule','subpaths']); choice(v.fillRule, ['nonzero','evenodd']);
  array(v.subpaths, 2048, s => {
    object(s, ['closed','op','knots']); choice(s.closed, [true,false]); choice(s.op, ['combine','subtract','intersect','exclude']);
    array(s.knots, 10000, k => { object(k, ['x','y','inX','inY','outX','outY','smooth']); for (const f of ['x','y','inX','inY','outX','outY']) number(k[f]); choice(k.smooth,[true,false]); });
  });
}
export function text(v: any): void {
  const fields = ['text','runs','paragraphs','kind','box','orientation','transform','antiAlias','firstBaseline','psBreaks'];
  object(v, fields, fields.slice(0,8)); string(v.text, 100000); choice(v.kind,['point','paragraph']); choice(v.orientation,['horizontal','vertical']);
  choice(v.antiAlias,['none','sharp','crisp','strong','smooth']); if (v.firstBaseline !== undefined) choice(v.firstBaseline,['ascent','capHeight']);
  array(v.transform, 6, x => number(x)); check(v.transform.length === 6, 'text matrix');
  if (v.box !== null) { object(v.box,['x','y','w','h']); for (const k of ['x','y','w','h']) number(v.box[k]); check(v.box.w >= 0 && v.box.h >= 0, 'text box'); }
  const char = defaultCharacterStyle(), para = defaultParagraphStyle();
  for (const [runs, base, optional] of [[v.runs,char,['postScriptName','fontType','fontScript']], [v.paragraphs,para,['composer','opticalMargins','wordSpacing','letterSpacing','glyphScaling','autoLeading','hyphenation','hanging']]] as const) {
    let length = 0;
    array(runs, 10000, r => {
      object(r,['length','style']); integer(r.length,0,100000); length += r.length;
      object(r.style,[...Object.keys(base),...optional],Object.keys(base));
      for (const k of Object.keys(base)) shape(r.style[k], (base as any)[k]);
      for (const k of optional) if (r.style[k] !== undefined) json(r.style[k]);
    });
    check(length === v.text.length, 'text run lengths');
  }
  for (const r of v.runs) {
    const s=r.style; string(s.fontFamily,256); string(s.fontStyleName,256); number(s.fontSize,.01,10000); number(s.fontWeight,1,1000);
    choice(s.kerning,['metrics','optical','none']); choice(s.textCase,['none','allCaps','smallCaps']); choice(s.baseline,['normal','superscript','subscript']);
    if (s.leading !== null) number(s.leading,0,100000); number(s.horizontalScale,.001,1000); number(s.verticalScale,.001,1000);
  }
  for (const r of v.paragraphs) choice(r.style.align,['left','center','right','justifyLeft','justifyCenter','justifyRight','justifyAll']);
  if (v.psBreaks !== undefined) json(v.psBreaks);
}
export function adjustment(v: any): void {
  check(v && typeof v.type === 'string' && Object.hasOwn(ADJUSTMENT_LABELS,v.type) && v.type !== 'colorLookup', 'unsupported adjustment');
  shape(v, defaultAdjustment(v.type as AdjustmentType));
  if (v.type === 'curves') for (const k of ['rgb','red','green','blue']) {
    check(v[k].length >= 2 && v[k].length <= 256, 'curve point count'); let previous = -1;
    for (const p of v[k]) { number(p.x,0,255); number(p.y,0,255); check(p.x > previous,'curve order'); previous = p.x; }
  }
  if (v.type === 'levels') for (const k of ['rgb','red','green','blue']) { const c=v[k]; number(c.inBlack,0,253); number(c.inWhite,2,255); number(c.gamma,.01,9.99); number(c.outBlack,0,255); number(c.outWhite,0,255); check(c.inBlack < c.inWhite,'level interval'); }
  if (v.type === 'exposure') number(v.gamma,.01,10);
  if (v.type === 'posterize') integer(v.levels,2,256);
  if (v.type === 'threshold') number(v.level,0,255);
}
export function layerData(v: any): void {
  const base=['id','name','kind','visible','opacity','fillOpacity','blendMode','locks','clipping','x','y','mask','vectorMask','colorTag','metadata'];
  const kinds: Record<string,string[]>={pixel:['raster'],group:['children','expanded'],text:['text','raster','usingPreservedPixels','missingFonts'],shape:['path','origin','fill','stroke','raster','usingPreservedPixels'],adjustment:['adjustment'],fill:['fill']};
  check(v && Object.hasOwn(kinds,v.kind), 'unsupported layer kind'); object(v,[...base,...kinds[v.kind]]);
  string(v.id,256); check(v.id.length > 0,'empty layer ID'); string(v.name,1000);
  choice(v.visible,[true,false]); choice(v.clipping,[true,false]); number(v.opacity,0,1); number(v.fillOpacity,0,1); integer(v.x,-65536,65536); integer(v.y,-65536,65536);
  choice(v.blendMode, BLEND_MODES.map(x=>x.id)); choice(v.colorTag,['none','red','orange','yellow','green','blue','violet','gray']);
  object(v.locks,['transparency','pixels','position','artboard','all']); for (const x of Object.values(v.locks)) choice(x,[true,false]);
  object(v.metadata,['unsupported','custom'],['unsupported']); check(Array.isArray(v.metadata.unsupported) && v.metadata.unsupported.length === 0, 'unsupported layer features'); if (v.metadata.custom !== undefined) json(v.metadata.custom);
  const source=v.metadata.custom?.source;
  if(source!==undefined){object(source,['id','hash']);string(source.id,256);check(source.id.length>0&&typeof source.hash==='string'&&/^[a-f0-9]{64}$/.test(source.hash),'invalid immutable source descriptor');}
  if(v.mask!==null){object(v.mask,['raster','x','y','enabled','linked','density','feather']); integer(v.mask.x,-65536,65536); integer(v.mask.y,-65536,65536); choice(v.mask.enabled,[true,false]); choice(v.mask.linked,[true,false]);number(v.mask.density,0,1);number(v.mask.feather,0,1000);}
  if(v.vectorMask!==null){object(v.vectorMask,['path','enabled','invert','linked','density','feather']);path(v.vectorMask.path);for(const k of ['enabled','invert','linked'])choice(v.vectorMask[k],[true,false]);number(v.vectorMask.density,0,1);number(v.vectorMask.feather,0,1000);}
  if(v.kind==='text'){text(v.text);choice(v.usingPreservedPixels,[true,false]);array(v.missingFonts,100,x=>string(x,256));}
  if(v.kind==='adjustment')adjustment(v.adjustment);
  const paint=(p:any)=>{check(p && p.type==='solid','native v1 supports solid fills only');object(p,['type','color']);object(p.color,['r','g','b']);for(const x of Object.values(p.color))number(x,0,1);};
  if(v.kind==='fill')paint(v.fill);
  if(v.kind==='shape'){
    path(v.path); if(v.origin!==null){object(v.origin,['kind','x','y','w','h','radii','sides','starRatio','lineWidth','rotation'],['kind','x','y','w','h']);choice(v.origin.kind,['rectangle','roundedRectangle','ellipse','polygon','star','line','custom']);json(v.origin);}
    paint(v.fill);object(v.stroke,['enabled','paint','width','alignment','cap','join','miterLimit','dash','dashOffset','opacity']);paint(v.stroke.paint);choice(v.stroke.enabled,[true,false]);number(v.stroke.width,0,10000);choice(v.stroke.alignment,['inside','center','outside']);choice(v.stroke.cap,['butt','round','square']);choice(v.stroke.join,['miter','round','bevel']);number(v.stroke.miterLimit,0,1e5);array(v.stroke.dash,100,x=>number(x,0,10000));number(v.stroke.dashOffset);number(v.stroke.opacity,0,1);choice(v.usingPreservedPixels,[true,false]);
  }
  if(v.kind==='group')choice(v.expanded,[true,false]);
}
