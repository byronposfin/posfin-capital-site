// /api/run-sheet: machine API for Lizzy and Team Lizzy. Bearer RUN_SHEET_API_SECRET.
// POST  {date, items:[{ref, n, case, need, ctx, act, t, urg, due, owner, assignees[], links[], retire?}]}  insert or update cards
// GET   ?date=YYYY-MM-DD&since=ISO&audio=1   read entries (answers, voice notes, items) back
// DELETE ?test=1                             remove rows whose item_ref starts with TEST (test cleanup only)
// Uses the service role key held in the deployment env; never returns or logs it. Sends nothing to anyone.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFields, sendJson, setPrivate } from '../lib/case-http.js';
import { batchClientId, cleanItem, isDailyRef, parisDate } from '../lib/run-sheet.js';

const MAIN = 'https://vgflcrfaudrvrdmxjdtl.supabase.co';

function secretOk(req, env) {
  const want = String(env.RUN_SHEET_API_SECRET || '');
  const got = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (want.length < 32) return false;
  const a = Buffer.from(want); const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

function svc(env) {
  const key = String(env.RUN_SHEET_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const url = String(env.STAFF_SUPABASE_URL || MAIN).replace(/\/+$/, '');
  return { key, url, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': 'pipeline', 'Content-Profile': 'pipeline', 'Content-Type': 'application/json' } };
}

function queryOf(req) {
  try { return { ...Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams), ...(req.query || {}) }; } catch { return req.query || {}; }
}

export async function handleRunSheetApi(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  const fetcher = deps.fetch || fetch;
  if (!secretOk(req, env)) return sendJson(res, 404, { ok: false });
  const s = svc(env);
  if (!s.key) return sendJson(res, 503, { ok: false, error: 'service_key_missing' });
  const q = queryOf(req);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(q.date || '')) ? q.date : parisDate();
  try {
    if (req.method === 'GET') {
      const since = q.since ? new Date(q.since).toISOString() : '1970-01-01T00:00:00Z';
      const cols = q.audio === '1' ? '*' : 'id,sheet_date,item_ref,entry_kind,actor_email,created_at,payload->decision,payload->edit_text,payload->transcript,payload->transcript_status,payload->mime,payload->bytes,item:payload';
      const kinds = q.kinds ? `&entry_kind=in.(${String(q.kinds).replace(/[^a-z,]/g, '')})` : '';
      const r = await fetcher(`${s.url}/rest/v1/run_sheet_entries?select=${cols}&sheet_date=eq.${date}&created_at=gt.${encodeURIComponent(since)}${kinds}&order=created_at.asc&limit=5000`, { headers: s.headers });
      if (!r.ok) return sendJson(res, 502, { ok: false, error: 'store', status: r.status });
      let rows = await r.json();
      if (q.audio !== '1') rows = rows.map((row) => { const out = { ...row }; if (row.entry_kind !== 'item') delete out.item; else { delete out.decision; delete out.edit_text; } if (out.item && out.item.audio_b64) delete out.item.audio_b64; return out; });
      return sendJson(res, 200, { ok: true, date, now: new Date().toISOString(), entries: rows });
    }
    if (req.method === 'POST') {
      const body = await readFields(req);
      const items = Array.isArray(body.items) ? body.items : [];
      const d = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) ? body.date : date;
      const rows = []; const errors = []; const seen = new Set();
      let daily = false;
      for (const raw of items.slice(0, 300)) {
        const c = cleanItem(raw);
        if (!c.ok) { errors.push({ ref: raw && raw.ref, error: c.error }); continue; }
        if (seen.has(c.ref)) { errors.push({ ref: c.ref, error: 'duplicate' }); continue; }
        seen.add(c.ref);
        if (isDailyRef(c.ref)) daily = true;
        const stable = batchClientId(d, c.ref);
        rows.push({
          sheet_date: d,
          item_ref: c.ref,
          entry_kind: c.retire ? 'retire' : 'item',
          payload: c.payload,
          actor_email: String(body.actor || 'lizzy').slice(0, 80),
          client_id: stable || `api-${randomBytes(8).toString('hex')}`,
        });
      }
      let skipped = 0;
      let writing = rows;
      if (daily) {
        const existing = await fetcher(`${s.url}/rest/v1/run_sheet_entries?select=item_ref&sheet_date=eq.${d}&entry_kind=eq.item&item_ref=like.B*&limit=500`, { headers: s.headers });
        if (existing.ok) {
          const have = new Set((await existing.json()).map((row) => row.item_ref));
          writing = rows.filter((row) => {
            if (isDailyRef(row.item_ref) && have.has(row.item_ref)) { skipped += 1; return false; }
            return true;
          });
        }
      }
      if (writing.length) {
        const url = daily ? `${s.url}/rest/v1/run_sheet_entries?on_conflict=client_id` : `${s.url}/rest/v1/run_sheet_entries`;
        const prefer = daily ? 'return=minimal,resolution=ignore-duplicates' : 'return=minimal';
        const r = await fetcher(url, { method: 'POST', headers: { ...s.headers, Prefer: prefer }, body: JSON.stringify(writing) });
        if (!r.ok) return sendJson(res, 502, { ok: false, error: 'store', status: r.status });
      }
      return sendJson(res, 200, { ok: true, date: d, written: writing.length, skipped, idempotent: daily, errors });
    }
    if (req.method === 'DELETE' && q.test === '1') {
      const r = await fetcher(`${s.url}/rest/v1/run_sheet_entries?item_ref=like.TEST*`, { method: 'DELETE', headers: { ...s.headers, Prefer: 'return=representation' } });
      if (!r.ok) return sendJson(res, 502, { ok: false, error: 'store', status: r.status });
      return sendJson(res, 200, { ok: true, deleted: (await r.json()).length });
    }
    return sendJson(res, 405, { ok: false });
  } catch (error) {
    console.error('[run-sheet-api]', error.code || 'failed');
    return sendJson(res, 503, { ok: false, error: 'unavailable' });
  }
}

export default function handler(req, res) {
  return handleRunSheetApi(req, res, {});
}
