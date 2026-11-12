import test from 'node:test';import assert from 'node:assert/strict';
import {drainAlerts,alertConfig,PREVIEW_DB} from '../lib/ff-alert-outbox.js';
import handler from '../api/factfind-alert-worker.js';
const env={FF_ALERT_DURABLE:'true',VERCEL_ENV:'preview',FF_TEST_RUN:'true',FF_SUPABASE_URL:PREVIEW_DB,FF_ALERT_SERVICE_KEY:'private-test',FF_ALERT_BOT_TOKEN:'test-token',FF_ALERT_CHAT_ID:'test-destination'};
const row={id:'row',reference:'TEST-WEB-ABC234',lease_id:'lease',attempts:2};
const response=(status,data)=>({ok:status<300,status,json:async()=>data});
test('worker fails closed without exact preview isolation or credentials',async()=>{
 for(const changes of [{VERCEL_ENV:'production'},{FF_SUPABASE_URL:'https://vgflcrfaudrvrdmxjdtl.supabase.co'},{FF_TEST_RUN:'false'},{FF_ALERT_SERVICE_KEY:''},{FF_ALERT_DURABLE:'false'}]){
  const cfg={...env,...changes};assert.equal(alertConfig(cfg).ok,false);assert.equal((await drainAlerts(cfg,()=>{throw Error('must not fetch')})).ok,false);
 }
});
test('receipt is persisted, reference-only transport, no secrets returned',async()=>{
 let recorded,transport;
 const result=await drainAlerts(env,async(url,opts)=>{
  if(url.endsWith('_claim'))return response(200,[row]);
  if(url.endsWith('_finish')){recorded=JSON.parse(opts.body);return response(200,true);}
  transport=JSON.parse(opts.body);return response(200,{ok:true,result:{message_id:900}});
 });
 assert.equal(recorded.p_result,'sent');assert.equal(recorded.p_message_id,900);assert.equal(recorded.p_lease_id,'lease');assert.equal(result.sent,1);
 assert.deepEqual(Object.keys(transport).sort(),['chat_id','text']);assert.match(transport.text,/TEST-WEB-ABC234/);assert.doesNotMatch(JSON.stringify(result),/private-test|test-token|test-destination/);
});
test('explicit 429 rejection schedules retry; timeout and 500 are unknown, not retry',async()=>{
 for(const kind of ['429','timeout','500']){
  let finish;
  await drainAlerts(env,async(url,opts)=>{
   if(url.endsWith('_claim'))return response(200,[row]);
   if(url.endsWith('_finish')){finish=JSON.parse(opts.body);return response(200,true);}
   if(kind==='timeout')throw Error('timeout');
   return response(Number(kind),{ok:false,parameters:{retry_after:300}});
  });
  assert.equal(finish.p_result,kind==='429'?'rejected':'unknown');if(kind==='429')assert.equal(finish.p_retry_seconds,300);
 }
});
test('failed receipt write is visible and never retries external send in same run',async()=>{
 let sends=0;const result=await drainAlerts(env,async(url)=>{
  if(url.endsWith('_claim'))return response(200,[row]);
  if(url.endsWith('_finish'))return response(503,{});
  sends++;return response(200,{ok:true,result:{message_id:901}});
 });assert.equal(sends,1);assert.equal(result.ok,false);assert.equal(result.unrecorded,1);
});
test('worker endpoint rejects missing secret and invalid bearer, never implicitly opens',async()=>{
 const old=process.env.FF_ALERT_WORKER_SECRET;try{
  for(const secret of ['', 'x'.repeat(32)]){
   process.env.FF_ALERT_WORKER_SECRET=secret;let code;await handler({method:'POST',headers:{}},{setHeader(){},set statusCode(x){code=x},end(){}});assert.equal(code,401);
  }
 }finally{if(old===undefined)delete process.env.FF_ALERT_WORKER_SECRET;else process.env.FF_ALERT_WORKER_SECRET=old;}
});

test('main production worker uses the main database and existing production bot',async()=>{
 const e={...env,VERCEL_ENV:'production',FF_TEST_RUN:'false',FF_SUPABASE_URL:'https://vgflcrfaudrvrdmxjdtl.supabase.co',FF_ALERT_BOT_TOKEN:'',TELEGRAM_BOT_TOKEN:'production-test-token'};
 assert.equal(alertConfig(e).ok,true);let text;
 await drainAlerts(e,async(url,o)=>{
  if(url.includes('/rest/'))assert.match(url,/vgflcrfaudrvrdmxjdtl/);
  if(url.endsWith('_claim'))return response(200,[{...row,reference:'POSFIN-WEB-ABC234'}]);
  if(url.endsWith('_finish'))return response(200,true);
  text=JSON.parse(o.body).text;return response(200,{ok:true,result:{message_id:902}});
 });assert.match(text,/main CRM/);assert.doesNotMatch(text,/Ads|PREVIEW/);
 assert.equal(alertConfig({...e,FF_TEST_RUN:'true'}).ok,false);
});

test('LAND recipients have separate delivery receipts; preview never sends to production staff',async()=>{
 const e={...env,VERCEL_ENV:'production',FF_TEST_RUN:'false',FF_SUPABASE_URL:'https://vgflcrfaudrvrdmxjdtl.supabase.co'};
 const sent=[],finished=[];let index=0;
 const fetcher=async(url,o)=>{if(url.endsWith('_claim')){const recipient=['1750758657','8634157536'][index++];return response(200,[{...row,id:recipient,recipient_chat_id:recipient}]);}if(url.endsWith('_finish')){finished.push(JSON.parse(o.body));return response(200,true);}sent.push(JSON.parse(o.body).chat_id);return response(200,{ok:true,result:{message_id:100+sent.length}});};
 await drainAlerts(e,fetcher);await drainAlerts(e,fetcher);assert.deepEqual(sent,['1750758657','8634157536']);assert.notEqual(finished[0].p_id,finished[1].p_id);assert.notEqual(finished[0].p_message_id,finished[1].p_message_id);
});
