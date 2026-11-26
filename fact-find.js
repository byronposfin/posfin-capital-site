import {createLandJourney} from '/lib/ff-land-ui.js';
import {isLand} from '/lib/ff-land.js';
import { createPropertyEditor } from "/lib/ff-properties-ui.js?v=20261120-address";
import { renderProperties } from "/lib/ff-properties.js?v=20261121-factfind";
import { BRANCH_FIELDS, branchVisible, cleanBranches, routeCard } from "/lib/ff-routing.js?v=20261104-live";
import { bindMoneyInput, bindPostcode } from "/lib/ff-inputs.js?v=20261104-live";
import { FINDER_MARKUP, bindSecurityAddressPicker } from "/lib/ff-address-picker.js?v=20261120-address";
import { money, renderScorecard } from "/lib/ff-finance.js?v=20261121-factfind";
import { looksLikeTestLead } from "/lib/ff-test-lead.js?v=20261121-factfind";
import { createSingleFlight } from "/lib/ff-save-queue.js?v=20261121-factfind";
import * as S from "/lib/ff-schema.js?v=20261126-factfind";
/* Attribution (first touch, this browser tab only): utm_* and ?b=bh|chris. Sent with the fact find; no cookies. */
(function(){/* also capture when /fact-find is the landing page */try{var K="posfin_attr_v1",q=new URLSearchParams(location.search),a=JSON.parse(sessionStorage.getItem(K)||"null");
if(!a){a={landing_path:location.pathname,referrer:document.referrer&&new URL(document.referrer).host!==location.host?document.referrer:""};}
["utm_source","utm_medium","utm_campaign","utm_term","utm_content","b"].forEach(function(k){var v=q.get(k);if(v&&!a[k])a[k]=v.slice(0,150);});
sessionStorage.setItem(K,JSON.stringify(a));}catch(e){}})();

const O = S.O, F = S.FIELDS;
const CAL = "https://calendly.com/byron-hill/posfin-bridging-finance-consultation-30-min-byron";
let testMode = true; // until /api/factfind health says otherwise
const STEPS = [
 {t:"About you", s:"Your contact details and who owns the property.", f:[
  ["full_name","Full name *",{ac:"off",ph:""}],["applicant_dob","Date of birth *",{why:"Day, month and year. Applicants need to be 18 or over."}],
  ["phone","Phone *",{ph:"07700 900000",ac:"tel"}],["email","Email *",{ph:"name@example.com",full:1}],
  ["asset_type","Security type *",{}],["ownership","Who owns the property? *",{}],
  ["applicant_2_dob","Date of birth *",{why:"Second applicant. Day, month and year. Each applicant needs to be 18 or over."}],
  ["company_name","Company name (if a company owns it)",{}],
  ["property_experience","Property experience *",{full:1,why:"Lenders use how many properties you have owned or developed."}],
  ["test_mode_ack","I understand this is a PREVIEW form and I am using made-up details only *",{full:1,test:1}]]},
 {t:"The property", s:"The security, its value and how it is used.", f:[
  ["residential_type","Residential type",{}],
  ["security_postcode","Security postcode *",{full:1,ph:"SW1A 1AA"}],["security_address","Security address",{full:1,ph:"Select an address above or enter it manually"}],["property_value","Estimated property value *",{ph:"£500,000"}],
  ["bedrooms","Number of bedrooms *",{why:"Lenders need this to price your loan quickly."}],
  ["rental_status","Is the property let? *",{why:"Lenders need the monthly rent when the property is let. Choose Not let if nobody pays rent."}],
  ["rental_income_monthly","Monthly rental income *",{ph:"£1,200",why:"The rent received each month, in whole pounds."}]]},
 {t:"The loan", s:"Amount, purpose and how soon you need the funds.", f:[
  ["loan_amount","Amount requested *",{ph:"£250,000"}],["loan_basis","What does this amount mean?",{full:1}],["purpose","Purpose *",{}],["timescale","When do you need the funds? *",{}],["charge_position","Charge position *",{}],
  ["exit_plan","How will the loan be repaid? (your exit)",{full:1,ph:"e.g. sale of the property, or refinance"}]]},
 {t:"Existing borrowing", s:"Any mortgages or charges already in place.", f:[
  ["first_charge_lender","First-charge lender *",{ph:"Lender name, or \u201cNo mortgage\u201d"}],["first_charge_balance","First-charge balance",{ph:"£150,000"}],
  ["first_charge_arrears_amount","Mortgage arrears amount (or Not sure)",{}],
  ["arrears_included_in_balance","Does the mortgage balance include those arrears?",{}],
  ["second_charge_balance","Second charge / restriction balance (or Not sure)",{}],
  ["second_charge_provider","Second-charge lender (if known)",{}],
  ["redemption_structure","Mandatory redemptions: within or on top of your request? *",{full:1}],
  ["first_charge_status","First-charge status",{}],["arrears","Any arrears?",{}],["second_charges","Any second charges?",{}],["restrictions","Any title restrictions?",{}]]},
 {t:"Credit & consent", s:"Your credit profile and the best time to contact you.", f:[
  ["legal_buffer","Your legal allowance choice *",{}],
  ["contingency_buffer","Your contingency choice *",{}],
  ["panel_solicitor_opt_in","Solicitor preference *",{full:1}],
  ["credit_profile","Credit profile *",{}],["credit_events","Any credit or insolvency issues?",{}],["missed_payments","Missed mortgage payments in the last 12 months",{}],
  ["contact_pref","Best time to contact you",{}],["notes","Anything else (optional)",{full:1}],
  ["ai_call_consent","I am happy for an AI assistant to handle the initial call with me before connecting me to a broker",{full:1}],
  ["contact_consent","I agree to be contacted by Posfin Capital about my fact find *",{full:1}]]}
];
STEPS[1].f.push(...BRANCH_FIELDS.map(f=>[f.key,f.label,{full:1}]));
const OPT = {...O,ownership:O.ownership,asset_type:O.asset_type,residential_type:O.residential_type,purpose:O.purpose,timescale:O.timescale,charge_position:O.charge_position,
  first_charge_status:O.first_charge_status,arrears:O.yns,second_charges:O.yns,restrictions:O.restrictions,credit_profile:O.credit_profile,credit_events:O.credit_events,missed_payments:O.missed_payments,contact_pref:O.contact_pref,
  property_experience:O.property_experience,bedrooms:O.bedrooms,rental_status:O.rental_status};
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let step = 0, code = "", mode = "server", landArchive = null, namedTest = false;
const fmt = v => { const n=money(v); return n===null ? "Not sure" : Number.isFinite(n) ? "£"+n.toLocaleString("en-GB") : String(v??""); };

// render
$("#steps").innerHTML = STEPS.map((st,i)=>`<section class="step" data-i="${i}"><h2>${st.t}</h2><p class="sub">${st.s}</p><div class="grid">`+
 st.f.map(([k,l,o])=>{ const f=F[k]; const cls=((o.full||f.t==="textarea"||f.t==="bool")?"full":"")+(o.test?" test-only hide":""); let inp;
  const why=o.why?`<p class="why">${esc(o.why)}</p>`:"";
  const labelFor=f.t==="date"?`${k}_day`:k;
  if(f.t==="select") inp=`<select id="${k}" name="${k}"><option value="">Please select</option>${OPT[k].map(x=>`<option value="${esc(x)}">${esc(["legal_buffer","contingency_buffer"].includes(k)&&x!=="Not sure"?"£"+Number(x).toLocaleString("en-GB"):x)}</option>`).join("")}</select>`;
  else if(f.t==="textarea") inp=`<textarea id="${k}" name="${k}" maxlength="${f.max}" placeholder="${esc(o.ph||"")}"></textarea>`;
  else if(f.t==="date") inp=`<div class="dob" data-dob-group="${k}"><label class="dob-part">Day<input id="${k}_day" data-dob="${k}" inputmode="numeric" maxlength="2" placeholder="DD" autocomplete="bday-day" aria-label="Day"></label><label class="dob-part">Month<input id="${k}_month" data-dob="${k}" inputmode="numeric" maxlength="2" placeholder="MM" autocomplete="bday-month" aria-label="Month"></label><label class="dob-part">Year<input id="${k}_year" data-dob="${k}" inputmode="numeric" maxlength="4" placeholder="YYYY" autocomplete="bday-year" aria-label="Year"></label></div><input type="hidden" id="${k}" name="${k}">`;
  else if(f.t==="bool"){ const notice=k==="contact_consent"?' <a href="/privacy-policy">Privacy notice</a>':""; return `<div class="${cls}"><label class="chk"><input type="checkbox" id="${k}" name="${k}"><span>${esc(l)}${notice}</span></label>${why}<div class="err" id="e_${k}"></div></div>`; }
  else { const ty=f.t==="email"?"email":f.t==="tel"?"tel":"text"; const im=f.t==="money"?' inputmode="numeric"':''; const upper=["first_charge_lender","second_charge_provider"].includes(k); const ac=o.ac?` autocomplete="${esc(o.ac)}"`:' autocomplete="off"'; inp=`<input type="${ty}" id="${k}" name="${k}"${im}${upper?' style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"':''} maxlength="${f.max||14}" placeholder="${esc(o.ph||"")}"${ac}>`; }
  return `<div class="${cls}"><label class="l" for="${labelFor}">${esc(l)}</label>${inp}${why}<div class="err" id="e_${k}"></div></div>`; }).join("")+`</div></section>`).join("");
for (const key of ["epc_rating","epc_certificate_number","epc_registration_date","epc_floor_area_m2","epc_habitable_rooms","epc_lookup_status"]) {
  const hidden=document.createElement("input"); hidden.type="hidden"; hidden.id=key; hidden.name=key; $("#ff").append(hidden);
}
const epcNote=document.createElement("p"); epcNote.id="epcNote"; epcNote.className="why full hide";
$("#security_address").parentElement.after(epcNote);
const epcFallback=document.createElement("div"); epcFallback.id="epcFallback"; epcFallback.className="full hide";
epcFallback.innerHTML='<label class="l" for="epc_fallback">EPC rating</label><select id="epc_fallback"><option value="Don\'t know">Don\'t know</option></select><p class="why">We could not match an EPC for this address. You can leave this as Don\'t know.</p>';
epcNote.after(epcFallback);
const propertiesHost=document.createElement('div');propertiesHost.id='propertiesEditor';document.querySelector('.step[data-i="1"]').append(propertiesHost);
const propertyEditor=createPropertyEditor(propertiesHost);
// Live formatting retains caret position, numeric keyboard and unresolved answers.
for (const [key, field] of Object.entries(F)) {
  const input=document.getElementById(key);
  if (input && field.t === "money") bindMoneyInput(input);
}
const postcode=$("#security_postcode"); bindPostcode(postcode);
postcode.insertAdjacentHTML("afterend", FINDER_MARKUP);
bindSecurityAddressPicker({postcodeInput:postcode,addressInput:$("#security_address"),button:$("#findAddress"),choices:$("#addressChoices"),message:$("#addressMessage")});
const landHost=document.createElement('section');landHost.className='card';landHost.id='landJourney';landHost.hidden=true;$('#ff').before(landHost);
const landJourney=createLandJourney({host:landHost,request:api,getCode:()=>code,setCode:c=>{code=c;},testMode:()=>testMode,onReturn:a=>{landArchive={...a,asset_type:'Land'};landJourney.stop();$('#ff').classList.remove('hide');a.asset_type=isLand(a)?'Residential':a.asset_type;fill(a);show(1);}});
function startLand(a){a={...(landArchive||{}),...a};$('#ff').classList.add('hide');document.querySelector('.intro').textContent='Your Land Fact Find. Save and finish later on any device.';landJourney.start(a);}
$('#asset_type').addEventListener('change',()=>{if(isLand({asset_type:$('#asset_type').value}))startLand(collect());});
$('#asset_type').value="Residential";
function syncBranches(){
  const a={};for(const key of Object.keys(F)){const el=document.getElementById(key);if(el)a[key]=el.value;}
  const res=$("#residential_type");res.disabled=a.asset_type!=="Residential";res.parentElement.classList.toggle('hide',res.disabled);
  const companyName=$("#company_name"), companyOwned=a.ownership==="Company";
  companyName.disabled=!companyOwned;
  companyName.parentElement.classList.toggle('hide',!companyOwned);
  if(!companyOwned) companyName.value="";
  const second=$("#applicant_2_dob"), joint=a.ownership==="Joint with spouse or partner";
  setDateEnabled("applicant_2_dob", joint); second.parentElement.classList.toggle("hide",!joint); if(!joint){ second.value=""; fillDobParts("applicant_2_dob",""); }
  const rent=$("#rental_income_monthly"), letOut=a.rental_status==="Let";
  if(rent){ rent.disabled=!letOut; rent.parentElement.classList.toggle("hide",!letOut); if(!letOut) rent.value=""; }
  for(const f of BRANCH_FIELDS){const el=document.getElementById(f.key),visible=branchVisible(f,a);el.disabled=!visible;el.parentElement.classList.toggle('hide',!visible);}
}
$("#ff").addEventListener('change',e=>{if(['asset_type','ownership','rental_status','includes_farmland','farm_business','planning_status','consent_implemented','planning_intent','income_present','occupancy_present','cil_s106'].includes(e.target.id)){syncBranches();updateFinancialReview();}});
syncBranches();
let epcSeen="";
function setHidden(id, value){ const el=document.getElementById(id); if(el) el.value=value==null?"":String(value); }
function showEpc(result){
  const note=$("#epcNote"), fallback=$("#epcFallback");
  setHidden("epc_lookup_status", result.status||"");
  if(result.status==="matched" && result.epc){
    const epc=result.epc;
    setHidden("epc_rating", epc.rating||"");
    setHidden("epc_certificate_number", epc.certificateNumber||"");
    setHidden("epc_registration_date", epc.registrationDate||"");
    setHidden("epc_floor_area_m2", epc.floorAreaM2??"");
    setHidden("epc_habitable_rooms", epc.habitableRooms??"");
    const bits=[epc.rating?"EPC "+epc.rating:"EPC found"];
    if(epc.registrationDate) bits.push("lodged "+epc.registrationDate);
    if(epc.floorAreaM2) bits.push(epc.floorAreaM2+" m²");
    if(epc.habitableRooms) bits.push(epc.habitableRooms+" habitable rooms");
    note.textContent=bits.join(" · ")+". Please confirm the number of bedrooms.";
    note.classList.remove("hide"); fallback.classList.add("hide");
    const bedrooms=$("#bedrooms");
    if(bedrooms && !bedrooms.value && Number.isInteger(epc.bedrooms) && epc.bedrooms>=0 && epc.bedrooms<=20){
      const value=epc.bedrooms===0?"Studio":epc.bedrooms>=6?"6+":String(epc.bedrooms);
      if([...bedrooms.options].some(o=>o.value===value)) bedrooms.value=value;
    }
    return;
  }
  setHidden("epc_rating","Don't know");
  setHidden("epc_certificate_number",""); setHidden("epc_registration_date",""); setHidden("epc_floor_area_m2",""); setHidden("epc_habitable_rooms","");
  note.textContent=result.status==="no_match"?"We could not match an EPC for this address.":"EPC lookup is not available just now. You can leave this as Don't know.";
  note.classList.remove("hide"); fallback.classList.remove("hide");
  const pick=$("#epc_fallback"); if(pick) pick.value="Don't know";
}
async function lookupEpc(){
  const postcode=$("#security_postcode")?.value||"", address=$("#security_address")?.value||"";
  const key=(postcode+"|"+address).replace(/\s/g,"").toUpperCase();
  if(address.trim().length<5 || key===epcSeen) return;
  epcSeen=key;
  try{
    const response=await fetch("/api/epc-lookup?postcode="+encodeURIComponent(postcode)+"&address="+encodeURIComponent(address));
    const result=await response.json();
    if((($("#security_postcode")?.value||"")+"|"+($("#security_address")?.value||"")).replace(/\s/g,"").toUpperCase()!==epcSeen) return;
    showEpc(result||{});
  }catch{ showEpc({status:"unavailable"}); }
}
$("#security_address").addEventListener("change", lookupEpc);
$("#epc_fallback").addEventListener("change", ()=>setHidden("epc_rating", $("#epc_fallback").value));
const productReview=document.createElement('div');productReview.id='productReview';$("#steps").after(productReview);
// Never strip signs/ranges/TBC while typing: shared validation preserves meaning.
const financialReview=document.createElement("div");financialReview.id="financialReview";$("#steps").after(financialReview);
function updateFinancialReview(){productReview.innerHTML=routeCard(collect());productReview.classList.toggle("hide",step<2);financialReview.innerHTML=renderScorecard(collect());financialReview.classList.toggle("hide",step<3);}
$("#ff").addEventListener("input",updateFinancialReview);$("#ff").addEventListener("change",updateFinancialReview);

function dobPart(k, part){ return document.getElementById(`${k}_${part}`); }
function syncDob(k){
  const hidden=document.getElementById(k); if(!hidden) return;
  const day=String(dobPart(k,"day")?.value||"").replace(/\D/g,"");
  const month=String(dobPart(k,"month")?.value||"").replace(/\D/g,"");
  const year=String(dobPart(k,"year")?.value||"").replace(/\D/g,"");
  hidden.value=day&&month&&year.length===4?`${year}-${month.padStart(2,"0")}-${day.padStart(2,"0")}`:"";
}
function fillDobParts(k, iso){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||""));
  const day=dobPart(k,"day"), month=dobPart(k,"month"), year=dobPart(k,"year");
  if(!day||!month||!year) return;
  day.value=match?String(Number(match[3])):"";
  month.value=match?String(Number(match[2])):"";
  year.value=match?match[1]:"";
}
function setDateEnabled(k, on){
  const hidden=document.getElementById(k); if(hidden) hidden.disabled=!on;
  for(const part of ["day","month","year"]){ const el=dobPart(k,part); if(el) el.disabled=!on; }
}
function collect(){ const a={}; for(const k of Object.keys(F)){ const el=document.getElementById(k); if(!el || el.disabled) continue; if(k==="test_mode_ack"&&!testMode) continue; if(F[k].t==="date") syncDob(k); if(F[k].t==="bool") a[k]=el.checked; else if(el.value) a[k]=["first_charge_lender","second_charge_provider"].includes(k)?el.value.toUpperCase():el.value; } return cleanBranches({...a,...propertyEditor.collect(),...(landArchive?{inactive_land_answers:landArchive}:{})}); }
function fill(a){ a={...a,purpose:S.normalisePurpose(a?.purpose ?? a?.loanPurpose ?? a?.loan_purpose)}; landArchive=a?.inactive_land_answers||landArchive; for(const [k,v] of Object.entries(a||{})){ const el=document.getElementById(k); if(!el || !F[k]) continue; if(F[k].t==="bool") el.checked=v===true; else el.value=F[k].t==="money"?fmt(v):(["first_charge_lender","second_charge_provider"].includes(k)?String(v).toUpperCase():v); if(F[k].t==="date") fillDobParts(k, el.value); } propertyEditor.fill(a);syncBranches(); if(a?.security_address) epcSeen=(String(a.security_postcode||"")+"|"+String(a.security_address)).replace(/\s/g,"").toUpperCase(); }
function show(i){ step=Math.max(0,Math.min(4,i)); document.querySelectorAll(".step").forEach(s=>s.classList.toggle("hide",+s.dataset.i!==step));
  document.querySelectorAll("#rail div").forEach((d,j)=>{d.classList.toggle("on",j===step);d.classList.toggle("done",j<step)});
  $("#back").style.visibility=step?"visible":"hidden"; $("#next").textContent=step===4?"Submit fact find":"Continue"; updateFinancialReview(); }
function setStatus(t,c){ const s=$("#status"); s.textContent=t; s.className="status "+(c||""); }
function clearErr(){ document.querySelectorAll(".err").forEach(e=>e.textContent=""); document.querySelectorAll(".bad").forEach(e=>e.classList.remove("bad")); }
function showErr(errs){ clearErr(); let first=null; for(const [k,m] of Object.entries(errs||{})){ const e=document.getElementById("e_"+k), el=document.getElementById(k); if(e) e.textContent=m; if(el){el.classList.add("bad"); const day=dobPart(k,"day"); if(day) day.classList.add("bad"); if(first===null) first=k;} } return first; }
function stepErrors(i){ const a=collect(), {errors}=S.validate(a,true,testMode); const keys=STEPS[i].f.map(x=>x[0]);if(i===1)keys.push("total_properties_owned","additional_properties"); const out={}; for(const k of keys) if(errors[k]) out[k]=errors[k]; return out; }
function setMode(m, why){ mode=m; const el=$("#mode");
  el.textContent = m==="server" ? (testMode?"Preview · saved to test database":"Saved securely") : "Saved on this device only";
  el.className="mode"+(m==="local"?" local":"");
  const fb=$("#fallback"); if(fb) fb.classList.toggle("hide", m!=="local");
  if(m==="local" && why) console.warn("factfind fallback:", why); }
function setTestMode(t){ testMode=!!t;
 const banner=$("#previewBanner"), notice=$("#previewNotice");
 if(banner) banner.textContent=testMode?"PREVIEW · TEST DATABASE · DO NOT ENTER REAL PERSONAL DETAILS":"";
 if(notice) notice.textContent=testMode?"PREVIEW: do not enter real personal details. Use made-up test data only. Test submissions are stored in the preview database and send a reference-only test alert to Byron. No personal details are included in that alert and nothing is sent to a lender.":"";
 document.querySelectorAll(".test-only").forEach(e=>e.classList.toggle("hide",!testMode)); }
let lastHealth=0;
async function checkHealth(){
  lastHealth=Date.now();
  try{ const r=await fetch("/api/factfind",{method:"GET",cache:"no-store"}); const h=await r.json();
    setTestMode(h.testMode===true || h.testRun===true);
    if(looksLikeTestLead(collect())) namedTest=true;
    if(h.ready){ setMode("server"); return true; }
    setMode("local", h.reason||h.db||"not_ready"); return false;
  }catch(e){ setTestMode(testMode); setMode("local","health_unreachable"); return false; }
}
function showCode(c){ code=c; $("#codeOut").textContent=c; $("#linkOut").value=location.origin+"/fact-find?resume="+encodeURIComponent(c); $("#resume").classList.add("show"); try{history.replaceState(null,"","/fact-find?resume="+encodeURIComponent(c));}catch(e){} }

function attribution(){ try{ return JSON.parse(sessionStorage.getItem("posfin_attr_v1")||"{}")||{}; }catch(e){ return {}; } }
async function api(body){ body={...body,attribution:attribution()}; let r; try{ r=await fetch("/api/factfind",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); }catch(e){ return {status:0,j:{error:"network"}}; } let j={}; try{j=await r.json();}catch(e){} return {status:r.status,j}; }
const down = s => s===0 || s>=500;
// local fallback store
const LS="posfin_ff_local_v1"; const lget=()=>{try{return JSON.parse(localStorage.getItem(LS)||"{}")}catch(e){return {}}}; const lput=d=>localStorage.setItem(LS,JSON.stringify(d));
const lcode=()=>{const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",b=new Uint8Array(12);crypto.getRandomValues(b);const s=[...b].map(x=>A[x%32]).join("");return s.match(/.{4}/g).join("-")};
const norm=c=>String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/(.{4})(?=.)/g,"$1-");

async function doSave(){
  $("#save").disabled=true;
  try{
    for(let attempt=0; attempt<2; attempt++){
      const answers=collect();
      if(looksLikeTestLead(answers)) namedTest=true;
      if(mode==="server"){
        const {status,j}=await api({action:"save",code,step:step+1,answers});
        if(down(status)){ setMode("local", j.error); continue; }
        if(!j.ok){ setStatus(j.error==="already_submitted"?"This fact find has already been submitted.":(j.message||"Could not save just now. Please try again."),"bad"); return false; }
        if(j.testMode) namedTest=true;
        showCode(j.code); setStatus((testMode?"Draft saved to the test database at ":"Draft saved securely at ")+new Date(j.savedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+".","ok"); return true;
      }
      if(Date.now()-lastHealth>30000 && await checkHealth()) continue;
      const d=lget(); if(!code) code=lcode(); d[code]={answers,step:step+1,status:"draft",savedAt:new Date().toISOString()}; lput(d); showCode(code);
      setStatus("Saved on this device only. Our secure online save is unavailable right now, so nothing has been sent to us yet.","warn"); return true;
    }
    setStatus("Could not save.","bad"); return false;
  }catch(e){ if(mode==="server"){ setMode("local"); return doSave(); } setStatus("Could not save.","bad"); return false; }
  finally{ if($("#save")) $("#save").disabled=false; }
}
const save = createSingleFlight(doSave);
async function resume(c){
  c=norm(c); const rs=$("#resumeStatus"); if(!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)){ rs.textContent="Please enter the 12-character code."; rs.className="status bad"; return; }
  rs.textContent="Opening…"; rs.className="status";
  try{
    if(mode==="server"){
      const {status,j}=await api({action:"load",code:c});
      if(down(status)) { setMode("local", j.error); return resume(c); }
      if(!j.ok){ rs.textContent=j.message||"Could not open that draft."; rs.className="status bad"; return; }
      if(j.status==="submitted"){ rs.textContent="That fact find has already been submitted (ref "+j.reference+")."; rs.className="status ok"; return; }
      fill(j.answers); showCode(c); if(isLand(j.answers))startLand(j.answers);else show((j.step||1)-1); rs.textContent="Draft "+j.reference+" opened."; rs.className="status ok"; $("#resbox").open=false; setStatus("Welcome back. Your saved answers are filled in.","ok");
    } else {
      const d=lget()[c]; if(!d){ rs.textContent="No draft with that code on this device."; rs.className="status bad"; return; }
      fill(d.answers); showCode(c); show((d.step||1)-1); rs.textContent="Draft opened from this device."; rs.className="status ok";
    }
  }catch(e){ if(mode==="server"){ setMode("local"); return resume(c);} rs.textContent="Could not open that draft."; rs.className="status bad"; }
}
async function submit(){
  const all=S.validate(collect(),true,testMode).errors; if(Object.keys(all).length){ const k=showErr(all); const si=["total_properties_owned","additional_properties"].includes(k)?1:STEPS.findIndex(s=>s.f.some(x=>x[0]===k)); if(si>=0) show(si); setStatus("Please check the highlighted answers.","bad"); return; }
  if(!code && !(await save(true))) return;
  $("#next").disabled=true; setStatus("Submitting…");
  try{
    if(mode==="server"){
      const {status,j}=await api({action:"submit",code,answers:collect()});
      if(down(status)){ setMode("local", j.error); $("#next").disabled=false; return submit(); }
      if(!j.ok){ if(j.fieldErrors) showErr(j.fieldErrors); setStatus(j.message||"Could not submit. Please check your answers.","bad"); return; }
      if(j.testMode||looksLikeTestLead(collect())) namedTest=true;
      const summary=routeCard(collect())+renderScorecard(collect())+renderProperties(collect());
      $("#ff").innerHTML='<h2>Your fact find is saved</h2><p id="submittedReference"></p><p>Thank you. We will review your declared figures and confirm the outstanding details together.</p>'+summary+'<p><a href="/">Back to the home page</a></p>';
      $("#submittedReference").textContent="Reference: "+j.reference+((testMode||namedTest)?" — test, excluded from live lead counts and alerts":"");
      window.scrollTo({top:0,behavior:"smooth"});
    } else {
      // Never pretend a local-only submit reached us. Re-check the server once, else show the not-sent panel.
      if(await checkHealth()){ $("#next").disabled=false; code=""; if(await save(true)) return submit(); }
      const d=lget(); d[code]={answers:collect(),status:"not_sent",savedAt:new Date().toISOString()}; lput(d);
      setStatus("Not sent. Your answers are saved on this device only. Please call us or book a 15-minute call, or try again in a few minutes.","bad");
      const fb=$("#fallback"); fb.classList.remove("hide"); fb.classList.add("urgent"); fb.scrollIntoView({behavior:"smooth",block:"center"});
    }
  } finally { if($("#next")) $("#next").disabled=false; }
}
let nextBusy=false;
$("#next").addEventListener("click",async()=>{
  if(step===4) return submit();
  const e=stepErrors(step);
  if(Object.keys(e).length){ showErr(e); setStatus("Please check the highlighted answers.","bad"); return; }
  clearErr();
  if(nextBusy) return;
  nextBusy=true;
  const btn=$("#next");
  btn.disabled=true; btn.textContent="Saving…";
  try{ const ok=await save(true); if(ok!==false) show(step+1); }
  finally{ nextBusy=false; if($("#next")){ $("#next").disabled=false; if($("#next").textContent==="Saving…") $("#next").textContent=step===4?"Submit fact find":"Continue"; } }
  window.scrollTo({top:0,behavior:"smooth"});
});
$("#back").addEventListener("click",()=>{ clearErr(); show(step-1); });
$("#save").addEventListener("click",()=>save(false));
$("#resumeBtn").addEventListener("click",()=>resume($("#resumeCode").value));
$("#linkOut").addEventListener("focus",e=>e.target.select());

// init
show(0); await checkHealth(); $("#ff").inert=false;
const q=new URLSearchParams(location.search);
const p=S.normalisePurpose(q.get("purpose") ?? q.get("loanPurpose") ?? q.get("loan_purpose")); if(p && O.purpose.includes(p)) document.getElementById("purpose").value=p;
const pt=q.get("asset"); if(pt && O.asset_type.includes(pt)) document.getElementById("asset_type").value=pt;
syncBranches();
if(!q.get("resume")&&(isLand({asset_type:pt})||q.get("lane")==="land"))startLand({...collect(),asset_type:pt||"Land"});
if(q.get("resume")){ $("#resbox").open=true; $("#resumeCode").value=q.get("resume"); resume(q.get("resume")); }
$("#retryBtn").addEventListener("click",async()=>{ setStatus("Checking…"); const ok=await checkHealth(); setStatus(ok?"Connected. You can save and submit as normal.":"Still unavailable. Please call us or book a 15-minute call.", ok?"ok":"bad"); });

/* Clear a field's error as soon as the user edits it */
document.addEventListener("input", clearOne, true);
document.addEventListener("change", clearOne, true);
function clearOne(ev){ const el=ev.target; if(!el||!el.id) return; if(el.dataset&&el.dataset.dob) syncDob(el.dataset.dob); const key=el.dataset&&el.dataset.dob?el.dataset.dob:el.id; const errs=stepErrors(step); if(!errs[key]){ const e=document.getElementById("e_"+key); if(e) e.textContent=""; el.classList.remove("bad"); const hidden=document.getElementById(key); if(hidden) hidden.classList.remove("bad"); } if(!Object.keys(errs).length){ const status=$("#status"); if(status&&status.textContent.startsWith("Please check the highlighted answers")) setStatus(""); } if(["full_name","company_name","notes"].includes(el.id)&&looksLikeTestLead(collect())) namedTest=true; }
