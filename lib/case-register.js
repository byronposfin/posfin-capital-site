// Server-side read of pipeline.case_register through the signed-in staff session.
// Preview keeps the TEST fixtures. Production never uses a service-role key and
// never substitutes fixtures when the session or the RPC fails.

import { PRODUCTS, STAGE_CHECK } from './el-lor-config.js';
import { ownerSeat } from './staff-seats.js';
import { staffSupabaseUrl } from './staff-auth.js';

export function caseSource(env = process.env) {
  const set = String(env.STAFF_CASE_SOURCE || '').trim().toLowerCase();
  if (set === 'supabase' || set === 'fixtures') return set;
  if (env.VERCEL_ENV === 'production') return 'supabase';
  return 'fixtures';
}

function flagsOf(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean).slice(0, 12);
  if (value && typeof value === 'object') return Object.keys(value).filter((key) => value[key]).slice(0, 12);
  return [];
}

function refsOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function moneyOf(refs) {
  const gross = Number(refs.gross);
  const retentions = Number(refs.retentions);
  const net = Number(refs.net_release);
  return {
    gross: Number.isFinite(gross) ? gross : 0,
    retentions: Number.isFinite(retentions) ? retentions : 0,
    net_release: Number.isFinite(net) ? net : 0,
    fee_confirmed: false,
  };
}

export function mapRegisterRow(row) {
  const caseRef = String(row && row.case_ref || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(caseRef)) return null;
  const seat = ownerSeat(row.owner);
  const refs = refsOf(row.external_refs);
  const product = PRODUCTS.includes(row.product) ? row.product : 'SOMO';
  const dbStage = STAGE_CHECK.includes(row.stage) ? row.stage : 'application';
  const flags = flagsOf(row.case_flags);
  if (!PRODUCTS.includes(row.product)) flags.push('product_unconfirmed');
  const borrowerEmail = String(row.email || '').trim();
  const label = String(row.case_label || caseRef).slice(0, 120);
  return {
    case_ref: caseRef,
    is_test: caseRef.startsWith('TEST-'),
    label,
    stage: String(row.stage || dbStage).slice(0, 64),
    db_stage: dbStage,
    owner: seat ? seat.name : 'Unassigned',
    seat_code: seat ? seat.code : '',
    seat_email: seat && seat.verified ? seat.email : '',
    product,
    email: borrowerEmail,
    postcode: String(row.postcode || '').slice(0, 16),
    broka_case_id: row.broka_case_id || refs.broka_case_id || null,
    flags,
    lender_exclusions: [],
    eligible_lenders: [],
    signatories: [{ name: label || 'Borrower', email: borrowerEmail, role: 'borrower' }],
    money: moneyOf(refs),
    el: { state: 'none' },
    lor: { state: 'none' },
    fact_find_submitted: ['factfind', 'packaging', 'application', 'terms_issued', 'terms_received'].includes(dbStage),
    opened_at: '',
  };
}

export function mapRegisterRows(rows) {
  const cases = [];
  let skipped = 0;
  for (const row of rows || []) {
    const mapped = mapRegisterRow(row);
    if (mapped) cases.push(mapped);
    else skipped += 1;
  }
  return { cases, skipped };
}

async function readJson(response) {
  if (typeof response.text === 'function') {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (typeof response.json === 'function') return response.json();
  return null;
}

export async function loadCaseRegister(env = process.env, fetchImpl = fetch, accessToken = '') {
  if (caseSource(env) !== 'supabase') {
    return { ok: false, cases: [], warning: 'Preview uses TEST fixtures.' };
  }
  const url = staffSupabaseUrl({ ...env, STAFF_AUTH_MODE: env.STAFF_AUTH_MODE || 'supabase' });
  const key = String(env.STAFF_SUPABASE_ANON_KEY || '').trim();
  const token = String(accessToken || '').trim();
  if (!url || !key || !token) {
    return { ok: false, cases: [], warning: 'A signed-in staff session is required. TEST fixtures were not substituted.' };
  }
  const response = await fetchImpl(`${url}/rest/v1/rpc/staff_case_register`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Profile': 'pipeline',
      'Content-Profile': 'pipeline',
    },
    body: '{}',
  });
  if (!response.ok) {
    return { ok: false, cases: [], warning: 'The case register could not be read. TEST fixtures were not substituted.' };
  }
  const rows = await readJson(response);
  const mapped = mapRegisterRows(Array.isArray(rows) ? rows : []);
  const warning = mapped.skipped ? `${mapped.skipped} register rows had no case reference and were left off the desk.` : '';
  return { ok: true, cases: mapped.cases, warning, source: 'register' };
}
