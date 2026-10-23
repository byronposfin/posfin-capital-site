import {createHash} from 'node:crypto';
export function prepareRequest({manifest,files,clientId}) {
 if(manifest.test_mode!==true || manifest.approved!==true || !/^TEST[-_]/.test(manifest.case_id || '') || !manifest.approval_reference)throw Error('Test approval required');
 if(!Array.isArray(manifest.signers) || manifest.signers.length<1 || manifest.signers.length>4)throw Error('One to four test signers required');
 const signer=manifest.signers[0];
 if(manifest.signers.some(s=>!s.name || !/^[^\s@]+@example\.(com|org|net)$/.test(s.email)) || new Set(manifest.signers.map(s=>s.email.toLowerCase())).size!==manifest.signers.length)throw Error('Fictional test signer required');
 if(!Array.isArray(files)||!files.length||files.length!==manifest.documents?.length)throw Error('Document manifest mismatch');
 const identities=new Set();
 const entries=files.map((file,i)=>{
  const d=manifest.documents[i];
  if(!['EL','LOA','BUSINESS_PURPOSE','DUMMY'].includes(d.kind)||!d.id||identities.has(d.id))throw Error('Invalid document identity');
  identities.add(d.id);
  if(files.length>1 && (d.kind!=='LOA'||!d.chargeholder_ref))throw Error('Only mapped LOAs may share an envelope');
  const sha=createHash('sha256').update(file.bytes).digest('hex');
  if(file.bytes.subarray(0,5).toString()!=='%PDF-' || sha!==d.sha256 || file.preflight?.status!=='PASS' || file.preflight.sha256!==sha)throw Error('PDF preflight/hash mismatch');
  return {id:d.id,kind:d.kind,chargeholder_ref:d.chargeholder_ref||null,sha256:sha,pages:file.preflight.pages};
 });
 if(files.length>1 && new Set(entries.map(x=>x.chargeholder_ref)).size!==entries.length)throw Error('Duplicate chargeholder');
 const packetHash=createHash('sha256').update(JSON.stringify(entries)).digest('hex');
 const form=new FormData();
 for(const [key,value] of Object.entries({client_id:clientId,test_mode:'1',use_text_tags:'1',hide_text_tags:'0',ignore_text_tags_extraction_errors:'0',allow_reassign:'0',title:'Posfin fictional signing acceptance test'}))form.append(key,value);
 manifest.signers.forEach((s,i)=>{form.append(`signers[${i}][email_address]`,s.email);form.append(`signers[${i}][name]`,s.name);});
 form.append('metadata[packet_sha256]',packetHash);
 files.forEach((file,i)=>form.append(`files[${i}]`,new Blob([file.bytes],{type:'application/pdf'}),`document-${i+1}.pdf`));
 return {form,entries,packetHash,signer,signers:manifest.signers};
}
// Caller must reserve an operation durably BEFORE this call. Never retry an ambiguous POST.
export async function submitPrepared({prepared,config,fetcher=fetch}) {
 const res=await fetcher('https://api.hellosign.com/v3/signature_request/create_embedded',{
  method:'POST',headers:{Authorization:'Basic '+Buffer.from(config.key+':').toString('base64')},body:prepared.form,redirect:'error',signal:AbortSignal.timeout(30000)
 });
 if(!res.ok)throw Error('Create request failed; reconcile provider before retry');
 const data=await res.json(),r=data.signature_request;
 if(data.warnings?.length || !r?.signature_request_id || r.test_mode!==true || r.client_id!==config.clientId || r.metadata?.packet_sha256!==prepared.packetHash || r.signatures?.length!==prepared.signers.length || new Set(r.signatures.map(s=>s.signature_id)).size!==prepared.signers.length || prepared.signers.some(s=>!r.signatures.some(r=>r.signature_id && r.signer_email_address?.toLowerCase()===s.email.toLowerCase())))throw Error('Creation needs reconciliation; response binding or warnings');
 return r;
}
