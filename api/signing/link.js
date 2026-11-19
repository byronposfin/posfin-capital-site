import {resolveSigner} from '../../lib/signing-identity.js';
import { supabase, resolveToken, hashToken } from '../../lib/supabase.js';
import { verifySession } from '../../lib/postcode-gate.js';
import { stagingConfig, provider, freshSigningLink } from '../../lib/dropbox-sign.js';
import { signingStore } from '../../lib/signing-store.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store'); res.setHeader('Referrer-Policy','no-referrer');
  if(req.method !== 'POST') return res.status(405).end();
  try {
    const config = stagingConfig();
    // Same-origin only; tokens are in POST bodies, never sent to the vendor as referrers.
    if (!process.env.SIGNING_ORIGIN || req.headers.origin !== process.env.SIGNING_ORIGIN) return res.status(403).end();
    const db = await supabase();
    const token = await resolveToken(db,hashToken(String(req.body?.token || '')));
    const cookie = String(req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith('smartlink_session='))?.slice(18);
    const session = verifySession(cookie);
    if (!token || token.revoked || !session || session.caseId !== token.case_id) return res.status(403).end();
    const store=signingStore(db);
    const document = await store.findDocument(req.body?.documentId);
    if(!document || document.case_id!==token.case_id)return res.status(403).end();
    const signatureId=await resolveSigner({document,token:req.body?.signerToken,store});
    const link = await freshSigningLink({document,signatureId,caseId:token.case_id,clientId:config.clientId,api:provider(config)});
    return res.status(200).json(link);
  } catch { return res.status(409).json({error:'Signing is not available for this document.'}); }
}
