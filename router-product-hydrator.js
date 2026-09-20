// POSFIN Router → Product Page Hydrator
// Locked 2026-09-19: carries /apply router answers into product page steps.
// Activates only for router-referred URLs: ?from=apply_router&case_ref=...
(function () {
  'use strict';
  var qs = new URLSearchParams(window.location.search || '');
  if (qs.get('from') !== 'apply_router' || !qs.get('case_ref')) return;

  var PARAMS = Object.fromEntries(qs.entries());
  var STYLE_ID = 'posfin-router-hydrator-style';
  var BOX_ID = 'posfin-router-carried-box';
  var PROMOTED_ID = 'posfin-router-promoted-apply';
  var didInitialHydrate = false;
  var didInitialScroll = false;
  var EXTRA = {};

  function norm(s) { return String(s || '').trim(); }
  function lower(s) { return norm(s).toLowerCase(); }
  function money(v) { return String(v || '').replace(/[^0-9.]/g, ''); }
  function yesNo(v) {
    var x = lower(v);
    if (!x) return '';
    if (['yes','y','true','1','arrears','has arrears'].some(function(t){return x === t || x.includes(t);} )) return 'Yes';
    if (['no','n','false','0','none','no arrears'].some(function(t){return x === t || x.includes(t);} )) return 'No';
    return v;
  }
  function purpose(v) {
    var x = lower(v);
    if (!x) return '';
    if (x.includes('refinance') || x.includes('capital')) return 'Refinance / capital raise';
    if (x.includes('purchase')) return x.includes('auction') ? 'Auction purchase' : 'Property purchase';
    if (x.includes('development exit')) return 'Development exit';
    if (x.includes('development finance')) return 'Development finance';
    if (x.includes('business')) return 'Business cashflow';
    if (x.includes('debt')) return 'Debt consolidation';
    return v;
  }
  function stripPostcode(address, postcode) {
    var a = norm(address), pc = norm(postcode);
    if (!a || !pc) return a;
    var esc = pc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/, '\\s*');
    return a.replace(new RegExp('\\s*,?\\s*' + esc + '\\s*$', 'i'), '').trim();
  }
  function nativeSet(el, value) {
    if (!el || value === undefined || value === null || value === '') return false;
    var v = String(value);
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, v); else el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function textOf(el) { return (el && el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function fields() { return Array.prototype.slice.call(document.querySelectorAll('input, textarea, select')); }
  function byLabel(labelIncludes) {
    var target = lower(labelIncludes);
    var labels = Array.prototype.slice.call(document.querySelectorAll('label'));
    for (var i = 0; i < labels.length; i++) {
      var txt = lower(textOf(labels[i]));
      if (!txt.includes(target)) continue;
      var wrapInput = labels[i].querySelector('input, textarea, select');
      if (wrapInput) return wrapInput;
      var next = labels[i].parentElement && labels[i].parentElement.querySelector('input, textarea, select');
      if (next) return next;
    }
    return null;
  }
  function setByLabels(labels, value) {
    for (var i = 0; i < labels.length; i++) {
      var el = byLabel(labels[i]);
      if (nativeSet(el, value)) return true;
    }
    return false;
  }
  function optionMatches(text, wanted) {
    var txt = lower(text), w = lower(wanted);
    if (!txt || !w) return false;
    if (txt === w || txt.includes(w) || w.includes(txt)) return true;
    if (w === 'yes' && (txt === 'yes' || txt.includes('yes —'))) return true;
    if (w === 'no' && (txt === 'no' || txt.includes('no arrears'))) return true;
    return false;
  }
  function paintOption(input, active) {
    var label = input && input.closest('label');
    if (!label) return;
    if (input.type === 'checkbox') {
      label.style.borderColor = '';
      label.style.background = '';
      input.checked = !!active;
      input.style.accentColor = '#00B5B0';
      return;
    }
    var dot = label.querySelector('span');
    label.style.borderColor = active ? '#00B5B0' : '#E5E1D6';
    label.style.background = active ? 'rgba(0,181,176,0.06)' : '#FFFFFF';
    if (dot) {
      dot.style.borderColor = active ? '#00B5B0' : '#CFC9B8';
      dot.style.background = active ? '#00B5B0' : '#FFFFFF';
    }
  }
  function setOption(input, active) {
    if (!input) return false;
    var group = input.name;
    if (group && (input.type === 'radio' || input.type === 'checkbox')) {
      Array.prototype.slice.call(document.querySelectorAll('input[name="'+CSS.escape(group)+'"]')).forEach(function(peer){
        if (peer !== input && peer.type === 'radio') { peer.checked = false; paintOption(peer, false); }
      });
    }
    input.checked = !!active;
    paintOption(input, !!active);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function clickOption(groupName, wanted) {
    if (!wanted) return false;
    var inputs = Array.prototype.slice.call(document.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      if (groupName && input.name && input.name !== groupName) continue;
      var label = input.closest('label');
      var txt = label ? textOf(label) : input.value;
      if (optionMatches(input.value, wanted) || optionMatches(txt, wanted)) return setOption(input, true);
    }
    return false;
  }
  function firstName(full) { return norm(PARAMS.first_name) || norm(full).split(/\s+/)[0] || ''; }
  function lastName(full) { var explicit = norm(PARAMS.last_name); if (explicit) return explicit; var p = norm(full).split(/\s+/); return p.length > 1 ? p.slice(1).join(' ') : ''; }

  function sourceValues() {
    var full = PARAMS.full_name || PARAMS.name || '';
    var postcode = PARAMS.security_postcode || PARAMS.property_postcode || '';
    var addr = PARAMS.property_address || PARAMS.security_address || '';
    return {
      firstName: firstName(full),
      lastName: lastName(full),
      mobile: PARAMS.mobile || PARAMS.phone || '',
      email: PARAMS.email || '',
      loanPurpose: purpose(PARAMS.loan_purpose || PARAMS.purpose || ''),
      propertyAddress: stripPostcode(addr, postcode),
      postcode: postcode,
      propertyValue: money(PARAMS.property_value),
      firstChargeLender: PARAMS.first_charge_lender || '',
      firstChargeBalance: money(PARAMS.first_charge_balance),
      secondCharges: yesNo(PARAMS.second_charges),
      secondChargeProvider: PARAMS.second_charge_lender || PARAMS.second_charge_provider || '',
      secondChargeBalance: money(PARAMS.second_charge_balance),
      arrears: yesNo(PARAMS.first_charge_arrears),
      arrearsAmount: money(PARAMS.first_charge_arrears_amount || PARAMS.mortgage_arrears_amount || PARAMS.arrears_amount),
      loanAmount: money(PARAMS.loan_amount),
      chargeRequested: PARAMS.charge_requested || ''
    };
  }
  var V = sourceValues();

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = 'html.posfin-router-continuation,body.posfin-router-continuation{scroll-behavior:auto!important}#'+BOX_ID+'{margin:0 0 18px;padding:14px 16px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055);font-family:"DM Sans",Arial,sans-serif;color:#1C184F;font-size:13px;line-height:1.45}#'+BOX_ID+' strong{color:#00B5B0}#'+BOX_ID+' ul{margin:8px 0 0 18px;padding:0;color:#5A5770}.posfin-router-promoted-form{scroll-margin-top:0!important;margin-top:0!important}.posfin-router-promoted-form [class~="h-1"]{height:10px!important;border-radius:0!important}.posfin-router-promoted-form>div{padding-top:14px!important;padding-bottom:38px!important}.posfin-router-promoted-form [class*="mb-14"],.posfin-router-promoted-form [class*="md:mb-20"]{margin-bottom:18px!important}@media(max-width:767px){.posfin-router-promoted-form{padding-top:0!important}.posfin-router-promoted-form>div{padding-top:10px!important}.posfin-router-promoted-form .grid{display:flex!important;flex-direction:column!important;gap:18px!important}.posfin-router-promoted-form .grid>div:nth-child(2){order:-1!important}.posfin-router-promoted-form [class*="md:col-span"]{min-width:0!important}.posfin-router-promoted-form [class*="space-y-6"]{margin-top:0!important}}';
    document.head.appendChild(st);
  }
  function productFormHeading() {
    return Array.prototype.slice.call(document.querySelectorAll('h2,h3')).find(function(h){ return /tell us about the loan|security property|loan requirements/i.test(textOf(h)); });
  }
  function productFormSection() {
    var h = productFormHeading();
    return h ? (h.closest('section') || h.closest('[class*="grid"]') || h.parentElement) : null;
  }
  function promoteProductForm() {
    addStyle();
    document.documentElement.classList.add('posfin-router-continuation');
    document.body.classList.add('posfin-router-continuation');
    var section = productFormSection();
    if (!section) return;
    section.id = PROMOTED_ID;
    section.setAttribute('data-router-promoted','1');
    section.classList.add('posfin-router-promoted-form');
    var topBar = document.querySelector('body > div > div:first-child');
    var pageRoot = topBar && topBar.parentElement;
    if (pageRoot && section.parentElement === pageRoot && topBar.nextSibling !== section) {
      pageRoot.insertBefore(section, topBar.nextSibling);
    }
    Array.prototype.slice.call(document.querySelectorAll('button,a')).forEach(function(el){
      if (/get indicative terms|apply now/i.test(textOf(el))) {
        if (el.tagName === 'A') el.setAttribute('href','#'+PROMOTED_ID);
        el.onclick = function(ev){ ev.preventDefault(); scrollToForm(); };
      }
    });
  }
  function carriedItems() {
    var rows = [
      ['Name', [V.firstName, V.lastName].filter(Boolean).join(' ')],
      ['Mobile', V.mobile], ['Email', V.email], ['Purpose', V.loanPurpose],
      ['Property', [V.propertyAddress, V.postcode].filter(Boolean).join(', ')],
      ['Value', V.propertyValue ? '£' + Number(V.propertyValue).toLocaleString('en-GB') : ''],
      ['1st charge', [V.firstChargeLender, V.firstChargeBalance ? '£' + Number(V.firstChargeBalance).toLocaleString('en-GB') : ''].filter(Boolean).join(' — ')],
      ['Additional charges', V.secondCharges === 'Yes' ? [V.secondChargeProvider, V.secondChargeBalance ? '£' + Number(V.secondChargeBalance).toLocaleString('en-GB') : ''].filter(Boolean).join(' — ') : V.secondCharges],
      ['Mortgage arrears', V.arrears],
      ['Loan amount', V.loanAmount ? '£' + Number(V.loanAmount).toLocaleString('en-GB') : ''],
      ['Charge requested', V.chargeRequested]
    ].filter(function(r){return norm(r[1]);});
    return rows;
  }
  function ensureCarriedBox() {
    addStyle();
    var formCard = productFormSection() || document.querySelector('section[id="apply"]') || document.querySelector('section[style*="FAF8F3"]');
    var mount = productFormHeading();
    if (!mount) return;
    var parent = mount.parentElement;
    if (!parent || parent.querySelector('#'+BOX_ID)) return;
    var box = document.createElement('div');
    box.id = BOX_ID;
    var lis = carriedItems().map(function(r){return '<li><strong>'+r[0]+':</strong> '+String(r[1]).replace(/[<>]/g,'')+'</li>';}).join('');
    box.innerHTML = '<strong>Carried through from your first screen.</strong><br>We have pre-filled the answers below. Please check and edit anything that is not quite right.<ul>'+lis+'</ul>';
    parent.insertBefore(box, mount.nextSibling);
  }
  function hydrateVisibleFields() {
    if (didInitialHydrate || !productFormHeading() || !fields().length) return false;
    setByLabels(['first name'], V.firstName);
    setByLabels(['last name'], V.lastName);
    setByLabels(['mobile'], V.mobile);
    setByLabels(['email'], V.email);
    clickOption('loanPurpose', V.loanPurpose);
    setByLabels(['property address'], V.propertyAddress);
    setByLabels(['postcode'], V.postcode);
    setByLabels(['estimated property value', 'property value'], V.propertyValue);
    setByLabels(['first charge lender'], V.firstChargeLender);
    setByLabels(['outstanding mortgage balance', 'first-charge balance'], V.firstChargeBalance);
    if (V.secondCharges) clickOption('secondCharges', V.secondCharges);
    setByLabels(['2nd charge provider', '2nd charge lender'], V.secondChargeProvider);
    setByLabels(['2nd charge balance'], V.secondChargeBalance);
    if (V.arrears) clickOption('arrears', V.arrears === 'Yes' ? 'Yes — I have arrears' : 'No arrears');
    setByLabels(['loan amount required'], V.loanAmount);
    didInitialHydrate = true;
    return true;
  }
  function formTop() {
    return productFormSection() || document.getElementById(PROMOTED_ID) || document.querySelector('section[id="apply"]');
  }
  function scrollToForm(force) {
    if (didInitialScroll && !force) return;
    var target = formTop();
    if (!target) return;
    var y = target.getBoundingClientRect().top + window.pageYOffset - 4;
    if (y < 0) y = 0;
    window.scrollTo(0, y);
    didInitialScroll = true;
  }
  function rewriteStepLabels() {
    Array.prototype.slice.call(document.querySelectorAll('div,span,p')).forEach(function(el){
      var t = textOf(el);
      if (/^Step\s+1\s+of\s+3(?:\s*·\s*60 seconds)?$/i.test(t)) el.textContent = 'Step 2 of 4 — About you';
      else if (/^Step\s+2\s+of\s+3$/i.test(t)) el.textContent = 'Step 3 of 4 — The property';
      else if (/^Step\s+3\s+of\s+3(?:\s*·\s*Almost there)?$/i.test(t)) el.textContent = 'Step 4 of 4 — Loan requirements';
    });
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(n){
      var s = n.nodeValue;
      if (/Estimated LTV/i.test(s)) n.nodeValue = s.replace(/Estimated LTV/g, 'Net LTV');
      if (/combined LTV/i.test(s)) n.nodeValue = s.replace(/combined LTV/gi, 'Net LTV');
      if (/Ackroyds \(our recommended solicitor\)/i.test(s)) n.nodeValue = s.replace(/Ackroyds \(our recommended solicitor\)/g, 'LARK (our recommended solicitor)');
    });
  }
  function numFromLabel(label) {
    var el = byLabel(label);
    return el ? Number(money(el.value)) || 0 : 0;
  }
  function checkedText(labelText) {
    var labels = Array.prototype.slice.call(document.querySelectorAll('label'));
    for (var i=0;i<labels.length;i++) {
      var inp = labels[i].querySelector('input[type="checkbox"],input[type="radio"]');
      if (inp && inp.checked && lower(textOf(labels[i])).includes(lower(labelText))) return true;
    }
    return false;
  }
  function updateNetLtv() {
    var pv = numFromLabel('estimated property value') || Number(V.propertyValue) || 0;
    var fc = numFromLabel('outstanding mortgage balance') || Number(V.firstChargeBalance) || 0;
    var ln = numFromLabel('loan amount required') || Number(V.loanAmount) || 0;
    if (!pv || !ln) return;
    var second = numFromLabel('2nd charge balance') || Number(V.secondChargeBalance) || 0;
    var arrears = numFromLabel('arrears amount') || 0;
    var legal = checkedText('legal') ? 3000 : 0;
    var overrun = checkedText('contingency') ? 10000 : 0;
    var netFacility = ln + second + arrears + legal + overrun;
    var netLtv = Math.round(((fc + netFacility) / pv) * 100);
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(n){
      if (/Estimated LTV|Net LTV/i.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/Estimated LTV/g, 'Net LTV');
      if (/\b\d{1,3}%\b/.test(n.nodeValue) && /LTV|within|criteria|scorecard/i.test(textOf(n.parentElement && n.parentElement.closest('div') || n.parentElement))) {
        n.nodeValue = n.nodeValue.replace(/\b\d{1,3}%\b/, netLtv + '%');
      }
    });
  }

  function ensureErrorBox() {
    var card = productFormHeading() && productFormHeading().parentElement;
    if (!card) return null;
    var box = document.getElementById('posfin-router-validation-error');
    if (!box) {
      box = document.createElement('div');
      box.id = 'posfin-router-validation-error';
      box.setAttribute('role', 'alert');
      box.style.cssText = 'display:none;margin:0 0 16px;padding:12px 14px;border:1px solid #B23A48;background:rgba(178,58,72,.08);color:#7A1F2B;font-family:"DM Sans",Arial,sans-serif;font-size:13px;line-height:1.45';
      card.insertBefore(box, card.firstChild);
    }
    return box;
  }
  function showError(message, el) {
    var box = ensureErrorBox();
    if (box) { box.textContent = message; box.style.display = 'block'; }
    if (el) {
      var label = el.closest && el.closest('label');
      var target = label || el;
      target.style.outline = '2px solid #B23A48';
      target.style.outlineOffset = '2px';
      setTimeout(function(){ try { target.scrollIntoView({ block:'center', behavior:'smooth' }); } catch(e) {} }, 20);
    }
  }
  function clearError() {
    var box = document.getElementById('posfin-router-validation-error');
    if (box) { box.textContent = ''; box.style.display = 'none'; }
    Array.prototype.slice.call(document.querySelectorAll('label,input,textarea,select')).forEach(function(el){ el.style.outline=''; el.style.outlineOffset=''; });
  }
  function checkedValue(name) {
    var el = document.querySelector('input[name="'+CSS.escape(name)+'"]:checked');
    return el ? el.value : '';
  }
  function consentInput() {
    var boxes = Array.prototype.slice.call(document.querySelectorAll('input[type="checkbox"]'));
    return boxes.find(function(b){ return /agree|contacted|privacy|data/i.test(textOf(b.closest('label'))); }) || boxes[0] || null;
  }
  function validateStepTwo() {
    clearError();
    var checks = [
      ['first name', 'Please enter your first name.'],
      ['last name', 'Please enter your last name.'],
      ['mobile', 'Please enter your mobile number.'],
      ['email', 'Please enter your email address.']
    ];
    for (var i=0;i<checks.length;i++) {
      var el = byLabel(checks[i][0]);
      if (!el || !norm(el.value)) { showError(checks[i][1], el); return false; }
    }
    if (!checkedValue('loanPurpose')) { showError('Please confirm the purpose of the loan.', document.querySelector('input[name="loanPurpose"]')); return false; }
    if (!checkedValue('regulated')) { showError('Please confirm what the funds will primarily be used for.', document.querySelector('input[name="regulated"]')); return false; }
    if (!checkedValue('creditProfile')) { showError('Please select your credit profile.', document.querySelector('input[name="creditProfile"]')); return false; }
    var c = consentInput();
    if (!c || !c.checked) { showError('Please tick the consent box so we can contact you about this enquiry.', c); return false; }
    return true;
  }
  function fieldHtml(label, value, name) {
    return '<div class="mb-5"><label style="font-family:\"DM Sans\",Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#1C184F;margin-bottom:8px;display:block">'+label+'</label><input name="'+name+'" value="'+String(value||'').replace(/"/g,'&quot;')+'" style="width:100%;height:54px;padding:0 18px;font-family:\"DM Sans\",Arial,sans-serif;font-size:16px;color:#1A1A2E;background:#fff;border:1px solid #E5E1D6;border-radius:0;outline:none"/></div>';
  }
  function escapeHtml(v) {
    return String(v || '').replace(/[&<>\"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]); });
  }
  function textareaHtml(label, value, name, placeholder) {
    return '<div class="mb-5"><label style="font-family:\"DM Sans\",Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#1C184F;margin-bottom:8px;display:block">'+label+'</label><textarea name="'+name+'" placeholder="'+escapeHtml(placeholder||'')+'" style="width:100%;min-height:96px;padding:14px 18px;font-family:\"DM Sans\",Arial,sans-serif;font-size:16px;color:#1A1A2E;background:#fff;border:1px solid #E5E1D6;border-radius:0;outline:none">'+escapeHtml(value||'')+'</textarea></div>';
  }
  function selectHtml(label, name, options, selected) {
    return '<div class="mb-5"><label style="font-family:\"DM Sans\",Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#1C184F;margin-bottom:8px;display:block">'+label+'</label><select name="'+name+'" style="width:100%;height:54px;padding:0 18px;font-family:\"DM Sans\",Arial,sans-serif;font-size:16px;color:#1A1A2E;background:#fff;border:1px solid #E5E1D6;border-radius:0;outline:none">'+options.map(function(o){ return '<option value="'+escapeHtml(o[0])+'"'+(o[0]===selected?' selected':'')+'>'+escapeHtml(o[1])+'</option>'; }).join('')+'</select></div>';
  }
  function renderStepThree() {
    var card = productFormHeading() && productFormHeading().parentElement;
    if (!card) return;
    card.innerHTML = '<h3 class="text-2xl md:text-3xl" style="font-family:\"Playfair Display\",Georgia,serif;color:#1C184F;font-weight:600">Security property.</h3>'+ 
      '<div style="margin:0 0 16px;padding:12px 14px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055);color:#1C184F;font-size:13px">Step 3 of 4 — The property. Carried-through answers are pre-filled below. New property and redemption questions remain live.</div>'+ 
      fieldHtml('Security property address', V.propertyAddress, 'securityAddress')+
      fieldHtml('Security postcode', V.postcode, 'securityPostcode')+
      fieldHtml('Estimated property value', V.propertyValue ? '£' + Number(V.propertyValue).toLocaleString('en-GB') : '', 'propertyValue')+
      fieldHtml('First charge lender', V.firstChargeLender, 'firstChargeLender')+
      fieldHtml('First charge balance', V.firstChargeBalance ? '£' + Number(V.firstChargeBalance).toLocaleString('en-GB') : '', 'firstChargeBalance')+
      fieldHtml('Approximate arrears amount (£)', V.arrearsAmount ? '£' + Number(V.arrearsAmount).toLocaleString('en-GB') : '', 'firstChargeArrearsAmount')+
      selectHtml('Does the balance above include the arrears, or is it the clean balance?', 'firstChargeBalanceType', [['','Please select'],['clean_balance','Clean balance only — arrears separate'],['inclusive_balance','Balance includes arrears'],['unknown','Not sure']], '')+
      fieldHtml('Second charge / additional charge provider', V.secondChargeProvider, 'secondChargeProvider')+
      fieldHtml('Second charge / additional charge balance', V.secondChargeBalance ? '£' + Number(V.secondChargeBalance).toLocaleString('en-GB') : '', 'secondChargeBalance')+
      loanCalcSection('Mandatory redemptions at completion',
        '<div class="grid sm:grid-cols-2 gap-2">'+
        choiceHtml('redemptionStructure','add_to_facility','I need my requested amount on top of the redemptions', false)+
        choiceHtml('redemptionStructure','deduct_from_requested','Redemptions come from within my requested amount', false)+
        choiceHtml('redemptionStructure','discuss','Discuss on the call', false)+'</div>')+
      selectHtml('Tenure', 'tenure', [['','Please select'],['freehold','Freehold'],['leasehold','Leasehold'],['commonhold','Commonhold'],['unknown','Not sure']], '')+
      loanCalcSection('Property specification',
        '<div class="grid sm:grid-cols-2 gap-3">'+
        fieldHtml('Bedrooms', '', 'bedrooms')+
        fieldHtml('Bathrooms', '', 'bathrooms')+
        fieldHtml('Reception rooms', '', 'receptions')+
        fieldHtml('Parking', '', 'parking')+
        fieldHtml('Garden', '', 'garden')+
        fieldHtml('Approx. year built', '', 'yearBuilt')+
        fieldHtml('Floor area', '', 'floorArea')+
        selectHtml('Floor area unit', 'floorAreaUnit', [['sqft','sq ft'],['sqm','sq m']], 'sqft')+
        '</div>')+
      fieldHtml('Additional security / portfolio — how many additional properties can be offered?', '', 'additionalProperties')+
      textareaHtml('Property notes / condition / works', '', 'propertyNotes', 'E.g. vacant, tenanted, refurbishment needed, title issue, works completed.')+
      '<div class="mt-10 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4"><button type="button" data-posfin-next="step4" class="inline-flex items-center justify-center gap-3" style="background:#00B5B0;color:#fff;font-family:\"DM Sans\",Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;padding:18px 32px;min-height:60px;cursor:pointer;margin-left:auto">Loan requirements →</button></div>';
    rewriteSideStep('Step 3 of 4 — The property', 'The property');
    window.scrollTo(0, formTop().getBoundingClientRect().top + window.pageYOffset - 4);
  }
  function moneyInputValue(name, fallback) {
    var el = document.querySelector('[name="'+name+'"]');
    return money(el && el.value ? el.value : (EXTRA[name] || fallback));
  }
  function pounds(n) {
    var v = Number(n) || 0;
    return '£' + v.toLocaleString('en-GB');
  }
  function choiceHtml(name, value, label, checked) {
    return '<label class="flex items-center gap-3 cursor-pointer transition-colors" style="padding:12px 14px;border:1px solid #E5E1D6;background:#FFFFFF;font-family:\"DM Sans\",Arial,sans-serif;font-size:14px;color:#1A1A2E;min-height:50px"><input type="radio" class="sr-only" name="'+name+'" value="'+value+'"'+(checked?' checked':'')+'/><span class="flex-shrink-0 inline-flex items-center justify-center" style="width:18px;height:18px;border-radius:50%;border:2px solid #CFC9B8;background:#FFFFFF"></span>'+label+'</label>';
  }
  function loanCalcSection(title, body) {
    return '<div style="margin:0 0 18px;padding:14px 16px;border:1px solid #E5E1D6;background:#FFFFFF"><div style="font-family:\"DM Sans\",Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#1C184F;margin-bottom:10px">'+title+'</div>'+body+'</div>';
  }
  function updateFacilitySummary() {
    var base = Number(moneyInputValue('loanAmount', V.loanAmount)) || 0;
    var property = Number(moneyInputValue('propertyValue', V.propertyValue)) || 0;
    var first = Number(moneyInputValue('firstChargeBalance', V.firstChargeBalance)) || 0;
    var second = Number(moneyInputValue('secondChargeBalance', V.secondChargeBalance)) || 0;
    var arrears = Number(moneyInputValue('firstChargeArrearsAmount', V.arrearsAmount)) || 0;
    var redemptionStructure = checkedValue('redemptionStructure') || EXTRA.redemptionStructure || '';
    var legalChoice = checkedValue('legalCosts');
    var bufferChoice = checkedValue('bufferAmount');
    var addRedemptions = redemptionStructure === 'add_to_facility';
    var addedArrears = addRedemptions ? arrears : 0;
    var addedSecond = addRedemptions ? second : 0;
    var retainedSecond = redemptionStructure === 'deduct_from_requested' || addRedemptions ? 0 : second;
    var legals = legalChoice === 'add_2000' ? 2000 : 0;
    var buffer = bufferChoice ? Number(bufferChoice) || 0 : 0;
    var facility = base + addedArrears + addedSecond + legals + buffer;
    var totalDebt = first + retainedSecond + facility;
    var ltv = property ? Math.round((totalDebt / property) * 100) : '';
    var unconfirmed = [];
    if ((arrears || second) && !redemptionStructure) unconfirmed.push('redemption structure');
    if (!legalChoice) unconfirmed.push('legal buffer');
    if (!bufferChoice) unconfirmed.push('contingency buffer');
    var box = document.getElementById('posfin-facility-summary');
    if (!box) return;
    box.innerHTML = '<strong>Net LTV formula:</strong> ('+pounds(first)+' first charge + '+pounds(retainedSecond)+' retained second charge + '+pounds(facility)+' facility) ÷ '+pounds(property)+' = '+(ltv ? ltv+'%' : 'TBC')+'<br>'+
      '<span style="color:#5A5770;font-size:13px">Facility = base requested '+pounds(base)+' + redemptions added '+pounds(addedArrears + addedSecond)+' + legals '+pounds(legals)+' + buffer '+pounds(buffer)+'.</span>'+
      (unconfirmed.length ? '<br><span style="color:#B23A48;font-size:13px"><strong>Unconfirmed:</strong> '+unconfirmed.join(', ')+'. These must be answered before the figure is final.</span>' : '');
  }
  function renderStepFour() {
    Object.assign(EXTRA, collectFormValues());
    var card = productFormHeading() && productFormHeading().parentElement;
    if (!card) return;
    card.innerHTML = '<h3 class="text-2xl md:text-3xl" style="font-family:\"Playfair Display\",Georgia,serif;color:#1C184F;font-weight:600">Loan requirements.</h3>'+ 
      '<div style="margin:0 0 16px;padding:12px 14px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055);color:#1C184F;font-size:13px">Step 4 of 4 — Loan requirements. No hidden defaults are applied.</div>'+ 
      fieldHtml('Base loan amount requested', V.loanAmount ? pounds(V.loanAmount) : '', 'loanAmount')+
      selectHtml('Net loan requested or gross facility required?', 'netGrossRequest', [['','Please select'],['net','Net loan requested'],['gross','Gross facility required'],['unsure','Not sure — discuss on call']], '')+
      selectHtml('Preferred exit strategy', 'exitStrategy', [['','Please select'],['sell_property','Sell the property'],['refinance_mortgage','Refinance to mortgage'],['equity_release','Equity release'],['sell_other_asset','Sell another asset'],['business_income','Business income'],['ongoing_bridge','Ongoing bridging roll'],['other','Other / discuss']], '')+
      selectHtml('How soon do you need funds?', 'requiredTimescale', [['','Please select'],['within_2_weeks','Within 2 weeks'],['2_4_weeks','2–4 weeks'],['1_2_months','1–2 months'],['no_fixed_deadline','No fixed deadline']], '')+
      loanCalcSection('Costs and buffer',
        '<div class="grid sm:grid-cols-2 gap-2" style="margin-bottom:12px">'+
        choiceHtml('legalCosts','add_2000','Add £2,000 legal cost buffer', false)+
        choiceHtml('legalCosts','do_not_add','Do not add legal buffer', false)+'</div>'+
        '<div class="grid sm:grid-cols-3 gap-2">'+
        choiceHtml('bufferAmount','0','No contingency buffer', false)+
        choiceHtml('bufferAmount','5000','Add £5,000 contingency', false)+
        choiceHtml('bufferAmount','10000','Add £10,000 contingency', false)+'</div>')+
      textareaHtml('Anything else we should know?', '', 'borrowerNotes', 'Adverse credit, complex title, development history, deadlines, or anything else.')+
      '<div id="posfin-facility-summary" style="margin:0 0 16px;padding:14px 16px;border:1px solid #E5E1D6;background:#FAF8F3;color:#1C184F"></div>'+ 
      '<div style="margin:0 0 16px;padding:14px 16px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055);color:#1C184F;font-size:13px">Recommended solicitor route: <strong>LARK</strong>. We can also work with your own solicitor if preferred.</div>'+ 
      '<div class="mt-10 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4"><button type="button" data-posfin-next="submit" class="inline-flex items-center justify-center gap-3" style="background:#00B5B0;color:#fff;font-family:\"DM Sans\",Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;padding:18px 32px;min-height:60px;cursor:pointer;margin-left:auto">Submit enquiry →</button></div>';
    rewriteSideStep('Step 4 of 4 — Loan requirements', 'Loan requirements');
    Array.prototype.slice.call(card.querySelectorAll('input')).forEach(function(input){ paintOption(input, input.checked); });
    updateFacilitySummary();
    window.scrollTo(0, formTop().getBoundingClientRect().top + window.pageYOffset - 4);
  }
  function rewriteSideStep(stepText, subText) {
    Array.prototype.slice.call(document.querySelectorAll('div,span,p')).forEach(function(el){
      var t = textOf(el);
      if (/^Step\s+\d\s+of\s+\d/i.test(t)) el.textContent = stepText;
      if (t === 'About you' || t === 'The property' || t === 'Loan requirements') el.textContent = subText;
    });
  }
  function labelFooterWhatsapp() {
    Array.prototype.slice.call(document.querySelectorAll('a[href^="tel:+447446950389"]')).forEach(function(a){
      if (!/WhatsApp/i.test(textOf(a))) a.textContent = 'WhatsApp: +44 7446 950 389';
    });
  }

  function collectFormValues() {
    var out = {};
    Array.prototype.slice.call(document.querySelectorAll('input,select,textarea')).forEach(function(el){
      if (!el.name) return;
      if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; return; }
      if (el.type === 'checkbox') { out[el.name] = !!el.checked; return; }
      out[el.name] = el.value;
    });
    return Object.assign({}, EXTRA, out);
  }
  function calcScorecard(d) {
    var first = Number(money(d.firstChargeBalance || V.firstChargeBalance)) || 0;
    var second = Number(money(d.secondChargeBalance || V.secondChargeBalance)) || 0;
    var arrears = Number(money(d.firstChargeArrearsAmount || V.arrearsAmount)) || 0;
    var base = Number(money(d.loanAmount || V.loanAmount)) || 0;
    var property = Number(money(d.propertyValue || V.propertyValue)) || 0;
    var addRedemptions = d.redemptionStructure === 'add_to_facility';
    var deductRedemptions = d.redemptionStructure === 'deduct_from_requested';
    var addedArrears = addRedemptions ? arrears : 0;
    var addedSecond = addRedemptions ? second : 0;
    var legals = d.legalCosts === 'add_2000' ? 2000 : 0;
    var buffer = Number(d.bufferAmount) || 0;
    var additions = addedArrears + addedSecond + legals + buffer;
    var facility = base + additions;
    var retainedSecond = addRedemptions || deductRedemptions ? 0 : second;
    var netDayOne = deductRedemptions ? Math.max(0, base - arrears - second) : base;
    var totalDebt = first + retainedSecond + facility;
    var ltv = property ? Math.round((totalDebt / property) * 100) : '';
    return {first:first,second:second,arrears:arrears,base:base,property:property,addedArrears:addedArrears,addedSecond:addedSecond,legals:legals,buffer:buffer,additions:additions,facility:facility,retainedSecond:retainedSecond,netDayOne:netDayOne,ltv:ltv};
  }
  function renderSubmitted(payload) {
    var card = productFormHeading() && productFormHeading().parentElement;
    if (!card) return;
    var d = payload || collectFormValues();
    var c = calcScorecard(d);
    var ref = PARAMS.deal_ref || PARAMS.case_ref || ('POSFIN-' + Date.now().toString().slice(-6));
    card.innerHTML = '<div style="text-align:center;padding:18px 0 8px;border-bottom:3px solid #1C184F;margin-bottom:20px">'+
      '<div style="font-size:38px;margin-bottom:10px">✅</div>'+ 
      '<h3 class="text-2xl md:text-3xl" style="font-family:\"Playfair Display\",Georgia,serif;color:#1C184F;font-weight:600">Enquiry received.</h3>'+ 
      '<p style="color:#5A5770;font-size:14px;line-height:1.6;margin-top:8px">Reference '+escapeHtml(ref)+'. We will contact you on WhatsApp using the mobile number provided.</p></div>'+ 
      '<div style="display:grid;gap:14px;color:#1C184F;font-size:14px;line-height:1.6">'+
      '<div style="padding:14px;border:1px solid #E5E1D6;background:#FAF8F3"><strong>Your details</strong><br>'+escapeHtml(d.first_name||d.firstName||V.firstName)+' '+escapeHtml(d.last_name||d.lastName||V.lastName)+'<br>'+escapeHtml(d.mobile||V.mobile)+'<br>'+escapeHtml(d.email||V.email)+'</div>'+ 
      '<div style="padding:14px;border:1px solid #E5E1D6;background:#FAF8F3"><strong>The security property</strong><br>'+escapeHtml(d.securityAddress||V.propertyAddress)+', '+escapeHtml(d.securityPostcode||V.postcode)+'<br>Tenure: '+escapeHtml(d.tenure||'TBC')+'<br>Spec: '+escapeHtml(d.bedrooms||'TBC')+' bed / '+escapeHtml(d.bathrooms||'TBC')+' bath / '+escapeHtml(d.receptions||'TBC')+' reception · '+escapeHtml(d.floorArea||'TBC')+' '+escapeHtml(d.floorAreaUnit||'')+'</div>'+ 
      '<div style="padding:14px;border:1px solid #E5E1D6;background:#FAF8F3"><strong>Additions to loan</strong><br>Redeem 2nd charge: '+pounds(c.addedSecond)+'<br>Redeem arrears: '+pounds(c.addedArrears)+'<br>Legal buffer: '+pounds(c.legals)+'<br>Contingency: '+pounds(c.buffer)+'<br><strong>Total additions: '+pounds(c.additions)+'</strong></div>'+ 
      '<div style="padding:14px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055)"><strong>Your loan</strong><br>Net cash day one: '+pounds(c.netDayOne)+'<br>Additions: '+pounds(c.additions)+'<br>Total facility: '+pounds(c.facility)+'<br>Net or gross: '+escapeHtml(d.netGrossRequest||'TBC')+'<br>Purpose: '+escapeHtml(V.loanPurpose||PARAMS.loan_purpose||'TBC')+'<br>Exit: '+escapeHtml(d.exitStrategy||'TBC')+'<br>Timescale: '+escapeHtml(d.requiredTimescale||'TBC')+'<br>Credit profile: '+escapeHtml(d.creditProfile||'TBC')+'<br><strong>Net LTV: '+(c.ltv?c.ltv+'%':'TBC')+'</strong></div>'+ 
      '<div style="padding:14px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055)"><strong>Next step:</strong> WhatsApp dispatch line confirmed. No time-to-fund promise is made here.</div>'+ 
      '</div>';
    rewriteSideStep('Submitted', 'Submitted');
    window.scrollTo(0, formTop().getBoundingClientRect().top + window.pageYOffset - 4);
  }
  async function submitRouterLead(btn) {
    clearError();
    var original = btn && btn.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; btn.style.opacity = '.72'; }
    Object.assign(EXTRA, collectFormValues());
    var payload = collectFormValues();
    payload.product = PARAMS.route || 'main_loan';
    payload.source_url = window.location.href;
    payload.page_source = 'router-continuation';
    payload.case_ref = PARAMS.case_ref || '';
    payload.deal_ref = PARAMS.deal_ref || PARAMS.case_ref || '';
    payload.first_name = payload.firstName || V.firstName || PARAMS.first_name || '';
    payload.last_name = payload.lastName || V.lastName || PARAMS.last_name || '';
    payload.mobile = payload.mobile || V.mobile || PARAMS.mobile || PARAMS.phone || '';
    payload.email = payload.email || V.email || PARAMS.email || '';
    payload.submitted_at = new Date().toISOString();
    try {
      var res = await fetch('/api/lead', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Lead API failed: ' + res.status);
      renderSubmitted(payload);
    } catch (err) {
      console.warn('[router continuation] submit failed', err);
      showError('Something went wrong submitting the enquiry. Please try again, or WhatsApp Posfin on +44 7446 950 389.', btn);
      if (btn) { btn.disabled = false; btn.textContent = original || 'Submit enquiry →'; btn.style.opacity = '1'; }
    }
  }

  function tick() {
    promoteProductForm();
    hydrateVisibleFields();
    ensureCarriedBox();
    rewriteStepLabels();
    updateNetLtv();
    labelFooterWhatsapp();
  }
  document.addEventListener('click', function(ev){
    var a = ev.target && ev.target.closest && ev.target.closest('a');
    var label = ev.target && ev.target.closest && ev.target.closest('label');
    var input = label && label.querySelector('input[type="radio"],input[type="checkbox"]');
    if (input && !a) {
      ev.preventDefault();
      if (input.type === 'checkbox') setOption(input, !input.checked); else setOption(input, true);
      clearError();
    }
    var btn = ev.target && ev.target.closest && ev.target.closest('button');
    if (btn && /about the property/i.test(textOf(btn))) {
      ev.preventDefault();
      if (validateStepTwo()) renderStepThree();
      return;
    }
    if (btn && btn.getAttribute('data-posfin-next') === 'step4') { ev.preventDefault(); renderStepFour(); return; }
    if (btn && btn.getAttribute('data-posfin-next') === 'submit') { ev.preventDefault(); submitRouterLead(btn); return; }
    setTimeout(tick, 80);
  }, true);
  document.addEventListener('change', function(){ setTimeout(function(){ tick(); updateFacilitySummary(); }, 60); }, true);
  document.addEventListener('input', function(){ setTimeout(function(){ tick(); updateFacilitySummary(); }, 60); }, true);
  var obs = new MutationObserver(function(){ clearTimeout(obs._t); obs._t=setTimeout(tick, 60); });
  function start() {
    if (window.location.hash === '#apply') { try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e) {} }
    tick(); scrollToForm(true); setTimeout(tick, 120); setTimeout(function(){ scrollToForm(false); }, 180); setTimeout(tick, 650);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
