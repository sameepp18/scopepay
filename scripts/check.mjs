import {pathToFileURL} from 'node:url';
import {loadConfig} from '../lib/config.mjs';
import {PayPal} from '../lib/paypal.mjs';

export async function checkCredentials(c,{fetch:fetcher=fetch}={}) {
  const results=[];
  if(!c.anthropicKey) results.push({service:'Claude',ok:false,message:'Add ANTHROPIC_API_KEY.'});
  else try {
    const r=await fetcher('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':c.anthropicKey,'anthropic-version':c.anthropicVersion||'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:c.model,max_tokens:8,messages:[{role:'user',content:'Reply OK.'}]}),signal:AbortSignal.timeout(20000)});
    if(!r.ok) throw Error(r.status===401||r.status===403?'Claude rejected the API key.':`Claude returned HTTP ${r.status}; check model access and credit.`);
    const j=await r.json();if(!j.content?.length)throw Error('Claude returned an unexpected response.');
    results.push({service:'Claude',ok:true,message:'Key and model responded.'});
  } catch(e) {results.push({service:'Claude',ok:false,message:e.message.startsWith('Claude ')?e.message:'Claude connection failed; check network access.'});}
  if(!c.clientId||!c.secret) results.push({service:'PayPal sandbox',ok:false,message:'Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.'});
  else try {await new PayPal({...c,fetch:fetcher}).token();results.push({service:'PayPal sandbox',ok:true,message:'Authentication succeeded; no order created.'});}
  catch {results.push({service:'PayPal sandbox',ok:false,message:'Authentication failed; check sandbox keys and network access.'});}
  return results;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  console.log('Checks make a tiny billable Claude request and PayPal authentication only.');
  const results=await checkCredentials(await loadConfig());
  for(const r of results)console.log(`${r.ok?'OK':'NOT READY'} — ${r.service}: ${r.message}`);
  if(results.some(r=>!r.ok))process.exitCode=1;
}
