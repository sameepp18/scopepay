import {readFile} from 'node:fs/promises';import {parseEnv} from 'node:util';import {resolve} from 'node:path';
export async function loadConfig(dir=process.cwd(),environment=process.env){let values={};for(const name of ['.env','.env.local']){try{Object.assign(values,parseEnv(await readFile(resolve(dir,name),'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}}Object.assign(values,environment);
 const c={port:Number(values.PORT||3000),host:values.HOST||(values.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1'),dataDir:resolve(dir,values.DATA_DIR||'data'),deskKey:values.DESK_KEY||'',publicUrl:values.PUBLIC_URL||values.RENDER_EXTERNAL_URL||'',production:values.NODE_ENV==='production',aiMode:values.AI_MODE||'demo',paypalMode:values.PAYPAL_MODE||'demo',clientId:values.PAYPAL_CLIENT_ID||'',secret:values.PAYPAL_CLIENT_SECRET||'',webhookId:values.PAYPAL_WEBHOOK_ID||'',anthropicKey:values.ANTHROPIC_API_KEY||'',anthropicVersion:values.ANTHROPIC_VERSION||'2023-06-01',model:values.ANTHROPIC_MODEL||'claude-haiku-4-5-20251001',maxAiPerDay:Number(values.MAX_AI_PER_DAY||150)};
 c.databaseUrl=values.DATABASE_URL||'';
 const requestedStorage=values.STORAGE_MODE||'auto';
 if(!['auto','file','postgres'].includes(requestedStorage))throw new Error('Use STORAGE_MODE=auto|file|postgres');
 c.storageMode=requestedStorage==='auto'?(c.databaseUrl?'postgres':'file'):requestedStorage;
 if(c.storageMode==='postgres'&&!c.databaseUrl)throw new Error('Postgres storage requires DATABASE_URL; refusing empty file fallback');
 if(c.storageMode==='file'&&c.databaseUrl)throw new Error('File storage conflicts with DATABASE_URL; choose the intended storage explicitly');
 if(!['demo','live'].includes(c.aiMode)||!['demo','sandbox'].includes(c.paypalMode))throw new Error('Use AI_MODE=demo|live and PAYPAL_MODE=demo|sandbox');
 if(c.production&&(!c.publicUrl.startsWith('https://')||c.deskKey.length<24))throw new Error('Production requires HTTPS PUBLIC_URL and DESK_KEY of at least 24 characters');
 if(c.host!=='127.0.0.1'&&c.deskKey.length<24)throw new Error('A non-local server requires DESK_KEY of at least 24 characters');return c;
}
