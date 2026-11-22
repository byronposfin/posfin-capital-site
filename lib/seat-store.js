import { fixtureBook } from './seat-view.js';

const MAIN = 'https://vgflcrfaudrvrdmxjdtl.supabase.co';

const memory = globalThis.__posfinSeatMemory || { store: null };
globalThis.__posfinSeatMemory = memory;

export function seatConfig(env = process.env) {
  const url = String(env.PIPELINE_SUPABASE_URL || env.FF_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = String(env.FF_ALERT_SERVICE_KEY || env.PIPELINE_SUPABASE_KEY || env.FF_SUPABASE_KEY || '').trim();
  return { url, key, main: url === MAIN };
}

export function dataMode(env = process.env) {
  if (env.SEAT_VIEW_SOURCE === 'fixtures') return 'fixtures';
  if (String(env.VERCEL_ENV || '').toLowerCase() === 'production') return 'closed';
  const cfg = seatConfig(env);
  const asked = env.VERCEL_ENV === 'preview' || env.SEAT_VIEW_SOURCE === 'supabase' || env.COCKPIT_SOURCE === 'supabase';
  if (asked && cfg.main && cfg.key) return 'live';
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

function headers(key, profile) {
  const out = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };
  if (profile) out['Accept-Profile'] = profile;
  return out;
}

async function restGet(cfg, path, profile, fetchImpl) {
  const response = await fetchImpl(`${cfg.url}/rest/v1/${path}`, {
    method: 'GET',
    headers: headers(cfg.key, profile),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) {
    const error = new Error('read_failed');
    error.status = response.status;
    throw error;
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

export async function loadBook(env = process.env, deps = {}) {
  if (deps.book) return { ...deps.book, source: deps.book.source || 'fixtures', warning: deps.book.warning || '' };
  if (dataMode(env) === 'closed') {
    return {
      rawLeads: [],
      factFinds: [],
      cases: [],
      source: 'closed',
      warning: 'This seat is not available in production.',
    };
  }
  if (dataMode(env) !== 'live') {
    const onPreview = env.VERCEL_ENV === 'preview' && env.SEAT_VIEW_SOURCE !== 'fixtures';
    return {
      ...fixtureBook(),
      source: 'fixtures',
      warning: onPreview ? 'This preview is not reading the main project, so these cards are fixtures.' : '',
    };
  }
  const cfg = seatConfig(env);
  const fetchImpl = deps.fetch || globalThis.fetch;
  try {
    const [rawLeads, factFinds, cases] = await Promise.all([
      restGet(cfg, 'leads?select=id,full_name,email,source,status,stage,created_at,fb_created_time,assigned_to&order=created_at.desc&limit=2000', '', fetchImpl),
      restGet(cfg, 'web_leads?select=id,reference,full_name,email,source,status,form_stage,form_step,submitted_at,created_at,assigned_seat,next_action,is_test&order=created_at.desc&limit=2000', 'pipeline', fetchImpl),
      restGet(cfg, 'case_register?select=id,case_ref,case_label,stage,status,owner_label,case_owner_label,next_action_summary,seed_source,origin_source,created_at,existing_lender_label&seed_source=eq.migration_20261122&order=created_at.desc&limit=200', 'pipeline', fetchImpl),
    ]);
    return { rawLeads, factFinds, cases, source: 'live', warning: '' };
  } catch {
    return {
      rawLeads: [],
      factFinds: [],
      cases: [],
      source: 'unavailable',
      warning: 'The main project could not be read. Nothing was substituted.',
    };
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

export async function loadAnswers(env, seat, today, deps = {}) {
  const store = deps.store || createSeatStore();
  if (dataMode(env) !== 'live') return { answers: store.list().filter((row) => row.seat === seat && row.taskDate === today), schemaPending: false };
  const cfg = seatConfig(env);
  const fetchImpl = deps.fetch || globalThis.fetch;
  try {
    const rows = await restGet(
      cfg,
      `seat_task_answers?select=seat_code,subject_kind,subject_id,task_date,prompt,answer,edited_text,answered_by,answered_at&seat_code=eq.${encodeURIComponent(seat)}&task_date=eq.${today}`,
      'pipeline',
      fetchImpl,
    );
    return { answers: rows.map(answerFromRow), schemaPending: false };
  } catch (error) {
    const missing = error.status === 404 || error.status === 400 || error.status === 406;
    return {
      answers: store.list().filter((row) => row.seat === seat && row.taskDate === today),
      schemaPending: missing,
    };
  }
}

export async function saveAnswer(env, row, deps = {}) {
  const store = deps.store;
  if (store) store.save(row);
  if (dataMode(env) !== 'live') return { ok: true, stored: 'session', schemaPending: false };
  const cfg = seatConfig(env);
  const fetchImpl = deps.fetch || globalThis.fetch;
  try {
    const response = await fetchImpl(`${cfg.url}/rest/v1/seat_task_answers?on_conflict=seat_code,subject_kind,subject_id,task_date`, {
      method: 'POST',
      headers: {
        ...headers(cfg.key, 'pipeline'),
        'Content-Type': 'application/json',
        'Content-Profile': 'pipeline',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
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
      signal: AbortSignal.timeout(4000),
    });
    if (response.ok) return { ok: true, stored: 'supabase', schemaPending: false };
    const missing = response.status === 404 || response.status === 400 || response.status === 406;
    return { ok: true, stored: 'session', schemaPending: missing, error: missing ? '' : 'store' };
  } catch {
    return { ok: true, stored: 'session', schemaPending: true };
  }
}
