/** Formal-path Pen draft: one final path command, bounded local snapshots, explicit ownership. */
import type {ToolHost} from './tool';
import {getTarget,livePath,PathEdit,type PathTarget} from './pathEditing';
import type {VectorPath} from '../vector/types';
import {clonePath} from '../vector/types';
import {LambdaCommand} from '../commands/layerCommands';
import {renderShapeLayer} from '../layers/appearance';
import {access} from '../app/access';
import {ui} from '../app/store';
import type {CelenneDocument} from '../document/document';

export interface PenState {path:VectorPath;sp:number}
export class PenDraft {
  readonly session;
  readonly doc;
  readonly target:PathTarget;
  readonly path:VectorPath;
  private object:object;
  private mask:object|null;
  private identity;
  private expected:string;
  private before:VectorPath;
  private beforeOrigin;
  private beforePosition;
  private geometry:{x:number;y:number}|null;
  private writing=false;
  private edit:PathEdit;
  private states:PenState[];
  private index=0;
  private stop:()=>void;
  constructor(readonly host:ToolHost,invalid:()=>void){
    const s=this.session=host.session;this.doc=s.doc;this.target=getTarget(s,true)!;
    this.path=livePath(s,this.target)!;this.before=clonePath(this.path);this.expected=JSON.stringify(this.path);
    const layer=this.target.kind==='path'?null:s.doc.getLayer(this.target.layerId);
    const target=this.target;this.object=target.kind==='path'?s.doc.paths.find(p=>p.id===target.pathId)!:layer!;
    this.mask=this.target.kind==='vectorMask'?layer!.vectorMask!:null;
    this.beforePosition=layer?{x:layer.x,y:layer.y}:null;this.geometry=this.beforePosition;
    this.beforeOrigin=layer?.kind==='shape'?structuredClone(layer.origin):null;
    this.identity={layer:s.activeLayerId,path:s.activePathId,mask:s.editMask,channel:s.activeChannelId};
    this.edit=new PathEdit(s,this.target,'Pen');this.states=[{path:clonePath(this.path),sp:-1}];
    this.stop=s.doc.on(()=>{if(!this.valid())invalid();});
  }
  valid():boolean {
    const s=this.session,t=this.target,l=t.kind==='path'?null:this.doc.getLayer(t.layerId);
    const object=t.kind==='path'?this.doc.paths.find(p=>p.id===t.pathId):l;
    return this.host.editor.active===s&&s.doc===this.doc&&object===this.object
      &&(t.kind!=='vectorMask'||l?.vectorMask===this.mask)&&(!l||this.writing||l.x===this.geometry?.x&&l.y===this.geometry?.y)&&livePath(s,t)===this.path&&JSON.stringify(this.path)===this.expected
      &&s.activeLayerId===this.identity.layer&&s.activePathId===this.identity.path&&s.editMask===this.identity.mask&&s.activeChannelId===this.identity.channel;
  }
  allowed(output=false):boolean {
    const s=this.session,t=this.target,l=t.kind==='path'?null:s.doc.getLayer(t.layerId);
    return this.valid()&&s.canEdit()&&(output||!s.outputPending&&!s.closePending)&&access('tool:pen').enabled&&(t.kind!=='vectorMask'||access('feature:masks').enabled)&&(!l||!l.locks.all&&(t.kind==='vectorMask'||!l.locks.pixels));
  }
  changed(){this.expected=JSON.stringify(this.path);this.writing=true;try{this.edit.changed();}finally{this.writing=false;}const l=this.target.kind==='path'?null:this.doc.getLayer(this.target.layerId);if(l)this.geometry={x:l.x,y:l.y};this.host.redraw();ui.bump('historyRev');}
  state(sp:number):PenState{return {path:clonePath(this.path),sp};}
  restore(state:PenState){this.path.subpaths=clonePath(state.path).subpaths;this.path.fillRule=state.path.fillRule;this.changed();}
  record(sp:number){const next=this.state(sp);if(JSON.stringify(next)===JSON.stringify(this.states[this.index]))return;
    this.states.splice(this.index+1);this.states.push(next);if(this.states.length>100)this.states.shift();this.index=this.states.length-1;ui.bump('historyRev');}
  step(redo:boolean):PenState|null {const next=this.index+(redo?1:-1);if(next<0||next>=this.states.length)return null;this.index=next;this.restore(this.states[next]);return this.states[next];}
  dispose(){this.stop();}
  commit():boolean {
    if(JSON.stringify(this.before)===JSON.stringify(this.path)){const l=this.target.kind==='shape'?this.doc.getLayer(this.target.layerId):null;if(l?.kind==='shape'){l.origin=structuredClone(this.beforeOrigin);if(this.beforePosition)Object.assign(l,this.beforePosition);}return true;}
    const t=this.target,before=clonePath(this.before),after=clonePath(this.path),beforeOrigin=this.beforeOrigin,beforePosition=this.beforePosition,afterPosition=this.geometry;
    const apply=(d:CelenneDocument,path:VectorPath,undo:boolean)=>{
      if(t.kind==='path'){const p=d.paths.find(p=>p.id===t.pathId);if(p)p.path=clonePath(path);d.emit({type:'paths'});}
      else {const l=d.getLayer(t.layerId);if(!l)return;
        if(t.kind==='shape'&&l.kind==='shape'){l.path=clonePath(path);l.origin=undo?structuredClone(beforeOrigin):l.origin?{...l.origin,kind:'custom'}:null;renderShapeLayer(d,l);const position=undo?beforePosition:afterPosition;if(position)Object.assign(l,position);d.emit({type:'layer',layerId:l.id});}
        else if(t.kind==='vectorMask'&&l.vectorMask){l.vectorMask.path=clonePath(path);d.emit({type:'mask',layerId:l.id,rect:null});}
      }
    };
    const command=new LambdaCommand('Pen',d=>apply(d,after,false),d=>apply(d,before,true));
    try{this.session.push(command,true);}catch(error){if(this.session.history.current.command!==command){ui.toast('error','Could not finish the current path',String(error));return false;}}
    return this.session.history.current.command===command;
  }
}
