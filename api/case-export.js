import { setPrivate, sendHtml, readCookie } from '../lib/case-http.js';
import { buildModel } from '../lib/case-portal.js';
import { renderExport, renderStaffLogin, renderMessage } from '../lib/case-portal-html.js';
import { staffCase } from '../lib/case-store.js';
import { sessionAllows } from '../lib/cockpit-store.js';
import { supabaseAccessToken } from '../lib/staff-auth.js';

export default async function handler(req, res) {
  setPrivate(res);
  if (req.method !== 'GET') return sendHtml(res, 405, renderMessage('Not available', 'Open the export from the staff case page.'));
  const caseId = String(req.query?.caseId || '');
  if (!/^[A-Za-z0-9-]{6,48}$/.test(caseId)) return sendHtml(res, 404, renderMessage('Not available', 'That case is not on this desk.'));
  const session = readCookie(req, 'pf_staff');
  if (!session || (supabaseAccessToken(session) && !await sessionAllows(session, { env: process.env }))) {
    return sendHtml(res, 401, renderStaffLogin('Please sign in again.'));
  }
  if (supabaseAccessToken(session)) return sendHtml(res, 404, renderMessage('Not on this folder', 'The live book is on the cockpit. This export still belongs to the SmartLink session.'));
  try {
    const loaded = await staffCase(session, caseId);
    if (!loaded || loaded.error === 'denied') return sendHtml(res, 401, renderStaffLogin('Please sign in again.'));
    if (!loaded.ok || !loaded.record) return sendHtml(res, 404, renderMessage('Not available', 'That case is not on this desk.'));
    const model = buildModel(loaded.record);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="posfin-loan-pack-${caseId}.html"`);
    res.end(renderExport(model, loaded.record.broker || {}));
  } catch (error) {
    console.error('[case-portal]', error.code || 'export_failed', error.status || '');
    return sendHtml(res, 503, renderMessage('Please try again', 'The loan pack is temporarily unavailable.'));
  }
}
