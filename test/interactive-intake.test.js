import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswer, createSession } from '../public/smartlink-questionnaire.js';
const ok = data => ({ ok: true, status: 200, json: async () => data });
test('explicit zero/false retained; blanks/invalid choices rejected', () => {
 assert.equal(parseAnswer({type:'currency'},'0'),0);
 assert.equal(parseAnswer({type:'boolean'},'false'),false);
 assert.throws(() => parseAnswer({type:'currency'},''));
 assert.throws(() => parseAnswer({type:'currency'},'Infinity'));
 assert.throws(() => parseAnswer({choices:['net','gross']},'invented'));
});
test('uncertain failure retries exact payload/id; replay refreshes authoritative state', async () => {
 const calls=[]; let writes=0, reads=0;
 const session=createSession('/api/case/test',async (url,init)=>{
  if(init.method!=='PATCH') return ok({version: ++reads});
  calls.push(JSON.parse(init.body)); if(++writes===1) throw Error('transport');
  return ok({replayed:true,version:2});
 },()=> 'fixed-id');
 await session.read(); await assert.rejects(session.save({loan_amount:0}));
 const result=await session.save({loan_amount:99});
 assert.deepEqual(calls[0],calls[1]); assert.equal(result.view.version,2);
});
test('stale update never silently overwrites: returns conflict without retry',async()=>{
 let writes=0;
 const session=createSession('/test',async (url,init)=>{
  if(init.method!=='PATCH') return ok({version:7});
  writes++; return {ok:false,status:409};
 },()=> 'id');
 await session.read(); assert.deepEqual(await session.save({first_name:'Test'}),{conflict:true}); assert.equal(writes,1);
});
