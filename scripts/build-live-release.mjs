import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)), output=path.join(root,'dist/web-live');
const manifest=JSON.parse(await readFile(path.join(root,'build-manifest.json'),'utf8'));
const files=new Set(manifest.files.map(entry=>entry.path));
for(const file of ['deployment-mode.mjs','live-session.mjs','landing-creation.mjs','landing-family-videos.mjs','family-presentation.mjs','studio-family-data.mjs','assets/studio-family-artwork.svg','compat/web-naming/landing-handoff.mjs'])files.add(file);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
const entries=[];
for(const name of [...files].sort()){
 if(typeof name!=='string'||path.isAbsolute(name)||name.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('invalid_runtime_manifest');
 let data=await readFile(path.join(root,name));
 if(name==='deployment-mode.mjs')data=Buffer.from('export const LIVE_WEB = true;\n');
 await mkdir(path.dirname(path.join(output,name)),{recursive:true});await writeFile(path.join(output,name),data);
 entries.push({path:name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
}
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty=!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
await writeFile(path.join(output,'build-manifest.json'),JSON.stringify({format:'knok-web-native/v1',sourceCommit,dirty,mode:'live',files:entries},null,2)+'\n');
console.log(JSON.stringify({sourceCommit,dirty,mode:'live',output:'dist/web-live',files:entries.length}));
