// Sole Fact Find writer. Existing headers only; no legacy/call-sheet mutations.
import {normalise,calculate} from './factfind-contract.js';
import {assertSheetsWrite,isPreview,STAGING_SHEET_ID,SheetsWriteDenied} from './sheets-guard.js';
export const RAW='Raw Leads', CLEAN='✨ Pipeline Clean';
export const MASTER='1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';
const START='[POSFIN_FACTFIND_V1]', END='[/POSFIN_FACTFIND_V1]';
const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
// Preview may only target the approved staging sheet (exact match, no fallback).
export function sheetId(){if(isPreview()){if(process.env.FACTFIND_SHEET_ID!==STAGING_SHEET_ID)throw new SheetsWriteDenied('Preview requires FACTFIND_SHEET_ID to be the approved staging sheet');return STAGING_SHEET_ID;}return process.env.FACTFIND_SHEET_ID||MASTER;}
export function unpack(text=''){const a=text.indexOf(START),b=text.indexOf(END,a);if(a<0||b<0)return null;return JSON.parse(text.slice(a+START.length,b));}
function pack(text='',value){const a=text.indexOf(START),b=text.indexOf(END,a);const kept=a>=0&&b>=0?text.slice(0,a)+text.slice(b+END.length):text;return kept.trim()+'\n'+START+JSON.stringify(value)+END;}
export async function readTable(sheets,id,tab){const r=await sheets.spreadsheets.values.get({spreadsheetId:id,range:`'${tab}'!A:AF`});const [headers,...rows]=r.data.values||[];if(!headers)throw Error('Missing '+tab);return {headers,rows};}
const phone=v=>{let p=String(v||'').replace(/\D/g,'');return p.startsWith('0')?'44'+p.slice(1):p;};
const email=v=>String(v||'').trim().toLowerCase();
// Find the canonical (non-DUPLICATE-MERGED) row for a deal_ref.
// Returns undefined if no match, or the single canonical match.
// If multiple non-DUPLICATE-MERGED rows exist (unresolved prior race),
// returns them all for the caller to merge — never throws.
export function findRaw(table,d){
  const h=table.headers;
  const refIdx=h.indexOf('Lead Ref'), stageIdx=h.indexOf('Lead Stage');
  const matches=table.rows.map((r,i)=>({r,i})).filter(({r})=>{
    if(r[refIdx]!==d.deal_ref)return false;
    if(stageIdx>=0&&String(r[stageIdx]||'').startsWith('DUPLICATE-MERGED'))return false;
    return true;
  });
  if(matches.length<=1)return matches[0];
  // Multiple unmerged rows exist — return all for dedup
  return matches;
}

// Resolve duplicates: merge all non-DUPLICATE-MERGED rows for a deal_ref into
// one canonical row. Writes the merged state to the keeper, marks extras as
// DUPLICATE-MERGED, and rebuilds visible columns from merged answers.
async function resolveDuplicates(sheets,id,table,dupes){
  const summaryIdx=table.headers.indexOf('Tom Summary');
  // Sort by row number to pick a stable keeper (earliest row)
  dupes.sort((a,b)=>a.i-b.i);
  const keeper=dupes[0];
  let mergedState=unpack(keeper.r[summaryIdx]||'');
  for(const dupe of dupes.slice(1)){
    const dupeState=unpack(dupe.r[summaryIdx]||'');
    mergedState=mergeStates(mergedState,dupeState);
    await markDuplicate(sheets,id,RAW,table.headers,dupe.i+2,keeper.i+2);
  }
  // Write merged state back to the keeper row with rebuilt visible columns
  const md=normalise(mergedState.answers);
  const mergedRecord={
    'Name':`${md.first_name} ${md.last_name}`.trim(),
    'Phone':phone(md.mobile),'Email':md.email||'',
    'Lead Ref':md.deal_ref,
    'Tom Summary':pack(keeper.r[summaryIdx]||'',mergedState),
    '👣 Lead Touch / Progress':mergedState.progress||'',
  };
  if(mergedState.declined)mergedRecord['Lead Stage']='Below minimum value';
  else if(mergedState.completed&&md.intake_type==='pa_land')mergedRecord['Lead Stage']='FACT FIND COMPLETE — LAND EVIDENCE REVIEW';
  else if(mergedState.completed)mergedRecord['Lead Stage']='FACT FIND COMPLETE';
  await write(sheets,id,RAW,table,keeper.i,mergedRecord);
  return {mergedState,keeper};
}

function required(headers,names){for(const name of names)if(!headers.includes(name))throw Error('Missing existing header: '+name);}
// New rows use AppendCellsRequest, never values.append. values.append always
// runs table detection inside its range and writes from the detected table's
// first column; on the live tabs (blank/isolated header cells) A:AF anchored
// at AC/AE, and narrower ranges (A:A, A1) still stop at the first gap in
// column A. AppendCells writes after the last row with data in the sheet,
// starting at column A, as one atomic append (same race profile as before).
// It returns no row number, so the row is located by reading the tab back.
const cell=v=>v===''||v===null||v===undefined?{}:{userEnteredValue:typeof v==='number'?{numberValue:v}:typeof v==='boolean'?{boolValue:v}:{stringValue:String(v)}};
async function appendRow(sheets,id,tab,headers,row){
 const meta=await sheets.spreadsheets.get({spreadsheetId:id,fields:'sheets.properties(sheetId,title)'});
 const sheet=(meta.data.sheets||[]).find(s=>s.properties?.title===tab);if(!sheet)throw Error('Missing '+tab);
 await sheets.spreadsheets.batchUpdate({spreadsheetId:id,requestBody:{requests:[{appendCells:{sheetId:sheet.properties.sheetId,fields:'userEnteredValue',rows:[{values:row.map(cell)}]}}]}});
 // Match on the string cells written (numbers may read back formatted); the
 // packed Tom Summary carries updated_at, so the last match is this append.
 const fresh=await readTable(sheets,id,tab),keys=row.map((v,i)=>[i,v]).filter(([,v])=>typeof v==='string'&&v!=='');
 for(let i=fresh.rows.length-1;i>=0;i--)if(keys.every(([c,v])=>fresh.rows[i][c]===v))return i+2;
 throw Error('Appended row not found in '+tab);
}
async function write(sheets,id,tab,table,index,record){assertSheetsWrite(id);required(table.headers,Object.keys(record));if(index===undefined)return appendRow(sheets,id,tab,table.headers,table.headers.map(h=>record[h]??''));const data=Object.entries(record).map(([h,v])=>({range:`'${tab}'!${col(table.headers.indexOf(h))}${index+2}`,values:[[v]]}));await sheets.spreadsheets.values.batchUpdate({spreadsheetId:id,requestBody:{valueInputOption:'RAW',data}});return index+2;}
export function qualification(input){const d=normalise(input),missing=[];if(d.property_value>0&&d.property_value<globalThis.PosfinIntakeConfig.thresholds.minimum_security_value)missing.push('Below minimum value');if(d.intake_type==='pa_land')return {eligible:false,missing:['Land evidence and independent valuation review required'],land:globalThis.PosfinLand.assess(d)};for(const [k,label] of [['first_charge_balance','Exact non-negative mortgage balance'],['second_charge_balance','Exact non-negative second-charge balance'],['first_charge_arrears_amount','Exact non-negative arrears amount']])if(d[k]===null)missing.push(label);for(const [k,label] of [['property_address','Security address'],['exit_strategy','Exit strategy'],['loan_purpose','Purpose of funds'],['second_charge_present','Second charge position']])if(!d[k]||d[k]==='not_sure')missing.push(label);if(!(d.property_value>0))missing.push('Exact property value');if(!(d.loan_amount>0))missing.push('Exact loan amount');const c=calculate(d);if(c.ltv===null||c.ltv>70)missing.push('Broker review: combined LTV');return {eligible:missing.length===0,missing};}
// Serialises one server instance. Cross-instance races are caught by post-write
// duplicate detection: after appending, re-read the tab, merge field-by-field
// (latest non-empty value wins) into the earliest row, and mark extras as
// DUPLICATE-MERGED. No data is deleted — the extra row stays with a pointer.
//
// STOPGAP: this sheet-level dedup is a best-effort measure until Supabase
// case_completion becomes the write authority in Section 1, where true
// idempotency_key dedup and version-gated writes replace sheet races entirely.
let tail=Promise.resolve();
export function saveIntake(...args){const run=tail.then(()=>save(...args));tail=run.catch(()=>{});return run;}

// Merge two packed states field-by-field. "Latest" is determined by updated_at.
// For each answer key, the later state's non-empty value wins. Explicit 0 and
// false are values, not empty — only null/undefined/'' are treated as absent.
function mergeStates(a, b) {
  if (!a) return b;
  if (!b) return a;
  // Determine which is later by updated_at timestamp
  const aTime = new Date(a.updated_at || 0).getTime();
  const bTime = new Date(b.updated_at || 0).getTime();
  const [older, newer] = aTime <= bTime ? [a, b] : [b, a];
  const merged = { ...older };
  merged.answers = { ...older.answers };
  for (const [k, v] of Object.entries(newer.answers || {})) {
    // Explicit 0 and false are values — only null/undefined/'' are absent
    if (v !== null && v !== undefined && v !== '') merged.answers[k] = v;
    else if (v === 0 || v === false) merged.answers[k] = v;
  }
  merged.updated_at = newer.updated_at || older.updated_at;
  merged.created_at = older.created_at || newer.created_at;
  merged.progress = newer.progress || older.progress;
  if (newer.completed) merged.completed = true;
  if (newer.declined) merged.declined = true;
  merged.no_chase = merged.declined;
  merged.product = newer.product || older.product;
  merged.intake_nonce = newer.intake_nonce || older.intake_nonce;
  return merged;
}

// Mark a duplicate row as DUPLICATE-MERGED with a pointer to the kept row.
// The row's data is preserved — only Lead Stage is overwritten.
async function markDuplicate(sheets, id, tab, headers, rowNumber, keptRowNumber) {
  const stageIdx = headers.indexOf('Lead Stage');
  if (stageIdx < 0) return;
  assertSheetsWrite(id);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: id,
    requestBody: { valueInputOption: 'RAW', data: [
      { range: `'${tab}'!${col(stageIdx)}${rowNumber}`, values: [[`DUPLICATE-MERGED → row ${keptRowNumber}`]] },
    ]},
  });
}

async function save(sheets,id,input,product,url,tokenValid){
 let table=await readTable(sheets,id,RAW);required(table.headers,['Name','Phone','Email','Lead Ref','Tom Summary','Lead Stage','👣 Lead Touch / Progress']);
 let d=normalise(input);

 // Phase 1: resolve any pre-existing unmerged duplicates from prior races.
 // findRaw returns an array when multiple non-DUPLICATE-MERGED rows exist.
 let rawResult=findRaw(table,d);
 if(Array.isArray(rawResult)){
   const {mergedState,keeper}=await resolveDuplicates(sheets,id,table,rawResult);
   // Re-read table after merge so subsequent findRaw sees the marks
   table=await readTable(sheets,id,RAW);
   rawResult=findRaw(table,d);
 }
 let match=Array.isArray(rawResult)?undefined:rawResult;
 const old=match?unpack(match.r[table.headers.indexOf('Tom Summary')]||''):null;
 if(!match){const existing=await readTable(sheets,id,CLEAN);const ci=existing.headers.indexOf('🔖 Case ID');if(existing.rows.some(r=>r[ci]===d.deal_ref)&&!tokenValid(d.deal_ref))throw Error('Existing case requires its authorised resume link');}
 if(old&&!tokenValid(old.answers.deal_ref)&&!(input.intake_nonce&&input.intake_nonce===old.intake_nonce))throw Error('Resume link required for this Fact Find');
 // Never expose/rebind a historical case by contact match alone.
 if(match&&!old&&!tokenValid(d.deal_ref))throw Error('Existing lead requires internal identity review');
 if(old)d=normalise({...old.answers,...input,deal_ref:old.answers.deal_ref});
 let declined=d.property_value>0&&d.property_value<globalThis.PosfinIntakeConfig.thresholds.minimum_security_value;
 d.no_chase=declined;
 const partial=!declined&&(input.route_check_stage==='router_initial'||input.route_check_stage==='progress');
 const previousComplete=old?.completed===true;
 let completed=previousComplete||!partial;
 if(previousComplete&&partial)return {ok:true,leadRef:d.deal_ref,partial:false,alreadyCompleted:true,rawLeadRow:match.i+2};
 const now=new Date().toISOString(),progress=declined?'BELOW_MINIMUM_VALUE':completed?'FACT_FIND_COMPLETE':'ABANDONED_STEP_'+Math.min(4,Math.max(1,Number(input.progress_step)||1));
 delete d.resume_token; delete d.intake_nonce;
 const state={intake_nonce:old?.intake_nonce||input.intake_nonce,version:'factfind-v1',answers:d,product,completed,declined,no_chase:declined,created_at:old?.created_at||now,updated_at:now,progress};
 const record={'Name':`${d.first_name} ${d.last_name}`.trim(),'Phone':phone(d.mobile),'Email':d.email||'','Lead Ref':d.deal_ref,'Tom Summary':pack(match?.r[table.headers.indexOf('Tom Summary')]||'',state),'👣 Lead Touch / Progress':progress};
 if(!match){record[table.headers[0]]=now;record['Lead Stage']='NEW — FACT FIND';}
 if(completed&&d.intake_type==='pa_land')record['Lead Stage']='FACT FIND COMPLETE — LAND EVIDENCE REVIEW';
 if(declined){record['Lead Stage']='Below minimum value';state.answers.no_chase=true;record['Tom Summary']=pack(match?.r[table.headers.indexOf('Tom Summary')]||'',state);}
 let rawRow=await write(sheets,id,RAW,table,match?.i,record);

 // Phase 2: post-append dedup. If we just appended a new row, re-read to catch
 // cross-instance races. Merge all duplicates by updated_at, mark extras.
 // Then re-derive d/state/record from merged answers for downstream use.
 if(!match){
   const fresh=await readTable(sheets,id,RAW);
   const freshResult=findRaw(fresh,d);
   if(Array.isArray(freshResult)&&freshResult.length>1){
     const {mergedState,keeper}=await resolveDuplicates(sheets,id,fresh,freshResult);
     // Re-derive all downstream state from merged answers
     d=normalise(mergedState.answers);
     state.answers=d;
     state.completed=mergedState.completed||state.completed;
     state.declined=mergedState.declined||state.declined;
     state.no_chase=state.declined;
     state.progress=mergedState.progress||state.progress;
     state.updated_at=mergedState.updated_at>state.updated_at?mergedState.updated_at:state.updated_at;
     state.created_at=mergedState.created_at||state.created_at;
     state.intake_nonce=mergedState.intake_nonce||state.intake_nonce;
     completed=state.completed;
     declined=state.declined;
     record.Name=`${d.first_name} ${d.last_name}`.trim();
     record.Phone=phone(d.mobile);
     record.Email=d.email||'';
     record['Tom Summary']=pack('',state);
     record['👣 Lead Touch / Progress']=state.progress;
     if(completed&&d.intake_type==='pa_land')record['Lead Stage']='FACT FIND COMPLETE — LAND EVIDENCE REVIEW';
     else if(declined){record['Lead Stage']='Below minimum value';}
     await write(sheets,id,RAW,fresh,keeper.i,record);
     rawRow=keeper.i+2;
   }
 }

 // Qualification, Clean projection, alerts — all use the (possibly merged) d and state
 const q=qualification(d);let cleanRow=null,isNewCleanRow=false;
 if(completed&&!declined&&q.eligible){const clean=await readTable(sheets,id,CLEAN);required(clean.headers,['🔖 Case ID','📊 Scorecard link']);const hits=clean.rows.map((r,i)=>({r,i})).filter(({r})=>r[clean.headers.indexOf('🔖 Case ID')]===d.deal_ref);if(hits.length>1)throw Error('Duplicate Clean case ID');const existing=hits[0],c=calculate(d);
 const mapped={'👤 Borrower':record.Name,'📞 Mobile / WhatsApp':record.Phone,'📧 Email':record.Email,'Router completed Y/N':'YES','🏠 Security address':d.property_address,'📊 Stated value':d.property_value,'💷 Net req':c.cash,'🏦 1st charge provider':d.first_charge_lender,'💸 1st charge £':d.first_charge_balance,'🚨 Arrears Y/N':d.first_charge_arrears_amount>0?'YES':'NO','🚨 Arrears £':d.first_charge_arrears_amount,'🏦 2nd charge lender':d.second_charge_provider,'💸 2nd charge £':d.second_charge_balance,'🔁 Mandatory redemptions':c.arrears+c.second,'📊 Scorecard link':url,'🔖 Case ID':d.deal_ref};
 if(!existing){isNewCleanRow=true;Object.assign(mapped,{'🚦 Status ▼':'TRIAGE','🧑‍💼 Sales owner ▼':d.assigned_broker||'Byron','🎯 Next action':'Review Fact Find and confirm requirements','❓ Missing/open items':'Broker qualification pending','⚡ Route':product});
 }
 cleanRow=await write(sheets,id,CLEAN,clean,existing?.i,mapped);
 }
 const brokerAlertDue = cleanRow !== null && isNewCleanRow;
 if(brokerAlertDue){
   state.broker_alert_sent = false;
   const freshForAlert=await readTable(sheets,id,RAW);
   const keeperResult=findRaw(freshForAlert,d);
   const keeperForAlert=Array.isArray(keeperResult)?keeperResult[0]:keeperResult;
   if(keeperForAlert)await write(sheets,id,RAW,freshForAlert,keeperForAlert.i,{'Tom Summary':pack(keeperForAlert.r[freshForAlert.headers.indexOf('Tom Summary')]||'',state)});
 }
 return {ok:true,declined,no_chase:declined,declineMessage:declined?globalThis.PosfinIntakeConfig.decline_copy:null,leadRef:d.deal_ref,partial:!completed,rawLeadRow:rawRow,pipelineRow:cleanRow,pipeline:!!cleanRow,qualification:q,scorecardUrl:completed?url:null,firstCompletion:completed&&!previousComplete,brokerAlertDue};
}
export async function readCase(sheets,id,ref){
  const table=await readTable(sheets,id,RAW);
  const result=findRaw(table,{deal_ref:ref});
  // Array means multiple unmerged rows — take the first (oldest) as canonical
  const hit=Array.isArray(result)?result[0]:result;
  if(!hit)return null;
  const j=table.headers.indexOf('Tom Summary');
  return {table,...hit,state:unpack(hit.r[j]||'')};
}
export async function recordClick(sheets,id,ref){const hit=await readCase(sheets,id,ref);if(!hit?.state?.completed)return false;if(hit.state.answers.whatsapp_cta_clicked_at)return true;hit.state.answers.whatsapp_cta_clicked_at=new Date().toISOString();await write(sheets,id,RAW,hit.table,hit.i,{'Tom Summary':pack(hit.r[hit.table.headers.indexOf('Tom Summary')],hit.state)});return true;}

export async function markAlertSent(sheets,id,ref){
  const hit=await readCase(sheets,id,ref);
  if(!hit?.state)return false;
  if(hit.state.broker_alert_sent)return true;
  hit.state.broker_alert_sent=new Date().toISOString();
  await write(sheets,id,RAW,hit.table,hit.i,{'Tom Summary':pack(hit.r[hit.table.headers.indexOf('Tom Summary')],hit.state)});
  return true;
}
