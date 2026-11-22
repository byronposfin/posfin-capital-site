import { readFileSync } from 'node:fs';

const NUMERIC = new Set([
  'max_ltv_first', 'max_ltv_second', 'max_ltgdv', 'max_ltc',
  'loan_min', 'loan_max', 'term_max', 'rate_pcm',
]);

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell !== '')) rows.push(row);
  }
  return rows;
}

export function numberOrNull(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function boolOrFalse(value) {
  if (value === true) return true;
  if (value === false) return false;
  return String(value || '').trim().toLowerCase() === 'true';
}

export function normaliseLender(raw) {
  const lender = {};
  for (const [key, value] of Object.entries(raw)) {
    if (NUMERIC.has(key)) lender[key] = numberOrNull(value);
    else if (key === 'stale') lender.stale = boolOrFalse(value);
    else if (key === 'regulated' || key === 'development' || key === 'charge') {
      const text = value == null ? '' : String(value).trim();
      lender[key] = text;
    } else {
      lender[key] = value == null ? '' : String(value).trim();
    }
  }
  lender.id = lender.id || '';
  lender.name = lender.name || '';
  lender.grade = lender.grade || '';
  lender.source = lender.source || '';
  lender.source_date = lender.source_date || '';
  lender.segment = lender.segment || '';
  lender.charge = lender.charge || '';
  lender.regulated = lender.regulated || '';
  lender.development = lender.development || '';
  lender.stale = lender.stale === true;
  return lender;
}

export function lendersFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((cells) => {
    const raw = {};
    headers.forEach((header, index) => {
      raw[header] = cells[index] == null ? '' : cells[index];
    });
    return normaliseLender(raw);
  });
}

let cached = null;

export const PLACED_FIXTURE_CSV = new URL('../data/placed/placed_lenders_v002.csv', import.meta.url);
export const PLACED_FIXTURE_JSON = new URL('../data/placed/placed_lenders.fixture.json', import.meta.url);
export const RESEARCH_TAG = 'website-stated, not lender-confirmed';

export const DETAIL_FIELDS = [
  ['segment', 'Segment', '', ''],
  ['charge', 'Charge', 'charge_src', 'charge_checked'],
  ['regulated', 'Regulated', 'regulated_src', 'regulated_checked'],
  ['development', 'Development', 'development_src', 'development_checked'],
  ['max_ltv_first', 'Maximum first-charge LTV', 'max_ltv_first_src', 'max_ltv_first_checked'],
  ['max_ltv_second', 'Maximum second-charge LTV', 'max_ltv_second_src', 'max_ltv_second_checked'],
  ['max_ltgdv', 'Maximum LTGDV', 'max_ltgdv_src', 'max_ltgdv_checked'],
  ['max_ltc', 'Maximum LTC', 'max_ltc_src', 'max_ltc_checked'],
  ['loan_min', 'Minimum loan', 'loan_min_src', 'loan_min_checked'],
  ['loan_max', 'Maximum loan', 'loan_max_src', 'loan_max_checked'],
  ['term_max', 'Maximum term, months', 'term_max_src', 'term_max_checked'],
  ['rate_pcm', 'Rate, percent per month', 'rate_pcm_src', 'rate_pcm_checked'],
  ['valuation', 'Valuation', 'valuation_src', 'valuation_checked'],
  ['avm_desktop', 'AVM or desktop', 'avm_desktop_src', 'avm_desktop_checked'],
  ['avm_max_ltv', 'AVM maximum LTV', 'avm_max_ltv_src', ''],
  ['in_house_valuer', 'In-house valuer', 'in_house_valuer_src', 'in_house_valuer_checked'],
  ['dual_rep', 'Dual representation', 'dual_rep_src', 'dual_rep_checked'],
  ['build_costs', 'Build costs', 'build_costs_src', 'build_costs_checked'],
  ['dev_terms', 'Development terms', 'dev_terms_src', ''],
  ['lender_website', 'Lender website', 'lender_website', 'enrich_checked'],
];

export function lenderDetail(lender) {
  const tag = String(lender.enrich_status || '').trim() || RESEARCH_TAG;
  return {
    tag,
    note: lender.enrich_note || '',
    guideDate: lender.guide_date || '',
    previousSourceDate: lender.previous_source_date || '',
    rows: DETAIL_FIELDS.map(([key, label, sourceKey, checkedKey]) => {
      const raw = lender[key];
      const value = raw == null || raw === '' ? '' : String(raw);
      const source = sourceKey ? String(lender[sourceKey] || '') : '';
      return {
        key,
        label,
        value,
        source: key === 'lender_website' ? value : source,
        checked: checkedKey ? String(lender[checkedKey] || '') : '',
        tag,
      };
    }),
  };
}

export function loadPlacedLenders() {
  if (cached) return cached;
  const text = readFileSync(PLACED_FIXTURE_CSV, 'utf8');
  cached = lendersFromCsv(text);
  return cached;
}

export function resetPlacedLenderCache() {
  cached = null;
}
