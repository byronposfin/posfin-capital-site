import { setPrivate, sendHtml } from '../lib/case-http.js';
import { tokenOk, buildModel } from '../lib/case-portal.js';
import { renderDocument, renderMessage } from '../lib/case-portal-html.js';
import { openCase } from '../lib/case-store.js';

const INVALID = 'This link is not valid. Please contact Posfin Capital and we will send a fresh one.';

export default async function handler(req, res) {
  setPrivate(res);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendHtml(res, 405, renderMessage('Not available', 'Please open the private link from your message.'));
  }
  const token = String(req.query?.token || '');
  if (!tokenOk(token)) return sendHtml(res, 404, renderMessage('Link not valid', INVALID));
  try {
    const record = await openCase(token);
    if (!record) return sendHtml(res, 404, renderMessage('Link not valid', INVALID));
    if (req.method === 'HEAD') {
      res.statusCode = 200;
      return res.end();
    }
    return sendHtml(res, 200, renderDocument(buildModel(record), token));
  } catch (error) {
    console.error('[case-portal]', error.code || 'open_failed', error.status || '');
    return sendHtml(res, 503, renderMessage('Please try again', 'Your case page is temporarily unavailable. Please try again in a few minutes, or message Posfin Capital.'));
  }
}
