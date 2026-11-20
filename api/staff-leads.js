import { clearCookie, COOKIE, createStaffAuth, csrfOk, encodeSession, readStaffConfig, sessionCookie } from '../lib/staff-auth.js';
import { createStaffDb, StaffDbError } from '../lib/staff-leads-db.js';
import { buildListModel, isStaffEmail, isUuid, safeReturn, validateChange } from '../lib/staff-leads.js';
import { renderDetail, renderList, renderLogin, renderMessage, renderUnavailable } from '../lib/staff-leads-html.js';
import { readCookie, readForm, redirect, requestQuery, requestSecure, sameOriginPost, sendHtml } from '../lib/staff-http.js';

const FAILURE = 'Email or password was not recognised, or this email is not on the Posfin staff list.';
const NOTICES = {
  bad_status: 'Choose a status from the list.',
  bad_stage: 'Choose a stage from the list.',
  bad_assigned: 'Choose who the lead is assigned to.',
  bad_note: 'Notes must be 4,000 characters or fewer.',
  staff_actor_required: 'Your staff session could not be confirmed. Sign in again.',
  schema_pending: 'The leads desk is waiting for the database update.',
  store: 'That change was not saved.',
  timeout: 'The database did not respond. Try again.',
  network: 'The database did not respond. Try again.',
};

function noticeFor(code) {
  return NOTICES[code] || NOTICES.store;
}

export function createStaffLeadsHandler(deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const env = deps.env || process.env;
  const now = deps.now || Date.now;

  return async function staffLeads(req, res) {
    const method = String(req.method || 'GET').toUpperCase();
    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Cache-Control', 'private, no-store');
      res.end();
      return;
    }
    if (method !== 'GET' && method !== 'POST') {
      sendHtml(res, 405, renderMessage('Not available', 'This desk only reads and saves lead updates.'));
      return;
    }
    const cfg = readStaffConfig(env);
    if (!cfg.ok) {
      sendHtml(res, 503, renderUnavailable());
      return;
    }
    const secure = requestSecure(req);
    const auth = createStaffAuth(cfg, fetchImpl);
    const db = deps.db || createStaffDb(cfg, fetchImpl);
    const query = requestQuery(req);

    let fields = {};
    if (method === 'POST') {
      if (!sameOriginPost(req)) {
        sendHtml(res, 403, renderMessage('Not saved', 'Open the leads desk and submit the form from there.'));
        return;
      }
      try { fields = await readForm(req); }
      catch {
        sendHtml(res, 400, renderMessage('Not saved', 'That form could not be read.'));
        return;
      }
      if (fields.action === 'login') {
        const loggedIn = await auth.login(fields.email, fields.password);
        let staff = false;
        if (loggedIn.ok) {
          try { staff = await staffRecord(db, loggedIn.session, loggedIn.email); }
          catch {
            sendHtml(res, 503, renderUnavailable());
            return;
          }
        }
        if (!loggedIn.ok || !staff) {
          sendHtml(res, 401, renderLogin(FAILURE));
          return;
        }
        redirect(res, '/staff/leads', {
          'Set-Cookie': sessionCookie(encodeSession(loggedIn.session), secure),
        });
        return;
      }
    }

    const rawCookie = readCookie(req, COOKIE);
    const established = await auth.establish(rawCookie, now());
    if (!established || !isStaffEmail(established.email)) {
      const headers = rawCookie ? { 'Set-Cookie': clearCookie(secure) } : {};
      sendHtml(res, method === 'GET' ? 200 : 401, renderLogin(method === 'POST' ? 'Sign in to continue.' : ''), headers);
      return;
    }
    const cookieHeader = established.renewed ? { 'Set-Cookie': sessionCookie(encodeSession(established.session), secure) } : {};
    let staff = false;
    try { staff = await db.isStaff(established.session, established.email); }
    catch {
      sendHtml(res, 503, renderMessage('Leads unavailable', noticeFor('network')), cookieHeader);
      return;
    }
    if (!staff) {
      sendHtml(res, 401, renderLogin(FAILURE), { 'Set-Cookie': clearCookie(secure) });
      return;
    }
    const session = { email: established.email, token: established.session.access_token, raw: established.session };

    if (method === 'POST' && fields.action === 'logout') {
      if (!csrfOk(session.token, fields.csrf)) {
        sendHtml(res, 403, renderMessage('Not saved', 'That form expired. Reload the page and try again.'), cookieHeader);
        return;
      }
      redirect(res, '/staff/leads', { 'Set-Cookie': clearCookie(secure) });
      return;
    }

    const leadId = String(query.lead || fields.lead || '');
    if (leadId && !isUuid(leadId)) {
      sendHtml(res, 404, renderMessage('Lead not found', 'That lead is not on the live book.'), cookieHeader);
      return;
    }

    if (method === 'POST') {
      if (fields.action !== 'save' || !leadId) {
        sendHtml(res, 400, renderMessage('Not saved', 'That action is not on this desk.'), cookieHeader);
        return;
      }
      if (!csrfOk(session.token, fields.csrf)) {
        sendHtml(res, 403, renderMessage('Not saved', 'That form expired. Reload the page and try again.'), cookieHeader);
        return;
      }
      await showDetail(req, res, db, session, leadId, fields, cookieHeader, query);
      return;
    }

    if (leadId) {
      await showLead(res, db, session, leadId, query, cookieHeader);
      return;
    }
    try {
      const rows = await db.listLive(session.raw);
      const model = buildListModel(rows, query);
      if (query.saved === '1') model.notice = 'Saved.';
      sendHtml(res, 200, renderList(model, session), cookieHeader);
    } catch (error) {
      const code = error instanceof StaffDbError ? error.code : 'store';
      sendHtml(res, code === 'schema_pending' ? 503 : 502, renderMessage('Leads unavailable', noticeFor(code)), cookieHeader);
    }
  };

  async function showLead(res, db, session, leadId, query, cookieHeader) {
    try {
      const lead = await db.getLead(session.raw, leadId);
      if (!lead) {
        sendHtml(res, 404, renderMessage('Lead not found', 'That lead is not on the live book.'), cookieHeader);
        return;
      }
      const activity = await db.listActivity(session.raw, leadId);
      const saved = query.saved === '1' ? 'Saved.' : query.saved === '0' ? 'Nothing changed.' : '';
      sendHtml(res, 200, renderDetail(lead, activity, session, { returnTo: safeReturn(query.return), notice: saved, noticeOk: true }), cookieHeader);
    } catch (error) {
      sendHtml(res, 502, renderMessage('Lead unavailable', noticeFor(error instanceof StaffDbError ? error.code : 'store')), cookieHeader);
    }
  }

  async function showDetail(req, res, db, session, leadId, fields, cookieHeader, query) {
    let lead;
    try { lead = await db.getLead(session.raw, leadId); }
    catch (error) {
      sendHtml(res, 502, renderMessage('Lead unavailable', noticeFor(error instanceof StaffDbError ? error.code : 'store')), cookieHeader);
      return;
    }
    if (!lead) {
      sendHtml(res, 404, renderMessage('Lead not found', 'That lead is not on the live book.'), cookieHeader);
      return;
    }
    const change = validateChange({
      status: fields.status,
      assigned_to: fields.assigned_to,
      stage: fields.stage,
      note: fields.note,
      setStatus: true,
      currentStatus: lead.status,
    });
    if (!change.ok) {
      const activity = await db.listActivity(session.raw, leadId).catch(() => []);
      sendHtml(res, 400, renderDetail(lead, activity, session, {
        returnTo: safeReturn(fields.return || query.return),
        notice: noticeFor(change.errors[0]),
        noticeOk: false,
      }), cookieHeader);
      return;
    }
    try {
      const result = await db.applyChange(session.raw, {
        id: leadId,
        actor: session.email,
        status: change.status,
        assigned_to: change.assigned_to,
        stage: change.stage,
        note: change.note,
      });
      const saved = result && result.changed === false ? '0' : '1';
      const back = encodeURIComponent(safeReturn(fields.return || query.return));
      redirect(res, `/staff/leads/${leadId}?saved=${saved}&return=${back}`, cookieHeader);
    } catch (error) {
      const code = error instanceof StaffDbError ? error.code : 'store';
      if (code === 'lead_not_found' || code === 'lead_archived') {
        sendHtml(res, 404, renderMessage('Lead not found', 'That lead is not on the live book.'), cookieHeader);
        return;
      }
      const activity = await db.listActivity(session.raw, leadId).catch(() => []);
      sendHtml(res, 400, renderDetail(lead, activity, session, {
        returnTo: safeReturn(fields.return || query.return),
        notice: noticeFor(code),
        noticeOk: false,
      }), cookieHeader);
    }
  }
}

async function staffRecord(db, session, email) {
  return db.isStaff(session, email);
}

const handler = createStaffLeadsHandler();
export default handler;
