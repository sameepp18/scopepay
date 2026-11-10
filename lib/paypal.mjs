import {randomUUID} from 'node:crypto';import {AppError,ensure,dollars} from './domain.mjs';
export class PayPal {
 constructor({clientId,secret,webhookId='',fetch:fetcher=fetch}){this.clientId=clientId;this.secret=secret;this.webhookId=webhookId;this.fetch=fetcher;this.mode='sandbox';}
 async token(){
 ensure(this.clientId&&this.secret,'PayPal sandbox credentials are missing',503);
 if(this.access&&this.expires>Date.now())return this.access;
 const r=await this.fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${this.clientId}:${this.secret}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new AppError('PayPal authentication failed. Check the sandbox Client ID and Secret.',503,'paypal_auth');const j=await r.json();ensure(j.access_token,'PayPal returned no access token',502);this.access=j.access_token;this.expires=Date.now()+Math.max(0,(j.expires_in-60))*1000;return this.access;
 }
 async call(path,method='GET',body,requestId){
 const headers={Authorization:'Bearer '+await this.token(),'Content-Type':'application/json',Prefer:'return=representation'};if(requestId)headers['PayPal-Request-Id']=requestId;
 const r=await this.fetch('https://api-m.sandbox.paypal.com'+path,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});const j=await r.json().catch(()=>({}));
 if(!r.ok){const issue=j.details?.[0]?.issue;throw new AppError(`PayPal could not complete the request${issue?': '+String(issue).replace(/[^A-Z_]/g,''):''}.`,r.status===422?422:502,'paypal_request');}return j;
 }
 createOrder(s,rid){return this.call('/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{custom_id:s.digest,description:'ScopePay: '+s.title.slice(0,100),amount:{currency_code:'USD',value:dollars(s.cents)}}],payment_source:{paypal:{experience_context:{shipping_preference:'NO_SHIPPING',user_action:'PAY_NOW'}}}},rid);}
 getOrder(id){return this.call('/v2/checkout/orders/'+encodeURIComponent(id));}
 capture(id,rid){return this.call('/v2/checkout/orders/'+encodeURIComponent(id)+'/capture','POST',{},rid);}
 async verifyWebhook(h,event){if(!this.webhookId)return false;const required=['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'];if(required.some(k=>!h[k]))return false;
 const r=await this.call('/v1/notifications/verify-webhook-signature','POST',{auth_algo:h['paypal-auth-algo'],cert_url:h['paypal-cert-url'],transmission_id:h['paypal-transmission-id'],transmission_sig:h['paypal-transmission-sig'],transmission_time:h['paypal-transmission-time'],webhook_id:this.webhookId,webhook_event:event});return r.verification_status==='SUCCESS';}
}
export class DemoPayPal {
 constructor({store}={}){this.mode='demo';this.orders=new Map();this.captureCalls=0;this.store=store;}
 async remember(o){this.orders.set(o.id,structuredClone(o));if(this.store)await this.store.update(s=>{s.demoOrders??={};s.demoOrders[o.id]=o;});return structuredClone(o);}
 async createOrder(s,rid){let existing=[...this.orders.values()].find(x=>x.requestId===rid);if(!existing&&this.store)existing=Object.values((await this.store.read()).demoOrders||{}).find(x=>x.requestId===rid);if(existing)return structuredClone(existing);
 return this.remember({id:'DEMO-'+randomUUID(),requestId:rid,status:'APPROVED',purchase_units:[{custom_id:s.digest,amount:{currency_code:'USD',value:dollars(s.cents)}}]});}
 async getOrder(id){const o=this.orders.get(id)||(this.store&&(await this.store.read()).demoOrders?.[id]);ensure(o,'Demo order not found',404);return structuredClone(o);}
 async capture(id,rid){this.captureCalls++;const o=await this.getOrder(id);if(o.status==='COMPLETED')return o;o.status='COMPLETED';o.purchase_units[0].payments={captures:[{id:'DEMO-CAP-'+randomUUID(),status:'COMPLETED',amount:o.purchase_units[0].amount}]};return this.remember(o);}
 async verifyWebhook(){return false;}
}
