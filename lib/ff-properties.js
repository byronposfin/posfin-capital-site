import {money} from './ff-finance.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const PROPERTY_FIELDS=[
 ['address','Property address','text'],['postcode','Postcode','postcode'],['property_value','Estimated value','money'],
 ['first_charge_status','First mortgage status',['Mortgage in place','No mortgage','Not sure']],
 ['first_charge_lender','First-charge lender','text'],['first_charge_balance','First-charge balance','money'],
 ['arrears','Any mortgage arrears?',['No','Yes','Not sure']],['first_charge_arrears_amount','Arrears amount','money'],
 ['arrears_included_in_balance','Are arrears included in the balance?',['Balance includes arrears','Balance excludes arrears','Not sure']],
 ['has_second_charges','Any second or further secured charges?',['No','Yes','Not sure']],
 ['restrictions','Any other restrictions or encumbrances?',['No','Yes','Not sure']],['restriction_details','Restriction / encumbrance details','text']
];
export function propertyFieldVisible(key,p){
 if(['first_charge_lender','first_charge_balance','arrears'].includes(key))return p.first_charge_status!=='No mortgage';
 if(['first_charge_arrears_amount','arrears_included_in_balance'].includes(key))return p.first_charge_status!=='No mortgage'&&p.arrears==='Yes';
 if(key==='restriction_details')return p.restrictions==='Yes';return true;
}
export function normaliseProperties(input,strict=false){
 const errors={},items=[];const total=input.total_properties_owned;
 let count=null;
 if(total!==undefined&&total!==null&&String(total).trim()!==''&&!/^(not sure|unknown)$/i.test(String(total))){
  if(!/^\d{1,5}$/.test(String(total)))errors.total_properties_owned='Enter the number owned, or leave blank if unsure.';else count=Number(total);
 }
 const raw=input.additional_properties??[];
 if(!Array.isArray(raw)||raw.length>10)return {total:count,items,errors:{...errors,additional_properties:'Add up to 10 additional security properties online.'}};
 for(const [i,p] of raw.entries()){
  if(!p||typeof p!=='object'||Array.isArray(p)){errors.additional_properties='Check the additional property details.';continue;}
  const out={property_id:/^[a-zA-Z0-9_-]{1,60}$/.test(p.property_id||'')?p.property_id:'additional-'+(i+1)};
  for(const [key,label,type] of PROPERTY_FIELDS){
   if(!propertyFieldVisible(key,p))continue;
   const v=p[key];
   if(type==='money'){const n=money(v);if(Number.isNaN(n))errors.additional_properties=`Property ${i+2}: check ${label.toLowerCase()}.`;else out[key]=n;}
   else if(Array.isArray(type)){if(v&& !type.includes(v))errors.additional_properties=`Property ${i+2}: check ${label.toLowerCase()}.`;else if(v)out[key]=v;}
   else {let value=String(v??'').trim().slice(0,200);if(type==='postcode'){value=value.toUpperCase().replace(/\s/g,'');if(/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(value))value=value.slice(0,-3)+' '+value.slice(-3);else if(value)errors.additional_properties=`Property ${i+2}: enter a valid UK postcode.`;}if(value)out[key]=value;}
  }
  if(out.first_charge_status==='No mortgage'){out.first_charge_balance=0;out.arrears='No';out.first_charge_arrears_amount=0;}
  else if(out.arrears==='No')out.first_charge_arrears_amount=0;
  out.second_charges=[];
  if(out.has_second_charges==='Yes'){
   if(!Array.isArray(p.second_charges)||p.second_charges.length>10)errors.additional_properties=`Property ${i+2}: check secured charges.`;
   else for(const c of p.second_charges){const balance=money(c?.balance);if(Number.isNaN(balance))errors.additional_properties=`Property ${i+2}: check charge balance.`;out.second_charges.push({lender:String(c?.lender??'').trim().slice(0,100),balance:Number.isNaN(balance)?null:balance});}
   if(strict&&!out.second_charges.length)errors.additional_properties=`Property ${i+2}: add the charge holder and balance, or select Not sure.`;
  }
  if(strict&&(!out.address||!out.postcode))errors.additional_properties=`Property ${i+2}: address and postcode are required, or remove this property.`;
  items.push(out);
 }
 return {total:count,items,errors};
}
export function assetLiabilitySeed(a){return {version:1,scope:'Declared security properties only; not the complete portfolio',total_properties_owned:a.total_properties_owned??null,properties:[{property_id:'primary',address:a.security_address||'',postcode:a.security_postcode||'',property_value:money(a.property_value),first_charge_lender:a.first_charge_lender||'',first_charge_balance:money(a.first_charge_balance),arrears:a.arrears||'',first_charge_arrears_amount:money(a.first_charge_arrears_amount),arrears_included_in_balance:a.arrears_included_in_balance||'',second_charges:a.second_charges==='Yes'?[{lender:a.second_charge_provider||'',balance:money(a.second_charge_balance)}]:[],has_second_charges:a.second_charges||'Not sure'},...normaliseProperties(a).items]};}
export function renderProperties(a){const seed=assetLiabilitySeed(a),cash=v=>v==null?'Not sure':'£'+Number(v).toLocaleString('en-GB');return `<section class="property-summary"><h3>Properties and secured borrowing</h3><p>Total properties owned: ${esc(seed.total_properties_owned??'Not provided')} · Additional security properties: ${seed.properties.length-1}</p><p><small>${seed.scope}. Balances are declared, not verified. Arrears are shown separately and are not automatically added to mortgage balances.</small></p>${seed.properties.map((p,i)=>`<div style="border:1px solid #ddd;padding:14px;margin:10px 0"><b>${i?'Additional property '+i:'Primary security'}</b><p>${esc([p.address,p.postcode].filter(Boolean).join(', '))}</p><p>Value: ${esc(cash(p.property_value))}<br>First charge: ${esc(p.first_charge_lender||'Not provided')} — ${esc(cash(p.first_charge_balance))}<br>Arrears: ${esc(p.arrears||'Not sure')} · ${esc(cash(p.first_charge_arrears_amount))} · ${esc(p.arrears_included_in_balance||'Treatment not confirmed')}</p><p>Further charges: ${esc(p.has_second_charges||'Not sure')}</p>${p.second_charges.map(c=>`<p>${esc(c.lender||'Lender not provided')} — ${esc(cash(c.balance))}</p>`).join('')}</div>`).join('')}</section>`;}
