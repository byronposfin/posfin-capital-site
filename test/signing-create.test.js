import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareRequest,submitPrepared} from '../lib/signing-create.js';
const bytes=Buffer.from('%PDF-synthetic'),sha=createHash('sha256').update(bytes).digest('hex');
const file={bytes,preflight:{status:'PASS',sha256:sha,pages:1}};
const manifest={test_mode:true,approved:true,case_id:'TEST-SIGNING',approval_reference:'fixture approval',signers:[{name:'Test Signer',email:'qa@example.com'}],documents:[{id:'a',kind:'LOA',chargeholder_ref:'holder-a',sha256:sha}]};
const prep=(m=manifest,files=[file])=>prepareRequest({manifest:m,files,clientId:'app'});
test('request upload preserves exact checked bytes and enforces test flags',async()=>{const p=prep();assert.equal(p.form.get('test_mode'),'1');assert.equal(p.form.get('hide_text_tags'),'0');assert.deepEqual(Buffer.from(await p.form.get('files[0]').arrayBuffer()),bytes);});
test('multiple mapped LOAs share one envelope with unique identities',()=>{const p=prep({...manifest,documents:[...manifest.documents,{...manifest.documents[0],id:'b',chargeholder_ref:'holder-b'}]},[file,file]);assert.equal(p.entries.length,2);assert.ok(p.form.get('files[1]'));});
test('altered bytes, failed preflight, duplicate chargeholder, real recipient and multisigner fail closed',()=>{
 assert.throws(()=>prep(manifest,[{...file,bytes:Buffer.from('%PDF-changed')}]));
 assert.throws(()=>prep(manifest,[{...file,preflight:{...file.preflight,status:'FAIL'}}]));
 assert.throws(()=>prep({...manifest,documents:[...manifest.documents,{...manifest.documents[0],id:'b'}]},[file,file]));
 assert.throws(()=>prep({...manifest,signers:[{name:'Someone',email:'person@real.test'}]}));
 assert.throws(()=>prep({...manifest,signers:[...manifest.signers,...manifest.signers]}));
});
test('provider warnings and mismatched returned binding require reconciliation',async()=>{for(const data of [{warnings:[{}]}, {signature_request:{signature_request_id:'x',test_mode:false}}])await assert.rejects(submitPrepared({prepared:prep(),config:{key:'fake',clientId:'app'},fetcher:async()=>({ok:true,json:async()=>data})}));});
