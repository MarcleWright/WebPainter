// One-command manual experiment; production startup and feature defaults stay unchanged.
import { createServer } from 'vite';
import electronPath from 'electron';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
let server;
let child;
try {
  server = await createServer({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    server: { host: '127.0.0.1', port: 6041, strictPort: false, open: false },
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  console.log(`Manual test server: ${url}`);
  console.log('F6: optimized / original; F7: medium; F8: large; F9: effects; F12: diagnostics.');
  const env = { ...process.env, TASK02_MANUAL_URL: url };
  delete env.ELECTRON_RUN_AS_NODE;
  child = spawn(electronPath, [path.join(root, 'scripts/task02/manual-host.cjs')], {
    cwd: root, env, stdio: 'inherit',
  });
  child.on('error', async (error) => {
    console.error(error);
    await server.close();
    process.exitCode = 1;
  });
  child.on('exit', async (code) => {
    await server.close();
    process.exitCode = code ?? 1;
  });
  process.once('SIGINT', () => child?.kill());
  process.once('SIGTERM', () => child?.kill());
} catch (error) {
  console.error(error);
  await server?.close();
  process.exitCode = 1;
}
