// Reads and writes pipeline.run_sheet_entries with the signed-in staff member's own Supabase session.
// The service role is never used from the site. RLS lets staff read and insert answer/voice rows only.
import { staffSupabaseUrl } from './staff-auth.js';

function anon(env) {
  return String(env.STAFF_SUPABASE_ANON_KEY || '').trim();
}

function headers(env, token, write) {
  const h = {
    apikey: anon(env),
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Accept-Profile': 'pipeline',
  };
  if (write) {
    h['Content-Type'] = 'application/json';
    h['Content-Profile'] = 'pipeline';
    h.Prefer = 'return=representation';
  }
  return h;
}

export function runSheetConfigured(env) {
  return Boolean(staffSupabaseUrl(env) && anon(env));
}

async function readRows(env, token, query, deps) {
  const fetcher = deps.fetch || fetch;
  const url = staffSupabaseUrl(env);
  if (!url || !anon(env) || !token) return { ok: false, error: 'not_configured' };
  const res = await fetcher(`${url}/rest/v1/${query}`, { headers: headers(env, token) });
  if (res.status === 401 || res.status === 403) return { ok: false, error: 'denied' };
  if (!res.ok) return { ok: false, error: 'schema_pending' };
  const rows = await res.json();
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}

export async function loadEarlierEntries(env, token, beforeDate, deps = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(beforeDate || ''))) return { ok: false, error: 'bad_date' };
  const cols = 'id,sheet_date,item_ref,entry_kind,payload,actor_email,created_at';
  return readRows(env, token, `run_sheet_entries?select=${cols}&sheet_date=lt.${encodeURIComponent(beforeDate)}&entry_kind=neq.voice&order=created_at.asc&limit=2000`, deps);
}

// Staff session read of an existing pipeline table. The service role is not used.
export async function loadStaffTable(env, token, query, deps = {}) {
  return readRows(env, token, query, deps);
}

export async function loadEntries(env, token, sheetDate, deps = {}) {
  const fetcher = deps.fetch || fetch;
  const url = staffSupabaseUrl(env);
  if (!url || !anon(env) || !token) return { ok: false, error: 'not_configured' };
  const cols = 'id,item_ref,entry_kind,payload,actor_email,created_at';
  // Voice payloads carry audio; select only the small fields of them.
  const q = `${url}/rest/v1/run_sheet_entries?select=${cols}&sheet_date=eq.${encodeURIComponent(sheetDate)}&entry_kind=neq.voice&order=created_at.asc&limit=2000`;
  const v = `${url}/rest/v1/run_sheet_entries?select=id,item_ref,entry_kind,actor_email,created_at,transcript:payload->>transcript,transcript_status:payload->>transcript_status&sheet_date=eq.${encodeURIComponent(sheetDate)}&entry_kind=eq.voice&order=created_at.asc&limit=500`;
  const [a, b] = await Promise.all([fetcher(q, { headers: headers(env, token) }), fetcher(v, { headers: headers(env, token) })]);
  if (a.status === 401 || a.status === 403) return { ok: false, error: 'denied' };
  if (!a.ok) return { ok: false, error: 'schema_pending' };
  const rows = await a.json();
  const voices = b.ok ? (await b.json()).map((r) => ({ ...r, payload: { transcript: r.transcript, transcript_status: r.transcript_status } })) : [];
  const all = rows.concat(voices).sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
  return { ok: true, rows: all };
}

export async function insertEntry(env, token, row, deps = {}) {
  const fetcher = deps.fetch || fetch;
  const url = staffSupabaseUrl(env);
  if (!url || !anon(env) || !token) return { ok: false, error: 'not_configured' };
  const res = await fetcher(`${url}/rest/v1/run_sheet_entries?on_conflict=client_id`, {
    method: 'POST',
    headers: { ...headers(env, token, true), Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify(row),
  });
  if (res.status === 401 || res.status === 403) return { ok: false, error: 'denied' };
  if (!res.ok) return { ok: false, error: 'store', status: res.status };
  const body = await res.json().catch(() => []);
  const saved = Array.isArray(body) ? body[0] : body;
  return { ok: true, id: saved && saved.id, at: saved && saved.created_at };
}

// Optional server-side transcription. Uses XAI_API_KEY when the deployment has one; never logs it.
export async function transcribe(env, buf, mime, deps = {}) {
  const key = String(env.XAI_API_KEY || '').trim();
  if (!key) return { status: 'no_key' };
  const fetcher = deps.fetch || fetch;
  const ext = /mp4|m4a|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : /wav/.test(mime) ? 'wav' : 'webm';
  const fd = new FormData();
  fd.append('model', 'grok-voice-transcribe-2.0');
  fd.append('language', 'en');
  fd.append('format', 'true');
  fd.append('file', new Blob([buf], { type: mime }), `note.${ext}`);
  try {
    const r = await fetcher('https://api.x.ai/v1/stt', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
    if (!r.ok) return { status: `failed_${r.status}` };
    const j = await r.json();
    return { status: 'done', text: String(j.text || '') };
  } catch {
    return { status: 'failed' };
  }
}
