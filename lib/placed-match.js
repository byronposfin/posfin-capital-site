import { loadPlacedLenders } from './placed-lenders.js';

export function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

// Y / Yes / both / Y and N can consider a regulated enquiry.
// N / No cannot. Empty is unknown. The old check only looked for "N" and let "No" through.
export function normaliseRegulated(value) {
  if (value == null) return null;
  const text = String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return null;
  if (text === 'n' || text === 'no') return 'N';
  if (text === 'y' || text === 'yes' || text === 'both' || text === 'y and n') return 'Y';
  return null;
}

export function lenderAlias(index) {
  let n = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Lender ${label}`;
}

function productOffered(lender, criteria) {
  if (criteria.product_type === 'development') {
    return lender.development === 'Y' || lender.segment === 'development';
  }
  return lender.segment === criteria.product_type;
}

function limitFor(lender, criteria) {
  if (criteria.product_type === 'development') return lender.max_ltgdv ?? null;
  if (criteria.charge_type === 'second') return lender.max_ltv_second ?? null;
  return lender.max_ltv_first ?? null;
}

function rateOf(lender) {
  const rate = lender.rate_pcm;
  if (rate == null || rate === '') return null;
  const number = Number(rate);
  return Number.isFinite(number) ? number : null;
}

export function matchLenders(criteria, lenders = loadPlacedLenders()) {
  const existing = (criteria.existing_charges || []).reduce((sum, item) => sum + (Number(item.balance) || 0), 0);
  const net = Number(criteria.net_ask) || 0;
  const value = Number(criteria.property_value) || 0;
  const ltvRaw = value ? ((criteria.charge_type === 'second' ? existing + net : net) / value) * 100 : 0;
  const rows = lenders.map((lender) => {
    const block = [];
    const unknown = [];
    const why = [];
    if (!productOffered(lender, criteria)) block.push('product type not offered');
    const charges = lender.charge || '';
    if (!charges) unknown.push('charge type not known');
    else if (criteria.charge_type === 'second') {
      if (!String(charges).includes('second')) block.push('no second-charge product');
    } else if (!String(charges).includes('first')) block.push('second charge only');
    const limit = limitFor(lender, criteria);
    const limitLabel = criteria.charge_type === 'second' ? 'max 2nd-charge LTV not known' : 'max LTV not known';
    if (limit == null) unknown.push(limitLabel);
    else if (ltvRaw > limit) block.push(`LTV ${round2(ltvRaw)}% above ${limit}%`);
    else why.push(`LTV ${round2(ltvRaw)}% within ${limit}%`);
    const loanMin = lender.loan_min == null || lender.loan_min === '' ? null : Number(lender.loan_min);
    const loanMax = lender.loan_max == null || lender.loan_max === '' ? null : Number(lender.loan_max);
    if (loanMin != null && Number.isFinite(loanMin) && net < loanMin) block.push(`below min £${loanMin}`);
    if (loanMax != null && Number.isFinite(loanMax) && net > loanMax) block.push(`above max £${loanMax}`);
    if (loanMin == null && loanMax == null) unknown.push('loan size range not known');
    if (criteria.regulated) {
      const regulated = normaliseRegulated(lender.regulated);
      if (regulated === 'N') block.push('unregulated only');
      else if (regulated == null) unknown.push('regulated appetite not known');
    }
    const tier = block.length ? 'excluded' : unknown.length ? 'unverified' : 'eligible';
    return {
      id: lender.id,
      name: lender.name,
      tier,
      stale: lender.stale === true || String(lender.stale).toLowerCase() === 'true',
      rate_pcm: rateOf(lender),
      limit: limit == null ? null : limit,
      why,
      block,
      unknown,
      source: lender.source || '',
      source_date: lender.source_date || '',
      grade: lender.grade || '',
      valuation: lender.valuation || '',
    };
  });
  const order = { eligible: 0, unverified: 1, excluded: 2 };
  rows.sort((a, b) => order[a.tier] - order[b.tier]
    || (Number(a.stale) - Number(b.stale))
    || ((a.rate_pcm ?? 99) - (b.rate_pcm ?? 99))
    || a.name.localeCompare(b.name));
  const note = criteria.charge_type === 'first'
    ? 'First-charge net ask is taken to already include redemptions.'
    : '';
  const basis = criteria.product_type === 'development'
    ? 'net ask ÷ GDV'
    : (criteria.charge_type === 'second' ? 'cumulative (existing + new) ÷ value' : 'net ask ÷ value');
  return { ltv: round2(ltvRaw), basis, note, rows };
}

export function tierCounts(result) {
  const counts = { eligible: 0, unverified: 0, excluded: 0 };
  for (const row of result.rows) counts[row.tier] += 1;
  return counts;
}

export function knownRates(rows, tier = 'eligible') {
  return rows.filter((row) => row.tier === tier && row.rate_pcm != null);
}
