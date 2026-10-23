import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {mintSignerGrant,resolveSigner} from '../lib/signing-identity.js';
import {assertBinding,freshSigningLink,processEvent} from '../lib/dropbox-sign.js';
import {prepareRequest,submitPrepared} from '../lib/signing-create.js';
import {splitSignedPacket} from '../lib/signing-split.js';
import {sheetsMirror,MIRROR_HEADERS,deliverMirror} from '../lib/signing-mirror.js';
const document={id:'doc',case_id:'TEST-JOINT',test_mode:true,approved:true,client_id:'app',request_id:'req',template_sha256:'hash',status:'awaiting_signature',signers:[{signature_id:'s1',email:'one@example.com'},{signature_id:'s2',email:'two@example.com'}]};
const request={signature_request_id:'req',client_id:'app',test_mode:true,signatures:document.signers.map(s=>({signature_id:s.signature_id,signer_email_address:s.email,status_code:'awaiting_signature'}))};
test('joint signer requires separate valid grant, never a client-selected signer ID',async()=>{
 await assert.rejects(resolveSigner({document,token:'s2',store:{}}));
 const {token,record}=mintSignerGrant({document,signatureId:'s2',verificationReference:'fictional identity fixture',now:1000});
 const store={findSignerGrant:async hash=>hash===record.token_hash?record:null};
 assert.equal(await resolveSigner({document,token,store,now:1001}),'s2');
 for(const patch of [{revoked:true},{document_id:'other'},{case_id:'other'},{expires_at:'invalid'},{signature_id:'other'}])await assert.rejects(resolveSigner({document,token,store:{findSignerGrant:async()=>({...record,...patch})},now:1001}));
 await assert.rejects(resolveSigner({document,token,store,now:2e6}));
});
test('provider readback binds ALL joint signer identities and opens only selected signer',async()=>{
 assertBinding(request,document,'app');
 assert.throws(()=>assertBinding({...request,signatures:[request.signatures[0],request.signatures[0]]},document,'app'));
 const api={request:async()=>request,signUrl:async id=>{assert.equal(id,'s2');return {sign_url:'https://app.hellosign.com/sign/test'};}};
 await assert.rejects(freshSigningLink({document,caseId:document.case_id,clientId:'app',api}));
 await freshSigningLink({document,caseId:document.case_id,clientId:'app',signatureId:'s2',api});
 await assert.rejects(freshSigningLink({document,caseId:document.case_id,clientId:'app',signatureId:'s3',api}));
});
test('joint creation maps signers and rejects mismatched provider identities',async()=>{
 const bytes=Buffer.from('%PDF-fixture'),sha=createHash('sha256').update(bytes).digest('hex');
 const prepared=prepareRequest({manifest:{test_mode:true,approved:true,approval_reference:'fixture',case_id:'TEST-JOINT',signers:document.signers.map(s=>({name:'Fictional',email:s.email})),documents:[{id:'loa',kind:'LOA',sha256:sha}]},files:[{bytes,preflight:{status:'PASS',sha256:sha,pages:1}}],clientId:'app'});
 assert.equal(prepared.form.get('signers[1][email_address]'),'two@example.com');
 const response={...request,metadata:{packet_sha256:prepared.packetHash}};
 assert.equal(await submitPrepared({prepared,config:{clientId:'app',key:'fake'},fetcher:async()=>({ok:true,json:async()=>({signature_request:response})})}),response);
 await assert.rejects(submitPrepared({prepared,config:{clientId:'app',key:'fake'},fetcher:async()=>({ok:true,json:async()=>({signature_request:{...response,signatures:[response.signatures[0],response.signatures[0]]}})})}));
});
async function fixture(){
 const pdf=await PDFDocument.create();for(const width of [111,222,333])pdf.addPage([width,400]);
 const bytes=Buffer.from(await pdf.save()),sha=createHash('sha256').update(bytes).digest('hex');
 const entries=[{id:'a',kind:'LOA',pages:1,chargeholder_ref:'a'},{id:'b',kind:'LOA',pages:1,chargeholder_ref:'b'}];
 return {bytes,doc:{...document,packet_manifest:entries,split_plan:{approved:true,approval_reference:'review fixture',source_sha256:sha,audit_pages:1,documents:entries.map(({id,pages,chargeholder_ref})=>({id,pages,chargeholder_ref}))}}};
}
test('held split excludes audit and preserves correct chargeholder page, deterministic replay',async()=>{
 const {bytes,doc}=await fixture();const parts=await splitSignedPacket({document:doc,bytes}),again=await splitSignedPacket({document:doc,bytes});
 assert.deepEqual(parts.map(p=>p.sha256),again.map(p=>p.sha256));
 for(const [i,p] of parts.entries()){const pdf=await PDFDocument.load(p.bytes);assert.equal(pdf.getPageCount(),1);assert.equal(pdf.getPage(0).getWidth(),[111,222][i]);assert.equal(p.release,'held');}
});
test('split rejects wrong hash, wrong count, reordered mapping, missing approval',async()=>{
 const {bytes,doc}=await fixture();for(const patch of [{approved:false},{source_sha256:'wrong'},{audit_pages:0},{documents:[...doc.split_plan.documents].reverse()}])await assert.rejects(splitSignedPacket({document:{...doc,split_plan:{...doc.split_plan,...patch}},bytes}));
});
test('archived packet worker retries split upload failures and records held metadata only after upload',async()=>{
 const {bytes,doc}=await fixture();doc.status='archived';doc.signed_sha256=doc.split_plan.source_sha256;const calls=[];
 const store={findRequest:async()=>doc,download:async()=>bytes,archive:async()=>calls.push('upload'),finish:async(j,p)=>calls.push(p)};
 await processEvent({job:{request_id:'req'},config:{clientId:'app'},store,api:{request:async()=>({...request,metadata:{packet_sha256:'hash'}})}});
 assert.deepEqual(calls.slice(0,2),['upload','upload']);assert.equal(calls[2].split_outputs.length,2);assert.equal(calls[2].split_outputs[0].bytes,undefined);
 let finished=false;await assert.rejects(processEvent({job:{request_id:'req'},config:{clientId:'app'},store:{...store,archive:async()=>{throw Error('offline');},finish:async()=>{finished=true;}},api:{request:async()=>({...request,metadata:{packet_sha256:'hash'}})}}));assert.equal(finished,false);
});
const job={id:'event:loa',document_id:'doc',mirror_row:2,payload:{case_id:'TEST-JOINT',document_id:'doc',item_id:'loa',kind:'LOA',status:'archived'}};
test('staging Sheets replay overwrites reserved row; collision and live sheet rejected',async()=>{
 let rows=[MIRROR_HEADERS],updates=[];
 const sheets={spreadsheets:{values:{get:async()=>({data:{values:rows}}),update:async x=>{updates.push(x);rows[1]=x.requestBody.values[0];}}}};
 const write=sheetsMirror({sheets,spreadsheetId:'test',allowedSpreadsheetId:'test'});
 await write(job);await write(job);assert.equal(rows.length,2);assert.equal(updates[0].range,updates[1].range);
 rows[1]=['another event'];await assert.rejects(write(job));
 assert.throws(()=>sheetsMirror({sheets,spreadsheetId:'1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ',allowedSpreadsheetId:'1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ'}));
});
test('mirror write failure schedules retry; DB ack failure does not disguise success',async()=>{
 const states=[];assert.equal((await deliverMirror({job,write:async()=>{throw Error('timeout');},store:{settle:async(j,ok)=>states.push(ok)}})).delivered,false);assert.deepEqual(states,[false]);
 await assert.rejects(deliverMirror({job,write:async()=>{},store:{settle:async()=>{throw Error('lost lease');}}}));
});
test('mocked joint-signing journey links signer, archives combined PDF, splits reviewed LOAs and mirrors both',async()=>{
 const {bytes,doc}=await fixture();delete doc.split_plan;let completed=false;
 const objects=new Map(),mirror=[];
 const current={...doc};
 const grant=mintSignerGrant({document:current,signatureId:'s2',verificationReference:'fictional test verification'});
 const store={findSignerGrant:async()=>grant.record,findRequest:async()=>current,archive:async(path,pdf)=>objects.set(path,pdf),download:async path=>objects.get(path),finish:async(job,patch)=>{if(patch)Object.assign(current,patch);}};
 const api={request:async()=>({...request,is_complete:completed,metadata:{packet_sha256:'hash'}}),signUrl:async id=>({sign_url:`https://app.hellosign.com/sign/${id}`}),files:async()=>bytes};
 const signatureId=await resolveSigner({document:current,token:grant.token,store});
 const link=await freshSigningLink({document:current,caseId:current.case_id,clientId:'app',signatureId,api});assert.match(link.signUrl,/s2$/);
 completed=true;await processEvent({job:{request_id:'req'},config:{clientId:'app'},store,api});
 assert.equal(current.status,'archived');assert.equal(objects.size,1);
 current.split_plan=(await fixture()).doc.split_plan;
 await processEvent({job:{request_id:'req'},config:{clientId:'app'},store,api});
 assert.equal(current.split_outputs.length,2);assert.equal(objects.size,3);
 for(const [i,item] of current.packet_manifest.entries()){
  const event={id:`event:${item.id}`,mirror_row:i+2,document_id:current.id,payload:{case_id:current.case_id,document_id:current.id,item_id:item.id,kind:item.kind,status:'archived'}};
  await deliverMirror({job:event,store:{settle:async(j,ok)=>assert.ok(ok)},write:async j=>mirror.push(j.payload)});
 }
 assert.deepEqual(mirror.map(p=>p.item_id),['a','b']);
});
