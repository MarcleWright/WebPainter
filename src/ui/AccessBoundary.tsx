import type {ReactNode,SyntheticEvent} from 'react';
import {access} from '../app/access';
/** Blocks direct panel events as well as native form controls; hiding is independent. */
export function AccessBoundary({entry,children}:{entry:string;children:ReactNode}){
  const state=access(entry);if(!state.visible)return null;
  const stop=(event:SyntheticEvent)=>{if(!state.enabled){event.preventDefault();event.stopPropagation();}};
  return <div style={{display:'contents'}} inert={!state.enabled} aria-disabled={!state.enabled} onClickCapture={stop} onDoubleClickCapture={stop} onContextMenuCapture={stop} onPointerDownCapture={stop} onMouseDownCapture={stop} onKeyDownCapture={stop} onChangeCapture={stop} onInputCapture={stop} onDragStartCapture={stop} onDropCapture={stop}><fieldset disabled={!state.enabled} style={{display:'contents'}}>{children}</fieldset></div>;
}
