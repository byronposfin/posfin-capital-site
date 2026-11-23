// /staff/run-sheet: Byron's one-scroll run sheet inside the staff cockpit.
// Daily task cards + live case cards in one list, priority-ordered. Every Yes/No/Edit and voice note
// is written straight to pipeline.run_sheet_entries with the signed-in seat's own Supabase session.
// Sends nothing to anyone. The full cockpit at /staff/cockpit is unchanged.
import { randomBytes } from 'node:crypto';
import { readCookie, readFields, redirect, sendHtml, sendJson, setPrivate, writeStaffCookie } from '../lib/case-http.js';
import { cockpitMode, establishSession, loadSupabaseBoard, sessionAllows, sharedPreviewStore, endSession } from '../lib/cockpit-store.js';
import { placedSection } from '../lib/cockpit.js';
import { staffActorFromToken, supabaseAccessToken } from '../lib/staff-auth.js';
import { cleanAnswer, foldEntries, forSeat, itemFromCase, parisDate } from '../lib/run-sheet.js';
import { insertEntry, loadEntries, runSheetConfigured, transcribe } from '../lib/run-sheet-store.js';
import { renderRunSheet, renderRunSheetLogin, renderRunSheetMessage } from '../lib/run-sheet-html.js';

const PATH = '/staff/run';
const MAX_AUDIO = 2.5 * 1024 * 1024;

function queryOf(req) {
  try { return { ...Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams), ...(req.query || {}) }; } catch { return req.query || {}; }
}

async function liveCases(session, deps) {
  try {
    const env = deps.env;
    const cards = cockpitMode(env) === 'supabase'
      ? ((await loadSupabaseBoard(session, deps)).cards || [])
      : sharedPreviewStore(env).list();
    return cards.filter((c) => !c.done && ['do_now', 'today'].includes(placedSection(c))).map(itemFromCase);
  } catch {
    return [];
  }
}

async function board(session, access, deps, date, seat) {
  const loaded = await loadEntries(deps.env, access, date, deps);
  const cases = await liveCases(session, deps);
  const folded = forSeat(foldEntries(loaded.ok ? loaded.rows : [], cases), seat);
  return { ...folded, date, seat: seat || '', storeOk: loaded.ok, storeError: loaded.ok ? '' : loaded.error };
}

export async function handleRunSheet(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  const depsEnv = { ...deps, env };
  const query = queryOf(req);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(query.date || '')) ? query.date : parisDate(deps.now ? new Date(deps.now) : new Date());
  try {
    const session = readCookie(req, 'pf_staff');
    if (req.method === 'POST') {
      const type = String(req.headers?.['content-type'] || '');
      const fields = await readFields(req);
      if (!type.includes('application/json')) {
        if (fields.action === 'logout') {
          if (session && await sessionAllows(session, depsEnv)) await endSession(session, depsEnv);
          writeStaffCookie(res, req, '', 0);
          return redirect(res, PATH);
        }
        const login = await establishSession({ email: fields.email, password: fields.password }, depsEnv);
        if (!login.ok) return sendHtml(res, 401, renderRunSheetLogin('That email or password was not recognised.'));
        writeStaffCookie(res, req, login.session);
        return redirect(res, PATH);
      }
      if (!session || !await sessionAllows(session, depsEnv)) return sendJson(res, 401, { ok: false, error: 'signin' });
      const access = supabaseAccessToken(session);
      if (!access || !runSheetConfigured(env)) return sendJson(res, 503, { ok: false, error: 'individual_signin_required' });
      const actor = await staffActorFromToken(access, depsEnv);
      if (!actor.ok) return sendJson(res, 401, { ok: false, error: 'signin' });
      if (['send', 'release', 'notify'].includes(String(fields.action || fields.op || ''))) return sendJson(res, 400, { ok: false, error: 'refused' });
      const sheetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(fields.date || '')) ? fields.date : date;
      if (fields.op === 'voice') {
        const ref = String(fields.ref || '');
        if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(ref)) return sendJson(res, 400, { ok: false, error: 'bad_ref' });
        const mime = String(fields.mime || 'audio/webm').split(';')[0].replace(/[^a-z0-9/.+-]/gi, '').slice(0, 40);
        const b64 = String(fields.audio_b64 || '');
        const buf = Buffer.from(b64, 'base64');
        if (!buf.length || buf.length > MAX_AUDIO) return sendJson(res, 400, { ok: false, error: 'bad_audio' });
        const t = await transcribe(env, buf, mime, depsEnv);
        const saved = await insertEntry(env, access, {
          sheet_date: sheetDate, item_ref: ref, entry_kind: 'voice', actor_email: actor.email,
          client_id: /^[A-Za-z0-9_-]{8,80}$/.test(String(fields.client_id || '')) ? fields.client_id : `v-${randomBytes(8).toString('hex')}`,
          payload: { mime, bytes: buf.length, audio_b64: b64, transcript: t.text || '', transcript_status: t.status },
        }, depsEnv);
        if (!saved.ok) return sendJson(res, saved.error === 'denied' ? 401 : 502, { ok: false, error: saved.error });
        return sendJson(res, 200, { ok: true, id: saved.id, at: saved.at, transcript: t.text || '', transcript_status: t.status });
      }
      const a = cleanAnswer(fields);
      if (!a.ok) return sendJson(res, 400, { ok: false, error: a.error });
      const saved = await insertEntry(env, access, {
        sheet_date: sheetDate, item_ref: a.ref, entry_kind: 'answer', actor_email: actor.email,
        client_id: a.clientId || `a-${randomBytes(8).toString('hex')}`,
        payload: { decision: a.decision, edit_text: a.edit, client_ts: String(fields.client_ts || '').slice(0, 40) },
      }, depsEnv);
      if (!saved.ok) return sendJson(res, saved.error === 'denied' ? 401 : 502, { ok: false, error: saved.error });
      return sendJson(res, 200, { ok: true, id: saved.id, at: saved.at, by: actor.email });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendHtml(res, 405, renderRunSheetMessage('Not available', 'Open the run sheet in a browser.'));
    if (!session || !await sessionAllows(session, depsEnv)) {
      if (query.format === 'json') return sendJson(res, 401, { ok: false, error: 'signin' });
      return sendHtml(res, 401, renderRunSheetLogin(''));
    }
    const access = supabaseAccessToken(session);
    let seat = '';
    if (access) {
      const actor = await staffActorFromToken(access, depsEnv);
      if (!actor.ok) {
        if (query.format === 'json') return sendJson(res, 401, { ok: false, error: 'signin' });
        return sendHtml(res, 401, renderRunSheetLogin(''));
      }
      seat = actor.seat && actor.seat.code || '';
    }
    // Byron may look at another seat's sheet with ?seat=; everyone else sees their own.
    if (seat === 'byron' && /^[a-z]{2,20}$/.test(String(query.seat || ''))) seat = query.seat;
    const model = await board(session, access, depsEnv, date, seat);
    model.canSave = Boolean(access && runSheetConfigured(env));
    if (query.format === 'json') return sendJson(res, 200, { ok: true, ...model });
    return sendHtml(res, 200, renderRunSheet(model));
  } catch (error) {
    console.error('[run-sheet]', error.code || 'run_sheet_failed');
    if (query.format === 'json' || String(req.headers?.['content-type'] || '').includes('json')) return sendJson(res, 503, { ok: false, error: 'unavailable' });
    return sendHtml(res, 503, renderRunSheetMessage('Please try again', 'The run sheet is temporarily unavailable.'));
  }
}

export default function handler(req, res) {
  return handleRunSheet(req, res, {});
}
