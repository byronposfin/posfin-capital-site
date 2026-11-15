import '../intake-config.js';
import {money} from './ff-finance.js';
import {landFields} from './ff-land-fields.js';
export const MIN_SECURITY=globalThis.PosfinIntakeConfig.thresholds.minimum_security_value;
export const DECLINE_COPY="Thank you. We only arrange finance against land or property worth £200,000 or more, so we're not able to help with this one. If the value is higher than you've entered, reply to us and we'll look again.";
export const isLand=a=>['Land','Land with No Planning','Land with Planning','Agricultural Land','Farm'].includes(a?.asset_type);
export const hasConsent=a=>['Outline','Full','Reserved matters approved','Permission in principle'].includes(a.planning_status);
export function visible(f,a){
 const w=f.when;if(!w)return true;
 const owned=a.ownership_status==='I own it';
 if(w==='consent')return hasConsent(a);
 if(w==='owned')return owned;
 if(w==='buying')return !!a.ownership_status&&!owned;
 if(w==='company')return owned&&['Limited company','SPV'].includes(a.owner_type);
 if(w==='connected')return owned&&a.connected_purchase==='Yes';
 if(w==='auction')return a.ownership_status==='Auction with a completion date set'||/auction/i.test(a.purpose||'');
 if(w==='expiry')return hasConsent(a)&&['No','Not sure'].includes(a.consent_implemented);
 if(w==='credit')return ['Historic issues','Current issues'].includes(a.credit_profile);
 const [k,v]=w.split('=');return a[k]===v;
}
export const belowMinimum=a=>{const n=money(a.property_value);return Number.isFinite(n)&&n<MIN_SECURITY;};
const text=v=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,1000);
const known=v=>!!text(v)&&!/^not sure|don't know|unknown|tbc$/i.test(text(v));
export function assessLand(a){
 const chargeComplete=a.secured_lending==='No, it’s unencumbered'||(a.secured_lending==='Yes'&&a.charges?.length>0&&a.charges.every(c=>known(c.lender)&&Number.isFinite(money(c.balance))&&money(c.balance)>=0&&known(c.position)&&known(c.titles)&&known(c.status)&&known(c.redemption)));
 const checks=[['Purchase history',a.ownership_status==='I own it'?known(a.purchase_date)&&Number.isFinite(money(a.price_paid))&&money(a.price_paid)>0:Number.isFinite(money(a.purchase_price))&&money(a.purchase_price)>0],['Charge disclosures',!!chargeComplete],['Other encumbrances',a.other_encumbrances==='No'||(a.other_encumbrances==='Yes'&&known(a.other_encumbrance_details))]];
 if(hasConsent(a))checks.push(['Planning references',known(a.planning_references)],['Implementation / expiry',a.consent_implemented==='Yes'||(a.consent_implemented==='No'&&/^\d{4}-\d{2}-\d{2}$/.test(a.planning_expiry||''))]);
 return {score:Math.round(100*checks.filter(c=>c[1]).length/checks.length),checks,valuation_gate:'Independent valuation / comparable evidence pending',lender_ready:false};
}
export function validateLand(input,strict=false,testMode=false){
 const clean={asset_type:isLand(input)?input.asset_type:'Land',intake_type:'pa_land'},errors={};
 for(const f of landFields){
  if(!visible(f,input)||(f.key==='loan_purpose'&&input.purpose&&!input.loan_purpose))continue;
  const v=input[f.key];
  if(f.type==='charges')continue;
  if(f.type==='bool'){clean[f.key]=v===true;if(strict&&!f.optional&&v!==true)errors[f.key]='Required';continue;}
  if(v===undefined||v===null||v===''){if(strict&&!f.optional)errors[f.key]='Required (Not sure is allowed where shown)';continue;}
  if(f.type==='number'){const n=money(v);if(Number.isNaN(n))errors[f.key]='Enter a non-negative whole amount, or Not sure';else clean[f.key]=n;}
  else {const s=text(v);if(f.options&&!f.options.includes(s))errors[f.key]='Please select an option';else clean[f.key]=s;}
 }
 if(clean.secured_lending==='Yes'){
  clean.charges=(Array.isArray(input.charges)?input.charges:[]).slice(0,20).map((c,i)=>{
   const out={};for(const k of ['lender','payment_or_rate','position','titles','status','redemption']){out[k]=text(c[k]);if(strict&&!out[k])errors.charges='Complete each loan disclosure, or enter Not sure';}
   out.balance=money(c.balance);if(Number.isNaN(out.balance)){out.balance=null;errors.charges='Loan balances must be non-negative exact amounts or Not sure';}return out;
  });if(strict&&!clean.charges.length)errors.charges='Add every secured loan';
 }else clean.charges=[];
 if(strict){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email||''))errors.email='Valid email required';
  if(!/^[+0-9 ()-]{7,20}$/.test(clean.phone||''))errors.phone='Valid mobile required';
  for(const k of ['property_value','loan_amount'])if(!Number.isFinite(clean[k])||clean[k]<=0)errors[k]='Enter an exact amount greater than zero';
  if(testMode&&input.test_mode_ack!==true)errors.test_mode_ack='Use synthetic test details only';
 }
 if(visible({when:'auction'},input)){
  for(const k of ['auction_date','auction_completion_deadline']){const v=clean[k];if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))errors[k]='Enter a valid date (YYYY-MM-DD)';}
  if(strict&&!Number.isFinite(clean.auction_guide_price)&&!Number.isFinite(clean.auction_max_bid))errors.auction_guide_price='Enter the guide price or maximum bid';
  for(const k of ['auction_guide_price','auction_max_bid'])if(Number.isFinite(clean[k])&&clean[k]<=0)errors[k]='Enter an amount greater than zero';
  if(clean.auction_date&&clean.auction_completion_deadline&&clean.auction_completion_deadline<clean.auction_date)errors.auction_completion_deadline='Completion deadline cannot be before the auction date';
 }
 clean.test_mode_ack=input.test_mode_ack===true;
 // Carry already captured main-journey answers; never infer monetary basis.
 for(const k of ['purpose','loan_basis','ownership','company_name','security_postcode','security_address','exit_plan'])if(input[k]!==undefined)clean[k]=text(input[k]);
 if(visible({when:'auction'},input))clean.purpose='Auction finance';
 clean.security_address=clean.property_address||clean.security_address;
 clean.land_page=Math.max(0,Math.min(7,Number(input.land_page)||0));
 clean.resolved_route=clean.site_current_use==='Habitable dwelling in use'?'main_loan':clean.funding_build==='Yes'?'development_finance':'pa_land';
 clean.no_chase=belowMinimum(clean);clean.decline_reason=clean.no_chase?'Below minimum value':null;
 clean.land_scorecard=assessLand(clean);
 return {clean,errors};
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderLandScorecard(a){
 const s=assessLand(a);
 return `<section class="land-score"><h2>Land evidence completeness: ${s.score}%</h2><p>Thank you. Your Fact Find is with the desk. We price land on evidence: planning, purchase history and any existing lending are what lenders ask us first, so having them now puts you days ahead.</p><ul>${s.checks.map(([k,v])=>`<li>${esc(k)}: ${v?'Captured — verification pending':'Missing / to confirm'}</li>`).join('')}</ul><p>${esc(s.valuation_gate)}. Not lender-approved; no lender submission authorised.</p><p>Term: ${esc(a.term_months)} months. ${a.loan_basis==='Gross borrowing amount'?'Gross amount requested':a.loan_basis==='Not sure — discuss on call'?'Amount requested (basis to confirm)':'Net cash requested'}: ${Number.isFinite(money(a.loan_amount))?'£'+money(a.loan_amount).toLocaleString('en-GB'):'To confirm'}.</p><p>Existing balances, redemption structure, gross facility, fees and interest require desk verification.</p><a href="https://cv.posfincapital.com">Complete your Developer CV</a></section>`;
}
