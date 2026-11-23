import { setPrivate, sendHtml, readCookie } from '../lib/case-http.js';
import { renderMessage } from '../lib/case-portal-html.js';
import { servedFile } from '../lib/case-portal.js';
import { readClientFile, readStaffFile, safeName } from '../lib/case-store.js';
import { sessionAllows } from '../lib/cockpit-store.js';
import { supabaseAccessToken } from '../lib/staff-auth.js';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  setPrivate(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendHtml(res, 405, renderMessage('Not available', 'Please open the file from your case page.'));
  const submission = String(req.query?.submission || '');
  if (!ID.test(submission)) return sendHtml(res, 404, renderMessage('Not available', 'That file is not on this case.'));
  try {
    const staff = req.query?.staff === '1';
    const staffSession = readCookie(req, 'pf_staff');
    if (staff && supabaseAccessToken(staffSession) && !await sessionAllows(staffSession, { env: process.env })) {
      return sendHtml(res, 401, renderMessage('Please sign in', 'That staff session was not recognised.'));
    }
    const file = staff
      ? await readStaffFile(staffSession, String(req.query?.caseId || ''), submission)
      : await readClientFile(String(req.query?.token || ''), submission);
    if (!file) return sendHtml(res, 404, renderMessage('Not available', 'That file is not on this case.'));
    const served = servedFile(file.mime);
    res.statusCode = 200;
    res.setHeader('Content-Type', served.mime);
    res.setHeader('Content-Disposition', `${served.inline ? 'inline' : 'attachment'}; filename="${safeName(file.filename)}"`);
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Length', String(file.bytes.length));
    if (req.method === 'HEAD') return res.end();
    return res.end(file.bytes);
  } catch (error) {
    console.error('[case-portal]', error.code || 'file_failed', error.status || '');
    return sendHtml(res, 404, renderMessage('Not available', 'That file is not available just now.'));
  }
}
