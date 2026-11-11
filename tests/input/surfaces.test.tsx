// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach,expect,it} from 'vitest';
import {Toolbar} from '../../src/ui/Toolbar';
import {MenuBar} from '../../src/ui/menu/Menu';
import {keymap} from '../../src/app/shortcuts';
import {ui,useApp} from '../../src/app/store';
import {inputSession,clearInputSessions} from './fixture';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,container:HTMLDivElement;
afterEach(async()=>{await act(async()=>root?.unmount());container?.remove();clearInputSessions();keymap.reset();});
it('real toolbar and menu hints update after rebinding/removal, and color clicks use protected actions',async()=>{
 const {session}=inputSession();keymap.reset();container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>root.render(<><Toolbar/><MenuBar/></>));
 await act(async()=>{keymap.set('color.reset',['F6']);keymap.set('color.swap',[]);keymap.set('select.quickMask',['F7']);keymap.set('edit.commandPalette',['F8']);});
 expect(container.querySelector('[title="Default colors (F6)"]')).not.toBeNull();
 expect(container.querySelector('[title="Swap colors"]')).not.toBeNull();
 expect(container.querySelector('[title="Edit in Quick Mask Mode (F7)"]')).not.toBeNull();
 expect(container.querySelector('[title="Search commands (F8)"]')).not.toBeNull();
 const fg={r:.2,g:.3,b:.4},bg={r:.6,g:.7,b:.8};await act(async()=>ui.set({fg,bg}));session.editProtected=true;
 await act(async()=>container.querySelector<HTMLButtonElement>('[title="Swap colors"]')!.click());expect(useApp.getState().fg).toEqual(fg);
 session.editProtected=false;await act(async()=>container.querySelector<HTMLButtonElement>('[title="Swap colors"]')!.click());expect(useApp.getState().fg).toEqual(bg);
});
