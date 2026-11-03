import { money } from "./ff-finance.js";
// Fact-find field schema (ES module, shared by browser and /api/factfind). Option lists follow the live /apply form (FACTFIND_UI_STANDARD_v001).
const O = {
  ownership: ["Personal name — sole owner","Joint with spouse or partner","Company","Other"],
  asset_type: ["Agricultural Land","Air Space Commercial","Air Space Residential","Assisted Living","Barn Conversion","Caravan Park","Care Home","Church Conversion","Farm","Football Stadium","General Commercial","Golf Course","HMO","Hotel","Industrial","Land with No Planning","Land with Planning","Leisure","Leisure Pier","Mixed-Use","Office","PBSA","Petrol Stations","Place of Worship","Pubs and Bars","Residential","Restaurants","Retail","Retail Park"],
  residential_type: ["House","Flat","Bungalow","Maisonette","Other"],
  charge_position: ["First charge — replacing/clearing the current lender","Second charge — current mortgage stays in place","Equitable charge / speed-loan route","Not sure — please advise"],
  loan_basis: ["Net funds I want to receive","Gross borrowing amount","Not sure — discuss on call"],
  purpose: ["Property purchase","Auction purchase","Chain break","Refurbishment / works only","Refinance / repay existing lender","Development finance / build costs","Development exit","Business / working capital","Acquisition finance — larger / corporate transaction","HMRC / tax pressure","Other / not sure"],
  timescale: ["As soon as possible","Within 2 weeks","Within a month","Flexible — no immediate pressure"],
  yns: ["No","Yes","Not sure"],
  first_charge_status: ["Running normally — payments up to date","Term ending or ended within 6 months","In arrears","Not sure","No mortgage"],
  restrictions: ["Not sure","No","Yes"],
  credit_profile: ["Excellent — clean credit history","Good — minor historic issues only","Average — some defaults or CCJs over 3 years ago","Poor / adverse — recent defaults, CCJs or bankruptcy","Not sure"],
  credit_events: ["None — current or previous","Yes — I can give some details","Not sure — discuss on the call"],
  missed_payments: ["None","One","Two or more","No mortgage during this period","Not sure"],
  arrears_included_in_balance: ["Balance includes arrears","Balance excludes arrears","Not sure"],
  redemption_structure: ["Add on top of requested amount","Deduct within requested amount","Not sure — discuss on call"],
  legal_buffer: ["0","2000","Not sure"],
  contingency_buffer: ["0","5000","10000","Not sure"],
  panel_solicitor_opt_in: ["Use the Posfin panel solicitor","Use my own solicitor","Not sure — discuss on call"],
  contact_pref: ["Any time","Business hours (9am – 6pm)","Evenings (after 6pm)","Weekends"],
};
// type: text|email|tel|postcode|money|select|textarea|bool ; req = required on submit
const FIELDS = {
  full_name:{t:"text",max:100,req:1,step:1}, phone:{t:"tel",max:20,req:1,step:1}, email:{t:"email",max:120,req:1,step:1},
  ownership:{t:"select",o:O.ownership,req:1,step:1}, company_name:{t:"text",max:120,step:1},
  asset_type:{t:"select",o:O.asset_type,req:1,step:2}, residential_type:{t:"select",o:O.residential_type,step:2},
  security_address:{t:"text",max:160,step:2}, security_postcode:{t:"postcode",max:10,req:1,step:2}, property_value:{t:"money",req:1,step:2},
  loan_amount:{t:"money",req:1,step:3}, loan_basis:{t:"select",o:O.loan_basis,step:3}, purpose:{t:"select",o:O.purpose,req:1,step:3}, timescale:{t:"select",o:O.timescale,req:1,step:3},
  charge_position:{t:"select",o:O.charge_position,req:1,step:3}, exit_plan:{t:"textarea",max:500,step:3},
  first_charge_lender:{t:"text",max:80,req:1,step:4}, first_charge_balance:{t:"money",step:4}, arrears:{t:"select",o:O.yns,step:4},
  second_charges:{t:"select",o:O.yns,step:4}, first_charge_status:{t:"select",o:O.first_charge_status,step:4}, restrictions:{t:"select",o:O.restrictions,step:4},
  credit_profile:{t:"select",o:O.credit_profile,req:1,step:5}, credit_events:{t:"select",o:O.credit_events,step:5}, missed_payments:{t:"select",o:O.missed_payments,step:5},
  contact_pref:{t:"select",o:O.contact_pref,step:5}, notes:{t:"textarea",max:1000,step:5}, ai_call_consent:{t:"bool",step:5}, contact_consent:{t:"bool",req:1,step:5},
  first_charge_arrears_amount:{t:"money",step:4}, second_charge_balance:{t:"money",step:4}, second_charge_provider:{t:"text",max:100,step:4},
  arrears_included_in_balance:{t:"select",o:O.arrears_included_in_balance,step:4},
  redemption_structure:{t:"select",o:O.redemption_structure,req:1,step:4},
  legal_buffer:{t:"select",o:O.legal_buffer,req:1,step:5}, contingency_buffer:{t:"select",o:O.contingency_buffer,req:1,step:5},
  panel_solicitor_opt_in:{t:"select",o:O.panel_solicitor_opt_in,req:1,step:5},
  test_mode_ack:{t:"bool",req:"test",step:1} // required only when the backend is the preview/test database
};
const RX = { email:/^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,}$/, tel:/^[+0-9 ()-]{7,20}$/, postcode:/^[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}$/ };
const MSG = { email:"Valid email required", tel:"Valid phone number required", postcode:"Valid UK postcode required", money:"Whole pounds only", select:"Please select an option", req:"Required" };
// Returns {clean, errors}. strict=true applies required + format checks (submit).
function validate(input, strict, testMode){
  const clean = {}, errors = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return { clean, errors:{_:"bad_input"} };
  for (const [k,v] of Object.entries(input)) {
    const f = FIELDS[k]; if (!f) continue; // drop unknown keys
    if (f.t === "bool") { clean[k] = v === true; continue; }
    if (f.t === "money") { const n=money(v); if(Number.isNaN(n)){errors[k]="Enter whole pounds, or Not sure. Negative amounts and ranges cannot be used.";continue;} clean[k]=n; continue; }
    let s = String(v ?? "").replace(/[\u0000-\u001f]/g," ").trim().slice(0, f.max || 200);
    if (!s) continue;
    if (f.t === "select" && !f.o.includes(s)) { errors[k] = MSG.select; continue; }
    if (strict && RX[f.t] && !RX[f.t].test(s)) { errors[k] = MSG[f.t]; continue; }
    clean[k] = s;
  }
  if (clean.arrears === "No") { clean.first_charge_arrears_amount=0; delete clean.arrears_included_in_balance; delete errors.first_charge_arrears_amount; }
  if (clean.second_charges === "No") { clean.second_charge_balance=0; delete clean.second_charge_provider; delete errors.second_charge_balance; }
  if (clean.first_charge_status === "No mortgage") { clean.first_charge_balance=0; clean.arrears="No"; clean.first_charge_arrears_amount=0; delete errors.first_charge_balance; delete errors.first_charge_arrears_amount; }
  if (strict) {
    for (const [k,f] of Object.entries(FIELDS)) {
      if (f.req && (f.req !== "test" || testMode) && !errors[k] && (clean[k] === undefined || clean[k] === "" || clean[k] === false)) errors[k] = MSG.req;
    }
    if (clean.ownership === "Company" && !clean.company_name) errors.company_name = "Company name required";
  }
  return { clean, errors };
}
export { O, FIELDS, validate };
