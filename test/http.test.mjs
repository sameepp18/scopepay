import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createApp} from '../lib/http.mjs';
async function fixture(t,deskKey=''){
 const dir=await mkdtemp(join(tmpdir(),'scopepay-http-'));const app=await createApp({dataDir:dir,host:'127.0.0.1',port:0,deskKey,aiMode:'demo',paypalMode:'demo',clientId:'public-test-client',secret:'SECRET-MUST-NOT-LEAK',model:'test',maxAiPerDay:100});
 const base=await app.listen();t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 const post=(path,data,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...headers},body:JSON.stringify(data)});return {base,post,app};
}
test('health and configuration expose modes but no private credentials',async t=>{const {base}=await fixture(t);const r=await fetch(base+'/api/config');assert.equal(r.status,200);const j=await r.json();assert.equal(j.paypalMode,'demo');assert.ok(!JSON.stringify(j).includes('SECRET'));assert.equal((await fetch(base+'/healthz')).status,200);});
test('desk endpoints require a configured desk key even on localhost',async t=>{const {base,post}=await fixture(t,'a'.repeat(32));assert.equal((await fetch(base+'/api/desk/projects')).status,401);const r=await post('/api/desk/login',{key:'a'.repeat(32)});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly/);});
test('cross-origin writes are rejected before any action',async t=>{const {post}=await fixture(t);const r=await post('/api/desk/projects',{title:'bad',scope:'x',request:'y'},{Origin:'https://attacker.example'});assert.equal(r.status,403);});
test('private environment files and unknown static paths are never served',async t=>{const {base}=await fixture(t);assert.equal((await fetch(base+'/.env.local')).status,404);assert.equal((await fetch(base+'/assets/../server.mjs')).status,404);});
test('oversized body is rejected',async t=>{const {post}=await fixture(t);assert.equal((await post('/api/desk/projects',{scope:'a'.repeat(100000)})).status,413);});
test('both product pages render without a build step',async t=>{const {base}=await fixture(t);assert.match(await (await fetch(base+'/')).text(),/Freelancer desk/);assert.match(await (await fetch(base+'/pay/'+'a'.repeat(48))).text(),/Review your changes/);});
test('complete HTTP demo flow compares, publishes, negotiates, consents and pays',async t=>{const {post,base}=await fixture(t);
 const p=await (await post('/api/desk/projects',{title:'Site',scope:'Headline revisions are included. Booking is excluded.',request:'Change headline and add booking.'})).json();
 let r=await post(`/api/desk/projects/${p.id}/analyze`,{});assert.equal(r.status,200);const analysis=await r.json();const item=analysis.items.find(i=>i.classification==='additional');assert.ok(item);
 r=await post(`/api/desk/projects/${p.id}/publish`,{message:analysis.message,items:[{id:item.id,title:item.title,price:'180',approved:true}],included:['Headline'],exclusions:[],timing:'Next week'});assert.equal(r.status,200);
 assert.equal((await fetch(base+'/api/client/'+'b'.repeat(48))).status,404);
 r=await post(`/api/client/${p.token}/negotiate`,{message:'under $200, booking matters most'});assert.equal((await r.json()).cents,18000);
 const snap=await (await post(`/api/client/${p.token}/consent`,{ids:[item.id],agreed:true,capCents:20000})).json();
 const order=await (await post(`/api/client/${p.token}/order`,{digest:snap.digest,amount:'0.01'})).json();
 const paid=await (await post(`/api/client/${p.token}/capture`,{orderId:order.orderId,digest:snap.digest})).json();assert.equal(paid.status,'paid');assert.equal(paid.cents,18000);
 const view=await (await fetch(base+'/api/client/'+p.token)).json();assert.equal(view.payment.status,'paid');assert.ok(!JSON.stringify(view).includes('SECRET'));
});
