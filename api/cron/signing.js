import { timingSafeEqual } from 'node:crypto';
import { supabase } from '../../lib/supabase.js';
import { stagingConfig, provider, processEvent } from '../../lib/dropbox-sign.js';
import { signingStore } from '../../lib/signing-store.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method !== 'GET') return res.status(405).end();
  const expected=Buffer.from('Bearer '+(process.env.CRON_SECRET || ''));
  const actual=Buffer.from(req.headers.authorization || '');
  if(!process.env.CRON_SECRET || actual.length!==expected.length || !timingSafeEqual(actual,expected)) return res.status(401).end();
  try {
    const config=stagingConfig(), store=signingStore(await supabase()), api=provider(config);
    const jobs=await store.claim(); const job=jobs?.[0];
    if(!job) return res.json({processed:0});
    try { await processEvent({job,config,store,api}); }
    catch { await store.retry(job,'Provider or storage processing failed'); return res.status(503).json({retryScheduled:true}); }
    return res.json({processed:1});
  } catch { return res.status(503).json({error:'Signing worker unavailable'}); }
}
