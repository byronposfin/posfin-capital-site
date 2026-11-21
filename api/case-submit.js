import { setPrivate, sendHtml, sendJson, readSubmission } from '../lib/case-http.js';
import { tokenOk, buildModel } from '../lib/case-portal.js';
import { renderDocument, renderMessage, renderPortal } from '../lib/case-portal-html.js';
import { submitAnswer } from '../lib/case-store.js';

function wantsJson(req) {
  return req.headers?.['x-posfin-fetch'] === '1' || String(req.headers?.accept || '').includes('application/json');
}

export default async function handler(req, res) {
  setPrivate(res);
  const token = String(req.query?.token || '');
  const json = wantsJson(req);
  if (req.method !== 'POST') {
    return json
      ? sendJson(res, 405, { ok: false, message: 'Please use the form on your case page.' })
      : sendHtml(res, 405, renderMessage('Not available', 'Please use the form on your case page.'));
  }
  if (!tokenOk(token)) {
    const message = 'This link is not valid. Please contact Posfin Capital and we will send a fresh one.';
    return json ? sendJson(res, 404, { ok: false, message }) : sendHtml(res, 404, renderMessage('Link not valid', message));
  }
  try {
    const input = await readSubmission(req);
    const result = await submitAnswer(token, input);
    if (!result.ok) {
      const status = result.error === 'not_found' ? 404 : result.error === 'too_large' ? 413 : 400;
      return json
        ? sendJson(res, status, { ok: false, message: result.message })
        : sendHtml(res, status, renderMessage('Please try again', result.message));
    }
    const model = buildModel(result.record, { highlightId: result.submissionId });
    if (json) return sendJson(res, 200, { ok: true, html: renderPortal(model, token), open: model.openCount, total: model.total });
    return sendHtml(res, 200, renderDocument(model, token));
  } catch (error) {
    console.error('[case-portal]', error.code || 'submit_failed', error.status || '');
    const message = error.code === 'too_large'
      ? 'That file is over 4MB. Please photograph the pages, or send a smaller file.'
      : 'That did not send. Please try again.';
    return json ? sendJson(res, error.code === 'too_large' ? 413 : 400, { ok: false, message }) : sendHtml(res, 400, renderMessage('Please try again', message));
  }
}
