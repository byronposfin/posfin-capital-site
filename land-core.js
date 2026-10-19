(function(root){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const consent=d=>['Outline','Full','Reserved matters approved','Permission in principle'].includes(d.planning_status);
function visible(f,d){const w=f.when;if(!w)return true;if(w==='consent')return consent(d);if(w==='owned')return d.ownership_status==='I own it';if(w==='buying')return !!d.ownership_status&&d.ownership_status!=='I own it';if(w==='company')return d.ownership_status==='I own it'&&['Limited company','SPV'].includes(d.owner_type);if(w==='connected')return d.ownership_status==='I own it'&&d.connected_purchase==='Yes';if(w==='auction')return d.ownership_status==='Auction with a completion date set';if(w==='expiry')return consent(d)&&['No','Not sure'].includes(d.consent_implemented);if(w==='credit')return ['Historic issues','Current issues','historic_issues','current_issues'].includes(d.credit_profile);const [k,v]=w.split('=');return d[k]===v;}
function route(d){return d.site_current_use==='Habitable dwelling in use'?'main_loan':d.funding_build==='Yes'?'development_finance':'pa_land';}
function assess(d,now=new Date()){
 const flags=[],evidence=[];const owned=d.ownership_status==='I own it';
 evidence.push([owned?'Purchase date and price':'Purchase price',owned?!!d.purchase_date&&Number(d.price_paid)>0:Number(d.purchase_price)>0]);
 if(consent(d))evidence.push(['Planning references',!!d.planning_references],['Implementation status',d.consent_implemented==='Yes'||(d.consent_implemented==='No'&&/^\d{4}-\d{2}-\d{2}$/.test(d.planning_expiry||''))]);
 evidence.push(['Charge disclosures',d.secured_lending==="No, it’s unencumbered"||(d.charges?.length>0&&d.charges.every(c=>c.lender&&Number.isFinite(Number(c.balance))&&c.balance!==''))],['Other encumbrances confirmed',d.other_encumbrances==='No'||(d.other_encumbrances==='Yes'&&!!d.other_encumbrance_details)]);
 if(d.other_encumbrances==='Yes')flags.push('Additional encumbrance disclosed: '+d.other_encumbrance_details);
 if(d.other_encumbrances==='Not sure')flags.push('Other charges / guarantees / options need confirmation');
 if(consent(d)&&d.consent_implemented!=='Yes'){
  const end=new Date(d.planning_expiry),six=new Date(now);six.setMonth(six.getMonth()+6);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.planning_expiry||'')||isNaN(end))flags.push('Planning expiry needs desk follow-up');
  else if(end<=six)flags.push(end<now?'Planning consent expiry has passed':'Planning consent expires within 6 months');
 }
 if(d.connected_purchase==='Yes')flags.push('Connected-party purchase — evidence review required');
 if((d.charges||[]).some(c=>c.status!=='Up to date'))flags.push('Loan expiry / arrears / default-rate review');
 const score=Math.round(evidence.filter(e=>e[1]).length/evidence.length*100);
 return {score,evidence,flags,route:route(d),valuation_gate:'Pending independent valuation / comparable evidence; no lender submission authorised'};
}
function render(d,ref){
 const a=assess(d),money=v=>Number.isFinite(Number(v))?'£'+Number(v).toLocaleString('en-GB'):'To confirm';
 const row=(k,v)=>`<div class="land-row"><span>${esc(k)}</span><b>${esc(v??'To confirm')}</b></div>`;
 const section=(title,body)=>`<section class="land-panel"><h2>${esc(title)}</h2>${body}</section>`;
 const charges=d.charges||[],debt=charges.reduce((s,c)=>s+Number(c.balance||0),0);
 return `<article class="land-score"><h1>Your Land Fact Find</h1><p>Reference: ${esc(ref)}</p><p>Thank you. Your Fact Find is with the desk. We price land on evidence: planning, purchase history and any existing lending are what lenders ask us first, so having them now puts you days ahead.</p>${section('Your funds build-up',row('Net cash requested',money(d.loan_amount))+row('Existing secured balances',money(debt))+row('Redemptions / retained debt','Desk to confirm from settlement statements')+row('Gross facility, fees and interest','To be priced — not yet an offer'))}${section('Evidence completeness',row('Declared evidence completeness',a.score+'%')+a.evidence.map(([k,v])=>row(k,v?'Captured — verification pending':'Missing / to confirm')).join('')+'<p>'+esc(a.valuation_gate)+'</p>')}${a.flags.length?section('Desk review flags','<ul>'+a.flags.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>'):''}${[...new Set(root.PosfinLandFields.map(f=>f.section))].map(s=>section(s,root.PosfinLandFields.filter(f=>f.section===s&&f.type!=='charges'&&visible(f,d)).map(f=>row(f.label,d[f.key])).join(''))).join('')}${section('All disclosed secured loans',charges.length?charges.map((c,i)=>section('Loan '+(i+1),Object.entries(c).map(([k,v])=>row(k.replaceAll('_',' '),v)).join(''))).join(''):'<p>No secured loans declared.</p>')}<p><a href="https://cv.posfincapital.com" target="_blank" rel="noopener">Complete your Developer CV</a></p><p>Summary only — not an offer of finance. Planning, purchase evidence, charges and valuation must be verified before any lender submission.</p></article>`;
}
root.PosfinLand={visible,route,assess,render,esc};
})(globalThis);
