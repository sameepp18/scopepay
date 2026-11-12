import test from 'node:test';import assert from 'node:assert/strict';
import {Claude,Groq,DemoAI} from '../lib/ai.mjs';import {safeNegotiation} from '../lib/domain.mjs';
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
const groqReply=content=>Response.json({choices:[{finish_reason:'stop',message:{content:typeof content==='string'?content:JSON.stringify(content)}}]});
test('Groq sends a strict JSON schema to the OpenAI-compatible endpoint with server-side key',async()=>{
 let call;const g=new Groq({key:'test-key',fetch:async(url,init)=>{call={url,init};return groqReply({message:'Review',items:[]});}});
 const out=await g.analyze('Scope text','Request text');assert.deepEqual(out,{message:'Review',items:[]});
 const b=JSON.parse(call.init.body);assert.equal(call.url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(call.init.headers.Authorization,'Bearer test-key');
 assert.equal(b.model,'openai/gpt-oss-120b');assert.equal(b.response_format.type,'json_schema');assert.equal(b.response_format.json_schema.strict,true);assert.deepEqual(b.response_format.json_schema.schema.required,['message','items']);
 assert.equal(b.messages[0].role,'system');assert.deepEqual(JSON.parse(b.messages[1].content),{scope:'Scope text',request:'Request text'});assert.equal(g.mode,'live');});
test('Groq falls back to JSON mode when a model rejects strict schemas, and retries schema failures',async()=>{
 const bodies=[];let n=0;const g=new Groq({key:'k',sleep:async()=>{},fetch:async(url,init)=>{bodies.push(JSON.parse(init.body));n++;
  if(n===1)return Response.json({error:{code:'invalid_request_error',message:'response_format json_schema not supported'}},{status:400});
  if(n===2)return Response.json({error:{code:'json_validate_failed'}},{status:400});
  return groqReply({selectedIds:[],reply:'ok',escalate:false});}});
 const r=await g.negotiate({items:[]},'hi',[]);assert.equal(r.reply,'ok');assert.equal(bodies[1].response_format.type,'json_object');assert.match(bodies[1].messages[0].content,/JSON Schema/);});
test('Groq: rejected key fails at once; truncated or invalid output never becomes terms',async()=>{
 let calls=0;const bad=new Groq({key:'x',sleep:async()=>{},fetch:async()=>{calls++;return Response.json({}, {status:401});}});await assert.rejects(bad.analyze('s','r'),/Groq API key was rejected/);assert.equal(calls,1);
 const cut=new Groq({key:'x',fetch:async()=>Response.json({choices:[{finish_reason:'length',message:{content:'{"items":'}}]})});await assert.rejects(cut.analyze('s','r'),/incomplete/);
 const junk=new Groq({key:'x',sleep:async()=>{},fetch:async()=>groqReply('not json')});await assert.rejects(junk.analyze('s','r'),/invalid or incomplete/);});
