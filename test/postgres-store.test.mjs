import test from 'node:test';import assert from 'node:assert/strict';
import {PostgresStore} from '../lib/postgres-store.mjs';
import {databaseFixture} from '../test-support/fake-pg.mjs';

test('database store reloads committed records and serializes concurrent changes',async()=>{
 const {Client}=databaseFixture();const s=await PostgresStore.open('private-test-url',{Client});
 try{await Promise.all(Array.from({length:8},()=>s.update(x=>{x.counter=(x.counter||0)+1;})));assert.equal((await s.read()).counter,8);const copy=await s.read();copy.counter=99;assert.equal((await s.read()).counter,8);}finally{await s.close();}
 const resumed=await PostgresStore.open('private-test-url',{Client});try{assert.equal((await resumed.read()).counter,8);}finally{await resumed.close();}
});
test('second server cannot open a database already owned by another process',async()=>{
 const {Client}=databaseFixture();const s=await PostgresStore.open('private-test-url',{Client});try{await assert.rejects(()=>PostgresStore.open('private-test-url',{Client}),/another|one instance/i);await s.update(x=>{x.counter=1;});assert.equal((await s.read()).counter,1);}finally{await s.close();}
});
test('failed mutation leaves committed state unchanged and does not poison healthy storage',async()=>{
 const {Client}=databaseFixture();const s=await PostgresStore.open('private-test-url',{Client});try{await s.update(x=>{x.counter=1;});await assert.rejects(()=>s.update(x=>{x.counter=9;throw Error('Invalid change');}),/Invalid change/);assert.equal((await s.read()).counter,1);await s.update(x=>{x.counter++;});assert.equal((await s.read()).counter,2);}finally{await s.close();}
});
test('lost database write acknowledgement fails closed without exposing provider details',async()=>{
 const {Client,db}=databaseFixture();const s=await PostgresStore.open('private-test-url',{Client});try{db.failWrite=true;await assert.rejects(()=>s.update(x=>{x.counter=1;}),e=>/storage unavailable/i.test(e.message)&&!e.message.includes('private connection'));db.failWrite=false;await assert.rejects(()=>s.read(),/storage unavailable/i);await assert.rejects(()=>s.update(x=>{x.counter=2;}),/storage unavailable/i);}finally{await s.close();}
});
test('idle connection loss blocks stale reads and future writes',async()=>{
 const {Client,db}=databaseFixture();const s=await PostgresStore.open('private-test-url',{Client});try{db.clients[0].emit('error',Error('socket lost'));await assert.rejects(()=>s.read(),/storage unavailable/i);await assert.rejects(()=>s.update(x=>{x.counter=1;}),/storage unavailable/i);}finally{await s.close();}
});

test('a failed read probe blocks cached financial state before a socket error arrives',async()=>{
 const {Client,db}=databaseFixture();const s=await PostgresStore.open('private-test-url',{Client});try{await s.update(x=>{x.projects.test={orderId:'ORDER-1'};});db.clients[0].query=async()=>{throw Error('No socket event yet');};await assert.rejects(()=>s.read(),/storage unavailable/i);await assert.rejects(()=>s.update(x=>{x.counter=1;}),/storage unavailable/i);}finally{await s.close();}
});

test('commit followed by lost acknowledgement fails closed and reloads committed payment IDs on restart',async()=>{
 const {Client,db}=databaseFixture();const s=await PostgresStore.open('private-test-url',{Client});db.loseWriteAck=true;await assert.rejects(()=>s.update(x=>{x.projects.test={orderId:'ORDER-1',captureId:'CAPTURE-1',digest:'agreed-terms'};}),/storage unavailable/i);await assert.rejects(()=>s.read(),/storage unavailable/i);await s.close();db.loseWriteAck=false;const resumed=await PostgresStore.open('private-test-url',{Client});try{assert.deepEqual((await resumed.read()).projects.test,{orderId:'ORDER-1',captureId:'CAPTURE-1',digest:'agreed-terms'});}finally{await resumed.close();}
});
test('opt-in takeover ends the previous owner, which then fails closed; default still refuses',async()=>{
 const {Client}=databaseFixture();const old=await PostgresStore.open('private-test-url',{Client});
 await assert.rejects(()=>PostgresStore.open('private-test-url',{Client}),/another|one instance/i);
 const next=await PostgresStore.open('private-test-url',{Client,takeover:true,sleep:async()=>{}});
 try{await next.update(x=>{x.counter=5;});assert.equal((await next.read()).counter,5);
  await assert.rejects(()=>old.read(),/storage unavailable/i);await assert.rejects(()=>old.update(x=>{x.counter=9;}),/storage unavailable/i);
  assert.equal((await next.read()).counter,5);}
 finally{await next.close();await old.close();}});
