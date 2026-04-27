/**
 * POST /api/quote/main-loan
 * Posfin Capital — Indicative Loan Quote API
 *
 * Returns an array of product quotes (Somo, MT Finance, KPC Speed Loan)
 * with exactly one product marked recommended=true.
 *
 * Request body:
 * {
 *   "property_value":         500000,   // Required. Open Market Value (£)
 *   "first_mortgage_clean":   100000,   // Optional. First charge, no arrears (£)
 *   "first_mortgage_arrears": 0,        // Optional. First charge with arrears (£)
 *   "other_charges_amount":   0,        // Optional. Other secured charges (£)
 *   "loan_amount_requested":  150000,   // Required. Amount requested (£)
 *   "loan_amount_basis":      "net",    // Optional. "net" (default) or "gross"
 *   "charge_position":        "1st",    // Optional. "1st" (default) or "2nd"
 *   "regulated":              false,    // Optional. true = primary residence (FCA regulated)
 *   "purpose":                "business", // Optional. informational
 *   "timeframe":              "2_weeks",  // Optional. "asap" triggers Speed Loan preference
 *   "term_months":            12         // Optional. 3–12 (default 12; ignored for KPC which is always 3)
 * }
 */

/**
 * Posfin Capital — Loan Calculator Engine
 * Pure calculation functions — no HTTP, importable by API handlers and tests.
 *
 * Rate cards reverse-engineered from 200+ real Posfin deals:
 *   - Somo:  96 confirmed offers (Jan–Apr 2026)
 *   - MT Finance: product guide cross-checked, flat 0.89%/0.95%
 *   - KPC:   sub-total compound model, 12% broker (NOT disclosed)
 *
 * Do NOT edit rate cards without updating the source Python calculators:
 *   tools/somo_calculator.py
 *   tools/mt_finance_calculator.py
 *   tools/kpc_calculator.py
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SOMO RATE CARD
// Observed from 96 real Somo offers (somo_calculator.py)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rate tiers by gross LTV (including existing debt against property).
 * Confirmed by Ibraar 26 Apr 2026 — 30–60% tier is 0.93% standard, NOT a one-off.
 * Higher-risk tiers (1.05%, 1.25%, 1.30%, 1.40%) exist but require manual
 * underwriter input — not auto-quoted via API.
 */
const SOMO_RATE_TIERS = [
  { maxLtv: 0.30, rate: 0.0080 },  // ≤30% LTV  → 0.80%/month (prime)
  { maxLtv: 0.60, rate: 0.0093 },  // 30–60%    → 0.93%/month (confirmed standard)
  { maxLtv: 0.70, rate: 0.0095 },  // 60–70%    → 0.95%/month (high LTV)
];

const SOMO_CONFIG = {
  arrangementPct:  0.025,   // 2.5% of gross (confirmed 26 Apr 2026)
  adminFee:        650,     // £650 standard (confirmed 26 Apr 2026)
  brokerPct:       0.03,    // 3% of gross, floor at minBroker
  minBroker:       3500,    // £3,500 minimum broker fee
  lockInFee:       350,     // Upfront; refundable on redemption
  procPct:         0.02,    // 2% proc fee — invoiced to Somo by Posfin
  minLoan:         50_000,   // Somo real minimum £27.5K — we floor at £50K gross for sub-£100K edge cases (max 60% LTV)
  maxLoan:       5_000_000,
  minTermPct:      0.50,    // Min interest period = 50% of loan term (e.g. 6-mo loan → 3-mo minimum)
  maxTerm:         12,
  maxLtv:          0.70,    // Hard stop — Somo max gross LTV
  regulated:       false,   // Somo is UNREGULATED ONLY
};

// ═══════════════════════════════════════════════════════════════════════════════
// MT FINANCE RATE CARD
// Flat rates — NOT LTV-tiered (mt_finance_calculator.py)
// ═══════════════════════════════════════════════════════════════════════════════

const MT_CONFIG = {
  regulatedRate:              0.0089,  // 0.89%/month regulated (primary residence)
  unregulatedRate:            0.0095,  // 0.95%/month unregulated (investment/SPV)
  conservativeBuffer:         0.10,    // 10% haircut on property value (MT Finance standard)
  maxLtvRegulated:            0.75,    // 75% gross LTV cap — regulated
  maxLtvUnregulated:          0.70,    // 70% gross LTV cap — unregulated
  unregulatedArrangementPct:  0.02,    // 2% of GROSS (unregulated) — confirmed 26 Apr 2026
  regulatedArrangementPct:    0.03,    // 3% of NET (regulated) — confirmed 26 Apr 2026
  adminFee:                   295,     // £295 flat — confirmed 26 Apr 2026
  lenderLegalUndertaking:     1_560,   // Mandatory processing cost — noted internally, NOT shown in quote
  brokerPct:                  0.02,    // 2% Posfin broker fee
  procPct:                    0.02,    // 2% Posfin proc fee
  minLoan:                    100_000,
  maxLoan:                  5_000_000,
  minTerm:                    3,
  maxTerm:                    12,
  avmFriendly:                true,    // MT Finance accepts AVM valuations
};

// ═══════════════════════════════════════════════════════════════════════════════
// KPC (KENSINGTON PRIVATE CREDIT) SPEED LOAN
// Company No: 16988655 — sub-total compound formula (kpc_calculator.py)
// ═══════════════════════════════════════════════════════════════════════════════

const KPC_CONFIG = {
  rate:         0.025,   // 2.5%/month discount rate (5% headline via facility fee)
  brokerPct:    0.12,    // 12% — Byron sweat equity. NEVER disclosed to borrower.
  legals:       1_200,   // Fixed Ackroyds legals (NHF uses £895; KPC uses £1,200)
  netLtvCap:    0.50,    // 50% net LTV hard stop
  grossLtvCap:  0.60,    // 60% gross LTV hard stop
  minLoan:      26_000,
  maxLoan:      100_000,
  term:         3,       // Standard 3-month term
  fundingDays:  '3–5 business days',
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;
const pct = (n, dp = 2) => `${(n * 100).toFixed(dp)}%`;

// ═══════════════════════════════════════════════════════════════════════════════
// SOMO CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Return the Somo monthly rate for a given gross LTV ratio.
 * Rate tiers confirmed 26 Apr 2026 (Ibraar): ≤30% → 0.80%, 30–60% → 0.93%, 60–70% → 0.95%.
 * Returns null if LTV exceeds max (70%).
 * @param {number} grossLtv - Gross LTV ratio (0–1)
 * @param {number|null} [rateOverride] - If provided, use this rate regardless of LTV (for val-only tier)
 */
function somoGetRate(grossLtv, rateOverride = null) {
  if (rateOverride !== null) return rateOverride;
  for (const tier of SOMO_RATE_TIERS) {
    if (grossLtv <= tier.maxLtv) return tier.rate;
  }
  return null;  // LTV too high — ineligible
}

/**
 * Calculate a Somo loan given a gross facility amount.
 *
 * Formula (verified against 96 offers):
 *   Net Release = Gross − ArrangementFee − AdminFee − BrokerFee − RetainedInterest
 *
 * @param {object} p
 * @param {number} p.grossLoan       - Total facility (the "Bridge Loan Facility")
 * @param {number} p.termMonths      - Term in months (3–12)
 * @param {number} p.propertyValue   - OMV of property
 * @param {number} p.existingDebt    - All charges already secured (excl. this loan)
 * @param {boolean} p.regulated      - Regulated deal? (Somo is unregulated only → returns null)
 * @param {number|null} [p.rateOverride] - Force a specific rate (used for val-only credit tier)
 * @returns {object|null}
 */
function somoCalc({ grossLoan, termMonths, propertyValue, existingDebt = 0, regulated = false, rateOverride = null }) {
  if (regulated) return null;  // Somo: unregulated only
  if (grossLoan < SOMO_CONFIG.minLoan || grossLoan > SOMO_CONFIG.maxLoan) return null;
  if (termMonths < 1 || termMonths > SOMO_CONFIG.maxTerm) return null;

  const grossLtv = (grossLoan + existingDebt) / propertyValue;
  if (grossLtv > SOMO_CONFIG.maxLtv) return null;

  const rate = somoGetRate(grossLtv, rateOverride);
  if (rate === null) return null;

  // Minimum interest period = 50% of loan term (e.g. 6-month loan = 3-month minimum)
  const minInterestMonths = Math.ceil(termMonths * SOMO_CONFIG.minTermPct);

  const arrangementFee   = grossLoan * SOMO_CONFIG.arrangementPct;
  const brokerCalc       = grossLoan * SOMO_CONFIG.brokerPct;
  const brokerFee        = Math.max(brokerCalc, SOMO_CONFIG.minBroker);
  const brokerApplied    = brokerCalc >= SOMO_CONFIG.minBroker
    ? `${SOMO_CONFIG.brokerPct * 100}%`
    : `£${SOMO_CONFIG.minBroker.toLocaleString()} (minimum)`;
  const interestPm       = grossLoan * rate;
  const retainedInterest = interestPm * termMonths;
  const totalDeductions  = arrangementFee + SOMO_CONFIG.adminFee + brokerFee + retainedInterest;
  const netRelease       = grossLoan - totalDeductions;
  const procFee          = grossLoan * SOMO_CONFIG.procPct;
  // Factor rate = gross repayable ÷ net release (interest is retained, so repayable = gross)
  const factorRate       = netRelease > 0 ? grossLoan / netRelease : 0;

  return {
    lender:              'Somo',
    product:             'Somo Main Loan',
    regulation:          'Unregulated',
    ratePmPct:           pct(rate),
    ratePm:              rate,
    rateAnnualPct:       pct(rate * 12, 1),
    termMonths,
    minInterestMonths,
    minInterestNote:     `${minInterestMonths}-month minimum interest period`,
    grossLoan:           round2(grossLoan),
    netRelease:          round2(netRelease),
    grossLtv:            round4(grossLtv),
    grossLtvPct:         pct(grossLtv, 1),
    arrangementFee:      round2(arrangementFee),
    arrangementPct:      '2.5% of gross',
    adminFee:            SOMO_CONFIG.adminFee,
    brokerFee:           round2(brokerFee),
    brokerApplied,
    lockInFee:           SOMO_CONFIG.lockInFee,
    valuationFee:        'TBC + VAT',
    interestPm:          round2(interestPm),
    retainedInterest:    round2(retainedInterest),
    totalDeductions:     round2(totalDeductions),
    grossRepayable:      round2(grossLoan),
    factorRate:          round4(factorRate),
    recommended:         false,
    // Internal Posfin revenue (strip before borrower-facing output)
    _posfin: {
      brokerFee: round2(brokerFee),
      procFee:   round2(procFee),
      totalGp:   round2(brokerFee + procFee),
    },
  };
}

/**
 * Reverse-calculate Somo: given a target net release, find the gross facility needed.
 * Iterates 6 times to resolve rate-tier feedback loop (LTV changes as gross changes).
 */
function somoFromNet({ netTarget, termMonths, propertyValue, existingDebt = 0, regulated = false, rateOverride = null }) {
  if (regulated) return null;
  if (termMonths < 1 || termMonths > SOMO_CONFIG.maxTerm) return null;

  const { arrangementPct, brokerPct, minBroker, adminFee } = SOMO_CONFIG;

  // Seed estimate using standard rate (val-only override if supplied)
  const seedRate = rateOverride ?? 0.0095;
  let grossLoan = (netTarget + adminFee) / (1 - arrangementPct - brokerPct - (seedRate * termMonths));

  for (let i = 0; i < 6; i++) {
    const grossLtv = (grossLoan + existingDebt) / propertyValue;
    const rate = somoGetRate(grossLtv, rateOverride);
    if (rate === null) return null;

    const brokerCalc = grossLoan * brokerPct;
    if (brokerCalc < minBroker) {
      // Min broker applies — broker is a fixed £3,500
      const f = 1 - arrangementPct - (rate * termMonths);
      grossLoan = (netTarget + adminFee + minBroker) / f;
    } else {
      const f = 1 - arrangementPct - brokerPct - (rate * termMonths);
      grossLoan = (netTarget + adminFee) / f;
    }
  }

  return somoCalc({ grossLoan, termMonths, propertyValue, existingDebt, regulated, rateOverride });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MT FINANCE CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate MT Finance loan from net loan amount.
 *
 * Formula (from mt_finance_calculator.py):
 *   gross × (1 − arrangementPct − rate × term) = net
 *   → gross = net / (1 − arrangementPct − rate × term)
 *
 * MT Finance applies a 10% conservative buffer on property value for LTV checks.
 *
 * @param {object} p
 * @param {number}  p.netLoan       - Net amount borrower receives
 * @param {number}  p.termMonths    - Term in months (3–12)
 * @param {number}  p.propertyValue - OMV of property
 * @param {number}  p.existingDebt  - All prior charges
 * @param {boolean} p.regulated     - Regulated loan (primary residence)?
 * @param {number|null} [p.rateOverride] - Force a specific rate (used for val-only credit tier)
 * @returns {object|null}
 */
function mtCalc({ netLoan, termMonths, propertyValue, existingDebt = 0, regulated = false, rateOverride = null }) {
  if (netLoan < MT_CONFIG.minLoan || netLoan > MT_CONFIG.maxLoan) return null;
  if (termMonths < MT_CONFIG.minTerm || termMonths > MT_CONFIG.maxTerm) return null;

  const rate   = rateOverride ?? (regulated ? MT_CONFIG.regulatedRate : MT_CONFIG.unregulatedRate);
  const maxLtv = regulated ? MT_CONFIG.maxLtvRegulated : MT_CONFIG.maxLtvUnregulated;

  // MT Finance conservative property value (10% buffer — matches their internal calc)
  const conservativeValue = propertyValue * (1 - MT_CONFIG.conservativeBuffer);
  const maxGrossByLtv     = conservativeValue * maxLtv;

  // Arrangement fee differs by regulation:
  //   Regulated:   3% of NET loan (MT confirmed 26 Apr 2026)
  //   Unregulated: 2% of GROSS loan
  let grossLoan;
  let arrangementFee;
  if (regulated) {
    // gross * (1 - rate*term) = net * (1 + arrangementPct_net) + adminFee
    const arrangePct = MT_CONFIG.regulatedArrangementPct;
    const denom = 1 - (rate * termMonths);
    if (denom <= 0) return null;
    grossLoan      = (netLoan * (1 + arrangePct) + MT_CONFIG.adminFee) / denom;
    arrangementFee = netLoan * arrangePct;
  } else {
    const arrangePct = MT_CONFIG.unregulatedArrangementPct;
    const denom = 1 - arrangePct - (rate * termMonths);
    if (denom <= 0) return null;
    grossLoan      = (netLoan + MT_CONFIG.adminFee) / denom;
    arrangementFee = grossLoan * arrangePct;
  }

  // Cap at max LTV if needed
  if ((grossLoan + existingDebt) > (maxGrossByLtv + existingDebt)) {
    grossLoan = maxGrossByLtv - existingDebt;
    arrangementFee = regulated
      ? netLoan * MT_CONFIG.regulatedArrangementPct
      : grossLoan * MT_CONFIG.unregulatedArrangementPct;
  }
  if (grossLoan <= 0) return null;

  const interestPm    = grossLoan * rate;
  const totalInterest = interestPm * termMonths;
  const brokerFee     = grossLoan * MT_CONFIG.brokerPct;
  const procFee       = grossLoan * MT_CONFIG.procPct;
  // Net release = gross − arrangement − retained interest − admin
  const netRelease    = grossLoan - arrangementFee - totalInterest - MT_CONFIG.adminFee;
  const grossLtv      = (grossLoan + existingDebt) / propertyValue;
  const factorRate    = netRelease > 0 ? grossLoan / netRelease : 0;

  const arrangementPctLabel = regulated
    ? `${MT_CONFIG.regulatedArrangementPct * 100}% of net`
    : `${MT_CONFIG.unregulatedArrangementPct * 100}% of gross`;

  return {
    lender:                    'MT Finance',
    product:                   regulated ? 'MT Finance Regulated' : 'MT Finance Unregulated',
    regulation:                regulated ? 'Regulated' : 'Unregulated',
    ratePmPct:                 rateOverride ? pct(rateOverride) : (regulated ? '0.89%' : '0.95%'),
    ratePm:                    rate,
    rateAnnualPct:             pct(rate * 12, 2),
    termMonths,
    netLoanRequested:          round2(netLoan),
    grossLoan:                 round2(grossLoan),
    netRelease:                round2(netRelease),
    grossLtv:                  round4(grossLtv),
    grossLtvPct:               pct(grossLtv, 1),
    conservativePropertyValue: round2(conservativeValue),
    arrangementFee:            round2(arrangementFee),
    arrangementPct:            arrangementPctLabel,
    adminFee:                  MT_CONFIG.adminFee,
    interestPm:                round2(interestPm),
    totalInterest:             round2(totalInterest),
    grossRepayable:            round2(grossLoan),
    factorRate:                round4(factorRate),
    avmFriendly:               MT_CONFIG.avmFriendly,
    // Lender legal undertaking: £1,560 — mandatory processing cost, NOT in borrower quote
    _lenderLegal:              MT_CONFIG.lenderLegalUndertaking,
    recommended:               false,
    _posfin: {
      brokerFee: round2(brokerFee),
      procFee:   round2(procFee),
      totalGp:   round2(brokerFee + procFee),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPC SPEED LOAN CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate KPC Speed Loan from net amount.
 *
 * Formula (from kpc_calculator.py — identical model to NHF but £1,200 legals):
 *   broker      = net × brokerPct
 *   subTotal    = net + broker + legals
 *   monthlyInt  = subTotal × rate
 *   interestTm  = monthlyInt × term
 *   facilityFee = interestTm − legals
 *   gross       = net + interestTm + facilityFee + broker + legals
 *
 * The 12% broker fee is NEVER disclosed to the borrower.
 * LTV check uses both net LTV (cap 50%) and gross LTV (cap 60%).
 *
 * @param {object} p
 * @param {number} p.netLoan       - Net amount borrower receives
 * @param {number} p.propertyValue - OMV of property
 * @param {number} p.existingDebt  - All prior charges
 * @returns {object|null}
 */
function kpcCalc({ netLoan, propertyValue, existingDebt = 0 }) {
  const { rate, brokerPct, legals, netLtvCap, grossLtvCap, minLoan, maxLoan, term } = KPC_CONFIG;

  if (netLoan < minLoan || netLoan > maxLoan) return null;

  const broker      = netLoan * brokerPct;
  const subTotal    = netLoan + broker + legals;
  const monthlyInt  = subTotal * rate;
  const interestTm  = monthlyInt * term;
  const facilityFee = interestTm - legals;
  const gross       = netLoan + interestTm + facilityFee + broker + legals;

  // Dual LTV hard stops
  const netLtv  = (netLoan  + existingDebt) / propertyValue;
  const grossLtv = (gross   + existingDebt) / propertyValue;

  if (netLtv > netLtvCap || grossLtv > grossLtvCap) return null;

  const factorRate = gross / netLoan;

  return {
    lender:        'KPC',
    product:       'Speed Loan',
    regulation:    'Unregulated',
    ratePmPct:     '2.5% (5.0% headline)',
    ratePm:        rate,
    termMonths:    term,
    netLoan:       round2(netLoan),
    grossRepayable: round2(gross),
    netLtv:        round4(netLtv),
    netLtvPct:     pct(netLtv, 1),
    grossLtv:      round4(grossLtv),
    grossLtvPct:   pct(grossLtv, 1),
    legalFee:      legals,
    facilityFee:   round2(facilityFee),
    interestTerm:  round2(interestTm),
    factorRate:    round4(factorRate),
    fundingDays:   KPC_CONFIG.fundingDays,
    recommended:   false,
    _posfin: {
      brokerFee: round2(broker),  // 12% — NOT disclosed to borrower
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTING & RECOMMENDATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Main entry point: route an input brief to eligible lenders and apply
 * the recommendation badge (exactly ONE product gets recommended=true).
 *
 * Routing rules:
 *   1. regulated=true         → MT Finance only (Somo is unregulated only)
 *   2. timeframe=asap OR net ≤ £100K → Speed Loan preferred (if LTV qualifies)
 *   3. LTV > 65% OR 2nd charge → Somo preferred
 *   4. LTV ≤ 65%, clean, unregulated → MT Finance preferred (lower admin fee)
 *   5. Fallback → lowest factor rate wins
 *
 * @param {object} input - Request body from POST /api/quote/main-loan
 * @returns {Array<object>} - Array of product objects, each with recommended boolean
 */
function routeAndQuote(input) {
  const {
    property_value,
    first_mortgage_clean   = 0,
    first_mortgage_arrears = 0,
    other_charges_amount   = 0,
    loan_amount_requested,
    loan_amount_basis      = 'net',
    charge_position        = '1st',
    regulated              = false,
    timeframe              = '2_weeks',
    term_months            = 12,
    credit_tier            = 'standard',  // 'prime' | 'standard' | 'val_only'
  } = input;

  // Three-tier rate override (Byron 26 Apr 2026, clarified same day)
  // prime:    0.85% FLAT — NOT LTV-gated. Requires: excellent credit + clean tax history + well-defined evidenced exit
  //           Up to 70% LTV is fine. Byron confirmed: 0.85% is achievable at any LTV with the right profile.
  // standard: use lender rate cards as-is (LTV-tiered Somo / flat MT Finance)
  // val_only: force 1.10%/month — equity-only, low/bad credit, self-declared exit, no evidence required
  const PRIME_RATE    = 0.0085;
  const VAL_ONLY_RATE = 0.0110;
  const creditTierRateOverride = {
    somo: credit_tier === 'val_only' ? VAL_ONLY_RATE : (credit_tier === 'prime' ? PRIME_RATE : null),
    mt:   credit_tier === 'val_only' ? VAL_ONLY_RATE : (credit_tier === 'prime' ? PRIME_RATE : null),
  };

  if (!property_value || property_value <= 0) throw new Error('property_value required and must be > 0');
  if (!loan_amount_requested || loan_amount_requested <= 0) throw new Error('loan_amount_requested required and must be > 0');

  const existingDebt  = first_mortgage_clean + first_mortgage_arrears + other_charges_amount;
  const isNetBasis    = loan_amount_basis === 'net';
  const isSecondCharge = charge_position === '2nd';
  const wantsAsap     = timeframe === 'asap';

  // Normalise to net loan for routing decisions (gross → approximate net)
  const netLoan = isNetBasis
    ? loan_amount_requested
    : loan_amount_requested * (1 - MT_CONFIG.arrangementPct - (MT_CONFIG.unregulatedRate * term_months));

  const indicativeLtv = (netLoan + existingDebt) / property_value;

  const products = [];

  // ── 1. KPC Speed Loan ────────────────────────────────────────────────────────
  // Only if unregulated and loan size could be in range
  if (!regulated) {
    // Use net loan for KPC; if gross was given, estimate net (gross ≈ net × 1.2 for KPC)
    const kpcNet = isNetBasis
      ? loan_amount_requested
      : loan_amount_requested / 1.2;  // rough inverse of KPC factor

    if (kpcNet >= KPC_CONFIG.minLoan && kpcNet <= KPC_CONFIG.maxLoan) {
      const kpc = kpcCalc({ netLoan: kpcNet, propertyValue: property_value, existingDebt });
      if (kpc) products.push(kpc);
    }
  }

  // ── 2. Somo Main Loan ────────────────────────────────────────────────────────
  if (!regulated) {
    let somoResult = null;
    if (isNetBasis) {
      somoResult = somoFromNet({
        netTarget:     loan_amount_requested,
        termMonths:    term_months,
        propertyValue: property_value,
        existingDebt,
        regulated,
        rateOverride:  creditTierRateOverride.somo,
      });
    } else {
      somoResult = somoCalc({
        grossLoan:     loan_amount_requested,
        termMonths:    term_months,
        propertyValue: property_value,
        existingDebt,
        regulated,
        rateOverride:  creditTierRateOverride.somo,
      });
    }
    if (somoResult) products.push(somoResult);
  }

  // ── 3. MT Finance ────────────────────────────────────────────────────────────
  {
    let mtResult = null;
    if (isNetBasis) {
      mtResult = mtCalc({
        netLoan:       loan_amount_requested,
        termMonths:    term_months,
        propertyValue: property_value,
        existingDebt,
        regulated,
        rateOverride:  creditTierRateOverride.mt,
      });
    } else {
      // Gross basis: reverse to net using MT formula
      const rate   = creditTierRateOverride.mt
        ?? (regulated ? MT_CONFIG.regulatedRate : MT_CONFIG.unregulatedRate);
      const arrangePct = regulated
        ? MT_CONFIG.regulatedArrangementPct
        : MT_CONFIG.unregulatedArrangementPct;
      const denom  = 1 - arrangePct - (rate * term_months);
      const estNet = loan_amount_requested * denom;
      mtResult = mtCalc({
        netLoan:       estNet,
        termMonths:    term_months,
        propertyValue: property_value,
        existingDebt,
        regulated,
        rateOverride:  creditTierRateOverride.mt,
      });
    }
    if (mtResult) products.push(mtResult);
  }

  if (products.length === 0) return [];

  // ── Recommendation logic (exactly one badge) ─────────────────────────────────
  let recommendedIdx = -1;

  if (regulated) {
    // MT Finance is the only regulated-capable lender in our panel
    recommendedIdx = products.findIndex(p => p.lender === 'MT Finance');
  } else if (wantsAsap || loan_amount_requested <= KPC_CONFIG.maxLoan) {
    // Fast or small → Speed Loan if we have it
    const i = products.findIndex(p => p.lender === 'KPC');
    if (i >= 0) recommendedIdx = i;
  } else if (indicativeLtv > 0.65 || isSecondCharge) {
    // High LTV or 2nd charge → Somo handles these best
    const i = products.findIndex(p => p.lender === 'Somo');
    if (i >= 0) recommendedIdx = i;
  } else {
    // Low LTV, clean, unregulated → MT Finance (lower admin £295 vs £650)
    const i = products.findIndex(p => p.lender === 'MT Finance');
    if (i >= 0) recommendedIdx = i;
  }

  // Fallback: lowest factor rate
  if (recommendedIdx < 0) {
    let best = Infinity;
    products.forEach((p, i) => {
      if (p.factorRate && p.factorRate < best) { best = p.factorRate; recommendedIdx = i; }
    });
  }

  if (recommendedIdx >= 0) products[recommendedIdx] = { ...products[recommendedIdx], recommended: true };

  return products;
}


// ── Field schema for validation ───────────────────────────────────────────────

const NUMERIC_FIELDS = [
  'property_value',
  'first_mortgage_clean',
  'first_mortgage_arrears',
  'other_charges_amount',
  'loan_amount_requested',
  'term_months',
];

const VALID_BASES        = ['net', 'gross'];
const VALID_POSITIONS    = ['1st', '2nd'];
const VALID_CREDIT_TIERS = ['prime', 'proven_exit', 'standard', 'val_only'];
const VALID_TIMEFRAMES = ['asap', '1_week', '2_weeks', '1_month', 'flexible'];

// ── Handler ───────────────────────────────────────────────────────────────────


const CREDIT_TIER_LABELS = {
  prime:    { label: 'Prime',          displayRate: 'from 0.85%/month', desc: 'Excellent credit · clean tax history · well-defined evidenced exit. LTV up to 70%.' },
  standard: { label: 'Standard',       displayRate: 'from 0.93%/month', desc: 'Typical borrower — indicative rate based on your LTV and deal profile.' },
  val_only: { label: 'Low/Bad Credit', displayRate: 'from 1.10%/month', desc: 'Asset-backed. No exit strategy evidence required. Self-declared exit accepted. No current bankruptcy required.' },
};

export default function handler(req, res) {
  /* CORS must be set before anything else — even on error */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    return _handlerImpl(req, res);
  } catch(e) {
    return res.status(500).json({ error: e.message, type: e.constructor.name, stack: e.stack ? e.stack.split("\n").slice(0,5) : [] });
  }
}
function _handlerImpl(req, res) {
  // CORS — allow Posfin site and local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', allowed: ['POST'] });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== 'object') throw new Error('body must be a JSON object');
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body', detail: e.message });
  }

  // ── Validate required fields ────────────────────────────────────────────────
  const required = ['property_value', 'loan_amount_requested'];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }
  }

  // ── Validate numeric fields ─────────────────────────────────────────────────
  for (const field of NUMERIC_FIELDS) {
    if (body[field] !== undefined) {
      const val = Number(body[field]);
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ error: `${field} must be a non-negative number` });
      }
      body[field] = val;
    }
  }

  if (body.property_value <= 0) {
    return res.status(400).json({ error: 'property_value must be greater than 0' });
  }
  if (body.loan_amount_requested <= 0) {
    return res.status(400).json({ error: 'loan_amount_requested must be greater than 0' });
  }

  // ── Validate enum fields ────────────────────────────────────────────────────
  if (body.loan_amount_basis && !VALID_BASES.includes(body.loan_amount_basis)) {
    return res.status(400).json({
      error: `loan_amount_basis must be one of: ${VALID_BASES.join(', ')}`,
    });
  }
  if (body.charge_position && !VALID_POSITIONS.includes(body.charge_position)) {
    return res.status(400).json({
      error: `charge_position must be one of: ${VALID_POSITIONS.join(', ')}`,
    });
  }
  if (body.timeframe && !VALID_TIMEFRAMES.includes(body.timeframe)) {
    return res.status(400).json({
      error: `timeframe must be one of: ${VALID_TIMEFRAMES.join(', ')}`,
    });
  }
  if (body.credit_tier && !VALID_CREDIT_TIERS.includes(body.credit_tier)) {
    return res.status(400).json({
      error: `credit_tier must be one of: ${VALID_CREDIT_TIERS.join(', ')}`,
    });
  }

  // ── term_months range check ─────────────────────────────────────────────────
  const term = body.term_months ?? 12;
  if (term < 3 || term > 12) {
    return res.status(400).json({ error: 'term_months must be between 3 and 12' });
  }
  body.term_months = term;

  // ── Run calculator ──────────────────────────────────────────────────────────
  let products;
  try {
    products = routeAndQuote(body);
  } catch (err) {
    console.error('[main-loan] Calculation error:', err.message);
    return res.status(500).json({ error: 'Calculation error', detail: err.message });
  }

  // ── Strip internal Posfin revenue data from response ───────────────────────
  // _posfin and _lenderLegal fields are for internal use only — never expose to borrowers
  // eslint-disable-next-line no-unused-vars
  const publicProducts = products.map(({ _posfin: _i, _lenderLegal: _ll, ...pub }) => pub);

  // ── Assemble summary ────────────────────────────────────────────────────────
  const existingDebt =
    (body.first_mortgage_clean   || 0) +
    (body.first_mortgage_arrears || 0) +
    (body.other_charges_amount   || 0);

  const indicativeLtv = (body.loan_amount_requested + existingDebt) / body.property_value;
  /* Map proven_exit (Step 5 UI tier name) → prime (internal API tier name) */
  const activeTier    = (body.credit_tier === 'proven_exit') ? 'prime' : (body.credit_tier || 'standard');

  return res.status(200).json({
    status:   'ok',
    summary: {
      property_value:           body.property_value,
      existing_debt:            existingDebt,
      loan_amount_requested:    body.loan_amount_requested,
      loan_amount_basis:        body.loan_amount_basis  || 'net',
      charge_position:          body.charge_position    || '1st',
      regulated:                body.regulated          || false,
      timeframe:                body.timeframe          || '2_weeks',
      term_months:              body.term_months,
      indicative_ltv_pct:       `${(indicativeLtv * 100).toFixed(1)}%`,
      credit_tier:              activeTier,
      credit_tier_label:        CREDIT_TIER_LABELS[activeTier]?.label,
      credit_tier_desc:         CREDIT_TIER_LABELS[activeTier]?.desc,
      credit_tier_display_rate: CREDIT_TIER_LABELS[activeTier]?.displayRate,
    },
    products:       publicProducts,
    products_found: publicProducts.length,
    recommended:    publicProducts.find(p => p.recommended)?.lender ?? null,
    credit_tiers: [
      { tier: 'prime',    label: 'Prime',    displayRate: 'from 0.85%/month', desc: 'Excellent credit · clean tax history · well-defined evidenced exit. LTV up to 70%.' },
      { tier: 'standard', label: 'Standard', displayRate: 'from 0.93%/month', desc: 'Typical borrower — indicative rate based on your LTV and deal profile.' },
      { tier: 'val_only', label: 'Low/Bad Credit', displayRate: 'from 1.10%/month', desc: 'Asset-backed. No exit strategy evidence required. Self-declared exit accepted. No current bankruptcy required.' },
    ],
    caveat:       'Indicative figures only. Subject to valuation, full credit underwrite, and lender confirmation. Not a commitment to lend.',
    generated_at: new Date().toISOString(),
  });
}
