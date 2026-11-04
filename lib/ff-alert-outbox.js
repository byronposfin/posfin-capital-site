// Server-only preview worker. Credentials never enter the browser or returned payload.
export const PREVIEW_DB='https://imcqwhccwsuglkzaxazg.supabase.co';
export function alertConfig(env=process.env){
 const enabled=env.FF_ALERT_DURABLE==='true';
 const isolated=env.VERCEL_ENV==='preview'&&env.FF_TEST_RUN==='true'&&env.FF_SUPABASE_URL===PREVIEW_DB;
 return {enabled,ok:enabled&&isolated&&!!env.FF_ALERT_SERVICE_KEY&&!!env.FF_ALERT_BOT_TOKEN&&!!env.FF_ALERT_CHAT_ID};
}
async function request(fetcher,url,options){
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),6000);
 try{return await fetcher(url,{...options,signal:ac.signal});}finally{clearTimeout(timer);}
}
export async function drainAlerts(env=process.env,fetcher=fetch){
 if(!alertConfig(env).ok)return {ok:false,error:'alert_worker_not_configured'};
 const rpc=async(name,args)=>{
  const r=await request(fetcher,`${PREVIEW_DB}/rest/v1/rpc/web_lead_alert_${name}`,{method:'POST',headers:{apikey:env.FF_ALERT_SERVICE_KEY,Authorization:`Bearer ${env.FF_ALERT_SERVICE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
  if(!r.ok)throw Error('outbox_storage_unavailable');return r.json();
 };
 // Claim only one per invocation: transport + status readback fit a short serverless request.
 const rows=await rpc('claim',{p_limit:1});
 const result={ok:true,claimed:rows.length,sent:0,rejected:0,unknown:0,unrecorded:0};
 for(const row of rows){
  let outcome='unknown',messageId=null,retry=60*Math.pow(2,Math.max(0,row.attempts-1));
  if(!/^TEST-WEB-[A-Z2-9]{6}$/.test(row.reference))throw Error('invalid_outbox_reference');
  try{
   const r=await request(fetcher,`https://api.telegram.org/bot${env.FF_ALERT_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.FF_ALERT_CHAT_ID,text:`PREVIEW TEST — fact find submitted\nReference: ${row.reference}\nIntake: landing-preview / pipeline.web_leads\nSynthetic test only. Ads remain on hold.`})});
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
