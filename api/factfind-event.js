import {google} from 'googleapis';
import {validToken} from '../lib/scorecard-access.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).end();
 try{
 const {ref,token,event}=req.body||{};
 if(event!=='whatsapp_cta_clicked'||!validToken(ref,token))return res.status(403).json({ok:false});
 if(process.env.VERCEL_ENV==='preview'&&process.env.FACTFIND_STAGING_WRITES!=='true')return res.status(200).json({ok:true,dryRun:true});
 const spreadsheetId=process.env.FACTFIND_SHEET_ID||'1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';
 const credentials=JSON.parse(Buffer.from(process.env.GOOGLE_SA_B64,'base64').toString());
 const sheets=google.sheets({version:'v4',auth:new google.auth.GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/spreadsheets']})});
 const result=await sheets.spreadsheets.values.get({spreadsheetId,range:"'Pipeline V1.0'!A:ZZ"});
 const [headers,...rows]=result.data.values||[];const idx=headers.indexOf('🔖 Ref'),eventCol=headers.indexOf('whatsapp_cta_clicked_at'),jsonCol=headers.indexOf('scorecard_json');
 const ri=rows.findIndex(r=>r[idx]===ref);if(ri<0||eventCol<0||jsonCol<0)return res.status(404).json({ok:false});
 const r=rows[ri];if(r[eventCol])return res.status(200).json({ok:true});
 const stamp=new Date().toISOString();const payload=JSON.parse(r[jsonCol]||'{}');payload.answers={...payload.answers,whatsapp_cta_clicked_at:stamp};
 const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 await sheets.spreadsheets.values.batchUpdate({spreadsheetId,requestBody:{valueInputOption:'RAW',data:[{range:`'Pipeline V1.0'!${col(eventCol)}${ri+2}`,values:[[stamp]]},{range:`'Pipeline V1.0'!${col(jsonCol)}${ri+2}`,values:[[JSON.stringify(payload)]]}]}});
 return res.status(200).json({ok:true});
 }catch(e){console.error('[Fact Find event]',e.message);return res.status(500).json({ok:false});}
}
