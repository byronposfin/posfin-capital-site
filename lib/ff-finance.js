// Shared borrower-declared preview build-up. No lender eligibility or pricing claims.
export function money(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const text=String(value).trim();
  if (/^(?:not sure|unknown|tbc|to confirm)$/i.test(text)) return null;
  if (!/^(?:£\s*)?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.00)?$/.test(text)) return NaN;
  const n=Number(text.replace(/[£,\s]/g,''));
  return Number.isSafeInteger(n) && n <= 9999999999 ? n : NaN;
}
export function calculate(a) {
  const amount=money(a.loan_amount), property=money(a.property_value);
  const first=a.first_charge_status==='No mortgage'?0:money(a.first_charge_balance);
  const arrears=a.first_charge_status==='No mortgage'||a.arrears==='No'?0:a.arrears==='Yes'?money(a.first_charge_arrears_amount):null;
  const second=a.second_charges==='No'?0:a.second_charges==='Yes'?money(a.second_charge_balance):null;
  const legal=money(a.legal_buffer), contingency=money(a.contingency_buffer);
  const missing=[]; const known=x=>Number.isFinite(x);
  for(const [label,n] of [['Requested amount',amount],['Property value',property],['First-charge balance',first],['Mortgage arrears',arrears],['Second-charge balance',second],['Legal allowance',legal],['Contingency',contingency]])if(!known(n))missing.push(label);
  const replaces=a.charge_position==='First charge — replacing/clearing the current lender';
  const retains=a.charge_position==='Second charge — current mortgage stays in place'||a.charge_position==='Equitable charge / speed-loan route';
  if(!replaces&&!retains)missing.push('Charge position');
  let firstRedemption=null,retainedFirst=null;
  const treatment=a.arrears_included_in_balance;
  if(known(first)&&known(arrears)) {
    if(arrears===0){firstRedemption=replaces?first:0;retainedFirst=replaces?0:first;}
    else if(treatment==='Balance includes arrears'&&first>=arrears){firstRedemption=replaces?first:arrears;retainedFirst=replaces?0:first-arrears;}
    else if(treatment==='Balance excludes arrears'){firstRedemption=replaces?first+arrears:arrears;retainedFirst=replaces?0:first;}
    else missing.push(treatment==='Balance includes arrears'?'Arrears exceed the stated balance':'Whether the mortgage balance includes arrears');
  }
  const mandatory=(replaces||retains)&&known(firstRedemption)&&known(second)?firstRedemption+second:null;
  const add=a.redemption_structure==='Add on top of requested amount';
  const within=a.redemption_structure==='Deduct within requested amount';
  if(!add&&!within)missing.push('Redemption treatment');
  let cash=null,facility=null;
  if(known(amount)&&known(mandatory)&&(add||within)&&known(legal)&&known(contingency)){
    cash=add?amount:amount-mandatory;
    facility=amount+(add?mandatory:0)+legal+contingency;
    if(cash<0){missing.push('Redemptions exceed the requested amount');cash=null;facility=null;}
  }
  const ltv=known(facility)&&known(retainedFirst)&&known(property)&&property>0?100*(facility+retainedFirst)/property:null;
  return {amount,first,arrears,second,mandatory,legal,contingency,cash,facility,retainedFirst,ltv,missing:[...new Set(missing)]};
}
const pounds=n=>Number.isFinite(n)?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n):'To confirm';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderScorecard(a){
 const c=calculate(a);const row=(label,n,cls='')=>`<div class="fund-row ${cls}"><span>${label}</span><strong>${pounds(n)}</strong></div>`;
 return `<section class="fund-card" aria-label="Indicative funds build-up"><p class="eyebrow">YOUR FUNDS BUILD-UP</p><h2>Your figures, made clear</h2><p>There are no wrong answers. “Not sure” is welcome — we will work through anything outstanding together.</p><div class="cash-highlight"><span>Estimated cash released to you</span><strong>${pounds(c.cash)}</strong></div>${row('Requested amount',c.amount)}${row('Mortgage arrears to clear',c.arrears)}${row('Second charge / restriction to clear',c.second)}${a.charge_position?.startsWith('First charge')?row('First mortgage balance (included in redemptions)',c.first):''}${row('Total mandatory redemptions',c.mandatory,'fund-emphasis')}<p>${esc(a.redemption_structure||'Choose whether redemptions sit within or on top of your requested amount.')}.</p><p class="fund-note">If your first mortgage is being replaced, its balance is also redeemed. Arrears already included in that balance are counted only once. Final redemption requirements are confirmed with the lender and solicitor.</p>${row('Legal allowance — added separately',c.legal)}${row('Contingency — added separately',c.contingency)}${row('Estimated funding requirement before lender fees / interest',c.facility,'fund-total')}${row('Mortgage remaining after completion',c.retainedFirst)}<p>Indicative net LTV: <strong>${Number.isFinite(c.ltv)?c.ltv.toFixed(1)+'%':'To confirm'}</strong>. Not a lender valuation or approval.</p>${c.missing.length?`<div class="fund-pending"><strong>We will confirm together</strong><ul>${c.missing.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}<p>Solicitor preference: <strong>${esc(a.panel_solicitor_opt_in||"To confirm")}</strong>.</p><p class="fund-note">This is your declared position, not an offer. Fees, interest and final redemption statements still need to be confirmed. A legal allowance or contingency is additional to the requested amount under either redemption option.</p></section>`;
}
