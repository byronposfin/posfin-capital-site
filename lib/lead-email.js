// Server-side email. The API key stays in the environment and is never logged or returned.

function clipError(provider, status) {
  return `${provider}_${status || 'error'}`.slice(0, 40);
}

async function readJson(response) {
  try { return await response.json(); } catch { return {}; }
}

export async function sendLeadEmail({ provider, apiKey, from, to, subject, text, idempotencyKey, mailgunDomain, mailgunHost }, fetcher) {
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
