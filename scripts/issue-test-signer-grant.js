// Operator-only, fictional staging identities. Delivery/identity verification is NOT automated.
import {writeFile} from 'node:fs/promises';
import {stagingConfig} from '../lib/dropbox-sign.js';
import {supabase} from '../lib/supabase.js';
import {mintSignerGrant} from '../lib/signing-identity.js';
stagingConfig();
if(process.env.SIGNING_PREVIEW_RELEASE_APPROVED!=='yes')throw Error('Preview release gate closed');
const [documentId,signatureId,verificationReference,output]=process.argv.slice(2);
if(!output)throw Error('Provide document ID, signer ID, verification reference and private output file');
const db=await supabase();
const {data:document,error}=await db.from('case_signing_documents').select('*').eq('id',documentId).single();
if(error)throw Error('Document unavailable');
const grant=mintSignerGrant({document,signatureId,verificationReference});
// Exclusive private file; token never printed or logged. Operator conveys only to verified test signer.
await writeFile(output,JSON.stringify({token:grant.token,expires_at:grant.record.expires_at}),{mode:0o600,flag:'wx'});
const {error:insertError}=await db.from('case_signer_grants').insert(grant.record);
if(insertError)throw Error('Grant registration failed; output is not usable');
console.log('Test grant saved privately; no message sent.');
