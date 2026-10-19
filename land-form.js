(function(){
const cfg=PosfinIntakeConfig,core=PosfinLand,fields=PosfinLandFields,form=document.querySelector('#land-form'),host=document.querySelector('#fields');
for(const [k,v] of Object.entries({teal:cfg.brand.posfin.teal,navy:cfg.brand.posfin.navy,cream:cfg.brand.posfin.cream}))document.documentElement.style.setProperty('--'+k,v);
let chargeCount=0;const sections=[...new Set(fields.map(f=>f.section))];
const input=(f,prefix='')=>{const id=prefix+f.key;return `<div class="field" data-key="${id}"><label for="${id}">${core.esc(f.label)}</label>${f.type==='select'?`<select id="${id}" name="${id}" required><option value="">Please select</option>${f.options.map(v=>`<option>${core.esc(v)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea id="${id}" name="${id}" required></textarea>`:`<input id="${id}" name="${id}" type="${f.type}" ${f.type==='number'?'min="0" step="any" inputmode="decimal"':''} required>`}</div>`;};
host.innerHTML=sections.map(s=>`<fieldset data-section="${core.esc(s)}"><legend>${core.esc(s)}</legend>${fields.filter(f=>f.section===s).map(f=>f.type==='charges'?'<div class="field" data-key="charges"><p>First charge or second charge (sometimes called junior or mezzanine debt).</p><div id="charges"></div><button id="add-charge" type="button">Add another loan</button></div>':input(f)).join('')}</fieldset>`).join('');
const chargeFields=[{key:'lender',label:'Lender',type:'text'},{key:'balance',label:'Balance (£)',type:'number'},{key:'payment_or_rate',label:'Monthly payment or rate',type:'text'},{key:'charge_position',label:'Charge position',type:'select',options:['First charge','Second charge','Other']},{key:'titles',label:'Parcels / titles covered',type:'text'},{key:'status',label:'Past end date, arrears or default rate?',type:'select',options:['Up to date','Past end date','Arrears','Default rate','Not sure']},{key:'redemption',label:'Redemption figure or reduced settlement negotiations?',type:'text'}];
function addCharge(){const i=chargeCount++,el=document.createElement('div');el.className='charge';el.dataset.index=i;el.innerHTML=`<h3>Loan ${i+1}</h3>`+chargeFields.map(f=>input(f,'charge_'+i+'_')).join('')+`<button type="button" class="remove-charge">Remove this loan</button>`;document.querySelector('#charges').append(el);el.querySelector('.remove-charge').onclick=()=>{el.remove();update();};}
document.querySelector('#add-charge').onclick=()=>{addCharge();update();};
function data(){const d=Object.fromEntries(new FormData(form));d.charges=[...document.querySelectorAll('.charge')].map(el=>Object.fromEntries(chargeFields.map(f=>[f.key,form.elements['charge_'+el.dataset.index+'_'+f.key].value])));for(const k of Object.keys(d))if(k.startsWith('charge_')&&k!=='charge_request')delete d[k];return d;}
const notice=document.createElement('div');notice.className='reroute';notice.hidden=true;host.prepend(notice);
const low=document.createElement('p');low.setAttribute('role','status');document.querySelector('[data-key=property_value]').append(low);
function update(){const d=data();if(d.secured_lending==='Yes'&&!document.querySelector('.charge'))addCharge();
 for(const f of fields){const el=host.querySelector(`[data-key="${f.key}"]`),show=core.visible(f,d);el.hidden=!show;el.querySelectorAll('input,select,textarea').forEach(e=>{e.disabled=!show;e.required=show;});}
 const r=core.route(d);notice.hidden=r==='pa_land';if(notice.dataset.route!==r){notice.dataset.route=r;notice.innerHTML=r==='main_loan'?'<b>This is property finance, not bare land.</b><p>Your address will carry into the property Fact Find.</p><button type="button" id="reroute">Continue to property Fact Find →</button>':r==='development_finance'?'<b>Funding the build itself is Development Finance.</b><p>Your address will carry forward.</p><button type="button" id="reroute">Continue to Development Finance →</button>':'';
 }
 if(r!=='pa_land'){notice.querySelector('button').onclick=()=>{sessionStorage.setItem('posfin_land_transfer',JSON.stringify({property_address:d.property_address,product:r}));location.href='/apply?land_route='+r;};}
 const below=d.property_value!==''&&d.property_value!==undefined&&Number(d.property_value)<cfg.thresholds.minimum_security_value;low.textContent=below?cfg.decline_copy:'';
}
form.addEventListener('change',e=>{if(e.target.tagName==='SELECT'||e.target.name==='property_value')update();});form.addEventListener('input',e=>{if(e.target.name==='property_value')update();});update();
const transfer=JSON.parse(sessionStorage.getItem('posfin_land_transfer')||'null');if(transfer){for(const [k,v] of Object.entries(transfer))if(form.elements[k])form.elements[k].value=v;sessionStorage.removeItem('posfin_land_transfer');update();}
form.addEventListener('submit',async e=>{e.preventDefault();const d=data();if(core.route(d)!=='pa_land'){notice.scrollIntoView();notice.querySelector('button').focus();return;}if(!form.reportValidity())return;
 const btn=form.querySelector('[type=submit]'),status=document.querySelector('#save-status');btn.disabled=true;status.textContent='Saving your Fact Find…';
 const ref=form.dataset.ref||('POSFIN-WEB-'+d.last_name.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,30)+'-'+String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'));form.dataset.ref=ref;
 const nonce=form.dataset.nonce||crypto.randomUUID();form.dataset.nonce=nonce;
 const payload={...d,deal_ref:ref,product:'pa_land',intake_type:'pa_land',route_check_stage:'complete',intake_nonce:nonce,property_type:'Land',net_or_gross:'net',page_source:'land',carried_property_answers:transfer?.carried_property_answers||null};
 for(const f of fields)if(!core.visible(f,d))delete payload[f.key];
 try{const r=await fetch('/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await r.json();if(!r.ok||!result.ok)throw Error('Save failed');
 const out=document.querySelector('#result');out.innerHTML=result.declined?'<h1>Thank you</h1><p>'+core.esc(cfg.decline_copy)+'</p>':core.render(payload,result.leadRef||ref);document.querySelector('#fact-find').hidden=true;out.hidden=false;out.focus();out.scrollIntoView({behavior:'smooth'});
 }catch{status.textContent='We could not save your Fact Find. Your answers are still here. Please retry.';btn.disabled=false;}
});
})();
