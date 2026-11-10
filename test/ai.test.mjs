import test from 'node:test';import assert from 'node:assert/strict';
import {Claude,DemoAI} from '../lib/ai.mjs';import {safeNegotiation} from '../lib/domain.mjs';
test('Claude sends server-side credentials and a structured output schema',async()=>{
 let call;const c=new Claude({key:'test-key',model:'test-model',fetch:async(url,init)=>{call={url,init};return Response.json({content:[{type:'text',text:JSON.stringify({message:'Review',items:[]})}]});}});
 await c.analyze('Scope text','Request text');const b=JSON.parse(call.init.body);assert.equal(call.url,'https://api.anthropic.com/v1/messages');assert.equal(call.init.headers['x-api-key'],'test-key');assert.equal(b.model,'test-model');assert.equal(b.output_config.format.type,'json_schema');assert.match(b.messages[0].content,/Scope text/);assert.match(b.system,/untrusted/i);
});
test('temporary model overload retries with bounded attempts',async()=>{let calls=0;const c=new Claude({key:'x',model:'test',sleep:async()=>{},fetch:async()=>++calls<3?Response.json({}, {status:529}):Response.json({content:[{type:'text',text:'{"selectedIds":[],"reply":"Please clarify","escalate":true}'}]})});await c.negotiate({items:[]},'hello',[]);assert.equal(calls,3);});
test('invalid AI key fails immediately without retrying',async()=>{let calls=0;const c=new Claude({key:'invalid',sleep:async()=>{},fetch:async()=>{calls++;return Response.json({}, {status:401});}});await assert.rejects(()=>c.analyze('a','b'),/key/i);assert.equal(calls,1);});
test('truncated model response fails clearly instead of using partial terms',async()=>{const c=new Claude({key:'x',fetch:async()=>Response.json({stop_reason:'max_tokens',content:[{type:'text',text:'{"items":'}]})});await assert.rejects(()=>c.analyze('a','b'),/incomplete|invalid/i);});
const offer={items:[{id:'booking',cents:18000},{id:'page',cents:12000}]};
test('live assistant can never invent a discounted price',()=>{const r=safeNegotiation({selectedIds:['booking'],reply:'Booking is $100.',escalate:false},offer,'Booking please');assert.equal(r.escalate,true);});
test('budget comes from explicit client wording, never model output',()=>{const r=safeNegotiation({selectedIds:['booking'],capCents:999999,reply:'Booking is $180.',escalate:false},offer,'under $100');assert.equal(r.escalate,true);assert.equal(r.capCents,10000);});
test('absence of a budget leaves it unknown',()=>{const r=safeNegotiation({selectedIds:['page'],reply:'Page is $120.',escalate:false},offer,'page instead');assert.equal(r.capCents,null);assert.equal(r.cents,12000);});
test('unknown work and discounts escalate rather than publishing a new price',async()=>{const r=await new DemoAI().negotiate(offer,'give me a discount',[]);assert.equal(r.escalate,true);});
