// Drains pipeline.web_lead_email_outbox. Telegram stays in lib/ff-alert-outbox.js.
import { MAIN_DB, PREVIEW_DB } from './ff-alert-outbox.js';
import { deliveryDecision } from './lead-notify.js';
import { sendLeadEmail } from './lead-email.js';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function optionalEmail(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  return EMAIL.test(text) ? text : null;
}

export function leadEmailConfig(env = process.env) {
  const provider = String(env.LEAD_EMAIL_PROVIDER || '').trim().toLowerCase();
  const onlyAlert = optionalEmail(env.LEAD_ALERT_ONLY_EMAIL);
  const autoreplyOnly = optionalEmail(env.LEAD_AUTOREPLY_ONLY_EMAIL);
  const isolated = env.VERCEL_ENV === 'preview' && env.FF_TEST_RUN === 'true' && env.FF_SUPABASE_URL === PREVIEW_DB;
  const production = env.VERCEL_ENV === 'production' && env.FF_TEST_RUN !== 'true' && env.FF_SUPABASE_URL === MAIN_DB;
  const gmailCred = env.GOOGLE_SA_B64 || env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const providerOk = provider === 'gmail'
    ? !!gmailCred && !!env.LEAD_EMAIL_FROM
    : (provider === 'resend' || provider === 'mailgun')
    && !!env.LEAD_EMAIL_API_KEY
    && !!env.LEAD_EMAIL_FROM
    && (provider !== 'mailgun' || !!env.LEAD_EMAIL_MAILGUN_DOMAIN);
  const allowlistsOk = onlyAlert !== null && autoreplyOnly !== null;
  const ok = env.LEAD_ALERT_EMAIL === 'true' && (isolated || production) && !!env.FF_ALERT_SERVICE_KEY && providerOk && allowlistsOk;
  return {
    ok, production, isolated, provider,
    url: env.FF_SUPABASE_URL,
    key: env.FF_ALERT_SERVICE_KEY,
    apiKey: env.LEAD_EMAIL_API_KEY,
    gmailCred,
    from: env.LEAD_EMAIL_FROM,
    mailgunDomain: env.LEAD_EMAIL_MAILGUN_DOMAIN,
    mailgunHost: env.LEAD_EMAIL_MAILGUN_HOST,
    onlyAlert: onlyAlert || '',
    autoreply: env.LEAD_AUTOREPLY === 'true',
    autoreplyOnly: autoreplyOnly || '',
    sla: env.LEAD_SLA_ENABLED === 'true',
  };
}

async function request(fetcher, url, options) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 6000);
  try { return await fetcher(url, { ...options, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}

export async function drainLeadOps(env = process.env, fetcher = fetch, options = {}) {
  const cfg = leadEmailConfig(env);
  const empty = { ok: true, skipped: true, reason: 'not_configured', claimed: 0, sent: 0, suppressed: 0, failed: 0, alarms: 0, escalations: 0, overdue: false };
  if (!cfg.ok) return empty;
  const rpc = async (name, args) => {
    const response = await request(fetcher, `${cfg.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    });
    if (!response.ok) throw Error('outbox_storage_unavailable');
    return response.json();
  };
  const scalar = (value, name) => {
    if (typeof value === 'number') return value;
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof value[name] === 'number') return value[name];
    if (Array.isArray(value) && value[0] && typeof value[0][name] === 'number') return value[0][name];
    return Number(value) || 0;
  };
  const result = { ok: true, skipped: false, claimed: 0, sent: 0, suppressed: 0, failed: 0, unrecorded: 0, alarms: 0, escalations: 0, overdue: false };
  result.alarms = scalar(await rpc('web_lead_email_raise_alarms'), 'web_lead_email_raise_alarms');
  if (options.sla && cfg.sla) result.escalations = scalar(await rpc('web_lead_sla_escalate', { p_limit: 10 }), 'web_lead_sla_escalate');
  const rows = await rpc('web_lead_email_claim', { p_limit: 4 });
  const list = Array.isArray(rows) ? rows : [];
  result.claimed = list.length;
  await Promise.all(list.map(async (row) => {
    const decision = deliveryDecision(row, cfg);
    let outcome = 'suppressed';
    let providerId = null;
    let errorCode = decision.reason || 'suppressed';
    let retrySeconds = 60;
    if (decision.synthetic) {
      outcome = 'sent';
      providerId = 'synthetic-verified';
      errorCode = null;
    } else if (!decision.suppress) {
      const sent = await sendLeadEmail({
        provider: cfg.provider, apiKey: cfg.apiKey, gmailCred: cfg.gmailCred, from: cfg.from, to: row.recipient_email,
        subject: decision.message.subject, text: decision.message.text,
        idempotencyKey: row.idempotency_key, mailgunDomain: cfg.mailgunDomain, mailgunHost: cfg.mailgunHost,
      }, fetcher);
      outcome = sent.outcome;
      providerId = sent.providerId || null;
      errorCode = sent.errorCode || outcome;
      retrySeconds = sent.retrySeconds || 60;
    }
    if (outcome === 'sent') result.sent++;
    else if (outcome === 'suppressed') result.suppressed++;
    else {
      result.failed++;
      const age = Date.now() - new Date(row.created_at).getTime();
      if (['staff_alert', 'sla_escalation', 'delivery_alarm'].includes(row.kind) && age > 2 * 60 * 1000) result.overdue = true;
    }
    try {
      const recorded = await rpc('web_lead_email_finish', {
        p_id: row.id, p_lease_id: row.lease_id, p_result: outcome,
        p_provider_id: providerId, p_retry_seconds: Math.min(retrySeconds, 3600), p_error: errorCode,
      });
      if (recorded !== true) throw Error('lost_lease');
    } catch {
      result.ok = false;
      result.unrecorded++;
    }
  }));
  if (result.failed) result.ok = false;
  return result;
}
