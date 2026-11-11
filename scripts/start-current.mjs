// Launch the full desktop editor from this checkout, rather than an old renderer build.
import { createServer } from 'vite';
import electronPath from 'electron';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { realpathSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
let server;
try {
  execFileSync(process.execPath, [path.join(root, 'scripts/build-electron.mjs')], { cwd: root, stdio: 'inherit' });
  server = await createServer({
    root,
    configFile: path.join(root, 'vite.config.ts'),
    server: {
      host: '127.0.0.1', port: 6041, strictPort: false, open: false,
      // A worktree may share node_modules through a junction. WASM URLs resolve to
      // the real dependency directory; allow it without exposing sibling sources.
      fs: { allow: [root, realpathSync(path.join(root, 'node_modules'))] },
    },
  });
  await server.listen();
  const url = server.resolvedUrls.local[0];
  console.log(`Current source: ${root}`);
  console.log(`Development server: ${url}`);
  console.log('Full current-source editor; normal preferences and automatic GPU move routing.');
  const env = { ...process.env, CELENNE_DEV_SERVER_URL: url };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electronPath, [path.join(root, 'scripts/current-source-host.cjs')], { cwd: root, env, stdio: 'inherit' });
  child.on('error', async error => { console.error(error); await server.close(); process.exitCode = 1; });
  child.on('exit', async code => { await server.close(); process.exitCode = code ?? 1; });
  process.once('SIGINT', () => child.kill());
  process.once('SIGTERM', () => child.kill());
} catch (error) {
  console.error(error);
  await server?.close();
  process.exitCode = 1;
}
