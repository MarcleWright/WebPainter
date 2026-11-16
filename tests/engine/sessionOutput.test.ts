import {expect,it} from 'vitest';
import {DocumentSession} from '../../src/app/session';
import {newDoc} from '../helpers/build';
it('output ownership requires the original reservation and is invalid after release, replacement or disposal',()=>{
 const s=new DocumentSession(newDoc(8,8)),wrong=Symbol('unrelated');
 expect(s.ownsOutput(wrong)).toBe(false);
 const first=s.reserveOutput(Promise.resolve(true))!;
 expect(s.ownsOutput(first)).toBe(true);expect(s.ownsOutput(wrong)).toBe(false);expect(s.canEdit()).toBe(true);
 s.releaseOutput(wrong);expect(s.ownsOutput(first)).toBe(true);
 s.releaseOutput(first);expect(s.ownsOutput(first)).toBe(false);
 const second=s.reserveOutput(Promise.resolve(true))!;expect(s.ownsOutput(second)).toBe(true);expect(s.ownsOutput(first)).toBe(false);
 s.releaseOutput(first);expect(s.ownsOutput(second)).toBe(true);
 s.dispose();expect(s.ownsOutput(second)).toBe(false);expect(s.reserveOutput(Promise.resolve(true))).toBeNull();
 s.releaseOutput(second);expect(s.ownsOutput(second)).toBe(false);
});
