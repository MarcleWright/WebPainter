import type {Access,AccessPolicy} from '../app/access';
/** Editing admission, independent of decoding/preserving already supported data. */
export const NATIVE_CAPABILITIES = Object.freeze({policyVersion:1,nativeVersion:1,colorModes:['rgb8'],layerKinds:['pixel','group','text','shape','adjustment','fill-solid'],unsupported:['effects','advancedBlending','smartObject','channels','slices','gradientFill','patternFill','textWarp','textPath','warp','externalServices']});
export type CapabilityPolicy={version:1;entries:Record<string,Access>};
const tools=new Set('move marqueeRect marqueeEllipse marqueeRow marqueeColumn lasso polyLasso magneticLasso magicWand crop perspectiveCrop eyedropper colorSampler ruler spotHealing healing patch redEye brush pencil colorReplace cloneStamp patternStamp eraser bgEraser magicEraser gradient paintBucket blur sharpen smudge dodge burn sponge pen freeformPen addAnchor deleteAnchor convertPoint pathSelect directSelect type typeVertical rectangle ellipse polygon line customShape hand rotateView zoom'.split(' '));
const panels=new Set('layers properties adjustments history paths brushes brushSettings character paragraph color swatches gradients navigator info'.split(' '));
const dialogs=new Set('imageSize canvasSize rotateCanvas trim fill stroke modifySelection newGuide newGuideLayout customZoom prompt colorPicker adjustment colorRange selectAndMask missingFonts docInfo gpuInfo commandPalette'.split(' '));
const properties=new Set('pixel group text shape adjustment fill'.split(' '));
const adjustments=new Set('brightnessContrast levels curves exposure vibrance hueSaturation colorBalance blackWhite photoFilter channelMixer invert posterize threshold gradientMap selectiveColor'.split(' '));
export function nativeSupports(entry:string,actions:ReadonlySet<string>):boolean{
 const split=entry.indexOf(':'),kind=entry.slice(0,split),id=entry.slice(split+1);
 switch(kind){
  case 'tool':return tools.has(id);
  case 'panel':return panels.has(id);
  case 'dialog':return dialogs.has(id);
  case 'properties':return properties.has(id);
  case 'paint':return id==='solid';
  case 'fill':return id==='solid';
  case 'adjustment':return adjustments.has(id);
  case 'feature':return id==='masks';
  case 'action':
   if(!actions.has(id))return false;
   if(id.startsWith('file.'))return ['file.save','file.close','file.closeAll'].includes(id);
   if(/^(app\.|channel\.|slice\.|image\.(depth|mode)\.|edit\.(preferences|generative|contentAware|definePattern)|image.generative|select\.(subject|sky|focusArea|save|load)|layer\.(style|copyStyle|pasteStyle|setStyle)|type\.(warp|path)|view\.(slices|clearSlices))/.test(id)||/smart|knockout|blendIf/i.test(id)||id==='edit.transform.warp')return false;
   if(id.startsWith('layer.newFill.'))return id==='layer.newFill.solid';
   if(id.startsWith('layer.newAdjustment.'))return adjustments.has(id.slice('layer.newAdjustment.'.length));
   if(id.startsWith('window.'))return panels.has(id.slice('window.'.length));
   return /^(edit|image|layer|select|type|view|shape)\./.test(id);
 }
 return false;
}
export function nativePolicy(input:CapabilityPolicy|undefined,actions:ReadonlySet<string>):AccessPolicy{
 const entries:Record<string,Access>=Object.create(null);
 if(input!==undefined){
  if(!input||input.version!==1||!input.entries||typeof input.entries!=='object'||Array.isArray(input.entries)||Object.keys(input.entries).length>256)throw Error('Invalid capability policy');
  for(const [key,value]of Object.entries(input.entries)){
   if(!/^(action|tool|panel|dialog|feature|paint|fill|adjustment|properties):[A-Za-z0-9_.-]{1,96}$/.test(key)||!value||typeof value.visible!=='boolean'||typeof value.enabled!=='boolean')throw Error('Invalid capability entry');
   entries[key]={visible:value.visible,enabled:value.enabled};
  }
 }
 return key=>{const supported=nativeSupports(key,actions),entry=entries[key];return{visible:entry?.visible??supported,enabled:supported&&(entry?.enabled??true)};};
}
