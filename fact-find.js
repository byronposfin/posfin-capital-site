import { createPropertyEditor } from "/lib/ff-properties-ui.js?v=20261104-properties";
import { renderProperties } from "/lib/ff-properties.js?v=20261104-properties";
import { BRANCH_FIELDS, branchVisible, cleanBranches, routeCard } from "/lib/ff-routing.js?v=20261104-live";
import { bindMoneyInput, bindPostcode } from "/lib/ff-inputs.js?v=20261104-live";
import { money, renderScorecard } from "/lib/ff-finance.js?v=20261104-lender-gate";
import * as S from "/lib/ff-schema.js?v=20261104-properties";
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
  ["full_name","Full name *",{ac:"off",ph:""}],["phone","Phone *",{ph:"07700 900000"}],["email","Email *",{ph:"name@example.com",full:1}],
  ["ownership","Who owns the property? *",{}],["company_name","Company name (if a company owns it)",{}],
  ["test_mode_ack","I understand this is a PREVIEW form and I am using made-up details only *",{full:1,test:1}]]},
 {t:"The property", s:"The security, its value and how it is used.", f:[
  ["asset_type","Security type *",{}],["residential_type","Residential type",{}],
  ["security_postcode","Security postcode *",{full:1,ph:"SW1A 1AA"}],["security_address","Security address",{full:1,ph:"Select an address above or enter it manually"}],["property_value","Estimated property value *",{ph:"£500,000"}]]},
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
  first_charge_status:O.first_charge_status,arrears:O.yns,second_charges:O.yns,restrictions:O.restrictions,credit_profile:O.credit_profile,credit_events:O.credit_events,missed_payments:O.missed_payments,contact_pref:O.contact_pref};
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let step = 0, code = "", mode = "server", busy = false;
const fmt = v => { const n=money(v); return n===null ? "Not sure" : Number.isFinite(n) ? "£"+n.toLocaleString("en-GB") : String(v??""); };

// render
$("#steps").innerHTML = STEPS.map((st,i)=>`<section class="step" data-i="${i}"><h2>${st.t}</h2><p class="sub">${st.s}</p><div class="grid">`+
 st.f.map(([k,l,o])=>{ const f=F[k]; const cls=((o.full||f.t==="textarea"||f.t==="bool")?"full":"")+(o.test?" test-only":""); let inp;
  if(f.t==="select") inp=`<select id="${k}" name="${k}"><option value="">Please select</option>${OPT[k].map(x=>`<option value="${esc(x)}">${esc(["legal_buffer","contingency_buffer"].includes(k)&&x!=="Not sure"?"£"+Number(x).toLocaleString("en-GB"):x)}</option>`).join("")}</select>`;
  else if(f.t==="textarea") inp=`<textarea id="${k}" name="${k}" maxlength="${f.max}" placeholder="${esc(o.ph||"")}"></textarea>`;
  else if(f.t==="bool") return `<div class="${cls}"><label class="chk"><input type="checkbox" id="${k}" name="${k}"><span>${esc(l)}</span></label><div class="err" id="e_${k}"></div></div>`;
  else { const ty=f.t==="email"?"email":f.t==="tel"?"tel":"text"; const im=f.t==="money"?' inputmode="numeric"':''; inp=`<input type="${ty}" id="${k}" name="${k}"${im} maxlength="${f.max||14}" placeholder="${esc(o.ph||"")}" autocomplete="off">`; }
  return `<div class="${cls}"><label class="l" for="${k}">${esc(l)}</label>${inp}<div class="err" id="e_${k}"></div></div>`; }).join("")+`</div></section>`).join("");
const propertiesHost=document.createElement('div');propertiesHost.id='propertiesEditor';document.querySelector('.step[data-i="1"]').append(propertiesHost);
const propertyEditor=createPropertyEditor(propertiesHost);
// Live formatting retains caret position, numeric keyboard and unresolved answers.
for (const [key, field] of Object.entries(F)) {
  const input=document.getElementById(key);
  if (input && field.t === "money") bindMoneyInput(input);
}
const postcode=$("#security_postcode"); bindPostcode(postcode);
postcode.insertAdjacentHTML("afterend", '<button type="button" id="findAddress" style="margin-top:10px">Find address</button><label class="l" for="addressChoices" style="margin-top:10px">Choose your address</label><select id="addressChoices" disabled><option>Enter postcode, then Find address</option></select><div id="addressMessage" role="status" aria-live="polite"></div>');
let addressRows=[], lookupVersion=0;
postcode.addEventListener("input",()=>{lookupVersion++;addressRows=[];$("#addressChoices").disabled=true;$("#addressChoices").innerHTML='<option>Find addresses for this postcode</option>';$("#addressMessage").textContent='';});
$("#findAddress").onclick=async()=>{
  const pc=postcode.value.trim().toUpperCase(), version=++lookupVersion;
  const button=$("#findAddress"), choices=$("#addressChoices"), message=$("#addressMessage");
  button.disabled=true;choices.disabled=true;message.textContent="Finding addresses…";
  try {
    const response=await fetch('/api/address-lookup?postcode='+encodeURIComponent(pc));const result=await response.json();
    if(version!==lookupVersion)return;
    if(!response.ok)throw new Error(result.error||'Address search unavailable. Please enter your address manually.');
    addressRows=result.addresses||[];
    choices.innerHTML='<option value="">Select your address</option>'+addressRows.map((a,i)=>`<option value="${i}">${esc(a.address)}</option>`).join('');
    choices.disabled=!addressRows.length;
    message.textContent=addressRows.length?'Choose from the list, or enter your address manually below.':'No addresses found. Please enter your address manually below.';
  }catch(e){if(version===lookupVersion)message.textContent=e.message;}
  finally{button.disabled=false;}
};
$("#addressChoices").onchange=()=>{const selected=addressRows[$("#addressChoices").value];if(!selected)return;$("#security_address").value=selected.address;$("#security_address").dispatchEvent(new Event('input',{bubbles:true}));};
$("#asset_type").value="Residential";
function syncBranches(){
  const a={};for(const key of Object.keys(F)){const el=document.getElementById(key);if(el)a[key]=el.value;}
  const res=$("#residential_type");res.disabled=a.asset_type!=="Residential";res.parentElement.classList.toggle('hide',res.disabled);
  for(const f of BRANCH_FIELDS){const el=document.getElementById(f.key),visible=branchVisible(f,a);el.disabled=!visible;el.parentElement.classList.toggle('hide',!visible);}
}
$("#ff").addEventListener('change',e=>{if(['asset_type','includes_farmland','farm_business','planning_status','consent_implemented','planning_intent','income_present','occupancy_present','cil_s106'].includes(e.target.id)){syncBranches();updateFinancialReview();}});
syncBranches();
const productReview=document.createElement('div');productReview.id='productReview';$("#steps").after(productReview);
// Never strip signs/ranges/TBC while typing: shared validation preserves meaning.
const financialReview=document.createElement("div");financialReview.id="financialReview";$("#steps").after(financialReview);
function updateFinancialReview(){productReview.innerHTML=routeCard(collect());productReview.classList.toggle("hide",step<2);financialReview.innerHTML=renderScorecard(collect());financialReview.classList.toggle("hide",step<3);}
$("#ff").addEventListener("input",updateFinancialReview);$("#ff").addEventListener("change",updateFinancialReview);

function collect(){ const a={}; for(const k of Object.keys(F)){ const el=document.getElementById(k); if(!el || el.disabled) continue; if(k==="test_mode_ack"&&!testMode) continue; if(F[k].t==="bool") a[k]=el.checked; else if(el.value) a[k]=el.value; } return cleanBranches({...a,...propertyEditor.collect()}); }
function fill(a){ for(const [k,v] of Object.entries(a||{})){ const el=document.getElementById(k); if(!el || !F[k]) continue; if(F[k].t==="bool") el.checked=v===true; else el.value=F[k].t==="money"?fmt(v):v; } propertyEditor.fill(a);syncBranches(); }
function show(i){ step=Math.max(0,Math.min(4,i)); document.querySelectorAll(".step").forEach(s=>s.classList.toggle("hide",+s.dataset.i!==step));
  document.querySelectorAll("#rail div").forEach((d,j)=>{d.classList.toggle("on",j===step);d.classList.toggle("done",j<step)});
  $("#back").style.visibility=step?"visible":"hidden"; $("#next").textContent=step===4?"Submit fact find":"Continue"; updateFinancialReview(); }
function setStatus(t,c){ const s=$("#status"); s.textContent=t; s.className="status "+(c||""); }
function clearErr(){ document.querySelectorAll(".err").forEach(e=>e.textContent=""); document.querySelectorAll(".bad").forEach(e=>e.classList.remove("bad")); }
function showErr(errs){ clearErr(); let first=null; for(const [k,m] of Object.entries(errs||{})){ const e=document.getElementById("e_"+k), el=document.getElementById(k); if(e) e.textContent=m; if(el){el.classList.add("bad"); if(first===null) first=k;} } return first; }
function stepErrors(i){ const a=collect(), {errors}=S.validate(a,true,testMode); const keys=STEPS[i].f.map(x=>x[0]);if(i===1)keys.push("total_properties_owned","additional_properties"); const out={}; for(const k of keys) if(errors[k]) out[k]=errors[k]; return out; }
function setMode(m, why){ mode=m; const el=$("#mode");
  el.textContent = m==="server" ? (testMode?"Preview · saved to test database":"Saved securely") : "Saved on this device only";
  el.className="mode"+(m==="local"?" local":"");
  const fb=$("#fallback"); if(fb) fb.classList.toggle("hide", m!=="local");
  if(m==="local" && why) console.warn("factfind fallback:", why); }
function setTestMode(t){ testMode=!!t; document.querySelectorAll(".test-only").forEach(e=>e.classList.toggle("hide",!testMode)); }
let lastHealth=0;
async function checkHealth(){
  lastHealth=Date.now();
  try{ const r=await fetch("/api/factfind",{method:"GET",cache:"no-store"}); const h=await r.json();
    setTestMode(h.testMode===true || h.testRun===true);
    if(h.ready){ setMode("server"); return true; }
    setMode("local", h.reason||h.db||"not_ready"); return false;
  }catch(e){ setMode("local","health_unreachable"); return false; }
}
function showCode(c){ code=c; $("#codeOut").textContent=c; $("#linkOut").value=location.origin+"/fact-find?resume="+encodeURIComponent(c); $("#resume").classList.add("show"); try{history.replaceState(null,"","/fact-find?resume="+encodeURIComponent(c));}catch(e){} }

function attribution(){ try{ return JSON.parse(sessionStorage.getItem("posfin_attr_v1")||"{}")||{}; }catch(e){ return {}; } }
async function api(body){ body={...body,attribution:attribution()}; let r; try{ r=await fetch("/api/factfind",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); }catch(e){ return {status:0,j:{error:"network"}}; } let j={}; try{j=await r.json();}catch(e){} return {status:r.status,j}; }
const down = s => s===0 || s>=500;
// local fallback store
const LS="posfin_ff_local_v1"; const lget=()=>{try{return JSON.parse(localStorage.getItem(LS)||"{}")}catch(e){return {}}}; const lput=d=>localStorage.setItem(LS,JSON.stringify(d));
const lcode=()=>{const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",b=new Uint8Array(12);crypto.getRandomValues(b);const s=[...b].map(x=>A[x%32]).join("");return s.match(/.{4}/g).join("-")};
const norm=c=>String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/(.{4})(?=.)/g,"$1-");

async function save(quiet){
  if(busy) return false; busy=true; $("#save").disabled=true;
  const answers=collect();
  try{
    if(mode==="server"){
      const {status,j}=await api({action:"save",code,step:step+1,answers});
      if(down(status)) { setMode("local", j.error); busy=false; $("#save").disabled=false; return save(quiet); }
      if(!j.ok){ setStatus(j.error==="already_submitted"?"This fact find has already been submitted.":(j.message||"Could not save just now. Please try again."),"bad"); return false; }
      showCode(j.code); setStatus((testMode?"Draft saved to the test database at ":"Draft saved securely at ")+new Date(j.savedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+".","ok"); return true;
    } else {
      if(Date.now()-lastHealth>30000 && await checkHealth()){ busy=false; $("#save").disabled=false; return save(quiet); }
      const d=lget(); if(!code) code=lcode(); d[code]={answers,step:step+1,status:"draft",savedAt:new Date().toISOString()}; lput(d); showCode(code);
      setStatus("Saved on this device only. Our secure online save is unavailable right now, so nothing has been sent to us yet.","warn"); return true;
    }
  }catch(e){ if(mode==="server"){ setMode("local"); busy=false; $("#save").disabled=false; return save(quiet);} setStatus("Could not save.","bad"); return false; }
  finally{ busy=false; $("#save").disabled=false; }
}
async function resume(c){
  c=norm(c); const rs=$("#resumeStatus"); if(!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)){ rs.textContent="Please enter the 12-character code."; rs.className="status bad"; return; }
  rs.textContent="Opening…"; rs.className="status";
  try{
    if(mode==="server"){
      const {status,j}=await api({action:"load",code:c});
      if(down(status)) { setMode("local", j.error); return resume(c); }
      if(!j.ok){ rs.textContent=j.message||"Could not open that draft."; rs.className="status bad"; return; }
      if(j.status==="submitted"){ rs.textContent="That fact find has already been submitted (ref "+j.reference+")."; rs.className="status ok"; return; }
      fill(j.answers); showCode(c); show((j.step||1)-1); rs.textContent="Draft "+j.reference+" opened."; rs.className="status ok"; $("#resbox").open=false; setStatus("Welcome back. Your saved answers are filled in.","ok");
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
      const summary=routeCard(collect())+renderScorecard(collect())+renderProperties(collect());
      $("#ff").innerHTML='<h2>Your fact find is saved</h2><p id="submittedReference"></p><p>Thank you. We will review your declared figures and confirm the outstanding details together.</p>'+summary+'<p><a href="/">Back to the home page</a></p>';
      $("#submittedReference").textContent="Reference: "+j.reference+(testMode?" — synthetic preview test":"");
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
$("#next").addEventListener("click",async()=>{ if(step===4) return submit(); const e=stepErrors(step); if(Object.keys(e).length){ showErr(e); setStatus("Please check the highlighted answers.","bad"); return; } clearErr(); const ok=await save(true); if(ok!==false) show(step+1); window.scrollTo({top:0,behavior:"smooth"}); });
$("#back").addEventListener("click",()=>{ clearErr(); show(step-1); });
$("#save").addEventListener("click",()=>save(false));
$("#resumeBtn").addEventListener("click",()=>resume($("#resumeCode").value));
$("#linkOut").addEventListener("focus",e=>e.target.select());

// init
show(0); setMode("server"); await checkHealth();
const q=new URLSearchParams(location.search);
const p=q.get("purpose"); if(p && O.purpose.includes(p)) document.getElementById("purpose").value=p;
const pt=q.get("asset"); if(pt && O.asset_type.includes(pt)) document.getElementById("asset_type").value=pt;
syncBranches();
if(q.get("resume")){ $("#resbox").open=true; $("#resumeCode").value=q.get("resume"); resume(q.get("resume")); }
$("#retryBtn").addEventListener("click",async()=>{ setStatus("Checking…"); const ok=await checkHealth(); setStatus(ok?"Connected. You can save and submit as normal.":"Still unavailable. Please call us or book a 15-minute call.", ok?"ok":"bad"); });

/* Clear a field's error as soon as the user edits it */
document.addEventListener("input", clearOne, true);
document.addEventListener("change", clearOne, true);
function clearOne(ev){ const el=ev.target; if(!el||!el.id) return; const e=document.getElementById("e_"+el.id); if(e&&e.textContent){ e.textContent=""; el.classList.remove("bad"); } }
