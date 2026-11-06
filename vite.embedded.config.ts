import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import pkg from './package.json' with { type: 'json' };
import {embeddedLicenses} from './scripts/embedded-licenses.mjs';
export default defineConfig({
  plugins: [react(),embeddedLicenses()], base: './', define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  worker: { format: 'es' }, optimizeDeps: { exclude: ['lcms-wasm'] },
  build: { outDir: 'dist-embedded', target: 'es2022', sourcemap: false,
    rollupOptions: { preserveEntrySignatures: 'strict', input: { client: resolve('src/embedded/client.ts'), frame: resolve('embedded.html'), standalone: resolve('standalone-probe.html') },
      output: { entryFileNames: '[name].js' } }, chunkSizeWarningLimit: 4000 },
});
