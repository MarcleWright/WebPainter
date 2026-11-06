import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {dirname,join,resolve,basename} from 'node:path';

/** Attribute the modules actually included by Rollup, plus the checked-in LibRaw WASM source. */
export function embeddedLicenses(){
  return{name:'embedded-license-inventory',generateBundle(_options,bundle){
    const roots=new Map();
    for(const chunk of Object.values(bundle))if(chunk.type==='chunk')for(const id of Object.keys(chunk.modules)){
      if(!id.includes('node_modules'))continue;let cursor=dirname(id.split('?')[0]);
      while(dirname(cursor)!==cursor){const file=join(cursor,'package.json');if(existsSync(file)){try{const pkg=JSON.parse(readFileSync(file,'utf8'));if(pkg.name&&pkg.version){roots.set(cursor,pkg);break;}}catch{/* Non-package generated metadata. */}}cursor=dirname(cursor);}
    }
    const packages=[];
    for(const [directory,pkg] of [...roots].sort((a,b)=>a[1].name.localeCompare(b[1].name))){
      const key=(pkg.name+'@'+pkg.version).replace(/[^a-zA-Z0-9._@-]/g,'_'),files=[];
      for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)))if(entry.isFile()&&/^(licen[cs]e|copying|copyright|notice)([._-]|$)/i.test(entry.name)){const fileName=`licenses/third-party/${key}/${entry.name}`;this.emitFile({type:'asset',fileName,source:readFileSync(join(directory,entry.name))});files.push(fileName);}
      packages.push({name:pkg.name,version:pkg.version,license:pkg.license??null,files});
    }
    for(const name of ['LICENSE','LICENSE-MIT','LICENSE-APACHE'])this.emitFile({type:'asset',fileName:'licenses/webpainter/'+name,source:readFileSync(resolve(name))});
    const libraw=[];for(const entry of readdirSync('third_party/libraw',{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)))if(entry.isFile()){const fileName='licenses/libraw/'+entry.name;this.emitFile({type:'asset',fileName,source:readFileSync(join('third_party/libraw',entry.name))});libraw.push(fileName);}
    const script='scripts/raw/build-libraw.ps1';if(existsSync(script))this.emitFile({type:'asset',fileName:'licenses/libraw/'+basename(script),source:readFileSync(script)});
    this.emitFile({type:'asset',fileName:'licenses/inventory.json',source:JSON.stringify({kind:'actual-bundled-module-attribution',packages,libraw,fonts:'No font files are bundled; installed-font availability is environment-dependent.'},null,2)+'\n'});
  }};
}
