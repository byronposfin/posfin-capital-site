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
    var dot = label && label.querySelector('span');
    if (!label) return;
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
      loanAmount: money(PARAMS.loan_amount),
      chargeRequested: PARAMS.charge_requested || ''
    };
  }
  var V = sourceValues();

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = 'html.posfin-router-continuation,body.posfin-router-continuation{scroll-behavior:auto!important}#'+BOX_ID+'{margin:0 0 18px;padding:14px 16px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055);font-family:"DM Sans",Arial,sans-serif;color:#1C184F;font-size:13px;line-height:1.45}#'+BOX_ID+' strong{color:#00B5B0}#'+BOX_ID+' ul{margin:8px 0 0 18px;padding:0;color:#5A5770}.posfin-router-promoted-form{scroll-margin-top:0!important;margin-top:0!important}.posfin-router-promoted-form>div{padding-top:14px!important;padding-bottom:38px!important}.posfin-router-promoted-form [class*="mb-14"],.posfin-router-promoted-form [class*="md:mb-20"]{margin-bottom:18px!important}@media(max-width:767px){.posfin-router-promoted-form{padding-top:0!important}.posfin-router-promoted-form>div{padding-top:10px!important}.posfin-router-promoted-form .grid{display:flex!important;flex-direction:column!important;gap:18px!important}.posfin-router-promoted-form .grid>div:nth-child(2){order:-1!important}.posfin-router-promoted-form [class*="md:col-span"]{min-width:0!important}.posfin-router-promoted-form [class*="space-y-6"]{margin-top:0!important}}';
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
  function tick() {
    promoteProductForm();
    hydrateVisibleFields();
    ensureCarriedBox();
    rewriteStepLabels();
    updateNetLtv();
  }
  document.addEventListener('click', function(ev){
    var input = ev.target && ev.target.closest && ev.target.closest('label input[type="radio"],label input[type="checkbox"]');
    if (input) setTimeout(function(){ setOption(input, input.checked); }, 0);
    setTimeout(tick, 80);
  }, true);
  document.addEventListener('change', function(){ setTimeout(tick, 60); }, true);
  document.addEventListener('input', function(){ setTimeout(tick, 60); }, true);
  var obs = new MutationObserver(function(){ clearTimeout(obs._t); obs._t=setTimeout(tick, 60); });
  function start() {
    if (window.location.hash === '#apply') { try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch(e) {} }
    tick(); scrollToForm(true); setTimeout(tick, 120); setTimeout(function(){ scrollToForm(false); }, 180); setTimeout(tick, 650);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
