import {test} from 'node:test';import assert from 'node:assert/strict';
import {stagingTestDelivery as send} from '../lib/staging-test-delivery.js';
const env={FACTFIND_TEST_DELIVERY:'byron-only',VERCEL_ENV:'preview',FACTFIND_SHEET_ID:'17E60hrVFtl5WJ8pqpO74dk5DY7kOvJ5R0jD0XH-GRMw',VERCEL_URL:'test.vercel.app',TELEGRAM_BOT_TOKEN:'synthetic'};
const data={first_name:'DUMMY',mobile:'447773339444',email:'byron.hill@posfincapital.com'};const saved={pipeline:true,firstCompletion:true,leadRef:'TEST'};
test('test lane rejects production, wrong sheet, real contact and replay before sending',async()=>{
 let calls=0;const transport=async()=>{calls++;throw Error('unexpected send');};
 for(const e of [{...env,VERCEL_ENV:'production'},{...env,FACTFIND_SHEET_ID:'live'}])await assert.rejects(()=>send(data,saved,'https://test.vercel.app/scorecard',{env:e,transport}));
 assert.equal((await send({...data,mobile:'447700900001'},saved,'https://test.vercel.app/scorecard',{env,transport})).held,true);
 assert.equal((await send(data,{...saved,firstCompletion:false},'https://test.vercel.app/scorecard',{env,transport})).held,true);assert.equal(calls,0);
});
test('both role messages are fixed to Byron and provider refusal is not reported delivered',async()=>{
 const bodies=[];const transport=async(u,r)=>{bodies.push(JSON.parse(r.body));return{ok:true,json:async()=>({ok:false})};};
 const r=await send(data,saved,'https://test.vercel.app/scorecard',{env,transport});assert.equal(bodies.length,2);assert.ok(bodies.every(x=>x.chat_id==='1750758657'));assert.ok(r.results.every(x=>!x.ok));
});
