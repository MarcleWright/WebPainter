/** Final production exit decision after asynchronous document closes. */
import { editor } from './editor';
import { closeAll } from './fileOps';
import { markCleanExit } from './autosave';
import { platform, type Platform } from './platform/platform';

export async function requestApplicationClose(p: Pick<Platform, 'confirmClose'> = platform()): Promise<boolean> {
  if (!(await closeAll()) || editor.sessions.length !== 0) return false;
  // No await between the live-set check and authorizing the native close.
  markCleanExit();
  p.confirmClose();
  return true;
}
