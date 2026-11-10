import { mkdir,readFile,writeFile,rename,unlink,open } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export class Store {
 static async open(dir){
 await mkdir(dir,{recursive:true});const lock=join(dir,'scopepay.lock');let handle;
 try{handle=await open(lock,'wx',0o600);}catch(e){if(e.code!=='EEXIST')throw e;let alive=true;
 try{const pid=Number(await readFile(lock,'utf8'));try{process.kill(pid,0);}catch(x){if(x.code==='ESRCH')alive=false;}}catch{}
 if(alive)throw new Error('Data directory is locked by another server. Run only one instance.');await unlink(lock);handle=await open(lock,'wx',0o600);}
 await handle.writeFile(String(process.pid));await handle.close();
 const s=new Store();s.dir=dir;s.file=join(dir,'state.json');s.lock=lock;s.queue=Promise.resolve();
 try{s.state=JSON.parse(await readFile(s.file,'utf8'));}catch(e){if(e.code!=='ENOENT'){await unlink(lock);throw e;}s.state={projects:{},events:[]};}
 return s;
 }
 async read(){await this.queue;return structuredClone(this.state);}
 update(fn){const run=this.queue.then(async()=>{const next=structuredClone(this.state);const result=await fn(next);const temp=join(this.dir,`state-${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify(next),{mode:0o600});await rename(temp,this.file);this.state=next;return structuredClone(result);});this.queue=run.catch(()=>{});return run;}
 async close(){await this.queue;await unlink(this.lock).catch(()=>{});}
}
