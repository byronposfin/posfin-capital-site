import {google} from 'googleapis';
import {stagingConfig} from '../lib/dropbox-sign.js';
import {supabase} from '../lib/supabase.js';
import {sheetsMirror,deliverMirror} from '../lib/signing-mirror.js';
stagingConfig();
if(process.env.SIGNING_PREVIEW_RELEASE_APPROVED!=='yes')throw Error('Preview release gate closed');
const auth=new google.auth.GoogleAuth({scopes:['https://www.googleapis.com/auth/spreadsheets']});
const write=sheetsMirror({sheets:google.sheets({version:'v4',auth}),spreadsheetId:process.env.SIGNING_TEST_SHEET_ID,allowedSpreadsheetId:process.env.SIGNING_APPROVED_TEST_SHEET_ID});
const db=await supabase();
const {data,error}=await db.rpc('claim_signing_delivery');if(error)throw error;
const job=data?.[0];
if(job){await deliverMirror({job,write,store:{settle:async(j,ok)=>{const {error}=await db.rpc('settle_signing_delivery',{p_id:j.id,p_lease:j.lease,p_success:ok});if(error)throw error;}}});}
console.log(job?'Staging mirror attempt finished; inspect queue result.':'No pending staging mirror.');
