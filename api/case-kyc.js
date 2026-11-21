import { setPrivate, sendHtml, sendJson, readRaw, parseMultipart, readFields } from '../lib/case-http.js';
import { tokenOk, buildModel } from '../lib/case-portal.js';
import { renderDocument, renderMessage } from '../lib/case-portal-html.js';
import { submitKycFile, finishKyc } from '../lib/case-store.js';

function wantsJson(req) {
  return req.headers?.['x-posfin-fetch'] === '1' || String(req.headers?.accept || '').includes('application/json');
}

export default async function handler(req, res) {
  setPrivate(res);
  const token = String(req.query?.token || '');
  const json = wantsJson(req);
  if (req.method !== 'POST') {
    return json ? sendJson(res, 405, { ok: false, message: 'Please use the identity check on your page.' }) : sendHtml(res, 405, renderMessage('Not available', 'Please use the identity check on your page.'));
  }
  if (!tokenOk(token)) {
    const message = 'This link is not valid. Please contact Posfin Capital and we will send a fresh one.';
    return json ? sendJson(res, 404, { ok: false, message }) : sendHtml(res, 404, renderMessage('Link not valid', message));
  }
  try {
    const type = String(req.headers?.['content-type'] || '');
    if (type.includes('application/json') || (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && req.body.finish)) {
      const body = await readFields(req);
      const result = await finishKyc(token, { fullName: body.full_name, address: body.address, idType: body.id_type });
      if (!result.ok) return sendJson(res, result.error === 'not_found' ? 404 : 400, { ok: false, message: result.message });
      return sendJson(res, 200, { ok: true, html: renderDocument(buildModel(result.record), token) });
    }
    const raw = await readRaw(req);
    const parsed = parseMultipart(raw, type);
    const file = parsed.files.find((item) => item.bytes.length);
    const result = await submitKycFile(token, {
      part: parsed.fields.part,
      docType: parsed.fields.doc_type,
      docDate: parsed.fields.doc_date,
      clientRef: parsed.fields.client_ref,
      file: file ? { filename: file.filename, mime: file.mime, bytes: file.bytes } : null,
    });
    return sendJson(res, result.ok ? 200 : 400, result.ok ? { ok: true } : { ok: false, message: result.message });
  } catch (error) {
    console.error('[case-portal]', error.code || 'kyc_failed', error.status || '');
    const message = error.code === 'too_large'
      ? 'That file is over 4MB. Please photograph the page a little further back.'
      : 'That did not send. Please try again.';
    return json ? sendJson(res, 400, { ok: false, message }) : sendHtml(res, 400, renderMessage('Please try again', message));
  }
}
