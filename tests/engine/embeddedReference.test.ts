// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {editor} from '../../src/app/editor';
import {SetLayerPropsCommand} from '../../src/commands/layerCommands';
import {createNative,encodeNative} from '../../src/document/native';
import {reviveCheckpoint,tileSlots} from '../../src/embedded/checkpoint-wire';
import type {EmbeddedEditor,HostPort} from '../../src/embedded/contract';
import {initializeEditor} from '../../src/embedded/editor';

type WorkerJob = {kind:string; document:ReturnType<typeof reviveCheckpoint>; complete():void};
const jobs: WorkerJob[] = [];
const jpeg=new Uint8Array([0xff,0xd8,0xff,0xd9]);
let api:EmbeddedEditor;

class ControlledWorker {
  onmessage!:(message:{data:{ready?:true; bytes?:Uint8Array}})=>void;
  wire!:ReturnType<typeof import('../../src/embedded/checkpoint-wire').checkpointWire>;
  stopped=false;
  postMessage(message:any,transfer:Transferable[]=[]){
    const m=structuredClone(message,{transfer});
    if(m.type==='start')this.wire=m.document;
    if(m.type==='tiles'){
      const slots=tileSlots(this.wire);
      m.tiles.forEach((tile:Uint8Array,index:number)=>{slots[m.offset+index][1]=tile;});
    }
    if(m.type==='encode'){
      const document=reviveCheckpoint(this.wire);
      jobs.push({kind:m.kind,document,complete:()=>{
        if(!this.stopped)this.onmessage({data:{bytes:m.kind==='reference'?jpeg:encodeNative(document)}});
      }});
    }else this.onmessage({data:{ready:true}});
  }
  terminate(){this.stopped=true;}
}
beforeEach(()=>{jobs.length=0;vi.stubGlobal('Worker',ControlledWorker);});
afterEach(()=>{
  for(const s of [...editor.sessions])editor.removeSession(s.id);
  api?.destroy();
  vi.unstubAllGlobals();
});
async function open(save:HostPort['save']=async()=>{},notify:HostPort['dirty']=()=>{}){
  api=initializeEditor({
    nativeVersion:1, readResource:async()=>({name:'drawing.wpnative',bytes:createNative(32,24)}),
    save, export:async()=>{}, confirm:async()=>0, dirty:notify, error(){},
  });
  await api.open('board','drawing');
  return editor.active!;
}
function edit(opacity:number){
  const s=editor.active!, layer=s.doc.allLayers()[0];
  s.push(new SetLayerPropsCommand('opacity',layer.id,{opacity:layer.opacity},{opacity}));
  return s.history.current.id;
}

it.each(['encoding','save callback'])('captures the latest complete frame while native %s is held',async hold=>{
  let finishSave!:()=>void;
  const save=vi.fn(()=>new Promise<void>(r=>{finishSave=r;}));
  const s=await open(save);
  const earlier=edit(0.25);
  const native=api.saveBackground();
  await vi.waitFor(()=>expect(jobs.at(0)?.kind).toBe('native'));
  if(hold==='save callback'){
    jobs[0].complete();
    await vi.waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
  }
  const captured=edit(0.5);
  const reference=api.captureGenerationReference!();
  await expect(api.captureGenerationReference!()).rejects.toThrow('already in progress');
  const latest=edit(0.75);
  expect(s.canEdit()).toBe(true);
  await vi.waitFor(()=>expect(jobs.at(1)?.kind).toBe('reference'));
  expect(jobs[1].document.allLayers()[0].opacity).toBe(0.5);
  jobs[1].complete();
  expect(await reference).toMatchObject({format:'jpeg',bytes:jpeg,width:32,height:24,binding:'board',checkpoint:captured});
  expect(s.outputBusy).toBe(true);
  if(hold==='encoding'){
    expect(save).not.toHaveBeenCalled();
    jobs[0].complete();
    await vi.waitFor(()=>expect(save).toHaveBeenCalledTimes(1));
  }
  expect(save.mock.calls).toHaveLength(1);
  finishSave();
  expect(await native).toBe('saved');
  expect(s.history.current.id).toBe(latest);
  expect(s.history.current.id).not.toBe(earlier);
  expect(s.modified).toBe(true);
});

it('wins over a not-yet-started autosave, then wakes its next attempt',async()=>{
  const dirty=vi.fn();
  await open(undefined,dirty);
  edit(0.4);
  const save=api.saveBackground();
  const capture=api.captureGenerationReference!();
  expect(await save).toBe('deferred');
  await vi.waitFor(()=>expect(jobs.at(0)?.kind).toBe('reference'));
  expect(await api.saveBackground()).toBe('deferred');
  jobs[0].complete();
  await capture;
  expect(dirty.mock.calls.some(([state])=>state.referenceCaptureBusy===true)).toBe(true);
  expect(dirty.mock.lastCall?.[0].referenceCaptureBusy).toBe(false);
  const retry=api.saveBackground();
  await vi.waitFor(()=>expect(jobs.at(1)?.kind).toBe('native'));
  jobs[1].complete();
  expect(await retry).toBe('saved');
});

it('refuses an uncommitted edit and cancels an in-flight reference on signal and on close',async()=>{
  const s=await open();
  const finish=s.beginUncommitted();
  await expect(api.captureGenerationReference!()).rejects.toThrow('Finish the current edit');
  expect(jobs).toHaveLength(0);
  finish();

  const controller=new AbortController();
  const reference=api.captureGenerationReference!(controller.signal);
  const canceled=expect(reference).rejects.toThrow('Reference capture canceled');
  await vi.waitFor(()=>expect(jobs.at(0)?.kind).toBe('reference'));
  controller.abort();
  await canceled;

  const next=api.captureGenerationReference!();
  const closed=expect(next).rejects.toThrow('Reference capture canceled');
  await vi.waitFor(()=>expect(jobs.at(1)?.kind).toBe('reference'));
  expect(await api.requestClose()).toBe(true);
  await closed;
  expect(api.state().open).toBe(false);
  expect(api.state().referenceCaptureBusy).toBe(false);
  await api.open('another-board','drawing');
  const replacement=api.captureGenerationReference!();
  await vi.waitFor(()=>expect(jobs.at(2)?.kind).toBe('reference'));
  jobs[2].complete();
  expect(await replacement).toMatchObject({binding:'another-board'});
});
