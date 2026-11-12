import {Client} from 'pg';import {randomUUID} from 'node:crypto';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import {PostgresStore} from '../lib/postgres-store.mjs';
import {Service} from '../lib/service.mjs';import {DemoPayPal} from '../lib/paypal.mjs';import {DemoAI} from '../lib/ai.mjs';

// A fresh, isolated schema avoids touching the application's stored records.
export async function checkStorage(connectionString){
 if(!connectionString)throw Error('Set STORAGE_CHECK_DATABASE_URL to a test database connection URL.');
 const schema='scopepay_check_'+randomUUID().replaceAll('-','');
 const admin=new Client({connectionString,connectionTimeoutMillis:10000,query_timeout:15000});let store,resumed,created=false;
 class TestClient extends Client{constructor(options){super({...options,options:`-c search_path=${schema}`});}}
 try{
  await admin.connect();await admin.query(`CREATE SCHEMA ${schema}`);created=true;
  store=await PostgresStore.open(connectionString,{Client:TestClient});
  await Promise.all(Array.from({length:8},()=>store.update(x=>{x.counter=(x.counter||0)+1;})));
  assert.equal((await store.read()).counter,8);
  await assert.rejects(()=>PostgresStore.open(connectionString,{Client:TestClient}),/another|one instance/i);
  await assert.rejects(()=>store.update(x=>{x.counter=99;throw Error('Reject this mutation');}),/Reject this mutation/);
  assert.equal((await store.read()).counter,8);
  const gateway=new DemoPayPal({store});const service=new Service(store,{ai:new DemoAI(),paypal:gateway});
  const project=await service.create({title:'Storage verification',scope:'Appointment booking is excluded.',request:'Add appointment booking.'});
  const analysis=await service.analyze(project.id);const item=analysis.items.find(i=>i.classification==='additional');assert.ok(item);
  const offer=await service.publish(project.id,{message:'Test only',items:[{id:item.id,price:'180',approved:true}],included:[],exclusions:[],timing:'Test only'});
  const consent=await service.consent(project.token,{ids:[item.id],agreed:true,offerDigest:offer.digest});const order=await service.order(project.token,consent.digest);
  const paid=await service.capture(project.token,order.orderId,consent.digest);assert.equal(paid.status,'paid');
  await store.close();store=null;
  resumed=await PostgresStore.open(connectionString,{Client:TestClient});assert.equal((await resumed.read()).counter,8);
  const resumedGateway=new DemoPayPal({store:resumed});const resumedService=new Service(resumed,{ai:new DemoAI(),paypal:resumedGateway});
  const record=await resumedService.client(project.token);assert.equal(record.payment.captureId,paid.captureId);assert.equal(record.payment.digest,consent.digest);
  assert.equal((await resumedService.capture(project.token,order.orderId,consent.digest)).status,'paid');assert.equal(resumedGateway.captureCalls,0);
  return {ok:true,checks:['concurrent updates','exclusive process lock','rejected mutation isolation','restart persistence','demo payment IDs persist; repeat callback does not recapture']};
 }finally{
  await store?.close();await resumed?.close();
  if(created)await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const r=await checkStorage(process.env.STORAGE_CHECK_DATABASE_URL);console.log('Real PostgreSQL checks passed: '+r.checks.join(', ')+'. Test schema removed.');}
 catch{console.error('Storage check failed. Check the private database URL, network access and database status. No provider details printed.');process.exitCode=1;}
}
