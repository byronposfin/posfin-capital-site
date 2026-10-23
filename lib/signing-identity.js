import {createHash,randomBytes} from 'node:crypto';
export const hashSignerToken = token => createHash('sha256').update(token).digest('hex');
export function signerBindings(document) {
 const rows=document.signers?.length?document.signers:[{signature_id:document.signature_id,email:document.signer_email}];
 if(!rows.length || rows.length>4 || rows.some(s=>!s.signature_id || !s.email) || new Set(rows.map(s=>s.signature_id)).size!==rows.length || new Set(rows.map(s=>s.email.toLowerCase())).size!==rows.length)throw Error('Invalid signer bindings');
 return rows;
}
export function mintSignerGrant({document,signatureId,verificationReference,now=Date.now()}) {
 if(document.test_mode!==true || document.approved!==true || !/^TEST[-_]/.test(document.case_id) || !verificationReference?.trim())throw Error('Verified test identity required');
 const signer=signerBindings(document).find(s=>s.signature_id===signatureId);
 if(!signer || !/^[^\s@]+@example\.(com|org|net)$/i.test(signer.email))throw Error('Fictional signer required');
 const token=randomBytes(32).toString('base64url');
 return {token,record:{token_hash:hashSignerToken(token),document_id:document.id,case_id:document.case_id,signature_id:signatureId,verification_reference:verificationReference,expires_at:new Date(now+30*60_000).toISOString()}};
}
export async function resolveSigner({document,token,store,now=Date.now()}) {
 const signers=signerBindings(document);
 // Legacy single-signer case gate retained; joint envelopes require individual possession proof.
 if(signers.length===1)return signers[0].signature_id;
 if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))throw Error('Signer verification required');
 const grant=await store.findSignerGrant(hashSignerToken(token));
 if(!grant || grant.revoked || grant.document_id!==document.id || grant.case_id!==document.case_id || !grant.verification_reference || !Number.isFinite(Date.parse(grant.expires_at)) || Date.parse(grant.expires_at)<=now || !signers.some(s=>s.signature_id===grant.signature_id))throw Error('Signer verification required');
 return grant.signature_id;
}
