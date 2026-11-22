// Server-only worker; explicit database and deployment isolation. Credentials never enter the browser or returned payload.
import { ukDob } from './ff-uk.js';
export const PREVIEW_DB='https://imcqwhccwsuglkzaxazg.supabase.co';
export const MAIN_DB='https://vgflcrfaudrvrdmxjdtl.supabase.co';
export function alertConfig(env=process.env){
 const enabled=env.FF_ALERT_DURABLE==='true';
 const isolated=env.VERCEL_ENV==='preview'&&env.FF_TEST_RUN==='true'&&env.FF_SUPABASE_URL===PREVIEW_DB;
 const production=env.VERCEL_ENV==='production'&&env.FF_TEST_RUN!=='true'&&env.FF_SUPABASE_URL===MAIN_DB;
 return {enabled,production,url:env.FF_SUPABASE_URL,token:env.FF_ALERT_BOT_TOKEN||env.TELEGRAM_BOT_TOKEN,ok:enabled&&(isolated||production)&&!!env.FF_ALERT_SERVICE_KEY&&!!(env.FF_ALERT_BOT_TOKEN||env.TELEGRAM_BOT_TOKEN)&&!!env.FF_ALERT_CHAT_ID};
}
async function request(fetcher,url,options){
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),6000);
 try{return await fetcher(url,{...options,signal:ac.signal});}finally{clearTimeout(timer);}
}
function oneLine(value, max) {
  return String(value ?? '').replace(/[\r\n\u0000-\u001f]/g, '').trim().slice(0, max);
}

export function productionAlert(reference, contact) {
  const lines = [
    `FACT FIND RECEIVED${String(reference).startsWith('TEST-') ? ' — SYNTHETIC TEST' : ''}`,
    `Reference: ${reference}`,
  ];
  if (contact && contact.phone) lines.push(`Phone: ${oneLine(contact.phone, 30)}`);
  const dob = ukDob(contact && contact.dob);
  const joint = ukDob(contact && contact.joint);
  if (dob) lines.push(`Date of birth: ${dob}`);
  if (joint) lines.push(`Joint date of birth: ${joint}`);
  lines.push('Saved to main CRM. Pending broker review; not lender-approved.', 'https://admin.posfincapital.com/leads');
  return lines.join('\n');
}

async function staffContact(cfg, env, fetcher, reference) {
  if (!/^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$/.test(String(reference || ''))) return null;
  try {
    const response = await request(fetcher, `${cfg.url}/rest/v1/web_leads?reference=eq.${encodeURIComponent(reference)}&select=phone,applicant_dob,joint_applicant_dob`, {
      headers: { apikey: env.FF_ALERT_SERVICE_KEY, Authorization: `Bearer ${env.FF_ALERT_SERVICE_KEY}`, 'Accept-Profile': 'pipeline' },
    });
    if (!response.ok) return null;
    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    return { phone: oneLine(row.phone, 30), dob: oneLine(row.applicant_dob, 10), joint: oneLine(row.joint_applicant_dob, 10) };
  } catch {
    return null;
  }
}

export async function drainAlerts(env=process.env,fetcher=fetch){
 const cfg=alertConfig(env);
 if(!cfg.ok)return {ok:false,error:'alert_worker_not_configured'};
 const rpc=async(name,args)=>{
  const r=await request(fetcher,`${cfg.url}/rest/v1/rpc/web_lead_alert_${name}`,{method:'POST',headers:{apikey:env.FF_ALERT_SERVICE_KEY,Authorization:`Bearer ${env.FF_ALERT_SERVICE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
  if(!r.ok)throw Error('outbox_storage_unavailable');return r.json();
 };
 // Claim only one per invocation: transport + status readback fit a short serverless request.
 const rows=await rpc('claim',{p_limit:1});
 const result={ok:true,claimed:rows.length,sent:0,rejected:0,unknown:0,unrecorded:0};
 for(const row of rows){
  let outcome='unknown',messageId=null,retry=60*Math.pow(2,Math.max(0,row.attempts-1));
  if(!(cfg.production?/^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$/:/^TEST-WEB-[A-Z2-9]{6}$/).test(row.reference))throw Error('invalid_outbox_reference');
  if(row.recipient_chat_id&&!['1750758657','8634157536'].includes(row.recipient_chat_id))throw Error('invalid_outbox_recipient');
  try{
   const contact=cfg.production?await staffContact(cfg,env,fetcher,row.reference):null;
   const text=cfg.production?productionAlert(row.reference,contact):`PREVIEW TEST — fact find submitted\nReference: ${row.reference}\nIntake: landing-preview / pipeline.web_leads\nSynthetic test only. Ads remain on hold.`;
   const r=await request(fetcher,`https://api.telegram.org/bot${cfg.token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:cfg.production?(row.recipient_chat_id||env.FF_ALERT_CHAT_ID):env.FF_ALERT_CHAT_ID,text})});
   const data=await r.json();
   if(r.ok&&data.ok&&Number.isSafeInteger(data.result?.message_id)){outcome='sent';messageId=data.result.message_id;}
   // Explicit rejection (including rate limiting) is safe to retry; 5xx/timeout/invalid reply is uncertain.
   else if(!data.ok&&r.status>=400&&r.status<500){outcome='rejected';retry=Math.max(retry,Number(data.parameters?.retry_after)||0);}
  }catch{/* ambiguous: never blind retry */}
  result[outcome]++;
  try{if(await rpc('finish',{p_id:row.id,p_lease_id:row.lease_id,p_result:outcome,p_message_id:messageId,p_retry_seconds:Math.min(retry,86400)})!==true)throw Error('lost_lease');}
  catch{result.ok=false;result.unrecorded++;} // DB lease expires to unknown, not automatically re-sent.
 }
 return result;
}
