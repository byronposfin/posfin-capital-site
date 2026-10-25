// Synthetic loopback-only preview. No production credentials, database, or sends.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import fields from '../lib/field-maps/main-bridging.js';
import {analyseGaps,borrowerAllowlist} from '../lib/gap-engine.js';
const entries=Object.fromEntries(fields.filter(f=>f.owner==='borrower').map(f=>[f.key,{value:f.choices?.[0] ?? (f.type==='boolean'?false:['currency','number'].includes(f.type)?0:'Example only')} ]));
entries.first_name={value:'Alex'}; entries.last_name={value:'Example'};
delete entries.loan_amount; delete entries.exit_strategy;
const state={case_id:'TEST-LOCAL-001',version:1,fields:entries};
let owner='Byron'; const owners=['Byron','Chris','Tom Morrissey','Aadi','Cai','Jessica'];
const replay=new Set();
const view=()=>{const gaps=analyseGaps(state,'main_loan');return {...gaps,case_id:state.case_id,version:state.version,fields:state.fields};};
const body=async req=>{let value=''; for await(const chunk of req)value+=chunk;return JSON.parse(value||'{}');};
const shell=content=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SmartLink local preview</title><style>body{font:17px system-ui;color:#1C184F;max-width:760px;margin:30px auto;padding:20px;background:#f4faf9}nav{border-bottom:4px solid #00B5B0;padding:16px 0}main{background:white;padding:24px;border-radius:16px}button,select,input{font:inherit;box-sizing:border-box}button{background:#007c79;color:white;padding:14px;border:0;border-radius:8px;cursor:pointer}label,dt{display:block;font-weight:600;margin-top:18px}dd{margin:4px 0 12px}summary{cursor:pointer}fieldset{min-width:0}.sl-field{margin:20px 0}.demo{background:#fff0ce;padding:12px}</style><nav><img src="/brand.png" width="200" alt="Posfin Capital"><strong> · SmartLink</strong></nav><p class="demo">LOCAL PREVIEW · Fictional case · No CRM writes or messages</p><main>${content}</main></html>`;
http.createServer(async(req,res)=>{try{
 res.setHeader('Cache-Control','no-store');
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(req.url==='/brand.png'){res.setHeader('Content-Type','image/png');return res.end(await readFile(new URL('../email-signature--teal-transparency-600x100px.png',import.meta.url)));}
 if(req.url==='/smartlink-questionnaire.js'){res.setHeader('Content-Type','text/javascript');return res.end(await readFile(new URL('../public/smartlink-questionnaire.js',import.meta.url)));}
 if(req.url==='/api/demo-case'){
  if(req.method==='GET')return json(200,view());
  if(req.method==='PATCH'){
   const data=await body(req);
   if(replay.has(data.idempotency_key))return json(200,{replayed:true,version:state.version});
   if(data.expected_version!==state.version)return json(409,{error:'version_conflict'});
   for(const key of Object.keys(data.fields))if(!borrowerAllowlist('main_loan').has(key))return json(400,{error:'Not permitted'});
   for(const [key,value]of Object.entries(data.fields))state.fields[key]={value};
   state.version++; replay.add(data.idempotency_key);return json(200,view());
  }
 }
 if(req.url==='/api/demo-owner'){
  if(req.method==='POST'){const data=await body(req);if(!owners.includes(data.owner))return json(400,{error:'Unknown owner'});owner=data.owner;}
  return json(200,{owner});
 }
 res.setHeader('Content-Type','text/html');
 if(req.url==='/staff')return res.end(shell(`<h1>Call workspace</h1><p>TEST-LOCAL-001 · Alex Example</p><label for="owner">Case owner</label><select id="owner">${owners.map(name=>`<option${owner===name?' selected':''}>${name}</option>`).join('')}</select><p id="status" role="status">Owner saved in this local demo only.</p><p><a href="/">Open assisted Fact Find</a></p><p>Voice assignment is not connected in this preview.</p><script>document.querySelector('#owner').onchange=async e=>{const r=await fetch('/api/demo-owner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({owner:e.target.value})});document.querySelector('#status').textContent=r.ok?'Owner saved in local demo.':'Not saved';};</script>`));
 res.end(shell('<div id="smartlink-questionnaire" data-endpoint="/api/demo-case"></div><script type="module" src="/smartlink-questionnaire.js"></script>'));
 }catch{res.writeHead(500);res.end('Preview error');}
}).listen(8795,'127.0.0.1',()=>console.log('Local synthetic preview: http://127.0.0.1:8795/ and /staff'));
