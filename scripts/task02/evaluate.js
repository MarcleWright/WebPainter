const pause = ms=>new Promise(r=>setTimeout(r,ms));
const frame = ()=>new Promise(r=>requestAnimationFrame(r));
for(let i=0;i<300&&!window.__celenneTest;i++)await pause(100);
if(!window.__celenneTest)throw new Error('No dev bridge');
const {editor,store}=window.__celenneTest;
const [{CelenneDocument},{createPixelLayer,createAdjustmentLayer,createMask},{TiledRaster},{MoveTool},{DocumentSession},{defaultAdjustment},rendering,gpuMod] = await Promise.all([
 import('/src/document/document.ts'),import('/src/document/layerFactory.ts'),import('/src/image-engine/tiledRaster.ts'),import('/src/tools/moveTool.ts'),import('/src/app/session.ts'),import('/src/adjustments/types.ts'),import('/src/rendering/renderEngine.ts'),import('/src/gpu/device.ts')]);
editor.setPrefs({...editor.prefs,general:{...editor.prefs.general,autosaveMinutes:0}});
store.useApp.setState(s=>({toolOptions:{...s.toolOptions,move:{...s.toolOptions.move,autoSelect:false,showTransformControls:false,snap:false}}}));
editor.setTool('move');
const stat=a=>{if(!a.length)return{n:0};const b=[...a].sort((a,b)=>a-b);return {n:a.length,mean:+(a.reduce((a,b)=>a+b,0)/a.length).toFixed(2),p50:+b[Math.floor(b.length*.5)].toFixed(2),p95:+b[Math.min(b.length-1,Math.floor(b.length*.95))].toFixed(2),max:+b.at(-1).toFixed(2)}};
const p=(x,y)=>({x,y,sx:x*.25,sy:y*.25,pressure:1,tiltX:0,tiltY:0,twist:0,button:0,buttons:1,shift:false,alt:false,mod:false,pointerType:'mouse',time:performance.now(),clickCount:1});
function build(w,h,selection,complex=false,depth=8){
 const doc=new CelenneDocument('Synthetic performance evaluation',{width:w,height:h,resolution:72,colorMode:'rgb',bitDepth:depth});
 const px=depth===8?new Uint8ClampedArray(w*h*4):new Uint16Array(w*h*4);const max=depth===8?255:65535;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;px[i]=(x*17+y*7)%max;px[i+1]=(y*29)%max;px[i+2]=(x*31)%max;px[i+3]=max;}
 if(complex){const bg=createPixelLayer('Background',8,TiledRaster.fromPixels(w,h,4,8,new Uint8ClampedArray(px)));doc.insertLayer(bg,doc.root);}
 const layer=createPixelLayer('Synthetic photo',depth,TiledRaster.fromPixels(w,h,4,depth,px));doc.insertLayer(layer,doc.root);
 if(complex){layer.mask=createMask(true); const mask=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)mask[y*w+x]=[0,.5,1][Math.floor(x/128)%3];layer.mask.raster.writeFloat({x:0,y:0,w,h},mask);layer.opacity=.65;layer.blendMode='multiply';const curves=defaultAdjustment('curves');curves.rgb=[{x:0,y:0},{x:128,y:160},{x:255,y:255}];doc.insertLayer(createAdjustmentLayer(curves,'Curves'),doc.root);}
 if(selection)doc.selection.setRegion({x:128,y:128,w:selection[0],h:selection[1]},new Float32Array(selection[0]*selection[1]).fill(1));
 return {doc,layer};
}
const out={environment:{ua:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,dpr:devicePixelRatio},micro:[],interactive:[]};
// Isolate the existing MoveTool handler from painting and UI frame scheduling.
for(const size of []){
 const {doc,layer}=build(3840,2160,size);const s=new DocumentSession(doc);const h={session:s,editor,redraw(){},setCursor(){},viewportSize(){return{w:1200,h:800}}};const t=new MoveTool();
 const a=performance.now();t.down(h,p(200,200));const down=performance.now()-a;const times=[];let writes=0,bytes=0,restore=0;
 const ow=layer.raster.writableTile.bind(layer.raster),orr=layer.raster.restore.bind(layer.raster);
 layer.raster.writableTile=(x,y)=>{writes++;const v=ow(x,y);bytes+=v.data.byteLength;return v};
 layer.raster.restore=(snap)=>{const a=performance.now();const v=orr(snap);restore+=performance.now()-a;return v};
 for(let i=1;i<=32;i++){const a=performance.now();t.move(h,p(200+i*3,200+i*2));times.push(performance.now()-a)}
 console.log('EVAL micro '+JSON.stringify({size,down,move:stat(times.slice(4))}));out.micro.push({size,downMs:+down.toFixed(2),moveMs:stat(times.slice(4)),tileWritesPerMove:writes/32,tileBytesTouchedMiBPerMove:+(bytes/32/1048576).toFixed(2),restoreMsPerMove:+(restore/32).toFixed(3)});
 t.cancel(h);s.dispose();await pause(20);
}
const cases=[{name:'C0 medium',size:[1536,1024],zoom:.25},{name:'C0 large',size:[3072,1728],zoom:.25},{name:'C1 medium',size:[1536,1024],zoom:.25,complex:true}];for(const c of cases){
 console.log('EVAL start '+c.name);const {doc,layer}=build(3840,2160,c.size,c.complex,c.depth??8);const s=editor.addDocument(doc);s.setActive(layer.id);s.fitted=true;s.view.zoom=c.zoom;s.view.panX=0;s.view.panY=0;
 await frame();await frame();const h=editor.hostFactory?.();if(!h)throw new Error('No real canvas host');
 for(let init=0;init<100&&(!gpuMod.currentGpu()||!window.__celenneViewport);init++)await pause(50);const gpu=gpuMod.currentGpu();rendering.setGpuCompositor(c.cpu?null:gpu?.compositor??null);
 h.redraw();let warmFrames=0;for(;warmFrames<120;warmFrames++){await frame();if(!s.engine.hasPendingWork()&&warmFrames>4)break}
 await gpu?.device.queue.onSubmittedWorkDone();
 const t=editor.tool('move');const moves=[],frames=[],processMs=[],renderMs=[],renderComplete=[];let last=null;
 const viewport=window.__celenneViewport;const op=s.engine.process.bind(s.engine),or=viewport.renderer.render.bind(viewport.renderer);
 s.engine.process=(...args)=>{const a=performance.now();const v=op(...args);processMs.push(performance.now()-a);return v};
 viewport.renderer.render=(...args)=>{const a=performance.now();const v=or(...args);renderMs.push(performance.now()-a);renderComplete.push(v);return v};
 const beforeStats={...gpu?.compositor.stats};const beforeUploads=gpu?.compositor.floatingAtlasUploads??0;let rasterWrites=0,selectionWrites=0;
 const wr=layer.raster.writableTile.bind(layer.raster), ws=doc.selection.mask.writableTile.bind(doc.selection.mask);
 layer.raster.writableTile=(...args)=>{rasterWrites++;return wr(...args)};
 doc.selection.mask.writableTile=(...args)=>{selectionWrites++;return ws(...args)};
 if(c.deferUI)editor.beginInteraction();let a=performance.now();t.down(h,p(200,200));const down=performance.now()-a;
 for(let i=1;i<=40;i++){const now=await frame();if(last!==null)frames.push(now-last);last=now;const a=performance.now();for(let k=0;k<(c.samples??1);k++)t.move(h,p(200+i*3*(c.samples??1)+k*3,200+i*2));moves.push(performance.now()-a)}
 const pendingAtRelease=s.engine.hasPendingWork();const writesDuringMove={rasterWrites,selectionWrites};const previewActive=!!s.engine.getOverride(layer.id)?.gpu?.floating;layer.raster.writableTile=wr;doc.selection.mask.writableTile=ws;a=performance.now();t.up(h,p(320,280));const up=performance.now()-a;if(c.deferUI)editor.endInteraction();
 const settledAt=performance.now();let settleFrames=0;for(;settleFrames<120;settleFrames++){await frame();if(!s.engine.hasPendingWork()&&settleFrames>1)break}
 await gpu?.device.queue.onSubmittedWorkDone();
 out.interactive.push({name:c.name,previewActive,writesDuringMove,floatUploads:(gpu?.compositor.floatingAtlasUploads??0)-beforeUploads,layerId:layer.id,activeLayerId:s.activeLayerId,zoom:s.view.zoom,renderer:window.__celenneRenderer,gpuComposite:!!rendering.gpuCompositor(),adapter:gpu?.info,warmFrames,downMs:+down.toFixed(2),moveMs:stat(moves.slice(4)),frameIntervalMs:stat(frames.slice(4)),engineProcessMs:stat(processMs),viewportSubmitMs:stat(renderMs),incompleteFrames:renderComplete.filter(x=>!x).length,totalRenderedFrames:renderComplete.length,pendingAtRelease,upMs:+up.toFixed(2),settleMs:+(performance.now()-settledAt).toFixed(2),gpuPreviews:(gpu?.compositor.stats.gpuPreviews??0)-(beforeStats.gpuPreviews??0),gpuTiles:(gpu?.compositor.stats.gpuTiles??0)-(beforeStats.gpuTiles??0),cpuTiles:(gpu?.compositor.stats.cpuTiles??0)-(beforeStats.cpuTiles??0),lastFallback:gpu?.compositor.stats.lastFallback});
 console.log('EVAL completed '+JSON.stringify(out.interactive.at(-1)));s.engine.process=op;viewport.renderer.render=or;editor.removeSession(s.id);rendering.setGpuCompositor(gpu?.compositor??null);await pause(50);
}
return out;