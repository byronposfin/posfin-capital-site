import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  nhfThreeMonthTotal,
  decomposeNhf,
  calculateNhfPricing,
  evaluateKpcTriage,
  compoundPounds,
  exceedsPct,
  buildDealPack,
  INTERNAL_BANNER,
} from '../kpc/lender-form-engine.js';
import { PRESETS, PRESET_ORDER } from '../kpc/lender-form-presets.js';

const SCHEDULE = [
  [26000, 33622],
  [30000, 38774],
  [40000, 51654],
  [50000, 64534],
  [75000, 96734],
  [100000, 128934],
];

function rule(result, id) {
  const found = result.rules.find((item) => item.id === id);
  assert.ok(found, `missing rule ${id}`);
  return found;
}

function eligible(overrides = {}) {
  return {
    ...structuredClone(PRESETS.synthetic_50k_pass.input),
    propertyValue: 1_000_000,
    currentDebt: 100_000,
    netLoan: 50_000,
    termMonths: 3,
    ...overrides,
  };
}

test('NHF 3-month totals match pricing-guide.html exactly', () => {
  for (const [net, total] of SCHEDULE) {
    assert.equal(nhfThreeMonthTotal(net), total);
    assert.equal(Math.round(1.288 * net + 134), total);
    const priced = calculateNhfPricing({ netLoan: net, termMonths: 3, propertyValue: 1_000_000, currentDebt: 0 });
    assert.equal(priced.nhf.totalRepayment, total);
    assert.equal(priced.totalRepayment, total);
    assert.equal(priced.nhf.reconciles, true);
    assert.equal(priced.nhf.componentSum, total);
  }
});

test('1.288 slope is the 12% broker and doubled 2.5% × 3 identity, not the step5b shortcut', () => {
  assert.equal(115 * 112, 12880);
  const step5b = (net) => Math.round(net * 1.195 + 1200);
  const kpcWith1200Legals = (net) => {
    const broker = net * 0.12;
    const legals = 1200;
    const interest = (net + broker + legals) * 0.025 * 3;
    const facility = interest - legals;
    return net + interest + facility + broker + legals;
  };
  for (const [net, total] of SCHEDULE) {
    assert.notEqual(step5b(net), total);
    assert.equal(kpcWith1200Legals(net), 1.288 * net + 180);
    assert.notEqual(Math.round(kpcWith1200Legals(net)), total);
  }
});

test('NHF components reconcile to the penny from 3 to 12 months', () => {
  for (const net of [26000, 33333, 50000, 100000]) {
    for (const term of [3, 6, 9, 12]) {
      const parts = decomposeNhf(net, term);
      const increment = Math.round(net * 0.025);
      assert.equal(parts.monthlyIncrement, increment);
      assert.equal(parts.totalRepayment, parts.totalAt3 + increment * (term - 3));
      assert.equal(parts.componentSum, parts.totalRepayment);
      assert.equal(parts.components.reduce((sum, row) => sum + row.amount, 0), parts.totalRepayment);
    }
  }
  const fifty = decomposeNhf(50000, 3);
  assert.equal(fifty.totalRepayment, 64534);
  assert.equal(fifty.broker, 6000);
  assert.equal(fifty.scheduleFixed, 893);
  assert.equal(fifty.interestAt3 - fifty.scheduleFixed, fifty.facility);
  const six = calculateNhfPricing({ netLoan: 50000, termMonths: 6 });
  assert.equal(six.nhf.totalRepayment, 64534 + 1250 * 3);
  const nine = calculateNhfPricing({ netLoan: 100000, termMonths: 9 });
  assert.equal(nine.nhf.totalRepayment, 128934 + 2500 * 6);
  const twelve = calculateNhfPricing({ netLoan: 100000, termMonths: 12 });
  assert.equal(twelve.nhf.totalRepayment, 128934 + 2500 * 9);
  const strip = twelve.comparison.map((row) => row.termMonths);
  assert.deepEqual(strip, [3, 6, 9, 12]);
});

test('KPC workbook compounds 2.50% and stresses 3.95% and 5.0%', () => {
  const priced = calculateNhfPricing({
    netLoan: 50000,
    termMonths: 3,
    pricingModel: 'kpc_workbook',
    propertyValue: 500000,
    currentDebt: 100000,
  });
  assert.equal(priced.workbook.arrangement, 1000);
  assert.equal(priced.workbook.legals, 1400);
  assert.equal(priced.workbook.opening, 52400);
  assert.equal(priced.workbook.brokerIncludedInGross, false);
  assert.equal(priced.workbook.brokerMemo, 6000);
  assert.equal(priced.workbook.totalRepayment, 56429);
  assert.equal(priced.totalRepayment, 56429);
  assert.equal(priced.workbook.componentSum, 56429);
  assert.equal(priced.workbook.defaultStress.plus3Months, 63383);
  assert.equal(priced.workbook.defaultStress.plus6Months, 71195);
  assert.equal(priced.workbook.defaultStress.plus3MonthsAtPostTermRate, 65324);
  assert.equal(compoundPounds(52400, 0.025, 6), 60768);
  assert.equal(compoundPounds(52400, 0.025, 9), 65440);
  assert.equal(compoundPounds(52400, 0.025, 12), 70472);
  const nhf = calculateNhfPricing({ netLoan: 50000, termMonths: 3 });
  assert.equal(nhf.nhf.defaultStress.plus3Months, 72487);
  assert.equal(nhf.nhf.defaultStress.plus6Months, 81421);
  assert.equal(nhf.legalBudget.total, 1400);
  assert.equal(nhf.legalBudget.upfrontCash, 0);
  assert.equal(nhf.nhf.components.some((row) => row.key === 'ackroyds'), false);
});

test('LTV boundaries use a strict greater-than', () => {
  assert.equal(exceedsPct(200000, 500000, 40), false);
  assert.equal(exceedsPct(200050, 500000, 40), true);
  assert.equal(exceedsPct(100000, 200000, 50), false);
  assert.equal(exceedsPct(100020, 200000, 50), true);

  const at40 = evaluateKpcTriage(eligible({
    propertyValue: 1_000_000,
    currentDebt: 400_000,
    netLoan: 50_000,
  }));
  assert.equal(rule(at40, 'existing_ltv').status, 'PASS');
  assert.equal(at40.metrics.existingLtvPct, 40);
  assert.ok(at40.metrics.grossCombinedLtvPct < 50);
  assert.equal(at40.verdict, 'PASS');

  const over40 = evaluateKpcTriage(eligible({
    propertyValue: 1_000_000,
    currentDebt: 400_100,
    netLoan: 50_000,
  }));
  assert.equal(rule(over40, 'existing_ltv').status, 'HARD_DECLINE');
  assert.match(rule(over40, 'existing_ltv').message, /40% LTV hard stop/);
  assert.equal(rule(over40, 'combined_ltv').status, 'PASS');
  assert.equal(over40.verdict, 'HARD_DECLINE');

  const at50 = evaluateKpcTriage(eligible({
    propertyValue: 200_000,
    currentDebt: 40_000,
    netLoan: 60_000,
    grossLoan: 60_000,
  }));
  assert.equal(rule(at50, 'combined_ltv').status, 'PASS');
  assert.equal(at50.metrics.day1CombinedLtvPct, 50);
  assert.equal(at50.metrics.grossCombinedLtvPct, 50);
  assert.match(rule(at50, 'combined_ltv').detail, /Day-1/);
  assert.match(rule(at50, 'combined_ltv').detail, /Gross\/Exit/);

  const dayJustOver = evaluateKpcTriage(eligible({
    propertyValue: 200_000,
    currentDebt: 40_000,
    netLoan: 60_020,
    grossLoan: 60_000,
  }));
  assert.equal(rule(dayJustOver, 'combined_ltv').status, 'HARD_DECLINE');
  assert.ok(dayJustOver.metrics.day1CombinedLtvPct > 50);
  assert.equal(dayJustOver.metrics.grossCombinedLtvPct, 50);
  assert.match(rule(dayJustOver, 'combined_ltv').message, /50% LTV hard cap/);

  const grossJustOver = evaluateKpcTriage(eligible({
    propertyValue: 200_000,
    currentDebt: 40_000,
    netLoan: 60_000,
    grossLoan: 60_020,
  }));
  assert.equal(rule(grossJustOver, 'combined_ltv').status, 'HARD_DECLINE');
  assert.equal(grossJustOver.metrics.day1CombinedLtvPct, 50);
  assert.ok(grossJustOver.metrics.grossCombinedLtvPct > 50);
});

test('loan size boundaries and sweet spot', () => {
  const expectSize = (net, status, sweet) => {
    const result = evaluateKpcTriage(eligible({ netLoan: net }));
    assert.equal(rule(result, 'loan_size').status, status, String(net));
    assert.equal(result.metrics.sweetSpot, sweet, String(net));
  };
  expectSize(25999, 'HARD_DECLINE', false);
  expectSize(26000, 'PASS', false);
  expectSize(39999, 'PASS', false);
  expectSize(40000, 'PASS', true);
  expectSize(50000, 'PASS', true);
  expectSize(65000, 'PASS', true);
  expectSize(65001, 'PASS', false);
  expectSize(100000, 'PASS', false);
  expectSize(100001, 'HARD_DECLINE', false);
  assert.match(rule(evaluateKpcTriage(eligible({ netLoan: 50000 })), 'loan_size').detail, /Sweet Spot/);
  assert.match(rule(evaluateKpcTriage(eligible({ netLoan: 25999 })), 'loan_size').message, /£26,000–£100,000/);
});

test('occupancy and unregulated declaration', () => {
  const owner = evaluateKpcTriage(eligible({ occupancy: 'owner_occupied', unregulatedConfirmed: true }));
  assert.equal(rule(owner, 'unregulated').status, 'HARD_DECLINE');
  assert.match(rule(owner, 'unregulated').message, /regulated panel/);

  const unticked = evaluateKpcTriage(eligible({ occupancy: 'tenanted_investment', unregulatedConfirmed: false }));
  assert.equal(rule(unticked, 'unregulated').status, 'HARD_DECLINE');

  const vacant = evaluateKpcTriage(eligible({ occupancy: 'vacant_investment', unregulatedConfirmed: true }));
  assert.equal(rule(vacant, 'unregulated').status, 'PASS');
  assert.equal(vacant.verdict, 'PASS');
});

test('term is 3–12 pass, and 2 or 13 hard-decline', () => {
  for (const term of [3, 6, 7, 9, 12]) {
    const result = evaluateKpcTriage(eligible({ termMonths: term }));
    assert.equal(rule(result, 'term').status, 'PASS', String(term));
    assert.equal(result.verdict, 'PASS', String(term));
    assert.doesNotMatch(rule(result, 'term').message, /3–6|3-6/);
  }
  assert.match(rule(evaluateKpcTriage(eligible({ termMonths: 3 })), 'term').detail, /quick-turn/);
  for (const term of [2, 13, 0, 18]) {
    const result = evaluateKpcTriage(eligible({ termMonths: term }));
    assert.equal(rule(result, 'term').status, 'HARD_DECLINE', String(term));
    assert.equal(result.verdict, 'HARD_DECLINE', String(term));
  }
});

test('exit refer and title legal review do not invent a hard decline', () => {
  const unclear = evaluateKpcTriage(eligible({ exitPrimary: '', exitEvidence: '' }));
  assert.equal(rule(unclear, 'exit').status, 'REFER');
  assert.equal(unclear.verdict, 'REFER');

  const legal = evaluateKpcTriage(eligible({
    hasInterimChargingOrder: true,
    chargingOrdersNote: 'Synthetic charging order — balance deliberately not stated.',
  }));
  assert.equal(rule(legal, 'title').status, 'LEGAL_REVIEW');
  assert.equal(legal.verdict, 'REFER');
  assert.match(rule(legal, 'title').message, /Ackroyds|do not override|Legal review/);

  const leaseOk = evaluateKpcTriage(eligible({ tenure: 'leasehold', leaseYears: 70 }));
  assert.equal(rule(leaseOk, 'title').status, 'PASS');
  const leaseShort = evaluateKpcTriage(eligible({ tenure: 'leasehold', leaseYears: 69 }));
  assert.equal(rule(leaseShort, 'title').status, 'LEGAL_REVIEW');
  assert.match(rule(leaseShort, 'title').detail, /69 years/);
});

test('missing AVM blocks an otherwise passing ultra-low-LTV deal', () => {
  const blocked = evaluateKpcTriage(eligible({ avmCompleted: false }));
  assert.equal(blocked.verdict, 'BLOCKED_FOR_DRAWDOWN');
  assert.equal(blocked.label, 'BLOCKED FOR DRAWDOWN');
  assert.equal(rule(blocked, 'avm').status, 'BLOCKED_FOR_DRAWDOWN');
  assert.equal(rule(blocked, 'avm').message, 'Hard Gate: AVM must be completed and verified before drawdown');
  for (const id of ['existing_ltv', 'combined_ltv', 'unregulated', 'loan_size', 'term', 'exit', 'title']) {
    assert.equal(rule(blocked, id).status, 'PASS', id);
  }
  for (const fake of ['true', 'yes', 1, 'TRUE']) {
    const still = evaluateKpcTriage(eligible({ avmCompleted: fake }));
    assert.equal(still.verdict, 'BLOCKED_FOR_DRAWDOWN', String(fake));
  }
  const open = evaluateKpcTriage(eligible({ avmCompleted: true }));
  assert.equal(open.verdict, 'PASS');
  assert.equal(open.label, 'PASS — ELIGIBLE FOR KPC');
});

test('synthetic £50k preset passes inside the sweet spot', () => {
  const preset = PRESETS.synthetic_50k_pass;
  assert.equal(preset.badge, 'SYNTHETIC TEST PROFILE');
  assert.equal(preset.input.avmCompleted, true);
  assert.equal(preset.input.termMonths, 3);
  const result = evaluateKpcTriage(preset.input);
  assert.equal(result.verdict, 'PASS');
  assert.equal(result.label, 'PASS — ELIGIBLE FOR KPC');
  assert.equal(result.metrics.sweetSpot, true);
  assert.equal(result.metrics.existingLtvPct, 20);
  assert.equal(result.metrics.day1CombinedLtvPct, 30);
  assert.ok(Math.abs(result.metrics.grossCombinedLtvPct - 32.9) < 0.05);
  assert.equal(result.metrics.pricedGross, 64534);
  const pricing = calculateNhfPricing(preset.input);
  assert.equal(pricing.totalRepayment, 64534);
  assert.equal(pricing.comparison.find((row) => row.termMonths === 6).nhfTotal, 64534 + 3750);
});

test('Williamson hard-declines on the four mandate stops; 12 months itself passes', () => {
  const preset = PRESETS.williamson_hard_decline;
  assert.equal(preset.badge, 'VERIFIED CASE — HARD DECLINE ON KPC');
  assert.equal(preset.input.reference, 'POSFIN-WEB-EYCTQ6');
  assert.equal(preset.input.borrowerName, 'Christopher Nicholas Williamson');
  assert.equal(preset.input.address, '204 Cooden Drive, Bexhill-on-Sea, East Sussex');
  assert.equal(preset.input.postcode, 'TN39 3AH');
  assert.equal(preset.input.titleNumber, 'ESX86205');
  assert.match(preset.input.currentDebtNote, /exact redemption figure TBC/);
  assert.match(preset.input.currentDebtNote, /< £400,000/);
  assert.match(preset.input.chargingOrdersNote, /0JU75100/);
  assert.match(preset.input.chargingOrdersNote, /A00HS078/);
  assert.match(preset.input.chargingOrdersNote, /balances TBC/);
  assert.doesNotMatch(preset.input.chargingOrdersNote, /£\s*\d/);
  assert.equal(preset.input.avmCompleted, false);
  assert.equal(preset.input.avmValue, null);
  assert.equal(preset.input.termMonths, 12);
  assert.equal(preset.input.netLoan, 455000);
  assert.equal(preset.input.currentDebt, 395000);
  assert.equal(preset.input.propertyValue, 700000);

  const result = evaluateKpcTriage(preset.input);
  assert.equal(result.verdict, 'HARD_DECLINE');
  const hard = result.rules.filter((item) => item.status === 'HARD_DECLINE').map((item) => item.id).sort();
  assert.deepEqual(hard, ['combined_ltv', 'existing_ltv', 'loan_size', 'unregulated']);
  assert.equal(rule(result, 'term').status, 'PASS');
  assert.match(rule(result, 'term').detail, /12 months/);
  assert.equal(rule(result, 'avm').status, 'BLOCKED_FOR_DRAWDOWN');
  assert.equal(rule(result, 'title').status, 'LEGAL_REVIEW');
  assert.ok(result.metrics.existingLtvPct > 56 && result.metrics.existingLtvPct < 57);
  assert.ok(result.metrics.day1CombinedLtvPct > 50);
  assert.ok(result.metrics.grossCombinedLtvPct > 50);
  assert.match(rule(result, 'combined_ltv').detail, /Day-1/);
  assert.match(rule(result, 'combined_ltv').detail, /Gross\/Exit/);
});

test('£26k floor passes at 6 and 12 months; the 41% trap fails only on existing debt', () => {
  const floor = PRESETS.synthetic_26k_floor;
  assert.equal(floor.input.avmCompleted, true);
  assert.equal(floor.input.netLoan, 26000);
  assert.equal(floor.input.termMonths, 6);
  const at6 = evaluateKpcTriage(floor.input);
  assert.equal(at6.verdict, 'PASS');
  assert.ok(Math.abs(at6.metrics.day1CombinedLtvPct - 40.4) < 0.05);
  assert.ok(at6.metrics.grossCombinedLtvPct < 50);
  const at12 = evaluateKpcTriage({ ...floor.input, termMonths: 12 });
  assert.equal(at12.verdict, 'PASS');
  assert.equal(rule(at12, 'term').status, 'PASS');
  assert.ok(at12.metrics.grossCombinedLtvPct < 50);

  const trap = PRESETS.synthetic_41pct_trap.input;
  const result = evaluateKpcTriage(trap);
  assert.equal(result.verdict, 'HARD_DECLINE');
  assert.equal(result.metrics.existingLtvPct, 41);
  assert.equal(result.metrics.day1CombinedLtvPct, 47.5);
  assert.ok(result.metrics.grossCombinedLtvPct < 50);
  assert.equal(rule(result, 'existing_ltv').status, 'HARD_DECLINE');
  for (const id of ['combined_ltv', 'unregulated', 'loan_size', 'term', 'exit', 'title', 'avm', 'settlement']) {
    assert.equal(rule(result, id).status, 'PASS', id);
  }
});

test('settlement rails allow Faster Payments and CHAPS, and BACS is a hard block', () => {
  const faster = evaluateKpcTriage(eligible({ settlementRail: 'faster_payments' }));
  assert.equal(faster.verdict, 'PASS');
  assert.equal(rule(faster, 'settlement').status, 'PASS');
  assert.match(rule(faster, 'settlement').message, /Faster Payments/);

  const chaps = evaluateKpcTriage(eligible({ settlementRail: 'chaps' }));
  assert.equal(chaps.verdict, 'PASS');
  assert.equal(rule(chaps, 'settlement').status, 'PASS');
  assert.match(rule(chaps, 'settlement').detail, /fee applies/);

  const bacs = evaluateKpcTriage(eligible({ settlementRail: 'bacs' }));
  assert.equal(bacs.verdict, 'HARD_BLOCK');
  assert.equal(bacs.label, 'HARD BLOCK');
  assert.equal(rule(bacs, 'settlement').status, 'HARD_BLOCK');
  assert.match(rule(bacs, 'settlement').message, /BACS is prohibited/);
  assert.match(rule(bacs, 'settlement').message, /Faster Payments and CHAPS only/);
  for (const id of ['existing_ltv', 'combined_ltv', 'unregulated', 'loan_size', 'term', 'avm']) {
    assert.equal(rule(bacs, id).status, 'PASS', id);
  }

  const unset = evaluateKpcTriage(eligible({ settlementRail: '' }));
  assert.equal(unset.verdict, 'HARD_BLOCK');
  assert.match(rule(unset, 'settlement').message, /BACS is prohibited/);

  const declined = evaluateKpcTriage(eligible({ settlementRail: 'bacs', occupancy: 'owner_occupied' }));
  assert.equal(declined.verdict, 'HARD_DECLINE');
  assert.equal(rule(declined, 'settlement').status, 'HARD_BLOCK');

  assert.equal(PRESETS.synthetic_50k_pass.input.settlementRail, 'faster_payments');
  assert.equal(rule(evaluateKpcTriage(PRESETS.synthetic_50k_pass.input), 'settlement').status, 'PASS');
  assert.equal(PRESETS.williamson_hard_decline.input.settlementRail, '');
  assert.match(PRESETS.williamson_hard_decline.input.settlementNote, /Not invented/);
  assert.equal(rule(evaluateKpcTriage(PRESETS.williamson_hard_decline.input), 'settlement').status, 'HARD_BLOCK');
});

test('deal pack is local and the page has no external send and noindex', () => {
  const input = {
    ...PRESETS.synthetic_50k_pass.input,
    presetId: 'synthetic_50k_pass',
    badge: PRESETS.synthetic_50k_pass.badge,
    profileKind: 'synthetic',
    profileLabel: PRESETS.synthetic_50k_pass.profileLabel,
  };
  const triage = evaluateKpcTriage(input);
  const pricing = calculateNhfPricing(input);
  const pack = buildDealPack(input, triage, pricing);
  assert.equal(pack.banner, INTERNAL_BANNER);
  assert.equal(pack.externalSends, false);
  assert.equal(pack.pricing.totalRepayment, 64534);
  assert.equal(JSON.stringify(pack).includes('http'), false);

  const root = new URL('../', import.meta.url);
  const files = [
    'kpc/lender-form.html',
    'kpc/lender-form.js',
    'kpc/lender-form-engine.js',
    'kpc/lender-form-presets.js',
    'kpc/lender-form.css',
  ];
  for (const file of files) {
    const src = fs.readFileSync(new URL(file, root), 'utf8');
    assert.doesNotMatch(src, /fetch\s*\(/);
    assert.doesNotMatch(src, /XMLHttpRequest/);
    assert.doesNotMatch(src, /sendBeacon/);
    assert.doesNotMatch(src, /mailto:/i);
    assert.doesNotMatch(src, /wa\.me/);
    assert.doesNotMatch(src, /supabase/i);
    assert.doesNotMatch(src, /method\s*=\s*["']post["']/i);
  }
  const html = fs.readFileSync(new URL('kpc/lender-form.html', root), 'utf8');
  assert.match(html, /noindex,\s*nofollow/);
  assert.match(html, /INTERNAL TEST PROFILE — NO EXTERNAL SENDS/);
  assert.match(html, /913022/);
  assert.match(html, /12148846/);
  assert.match(html, /16988655/);
  assert.match(html, /authorised credit broker and not a lender/i);
  assert.doesNotMatch(html, /id="f-grossLoan"|name="grossLoan"/);
  assert.equal(PRESET_ORDER.length, 4);
});
