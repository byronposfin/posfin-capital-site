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
      label.style.borderColor = active ? '#00B5B0' : '#E5E1D6';
      label.style.background = active ? 'rgba(0,181,176,0.06)' : '#FFFFFF';
      input.checked = !!active;
      input.style.accentColor = '#00B5B0';
      var box = Array.prototype.slice.call(label.querySelectorAll('span')).find(function(sp){
        var st = sp.getAttribute('style') || '';
        return /width:\s*18px|border.*CFC9B8|inline-flex/.test(st) && !/line-height|color:#6F6B7A/.test(st);
      });
      if (box) {
        box.style.borderColor = active ? '#00B5B0' : '#CFC9B8';
        box.style.background = active ? '#00B5B0' : '#FFFFFF';
        box.style.color = '#FFFFFF';
        box.style.fontSize = '12px';
        box.style.fontWeight = '800';
        box.textContent = active ? '✓' : '';
      }
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
  function paramAny(names) {
    for (var i = 0; i < names.length; i++) {
      var k = names[i];
      if (PARAMS[k] !== undefined && norm(PARAMS[k])) return PARAMS[k];
    }
    return '';
  }

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
      propertyValue: money(paramAny(['property_value','propertyValue','security_value','estimated_property_value','estimatedPropertyValue'])),
      firstChargeLender: paramAny(['first_charge_lender','firstChargeLender','first_charge_provider','firstChargeProvider','current_mortgage_lender','currentMortgageLender','mortgage_lender','mortgageLender','existing_lender','existingLender','first_lender','firstLender']),
      firstChargeBalance: money(paramAny(['first_charge_balance','firstChargeBalance','first_mortgage_balance','firstMortgageBalance','mortgage_balance','mortgageBalance','existing_mortgage_balance','existingMortgageBalance'])),
      secondCharges: yesNo(paramAny(['second_charges','secondCharges','has_second_charge','hasSecondCharge','additional_charges','additionalCharges'])),
      secondChargeProvider: paramAny(['second_charge_lender','secondChargeLender','second_charge_provider','secondChargeProvider','second_charge_holder','secondChargeHolder','restriction_holder','restrictionHolder','additional_charge_provider','additionalChargeProvider','secured_loan_lender','securedLoanLender','second_lender','secondLender']),
      secondChargeBalance: money(paramAny(['second_charge_balance','secondChargeBalance','second_mortgage_balance','secondMortgageBalance','additional_charge_balance','additionalChargeBalance','secured_loan_balance','securedLoanBalance','restriction_balance','restrictionBalance'])),
      arrears: yesNo(paramAny(['first_charge_arrears','firstChargeArrears','mortgage_arrears','mortgageArrears','arrears'])),
      arrearsAmount: money(paramAny(['first_charge_arrears_amount','firstChargeArrearsAmount','mortgage_arrears_amount','mortgageArrearsAmount','arrears_amount','arrearsAmount'])),
      loanAmount: money(paramAny(['loan_amount','loanAmount','requested_loan_amount','requestedLoanAmount'])),
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
  function widenConsentTouchTargets() {
    Array.prototype.slice.call(document.querySelectorAll('label')).forEach(function(label){
      var input = label.querySelector('input[type="checkbox"]');
      if (!input || !/agree|contacted|privacy|data/i.test(textOf(label))) return;
      label.setAttribute('data-posfin-consent-touch', '1');
      label.style.display = 'flex';
      label.style.alignItems = 'flex-start';
      label.style.gap = '12px';
      label.style.width = '100%';
      label.style.boxSizing = 'border-box';
      label.style.padding = '14px 16px';
      label.style.minHeight = '56px';
      label.style.border = '1px solid ' + (input.checked ? '#00B5B0' : '#E5E1D6');
      label.style.background = input.checked ? 'rgba(0,181,176,0.06)' : '#FFFFFF';
      label.style.cursor = 'pointer';
      label.style.webkitTapHighlightColor = 'transparent';
      paintOption(input, input.checked);
    });
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
  function isMoneyName(name) {
    return /amount|balance|value|loan|arrears|charge/i.test(String(name || '')) && !/years|yearBuilt|bedrooms|bathrooms|receptions|floorArea|additionalProperties/i.test(String(name || ''));
  }
  function formatMoneyDisplay(v) {
    var raw = money(v);
    if (!raw) return '';
    var parts = raw.split('.');
    var whole = parts[0] ? Number(parts[0]).toLocaleString('en-GB') : '0';
    return '£' + whole + (parts.length > 1 ? '.' + parts[1].slice(0,2) : '');
  }
  function fieldHtml(label, value, name) {
    var moneyField = isMoneyName(name);
    var safeVal = moneyField ? formatMoneyDisplay(value) : String(value || '');
    return '<div class="mb-5"><label style="font-family:\"DM Sans\",Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#1C184F;margin-bottom:8px;display:block">'+label+'</label><input name="'+name+'" value="'+safeVal.replace(/"/g,'&quot;')+'" '+(moneyField?'data-posfin-money="1" inputmode="numeric" autocomplete="off" ':'')+'style="width:100%;height:54px;padding:0 18px;font-family:\"DM Sans\",Arial,sans-serif;font-size:16px;color:#1A1A2E;background:#fff;border:1px solid #E5E1D6;border-radius:0;outline:none"/></div>';
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
  function carriedValueHtml(label, value, name, fallbackInput) {
    if (!norm(value)) return fallbackInput;
    return '<div class="mb-5"><div style="font-family:\"DM Sans\",Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#1C184F;margin-bottom:8px">'+escapeHtml(label)+'</div>'+ 
      '<div style="min-height:54px;padding:15px 18px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055);font-family:\"DM Sans\",Arial,sans-serif;font-size:16px;color:#1A1A2E">'+escapeHtml(value)+'</div>'+ 
      '<input type="hidden" name="'+escapeHtml(name)+'" value="'+escapeHtml(value)+'"></div>';
  }
  function smallNote(text) {
    return '<div style="font-size:12px;line-height:1.55;color:#6F6B7A;margin:-6px 0 12px">'+escapeHtml(text)+'</div>';
  }
  function greenSection(title, body, note) {
    return '<div style="margin:0 0 18px;padding:14px 16px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.045)">'+
      '<div style="font-family:\"DM Sans\",Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#008C88;margin-bottom:8px">'+escapeHtml(title)+'</div>'+
      (note ? '<div style="font-size:12px;line-height:1.55;color:#5A5770;margin-bottom:12px">'+escapeHtml(note)+'</div>' : '') + body + '</div>';
  }
  function cardChoiceHtml(name, value, label, sub, checked) {
    return '<label class="flex items-start gap-3 cursor-pointer transition-colors" style="padding:14px 16px;border:1px solid '+(checked?'#00B5B0':'#E5E1D6')+';background:'+(checked?'rgba(0,181,176,0.06)':'#FFFFFF')+';font-family:\"DM Sans\",Arial,sans-serif;font-size:14px;color:#1A1A2E;min-height:58px">'+
      '<input type="radio" class="sr-only" name="'+name+'" value="'+escapeHtml(value)+'"'+(checked?' checked':'')+'/>'+ 
      '<span class="flex-shrink-0 inline-flex items-center justify-center" style="width:18px;height:18px;border-radius:50%;border:2px solid '+(checked?'#00B5B0':'#CFC9B8')+';background:'+(checked?'#00B5B0':'#FFFFFF')+';margin-top:2px"></span>'+ 
      '<span><strong style="display:block;color:#1C184F;margin-bottom:2px">'+escapeHtml(label)+'</strong>'+(sub?'<span style="display:block;color:#6F6B7A;font-size:12px;line-height:1.45">'+escapeHtml(sub)+'</span>':'')+'</span></label>';
  }
  function mandatoryRedemptionsInner() {
    var second = Number(moneyInputValue('secondChargeBalance', V.secondChargeBalance)) || 0;
    var arrears = Number(moneyInputValue('firstChargeArrearsAmount', V.arrearsAmount)) || 0;
    var total = second + arrears;
    var selected = checkedValue('redemptionStructure') || EXTRA.redemptionStructure || '';
    var rows = '';
    if (arrears) rows += '<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0"><span>First-charge arrears to clear</span><strong>'+pounds(arrears)+'</strong></div>';
    if (second) rows += '<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0"><span>Second charge / restriction to clear</span><strong>'+pounds(second)+'</strong></div>';
    if (!rows) rows = '<div style="color:#6F6B7A;font-size:13px">No mandatory redemptions have been entered yet. If arrears or second charges are added, they will appear here automatically.</div>';
    return '<div style="font-size:13px;color:#1C184F;line-height:1.55">'+
      '<p style="margin:0 0 10px;color:#5A5770">These items normally need to be repaid on completion so the new lender has the required clean charge position.</p>'+rows+
      '<div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid rgba(28,24,79,.14);margin-top:6px;padding-top:8px"><strong>Total mandatory redemptions</strong><strong style="color:#D4A853">'+pounds(total)+'</strong></div>'+ 
      '<div style="margin-top:14px" class="grid sm:grid-cols-2 gap-2">'+
      cardChoiceHtml('redemptionStructure','add_to_facility','Add to requested loan amount','Example: £200k requested + £'+total.toLocaleString('en-GB')+' redemptions = £'+(200000+total).toLocaleString('en-GB')+' facility.', selected === 'add_to_facility')+
      cardChoiceHtml('redemptionStructure','deduct_from_requested','Deduct from requested amount','Example: £200k requested - £'+total.toLocaleString('en-GB')+' redemptions = £'+Math.max(0,200000-total).toLocaleString('en-GB')+' net to borrower.', selected === 'deduct_from_requested')+
      cardChoiceHtml('redemptionStructure','discuss','Not sure — discuss on call','We will structure this with you before lender submission.', selected === 'discuss')+
      '</div></div>';
  }
  function buildMandatoryRedemptionsCard() {
    return '<div id="posfin-mandatory-redemptions-wrap" style="margin:0 0 18px;padding:14px 16px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.045)">'+
      '<div style="font-family:\"DM Sans\",Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#008C88;margin-bottom:8px">Mandatory redemptions at completion</div>'+ 
      '<div style="font-size:12px;line-height:1.55;color:#5A5770;margin-bottom:12px">Second charges and mortgage arrears are not optional if the target lender requires a clean second/first charge position.</div>'+ 
      '<div id="posfin-mandatory-redemptions-live">'+mandatoryRedemptionsInner()+'</div></div>';
  }
  function updateMandatoryRedemptionsCard() {
    var box = document.getElementById('posfin-mandatory-redemptions-live');
    if (!box) return;
    var selected = checkedValue('redemptionStructure');
    if (selected) EXTRA.redemptionStructure = selected;
    box.innerHTML = mandatoryRedemptionsInner();
    Array.prototype.slice.call(box.querySelectorAll('input')).forEach(function(input){ paintOption(input, input.checked); });
  }
  function outstandingItems(d) {
    d = d || collectFormValues();
    var items = [];
    function miss(label, val) { if (!norm(val) || /^(unknown|not sure|discuss|unsure)$/i.test(norm(val))) items.push(label); }
    miss('Confirm whether first-charge balance is clean or includes arrears', d.firstChargeBalanceType);
    if ((Number(money(d.firstChargeArrearsAmount)) || 0) > 0) miss('Confirm redemption treatment for mortgage arrears', d.redemptionStructure);
    if ((Number(money(d.secondChargeBalance)) || 0) > 0) miss('Confirm redemption treatment for second charge / restriction', d.redemptionStructure);
    miss('Tenure', d.tenure);
    if (d.tenure === 'leasehold') miss('Lease years remaining', d.leaseYears);
    miss('Net or gross request', d.netGrossRequest);
    miss('Exit strategy', d.exitStrategy);
    miss('Funds timescale', d.requiredTimescale);
    if (!norm(d.propertyNotes)) items.push('Property condition / works / title notes if relevant');
    return Array.from(new Set(items));
  }
  function outstandingBox(d) {
    var items = outstandingItems(d);
    if (!items.length) return '<div style="margin:0 0 16px;padding:14px 16px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055);color:#1C184F;font-size:13px"><strong>Outstanding items:</strong> none flagged. Case is ready for LOR mapping subject to broker review.</div>';
    return '<div style="margin:0 0 16px;padding:14px 16px;border:1px solid rgba(212,168,83,.45);background:rgba(212,168,83,.08);color:#1C184F;font-size:13px"><strong>Outstanding items for follow-up / LOR mapping:</strong><ul style="margin:8px 0 0 18px;padding:0">'+items.map(function(i){return '<li>'+escapeHtml(i)+'</li>';}).join('')+'</ul></div>';
  }
  function renderStepThree() {
    var card = productFormHeading() && productFormHeading().parentElement;
    if (!card) return;
    card.innerHTML = '<h3 class="text-2xl md:text-3xl" style="font-family:\"Playfair Display\",Georgia,serif;color:#1C184F;font-weight:600">Security property.</h3>'+ 
      '<div style="margin:0 0 16px;padding:12px 14px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055);color:#1C184F;font-size:13px">Step 3 of 4 — The property. Carried-through answers are pre-filled below. New property and redemption questions remain live.</div>'+ 
      fieldHtml('Security property address', V.propertyAddress, 'securityAddress')+
      fieldHtml('Security postcode', V.postcode, 'securityPostcode')+
      fieldHtml('Estimated property value', V.propertyValue ? '£' + Number(V.propertyValue).toLocaleString('en-GB') : '', 'propertyValue')+
      greenSection('Charge stack',
        carriedValueHtml('First charge lender', V.firstChargeLender, 'firstChargeLender', fieldHtml('First charge lender', '', 'firstChargeLender'))+
        fieldHtml('First charge balance', V.firstChargeBalance ? '£' + Number(V.firstChargeBalance).toLocaleString('en-GB') : '', 'firstChargeBalance')+
        fieldHtml('Approximate arrears amount (£)', V.arrearsAmount ? '£' + Number(V.arrearsAmount).toLocaleString('en-GB') : '', 'firstChargeArrearsAmount')+
        selectHtml('Does the balance above include the arrears, or is it the clean balance?', 'firstChargeBalanceType', [['','Please select'],['clean_balance','Clean balance only — arrears separate'],['inclusive_balance','Balance includes arrears'],['unknown','Not sure']], '')+
        carriedValueHtml('Second charge / additional charge provider', V.secondChargeProvider, 'secondChargeProvider', fieldHtml('Second charge / additional charge provider', '', 'secondChargeProvider'))+
        fieldHtml('Second charge / additional charge balance', V.secondChargeBalance ? '£' + Number(V.secondChargeBalance).toLocaleString('en-GB') : '', 'secondChargeBalance'),
        'Capture arrears and second charges separately so mandatory redemptions can be calculated cleanly.')+
      buildMandatoryRedemptionsCard()+
      greenSection('Tenure', '<div class="grid sm:grid-cols-2 gap-2">'+
        cardChoiceHtml('tenure','freehold','Freehold','Most common — no lease term required.', false)+
        cardChoiceHtml('tenure','leasehold','Leasehold','We will need years remaining.', false)+
        cardChoiceHtml('tenure','commonhold','Commonhold','Less common — broker will review.', false)+
        cardChoiceHtml('tenure','unknown','Not sure','Flag for follow-up.', false)+
        '</div>'+fieldHtml('Lease years remaining (if leasehold)', '', 'leaseYears'), 'Tap the box — no typing unless leasehold years are known.')+
      greenSection('Property specification',
        '<div class="grid sm:grid-cols-2 gap-3">'+
        selectHtml('Bedrooms', 'bedrooms', [['','Select'],['studio','Studio'],['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],['6_plus','6+'],['unknown','Not sure']], '')+
        selectHtml('Bathrooms', 'bathrooms', [['','Select'],['1','1'],['2','2'],['3','3'],['4_plus','4+'],['unknown','Not sure']], '')+
        selectHtml('Reception rooms', 'receptions', [['','Select'],['0','0'],['1','1'],['2','2'],['3_plus','3+'],['unknown','Not sure']], '')+
        selectHtml('Parking', 'parking', [['','Select'],['none','None'],['street','On-street'],['drive_1','Driveway — 1 car'],['drive_2','Driveway — 2 cars'],['drive_3_plus','Driveway — 3+ cars'],['garage','Garage'],['garage_drive','Garage + driveway'],['unknown','Not sure']], '')+
        selectHtml('Garden', 'garden', [['','Select'],['none','No garden'],['front','Front garden only'],['rear','Rear garden only'],['front_rear','Front and rear garden'],['large','Large garden / land'],['communal','Communal garden'],['unknown','Not sure']], '')+
        selectHtml('Approx. year built', 'yearBuilt', [['','Select'],['pre_1900','Pre-1900'],['1900_1930','1900–1930'],['1930_1950','1930–1950'],['1950_1980','1950–1980'],['1980_2000','1980–2000'],['2000_2010','2000–2010'],['2010_2020','2010–2020'],['2020_plus','2020+'],['unknown','Not sure']], '')+
        fieldHtml('Floor area', '', 'floorArea')+
        selectHtml('Floor area unit', 'floorAreaUnit', [['sqft','sq ft'],['sqm','sq m'],['unknown','Not sure']], 'sqft')+
        '</div>', 'Dropdowns/tap boxes only where possible. Unknowns become follow-up items instead of blocking the borrower.')+
      greenSection('Additional security / portfolio',
        selectHtml('How many additional properties can be offered?', 'additionalProperties', [['0','0 — this property only'],['1','1 additional property'],['2','2 additional properties'],['3','3 additional properties'],['4','4 additional properties'],['5_plus','5+ / portfolio — send spreadsheet'],['unknown','Not sure']], '0')+
        textareaHtml('Additional security notes', '', 'additionalSecurityNotes', 'Address/value/charge details if known. If not known, we will request after the call.'),
        'If zero, select 0 and move on. If portfolio, we capture enough to trigger the right follow-up pack.')+
      textareaHtml('Property notes / condition / works', '', 'propertyNotes', 'E.g. vacant, tenanted, refurbishment needed, title issue, works completed.')+
      outstandingBox(collectFormValues())+
      '<div class="mt-10 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4"><button type="button" data-posfin-next="step4" class="inline-flex items-center justify-center gap-3" style="display:flex;width:100%;min-width:100%;background:#00B5B0;color:#fff;font-family:\"DM Sans\",Arial,sans-serif;font-size:16px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;padding:24px 30px;min-height:76px;border-radius:6px;border:0;cursor:pointer;margin:0;box-shadow:0 18px 36px -20px rgba(0,181,176,.9)">Continue to loan structure →</button></div>';
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
      outstandingBox(collectFormValues())+
      '<div class="mt-10 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4"><button type="button" data-posfin-next="submit" class="inline-flex items-center justify-center gap-3" style="display:flex;width:100%;min-width:100%;background:#00B5B0;color:#fff;font-family:\"DM Sans\",Arial,sans-serif;font-size:16px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;padding:24px 30px;min-height:76px;border-radius:6px;border:0;cursor:pointer;margin:0;box-shadow:0 18px 36px -20px rgba(0,181,176,.9)">Submit enquiry →</button></div>';
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
      outstandingBox(d)+
      '<div style="padding:14px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055)"><strong>Next step:</strong> WhatsApp/Email scorecard should carry the outstanding-items checklist into broker follow-up and LOR mapping. No time-to-fund promise is made here.</div>'+ 
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
    payload.outstanding_items = outstandingItems(payload).join(' | ');
    payload.lor_mapping_status = payload.outstanding_items ? 'Outstanding borrower follow-up required before broker portal / LOR finalisation' : 'Ready for broker portal / LOR mapping subject to broker review';
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

  function formatMoneyInputs(root) {
    Array.prototype.slice.call((root || document).querySelectorAll('input[data-posfin-money="1"]')).forEach(function(el){
      var formatted = formatMoneyDisplay(el.value);
      if (formatted && el.value !== formatted) el.value = formatted;
    });
  }

  function tick() {
    promoteProductForm();
    hydrateVisibleFields();
    ensureCarriedBox();
    rewriteStepLabels();
    updateNetLtv();
    labelFooterWhatsapp();
    widenConsentTouchTargets();
    formatMoneyInputs();
  }
  document.addEventListener('click', function(ev){
    var a = ev.target && ev.target.closest && ev.target.closest('a');
    var label = ev.target && ev.target.closest && ev.target.closest('label');
    var broadConsent = ev.target && ev.target.closest && ev.target.closest('[data-posfin-consent-touch]');
    if (!label && broadConsent) label = broadConsent;
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
  document.addEventListener('change', function(){ setTimeout(function(){ tick(); updateMandatoryRedemptionsCard(); updateFacilitySummary(); }, 60); }, true);
  document.addEventListener('input', function(ev){
    var target = ev.target;
    if (target && target.matches && target.matches('input[data-posfin-money="1"]')) {
      var formatted = formatMoneyDisplay(target.value);
      if (formatted && target.value !== formatted) target.value = formatted;
    }
    setTimeout(function(){ updateMandatoryRedemptionsCard(); tick(); updateFacilitySummary(); }, 60);
  }, true);
  var obs = new MutationObserver(function(){ clearTimeout(obs._t); obs._t=setTimeout(tick, 60); });
  function start() {
    if (window.location.hash === '#apply') { try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e) {} }
    tick(); scrollToForm(true); setTimeout(tick, 120); setTimeout(function(){ scrollToForm(false); }, 180); setTimeout(tick, 650);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
