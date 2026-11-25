// /staff/run-sheet: Byron's one-scroll run sheet inside the staff cockpit.
// Daily task cards + live case cards in one list, priority-ordered. Every Yes/No/Edit and voice note
// is written straight to pipeline.run_sheet_entries with the signed-in seat's own Supabase session.
// The pop-up task page is served only when RUN_SHEET_POPUP=1 and the deployment is not production.
// Sends nothing to anyone. The full cockpit at /staff/cockpit is unchanged when the flag is off.
import { randomBytes } from 'node:crypto';
import { readCookie, readFields, redirect, sendHtml, sendJson, setPrivate, writeStaffCookie } from '../lib/case-http.js';
import { cockpitMode, establishSession, loadSupabaseBoard, sessionAllows, sharedPreviewStore, endSession, saveSupabase } from '../lib/cockpit-store.js';
import { OWNERS, placedSection } from '../lib/cockpit.js';
import { presentDashboard } from '../lib/command-dashboard.js';
import { handleCommandDashboard } from './command-dashboard.js';
import { staffActorFromToken, supabaseAccessToken } from '../lib/staff-auth.js';
import {
  autoNext, buildPopupModel, cleanAnswer, foldEntries, forSeat, isSampleCard, isSampleRef, itemFromCase, meetingItems, parisDate, popupEnabled,
} from '../lib/run-sheet.js';
import { insertEntry, loadEarlierEntries, loadEntries, loadStaffTable, runSheetConfigured, transcribe } from '../lib/run-sheet-store.js';
import { renderPopup, renderRunSheet, renderRunSheetLogin, renderRunSheetMessage } from '../lib/run-sheet-html.js';

const PATH = '/staff/run';
const POPUP_PATH = '/staff/tasks';
const MAX_AUDIO = 2.5 * 1024 * 1024;
const ACTOR = { byron: 'Byron', jess: 'Jess', aadi: 'Aadi', cai: 'Cai', chris: 'Chris Shipton', tom: 'Tom', lizzy: 'Lizzy' };

function queryOf(req) {
  try { return { ...Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams), ...(req.query || {}) }; } catch { return req.query || {}; }
}

function use(deps, name, fallback) {
  return deps[name] || fallback;
}

async function liveCases(session, deps, realSeat) {
  try {
    const env = deps.env;
    const mode = use(deps, 'cockpitMode', cockpitMode)(env);
    if (realSeat && mode !== 'supabase') return [];
    const cards = mode === 'supabase'
      ? (((await use(deps, 'loadSupabaseBoard', loadSupabaseBoard)(session, deps)).cards) || [])
      : use(deps, 'sharedPreviewStore', sharedPreviewStore)(env).list();
    return cards
      .filter((card) => !card.done && ['do_now', 'today'].includes(placedSection(card)))
      .filter((card) => !(realSeat && isSampleCard(card)))
      .map(itemFromCase);
  } catch {
    return [];
  }
}

async function board(session, access, deps, date, seat) {
  const loaded = access ? await use(deps, 'loadEntries', loadEntries)(deps.env, access, date, deps) : { ok: false, rows: [] };
  const cases = await liveCases(session, deps, Boolean(access));
  const folded = forSeat(foldEntries(loaded.ok ? loaded.rows : [], cases), seat);
  return { ...folded, date, seat: seat || '', storeOk: !access || loaded.ok, storeError: loaded.ok || !access ? '' : loaded.error };
}

async function popupSources(access, deps, viewer) {
  const empty = { decisions: [], moves: [], privateCases: [], meetings: [] };
  if (!access) return { ...empty, meetings: meetingItems([], viewer, deps.now ? new Date(deps.now) : new Date()) };
  const table = use(deps, 'loadStaffTable', loadStaffTable);
  const sections = viewer === 'byron' ? 'tasks,pipeline_private_byron' : 'tasks';
  const snaps = await table(deps.env, access, `command_dashboard_snapshots?select=section,byron_only,payload&section=in.(${sections})`, deps);
  let decisions = [];
  let moves = [];
  let privateCases = [];
  if (snaps.ok) {
    const dash = presentDashboard({ seat: viewer, email: '', displayName: '', rows: snaps.rows, thread: [] });
    moves = (dash.tasks && dash.tasks.byron_next_move_deals) || [];
    if (viewer === 'byron') {
      decisions = (dash.tasks && dash.tasks.byron_decisions) || [];
      privateCases = dash.privateCases || [];
    }
  }
  const progress = await table(deps.env, access, 'command_meeting_progress?select=meeting_id,payload,updated_at,updated_by', deps);
  return { decisions, moves, privateCases, meetings: meetingItems(progress.ok ? progress.rows : [], viewer, deps.now ? new Date(deps.now) : new Date()) };
}

async function popupBoard(session, access, deps, date, seat, viewer) {
  const env = deps.env;
  const loaded = access ? await use(deps, 'loadEntries', loadEntries)(env, access, date, deps) : { ok: false, rows: [] };
  const earlier = access ? await use(deps, 'loadEarlierEntries', loadEarlierEntries)(env, access, date, deps) : { ok: false, rows: [] };
  let cases = [];
  if (use(deps, 'cockpitMode', cockpitMode)(env) === 'supabase') {
    try {
      const live = await use(deps, 'loadSupabaseBoard', loadSupabaseBoard)(session, deps);
      cases = (live && live.cards) || [];
    } catch {
      cases = [];
    }
  }
  const extra = await popupSources(access, deps, seat);
  return buildPopupModel({
    seat,
    viewer,
    date,
    todayRows: loaded.ok ? loaded.rows : [],
    earlierRows: earlier.ok ? earlier.rows : [],
    cases,
    decisions: extra.decisions,
    moves: extra.moves,
    privateCases: extra.privateCases,
    meetingRows: extra.meetings,
    canSave: Boolean(access && runSheetConfigured(env)),
    storeOk: !access || loaded.ok,
  });
}

function answerPayload(fields, cleaned) {
  return {
    op: cleaned.op,
    decision: cleaned.decision,
    edit_text: cleaned.edit,
    owner: cleaned.owner,
    due: cleaned.due,
    note: cleaned.op === 'note' ? cleaned.edit : '',
    partial: cleaned.partial,
    channel: cleaned.channel,
    subject: cleaned.subject,
    text: cleaned.edit,
    case: String(fields.case || fields.title || '').slice(0, 200),
    need: String(fields.need || '').slice(0, 500),
    act: String(fields.act || fields.need || '').slice(0, 500),
    urg: String(fields.urg || ''),
    kind: String(fields.kind || 'task'),
    client_ts: String(fields.client_ts || '').slice(0, 40),
  };
}

function cockpitKind(item) {
  if (!item) return '';
  const ref = String(item.ref || '');
  const id = String(item.caseId || '');
  if (!id) return '';
  if (ref === `task-${id}`) return 'task';
  if (ref === `case-${id}`) return 'case';
  return '';
}

async function saveCase(deps, session, item, op, fields, actor) {
  const kind = cockpitKind(item);
  if (!kind) return { skipped: true };
  if (isSampleCard(item) || isSampleRef(item.ref) || isSampleRef(item.caseId)) return { skipped: true };
  if (use(deps, 'cockpitMode', cockpitMode)(deps.env) !== 'supabase') return { skipped: true };
  if (!OWNERS.includes(actor)) return { skipped: true };
  const id = String(item.caseId || String(item.ref || '').replace(/^(case|task)-/, ''));
  if (!id || isSampleRef(id)) return { skipped: true };
  const patch = {};
  if (op === 'done') patch.done = true;
  else if (op === 'reopen') patch.done = false;
  else if (op === 'owner') {
    const owner = fields.owner === 'Chris' ? 'Chris Shipton' : fields.owner;
    if (!OWNERS.includes(owner)) return { skipped: true };
    patch.owner = owner;
  } else if (op === 'due') patch.dueOn = fields.due || '';
  else if (op === 'note') patch.note = fields.note || fields.edit_text || '';
  else if (op === 'draft' && String(fields.channel || 'borrower') === 'borrower') patch.draftMessage = fields.edit_text || '';
  else return { skipped: true };
  const save = use(deps, 'saveSupabase', saveSupabase);
  return save(session, kind, id, patch, actor, deps);
}

async function commandPost(req, deps, action, body) {
  if (deps.commandPost) return deps.commandPost(action, body);
  const fake = { statusCode: 200, body: '', headers: {}, setHeader() {}, getHeader() { return ''; }, end(b) { this.body = b || ''; } };
  await handleCommandDashboard({
    method: 'POST',
    url: `/api/command-dashboard?action=${encodeURIComponent(action)}`,
    headers: { ...(req.headers || {}), 'content-type': 'application/json' },
    query: { action },
    body,
  }, fake, deps);
  let json = {};
  try { json = JSON.parse(fake.body || '{}'); } catch { json = {}; }
  return { status: fake.statusCode, json };
}

async function rememberNext(deps, env, access, actor, date, item, op) {
  const next = autoNext(item, op);
  if (next.kind === 'none') return next;
  const insert = use(deps, 'insertEntry', insertEntry);
  const base = {
    sheet_date: date,
    actor_email: actor.email,
  };
  if (next.kind === 'card') {
    await insert(env, access, {
      ...base,
      item_ref: next.item.ref,
      entry_kind: 'answer',
      client_id: `n-${randomBytes(8).toString('hex')}`,
      payload: { op: 'add', ...next.item, edit_text: next.item.need },
    }, deps);
  }
  await insert(env, access, {
    ...base,
    item_ref: item.ref,
    entry_kind: 'answer',
    client_id: `f-${randomBytes(8).toString('hex')}`,
    payload: { op: 'next', text: next.text || 'Lizzy to generate next', edit_text: next.text || 'Lizzy to generate next' },
  }, deps);
  return next;
}

export async function handleRunSheet(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  const depsEnv = { ...deps, env };
  const query = queryOf(req);
  const popupOn = popupEnabled(env);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(query.date || '')) ? query.date : parisDate(deps.now ? new Date(deps.now) : new Date());
  try {
    const session = readCookie(req, 'pf_staff');
    if (req.method === 'POST') {
      const type = String(req.headers?.['content-type'] || '');
      const fields = await readFields(req);
      const popupPost = popupOn && (fields.view === 'popup' || query.view === 'popup');
      if (!type.includes('application/json')) {
        if (fields.action === 'logout') {
          if (session && await use(depsEnv, 'sessionAllows', sessionAllows)(session, depsEnv)) await endSession(session, depsEnv);
          writeStaffCookie(res, req, '', 0);
          return redirect(res, PATH);
        }
        const login = await establishSession({ email: fields.email, password: fields.password }, depsEnv);
        if (!login.ok) return sendHtml(res, 401, renderRunSheetLogin('That email or password was not recognised.'));
        writeStaffCookie(res, req, login.session);
        const next = fields.next === POPUP_PATH && popupOn ? POPUP_PATH : PATH;
        return redirect(res, next);
      }
      if (!session || !await use(depsEnv, 'sessionAllows', sessionAllows)(session, depsEnv)) return sendJson(res, 401, { ok: false, error: 'signin' });
      const access = use(depsEnv, 'supabaseAccessToken', supabaseAccessToken)(session);
      if (!access || !runSheetConfigured(env)) return sendJson(res, 503, { ok: false, error: 'individual_signin_required' });
      const actor = await use(depsEnv, 'staffActorFromToken', staffActorFromToken)(access, depsEnv);
      if (!actor.ok) return sendJson(res, 401, { ok: false, error: 'signin' });
      if (['send', 'release', 'notify'].includes(String(fields.action || fields.op || ''))) return sendJson(res, 400, { ok: false, error: 'refused' });
      const target = String(fields.to_agent || fields.to || '');
      if (/\b(tom|openclaw|gateway)\b/i.test(target)) return sendJson(res, 400, { ok: false, error: 'refused' });
      const sheetDate = /^\d{4}-\d{2}-\d{2}$/.test(String(fields.date || '')) ? fields.date : date;
      const insert = use(depsEnv, 'insertEntry', insertEntry);
      if (fields.op === 'voice') {
        const ref = String(fields.ref || '');
        if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(ref)) return sendJson(res, 400, { ok: false, error: 'bad_ref' });
        const mime = String(fields.mime || 'audio/webm').split(';')[0].replace(/[^a-z0-9/.+-]/gi, '').slice(0, 40);
        const b64 = String(fields.audio_b64 || '');
        const buf = Buffer.from(b64, 'base64');
        if (!buf.length || buf.length > MAX_AUDIO) return sendJson(res, 400, { ok: false, error: 'bad_audio' });
        const t = await use(depsEnv, 'transcribe', transcribe)(env, buf, mime, depsEnv);
        const saved = await insert(env, access, {
          sheet_date: sheetDate, item_ref: ref, entry_kind: 'voice', actor_email: actor.email,
          client_id: /^[A-Za-z0-9_-]{8,80}$/.test(String(fields.client_id || '')) ? fields.client_id : `v-${randomBytes(8).toString('hex')}`,
          payload: { mime, bytes: buf.length, audio_b64: b64, transcript: t.text || '', transcript_status: t.status },
        }, depsEnv);
        if (!saved.ok) return sendJson(res, saved.error === 'denied' ? 401 : 502, { ok: false, error: saved.error });
        return sendJson(res, 200, { ok: true, id: saved.id, at: saved.at, transcript: t.text || '', transcript_status: t.status || 'no_key' });
      }
      const cleaned = cleanAnswer(fields, { popup: popupPost });
      if (!cleaned.ok) return sendJson(res, 400, { ok: false, error: cleaned.error });
      const saved = await insert(env, access, {
        sheet_date: sheetDate, item_ref: cleaned.ref, entry_kind: 'answer', actor_email: actor.email,
        client_id: cleaned.clientId || `a-${randomBytes(8).toString('hex')}`,
        payload: answerPayload(fields, cleaned),
      }, depsEnv);
      if (!saved.ok) return sendJson(res, saved.error === 'denied' ? 401 : 502, { ok: false, error: saved.error });
      let cockpit = { skipped: true };
      let thread = null;
      let meeting = null;
      let next = { kind: 'none' };
      if (popupPost) {
        const seat = actor.seat && actor.seat.code || '';
        const model = await popupBoard(session, access, depsEnv, sheetDate, seat, seat);
        const found = model.open.concat(model.done).find((row) => row.ref === cleaned.ref);
        const fromRef = cleaned.ref.startsWith('task-') ? 'task' : cleaned.ref.startsWith('case-') ? 'case' : '';
        const item = found || {
          ref: cleaned.ref,
          kind: fields.kind || fromRef,
          source: fromRef,
          caseId: fields.caseId || cleaned.ref.replace(/^(case|task)-/, ''),
        };
        const actorName = ACTOR[seat] || '';
        if (['done', 'reopen', 'owner', 'due', 'note', 'draft'].includes(cleaned.op)) {
          cockpit = await saveCase(depsEnv, session, item, cleaned.op, fields, actorName);
          if (cockpit && !cockpit.skipped && cockpit.ok !== true) {
            return sendJson(res, cockpit.denied ? 401 : 502, { ok: false, error: cockpit.error || 'cockpit', saved: true });
          }
        }
        if (cleaned.op === 'ask' || cleaned.op === 'thread') {
          const to = cleaned.op === 'ask' ? 'lizzy' : 'all';
          thread = await commandPost(req, depsEnv, 'thread', { to_agent: to, message: cleaned.edit });
          if (!thread.json || thread.json.ok !== true) return sendJson(res, thread.status || 502, { ok: false, error: 'thread', saved: true });
        }
        if (cleaned.op === 'meeting') {
          meeting = await commandPost(req, depsEnv, 'meetings', { id: cleaned.meetingId, progress: fields.progress });
          if (!meeting.json || meeting.json.ok !== true) return sendJson(res, meeting.status || 502, { ok: false, error: 'meeting', saved: true });
        }
        if (cleaned.op === 'yes' || cleaned.op === 'done') next = await rememberNext(depsEnv, env, access, actor, sheetDate, item, cleaned.op);
      }
      return sendJson(res, 200, {
        ok: true,
        id: saved.id,
        at: saved.at,
        by: actor.email,
        cockpit: cockpit && cockpit.ok ? 'saved' : 'skipped',
        thread: thread ? 'posted' : '',
        meeting: meeting ? 'posted' : '',
        next,
      });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendHtml(res, 405, renderRunSheetMessage('Not available', 'Open the run sheet in a browser.'));
    const wantsPopup = popupOn && query.view === 'popup';
    if (!session || !await use(depsEnv, 'sessionAllows', sessionAllows)(session, depsEnv)) {
      if (query.format === 'json') return sendJson(res, 401, { ok: false, error: 'signin' });
      return sendHtml(res, 401, renderRunSheetLogin('', wantsPopup ? POPUP_PATH : ''));
    }
    const access = use(depsEnv, 'supabaseAccessToken', supabaseAccessToken)(session);
    let seat = '';
    let viewer = '';
    if (access) {
      const actor = await use(depsEnv, 'staffActorFromToken', staffActorFromToken)(access, depsEnv);
      if (!actor.ok) {
        if (query.format === 'json') return sendJson(res, 401, { ok: false, error: 'signin' });
        return sendHtml(res, 401, renderRunSheetLogin('', wantsPopup ? POPUP_PATH : ''));
      }
      viewer = actor.seat && actor.seat.code || '';
      seat = viewer;
    }
    if (viewer === 'byron' && /^[a-z]{2,20}$/.test(String(query.seat || ''))) seat = query.seat;
    if (wantsPopup) {
      const model = await popupBoard(session, access, depsEnv, date, seat, viewer);
      if (query.format === 'json') return sendJson(res, 200, { ok: true, ...model });
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
      return sendHtml(res, 200, renderPopup(model));
    }
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
