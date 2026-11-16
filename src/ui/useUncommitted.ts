import {useEffect,useRef} from 'react';
import {editor} from '../app/editor';
/** Capture the session at the first edit, release only after commit/cancel has run. */
export function useUncommitted() {
  const release=useRef<(()=>void)|null>(null);
  const begin=()=>{release.current??=editor.active?.beginUncommitted()??null;};
  const end=()=>{const done=release.current;release.current=null;done?.();};
  useEffect(()=>end,[]);
  return {begin,end,active:()=>!!release.current};
}
