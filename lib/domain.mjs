import { createHash } from 'node:crypto';
export class AppError extends Error { constructor(message,status=400,code='invalid_request'){super(message);this.status=status;this.code=code;} }
export function ensure(ok,message,status=400,code){if(!ok)throw new AppError(message,status,code);}
export function text(value,max=12000){ensure(typeof value==='string'&&value.trim().length>0&&value.length<=max,'Text is missing or too long');return value.trim();}
export function money(value){const s=String(value);ensure(/^\d{1,6}(\.\d{1,2})?$/.test(s),'Use a positive USD amount with at most two decimal places');const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));ensure(n>0&&n<=10000000,'Amount must be between $0.01 and $100,000');return n;}
export const dollars=n=>(n/100).toFixed(2);
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
export const fingerprint=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
export function validateAnalysis(raw,scope,request){
 ensure(raw&&Array.isArray(raw.items)&&raw.items.length>0&&raw.items.length<=12,'AI returned an invalid analysis',502);
 const ids=new Set();return {message:typeof raw.message==='string'?raw.message.slice(0,3000):'Please review these findings.',items:raw.items.map((x,i)=>{
 const id=/^[a-z0-9_-]{1,40}$/i.test(x.id||'')?x.id:`item-${i+1}`;ensure(!ids.has(id),'AI repeated an item ID',502);ids.add(id);
 const sq=typeof x.scopeQuote==='string'?x.scopeQuote:'',rq=typeof x.requestQuote==='string'?x.requestQuote:'';
 const verified=!!sq.trim()&&!!rq.trim()&&scope.includes(sq)&&request.includes(rq);
 let classification=['included','additional','decision'].includes(x.classification)?x.classification:'decision';
 if(!verified)classification='decision';
 return {id,title:text(x.title,180),classification,scopeQuote:sq.slice(0,2000),requestQuote:rq.slice(0,2000),reason:String(x.reason||'Review this finding').slice(0,1000),verified};
 })};
}
export function validateOffer(input,analysis){
 ensure(input&&Array.isArray(input.items)&&input.items.length<=4,'Publish at most four additional items');
 const ids=new Set();const items=input.items.map(x=>{const a=analysis.items.find(a=>a.id===x.id);
 ensure(a?.verified&&a.classification==='additional','Only source-verified additional work can be billed');ensure(x.approved===true,'Review every additional item before publishing');ensure(!ids.has(x.id),'Duplicate offer item');ids.add(x.id);
 return {id:x.id,title:text(x.title||a.title,180),description:String(x.description||a.reason).slice(0,1000),cents:money(x.price),scopeQuote:a.scopeQuote,requestQuote:a.requestQuote};});
 return {message:text(input.message,3000),items,included:(input.included||[]).map(x=>text(x,200)).slice(0,12),exclusions:(input.exclusions||[]).map(x=>text(x,200)).slice(0,12),timing:text(input.timing||'Delivery timing will be confirmed separately.',500),currency:'USD',paymentTerms:'Payment is collected now for the selected additional work. This is not escrow.'};
}
export function selectPackage(offer,ids,capCents=null){
 ensure(Array.isArray(ids)&&ids.length<=4&&new Set(ids).size===ids.length,'Invalid or duplicate selections');
 const items=ids.map(id=>{const i=offer.items.find(i=>i.id===id);ensure(i,'Select only published items');return i;});
 const cents=items.reduce((n,i)=>n+i.cents,0);ensure(capCents===null||(Number.isSafeInteger(capCents)&&capCents>0&&cents<=capCents),'Selection exceeds the confirmed budget');
 return {ids:[...ids].sort(),items,cents,currency:'USD',capCents};
}
export function explicitBudget(message){const m=message.match(/(?:under|at most|up to|spend|budget(?:\s+of|\s+is)?|limit(?:\s+of|\s+is)?)\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);return m?money(m[1]):null;}
export function safeNegotiation(raw,offer,message,previousCap=null){
 const cap=explicitBudget(message)??previousCap;
 if(raw.escalate)return {reply:String(raw.reply||'This needs freelancer review.').slice(0,2000),escalate:true,capCents:cap};
 try {const selected=selectPackage(offer,raw.selectedIds,cap);const allowed=new Set([...offer.items.map(x=>x.cents),selected.cents,...(cap?[cap]:[])]);
 for(const m of String(raw.reply||'').matchAll(/\$\s*(\d+(?:\.\d{1,2})?)/g))ensure(allowed.has(money(m[1])),'Unpublished price');
 return {...selected,reply:String(raw.reply||'Please review the updated selection.').slice(0,2000),escalate:false};
 }catch{return {reply:'That selection or price needs freelancer review. No terms or payment have changed.',escalate:true,capCents:cap};}
}
