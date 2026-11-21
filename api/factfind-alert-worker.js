import crypto from 'node:crypto';
import {drainAlerts} from '../lib/ff-alert-outbox.js';
import {drainLeadOps} from '../lib/lead-ops.js';
import {drainSheet} from '../lib/lead-sheet.js';
// Email and the sheet append are attempted even when Telegram is not configured.
// A channel that is switched off is not a failure. A configured channel that
// fails, or a staff/SLA/alarm/sheet row still unsent after two minutes, is.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 const reply=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 if(!['POST','GET'].includes(req.method))return reply(405,{ok:false});
 const expected=process.env.FF_ALERT_WORKER_SECRET||process.env.CRON_SECRET;
 const actual=String(req.headers.authorization||'').replace(/^Bearer /,'');
 if(!expected||expected.length<32||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return reply(401,{ok:false});
 let email,telegram,sheet;
 try{email=await drainLeadOps(process.env,fetch,{sla:true});}catch{email={ok:false,skipped:false,overdue:false};}
 try{sheet=await drainSheet(process.env,fetch);}catch{sheet={ok:false,skipped:false,overdue:false};}
 try{telegram=await drainAlerts();}catch{telegram={ok:false,error:'telegram_failed'};}
 const telegramState=telegram&&telegram.error==='alert_worker_not_configured'?'not_configured':telegram&&telegram.ok?'ok':'failed';
 const emailState=email&&email.skipped?'not_configured':email&&email.ok?'ok':'failed';
 const sheetState=sheet&&sheet.skipped?'not_configured':sheet&&sheet.ok?'ok':'failed';
 const ok=telegramState!=='failed'&&emailState!=='failed'&&sheetState!=='failed'&&!(email&&email.overdue)&&!(sheet&&sheet.overdue);
 return reply(ok?200:503,{ok,telegram:telegramState,email:emailState,sheet:sheetState,claimed:email&&email.claimed||0,sent:email&&email.sent||0,alarms:(email&&email.alarms||0)+(sheet&&sheet.alarms||0),escalations:email&&email.escalations||0,sheetSent:sheet&&sheet.sent||0});
}
