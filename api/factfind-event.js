import {google} from 'googleapis';
import {validToken} from '../lib/scorecard-access.js';
import {recordClick,sheetId} from '../lib/clean-intake.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).end();
 try{const {ref,token,event}=req.body||{};if(event!=='whatsapp_cta_clicked'||!validToken(ref,token))return res.status(403).json({ok:false});
 if(process.env.VERCEL_ENV==='preview'&&process.env.FACTFIND_STAGING_WRITES!=='true')return res.status(200).json({ok:true,dryRun:true});
 const id=sheetId(),credentials=JSON.parse(Buffer.from(process.env.GOOGLE_SA_B64,'base64').toString());
 const sheets=google.sheets({version:'v4',auth:new google.auth.GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/spreadsheets']})});
 const found=await recordClick(sheets,id,ref);return res.status(found?200:404).json({ok:found});
 }catch(e){console.error('[Fact Find event]',e.message);return res.status(500).json({ok:false});}
}
