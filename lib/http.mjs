import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {randomBytes,timingSafeEqual} from 'node:crypto';
import {Store} from './store.mjs';import {Service} from './service.mjs';import {Claude,Groq,DemoAI} from './ai.mjs';import {PayPal,DemoPayPal} from './paypal.mjs';import {AppError,ensure} from './domain.mjs';
import {PostgresStore} from './postgres-store.mjs';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function body(req){let raw='';let bytes=0;for await(const chunk of req){bytes+=chunk.length;ensure(bytes<=64000,'Request is too large',413);raw+=chunk;}try{return raw?JSON.parse(raw):{};}catch{throw new AppError('Request must contain valid JSON');}}
export async function createApp(config,adapters={}){
 const store=adapters.store||(config.databaseUrl?await PostgresStore.open(config.databaseUrl):await Store.open(config.dataDir));const ai=adapters.ai||(config.aiMode==='live'?(config.aiProvider==='groq'?new Groq({key:config.groqKey,model:config.model}):new Claude({key:config.anthropicKey,model:config.model,version:config.anthropicVersion})):new DemoAI());
 const paypal=adapters.paypal||(config.paypalMode==='sandbox'?new PayPal({clientId:config.clientId,secret:config.secret,webhookId:config.webhookId}):new DemoPayPal({store}));
 const service=new Service(store,{ai,paypal});const sessions=new Map(),hits=new Map();let base,aiDay='',aiCount=0;
 function rate(key,max=80,ms=60000){const now=Date.now();const bucket=(hits.get(key)||[]).filter(t=>now-t<ms);ensure(bucket.length<max,'Too many requests. Please wait a moment.',429);bucket.push(now);hits.set(key,bucket);if(hits.size>4000)for(const [k,v]of hits)if(now-v.at(-1)>ms)hits.delete(k);}
 function authorize(req){if(!config.deskKey&&config.host==='127.0.0.1'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return;
 const token=req.headers.cookie?.match(/(?:^|;\s*)scopepay_session=([a-f0-9]+)/)?.[1];if(token&&sessions.get(token)>Date.now())return;if(equal(req.headers['x-desk-key'],config.deskKey)&&config.deskKey)return;throw new AppError('Unlock the freelancer desk first',401);}
 function aiLimit(req){rate('ai:'+req.socket.remoteAddress,8);const day=new Date().toISOString().slice(0,10);if(day!==aiDay){aiDay=day;aiCount=0;}ensure(aiCount<(config.maxAiPerDay||150),'Daily AI demo allowance reached',429);aiCount++;}
 const server=createServer(async(req,res)=>{const nonce=randomBytes(16).toString('base64');
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' 'nonce-${nonce}' https://www.paypal.com https://www.sandbox.paypal.com https://www.paypalobjects.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.paypal.com https://*.paypalobjects.com; connect-src 'self' https://*.paypal.com https://*.paypalobjects.com; frame-src https://*.paypal.com https://*.paypalobjects.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`);
 const json=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
 try{const url=new URL(req.url,'http://scopepay.local');const path=url.pathname;const allowed=new Set([new URL(base||'http://127.0.0.1').host]);if(config.publicUrl)allowed.add(new URL(config.publicUrl).host);if(config.host==='127.0.0.1'&&base)allowed.add('localhost:'+new URL(base).port);ensure(allowed.has(req.headers.host),'Unexpected request host',403);
 if(req.method==='POST'&&path!=='/api/paypal/webhook'){const allowedOrigins=[base,config.publicUrl].filter(Boolean);if(config.host==='127.0.0.1'&&base)allowedOrigins.push(base.replace('127.0.0.1','localhost'));ensure(allowedOrigins.includes(req.headers.origin),'Request origin is not allowed',403);rate('write:'+req.socket.remoteAddress);}
 if(req.method==='GET'&&path==='/healthz'){await store.read();return json({ok:true,aiMode:ai.mode,paypalMode:paypal.mode});}
 if(req.method==='GET'&&path==='/api/config')return json({aiMode:ai.mode,paypalMode:paypal.mode,model:ai.mode==='live'?config.model:null,clientId:paypal.mode==='sandbox'?config.clientId:'',deskProtected:!!config.deskKey,webhookConfigured:!!config.webhookId});
 if(req.method==='POST'&&path==='/api/desk/login'){rate('login:'+req.socket.remoteAddress,10);const data=await body(req);ensure(config.deskKey&&equal(data.key,config.deskKey),'Desk key was not accepted',401);const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+6*3600000);res.setHeader('Set-Cookie',`scopepay_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=21600${config.production?'; Secure':''}`);return json({ok:true});}
 if(path.startsWith('/api/desk/')){
 authorize(req);
 if(path==='/api/desk/projects'&&req.method==='GET')return json(await service.list());
 if(path==='/api/desk/projects'&&req.method==='POST')return json(await service.create(await body(req)),201);
 const m=path.match(/^\/api\/desk\/projects\/([a-f0-9-]+)\/(analyze|publish)$/);if(m&&req.method==='POST'){const data=await body(req);if(m[2]==='analyze'){aiLimit(req);return json(await service.analyze(m[1]));}return json(await service.publish(m[1],data));}
 }
 const client=path.match(/^\/api\/client\/([a-f0-9]{48})(?:\/(negotiate|consent|order|capture|cancel|reconcile))?$/);
 if(client){const [,token,action]=client;if(!action&&req.method==='GET')return json(await service.client(token));if(req.method==='POST'){const data=await body(req);
 if(action==='negotiate'){aiLimit(req);return json(await service.negotiate(token,data.message));}if(action==='consent')return json(await service.consent(token,data));if(action==='order')return json(await service.order(token,data.digest));if(action==='capture')return json(await service.capture(token,data.orderId,data.digest));if(action==='cancel')return json(await service.cancel(token));if(action==='reconcile')return json(await service.reconcile(token));}}
 if(path==='/api/paypal/webhook'&&req.method==='POST'){rate('webhook:'+req.socket.remoteAddress,150);return json(await service.webhook(req.headers,await body(req)));}
 if(req.method==='GET'){
 let file=path==='/'?'index.html':/^\/pay\/[a-f0-9]{48}$/.test(path)?'pay.html':null;
 const assets={'/assets/style.css':'style.css','/assets/common.js':'common.js','/assets/app.js':'app.js','/assets/pay.js':'pay.js'};file??=assets[path];
 if(file){const html=file.endsWith('.html');res.setHeader('Content-Type',html?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');const content=await readFile(root+file,'utf8');res.end(html?content.replaceAll('__NONCE__',nonce):content);return;}}
 throw new AppError('Not found',404);
 }catch(e){if(res.writableEnded)return;json({error:e instanceof AppError?e.message:'Service could not complete the request. No new payment should be assumed.',code:e.code||'service_error'},e.status||500);}
 });
 return {server,service,store,listen:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.host,()=>{base=`http://127.0.0.1:${server.address().port}`;resolve(base);});}),close:async()=>{await new Promise(r=>server.close(r));server.closeAllConnections();await store.close();}};
}
