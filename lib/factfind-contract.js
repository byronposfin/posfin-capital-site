import '../intake-config.js';
import '../land-schema.js';
import '../land-core.js';
import '../factfind-core.js';
export const { normalise, calculate, render } = globalThis.PosfinFactFind;
export const REQUIRED_KEYS = ['credit_profile','title_ownership','co_owner_name','owning_company_name','first_charge_status','first_charge_arrears_amount','arrears_included_in_balance','second_charge_present','restrictions_present','funds_timescale','urgency_flag','home_equals_security','contact_preference','panel_solicitor_opt_in','legal_buffer','contingency_buffer','whatsapp_cta_clicked_at','kyc_requested_at','ai_call_consent','scorecard_json','scorecard_url'];
export function pipelineRecord(input,summary,scorecardUrl){
 const d=normalise(input), c=calculate(d);
 const record={...d,scorecard_json:JSON.stringify({version:'factfind-v1',answers:d}),scorecard_url:scorecardUrl,
 'Deal Summary':summary,'📱 Mobile':d.mobile||'', '📧 Email':d.email||'', '👤 First Name':d.first_name,'👤 Last Name':d.last_name,'👤 Agent':d.assigned_broker||'Byron','🚦 Status':'TRIAGE','🔖 Ref':d.deal_ref,'💷 Net (£)':c.cash,'📊 Property Value (Stated)':d.property_value,'1st Charge Provider':d.first_charge_lender,'1st Charge Gross':d.first_charge_balance,'1st Charge Clean':c.retainedFirst,'Arrears':d.first_charge_arrears_amount,'2nd Charge Provider':d.second_charge_provider,'2nd Charge Balance':d.second_charge_balance,'Mandatory Redemptions':c.arrears+c.second,'Legal Buffer':d.legal_buffer,'Overrun Buffer':d.contingency_buffer,'Security Address':d.property_address,'Residential Address':d.home_address,'Timescale':d.funds_timescale,'Net or Gross':d.net_or_gross,'Purpose of Funds':d.loan_purpose,'Exit Strategy':d.exit_strategy,'📊 Scorecard':scorecardUrl,'borrower_dob':d.date_of_birth};
 return record;
}
export function mapPipelineHeaders(headers,record){return headers.map(h=>{const v=record[h];return v===undefined||v===null?'':typeof v==='object'?JSON.stringify(v):v;});}
