/** Small request/reply channel. Unknown DTOs never dispatch to arbitrary object properties. */
export type RpcMethod = 'captureNative' | 'saveAndCapture' | 'addResource' | 'exportPsd' | 'open' | 'save' | 'capture' | 'exportPng' | 'command' | 'state' | 'close' | 'destroy' | 'readResource' | 'hostSave' | 'hostExport' | 'confirm' | 'dirty' | 'error';
const methods = new Set<RpcMethod>(['captureNative','saveAndCapture','addResource','exportPsd','open','save','capture','exportPng','command','state','close','destroy','readResource','hostSave','hostExport','confirm','dirty','error']);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
const op = (v: unknown) => record(v) && Number.isInteger(v.generation) && typeof v.operationId === 'string' && typeof v.binding === 'string';
const output = (v: unknown) => op(v) && record(v) && ['png','psd-test','wpnative','psd'].includes(String(v.format)) && v.bytes instanceof Uint8Array && v.bytes.length<=512*1024*1024 && (v.format!=='wpnative'||(typeof v.checkpoint==='string'&&(v.preview===undefined||v.preview instanceof Uint8Array)));
export function validArgs(method: RpcMethod, a: unknown): a is unknown[] {
  if (!Array.isArray(a)) return false;
  switch(method) {
    case 'open': return a.length === 2 && a.every(x => typeof x === 'string');
    case 'addResource': return a.length===1&&typeof a[0]==='string';
    case 'command': return a.length === 1 && ['undo','redo','layerViaCopy','transform'].includes(a[0]);
    case 'readResource': return a.length === 2 && op(a[0]) && typeof a[1] === 'string';
    case 'hostSave': case 'hostExport': return a.length === 1 && output(a[0]);
    case 'confirm': return a.length === 3 && typeof a[0] === 'string' && (a[1] === undefined || typeof a[1] === 'string') && Array.isArray(a[2]) && a[2].length <= 10 && a[2].every(x => typeof x === 'string');
    case 'dirty': return a.length === 1 && record(a[0]) && Number.isInteger(a[0].generation) && typeof a[0].open === 'boolean' && typeof a[0].dirty === 'boolean';
    case 'error': return a.length === 1 && record(a[0]) && Number.isInteger(a[0].generation) && typeof a[0].message === 'string';
    default: return a.length === 0;
  }
}
export function connectRpc(port: MessagePort, nonce: string, handlers: Partial<Record<RpcMethod, (...args: any[]) => unknown>>) {
  let serial = 0, disposed = false;
  const pending = new Map<number, { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  const send = (message: object) => { if (!disposed) port.postMessage({ version: 2, nonce, ...message }); };
  port.onmessage = async event => {
    const m = event.data;
    if (!record(m) || m.version !== 2 || m.nonce !== nonce || !Number.isSafeInteger(m.id)) return;
    if (m.type === 'reply') {
      const p = pending.get(m.id as number); if (!p || typeof m.ok !== 'boolean') return;
      pending.delete(m.id as number); clearTimeout(p.timer);
      if (m.ok) p.resolve(m.value); else p.reject(new Error(typeof m.error === 'string' ? m.error : 'Remote error'));
    } else if (m.type === 'request' && methods.has(m.method as RpcMethod)) {
      const method = m.method as RpcMethod, handler = Object.hasOwn(handlers, method) ? handlers[method] : undefined;
      if (!handler || !validArgs(method, m.args)) { send({ type: 'reply', id: m.id, ok: false, error: 'Invalid request' }); return; }
      try { const value = await handler(...m.args); send({ type: 'reply', id: m.id, ok: true, value }); }
      catch(e) { send({ type: 'reply', id: m.id, ok: false, error: String(e) }); }
    }
  };
  port.start();
  return {
    call(method: RpcMethod, ...args: unknown[]): Promise<any> {
      if (disposed || !validArgs(method, args)) return Promise.reject(new Error('Disposed or invalid request'));
      const id = ++serial;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`RPC timeout: ${method}`)); }, 120000);
        pending.set(id, { resolve, reject, timer }); send({ type: 'request', id, method, args });
      });
    },
    dispose() { disposed = true; port.onmessage = null; port.close(); for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('RPC disposed')); } pending.clear(); },
  };
}
