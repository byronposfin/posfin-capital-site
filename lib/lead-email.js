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

function mimeBody({ from, to, subject, text, html }) {
  if (!html) {
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      text,
    ].join('\r\n');
  }
  const boundary = 'posfin-lead-reply';
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

async function sendViaGmail({ gmailCred, from, to, subject, text, html }) {
  const { google } = await import('googleapis');
  const raw = String(gmailCred || '').trim();
  const credentials = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  const sender = fromAddress(from);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: sender,
  });
  const gmail = google.gmail({ version: 'v1', auth });
  const mime = mimeBody({ from, to, subject, text, html });
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
    const raw = String(env.GOOGLE_SA_B64 || env.GOOGLE_SERVICE_ACCOUNT_JSON || '');
    const credentials = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
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

export async function sendLeadEmail({ provider, apiKey, gmailCred, from, to, subject, text, html, idempotencyKey, mailgunDomain, mailgunHost }, fetcher) {
  if (provider === 'gmail') {
    try { return await sendViaGmail({ gmailCred, from, to, subject, text, html }); }
    catch (error) {
      const status = error && error.code ? String(error.code) : 'error';
      return { outcome: 'rejected', errorCode: clipError('gmail', status) };
    }
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
        body: JSON.stringify(html ? { from, to: [to], subject, text, html } : { from, to: [to], subject, text }),
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
      const fields = { from, to, subject, text, 'h:X-Entity-Ref-ID': String(idempotencyKey), 'o:tag': 'posfin-lead-ops' };
      if (html) fields.html = html;
      const body = new URLSearchParams(fields);
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
