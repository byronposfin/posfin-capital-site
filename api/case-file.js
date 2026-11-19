import { setPrivate, sendHtml, readCookie } from '../lib/case-http.js';
import { renderMessage } from '../lib/case-portal-html.js';
import { baseMime } from '../lib/case-portal.js';
import { readClientFile, readStaffFile, safeName } from '../lib/case-store.js';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  setPrivate(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendHtml(res, 405, renderMessage('Not available', 'Please open the file from your case page.'));
  const submission = String(req.query?.submission || '');
  if (!ID.test(submission)) return sendHtml(res, 404, renderMessage('Not available', 'That file is not on this case.'));
  try {
    const staff = req.query?.staff === '1';
    const file = staff
      ? await readStaffFile(readCookie(req, 'pf_staff'), String(req.query?.caseId || ''), submission)
      : await readClientFile(String(req.query?.token || ''), submission);
    if (!file) return sendHtml(res, 404, renderMessage('Not available', 'That file is not on this case.'));
    const mime = baseMime(file.mime) || 'application/octet-stream';
    const inline = mime.startsWith('image/') || mime.startsWith('audio/');
    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeName(file.filename)}"`);
    res.setHeader('Content-Length', String(file.bytes.length));
    if (req.method === 'HEAD') return res.end();
    return res.end(file.bytes);
  } catch (error) {
    console.error('[case-portal]', error.code || 'file_failed', error.status || '');
    return sendHtml(res, 404, renderMessage('Not available', 'That file is not available just now.'));
  }
}
