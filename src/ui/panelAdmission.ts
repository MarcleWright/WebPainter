import {Actions,Model,TabNode,type IJsonModel} from 'flexlayout-react';
import {access} from '../app/access';
/** Filter local layout surfaces, never document content. Disabled visible tabs remain inert. */
export function admittedPanelModel(json:IJsonModel):Model{
 const model=Model.fromJson(json),hidden:string[]=[];model.visitNodes(node=>{if(node instanceof TabNode){const id=node.getComponent();if(id&&id!=='canvas'&&!access('panel:'+id).visible)hidden.push(node.getId());}});
 for(const id of hidden)model.doAction(Actions.deleteTab(id));return model;
}
