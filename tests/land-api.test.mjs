import test from 'node:test';import assert from 'node:assert/strict';import handler from '../api/factfind.js';
import {landFields} from '../lib/ff-land-fields.js';import {visible,validateLand} from '../lib/ff-land.js';
function complete(){const a={asset_type:'Land'};for(let i=0;i<3;i++)for(const f of landFields){if(!visible(f,a)||a[f.key]!==undefined)continue;a[f.key]=f.type==='bool'?true:f.options?(f.options.includes('No')?'No':f.options.includes('None')?'None':f.options[0]):f.type==='number'?100000:'Synthetic';}return {...a,full_name:'LAND API TEST',email:'land@example.invalid',phone:'07700900000',property_value:200000,loan_amount:1,term_months:'6',secured_lending:'No, it’s unencumbered'};}
test('actual API normalises LAND, saves scorecard, submits same hash; low value cannot submit',async()=>{
 const savedEnv={...process.env};Object.assign(process.env,{FF_BACKEND:'leads',FF_SUPABASE_URL:'http://127.0.0.1:9999',FF_SUPABASE_KEY:'mock',FF_HASH_SALT:'mock'});delete process.env.VERCEL;delete process.env.VERCEL_ENV;delete process.env.FF_ALERT_DURABLE;const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);calls.push({url,b});return {ok:true,json:async()=>url.endsWith('rate_hit')?true:[{reference:'TEST-WEB-LN2345',status:url.endsWith('submit')?'submitted':'draft',step:1,updated_at:'2026-11-12'}]};};
 const run=async body=>{let out;const res={setHeader(){},end(s){out=JSON.parse(s)}};await handler({method:'POST',headers:{},body},res);return {code:res.statusCode,...out};};
 try{const a=complete();assert.deepEqual(validateLand(a,true).errors,{});
 const low=await run({action:'submit',code:'ABCD-EFGH-JKLM',answers:{...a,property_value:150000,no_chase:false}});assert.equal(low.code,422);assert.equal(calls.some(c=>c.url.endsWith('submit')),false);
 const ok=await run({action:'submit',code:'ABCD-EFGH-JKLM',answers:a});assert.equal(ok.ok,true);assert.equal(ok.scorecard.lender_ready,false);const save=calls.find(c=>c.url.endsWith('save')),submit=calls.find(c=>c.url.endsWith('submit'));assert.equal(save.b.p_resume_hash,submit.b.p_resume_hash);assert.equal(submit.b.p_answers.intake_type,'pa_land');assert.equal(submit.b.p_answers.loan_amount,1);
 }finally{globalThis.fetch=original;for(const k of Object.keys(process.env))if(!(k in savedEnv))delete process.env[k];Object.assign(process.env,savedEnv);}
});
