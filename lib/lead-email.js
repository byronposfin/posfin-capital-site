// Server-side email. The API key stays in the environment and is never logged or returned.

function clipError(provider, status) {
  return `${provider}_${status || 'error'}`.slice(0, 40);
}

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

function fromAddress(from) {
  const match = String(from || '').match(/<([^>]+)>/);
  return (match ? match[1] : String(from || '')).trim();
}

export function parseServiceAccount(raw) {
  let text = String(raw || '').trim();
  if (!text) throw new Error('gmail_credentials_missing');
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    try { text = JSON.parse(text); } catch { text = text.slice(1, -1); }
  }
  const credentials = text.startsWith('{') ? JSON.parse(text) : JSON.parse(Buffer.from(text, 'base64').toString('utf8'));
  if (credentials && typeof credentials.private_key === 'string') {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }
  return credentials;
}

function usableAccount(credentials) {
  return !!(credentials && credentials.client_email && String(credentials.private_key || '').includes('BEGIN'));
}

export function resolveServiceAccount(env = {}) {
  const candidates = [env.GOOGLE_SA_B64, env.GOOGLE_SERVICE_ACCOUNT_JSON].filter((value) => String(value || '').trim());
  let lastError;
  for (const raw of candidates) {
    try {
      const credentials = parseServiceAccount(raw);
      if (usableAccount(credentials)) return credentials;
    } catch (error) { lastError = error; }
  }
  if (lastError) throw lastError;
  throw new Error('gmail_credentials_missing');
}

function gmailFailure(error) {
  const message = String(error && (error.message || error.code) || 'error')
    .replace(/-----BEGIN[\s\S]*$/g, '')
    .replace(/[A-Za-z0-9+/_=-]{24,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
  return { outcome: 'rejected', errorCode: clipError('gmail', message || 'error') };
}

async function sendViaGmail({ gmailCred, gmailCredFallback, from, to, subject, text }) {
  const { google } = await import('googleapis');
  const credentials = resolveServiceAccount({ GOOGLE_SA_B64: gmailCred, GOOGLE_SERVICE_ACCOUNT_JSON: gmailCredFallback });
  const sender = fromAddress(from);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: sender,
  });
  const gmail = google.gmail({ version: 'v1', auth });
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
  ].join('\r\n');
  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: Buffer.from(mime).toString('base64url') },
  });
  if (!response.data || !response.data.id) return { outcome: 'unknown', errorCode: 'gmail_no_id' };
  return { outcome: 'sent', providerId: String(response.data.id).slice(0, 200) };
}

export async function probeGmail(env = process.env) {
  if (env.LEAD_EMAIL_PROVIDER !== 'gmail') return { ok: true, skipped: true };
  try {
    const { google } = await import('googleapis');
    const credentials = resolveServiceAccount(env);
    const sender = fromAddress(env.LEAD_EMAIL_FROM);
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: sender,
    });
    await auth.authorize();
    return { ok: true };
  } catch (error) {
    const code = error && (error.code || error.message) ? String(error.code || error.message) : 'gmail_auth';
    return { ok: false, error: code.replace(/-----BEGIN[\s\S]*$/g, '').slice(0, 80) };
  }
}

const HIGHLEVEL_BASE = 'https://services.leadconnectorhq.com';

function highlevelHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Version: '2021-04-15',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function sendViaHighLevel({ token, locationId, from, to, subject, text }, fetcher = fetch) {
  const headers = highlevelHeaders(token);
  const lookupUrl = new URL(`${HIGHLEVEL_BASE}/contacts/lookup`);
  lookupUrl.searchParams.set('locationId', locationId);
  lookupUrl.searchParams.set('email', to);
  lookupUrl.searchParams.set('limit', '1');
  const lookup = await fetcher(lookupUrl, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
  const found = await readJson(lookup);
  if (!lookup.ok) {
    if (lookup.status >= 400 && lookup.status < 500) return { outcome: 'rejected', errorCode: clipError('highlevel', lookup.status) };
    return { outcome: 'unknown', errorCode: clipError('highlevel', lookup.status) };
  }
  const contact = Array.isArray(found.contacts) ? found.contacts[0] : null;
  if (!contact || !contact.id) return { outcome: 'rejected', errorCode: 'highlevel_contact_missing' };
  const response = await fetcher(`${HIGHLEVEL_BASE}/conversations/messages`, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      type: 'Email',
      contactId: contact.id,
      emailFrom: fromAddress(from),
      emailTo: to,
      subject,
      message: text,
    }),
  });
  const data = await readJson(response);
  const id = data.emailMessageId || data.messageId || (Array.isArray(data.messageIds) ? data.messageIds[0] : '');
  if (response.ok && id) return { outcome: 'sent', providerId: String(id).slice(0, 200) };
  if (response.status >= 400 && response.status < 500) return { outcome: 'rejected', errorCode: clipError('highlevel', response.status) };
  return { outcome: 'unknown', errorCode: clipError('highlevel', response.status || 'error') };
}

export async function sendLeadEmail({ provider, apiKey, gmailCred, gmailCredFallback, highlevelLocationId, from, to, subject, text, idempotencyKey, mailgunDomain, mailgunHost }, fetcher) {
  if (provider === 'gmail') {
    try { return await sendViaGmail({ gmailCred, gmailCredFallback, from, to, subject, text }); }
    catch (error) { return gmailFailure(error); }
  }
  if (provider === 'highlevel') {
    try { return await sendViaHighLevel({ token: apiKey, locationId: highlevelLocationId, from, to, subject, text }, fetcher); }
    catch { return { outcome: 'unknown', errorCode: 'highlevel_timeout' }; }
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 4000);
  try {
    if (provider === 'resend') {
      const response = await fetcher('https://api.resend.com/emails', {
        method: 'POST',
        signal: ac.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': String(idempotencyKey),
        },
        body: JSON.stringify({ from, to: [to], subject, text }),
      });
      const data = await readJson(response);
      if (response.ok && data.id) return { outcome: 'sent', providerId: String(data.id).slice(0, 200) };
      if (response.status >= 400 && response.status < 500) {
        return { outcome: 'rejected', errorCode: clipError('resend', response.status), retrySeconds: Number(data.retry_after) || 60 };
      }
      return { outcome: 'unknown', errorCode: clipError('resend', response.status) };
    }
    if (provider === 'mailgun') {
      const host = String(mailgunHost || 'https://api.mailgun.net').replace(/\/+$/, '');
      const body = new URLSearchParams({ from, to, subject, text, 'h:X-Entity-Ref-ID': String(idempotencyKey), 'o:tag': 'posfin-lead-ops' });
      const response = await fetcher(`${host}/v3/${mailgunDomain}/messages`, {
        method: 'POST',
        signal: ac.signal,
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });
      const data = await readJson(response);
      if (response.ok && data.id) return { outcome: 'sent', providerId: String(data.id).slice(0, 200) };
      if (response.status >= 400 && response.status < 500) return { outcome: 'rejected', errorCode: clipError('mailgun', response.status) };
      return { outcome: 'unknown', errorCode: clipError('mailgun', response.status) };
    }
    return { outcome: 'rejected', errorCode: 'provider_unsupported' };
  } catch {
    return { outcome: 'unknown', errorCode: 'timeout' };
  } finally {
    clearTimeout(timer);
  }
}
