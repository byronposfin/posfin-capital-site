// Preview Google Sheets write gate. Production (any VERCEL_ENV other than
// 'preview') is untouched. In Preview a write is allowed only when
// FACTFIND_SHEET_ID is exactly the approved staging sheet AND
// FACTFIND_STAGING_WRITES is exactly 'true', and the call targets that sheet.
// No trimming or case-folding: anything else fails closed.
export const STAGING_SHEET_ID='17E60hrVFtl5WJ8pqpO74dk5DY7kOvJ5R0jD0XH-GRMw';

export class SheetsWriteDenied extends Error{
 constructor(reason){super('Sheets write denied: '+reason);this.name='SheetsWriteDenied';this.code='SHEETS_WRITE_DENIED';this.reason=reason;}
}

export const isPreview=(env=process.env)=>env.VERCEL_ENV==='preview';

// Reason the staging target is not approved, or null when it is.
export function stagingWriteDenial(env=process.env){
 if(env.FACTFIND_SHEET_ID!==STAGING_SHEET_ID)return 'FACTFIND_SHEET_ID is not the approved staging sheet';
 if(env.FACTFIND_STAGING_WRITES!=='true')return 'FACTFIND_STAGING_WRITES is not exactly true';
 return null;
}

// Route preflight: call before any writer side effect. null outside Preview.
export const previewWriteDenial=(env=process.env)=>isPreview(env)?stagingWriteDenial(env):null;

// Spreadsheet a legacy route should use. Production keeps its own ID unchanged;
// Preview is redirected to staging or throws.
export function resolveWriteTarget(productionId,env=process.env){
 if(!isPreview(env))return productionId;
 const denial=stagingWriteDenial(env);if(denial)throw new SheetsWriteDenied(denial);
 return STAGING_SHEET_ID;
}

// Per-call assertion used by shared write helpers.
export function assertSheetsWrite(spreadsheetId,env=process.env){
 if(!isPreview(env))return;
 const denial=stagingWriteDenial(env);if(denial)throw new SheetsWriteDenied(denial);
 if(spreadsheetId!==STAGING_SHEET_ID)throw new SheetsWriteDenied('target spreadsheet is not the approved staging sheet');
}

// Wrap a googleapis sheets client. Outside Preview the client is returned as-is.
// In Preview only known read methods pass through; every other method
// (append/update/batchUpdate/clear/create/copyTo/...) is treated as a write.
const READS=new Set(['get','getByDataFilter','values.get','values.batchGet','values.batchGetByDataFilter']);
// Writes whose destination is not params.spreadsheetId (copyTo targets
// requestBody.destinationSpreadsheetId). Unused by this codebase: deny outright.
const DENIED=new Set(['sheets.copyTo']);
const NESTED=new Set(['values','sheets','developerMetadata']);
// A write may be called as (params) or (params, callback) only. googleapis lets a
// second options argument override url/rootUrl, which would redirect the request
// away from the checked spreadsheetId. spreadsheetId is read once and pinned so a
// getter cannot report staging to the check and something else to the request.
function guardedWrite(fn,t,name,env){
 return (params,options,callback)=>{
  if(DENIED.has(name))throw new SheetsWriteDenied(name+' is not permitted in Preview');
  if(!params||typeof params!=='object')throw new SheetsWriteDenied('write params must be an object');
  if(options!==undefined&&typeof options!=='function')throw new SheetsWriteDenied('request options are not permitted on Preview writes');
  if(callback!==undefined)throw new SheetsWriteDenied('unexpected extra argument on Preview write');
  const spreadsheetId=params.spreadsheetId;
  assertSheetsWrite(spreadsheetId,env);
  const pinned={...params,spreadsheetId};
  return options===undefined?fn.call(t,pinned):fn.call(t,pinned,options);
 };
}
// Proxies sit on a blank target: googleapis defines resources as read-only,
// non-configurable properties, which a Proxy over the real object may not replace.
function wrap(t,path,env){
 return new Proxy(Object.create(null),{get(_,k){
  const v=Reflect.get(t,k);if(typeof k!=='string')return v;
  const name=path?path+'.'+k:k;
  if(typeof v==='function'){
   if(READS.has(name))return v.bind(t);
   return guardedWrite(v,t,name,env);
  }
  return v&&typeof v==='object'&&NESTED.has(k)?wrap(v,name,env):v;
 }});
}
export function guardSheets(sheets,env=process.env){
 if(!isPreview(env))return sheets;
 const spreadsheets=wrap(sheets.spreadsheets,'',env);
 return new Proxy(Object.create(null),{get:(_,k)=>k==='spreadsheets'?spreadsheets:Reflect.get(sheets,k)});
}
