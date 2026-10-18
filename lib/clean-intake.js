// Sole Fact Find writer. Existing headers only; no legacy/call-sheet mutations.
import {normalise,calculate} from './factfind-contract.js';
export const RAW='Raw Leads', CLEAN='✨ Pipeline Clean';
export const MASTER='1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';
const START='[POSFIN_FACTFIND_V1]', END='[/POSFIN_FACTFIND_V1]';
const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
export function sheetId(){const id=process.env.FACTFIND_SHEET_ID||MASTER;if(process.env.VERCEL_ENV==='preview'&&id===MASTER)throw Error('Preview requires an isolated FACTFIND_SHEET_ID');return id;}
export function unpack(text=''){const a=text.indexOf(START),b=text.indexOf(END,a);if(a<0||b<0)return null;return JSON.parse(text.slice(a+START.length,b));}
function pack(text='',value){const a=text.indexOf(START),b=text.indexOf(END,a);const kept=a>=0&&b>=0?text.slice(0,a)+text.slice(b+END.length):text;return kept.trim()+'\n'+START+JSON.stringify(value)+END;}
export async function readTable(sheets,id,tab){const r=await sheets.spreadsheets.values.get({spreadsheetId:id,range:`'${tab}'!A:AF`});const [headers,...rows]=r.data.values||[];if(!headers)throw Error('Missing '+tab);return {headers,rows};}
const phone=v=>{let p=String(v||'').replace(/\D/g,'');return p.startsWith('0')?'44'+p.slice(1):p;};
const email=v=>String(v||'').trim().toLowerCase();
export function findRaw(table,d){const h=table.headers;const matches=table.rows.map((r,i)=>({r,i})).filter(({r})=>r[h.indexOf('Lead Ref')]===d.deal_ref);if(matches.length>1)throw Error('Ambiguous Raw identity; internal review required');return matches[0];}

function required(headers,names){for(const name of names)if(!headers.includes(name))throw Error('Missing existing header: '+name);}
async function write(sheets,id,tab,table,index,record){required(table.headers,Object.keys(record));if(index===undefined){const row=table.headers.map(h=>record[h]??'');const result=await sheets.spreadsheets.values.append({spreadsheetId:id,range:`'${tab}'!A:AF`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[row]}});return Number(result.data.updates.updatedRange.match(/![A-Z]+(\d+)/)[1]);}const data=Object.entries(record).map(([h,v])=>({range:`'${tab}'!${col(table.headers.indexOf(h))}${index+2}`,values:[[v]]}));await sheets.spreadsheets.values.batchUpdate({spreadsheetId:id,requestBody:{valueInputOption:'RAW',data}});return index+2;}
export function qualification(input){const d=normalise(input),missing=[];for(const [k,label] of [['first_charge_balance','Exact non-negative mortgage balance'],['second_charge_balance','Exact non-negative second-charge balance'],['first_charge_arrears_amount','Exact non-negative arrears amount']])if(d[k]===null)missing.push(label);for(const [k,label] of [['property_address','Security address'],['exit_strategy','Exit strategy'],['loan_purpose','Purpose of funds'],['second_charge_present','Second charge position']])if(!d[k]||d[k]==='not_sure')missing.push(label);if(!(d.property_value>0))missing.push('Exact property value');if(!(d.loan_amount>0))missing.push('Exact loan amount');const c=calculate(d);if(c.ltv===null||c.ltv>70)missing.push('Broker review: combined LTV');return {eligible:missing.length===0,missing};}
// Serialises one server instance. Distributed retry/identity races require staging proof.
let tail=Promise.resolve();
export function saveIntake(...args){const run=tail.then(()=>save(...args));tail=run.catch(()=>{});return run;}
async function save(sheets,id,input,product,url,tokenValid){
 const table=await readTable(sheets,id,RAW);required(table.headers,['Name','Phone','Email','Lead Ref','Tom Summary','Lead Stage','👣 Lead Touch / Progress']);
 let d=normalise(input),match=findRaw(table,d);const old=match?unpack(match.r[table.headers.indexOf('Tom Summary')]||''):null;
 if(!match){const existing=await readTable(sheets,id,CLEAN);const ci=existing.headers.indexOf('🔖 Case ID');if(existing.rows.some(r=>r[ci]===d.deal_ref)&&!tokenValid(d.deal_ref))throw Error('Existing case requires its authorised resume link');}
 if(old&&!tokenValid(old.answers.deal_ref)&&!(input.intake_nonce&&input.intake_nonce===old.intake_nonce))throw Error('Resume link required for this Fact Find');
 // Never expose/rebind a historical case by contact match alone.
 if(match&&!old&&!tokenValid(d.deal_ref))throw Error('Existing lead requires internal identity review');
 if(old)d=normalise({...old.answers,...input,deal_ref:old.answers.deal_ref});
 const partial=input.route_check_stage==='router_initial'||input.route_check_stage==='progress';
 const previousComplete=old?.completed===true;
 const completed=previousComplete||!partial;
 if(previousComplete&&partial)return {ok:true,leadRef:d.deal_ref,partial:false,alreadyCompleted:true,rawLeadRow:match.i+2};
 const now=new Date().toISOString(),progress=completed?'FACT_FIND_COMPLETE':'ABANDONED_STEP_'+Math.min(4,Math.max(1,Number(input.progress_step)||1));
 delete d.resume_token; delete d.intake_nonce;
 const state={intake_nonce:old?.intake_nonce||input.intake_nonce,version:'factfind-v1',answers:d,product,completed,created_at:old?.created_at||now,updated_at:now,progress};
 const record={'Name':`${d.first_name} ${d.last_name}`.trim(),'Phone':phone(d.mobile),'Email':d.email||'','Lead Ref':d.deal_ref,'Tom Summary':pack(match?.r[table.headers.indexOf('Tom Summary')]||'',state),'👣 Lead Touch / Progress':progress};
 if(!match){record[table.headers[0]]=now;record['Lead Stage']='NEW — FACT FIND';}
 const rawRow=await write(sheets,id,RAW,table,match?.i,record);
 const q=qualification(d);let cleanRow=null,isNewCleanRow=false;
 if(completed&&q.eligible){const clean=await readTable(sheets,id,CLEAN);required(clean.headers,['🔖 Case ID','📊 Scorecard link']);const hits=clean.rows.map((r,i)=>({r,i})).filter(({r})=>r[clean.headers.indexOf('🔖 Case ID')]===d.deal_ref);if(hits.length>1)throw Error('Duplicate Clean case ID');const existing=hits[0],c=calculate(d);
 const mapped={'👤 Borrower':record.Name,'📞 Mobile / WhatsApp':record.Phone,'📧 Email':record.Email,'Router completed Y/N':'YES','🏠 Security address':d.property_address,'📊 Stated value':d.property_value,'💷 Net req':c.cash,'🏦 1st charge provider':d.first_charge_lender,'💸 1st charge £':d.first_charge_balance,'🚨 Arrears Y/N':d.first_charge_arrears_amount>0?'YES':'NO','🚨 Arrears £':d.first_charge_arrears_amount,'🏦 2nd charge lender':d.second_charge_provider,'💸 2nd charge £':d.second_charge_balance,'🔁 Mandatory redemptions':c.arrears+c.second,'📊 Scorecard link':url,'🔖 Case ID':d.deal_ref};
 if(!existing){isNewCleanRow=true;Object.assign(mapped,{'🚦 Status ▼':'TRIAGE','🧑‍💼 Sales owner ▼':d.assigned_broker||'Byron','🎯 Next action':'Review Fact Find and confirm requirements','❓ Missing/open items':'Broker qualification pending','⚡ Route':product});
 }
 cleanRow=await write(sheets,id,CLEAN,clean,existing?.i,mapped);
 }
 const brokerAlertDue = cleanRow !== null && isNewCleanRow;
 if(brokerAlertDue){
   state.broker_alert_sent = false;
   await write(sheets,id,RAW,table,rawRow-2,{'Tom Summary':pack(match?.r[table.headers.indexOf('Tom Summary')]||'',state)});
 }
 return {ok:true,leadRef:d.deal_ref,partial:!completed,rawLeadRow:rawRow,pipelineRow:cleanRow,pipeline:!!cleanRow,qualification:q,scorecardUrl:completed?url:null,firstCompletion:completed&&!previousComplete,brokerAlertDue};
}
export async function readCase(sheets,id,ref){const table=await readTable(sheets,id,RAW);const i=table.headers.indexOf('Lead Ref'),j=table.headers.indexOf('Tom Summary');const hits=table.rows.map((r,index)=>({r,index})).filter(({r})=>r[i]===ref);if(hits.length!==1)return null;const hit=hits[0];return {table,...hit,state:unpack(hit.r[j]||'')};}
export async function recordClick(sheets,id,ref){const hit=await readCase(sheets,id,ref);if(!hit?.state?.completed)return false;if(hit.state.answers.whatsapp_cta_clicked_at)return true;hit.state.answers.whatsapp_cta_clicked_at=new Date().toISOString();await write(sheets,id,RAW,hit.table,hit.index,{'Tom Summary':pack(hit.r[hit.table.headers.indexOf('Tom Summary')],hit.state)});return true;}

export async function markAlertSent(sheets,id,ref){
  const hit=await readCase(sheets,id,ref);
  if(!hit?.state)return false;
  if(hit.state.broker_alert_sent)return true;
  hit.state.broker_alert_sent=new Date().toISOString();
  await write(sheets,id,RAW,hit.table,hit.index,{'Tom Summary':pack(hit.r[hit.table.headers.indexOf('Tom Summary')],hit.state)});
  return true;
}
