import { setPrivate, sendHtml, redirect, readCookie, writeStaffCookie, readFields } from '../lib/case-http.js';
import { buildModel, openCountFromAnswered, presentFacts, resolveStage, STAGE_LABEL } from '../lib/case-portal.js';
import { renderStaffLogin, renderStaffList, renderStaffCase, renderMessage } from '../lib/case-portal-html.js';
import { staffLogin, staffLogout, staffList, staffCase, staffStage, staffKyc } from '../lib/case-store.js';

function caseIdOk(id) {
  return /^[A-Za-z0-9-]{6,48}$/.test(id);
}

export default async function handler(req, res) {
  setPrivate(res);
  const caseId = String(req.query?.caseId || '');
  try {
    if (req.method === 'POST') {
      const fields = await readFields(req);
      const session = readCookie(req, 'pf_staff');
      if (fields.action === 'logout') {
        await staffLogout(session);
        writeStaffCookie(res, req, '', 0);
        return redirect(res, '/staff/cases');
      }
      if (fields.action === 'kyc') {
        if (!session || !caseIdOk(caseId)) return sendHtml(res, 401, renderStaffLogin('Please sign in again.'));
        const updated = await staffKyc(session, caseId, String(fields.status || ''));
        if (!updated) return sendHtml(res, 401, renderStaffLogin('Please sign in again.'));
        if (updated.ok === false) return sendHtml(res, 400, renderMessage('Not updated', 'That identity check status was not saved.'));
        return redirect(res, `/staff/cases/${encodeURIComponent(caseId)}`);
      }
      if (fields.action === 'stage') {
        if (!session || !caseIdOk(caseId)) return sendHtml(res, 401, renderStaffLogin('Please sign in again.'));
        const stage = fields.stage === '' ? null : String(fields.stage || '');
        const updated = await staffStage(session, caseId, stage);
        if (!updated) return sendHtml(res, 401, renderStaffLogin('Please sign in again.'));
        if (updated.ok === false) return sendHtml(res, 400, renderMessage('Not updated', 'That stage was not saved.'));
        return redirect(res, `/staff/cases/${encodeURIComponent(caseId)}`);
      }
      const login = await staffLogin(String(fields.password || ''));
      if (!login || login.ok !== true || !login.session) return sendHtml(res, 401, renderStaffLogin('That staff password was not recognised.'));
      writeStaffCookie(res, req, login.session);
      return redirect(res, '/staff/cases');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendHtml(res, 405, renderMessage('Not available', 'Open the staff page in a browser.'));
    const session = readCookie(req, 'pf_staff');
    if (!session) return sendHtml(res, 401, renderStaffLogin(''));
    if (caseId) {
      if (!caseIdOk(caseId)) return sendHtml(res, 404, renderMessage('Not available', 'That case is not on this desk.'));
      const loaded = await staffCase(session, caseId);
      if (!loaded || loaded.error === 'denied') return sendHtml(res, 401, renderStaffLogin('Please sign in again.'));
      if (!loaded.ok || !loaded.record) return sendHtml(res, 404, renderMessage('Not available', 'That case is not on this desk.'));
      return sendHtml(res, 200, renderStaffCase(buildModel(loaded.record), loaded.record.broker || {}));
    }
    const rows = await staffList(session);
    if (!rows) return sendHtml(res, 401, renderStaffLogin('Please sign in again.'));
    const cases = rows.map((row) => {
      const facts = presentFacts(row.facts || {});
      const stage = resolveStage(facts, row.stage);
      const quiet = facts.ask_client === false;
      return {
        caseId: row.case_id,
        clientName: row.client_name,
        address: [facts.property_address, facts.postcode].filter(Boolean).join(', '),
        stageLabel: quiet && facts.offer_issued === true ? 'Offer issued' : STAGE_LABEL[stage],
        openCount: quiet ? Number(row.staff_open) || 0 : openCountFromAnswered(row.answered || []),
        openLabel: quiet ? 'internal items' : 'still to answer',
        kycStatus: row.kyc_status || 'not_started',
      };
    });
    return sendHtml(res, 200, renderStaffList(cases));
  } catch (error) {
    console.error('[case-portal]', error.code || 'staff_failed', error.status || '');
    return sendHtml(res, 503, renderMessage('Please try again', 'The staff view is temporarily unavailable.'));
  }
}
