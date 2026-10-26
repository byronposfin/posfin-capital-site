import {google} from 'googleapis';
import {validToken,scorecardLink} from '../lib/scorecard-access.js';
import {readCase,sheetId} from '../lib/clean-intake.js';
import {guardSheets} from '../lib/sheets-guard.js';
import {render} from '../lib/factfind-contract.js';
import {renderTasks} from '../lib/smart-link.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Robots-Tag','noindex, nofollow');
 if(req.method!=='GET')return res.status(405).end();
 try{
 const ref=String(req.query.ref||'');if(!validToken(ref,req.query.token))return res.status(403).send('This private link is not valid. Please contact Posfin.');
 const credentials=JSON.parse(Buffer.from(process.env.GOOGLE_SA_B64,'base64').toString());
 const sheets=guardSheets(google.sheets({version:'v4',auth:new google.auth.GoogleAuth({credentials,scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']})}));
 const hit=await readCase(sheets,sheetId(),ref);
 if(!hit?.state?.completed)return res.status(404).send('Completed Fact Find not found.');
 const d={...hit.state.answers,scorecard_url:scorecardLink('',ref)};
 res.setHeader('Content-Type','text/html; charset=utf-8');
 if(hit.state.declined)return res.status(200).send('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/land.css"><title>Fact Find — Posfin Capital</title><main><h1>Thank you</h1><p>'+globalThis.PosfinLand.esc(globalThis.PosfinIntakeConfig.decline_copy)+'</p></main></html>');
 return res.status(200).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/land.css"><title>Posfin Client Access</title><meta name="description" content="Your case. Your next steps. Access anytime."><meta property="og:title" content="Posfin Client Access"><meta property="og:description" content="Your case. Your next steps. Access anytime."></head><body>'+(d.intake_type==='pa_land'?'':renderTasks(d))+render(d,ref)+'<script src="/factfind-events.js"></script></body></html>');
 }catch(e){console.error('[Scorecard]',e.message);return res.status(500).send('Unable to load your Fact Find.');}
}
