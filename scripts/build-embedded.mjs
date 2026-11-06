import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function files(dir) { return readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]).sort(); }
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js','build','--config','vite.embedded.config.ts'], {stdio:'inherit'});
const input = [...files('src'), 'vite.embedded.config.ts','package.json','package-lock.json'];
const sourceHash = hash(input.sort().map(p => `${p.replaceAll('\\','/')} ${hash(readFileSync(p))}\n`).join(''));
const entries = files('dist-embedded').filter(p => !p.endsWith('manifest.json')).map(p => ({path:relative('dist-embedded',p).replaceAll('\\','/'), bytes:readFileSync(p).length, sha256:hash(readFileSync(p))}));
const manifest = {portVersion:1,nativeVersion:null,mainBase:execFileSync('git',['rev-parse','main'],{encoding:'utf8'}).trim(),embeddedCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHash,uncommitted:true,bundleHash:hash(JSON.stringify(entries)),files:entries};
writeFileSync('dist-embedded/manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({bundleHash:manifest.bundleHash, sourceHash,bytes:entries.reduce((n,e)=>n+e.bytes,0)}));
