import {expect,it} from 'vitest';
import {access,installAccessPolicy} from '../../src/app/access';
import {register,action,run} from '../../src/app/actions';
import {editor} from '../../src/app/editor';
import {ui} from '../../src/app/store';
it('standalone is unrestricted; visible and enabled are independent and scoped installs restore',()=>{
 expect(access('action:image.depth.16')).toEqual({visible:true,enabled:true});
 const restore=installAccessPolicy(id=>({visible:!id.startsWith('hidden'),enabled:!id.startsWith('disabled')}));
 try{expect(access('hidden')).toEqual({visible:false,enabled:true});expect(access('disabled')).toEqual({visible:true,enabled:false});const inner=installAccessPolicy(()=>({visible:false,enabled:false}));inner();expect(access('disabled').enabled).toBe(false);}finally{restore();}
 expect(access('action:image.depth.16').enabled).toBe(true);
});
it('guards action.run, dispatcher, tool selection and direct dialog requests; hidden alone stays executable',async()=>{
 let calls=0;register({id:'test.access',label:'probe',run:()=>{calls++;}});
 const before=editor.currentToolId,dialogs=ui.get().dialogs.length;
 const restore=installAccessPolicy(id=>({visible:false,enabled:id==='action:test.access'}));
 try{expect(action('test.access')!.visible!()).toBe(false);await run('test.access');action('test.access')!.run();expect(calls).toBe(2);editor.setTool('brush');expect(editor.currentToolId).toBe(before);expect(editor.tool('brush')).toBe(null);expect(ui.openDialog('layerStyle')).toBe(0);expect(ui.get().dialogs).toHaveLength(dialogs);}finally{restore();}
 const disable=installAccessPolicy(()=>({visible:true,enabled:false}));try{await run('test.access');action('test.access')!.run();expect(calls).toBe(2);}finally{disable();}
});

it('Window custom entries and restored layout obey panel admission without changing standalone defaults',async()=>{
 const {MENUS}=await import('../../src/app/menus');const {admittedPanelModel}=await import('../../src/ui/panelAdmission');
 const definition={global:{},layout:{type:'row' as const,children:[{type:'tabset' as const,children:[{type:'tab' as const,id:'canvas',component:'canvas'},{type:'tab' as const,id:'channels',component:'channels'}]}]}};
 expect(admittedPanelModel(definition).getNodeById('channels')).toBeDefined();
 const restore=installAccessPolicy(id=>({visible:id!=='panel:channels',enabled:id!=='panel:channels'}));try{
  const m=admittedPanelModel(definition);expect(m.getNodeById('channels')).toBeUndefined();expect(m.getNodeById('canvas')).toBeDefined();
  const menu=MENUS.find(m=>m.id==='window')!,items=typeof menu.items==='function'?menu.items():menu.items,channel=items.find(i=>i.type==='custom'&&i.entry==='panel:channels');expect(channel?.type).toBe('custom');if(channel?.type==='custom')expect(()=>channel.run()).not.toThrow();
 }finally{restore();}
});
