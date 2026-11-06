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
  // A declared budget is not a priced loan. Do not reverse-engineer lender
  // gross/net advance or LTV from these inputs, under either request basis.
  const cash=null,facility=null,ltv=null;
  return {amount,first,arrears,second,mandatory,legal,contingency,cash,facility,retainedFirst,ltv,missing:[...new Set(missing)]};
}
const pounds=n=>Number.isFinite(n)?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n):'To confirm';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderScorecard(a){
 const c=calculate(a);const row=(label,n,cls='')=>`<div class="fund-row ${cls}"><span>${label}</span><strong>${pounds(n)}</strong></div>`;
 const basis=["Net funds I want to receive","Gross borrowing amount","Not sure — discuss on call"].includes(a.loan_basis)?a.loan_basis:"Not yet specified — we will confirm this with you";
 return `<section class="fund-card" aria-label="Your declared funding requirements"><p class="eyebrow">YOUR DECLARED REQUIREMENTS</p><h2>Your figures, made clear</h2><p>There are no wrong answers. “Not sure” is welcome — we will work through anything outstanding together.</p>${row('Amount you requested',c.amount,'fund-emphasis')}<p>Request basis: <strong>${esc(basis)}</strong>.</p>${row('Mortgage balance you declared',c.first)}${row('Mortgage arrears you declared',c.arrears)}<p>Arrears treatment: ${esc(a.arrears_included_in_balance||'To confirm')}.</p>${row('Second-charge / restriction balance you declared',c.second)}${row('Declared redemptions subtotal — subject to confirmation',c.mandatory)}<p>Your redemption preference: <strong>${esc(a.redemption_structure||'To confirm')}</strong>.</p><p class="fund-note">This records your preference only; it does not establish how much a lender will advance or deduct. Redemption statements and charge treatment still need to be confirmed.</p>${row('Your legal allowance choice',c.legal)}${row('Your contingency choice',c.contingency)}<div class="fund-pending"><strong>Lender terms still required</strong><p>We have not calculated an available net advance, gross loan, cash release or loan-to-value from these figures. Actual eligible lender options from Placed or the broker portal, including their fees, interest and deductions, must be confirmed first.</p></div>${c.missing.length?`<div class="fund-pending"><strong>We will confirm together</strong><ul>${c.missing.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}<p>Solicitor preference: <strong>${esc(a.panel_solicitor_opt_in||"To confirm")}</strong>.</p><p class="fund-note">This is a record of your declared requirements, not a quote, available loan amount, eligibility decision or offer.</p></section>`;
}
