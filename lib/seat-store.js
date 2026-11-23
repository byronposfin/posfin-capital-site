import { fixtureBook } from './seat-view.js';
import { staffAuthMode, staffSupabaseUrl } from './staff-auth.js';

const memory = globalThis.__posfinSeatMemory || { store: null };
globalThis.__posfinSeatMemory = memory;

const MIGRATION = 'migration_20261122';
const FEE_KEY = /fee|procuration|commission|gross_facility|net_loan|valuation|gdv|ltv/i;
const CASE_FIELDS = [
  'id', 'case_ref', 'case_label', 'stage', 'status', 'owner', 'owner_label', 'case_owner_label',
  'next_action_summary', 'seed_source', 'origin_source', 'created_at', 'existing_lender_label',
];
const RAW_SELECTS = [
  'id,full_name,email,source,status,stage,created_at,fb_created_time,assigned_to',
  'id,full_name,email,source,status,created_at,assigned_to',
  'id,full_name,email,source,status,created_at',
];
const FACT_SELECTS = [
  'id,reference,full_name,email,source,status,form_stage,form_step,submitted_at,created_at,assigned_seat,next_action,is_test',
  'id,reference,full_name,email,source,status,form_stage,submitted_at,created_at,assigned_seat,next_action,is_test',
  'id,full_name,email,source,status,created_at',
];

function production(env) {
  return String(env.VERCEL_ENV || '').toLowerCase() === 'production';
}

export function dataMode(env = process.env) {
  if (production(env)) return staffAuthMode(env) === 'supabase' ? 'session' : 'unavailable';
  if (env.SEAT_VIEW_SOURCE === 'fixtures') return 'fixtures';
  if (staffAuthMode(env) === 'supabase') return 'session';
  return 'fixtures';
}

export function createSeatStore(seed = []) {
  const rows = new Map();
  function put(row) {
    if (!row?.id) return;
    rows.set(row.id, { ...row });
  }
  for (const row of seed) put(row);
  return {
    list() {
      return [...rows.values()];
    },
    save(row) {
      put(row);
      return rows.get(row.id);
    },
    load(list) {
      rows.clear();
      for (const row of list || []) put(row);
    },
  };
}

export function sharedSeatStore() {
  if (!memory.store) memory.store = createSeatStore();
  return memory.store;
}

export function resetSharedSeatStore() {
  memory.store = null;
}

function anonKey(env) {
  return String(env.STAFF_SUPABASE_ANON_KEY || '').trim();
}

function userHeaders(key, token, profile) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (profile) headers['Accept-Profile'] = profile;
  return headers;
}

async function readBody(response) {
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

async function requestJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, {
    ...options,
    signal: AbortSignal.timeout(8000),
  });
  return { ok: response.ok, status: response.status, body: await readBody(response) };
}

function publicRegisterRow(row) {
  const out = {};
  for (const key of CASE_FIELDS) {
    if (!row || !Object.prototype.hasOwnProperty.call(row, key)) continue;
    if (FEE_KEY.test(key)) continue;
    out[key] = row[key];
  }
  if (!out.owner_label && row && row.owner != null) out.owner_label = row.owner;
  return out;
}

function migrationCases(rows) {
  const clean = (rows || []).map(publicRegisterRow).filter((row) => row.case_ref);
  const known = clean.filter((row) => String(row.seed_source || '') !== '');
  if (!known.length) return { cases: clean, unscoped: clean.length > 0 };
  return {
    cases: clean.filter((row) => row.seed_source === MIGRATION),
    unscoped: false,
  };
}

async function readRows(cfg, token, profile, path, selects, fetchImpl) {
  let last = { ok: false, status: 0, rows: [] };
  for (const select of selects) {
    const result = await requestJson(
      fetchImpl,
      `${cfg.url}/rest/v1/${path}?select=${select}&order=created_at.desc&limit=2000`,
      { method: 'GET', headers: userHeaders(cfg.key, token, profile) },
    );
    if (result.ok && Array.isArray(result.body)) return { ok: true, status: result.status, rows: result.body };
    last = { ok: false, status: result.status, rows: [] };
    if (result.status !== 400) break;
  }
  return last;
}

async function readRegister(cfg, token, fetchImpl) {
  const profiles = ['pipeline', ''];
  let last = { ok: false, status: 0, rows: [] };
  for (const profile of profiles) {
    const headers = {
      ...userHeaders(cfg.key, token, profile),
      'Content-Type': 'application/json',
    };
    if (profile) headers['Content-Profile'] = profile;
    const result = await requestJson(fetchImpl, `${cfg.url}/rest/v1/rpc/staff_case_register`, {
      method: 'POST',
      headers,
      body: '{}',
    });
    if (result.ok && Array.isArray(result.body)) return { ok: true, status: result.status, rows: result.body };
    last = { ok: false, status: result.status, rows: [] };
    if (result.status !== 404) break;
  }
  return last;
}

async function readLeads(cfg, token, fetchImpl) {
  const raw = await readRows(cfg, token, '', 'leads', RAW_SELECTS, fetchImpl);
  const facts = await readRows(cfg, token, 'pipeline', 'web_leads', FACT_SELECTS, fetchImpl);
  return {
    ok: raw.ok || facts.ok,
    rawOk: raw.ok,
    factsOk: facts.ok,
    rawLeads: raw.rows,
    factFinds: facts.rows,
  };
}

function fixtureResult(env) {
  const onPreview = env.VERCEL_ENV === 'preview' && env.SEAT_VIEW_SOURCE !== 'fixtures';
  return {
    ...fixtureBook(),
    source: 'fixtures',
    leadsAvailable: true,
    casesAvailable: true,
    warning: onPreview ? 'Individual staff sign-in is not switched on, so these cards are samples.' : '',
  };
}

function unavailable(warning) {
  return {
    rawLeads: [],
    factFinds: [],
    cases: [],
    source: 'unavailable',
    leadsAvailable: false,
    casesAvailable: false,
    warning,
  };
}

export async function loadBook(env = process.env, deps = {}) {
  const mode = dataMode(env);
  if (mode === 'fixtures') {
    if (deps.book) {
      return {
        leadsAvailable: true,
        casesAvailable: true,
        ...deps.book,
        source: deps.book.source || 'fixtures',
        warning: deps.book.warning || '',
      };
    }
    return fixtureResult(env);
  }
  if (mode !== 'session') {
    return unavailable('Individual staff sign-in is required. Sample cards are not shown.');
  }
  const token = String(deps.accessToken || '').trim();
  const url = staffSupabaseUrl(env);
  const key = anonKey(env);
  if (!url || !key || !token) {
    return unavailable('A signed-in staff session is required. Sample cards were not substituted.');
  }
  const fetchImpl = deps.fetch || globalThis.fetch;
  try {
    const cfg = { url, key };
    const casesResult = await readRegister(cfg, token, fetchImpl);
    if (!casesResult.ok) {
      return unavailable('The case register could not be read with this sign-in. Sample cards were not substituted.');
    }
    const leads = await readLeads(cfg, token, fetchImpl);
    const scoped = migrationCases(casesResult.rows);
    const notes = [];
    if (!leads.ok) notes.push('Leads are not available on this sign-in yet. Sample leads are not shown.');
    else if (!leads.factsOk) notes.push('Fact finds are not available on this sign-in yet.');
    else if (!leads.rawOk) notes.push('The raw lead list is not available on this sign-in yet.');
    if (scoped.unscoped) notes.push('The register did not include a seed source, so every case returned for this sign-in is shown.');
    return {
      rawLeads: leads.rawLeads,
      factFinds: leads.factFinds,
      cases: scoped.cases,
      source: 'live',
      leadsAvailable: leads.ok,
      casesAvailable: true,
      warning: notes.join(' '),
    };
  } catch {
    return unavailable('The case register could not be read with this sign-in. Sample cards were not substituted.');
  }
}

export function answerFromRow(row) {
  return {
    id: `${row.seat_code}:${row.subject_kind}:${row.subject_id}:${String(row.task_date).slice(0, 10)}`,
    seat: row.seat_code,
    kind: row.subject_kind,
    subjectId: row.subject_id,
    taskDate: String(row.task_date).slice(0, 10),
    prompt: row.prompt || '',
    answer: row.answer || '',
    editedText: row.edited_text || '',
    answeredBy: row.answered_by || '',
    at: row.answered_at || '',
  };
}

function localAnswers(store, seat, today) {
  return store.list().filter((row) => row.seat === seat && row.taskDate === today);
}

export async function loadAnswers(env, seat, today, deps = {}) {
  const store = deps.store || createSeatStore();
  if (dataMode(env) !== 'session') return { answers: localAnswers(store, seat, today), schemaPending: false };
  const token = String(deps.accessToken || '').trim();
  const url = staffSupabaseUrl(env);
  const key = anonKey(env);
  if (!url || !key || !token) return { answers: localAnswers(store, seat, today), schemaPending: true };
  const fetchImpl = deps.fetch || globalThis.fetch;
  try {
    const result = await requestJson(
      fetchImpl,
      `${url}/rest/v1/seat_task_answers?select=seat_code,subject_kind,subject_id,task_date,prompt,answer,edited_text,answered_by,answered_at&seat_code=eq.${encodeURIComponent(seat)}&task_date=eq.${encodeURIComponent(today)}`,
      { method: 'GET', headers: userHeaders(key, token, 'pipeline') },
    );
    if (result.ok && Array.isArray(result.body)) return { answers: result.body.map(answerFromRow), schemaPending: false };
    return { answers: localAnswers(store, seat, today), schemaPending: true };
  } catch {
    return { answers: localAnswers(store, seat, today), schemaPending: true };
  }
}

export async function saveAnswer(env, row, deps = {}) {
  const store = deps.store;
  if (store) store.save(row);
  if (dataMode(env) !== 'session') return { ok: true, stored: 'session', schemaPending: false };
  const token = String(deps.accessToken || '').trim();
  const url = staffSupabaseUrl(env);
  const key = anonKey(env);
  if (!url || !key || !token) return { ok: true, stored: 'session', schemaPending: true };
  const fetchImpl = deps.fetch || globalThis.fetch;
  try {
    const headers = {
      ...userHeaders(key, token, 'pipeline'),
      'Content-Type': 'application/json',
      'Content-Profile': 'pipeline',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    };
    const result = await requestJson(
      fetchImpl,
      `${url}/rest/v1/seat_task_answers?on_conflict=seat_code,subject_kind,subject_id,task_date`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          seat_code: row.seat,
          subject_kind: row.kind,
          subject_id: row.subjectId,
          task_date: row.taskDate,
          prompt: row.prompt,
          answer: row.answer,
          edited_text: row.editedText || '',
          answered_by: row.answeredBy || '',
          answered_at: row.at,
        }),
      },
    );
    if (result.ok) return { ok: true, stored: 'supabase', schemaPending: false };
    return { ok: true, stored: 'session', schemaPending: true };
  } catch {
    return { ok: true, stored: 'session', schemaPending: true };
  }
}
