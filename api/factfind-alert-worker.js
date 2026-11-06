import crypto from 'node:crypto';
import {drainAlerts} from '../lib/ff-alert-outbox.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 const reply=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 if(!['POST','GET'].includes(req.method))return reply(405,{ok:false});
 const expected=process.env.FF_ALERT_WORKER_SECRET||process.env.CRON_SECRET;
 const actual=String(req.headers.authorization||'').replace(/^Bearer /,'');
 if(!expected||expected.length<32||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return reply(401,{ok:false});
 try{const r=await drainAlerts();return reply(r.ok?200:503,r);}catch{return reply(503,{ok:false,error:'alert_worker_unavailable'});}
}
