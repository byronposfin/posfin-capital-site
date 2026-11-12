import {landFields,LAND_PAGES} from './ff-land-fields.js';
import {visible,validateLand,belowMinimum,DECLINE_COPY,renderLandScorecard} from './ff-land.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createLandJourney({host,request,getCode,setCode,onReturn,testMode}){
 let answers={},page=0,busy=false,active=false,carried=new Set();
 const status=t=>{host.querySelector('[data-status]').textContent=t;};
 function collect(){
  for(const e of host.querySelectorAll('[data-field]'))if(!e.disabled)answers[e.dataset.field]=e.type==='checkbox'?e.checked:e.value;
  const rows=[...host.querySelectorAll('[data-charge]')];
  if(rows.length)answers.charges=rows.map(row=>Object.fromEntries([...row.querySelectorAll('[data-key]')].map(e=>[e.dataset.key,e.value])));
  answers.land_page=page;return answers;
 }
 const input=f=>{const v=answers[f.key]===null&&f.type==='number'?'Not sure':answers[f.key],id='land_'+f.key;
  if(f.type==='charges')return `<div><label>${esc(f.label)}</label>${(answers.charges||[]).map((c,i)=>`<fieldset data-charge><legend>Loan ${i+1}</legend>${[['lender','Lender'],['balance','Balance (£), or Not sure'],['payment_or_rate','Monthly payment or rate'],['position','First charge / second charge (sometimes called junior or mezzanine debt)'],['titles','Parcels / titles covered'],['status','End date, arrears or default rate'],['redemption','Redemption figure / reduced settlement negotiations']].map(([k,l])=>`<label>${esc(l)}<input type="text" data-key="${k}" value="${esc(k==='balance'&&c[k]===null?'Not sure':c[k])}"></label>`).join('')}<button type="button" data-remove="${i}">Remove loan</button></fieldset>`).join('')}<button type="button" data-add>Add loan</button><p data-error="charges"></p></div>`;
  let el=f.type==='bool'?`<input type="checkbox" data-field="${f.key}" id="${id}" ${v===true?'checked':''}>`:f.options?`<select id="${id}" data-field="${f.key}"><option value="">Please select</option>${f.options.map(o=>`<option ${String(v)===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea id="${id}" data-field="${f.key}">${esc(v)}</textarea>`:`<input type="text" id="${id}" data-field="${f.key}" value="${esc(v)}" ${f.type==='number'?'inputmode="numeric"':''}>`;
  return `<div class="full"><label class="l" for="${id}">${esc(f.key==='loan_amount'&&answers.loan_basis==='Gross borrowing amount'?'Amount already requested (gross £)':f.label)}</label>${el}<div class="err" data-error="${f.key}"></div></div>`;
 };
 function fields(){return landFields.filter(f=>f.page===page&&visible(f,answers)&&!(page===0&&carried.has(f.key))&&!(f.key==='loan_purpose'&&carried.has('purpose')));}
 function render(){
  host.innerHTML=`<h2>L${page} · ${LAND_PAGES[page]}</h2><p>Land Fact Find · ${page+1} of 8. Unknown evidence can be marked Not sure; we will verify it.</p><div class="grid">${page===6&&carried.has('purpose')?`<p>Purpose already captured: ${esc(answers.purpose)}</p>`:''}${fields().map(input).join('')}${page===0&&testMode()?'<label><input type="checkbox" data-field="test_mode_ack" '+(answers.test_mode_ack?'checked':'')+'> I am using synthetic test details only</label>':''}</div><div class="actions"><button type="button" data-back>Back</button><button type="button" data-save>Save / Finish later</button><button type="button" class="btn btn-primary" data-next>${page===7?'Submit land Fact Find':'Continue'}</button></div><p data-status role="status"></p><div data-resume></div>`;
  link();host.querySelector('[data-back]').onclick=()=>{collect();if(page===0)return onReturn(answers);page--;render();};
  host.querySelector('[data-save]').onclick=()=>save();
  host.querySelector('[data-next]').onclick=next;
  host.querySelector('[data-add]')?.addEventListener('click',()=>{collect();answers.charges=[...(answers.charges||[]),{}];render();});
  for(const b of host.querySelectorAll('[data-remove]'))b.onclick=()=>{collect();answers.charges.splice(Number(b.dataset.remove),1);render();};
 }
 function link(){const c=getCode();host.querySelector('[data-resume]').innerHTML=c?`<p>Finish later on any device. Keep this link private:</p><a href="/fact-find?resume=${encodeURIComponent(c)}">Resume this case</a>`:'<p>Save to get your private Finish later link.</p>';}
 function errors(e){for(const [k,v] of Object.entries(e)){const el=host.querySelector(`[data-error="${k}"]`);if(el)el.textContent=v;}status('Please check the highlighted answers.');}
 async function save(){
  if(busy)return false;busy=true;collect();host.inert=true;status('Saving…');
  try {const {j}=await request({action:'save',code:getCode(),answers});if(!j.ok){status(j.message||'Not saved online. Please retry; keep this page open.');return false;}setCode(j.code);link();status('Saved securely. Your Finish later link keeps the same case.');return true;}
  catch{status('Not saved online. Please retry; keep this page open.');return false;}finally{busy=false;host.inert=false;}
 }
 async function next(){
  if(busy)return;collect();
  if(page===1&&answers.site_current_use==='Habitable dwelling in use'){active=false;return onReturn({...answers,asset_type:'Residential'});}
  if(page===1&&answers.funding_build==='Yes'){active=false;return onReturn({...answers,asset_type:'General Commercial',purpose:'Development finance / build costs'});}
  const v=validateLand(answers,true,testMode());
  const e=Object.fromEntries(Object.entries(v.errors).filter(([k])=>fields().some(f=>f.key===k)||(page===0&&k==='test_mode_ack')));
  // A valid below-minimum value is enough to decline without requiring later answers.
  if(page===1&&belowMinimum(answers)){
   if(!(await save()))return;
   host.innerHTML=`<h2>Below minimum value</h2><p>${esc(DECLINE_COPY)}</p><p>This outcome has been saved. No chase messages will be sent.</p><button type="button" data-correct>Correct the value</button><p data-status></p><div data-resume></div>`;
   host.querySelector('[data-correct]').onclick=()=>render();link();return;
  }
  if(Object.keys(e).length){errors(e);return;}
  if(page===7){
   if(Object.keys(v.errors).length){const k=Object.keys(v.errors)[0];page=landFields.find(f=>f.key===k)?.page??0;render();errors(v.errors);return;}
   if(!(await save()))return;busy=true;host.inert=true;status('Submitting your Land Fact Find…');
   try{const {j}=await request({action:'submit',code:getCode(),answers});if(!j.ok){errors(j.fieldErrors||{});status(j.message||'Not submitted. Please retry.');return;}
    host.innerHTML=`<h2>Land Fact Find saved</h2><p>Reference: ${esc(j.reference)}</p>${renderLandScorecard(j.answers||v.clean)}`;
   }catch{status('Submission could not be confirmed. Retry using the same case.');}finally{busy=false;host.inert=false;}return;
  }
  if(await save()){page++;answers.land_page=page;render();window.scrollTo({top:0,behavior:'smooth'});}
 }
 host.addEventListener('change',e=>{if(!e.target.dataset.field)return;collect();const before=[...host.querySelectorAll('[data-field]')].map(e=>e.dataset.field).join('|');const after=fields().filter(f=>f.type!=='charges').map(f=>f.key).join('|');if(before!==after)render();});
 return {get active(){return active;},start(a){answers={...a,asset_type:a.asset_type||'Land'};active=true;carried=new Set(Object.entries(a).filter(([,v])=>v!==''&&v!==undefined&&v!==null&&v!==false).map(([k])=>k));page=a.land_page??(landFields.filter(f=>f.page===0&&!f.optional).every(f=>carried.has(f.key))?1:0);host.hidden=false;render();},stop(){active=false;host.hidden=true;},collect};
}
