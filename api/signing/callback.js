import { supabase } from '../../lib/supabase.js';
import { stagingConfig, provider, receiveEvent } from '../../lib/dropbox-sign.js';
import { signingStore } from '../../lib/signing-store.js';
export const config = { api: { bodyParser: false } };
export default async function handler(req,res) {
  if(req.method !== 'POST') return res.status(405).end();
  try {
    const cfg = stagingConfig();
    let size=0; const chunks=[];
    for await (const chunk of req) { size+=chunk.length; if(size>1024*1024) return res.status(413).end(); chunks.push(chunk); }
    const type = req.headers['content-type'] || '';
    if (!type.startsWith('multipart/form-data') && !type.startsWith('application/x-www-form-urlencoded')) return res.status(415).end();
    const form = await new Response(Buffer.concat(chunks),{headers:{'Content-Type':type}}).formData();
    const json = form.get('json');
    if(typeof json !== 'string') return res.status(400).end();
    const ack=await receiveEvent({payload:JSON.parse(json),config:cfg,store:signingStore(await supabase()),api:provider(cfg)});
    return res.status(200).send(ack);
  } catch { return res.status(503).send('Callback not accepted'); }
}
