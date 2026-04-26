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

import { routeAndQuote } from '../../engine/calculator.js';

// ── Field schema for validation ───────────────────────────────────────────────

const NUMERIC_FIELDS = [
  'property_value',
  'first_mortgage_clean',
  'first_mortgage_arrears',
  'other_charges_amount',
  'loan_amount_requested',
  'term_months',
];

const VALID_BASES      = ['net', 'gross'];
const VALID_POSITIONS  = ['1st', '2nd'];
const VALID_TIMEFRAMES = ['asap', '1_week', '2_weeks', '1_month', 'flexible'];

// ── Handler ───────────────────────────────────────────────────────────────────

export default function handler(req, res) {
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
  const activeTier    = body.credit_tier || 'standard';

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
