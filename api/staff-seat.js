import { readCookie, readFields, redirect, sendHtml, setPrivate, writeStaffCookie } from '../lib/case-http.js';
import { endSession, establishSession, sessionAllows } from '../lib/cockpit-store.js';
import { seatViewEnabled } from '../lib/seat-flag.js';
import { renderSeat, renderSeatLogin, renderSeatMessage } from '../lib/seat-html.js';
import { loadAnswers, loadBook, saveAnswer, sharedSeatStore } from '../lib/seat-store.js';
import { supabaseAccessToken } from '../lib/staff-auth.js';
import { presentSeat, recordAnswer, seatByCode } from '../lib/seat-view.js';

function queryOf(req) {
  let fromUrl = {};
  try {
    fromUrl = Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);
  } catch {
    fromUrl = {};
  }
  return { ...fromUrl, ...(req.query || {}) };
}

function storeFor(req, deps) {
  if (deps.store) return deps.store;
  const store = sharedSeatStore();
  if (!store.list().length) {
    const raw = readCookie(req, 'pf_seat_answers');
    if (raw) {
      try { store.load(JSON.parse(raw)); } catch { /* a damaged cookie stays empty */ }
    }
  }
  return store;
}

function writeAnswerCookie(res, req, store) {
  if (!store?.list) return;
  const payload = encodeURIComponent(JSON.stringify(store.list().slice(-40)));
  if (payload.length > 3800) return;
  const secure = req.headers?.['x-forwarded-proto'] === 'https' || !!process.env.VERCEL;
  const bits = [`pf_seat_answers=${payload}`, 'HttpOnly', 'Path=/staff', 'SameSite=Lax', 'Max-Age=604800'];
  if (secure) bits.push('Secure');
  const cookie = bits.join('; ');
  const existing = res.getHeader && res.getHeader('Set-Cookie');
  if (existing) res.setHeader('Set-Cookie', [].concat(existing, cookie));
  else res.setHeader('Set-Cookie', cookie);
}

function accessOf(req, deps) {
  if (deps.accessToken) return String(deps.accessToken);
  return supabaseAccessToken(readCookie(req, 'pf_staff'));
}

function loginMessage(error) {
  if (error === 'not_configured') return 'Individual sign-in is not configured on this preview.';
  if (error === 'not_allowed') return 'That email is not on the staff list.';
  if (error === 'unavailable' || error === 'schema_pending') return 'Sign-in is temporarily unavailable.';
  if (error === 'email') return 'Enter the work email for this seat.';
  if (error) return 'That email or password was not recognised.';
  return '';
}

function locationFor(code, fields, edit) {
  const params = new URLSearchParams();
  if (fields.from) params.set('from', fields.from);
  if (fields.to) params.set('to', fields.to);
  if (fields.source && fields.source !== 'all') params.set('source', fields.source);
  if (edit) params.set('edit', edit);
  const query = params.toString();
  const task = fields.task_id ? `#task-${encodeURIComponent(fields.task_id)}` : '#daily-tasks';
  return `/staff/cockpit/seat/${encodeURIComponent(code)}${query ? `?${query}` : ''}${task}`;
}

export async function handleSeat(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  const query = queryOf(req);
  const code = String(query.seat || '').trim().toLowerCase();
  const seat = seatByCode(code);
  const path = `/staff/cockpit/seat/${encodeURIComponent(code || 'chris')}`;
  try {
    if (!seat) return sendHtml(res, 404, renderSeatMessage('Not on this desk', 'That seat is not on this desk.'));
    if (!seatViewEnabled(env, seat.code)) {
      return sendHtml(res, 404, renderSeatMessage('Switched off', 'This seat is switched off.'));
    }
    const depsEnv = { ...deps, env };
    if (req.method === 'POST') {
      const fields = await readFields(req);
      const action = String(fields.action || '');
      const session = readCookie(req, 'pf_staff');
      if (fields.password && !action) {
        const login = await establishSession({ email: fields.email, password: fields.password }, depsEnv);
        if (!login.ok) return sendHtml(res, 401, renderSeatLogin(loginMessage(login.error), path));
        writeStaffCookie(res, req, login.session);
        return redirect(res, path);
      }
      if (action === 'logout') {
        if (session && await sessionAllows(session, depsEnv)) await endSession(session, depsEnv);
        writeStaffCookie(res, req, '', 0);
        return redirect(res, path);
      }
      if (!session || !await sessionAllows(session, depsEnv)) return sendHtml(res, 401, renderSeatLogin('', path));
      if (action === 'send' || action === 'release' || action === 'notify') {
        return sendHtml(res, 400, renderSeatMessage('Not available', 'This seat does not send messages.'));
      }
      const now = deps.now || new Date().toISOString();
      const store = storeFor(req, deps);
      const accessToken = accessOf(req, deps);
      const book = await loadBook(env, { ...deps, accessToken });
      const saved = await loadAnswers(env, seat.code, presentSeat({ ...book, seat, now, query: fields }).today, { ...deps, store, accessToken });
      const view = presentSeat({
        ...book,
        seat,
        now,
        query: fields,
        answers: saved.answers,
        schemaPending: saved.schemaPending,
      });
      const result = recordAnswer(view.tasks, {
        taskId: fields.task_id,
        action,
        actor: fields.actor,
        editedText: fields.edited_text,
        seat: seat.code,
        now,
      });
      if (!result.ok) {
        const text = result.error === 'refused'
          ? 'This seat does not send messages.'
          : 'That answer was not saved.';
        return sendHtml(res, 400, renderSeatMessage('Not saved', text));
      }
      if (result.editing) return redirect(res, locationFor(seat.code, fields, result.editing));
      const written = await saveAnswer(env, result.row, { ...deps, store, accessToken });
      if (!deps.store) writeAnswerCookie(res, req, store);
      else writeAnswerCookie(res, req, store);
      if (written && written.error) return sendHtml(res, 400, renderSeatMessage('Not saved', 'That answer was not saved.'));
      return redirect(res, locationFor(seat.code, fields, ''));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendHtml(res, 405, renderSeatMessage('Not available', 'Open the seat in a browser.'));
    }
    const session = readCookie(req, 'pf_staff');
    if (!session || !await sessionAllows(session, depsEnv)) return sendHtml(res, 401, renderSeatLogin('', path));
    const now = deps.now || new Date().toISOString();
    const store = storeFor(req, deps);
    const accessToken = accessOf(req, deps);
    const book = await loadBook(env, { ...deps, accessToken });
    const draft = presentSeat({ ...book, seat, now, query });
    const saved = await loadAnswers(env, seat.code, draft.today, { ...deps, store, accessToken });
    const view = presentSeat({
      ...book,
      seat,
      now,
      query,
      answers: saved.answers,
      schemaPending: saved.schemaPending,
    });
    return sendHtml(res, 200, renderSeat(view));
  } catch (error) {
    console.error('[seat]', error.code || 'seat_failed');
    return sendHtml(res, 503, renderSeatMessage('Please try again', 'The seat is temporarily unavailable.'));
  }
}

export default function handler(req, res) {
  return handleSeat(req, res, {});
}
