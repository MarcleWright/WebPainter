import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { build } from 'esbuild';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function files(dir) { return readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]).sort(); }
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js','build','--config','vite.embedded.config.ts'], {stdio:'inherit'});
// A self-contained ESM codec also loads inside the host's CommonJS Electron package.
// It contains data/validation only, never an active editor, UI or desktop boot.
await build({entryPoints:['src/document/native.ts'],outfile:'dist-embedded/native.mjs',bundle:true,format:'esm',platform:'neutral',target:'es2022',minify:true,sourcemap:false});
const input = [...files('src'),...files('third_party/libraw'),'LICENSE','LICENSE-MIT','LICENSE-APACHE','scripts/raw/build-libraw.ps1','scripts/embedded-licenses.mjs', 'vite.embedded.config.ts','scripts/build-embedded.mjs','package.json','package-lock.json'];
const sourceHash = hash(input.sort().map(p => `${p.replaceAll('\\','/')} ${hash(readFileSync(p))}\n`).join(''));
const entries = files('dist-embedded').filter(p => !p.endsWith('manifest.json')).map(p => ({path:relative('dist-embedded',p).replaceAll('\\','/'), bytes:readFileSync(p).length, sha256:hash(readFileSync(p))}));
// Report the actual build worktree. A later commit must never relabel an old bundle.
const uncommitted = !!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
const manifest = {portVersion:3,nativeVersion:1,mainBase:execFileSync('git',['merge-base','main','HEAD'],{encoding:'utf8'}).trim(),embeddedCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHash,uncommitted,bundleHash:hash(JSON.stringify(entries)),files:entries};
writeFileSync('dist-embedded/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({bundleHash:manifest.bundleHash, sourceHash,bytes:entries.reduce((n,e)=>n+e.bytes,0)}));
