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
  function clickOption(groupName, wanted) {
    if (!wanted) return false;
    var w = lower(wanted);
    var labels = Array.prototype.slice.call(document.querySelectorAll('label'));
    for (var i = 0; i < labels.length; i++) {
      var txt = lower(textOf(labels[i]));
      if (!txt) continue;
      var ok = txt === w || txt.includes(w) || w.includes(txt);
      if (!ok && w === 'yes' && (txt === 'yes' || txt.includes('yes —'))) ok = true;
      if (!ok && w === 'no' && (txt === 'no' || txt.includes('no arrears'))) ok = true;
      if (!ok) continue;
      var input = labels[i].querySelector('input[type="radio"], input[type="checkbox"]');
      if (input) {
        input.click();
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
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
    st.textContent = '#'+BOX_ID+'{margin:0 0 22px;padding:14px 16px;border:1px solid rgba(0,181,176,.28);background:rgba(0,181,176,.055);font-family:"DM Sans",Arial,sans-serif;color:#1C184F;font-size:13px;line-height:1.45}#'+BOX_ID+' strong{color:#00B5B0}#'+BOX_ID+' ul{margin:8px 0 0 18px;padding:0;color:#5A5770}';
    document.head.appendChild(st);
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
    var formCard = document.querySelector('section[id="apply"]') || document.querySelector('section[style*="FAF8F3"]');
    var mount = document.querySelector('h3') && Array.prototype.slice.call(document.querySelectorAll('h3')).find(function(h){ return /tell us|security property|loan requirements/i.test(textOf(h)); });
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
  }
  function formTop() {
    var headings = Array.prototype.slice.call(document.querySelectorAll('h2,h3,div'));
    var apply = headings.find(function(el){ return /apply now|tell us about the loan|security property|loan requirements/i.test(textOf(el)); });
    return apply ? (apply.closest('section') || apply) : document.querySelector('section[id="apply"]');
  }
  function scrollToForm() {
    var target = formTop();
    if (!target) return;
    var y = target.getBoundingClientRect().top + window.scrollY - 30;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
  function rewriteStepLabels() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function(n){
      var s = n.nodeValue;
      if (/Step\s+1\s+of\s+3/i.test(s)) n.nodeValue = s.replace(/Step\s+1\s+of\s+3(?:\s*·\s*60 seconds)?/i, 'Step 2 of 4 — About you');
      if (/Step\s+2\s+of\s+3/i.test(s)) n.nodeValue = s.replace(/Step\s+2\s+of\s+3/i, 'Step 3 of 4 — The property');
      if (/Step\s+3\s+of\s+3/i.test(s)) n.nodeValue = s.replace(/Step\s+3\s+of\s+3(?:\s*·\s*Almost there)?/i, 'Step 4 of 4 — Loan requirements');
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
    hydrateVisibleFields();
    ensureCarriedBox();
    rewriteStepLabels();
    updateNetLtv();
  }
  document.addEventListener('click', function(){ setTimeout(function(){ tick(); scrollToForm(); }, 80); }, true);
  document.addEventListener('change', function(){ setTimeout(tick, 60); }, true);
  document.addEventListener('input', function(){ setTimeout(tick, 60); }, true);
  var obs = new MutationObserver(function(){ clearTimeout(obs._t); obs._t=setTimeout(tick, 60); });
  function start() {
    tick(); setTimeout(tick, 400); setTimeout(scrollToForm, 450);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
