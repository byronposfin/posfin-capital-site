import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {accessibleDocument,signedDocument} from '../lib/signing-access.js';
const bytes=Buffer.from('%PDF-1.7 test archive');
const sha=createHash('sha256').update(bytes).digest('hex');
const document={id:'d1',case_id:'c1',client_id:'app',kind:'EL',approved:true,test_mode:true,status:'archived',signed_sha256:sha,signed_path:`d1/${sha}.pdf`};
const args={document,caseId:'c1',clientId:'app',store:{download:async()=>bytes}};
test('signed download returns only verified archived bytes',async()=>assert.deepEqual(await signedDocument(args),bytes));
test('wrong case, app, unapproved and live documents fail before storage read',async()=>{
 for(const patch of [{case_id:'other'},{client_id:'other'},{approved:false},{test_mode:false},{status:'awaiting_signature'},{signed_path:'other/file.pdf'}]){
 let read=false;await assert.rejects(signedDocument({...args,document:{...document,...patch},store:{download:async()=>{read=true;return bytes;}}}));assert.equal(read,false);
 }
});
test('tampered archive and non-PDF bytes are rejected',async()=>{for(const data of [Buffer.from('%PDF-altered'),Buffer.from('not PDF')])await assert.rejects(signedDocument({...args,store:{download:async()=>data}}));});
test('status response excludes private paths and signer identity',()=>assert.deepEqual(accessibleDocument(document,'c1','app'),{id:'d1',kind:'EL',status:'archived',downloadable:true}));
