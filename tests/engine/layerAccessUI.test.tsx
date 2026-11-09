// @vitest-environment jsdom
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {editor} from '../../src/app/editor';
import {createNative,decodeNative} from '../../src/document/native';
import {installAccessPolicy,type Access} from '../../src/app/access';
import {LayersPanel} from '../../src/ui/panels/LayersPanel';
import {ContextMenuHost} from '../../src/ui/menu/Menu';
import {action} from '../../src/app/actions';
import * as L from '../../src/app/ops/layerOps';
vi.mock('../../src/ui/panels/Thumb',()=>({LayerThumb:()=>null}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root|undefined,restore:(()=>void)|undefined,container:HTMLElement;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;container?.remove();restore?.();restore=undefined;for(const s of [...editor.sessions])editor.removeSession(s.id);});
async function mount(entries:Record<string,Access>={}){const s=editor.addDocument(decodeNative(createNative(32,24)).doc);restore=installAccessPolicy(id=>entries[id]??{visible:true,enabled:true});container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>root!.render(<><LayersPanel/><ContextMenuHost/></>));return s;}
const button=(title:string)=>container.querySelector<HTMLButtonElement>('[title="'+title+'"]');
const menu=()=>[...document.querySelectorAll<HTMLElement>('[role=menuitem]')];
async function context(){await act(async()=>container.querySelector('[role=treeitem]')!.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})));}
it('actual group button and context entries hide/disable together with actions; direct operations cannot bypass',async()=>{
 const s=await mount({'action:layer.newGroup':{visible:false,enabled:false},'action:layer.groupLayers':{visible:false,enabled:false},'action:layer.duplicate':{visible:false,enabled:false},'action:layer.new':{visible:false,enabled:false},'action:layer.delete':{visible:false,enabled:false},'feature:masks':{visible:false,enabled:false}});expect(action('layer.newGroup')!.enabled!()).toBe(false);expect(button('Create a new group')).toBeNull();expect(button('Add layer mask')).toBeNull();expect(button('Create a new layer (Shift+Ctrl+N)')).toBeNull();expect(button('Delete layer')).toBeNull();await context();expect(menu().some(e=>/Group from Layers|Duplicate Layer|Add Layer Mask|Add Vector Mask/.test(e.textContent!))).toBe(false);await act(async()=>{L.newGroup(false);L.newGroup(true);L.duplicateLayers();L.newLayer();L.deleteLayers();L.addMask();L.addVectorMask(true);});expect(s.doc.layerCount()).toBe(1);expect(s.activeLayer()!.mask).toBeNull();
});
it('visible disabled UI neither changes document nor hides controls',async()=>{
 const s=await mount({'action:layer.newGroup':{visible:true,enabled:false},'action:layer.groupLayers':{visible:true,enabled:false},'feature:masks':{visible:true,enabled:false}});const b=button('Create a new group')!;expect(b).not.toBeNull();await act(async()=>b.click());expect(s.doc.layerCount()).toBe(1);await context();const group=menu().find(e=>e.textContent!.trim()==='Group from Layers')!;expect(group).toBeDefined();await act(async()=>group.click());expect(s.doc.layerCount()).toBe(1);const mask=menu().find(e=>e.textContent!.trim()==='Add Layer Mask')!;expect(mask).toBeDefined();await act(async()=>mask.click());expect(s.activeLayer()!.mask).toBeNull();
});
it('hidden alone does not disable direct execution; standalone default actual button still creates a group',async()=>{
 const s=await mount({'action:layer.newGroup':{visible:false,enabled:true}});expect(button('Create a new group')).toBeNull();await act(async()=>L.newGroup());expect(s.doc.layerCount()).toBe(2);
 restore!();restore=undefined;await act(async()=>root!.render(<><LayersPanel/><ContextMenuHost/></>));await act(async()=>button('Create a new group')!.click());expect(s.doc.layerCount()).toBe(3);
});
