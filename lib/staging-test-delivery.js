// Explicit Byron-only acceptance lane. Never enabled in production.
const STAGING_SHEET='17E60hrVFtl5WJ8pqpO74dk5DY7kOvJ5R0jD0XH-GRMw';
export async function stagingTestDelivery(data,saved,scorecardUrl,{env=process.env,transport=fetch}={}) {
 if(env.FACTFIND_TEST_DELIVERY!=='byron-only')return null;
 if(env.VERCEL_ENV!=='preview'||env.FACTFIND_SHEET_ID!==STAGING_SHEET)throw new Error('Test delivery requires isolated preview');
 const phone=String(data.mobile||'').replace(/\D/g,'').replace(/^0/,'44');
 if(phone!=='447773339444'||String(data.email||'').toLowerCase()!=='byron.hill@posfincapital.com'||!/^DUMMY\b/i.test(data.first_name||''))return {held:true,reason:'Byron-only dummy recipient gate'};
 if(saved.declined||saved.partial||!saved.pipeline||!saved.firstCompletion)return {held:true,reason:'No new eligible completion'};
 const u=new URL(scorecardUrl);if(u.protocol!=='https:'||u.hostname!==env.VERCEL_URL)throw new Error('Test scorecard origin mismatch');
 if(!env.TELEGRAM_BOT_TOKEN)throw new Error('Test delivery credential unavailable');
 const ready=await transport(scorecardUrl,{method:'GET'});
 if(!ready.ok)return {held:true,reason:'Scorecard not readable; no test messages sent'};
 const results=[];
 for(const role of ['BORROWER','AGENT']){
  const response=await transport(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:'1750758657',text:`DUMMY ${role} — AUTOMATIC STAGING TEST\nRef: ${saved.leadRef}\nYour Fact Find is saved.\n${scorecardUrl}\nFictional case; no live lending action.`,disable_web_page_preview:true})});
  const body=await response.json();results.push({role,ok:response.ok&&body.ok===true,messageId:body.result?.message_id||null});
 }
 return {channel:'telegram',recipient:'Byron only',results};
}
