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

export function loadPlacedLenders() {
  if (cached) return cached;
  const text = readFileSync(new URL('../data/placed/placed_lenders.fixture.csv', import.meta.url), 'utf8');
  cached = lendersFromCsv(text);
  return cached;
}

export function resetPlacedLenderCache() {
  cached = null;
}
