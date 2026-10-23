// Explicitly reviewed signed output page map; offline validation occurs before any staging write.
import {readFile} from 'node:fs/promises';
import {stagingConfig} from '../lib/dropbox-sign.js';
import {supabase} from '../lib/supabase.js';
import {splitSignedPacket} from '../lib/signing-split.js';
import {signingStore} from '../lib/signing-store.js';
stagingConfig();
if(process.env.SIGNING_PREVIEW_RELEASE_APPROVED!=='yes')throw Error('Preview release gate closed');
const [documentId,planFile]=process.argv.slice(2),plan=JSON.parse(await readFile(planFile,'utf8'));
const db=await supabase(),store=signingStore(db),document=await store.findDocument(documentId);
if(!document || !/^TEST[-_]/.test(document.case_id) || document.test_mode!==true || document.status!=='archived' || document.split_outputs?.length || plan.source_sha256!==document.signed_sha256)throw Error('Archived unsplit test packet required');
await splitSignedPacket({document:{...document,split_plan:plan},bytes:await store.download(document.signed_path)});
const {error}=await db.from('case_signing_documents').update({split_plan:plan}).eq('id',documentId).eq('signed_sha256',plan.source_sha256);if(error)throw error;
await store.enqueue({event_key:`split:${documentId}:${plan.source_sha256}`,request_id:document.request_id,event_type:'operator_reviewed_split'});
console.log('Reviewed test split queued; chargeholder dispatch remains held.');
