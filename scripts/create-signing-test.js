// Operator-only. No public creation route. Test-only, synthetic signer, staging DB.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {stagingConfig} from '../lib/dropbox-sign.js';
import {prepareRequest,submitPrepared} from '../lib/signing-create.js';
import {supabase} from '../lib/supabase.js';
const path=resolve(process.argv[2]||'');
const manifest=JSON.parse(await readFile(path,'utf8'));
const root=dirname(path),script=join(dirname(fileURLToPath(import.meta.url)),'signing-template-gate.py');
const files=[];
for(const d of manifest.documents){
 const pdf=resolve(root,d.file),args=[script,pdf,'--kind',d.kind==='DUMMY'?'BUSINESS_PURPOSE':d.kind,'--signers',String(manifest.signers.length)];
 if(d.kind==='EL'){if(!d.annex)throw Error('Approved EL annex required');args.push('--annex',resolve(root,d.annex));}
 const preflight=JSON.parse(execFileSync(process.env.SIGNING_PYTHON||'python3',args,{encoding:'utf8'}));
 files.push({bytes:await readFile(pdf),preflight});
}
const execute=process.argv.includes('--execute');
const cfg=execute?stagingConfig():{clientId:'offline-preview'};
const prepared=prepareRequest({manifest,files,clientId:cfg.clientId});
if(!execute){console.log(JSON.stringify({mode:'offline-only',packet_sha256:prepared.packetHash,documents:prepared.entries},null,2));}
else {
 // Existing SmartLink preview release approval must precede enabling this operator tool.
 if(process.env.SIGNING_PREVIEW_RELEASE_APPROVED!=='yes')throw Error('Preview release approval gate closed');
 const db=await supabase();
 const {data:caseRow,error:caseError}=await db.from('case_completion').select('case_id').eq('case_id',manifest.case_id).single();
 if(caseError||!caseRow)throw Error('Test case unavailable');
 // Verify migration exists before any provider create. This does not prove hosted acceptance.
 const {error:schemaError}=await db.from('case_signing_documents').select('id,packet_manifest').limit(1);
 if(schemaError)throw Error('Signing migration unavailable');
 const journalDir=resolve(root,'signing-operations');await mkdir(journalDir,{recursive:true,mode:0o700});
 const journal=join(journalDir,prepared.packetHash+'.json');
 await writeFile(journal,JSON.stringify({state:'reserved',case_id:manifest.case_id,packet_sha256:prepared.packetHash}),{flag:'wx',mode:0o600});
 // An existing reserved record deliberately blocks retry after timeout/crash. Reconcile first.
 const request=await submitPrepared({prepared,config:cfg});
 await writeFile(journal,JSON.stringify({state:'provider_created',request,packet:prepared.entries}),{mode:0o600});
 const {error}=await db.from('case_signing_documents').insert({case_id:manifest.case_id,request_id:request.signature_request_id,signature_id:request.signatures[0].signature_id,signer_email:prepared.signer.email,client_id:cfg.clientId,kind:prepared.entries[0].kind,template_sha256:prepared.packetHash,packet_manifest:prepared.entries,approved:true,test_mode:true});
 if(error)throw Error('Request exists; register saved journal without recreating');
 await writeFile(journal,JSON.stringify({state:'registered',request_id:request.signature_request_id,packet:prepared.entries}),{mode:0o600});
 console.log('Test request registered; no borrower send or production change.');
}
