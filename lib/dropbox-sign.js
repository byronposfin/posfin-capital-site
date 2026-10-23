import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
export const ACK = 'Hello API Event Received';
export function stagingConfig(env = process.env) {
  if (env.VERCEL_ENV === 'production' || env.SIGNING_ENABLED !== 'staging' ||
      env.SUPABASE_URL !== 'https://dxlebqovfphultrdbriz.supabase.co') throw new Error('Signing staging gate closed');
  if (!env.DROPBOX_SIGN_API_KEY || !env.DROPBOX_SIGN_CLIENT_ID) throw new Error('Signing credentials missing');
  return { key: env.DROPBOX_SIGN_API_KEY, clientId: env.DROPBOX_SIGN_CLIENT_ID };
}
export function authenticateEvent(payload, key) {
  const e = payload?.event;
  if (!e || !/^\d+$/.test(String(e.event_time)) || !/^[a-f0-9]{64}$/.test(e.event_hash || '')) throw new Error('Invalid event');
  const expected = createHmac('sha256', key).update(String(e.event_time) + e.event_type).digest('hex');
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(e.event_hash))) throw new Error('Invalid event');
}
export function eventKey(payload) {
  const e = payload.event;
  return createHash('sha256').update(JSON.stringify([payload.signature_request.signature_request_id,
    e.event_type, String(e.event_time), e.event_metadata?.related_signature_id || ''])).digest('hex');
}
export function assertBinding(request, document, clientId) {
  if (!request || request.signature_request_id !== document.request_id || request.test_mode !== true ||
      request.client_id !== clientId || document.client_id !== clientId || document.test_mode !== true ||
      document.approved !== true || !document.template_sha256 ||
      request.signatures?.length !== 1 || request.signatures[0].signature_id !== document.signature_id ||
      request.signatures[0].signer_email_address?.toLowerCase() !== document.signer_email.toLowerCase()) {
    throw new Error('Signing request binding mismatch');
  }
}
export function provider(config, fetcher = fetch) {
  async function call(path, pdf = false) {
    const res = await fetcher('https://api.hellosign.com/v3/' + path, {
      headers: { Authorization: 'Basic ' + Buffer.from(config.key + ':').toString('base64') },
      signal: AbortSignal.timeout(20000), redirect: 'error'
    });
    if (!res.ok) throw new Error('Signing provider HTTP ' + res.status);
    if (!pdf) return res.json();
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 25 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid signed PDF');
    return bytes;
  }
  return {
    request: async id => (await call('signature_request/' + encodeURIComponent(id))).signature_request,
    signUrl: async id => (await call('embedded/sign_url/' + encodeURIComponent(id))).embedded,
    files: id => call('signature_request/files/' + encodeURIComponent(id) + '?file_type=pdf', true)
  };
}
export async function freshSigningLink({ document, caseId, clientId, api }) {
  if (!document || document.case_id !== caseId || document.status !== 'awaiting_signature') throw new Error('Document unavailable');
  const request = await api.request(document.request_id);
  assertBinding(request, document, clientId);
  if (request.is_complete || request.is_declined || request.has_error || request.signatures[0].status_code !== 'awaiting_signature') throw new Error('Document not signable');
  const embedded = await api.signUrl(document.signature_id);
  const url = new URL(embedded.sign_url);
  if (url.protocol !== 'https:' || !['app.hellosign.com','app.dropboxsign.com'].includes(url.hostname)) throw new Error('Unexpected signing host');
  return { signUrl: embedded.sign_url, clientId, expiresAt: embedded.expires_at };
}
// API re-read is authoritative: event_hash authenticates time/type, not arbitrary payload fields.
export async function receiveEvent({ payload, config, store, api }) {
  authenticateEvent(payload, config.key);
  const e = payload.event;
  if (e.event_metadata?.reported_for_app_id !== config.clientId) throw new Error('Wrong callback app');
  if (e.event_type === 'callback_test') return ACK;
  const id = payload.signature_request?.signature_request_id;
  const document = await store.findRequest(id);
  if (!document) throw new Error('Unknown signing request');
  assertBinding(await api.request(id), document, config.clientId);
  await store.enqueue({ event_key: eventKey(payload), request_id: id, event_type: e.event_type });
  return ACK; // Persisted before ACK; downloads happen in the worker, not the callback.
}
export async function processEvent({ job, config, store, api }) {
  const document = await store.findRequest(job.request_id);
  const request = await api.request(job.request_id);
  assertBinding(request, document, config.clientId);
  if (document.status === 'archived') { await store.finish(job, null); return; }
  if (request.has_error) throw new Error('Provider request error');
  if (request.is_declined) { await store.finish(job, { status: 'declined' }); return; }
  if (!request.is_complete) { await store.finish(job, null); return; }
  // Every completion observation can retry retrieval; a late sent/viewed event cannot regress state.
  const pdf = await api.files(job.request_id);
  const sha = createHash('sha256').update(pdf).digest('hex');
  const path = `${document.id}/${sha}.pdf`;
  await store.archive(path, pdf); // Immutable content-addressed private object.
  await store.finish(job, { status: 'archived', signed_sha256: sha, signed_path: path });
}
