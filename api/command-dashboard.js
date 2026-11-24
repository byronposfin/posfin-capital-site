// One staff entry point for /staff/command and /api/command-dashboard.
// The Supabase service role is used only after the staff session is valid.

import { readCookie, readRaw, redirect, sendHtml, sendJson, setPrivate, writeStaffCookie } from '../lib/case-http.js';
import { endSession, establishSession } from '../lib/cockpit-store.js';
import {
  askLizzy,
  insertThreadMessage,
  loadCommandRows,
  presentDashboard,
  presentFinance,
  readMeetingProgress,
  resolveCommandActor,
  sectionGuard,
  validateThreadPost,
  writeMeetingProgress,
} from '../lib/command-dashboard.js';
import { meetingById, meetingsPayload, normaliseProgress, presentMeeting } from '../lib/meetings.js';
import { renderCommandLogin, renderCommandMessage, renderCommandPage } from '../lib/command-page.js';

function queryOf(req) {
  let fromUrl = {};
  try {
    fromUrl = Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);
  } catch {
    fromUrl = {};
  }
  return { ...fromUrl, ...(req.query || {}) };
}

function wantsPage(req, query) {
  return String(query.view || '').toLowerCase() === 'page' && !String(query.action || '').trim();
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const length = Number(req.headers?.['content-length'] || 0);
  if (length > 30000) {
    const error = new Error('too_large');
    error.code = 'too_large';
    throw error;
  }
  const raw = await readRaw(req, 30000);
  if (!raw) return {};
  const text = raw.toString('utf8');
  const type = String(req.headers?.['content-type'] || '');
  if (type.includes('application/json') || text.trim().startsWith('{')) {
    try {
      return JSON.parse(text || '{}');
    } catch {
      const error = new Error('bad_json');
      error.code = 'bad_json';
      throw error;
    }
  }
  return Object.fromEntries(new URLSearchParams(text));
}

function loginMessage(error) {
  if (error === 'not_configured') return 'Individual sign-in is not configured on this preview.';
  if (error === 'not_allowed') return 'That email is not on the staff list.';
  if (error === 'unavailable' || error === 'schema_pending') return 'Sign-in is temporarily unavailable.';
  if (error === 'email') return 'Enter the work email for your seat.';
  if (error) return 'That email or password was not recognised.';
  return '';
}

function dataError(error) {
  if (error?.code === 'not_configured') return { status: 503, error: 'Command dashboard data is not configured.' };
  if (error?.code === 'schema_pending') return { status: 503, error: 'The command dashboard tables are not available yet.' };
  if (error?.code === 'upstream') return { status: 502, error: 'Ask Lizzy could not answer just now.' };
  return { status: 503, error: 'The command dashboard is temporarily unavailable.' };
}

async function handlePagePost(req, res, deps, env) {
  const fields = await readBody(req);
  const depsEnv = { ...deps, env };
  if (String(fields.action || '') === 'logout') {
    const session = readCookie(req, 'pf_staff');
    if (session) await endSession(session, depsEnv);
    writeStaffCookie(res, req, '', 0);
    return redirect(res, '/staff/command');
  }
  const login = await establishSession({ email: fields.email, password: fields.password }, depsEnv);
  if (!login.ok || login.preview || !String(login.session || '').startsWith('sb1.') || !login.seat) {
    return sendHtml(res, 401, renderCommandLogin(loginMessage(login.error || 'password')));
  }
  writeStaffCookie(res, req, login.session);
  return redirect(res, '/staff/command');
}

async function dashboardFor(actor, env, deps, narrow) {
  const loaded = await loadCommandRows(env, deps.fetch, actor.seat, narrow);
  return presentDashboard({
    seat: actor.seat,
    email: actor.email,
    displayName: actor.displayName,
    rows: loaded.rows,
    thread: loaded.thread,
  });
}

export async function handleCommandDashboard(req, res, deps = {}) {
  setPrivate(res);
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  const env = deps.env || process.env;
  const query = queryOf(req);
  const action = String(query.action || '').trim().toLowerCase();
  const page = wantsPage(req, query);
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }
    if (req.method === 'POST' && page) return handlePagePost(req, res, deps, env);
    if (req.method === 'GET' && page) {
      const actor = await resolveCommandActor(req, { ...deps, env });
      if (!actor.ok) return sendHtml(res, 401, renderCommandLogin(''));
      return sendHtml(res, 200, renderCommandPage(actor));
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      return sendJson(res, 405, { error: 'That action is not available.' });
    }
    const actor = await resolveCommandActor(req, { ...deps, env });
    if (!actor.ok) return sendJson(res, 401, { error: 'Sign in is required.' });

    if (req.method === 'GET' && action === 'meetings') {
      const stored = await readMeetingProgress(env, deps.fetch);
      return sendJson(res, 200, meetingsPayload(stored.rows, { storage: stored.storage, id: query.id }));
    }

    if (req.method === 'GET' && action === 'thread') {
      const loaded = await loadCommandRows(env, deps.fetch, actor.seat, 'thread');
      const view = presentDashboard({
        seat: actor.seat,
        email: actor.email,
        displayName: actor.displayName,
        rows: [],
        thread: loaded.thread,
      });
      return sendJson(res, 200, { ok: true, seat: actor.seat, thread: view.thread });
    }

    if (req.method === 'GET') {
      const guard = sectionGuard(query.section, actor.seat);
      if (!guard.ok) return sendJson(res, 403, { error: 'The P&L and cash flow view is limited to Byron.' });
      const dashboard = await dashboardFor(actor, env, deps, guard.narrow);
      if (guard.narrow === 'finance') {
        return sendJson(res, 200, {
          ok: true,
          seat: actor.seat,
          canViewFinance: true,
          finance: dashboard.finance || presentFinance({}),
        });
      }
      return sendJson(res, 200, dashboard);
    }

    const body = await readBody(req);
    if (action === 'meetings') {
      const meeting = meetingById(body.id || body.meeting_id);
      if (!meeting) return sendJson(res, 404, { error: 'That meeting is not on the agenda.' });
      const progress = normaliseProgress(meeting, body.progress);
      if (!progress.ok) return sendJson(res, 400, { error: progress.error });
      const written = await writeMeetingProgress(env, deps.fetch, {
        meeting_id: meeting.id,
        payload: progress.progress,
        updated_at: new Date().toISOString(),
        updated_by: actor.seat,
      });
      const view = meetingsPayload([], { storage: written.storage });
      return sendJson(res, 200, {
        ok: true,
        storage: written.storage,
        persisted: written.persisted,
        note: view.note,
        meeting: presentMeeting(meeting, progress.progress, {
          updated_at: written.persisted ? new Date().toISOString() : '',
          updated_by: written.persisted ? actor.seat : '',
        }),
      });
    }
    if (action === 'thread') {
      const post = validateThreadPost(body);
      if (!post.ok) return sendJson(res, 400, { error: post.error });
      const message = await insertThreadMessage(env, deps.fetch, {
        seat: actor.seat,
        toAgent: post.to_agent,
        message: post.message,
      });
      return sendJson(res, 201, { ok: true, message });
    }
    if (action === 'ask') {
      if (!String(env.XAI_API_KEY || '').trim()) {
        return sendJson(res, 503, { error: 'Ask Lizzy is awaiting server AI key configuration.' });
      }
      const question = String(body.question || body.message || '').trim();
      if (!question) return sendJson(res, 400, { error: 'Ask a question first.' });
      if (question.length > 2000) return sendJson(res, 400, { error: 'Ask a question of 2,000 characters or fewer.' });
      const dashboard = await dashboardFor(actor, env, deps, '');
      const answer = await askLizzy(question, dashboard, env, deps.fetch || fetch);
      return sendJson(res, 200, { ok: true, answer: answer.answer, model: answer.model });
    }
    return sendJson(res, 400, { error: 'That action is not available.' });
  } catch (error) {
    if (error?.code === 'too_large' || error?.code === 'bad_json') {
      return page
        ? sendHtml(res, 400, renderCommandMessage('Not sent', 'That request could not be read.'))
        : sendJson(res, 400, { error: 'That request could not be read.' });
    }
    console.error('[command-dashboard]', error?.code || 'failed');
    const mapped = dataError(error);
    if (page) return sendHtml(res, mapped.status, renderCommandMessage('Please try again', mapped.error));
    return sendJson(res, mapped.status, { error: mapped.error });
  }
}

export default function handler(req, res) {
  return handleCommandDashboard(req, res, {});
}
