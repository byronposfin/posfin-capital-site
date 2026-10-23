// Writes only an explicitly approved dedicated staging tab, never the live Deals pipeline.
export const MIRROR_HEADERS=['Event ID','Case ID','Document ID','Kind','Signing Status'];
export function mirrorRows(job) {
 const p=job.payload;
 if(!/^TEST[-_]/.test(p.case_id||'') || !['archived','declined'].includes(p.status) || !p.document_id || job.document_id!==p.document_id)throw Error('Invalid test mirror event');
 if(!p.item_id)throw Error('Missing document item');
 return [[job.id,p.case_id,p.item_id,p.kind,p.status]];
}
export function sheetsMirror({sheets,spreadsheetId,allowedSpreadsheetId}) {
 if(!spreadsheetId || spreadsheetId!==allowedSpreadsheetId || spreadsheetId==='1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ')throw Error('Dedicated staging spreadsheet required');
 const range="'Signing Test Mirror'!A:E";
 return async job=>{
  const {data}=await sheets.spreadsheets.values.get({spreadsheetId,range});
  const existing=data.values||[];
  if(JSON.stringify(existing[0])!==JSON.stringify(MIRROR_HEADERS))throw Error('Staging mirror header mismatch');
  const row=Number(job.mirror_row);
  if(!Number.isSafeInteger(row)||row<2)throw Error('Missing reserved mirror row');
  const values=mirrorRows(job);
  const occupied=existing[row-1];
  if(occupied?.some(v=>v!=='') && JSON.stringify(occupied)!==JSON.stringify(values[0]))throw Error('Reserved mirror row conflict');
  // A durable row reservation makes timeout/restart replay an overwrite, not a duplicate append.
  await sheets.spreadsheets.values.update({spreadsheetId,range:`'Signing Test Mirror'!A${row}:E${row}`,valueInputOption:'RAW',requestBody:{values}});
 };
}
export async function deliverMirror({job,store,write}) {
 try{await write(job);}catch{await store.settle(job,false);return {delivered:false};}
 await store.settle(job,true);return {delivered:true};
}
