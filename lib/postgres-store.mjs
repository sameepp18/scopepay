import {AppError} from './domain.mjs';

const unavailable=()=>new AppError('Database storage unavailable. Check database health and restart the server before continuing.',503,'storage_unavailable');

// One locked session owns the prototype state. A lost session/write fails closed;
// restarting must reload committed state before any payment may proceed.
export class PostgresStore {
 static async open(connectionString,{Client,takeover=false,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  Client??=(await import('pg')).Client;
  const s=new PostgresStore();s.queue=Promise.resolve();s.client=new Client({connectionString,connectionTimeoutMillis:10000,query_timeout:15000,keepAlive:true});
  s.client.on('error',()=>{s.failed=true;});
  s.client.on('end',()=>{if(!s.closed)s.failed=true;});
  let conflict=false;
  try{
   await s.client.connect();
   let lock=await s.client.query('SELECT pg_try_advisory_lock($1, $2) AS locked',[1396920144,1162887513]);
   // Opt-in takeover for hosts that overlap old and new servers during a deploy
   // (DB_LOCK_TAKEOVER=on): end the previous owner's session, which makes that
   // server fail closed, then claim the lock. Still exactly one owner at a time.
   if(lock.rows[0]?.locked!==true&&takeover){
    for(let attempt=0;attempt<10&&lock.rows[0]?.locked!==true;attempt++){
     await s.client.query("SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype='advisory' AND classid=$1 AND objid=$2 AND granted AND pid<>pg_backend_pid()",[1396920144,1162887513]);
     await sleep(500);
     lock=await s.client.query('SELECT pg_try_advisory_lock($1, $2) AS locked',[1396920144,1162887513]);
    }
   }
   if(lock.rows[0]?.locked!==true){conflict=true;throw Error('Another server owns this database. Run only one instance.');}
   await s.client.query('CREATE TABLE IF NOT EXISTS scopepay_state (id text PRIMARY KEY, state jsonb NOT NULL)');
   await s.client.query("INSERT INTO scopepay_state (id,state) VALUES ('main',$1::jsonb) ON CONFLICT (id) DO NOTHING",[JSON.stringify({projects:{},events:[]})]);
   const result=await s.client.query("SELECT state FROM scopepay_state WHERE id='main'");
   s.state=result.rows[0]?.state;
   if(!s.state?.projects||!Array.isArray(s.state.events))throw Error('Invalid saved state');
   s.healthy();return s;
  }catch{
   await s.client.end().catch(()=>{});
   if(conflict)throw new Error('Another server owns this database. Run only one instance.');
   throw unavailable();
  }
 }
 healthy(){if(this.failed||this.closed)throw unavailable();}
 read(){
  const run=this.queue.then(async()=>{
   this.healthy();
   try{
    const result=await this.client.query("SELECT state FROM scopepay_state WHERE id='main'");
    if(!result.rows[0]?.state?.projects||!Array.isArray(result.rows[0].state.events))throw Error('Invalid saved state');
    this.healthy();this.state=result.rows[0].state;return structuredClone(this.state);
   }catch{this.failed=true;throw unavailable();}
  });
  this.queue=run.catch(()=>{});return run;
 }
 update(fn){
  const run=this.queue.then(async()=>{
   this.healthy();const next=structuredClone(this.state);const result=await fn(next);this.healthy();
   try{
    const saved=await this.client.query("UPDATE scopepay_state SET state=$1::jsonb WHERE id='main'",[JSON.stringify(next)]);
    if(saved.rowCount!==1)throw Error('Missing state row');
    this.healthy();this.state=next;return structuredClone(result);
   }catch{this.failed=true;throw unavailable();}
  });
  this.queue=run.catch(()=>{});return run;
 }
 async close(){if(this.closed)return;await this.queue;this.closed=true;await this.client.end().catch(()=>{});}
}
