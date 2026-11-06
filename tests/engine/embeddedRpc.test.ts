import { expect, it } from 'vitest';
import { connectRpc } from '../../src/embedded/rpc';

it('correlates reverse replies, rejects malformed calls and releases pending requests', async () => {
  const channel = new MessageChannel();
  let first!: (value: string) => void;
  const server = connectRpc(channel.port1, 'nonce', { open: binding => binding === 'slow' ? new Promise(r => first = r) : binding });
  const client = connectRpc(channel.port2, 'nonce', {});
  try {
    const slow = client.call('open','slow','token');
    expect(await client.call('open','fast','token')).toBe('fast'); first('slow'); expect(await slow).toBe('slow');
    await expect(client.call('command','constructor')).rejects.toThrow('invalid');
    const pending = client.call('open','slow','token'); client.dispose(); await expect(pending).rejects.toThrow('disposed');
  } finally { client.dispose(); server.dispose(); }
});
it('ignores wrong nonce and malformed method packets before dispatch', async () => {
  const channel = new MessageChannel(); let calls = 0;
  const server = connectRpc(channel.port1, 'current', { close: () => { calls++; return true; } });
  channel.port2.postMessage({ version:2, nonce:'old', id:1, type:'request', method:'close', args:[] });
  channel.port2.postMessage({ version:2, nonce:'current', id:2, type:'request', method:'constructor', args:[] });
  const client = connectRpc(channel.port2, 'current', {});
  try { expect(await client.call('close')).toBe(true); expect(calls).toBe(1); }
  finally { client.dispose(); server.dispose(); }
});
