/**
 * KPC lender-form engine — internal test profile only.
 *
 * No network, no storage, no side effects. Pure functions.
 *
 * NHF Speed Loan headline (pricing-guide.html, £26,000–£100,000, 3 months):
 *   total(3) = round(1.288 × net + 134)
 *
 * Slope identity, from engine/calculator.js kpcCalc at a 3-month term:
 *   broker      = 12% × net
 *   subTotal    = net + broker + fixedPlug
 *   interest    = subTotal × 2.50% × 3
 *   facilityFee = interest − fixedPlug
 *   gross       = net + interest + facilityFee + broker + fixedPlug
 *               = net × 1.12 × 1.15 + 0.15 × fixedPlug
 *               = 1.288 × net + 0.15 × fixedPlug
 *   0.15 × fixedPlug = 134  ⇒  fixedPlug = 134 / 0.15 = £893.33…
 *   Rounded lines use a £893 plug. The facility-fee line absorbs any
 *   leftover pound so the displayed lines equal the published total.
 *
 * That is not the step5b-backtoback.html shortcut
 * (net × 1.195 + £1,200 = 12% + 7.5% + £1,200), and it is not kpcCalc
 * with Ackroyds at £1,200 (that constant is £180, i.e. 0.15 × 1,200).
 * The £1,200 + £200 borrower legal budget is zero upfront cash. It is
 * the KPC workbook assumption and is not added again on top of the
 * published 3-month schedule.
 *
 * Months after month 3 add retained interest of 2.50% × net release,
 * once, rounded to the nearest pound per month. Broker, facility fee
 * and the schedule plug stay at their 3-month calibration.
 *
 * KPC workbook (comparison model):
 *   opening = net + arrangement (default 2% of net) + £1,200 + £200
 *   total(m) = round(opening × (1.025)^m)
 *   Default stress compounds 3.95% pm for +3 and +6 months on that total.
 *   A 5.0% pm post-term comparison is included. The 12% internal broker
 *   fee is a memo only — it is already inside the NHF 1.288 slope.
 */

export const INTERNAL_BANNER = 'INTERNAL TEST PROFILE — NO EXTERNAL SENDS';

export const DEFAULT_ASSUMPTIONS = Object.freeze({
  arrangementPct: 0.02,
  monthlyRate: 0.025,
  defaultRate: 0.0395,
  postTermRate: 0.05,
  ackroyds: 1200,
  titleInsurance: 200,
  brokerPct: 0.12,
});

export const NHF_LOCKED_MONTHLY_RATE = 0.025;
export const NHF_INTERCEPT = 134;
export const NHF_SCHEDULE_FIXED_PLUG = 893;
export const MANDATE = Object.freeze({
  minNet: 26000,
  maxNet: 100000,
  sweetMin: 40000,
  sweetMax: 65000,
  existingLtvCap: 40,
  combinedLtvCap: 50,
  minTerm: 3,
  maxTerm: 12,
  quickTurnTerm: 3,
  shortLeaseYears: 70,
  allowedSettlementRails: Object.freeze(['faster_payments', 'chaps']),
  prohibitedSettlementRail: 'bacs',
});

export const SETTLEMENT_RAILS = Object.freeze({
  faster_payments: Object.freeze({
    label: 'Faster Payments',
    allowed: true,
    detail: 'Same-day, typically seconds.',
  }),
  chaps: Object.freeze({
    label: 'CHAPS',
    allowed: true,
    detail: 'Same-day. A fee applies. Used for larger sums.',
  }),
  bacs: Object.freeze({
    label: 'BACS',
    allowed: false,
    detail: 'Prohibited for every KPC capital call and drawdown.',
  }),
});

export const NHF_SCHEDULE_3M = Object.freeze([
  Object.freeze([26000, 33622]),
  Object.freeze([30000, 38774]),
  Object.freeze([40000, 51654]),
  Object.freeze([50000, 64534]),
  Object.freeze([75000, 96734]),
  Object.freeze([100000, 128934]),
]);

const COMPARISON_TERMS = [3, 6, 9, 12];

function pounds(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || /^tbc$/i.test(trimmed) || trimmed === '—' || trimmed === '-') return 0;
    const parsed = Number(trimmed.replace(/[£,\s]/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function poundsOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || /^tbc$/i.test(trimmed) || trimmed === '—' || trimmed === '-') return null;
  }
  const n = pounds(value);
  return Number.isFinite(n) ? n : null;
}

function roundNearestDiv(numer, denom) {
  const sign = numer < 0 ? -1 : 1;
  const abs = Math.abs(numer);
  return sign * Math.floor((abs + Math.floor(denom / 2)) / denom);
}

function assumptionsOf(input) {
  const raw = input?.assumptions || {};
  return {
    arrangementPct: numberOr(raw.arrangementPct, DEFAULT_ASSUMPTIONS.arrangementPct),
    monthlyRate: numberOr(raw.monthlyRate, DEFAULT_ASSUMPTIONS.monthlyRate),
    defaultRate: numberOr(raw.defaultRate, DEFAULT_ASSUMPTIONS.defaultRate),
    postTermRate: numberOr(raw.postTermRate, DEFAULT_ASSUMPTIONS.postTermRate),
    ackroyds: pounds(raw.ackroyds ?? DEFAULT_ASSUMPTIONS.ackroyds),
    titleInsurance: pounds(raw.titleInsurance ?? DEFAULT_ASSUMPTIONS.titleInsurance),
    brokerPct: numberOr(raw.brokerPct, DEFAULT_ASSUMPTIONS.brokerPct),
  };
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** True when numer/denom × 100 is strictly greater than an integer cap. */
export function exceedsPct(numer, denom, capPct) {
  if (!(denom > 0)) return true;
  return numer * 100 > denom * capPct;
}

export function ltvPct(numer, denom) {
  if (!(denom > 0)) return null;
  // Four decimal places via integer rounding so 40, 41, 47.5 and 50.01 stay exact.
  return Math.round((numer * 1_000_000) / denom) / 10_000;
}

export function formatGBP(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const rounded = Math.round(Number(value));
  const sign = rounded < 0 ? '−' : '';
  return `${sign}£${Math.abs(rounded).toLocaleString('en-GB')}`;
}

export function formatPct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function nhfThreeMonthTotal(netLoan) {
  const net = pounds(netLoan);
  return Math.floor((net * 1288 + NHF_INTERCEPT * 1000 + 500) / 1000);
}

export function nhfMonthlyIncrement(netLoan) {
  return roundNearestDiv(pounds(netLoan) * 25, 1000);
}

export function decomposeNhf(netLoan, termMonths) {
  const net = pounds(netLoan);
  const term = Math.round(Number(termMonths));
  const safeTerm = Number.isFinite(term) ? term : 0;
  const totalAt3 = nhfThreeMonthTotal(net);
  const extraMonths = safeTerm - 3;
  const monthlyIncrement = nhfMonthlyIncrement(net);
  const incrementalInterest = monthlyIncrement * extraMonths;
  const totalRepayment = totalAt3 + incrementalInterest;
  const broker = roundNearestDiv(net * 12, 100);
  const interestAt3 = roundNearestDiv(net * 84 + 67 * 1000, 1000);
  const scheduleFixed = NHF_SCHEDULE_FIXED_PLUG;
  const facility = totalAt3 - net - broker - interestAt3 - scheduleFixed;
  const interest = interestAt3 + incrementalInterest;
  const components = [
    { key: 'net', amount: net, label: 'Net release to borrower' },
    { key: 'broker', amount: broker, label: 'Broker fee (internal, 12% of net — implied by the 1.288 slope)' },
    {
      key: 'interest',
      amount: interest,
      label: extraMonths === 0
        ? 'Retained interest (2.50% pm × 3 on the subtotal)'
        : `Retained interest (3-month subtotal interest ${extraMonths > 0 ? '+' : '−'} ${Math.abs(extraMonths)} × 2.50% of net)`,
    },
    {
      key: 'facility',
      amount: facility,
      label: 'Facility fee (balances the published total; equals 3-month interest minus the £893 plug when the pounds are exact)',
    },
    {
      key: 'scheduleFixed',
      amount: scheduleFixed,
      label: 'Schedule fixed-cost plug (pricing-guide +£134 intercept ÷ 0.15, rounded to £893)',
    },
  ];
  const componentSum = components.reduce((sum, row) => sum + row.amount, 0);
  return {
    net,
    termMonths: safeTerm,
    totalAt3,
    totalRepayment,
    monthlyIncrement,
    incrementalInterest,
    extraMonths,
    broker,
    interestAt3,
    interest,
    facility,
    scheduleFixed,
    components,
    componentSum,
    reconciles: componentSum === totalRepayment,
    facilityMatchesIdentity: facility === interestAt3 - scheduleFixed,
  };
}

export function compoundPounds(balance, monthlyRate, months) {
  const base = pounds(balance);
  const m = Math.round(Number(months));
  if (!Number.isFinite(m) || m <= 0) return base;
  const rate = Number(monthlyRate);
  if (!Number.isFinite(rate)) return base;
  return Math.round(base * Math.pow(1 + rate, m));
}

function stressOn(total, assumptions) {
  return {
    rate: assumptions.defaultRate,
    plus3Months: compoundPounds(total, assumptions.defaultRate, 3),
    plus6Months: compoundPounds(total, assumptions.defaultRate, 6),
    postTermRate: assumptions.postTermRate,
    plus3MonthsAtPostTermRate: compoundPounds(total, assumptions.postTermRate, 3),
    note: 'Extension stress on the contractual repayment. Illustrative only. Not a second advance.',
  };
}

function workbookAt(net, termMonths, assumptions) {
  const arrangement = roundNearestDiv(net * Math.round(assumptions.arrangementPct * 10000), 10000);
  const ackroyds = assumptions.ackroyds;
  const titleInsurance = assumptions.titleInsurance;
  const legals = ackroyds + titleInsurance;
  const opening = net + arrangement + legals;
  const totalRepayment = compoundPounds(opening, assumptions.monthlyRate, termMonths);
  const interest = totalRepayment - opening;
  const brokerMemo = roundNearestDiv(net * Math.round(assumptions.brokerPct * 10000), 10000);
  const components = [
    { key: 'net', amount: net, label: 'Net release to borrower' },
    { key: 'arrangement', amount: arrangement, label: `Arrangement fee (${(assumptions.arrangementPct * 100).toFixed(2)}% of net)` },
    { key: 'ackroyds', amount: ackroyds, label: 'Ackroyds Legal (deducted from facility, £0 upfront)' },
    { key: 'titleInsurance', amount: titleInsurance, label: 'No-search title insurance (deducted from facility, £0 upfront)' },
    { key: 'interest', amount: interest, label: `Rolled compound interest (${(assumptions.monthlyRate * 100).toFixed(2)}% pm × ${termMonths})` },
  ];
  return {
    model: 'kpc_workbook',
    net,
    termMonths,
    arrangement,
    ackroyds,
    titleInsurance,
    legals,
    opening,
    interest,
    brokerMemo,
    brokerIncludedInGross: false,
    totalRepayment,
    totalCost: totalRepayment - net,
    components,
    componentSum: components.reduce((sum, row) => sum + row.amount, 0),
    defaultStress: stressOn(totalRepayment, assumptions),
  };
}

function effectiveMonthly(total, net, term) {
  if (!(net > 0) || !(term > 0) || !(total > 0)) return null;
  return (Math.pow(total / net, 1 / term) - 1) * 100;
}

function simpleMonthly(total, net, term) {
  if (!(net > 0) || !(term > 0)) return null;
  return ((total - net) / net / term) * 100;
}

export function servicingSummary(input = {}) {
  const income = pounds(input.monthlyIncome);
  const debtService = pounds(input.monthlyDebtService);
  const cashBuffer = pounds(input.cashBuffer);
  const structure = input.interestStructure || 'rolled';
  return {
    interestStructure: structure,
    monthlyIncome: income,
    monthlyDebtService: debtService,
    cashBuffer,
    gap: income - debtService,
    coverage: debtService > 0 ? income / debtService : null,
    illustrativeMonthlyInterest: nhfMonthlyIncrement(input.netLoan),
    note: structure === 'rolled'
      ? 'Rolled / retained bullet: new KPC interest is not collected monthly. Coverage is rental or business income against the existing debt service only.'
      : 'Serviced illustration only. The headline repayment table remains the rolled schedule so it stays tied to the pricing guide.',
  };
}

function comparisonTerms(selected) {
  const terms = new Set(COMPARISON_TERMS);
  if (selected >= 1 && selected <= 36) terms.add(selected);
  return [...terms].sort((a, b) => a - b);
}

export function calculateNhfPricing(input = {}) {
  const net = pounds(input.netLoan);
  const term = Math.round(Number(input.termMonths));
  const safeTerm = Number.isFinite(term) ? term : 0;
  const propertyValue = pounds(input.propertyValue);
  const currentDebt = pounds(input.currentDebt);
  const assumptions = assumptionsOf(input);
  const model = input.pricingModel === 'kpc_workbook' ? 'kpc_workbook' : 'nhf_speed';
  const legalBudget = {
    ackroyds: assumptions.ackroyds,
    titleInsurance: assumptions.titleInsurance,
    total: assumptions.ackroyds + assumptions.titleInsurance,
    upfrontCash: 0,
    note: 'Borrower-paid legal and title costs. Zero upfront cash when deducted from the facility. Not added again on top of the pricing-guide 3-month total.',
  };

  const buildNhf = (months) => {
    const parts = decomposeNhf(net, months);
    return {
      model: 'nhf_speed',
      ...parts,
      legalBudget,
      totalCost: parts.totalRepayment - net,
      defaultStress: stressOn(parts.totalRepayment, assumptions),
      scheduleLockedAt3Months: true,
      incrementalRate: NHF_LOCKED_MONTHLY_RATE,
      extrapolated: net < MANDATE.minNet || net > MANDATE.maxNet,
      formula: 'round(1.288 × net + 134) at 3 months; each further month adds round(2.50% × net)',
    };
  };

  const nhf = buildNhf(safeTerm);
  const workbook = workbookAt(net, safeTerm, assumptions);
  const active = model === 'kpc_workbook' ? workbook : nhf;
  const gross = active.totalRepayment;
  const day1CombinedLtvPct = propertyValue > 0 ? ltvPct(currentDebt + net, propertyValue) : null;
  const grossCombinedLtvPct = propertyValue > 0 ? ltvPct(currentDebt + gross, propertyValue) : null;
  const equityCushion = propertyValue > 0 ? propertyValue - currentDebt - gross : null;
  const equityCushionPct = propertyValue > 0 && equityCushion !== null ? (equityCushion / propertyValue) * 100 : null;

  const comparison = comparisonTerms(safeTerm).map((months) => {
    const rowNhf = buildNhf(months);
    const rowBook = workbookAt(net, months, assumptions);
    const rowGross = model === 'kpc_workbook' ? rowBook.totalRepayment : rowNhf.totalRepayment;
    return {
      termMonths: months,
      selected: months === safeTerm,
      inMandate: months >= MANDATE.minTerm && months <= MANDATE.maxTerm,
      quickTurn: months === MANDATE.quickTurnTerm,
      nhfTotal: rowNhf.totalRepayment,
      workbookTotal: rowBook.totalRepayment,
      totalRepayment: rowGross,
      totalCost: rowGross - net,
      interest: model === 'kpc_workbook' ? rowBook.interest : rowNhf.interest,
      grossCombinedLtvPct: propertyValue > 0 ? ltvPct(currentDebt + rowGross, propertyValue) : null,
    };
  });

  return {
    model,
    assumptions,
    netRelease: net,
    termMonths: safeTerm,
    totalRepayment: gross,
    interestCost: active.interest,
    arrangementFee: model === 'kpc_workbook' ? workbook.arrangement : null,
    brokerFee: model === 'kpc_workbook' ? workbook.brokerMemo : nhf.broker,
    facilityFee: model === 'kpc_workbook' ? null : nhf.facility,
    legalAndTitle: legalBudget.total,
    legalBudget,
    totalCostOfBorrowing: gross - net,
    effectiveMonthlyCostPct: effectiveMonthly(gross, net, safeTerm),
    simpleMonthlyCostPct: simpleMonthly(gross, net, safeTerm),
    day1CombinedLtvPct,
    grossCombinedLtvPct,
    existingLtvPct: propertyValue > 0 ? ltvPct(currentDebt, propertyValue) : null,
    newLtvPct: propertyValue > 0 ? ltvPct(net, propertyValue) : null,
    equityCushion,
    equityCushionPct,
    defaultStress: active.defaultStress,
    extrapolated: nhf.extrapolated,
    withinPublishedSchedule: !nhf.extrapolated && safeTerm === 3 && model === 'nhf_speed',
    nhf,
    workbook,
    comparison,
    servicing: servicingSummary(input),
  };
}

function rule(id, title, status, message, detail = '') {
  return { id, title, status, message, detail };
}

function exitIsViable(input) {
  const known = new Set(['bridge_to_bridge', 'sale', 'term_refinance', 'dev_exit']);
  const evidence = String(input.exitEvidence || input.exitDescription || '').trim();
  return known.has(input.exitPrimary) && evidence.length > 0;
}

function titleFlags(input) {
  const flags = [];
  const orderNote = String(input.chargingOrdersNote || '');
  const restrictionNote = String(input.restrictionsNote || '');
  const mentionsOrder = /charging order|interim charge/i.test(orderNote) && !/^(none|no|nil)\b/i.test(orderNote.trim());
  if (input.hasInterimChargingOrder === true || mentionsOrder) {
    flags.push('Interim charging order — Ackroyds Legal check. Balances stay TBC unless a figure is already on the profile.');
  }
  const mentionsRestriction = /restriction/i.test(restrictionNote) && !/^(none|no|nil)\b/i.test(restrictionNote.trim());
  if (input.hasOtherRestriction === true || mentionsRestriction) {
    flags.push('Restriction on title — Ackroyds Legal check.');
  }
  const consent = input.firstChargeConsent || 'unknown';
  const debt = pounds(input.currentDebt);
  if (consent === 'missing') flags.push('Missing 1st-charge consent — Ackroyds Legal check.');
  if (consent === 'restriction') flags.push('1st-charge consent restriction — Ackroyds Legal check.');
  if (consent === 'unknown' && debt > 0) flags.push('1st-charge consent not confirmed — Ackroyds Legal check.');
  if (input.tenure === 'leasehold') {
    const years = input.leaseYears === null || input.leaseYears === undefined || input.leaseYears === ''
      ? null
      : Number(input.leaseYears);
    if (years === null || Number.isNaN(years)) flags.push('Leasehold term not confirmed — Ackroyds Legal check.');
    else if (years < MANDATE.shortLeaseYears) flags.push(`Short lease (${years} years, under 70) — Ackroyds Legal check.`);
  }
  return flags;
}

/**
 * Hard-stop triage.
 * An explicit finite `grossLoan` overrides the priced gross for the LTV
 * boundary only (used to probe 50.00 vs 50.01). The form never sets it.
 */
export function evaluateKpcTriage(input = {}) {
  const propertyValue = pounds(input.propertyValue);
  const currentDebt = pounds(input.currentDebt);
  const netLoan = pounds(input.netLoan);
  const termMonths = Math.round(Number(input.termMonths));
  const safeTerm = Number.isFinite(termMonths) ? termMonths : 0;
  const pricing = calculateNhfPricing({ ...input, netLoan, termMonths: safeTerm, propertyValue, currentDebt });
  const grossOverride = input.grossLoan === null || input.grossLoan === undefined || input.grossLoan === ''
    ? null
    : pounds(input.grossLoan);
  const grossLoan = grossOverride === null ? pricing.totalRepayment : grossOverride;

  const existingLtvPct = propertyValue > 0 ? ltvPct(currentDebt, propertyValue) : null;
  const newLtvPct = propertyValue > 0 ? ltvPct(netLoan, propertyValue) : null;
  const day1CombinedLtvPct = propertyValue > 0 ? ltvPct(currentDebt + netLoan, propertyValue) : null;
  const grossCombinedLtvPct = propertyValue > 0 ? ltvPct(currentDebt + grossLoan, propertyValue) : null;
  const equityCushion = propertyValue > 0 ? propertyValue - currentDebt - grossLoan : null;
  const equityCushionPct = propertyValue > 0 && equityCushion !== null ? (equityCushion / propertyValue) * 100 : null;
  const sweetSpot = netLoan >= MANDATE.sweetMin && netLoan <= MANDATE.sweetMax;

  const valueMissing = !(propertyValue > 0);

  const existingFail = valueMissing || exceedsPct(currentDebt, propertyValue, MANDATE.existingLtvCap);
  const day1Fail = valueMissing || exceedsPct(currentDebt + netLoan, propertyValue, MANDATE.combinedLtvCap);
  const grossFail = valueMissing || exceedsPct(currentDebt + grossLoan, propertyValue, MANDATE.combinedLtvCap);
  const combinedFail = day1Fail || grossFail;

  const rules = [];

  rules.push(rule(
    'existing_ltv',
    'Existing debt LTV',
    existingFail ? 'HARD_DECLINE' : 'PASS',
    existingFail
      ? (valueMissing
        ? 'Property value is required before the 40% existing-debt hard stop can clear.'
        : "Current debt exceeds KPC's 40% LTV hard stop")
      : 'Existing debt is within the 40% LTV hard stop.',
    valueMissing
      ? 'Property value missing.'
      : `Existing LTV ${formatPct(existingLtvPct)} vs 40% hard stop.`,
  ));

  const combinedDetail = valueMissing
    ? 'Property value missing.'
    : `Day-1 combined LTV ${formatPct(day1CombinedLtvPct)} · Gross/Exit combined LTV ${formatPct(grossCombinedLtvPct)} · cap 50%.`;
  rules.push(rule(
    'combined_ltv',
    'Combined total LTV',
    combinedFail ? 'HARD_DECLINE' : 'PASS',
    combinedFail
      ? "Current debt + new loan exceeds KPC's 50% LTV hard cap"
      : 'Day-1 and gross/exit combined LTV are within the 50% hard cap.',
    combinedDetail,
  ));

  const ownerOccupied = input.occupancy === 'owner_occupied';
  const unregulatedConfirmed = input.unregulatedConfirmed === true;
  const regulatedFail = ownerOccupied || !unregulatedConfirmed;
  rules.push(rule(
    'unregulated',
    'Unregulated only',
    regulatedFail ? 'HARD_DECLINE' : 'PASS',
    regulatedFail
      ? "Regulated residential security is outside KPC's unregulated mandate — route via Posfin regulated panel"
      : 'Unregulated business-purpose investment occupancy is confirmed.',
    ownerOccupied
      ? 'Occupancy is owner-occupied main residence (regulated).'
      : (unregulatedConfirmed ? 'Business-purpose declaration is ticked.' : 'Business-purpose / unregulated declaration is not confirmed.'),
  ));

  const sizeFail = netLoan < MANDATE.minNet || netLoan > MANDATE.maxNet;
  let sizeDetail = `${formatGBP(netLoan)} against the £26,000–£100,000 mandate.`;
  if (!sizeFail && sweetSpot) sizeDetail = `Sweet Spot (~£50k). ${formatGBP(netLoan)} sits in the £40,000–£65,000 band.`;
  else if (!sizeFail) sizeDetail = `${formatGBP(netLoan)} is inside £26,000–£100,000, outside the £40,000–£65,000 sweet spot.`;
  rules.push(rule(
    'loan_size',
    'Loan size',
    sizeFail ? 'HARD_DECLINE' : 'PASS',
    sizeFail
      ? 'Outside KPC £26,000–£100,000 micro-bridging mandate'
      : 'Inside the £26,000–£100,000 micro-bridging mandate.',
    sizeDetail,
  ));

  let termStatus = 'PASS';
  let termMessage = 'Inside the 3–12 month mandate.';
  let termDetail = safeTerm === 3
    ? '3 months — typical quick-turn sweet spot, inside the 3–12 month mandate.'
    : `${safeTerm} months — inside the 3–12 month mandate.`;
  if (safeTerm < MANDATE.minTerm || safeTerm > MANDATE.maxTerm) {
    termStatus = 'HARD_DECLINE';
    termMessage = 'Term is outside KPC’s 3–12 month mandate.';
    termDetail = `${safeTerm} months. Mandate is 3 to 12 months inclusive. Under 3 or over 12 is a hard decline.`;
  }
  rules.push(rule('term', 'Term', termStatus, termMessage, termDetail));

  const exitOk = exitIsViable(input);
  rules.push(rule(
    'exit',
    'Exit strategy',
    exitOk ? 'PASS' : 'REFER',
    exitOk
      ? 'Exit strategy is stated.'
      : 'Exit strategy missing or unclear — refer before a KPC decision.',
    exitOk
      ? String(input.exitEvidence || input.exitDescription || '').trim()
      : 'Need a bridge-to-bridge, sale, term refinance, or dev exit with a short evidence note.',
  ));

  const flags = titleFlags(input);
  rules.push(rule(
    'title',
    'Title and prior charge',
    flags.length ? 'LEGAL_REVIEW' : 'PASS',
    flags.length
      ? 'Legal review — title flags do not override a hard stop, and they block a clean pass.'
      : 'No interim charge, restriction, missing consent, or short-lease flag.',
    flags.length ? flags.join(' ') : 'Ackroyds Legal check not raised by the flags on this profile.',
  ));

  rules.push(settlementRule(input));

  const avmOk = input.avmCompleted === true;
  rules.push(rule(
    'avm',
    'AVM before drawdown',
    avmOk ? 'PASS' : 'BLOCKED_FOR_DRAWDOWN',
    avmOk
      ? 'AVM is marked complete. Drawdown gate is clear on this test profile.'
      : 'Hard Gate: AVM must be completed and verified before drawdown',
    avmOk
      ? [input.avmProvider, input.avmConfidence, poundsOrNull(input.avmValue) === null ? null : formatGBP(input.avmValue), input.avmDate].filter(Boolean).join(' · ')
      : 'Tick AVM complete only when a provider, value, confidence and date are actually on file. Do not invent them.',
  ));

  const hardDecline = rules.some((item) => item.status === 'HARD_DECLINE');
  const hardBlock = rules.some((item) => item.status === 'HARD_BLOCK');
  const blocked = rules.some((item) => item.status === 'BLOCKED_FOR_DRAWDOWN');
  const refer = rules.some((item) => item.status === 'REFER' || item.status === 'LEGAL_REVIEW');

  let verdict = 'PASS';
  let label = 'PASS — ELIGIBLE FOR KPC';
  if (hardDecline) {
    verdict = 'HARD_DECLINE';
    label = 'HARD DECLINE';
  } else if (hardBlock) {
    verdict = 'HARD_BLOCK';
    label = 'HARD BLOCK';
  } else if (blocked) {
    verdict = 'BLOCKED_FOR_DRAWDOWN';
    label = 'BLOCKED FOR DRAWDOWN';
  } else if (refer) {
    verdict = 'REFER';
    label = 'REFER';
  }

  return {
    verdict,
    label,
    rules,
    metrics: {
      propertyValue,
      currentDebt,
      netLoan,
      grossLoan,
      pricedGross: pricing.totalRepayment,
      grossLoanOverridden: grossOverride !== null,
      existingLtvPct,
      newLtvPct,
      day1CombinedLtvPct,
      grossCombinedLtvPct,
      equityCushion,
      equityCushionPct,
      sweetSpot,
      quickTurn: safeTerm === MANDATE.quickTurnTerm,
      termMonths: safeTerm,
      pricingModel: pricing.model,
      settlementRail: String(input.settlementRail || '').trim().toLowerCase(),
    },
  };
}

function settlementRule(input) {
  const rail = String(input.settlementRail || '').trim().toLowerCase();
  if (rail === 'faster_payments') {
    return rule(
      'settlement',
      'Settlement rail',
      'PASS',
      'Faster Payments is an allowed drawdown and capital-call rail.',
      'Same-day, typically seconds. BACS remains prohibited.',
    );
  }
  if (rail === 'chaps') {
    return rule(
      'settlement',
      'Settlement rail',
      'PASS',
      'CHAPS is an allowed drawdown and capital-call rail.',
      'Same-day. A fee applies. Used for larger sums. BACS remains prohibited.',
    );
  }
  if (rail === 'bacs') {
    return rule(
      'settlement',
      'Settlement rail',
      'HARD_BLOCK',
      'BACS is prohibited for KPC capital calls and drawdowns. Allowed rails are Faster Payments and CHAPS only.',
      'Hard block — unacceptable rail.',
    );
  }
  return rule(
    'settlement',
    'Settlement rail',
    'HARD_BLOCK',
    'No allowed settlement rail selected. Drawdown and capital calls may use Faster Payments or CHAPS only. BACS is prohibited.',
    'Hard block until an allowed rail is chosen. Do not invent a rail that is not on file.',
  );
}

export function buildDealPack(input, triage, pricing) {
  return {
    banner: INTERNAL_BANNER,
    externalSends: false,
    presetId: input.presetId || null,
    profileKind: input.profileKind || null,
    profileLabel: input.profileLabel || null,
    badge: input.badge || null,
    reference: input.reference || null,
    input,
    triage: {
      verdict: triage.verdict,
      label: triage.label,
      rules: triage.rules,
      metrics: triage.metrics,
    },
    pricing: {
      model: pricing.model,
      netRelease: pricing.netRelease,
      totalRepayment: pricing.totalRepayment,
      totalCostOfBorrowing: pricing.totalCostOfBorrowing,
      interestCost: pricing.interestCost,
      legalAndTitle: pricing.legalAndTitle,
      day1CombinedLtvPct: pricing.day1CombinedLtvPct,
      grossCombinedLtvPct: pricing.grossCombinedLtvPct,
      equityCushion: pricing.equityCushion,
      equityCushionPct: pricing.equityCushionPct,
      effectiveMonthlyCostPct: pricing.effectiveMonthlyCostPct,
      defaultStress: pricing.defaultStress,
      extrapolated: pricing.extrapolated,
      comparison: pricing.comparison,
      nhfTotalAt3: pricing.nhf?.totalAt3 ?? null,
      workbookTotal: pricing.workbook?.totalRepayment ?? null,
    },
  };
}
