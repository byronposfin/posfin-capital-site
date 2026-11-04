import test from 'node:test';
import assert from 'node:assert/strict';
import {previewSubmitAlert,readConfig} from '../api/factfind.js';
const cfg={testRun:true,url:'https://imcqwhccwsuglkzaxazg.supabase.co'};
const env={FF_SUBMIT_ALERT:'true',VERCEL_ENV:'preview',FF_ALERT_BOT_TOKEN:'test-token',FF_ALERT_CHAT_ID:'test-chat'};
test('preview-only test guard blocks production, real records, and other projects',async()=>{
 for(const [c,r,e] of [[cfg,'TEST-WEB-ABC234',{...env,VERCEL_ENV:'production'}],[cfg,'POSFIN-WEB-ABC234',env],[{...cfg,testRun:false},'TEST-WEB-ABC234',env],[{...cfg,url:'https://other.supabase.co'},'TEST-WEB-ABC234',env]]) assert.equal((await previewSubmitAlert(c,r,e)).status,'blocked');
});
test('transport sends only reference, no submitted answers; exposes receipt/failure',async()=>{
 const original=global.fetch;let sent;
 try {
 global.fetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,result:{message_id:123}})}};
 assert.deepEqual(await previewSubmitAlert(cfg,'TEST-WEB-ABC234',env),{status:'sent',messageId:123});
 assert.deepEqual(Object.keys(sent).sort(),['chat_id','text']);assert.match(sent.text,/TEST-WEB-ABC234/);
 global.fetch=async()=>({ok:false,json:async()=>({ok:false})});assert.equal((await previewSubmitAlert(cfg,'TEST-WEB-ABC234',env)).status,'failed');
 global.fetch=async()=>{throw Error('timeout')};assert.equal((await previewSubmitAlert(cfg,'TEST-WEB-ABC234',env)).status,'unknown');
 }finally{global.fetch=original}
});
test('test mode cannot run in production',()=>assert.equal(readConfig({FF_TEST_RUN:'true',FF_SUPABASE_URL:cfg.url,FF_SUPABASE_KEY:'x',FF_HASH_SALT:'x',VERCEL_ENV:'production'}).reason,'test_run_on_production'));
