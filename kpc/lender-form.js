import {
  evaluateKpcTriage,
  calculateNhfPricing,
  buildDealPack,
  formatGBP,
  formatPct,
  DEFAULT_ASSUMPTIONS,
} from './lender-form-engine.js';
import { PRESETS } from './lender-form-presets.js';

let state = {};

const TEXT_FIELDS = [
  ['f-borrower', 'borrowerName'],
  ['f-director', 'directorName'],
  ['f-email', 'email'],
  ['f-mobile', 'mobile'],
  ['f-reference', 'reference'],
  ['f-adverse', 'adverseNotes'],
  ['f-debt-note', 'currentDebtNote'],
  ['f-loan-note', 'loanNote'],
  ['f-address', 'address'],
  ['f-postcode', 'postcode'],
  ['f-title', 'titleNumber'],
  ['f-holder', 'firstChargeHolder'],
  ['f-valuation-note', 'valuationNote'],
  ['f-purchase-note', 'purchaseNote'],
  ['f-charging-note', 'chargingOrdersNote'],
  ['f-restriction-note', 'restrictionsNote'],
  ['f-avm-provider', 'avmProvider'],
  ['f-exit-evidence', 'exitEvidence'],
  ['f-rail-note', 'settlementNote'],
];

const SELECT_FIELDS = [
  ['f-entity', 'entityType'],
  ['f-resident', 'ukResident'],
  ['f-charge', 'chargePosition'],
  ['f-tenure', 'tenure'],
  ['f-type', 'propertyType'],
  ['f-occupancy', 'occupancy'],
  ['f-consent', 'firstChargeConsent'],
  ['f-valuation', 'valuationBasis'],
  ['f-legal-route', 'legalRoute'],
  ['f-avm-confidence', 'avmConfidence'],
  ['f-exit', 'exitPrimary'],
  ['f-exit-fallback', 'exitFallback'],
  ['f-interest', 'interestStructure'],
];

const MONEY_FIELDS = [
  ['f-value', 'propertyValue', false],
  ['f-debt', 'currentDebt', false],
  ['f-net', 'netLoan', false],
  ['f-income', 'monthlyIncome', false],
  ['f-service', 'monthlyDebtService', false],
  ['f-buffer', 'cashBuffer', false],
  ['f-avm-value', 'avmValue', true],
];

function byId(id) {
  return document.getElementById(id);
}

function parseMoney(raw, nullable) {
  const text = String(raw ?? '').trim();
  if (!text) return nullable ? null : 0;
  const n = Number(text.replace(/[£,\s]/g, ''));
  if (!Number.isFinite(n)) return nullable ? null : 0;
  return Math.round(n);
}

function moneyText(value) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Math.round(n).toLocaleString('en-GB');
}

function percentText(rate) {
  return String(Math.round(Number(rate) * 10000) / 100);
}

function readPercent(id, fallback) {
  const n = Number(byId(id).value);
  return Number.isFinite(n) ? n / 100 : fallback;
}

function writeForm() {
  for (const [id, key] of TEXT_FIELDS) byId(id).value = state[key] || '';
  byId('f-income-note').value = state.incomeNote || state.servicingNote || '';
  for (const [id, key] of SELECT_FIELDS) {
    const el = byId(id);
    const value = state[key] || '';
    if ([...el.options].some((option) => option.value === value)) el.value = value;
  }
  for (const [id, key, nullable] of MONEY_FIELDS) {
    byId(id).value = nullable && (state[key] === null || state[key] === undefined) ? '' : moneyText(state[key] || 0);
  }
  byId('f-term').value = String(state.termMonths || '');
  byId('f-lease').value = state.leaseYears === null || state.leaseYears === undefined || state.leaseYears === '' ? '' : String(state.leaseYears);
  byId('f-exit-month').value = state.exitMonth ? String(state.exitMonth) : '';
  byId('f-avm-date').value = state.avmDate || '';
  byId('f-unregulated').checked = state.unregulatedConfirmed === true;
  byId('f-charging-flag').checked = state.hasInterimChargingOrder === true;
  byId('f-restriction-flag').checked = state.hasOtherRestriction === true;
  document.querySelectorAll('input[name="avmCompleted"]').forEach((el) => {
    el.checked = el.value === (state.avmCompleted === true ? 'yes' : 'no');
  });
  document.querySelectorAll('input[name="settlementRail"]').forEach((el) => {
    el.checked = el.value === (state.settlementRail || '');
  });
  const assumptions = state.assumptions || DEFAULT_ASSUMPTIONS;
  byId('f-arr').value = percentText(assumptions.arrangementPct);
  byId('f-rate').value = percentText(assumptions.monthlyRate);
  byId('f-default').value = percentText(assumptions.defaultRate);
  byId('f-post').value = percentText(assumptions.postTermRate);
  byId('f-ackroyds').value = String(assumptions.ackroyds);
  byId('f-title-ins').value = String(assumptions.titleInsurance);
}

function readForm() {
  for (const [id, key] of TEXT_FIELDS) state[key] = byId(id).value.trim();
  state.incomeNote = byId('f-income-note').value.trim();
  for (const [id, key] of SELECT_FIELDS) state[key] = byId(id).value;
  for (const [id, key, nullable] of MONEY_FIELDS) state[key] = parseMoney(byId(id).value, nullable);
  state.termMonths = Math.round(Number(byId('f-term').value)) || 0;
  const lease = byId('f-lease').value.trim();
  state.leaseYears = lease === '' ? null : Math.round(Number(lease));
  const exitMonth = byId('f-exit-month').value.trim();
  state.exitMonth = exitMonth === '' ? null : Math.round(Number(exitMonth));
  state.avmDate = byId('f-avm-date').value;
  state.unregulatedConfirmed = byId('f-unregulated').checked;
  state.hasInterimChargingOrder = byId('f-charging-flag').checked;
  state.hasOtherRestriction = byId('f-restriction-flag').checked;
  const avm = document.querySelector('input[name="avmCompleted"]:checked');
  state.avmCompleted = avm?.value === 'yes';
  const rail = document.querySelector('input[name="settlementRail"]:checked');
  state.settlementRail = rail?.value || '';
  state.assumptions = {
    arrangementPct: readPercent('f-arr', DEFAULT_ASSUMPTIONS.arrangementPct),
    monthlyRate: readPercent('f-rate', DEFAULT_ASSUMPTIONS.monthlyRate),
    defaultRate: readPercent('f-default', DEFAULT_ASSUMPTIONS.defaultRate),
    postTermRate: readPercent('f-post', DEFAULT_ASSUMPTIONS.postTermRate),
    ackroyds: parseMoney(byId('f-ackroyds').value, false),
    titleInsurance: parseMoney(byId('f-title-ins').value, false),
    brokerPct: state.assumptions?.brokerPct ?? DEFAULT_ASSUMPTIONS.brokerPct,
  };
}

function loadPreset(id) {
  const preset = PRESETS[id];
  if (!preset) return;
  state = {
    ...structuredClone(preset.input),
    presetId: preset.id,
    badge: preset.badge,
    profileKind: preset.profileKind,
    profileLabel: preset.profileLabel,
    edited: false,
  };
  writeForm();
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.preset === id ? 'true' : 'false');
  });
  render();
}

function markIdentityEdit(event) {
  if (event.target.closest('[data-keep-profile]')) return;
  if (state.profileKind === 'verified') {
    state.profileKind = 'custom';
    state.badge = 'CUSTOM INPUT — verified case was edited';
    state.profileLabel = 'Edited — do not treat as the Williamson source file';
    state.presetId = 'edited';
    document.querySelectorAll('[data-preset]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
  } else if (state.profileKind === 'synthetic') {
    state.edited = true;
    state.badge = 'SYNTHETIC TEST PROFILE · EDITED';
  }
}

function setGauge(prefix, pct, cap) {
  const fill = byId(`${prefix}-fill`);
  byId(`${prefix}-val`).textContent = formatPct(pct);
  const width = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  fill.style.width = `${width}%`;
  const bad = pct !== null && cap !== null && pct > cap;
  fill.classList.toggle('is-bad', bad);
}

function pillText(status) {
  if (status === 'HARD_DECLINE') return 'Fail';
  if (status === 'REFER') return 'Refer';
  if (status === 'LEGAL_REVIEW') return 'Legal review';
  if (status === 'BLOCKED_FOR_DRAWDOWN') return 'Blocked';
  if (status === 'HARD_BLOCK') return 'Hard block';
  return 'Pass';
}

function addRow(table, label, amount, memo = false) {
  const tr = document.createElement('tr');
  if (memo) tr.className = 'memo';
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = label;
  const td = document.createElement('td');
  td.textContent = formatGBP(amount);
  tr.append(th, td);
  table.append(tr);
}

function renderCase() {
  const host = byId('case-strip');
  host.replaceChildren();
  const chip = document.createElement('span');
  chip.className = `chip ${state.profileKind || 'custom'}`;
  chip.textContent = state.badge || 'CUSTOM INPUT';
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = state.borrowerName || 'Unnamed profile';
  const meta = document.createElement('p');
  meta.className = 'case-meta';
  meta.textContent = [state.profileLabel, state.reference, state.address, state.postcode, state.titleNumber].filter(Boolean).join(' · ');
  host.append(chip, who, meta);
  if (state.currentDebtNote) {
    const note = document.createElement('p');
    note.className = 'case-meta';
    note.textContent = state.currentDebtNote;
    host.append(note);
  }
}

function renderRules(triage) {
  const list = byId('rule-list');
  list.replaceChildren();
  for (const item of triage.rules) {
    const li = document.createElement('li');
    li.className = `rule rule-${item.status.toLowerCase()}`;
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = pillText(item.status);
    const body = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const message = document.createElement('p');
    message.textContent = item.detail ? `${item.message} ${item.detail}` : item.message;
    body.append(title, message);
    li.append(pill, body);
    list.append(li);
  }
}

function renderPricing(pricing) {
  const nhf = state.pricingModel !== 'kpc_workbook';
  byId('model-nhf').setAttribute('aria-pressed', nhf ? 'true' : 'false');
  byId('model-book').setAttribute('aria-pressed', nhf ? 'false' : 'true');
  byId('price-caption').textContent = nhf ? 'NHF total repayment' : 'Workbook total repayment';
  byId('price-total').textContent = formatGBP(pricing.totalRepayment);
  const scheduleNote = !nhf
    ? `compound ${percentText(pricing.assumptions.monthlyRate)}% pm`
    : pricing.extrapolated
      ? `extrapolated outside the £26k–£100k schedule (${formatGBP(pricing.nhf.totalAt3)} at 3 months)`
      : `pricing-guide lock at 3 months ${formatGBP(pricing.nhf.totalAt3)}`;
  byId('price-sub').textContent = `Net release ${formatGBP(pricing.netRelease)} · ${pricing.termMonths} months · ${scheduleNote}`;
  byId('cost-total').textContent = formatGBP(pricing.totalCostOfBorrowing);
  byId('cost-effective').textContent = formatPct(pricing.effectiveMonthlyCostPct, 2);
  byId('cost-simple').textContent = formatPct(pricing.simpleMonthlyCostPct, 2);
  byId('cost-legal').textContent = formatGBP(pricing.legalAndTitle);

  const strip = byId('term-strip');
  strip.replaceChildren();
  for (const row of pricing.comparison) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'strip-cell' + (row.selected ? ' is-selected' : '');
    button.dataset.term = String(row.termMonths);
    button.dataset.keepProfile = 'true';
    const label = document.createElement('b');
    label.textContent = `${row.termMonths} months${row.quickTurn ? ' · quick' : ''}${row.inMandate ? '' : ' · outside'}`;
    const amount = document.createElement('span');
    amount.textContent = formatGBP(row.totalRepayment);
    button.append(label, amount);
    strip.append(button);
  }

  const table = byId('price-rows');
  table.replaceChildren();
  const rows = nhf ? pricing.nhf.components : pricing.workbook.components;
  for (const row of rows) addRow(table, row.label, row.amount);
  addRow(table, 'Total repayment', pricing.totalRepayment);
  if (nhf) addRow(table, 'Legal budget memo (not added again)', pricing.legalBudget.total, true);
  else addRow(table, 'Internal broker memo (not in this gross)', pricing.workbook.brokerMemo, true);

  const stress = pricing.defaultStress;
  byId('stress-line').textContent = `Default stress ${percentText(stress.rate)}% pm on the contractual repayment: +3 months ${formatGBP(stress.plus3Months)}, +6 months ${formatGBP(stress.plus6Months)}. Post-term comparison ${percentText(stress.postTermRate)}% pm for +3 months ${formatGBP(stress.plus3MonthsAtPostTermRate)}.`;

  const extra = byId('extrapolation');
  if (pricing.extrapolated) {
    extra.hidden = false;
    extra.textContent = 'This net release is outside the published £26,000–£100,000 pricing-guide band. The 3-month formula is extrapolated and is not a schedule figure.';
  } else {
    extra.hidden = true;
    extra.textContent = '';
  }
}

function renderServicing(pricing) {
  const servicing = pricing.servicing;
  const cover = servicing.coverage === null
    ? 'No existing monthly debt service entered.'
    : `Existing-debt coverage ${servicing.coverage.toFixed(2)}×. Monthly gap ${formatGBP(servicing.gap)}.`;
  byId('servicing-note').textContent = servicing.note;
  byId('servicing-gap').textContent = `${cover} Illustrative 2.50% retained interest ${formatGBP(servicing.illustrativeMonthlyInterest)} a month. Cash buffer ${formatGBP(servicing.cashBuffer)}.`;
}

function settlementLabel(rail) {
  if (rail === 'faster_payments') return 'Faster Payments — allowed, same-day, typically seconds. BACS prohibited.';
  if (rail === 'chaps') return 'CHAPS — allowed, same-day, fee applies. BACS prohibited.';
  if (rail === 'bacs') return 'BACS — hard block. Unacceptable rail.';
  return 'Not selected. Faster Payments or CHAPS only. BACS prohibited.';
}

function renderReadback(triage, pricing) {
  const host = byId('readback-list');
  host.replaceChildren();
  const lines = [
    ['Banner', 'INTERNAL TEST PROFILE — NO EXTERNAL SENDS'],
    ['Profile', state.profileLabel || 'Custom'],
    ['Badge', state.badge || ''],
    ['Reference', state.reference || '—'],
    ['Borrower', state.borrowerName || '—'],
    ['Security', [state.address, state.postcode, state.titleNumber].filter(Boolean).join(', ') || '—'],
    ['Verdict', triage.label],
    ['Net release', formatGBP(pricing.netRelease)],
    ['Total repayment', formatGBP(pricing.totalRepayment)],
    ['Existing LTV', formatPct(triage.metrics.existingLtvPct)],
    ['Day-1 combined LTV', formatPct(triage.metrics.day1CombinedLtvPct)],
    ['Gross / exit LTV', formatPct(triage.metrics.grossCombinedLtvPct)],
    ['Equity cushion', `${formatGBP(triage.metrics.equityCushion)} (${formatPct(triage.metrics.equityCushionPct)})`],
    ['AVM', state.avmCompleted === true ? `Complete · ${state.avmProvider || 'provider not named'} · ${formatGBP(state.avmValue)}` : 'Not complete — blocked for drawdown'],
    ['Settlement rail', settlementLabel(state.settlementRail)],
    ['Sends', 'None. This read-back was built in the browser.'],
  ];
  for (const [term, value] of lines) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    host.append(dt, dd);
  }
}

function render() {
  const triage = evaluateKpcTriage(state);
  const pricing = calculateNhfPricing(state);
  document.body.dataset.verdict = triage.verdict;
  byId('page-badge').textContent = state.badge || 'CUSTOM INPUT';
  byId('verdict-label').textContent = triage.label;
  const failed = triage.rules.filter((item) => item.status !== 'PASS').map((item) => item.title);
  byId('verdict-detail').textContent = failed.length ? failed.join(' · ') : 'All hard stops, exit, title, settlement rail and the AVM gate are clear on this test profile.';
  byId('verdict-rail').textContent = settlementLabel(state.settlementRail);
  byId('verdict-kicker').textContent = state.reference ? `KPC triage · ${state.reference}` : 'KPC triage';
  byId('mobile-verdict').textContent = triage.label;
  byId('mobile-ltv').textContent = `Existing ${formatPct(triage.metrics.existingLtvPct)} · Day-1 ${formatPct(triage.metrics.day1CombinedLtvPct)}`;
  byId('mobile-total').textContent = formatGBP(pricing.totalRepayment);

  setGauge('g-existing', triage.metrics.existingLtvPct, 40);
  setGauge('g-new', triage.metrics.newLtvPct, 50);
  setGauge('g-day1', triage.metrics.day1CombinedLtvPct, 50);
  setGauge('g-gross', triage.metrics.grossCombinedLtvPct, 50);
  byId('equity-gbp').textContent = formatGBP(triage.metrics.equityCushion);
  byId('equity-pct').textContent = formatPct(triage.metrics.equityCushionPct);
  byId('debt-echo').textContent = state.currentDebtNote || '';

  document.querySelectorAll('#term-pills [data-term]').forEach((button) => {
    button.setAttribute('aria-pressed', Number(button.dataset.term) === Number(state.termMonths) ? 'true' : 'false');
  });

  renderCase();
  renderRules(triage);
  renderPricing(pricing);
  renderServicing(pricing);
  renderReadback(triage, pricing);
}

function currentPack() {
  const triage = evaluateKpcTriage(state);
  const pricing = calculateNhfPricing(state);
  const pack = buildDealPack(state, triage, pricing);
  pack.preparedAt = new Date().toISOString();
  return pack;
}

function toast(message) {
  byId('toast').textContent = message;
}

async function copyPack() {
  const text = JSON.stringify(currentPack(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied on this device. Nothing was sent.');
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    toast('Copied on this device. Nothing was sent.');
  }
}

function downloadPack() {
  const blob = new Blob([JSON.stringify(currentPack(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'kpc-internal-test-profile.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast('JSON file prepared in this browser. Nothing was sent.');
}

document.body.addEventListener('input', (event) => {
  if (!event.target.closest('#kpc-form') && !event.target.closest('#pricing-card')) return;
  readForm();
  markIdentityEdit(event);
  render();
});

byId('preset-bar').addEventListener('click', (event) => {
  const button = event.target.closest('[data-preset]');
  if (!button) return;
  loadPreset(button.dataset.preset);
});

byId('term-pills').addEventListener('click', (event) => {
  const button = event.target.closest('[data-term]');
  if (!button) return;
  state.termMonths = Number(button.dataset.term);
  byId('f-term').value = String(state.termMonths);
  render();
});

document.querySelector('.rail').addEventListener('click', (event) => {
  const model = event.target.closest('[data-model]');
  if (model) {
    state.pricingModel = model.dataset.model;
    render();
    return;
  }
  const term = event.target.closest('#term-strip [data-term]');
  if (!term) return;
  state.termMonths = Number(term.dataset.term);
  byId('f-term').value = String(state.termMonths);
  render();
});

byId('btn-copy').addEventListener('click', () => { copyPack(); });
byId('btn-download').addEventListener('click', downloadPack);
byId('btn-print').addEventListener('click', () => window.print());
byId('btn-readback').addEventListener('click', () => byId('readback').scrollIntoView({ behavior: 'smooth', block: 'start' }));

loadPreset('synthetic_50k_pass');
