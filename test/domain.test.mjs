import test from 'node:test';
import assert from 'node:assert/strict';
import { money, validateAnalysis, validateOffer, selectPackage, fingerprint } from '../lib/domain.mjs';
import { Store } from '../lib/store.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scope = 'One landing page. Two headline revisions. Booking and extra pages are excluded.';
const request = 'Change the headline and add booking.';
const addition = {id:'booking', title:'Appointment booking', classification:'additional', scopeQuote:'Booking and extra pages are excluded.', requestQuote:'add booking', reason:'Explicitly excluded'};
const offer = () => ({message:'Booking is additional. The headline stays included.',items:[{...addition,price:'180.00',approved:true}],included:['Headline revision'],exclusions:['Second page'],timing:'Schedule agreed separately'});

test('money uses exact cents and rejects fractional cents, signs and exponent notation',()=>{
 assert.equal(money('180.01'),18001);
 for(const v of ['1.001','-1','1e2','NaN','','9999999999']) assert.throws(()=>money(v));
});
test('analysis verifies both quotes for a billable addition',()=>{
 const a=validateAnalysis({message:'Review this',items:[addition]},scope,request);
 assert.equal(a.items[0].verified,true); assert.equal(a.items[0].classification,'additional');
});
test('fabricated scope evidence downgrades additions and clears verification',()=>{
 const a=validateAnalysis({items:[{...addition,scopeQuote:'Booking costs extra'}]},scope,request);
 assert.equal(a.items[0].classification,'decision'); assert.equal(a.items[0].verified,false);
});
test('empty quotes cannot verify an addition',()=>assert.equal(validateAnalysis({items:[{...addition,scopeQuote:''}]},scope,request).items[0].classification,'decision'));
test('publishing cannot bill an unverified AI finding',()=>assert.throws(()=>validateOffer(offer(),{items:[{...addition,verified:false}]})));
test('reviewed offer publishes exact integer cents',()=>{
 const o=validateOffer(offer(),{items:[{...addition,verified:true}]}); assert.equal(o.items[0].cents,18000);
});
test('price is selected from approved offer and optional budget is enforced',()=>{
 const o=validateOffer(offer(),{items:[{...addition,verified:true}]});
 assert.equal(selectPackage(o,['booking'],null).cents,18000);
 assert.equal(selectPackage(o,['booking'],20000).cents,18000);
 assert.throws(()=>selectPackage(o,['booking'],10000));
});
test('unknown and duplicated item identifiers are rejected',()=>{
 const o=validateOffer(offer(),{items:[{...addition,verified:true}]});
 assert.throws(()=>selectPackage(o,['invented'])); assert.throws(()=>selectPackage(o,['booking','booking']));
});
test('fingerprint is stable with key order and changes with price',()=>{
 assert.equal(fingerprint({a:1,b:2}),fingerprint({b:2,a:1}));
 assert.notEqual(fingerprint({cents:18000}),fingerprint({cents:12000}));
});
test('atomic store survives restart and serializes concurrent writes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'scopepay-'));
 try {const s=await Store.open(dir); await Promise.all(Array.from({length:8},()=>s.update(x=>{x.counter=(x.counter||0)+1;})));
 assert.equal((await s.read()).counter,8); await s.close(); const s2=await Store.open(dir); assert.equal((await s2.read()).counter,8); await s2.close();}
 finally {await rm(dir,{recursive:true,force:true});}
});
