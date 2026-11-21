// Overnight check. Synthetic contacts only. Alerts Byron on Telegram when a check fails.
import crypto from 'node:crypto';
import { factFindAnswers, optionsLead, acquisitionLead } from '../lib/verify-samples.js';

const FORMS = [
  { id: 'fact-find', path: '/fact-find' },
  { id: 'apply', path: '/apply' },
  { id: 'get-your-options', path: '/get-your-options' },
  { id: 'acquisition-finance', path: '/acquisition-finance' },
];

function authorised(req) {
  const expected = process.env.VERIFY_SECRET || process.env.CRON_SECRET || '';
  const header = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const actual = header || String(req.headers['x-posfin-verify'] || '');
  if (expected.length < 32 || Buffer.byteLength(actual) !== Buffer.byteLength(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

async function getJson(fetcher, url, options) {
  const response = await fetcher(url, options);
  const text = typeof response.text === 'function' ? await response.text() : '';
  let body = null;
  try { body = text ? JSON.parse(text) : await response.json(); } catch { body = null; }
  return { status: response.status, body };
}

function dealRef() {
  return `VERIFY-${Date.now().toString(36).toUpperCase()}`;
}

export async function runChecks(env = process.env, fetcher = fetch) {
  const origin = String(env.VERIFY_BASE_URL || 'https://posfincapital.com').replace(/\/+$/, '');
  const secret = env.VERIFY_SECRET || '';
  const headers = { 'content-type': 'application/json', 'x-posfin-verify': secret };
  const checks = [];
  const pages = await Promise.all(FORMS.map(async (form) => {
    const response = await fetcher(origin + form.path);
    const html = typeof response.text === 'function' ? await response.text() : '';
    const selects = (html.match(/<select\b/gi) || []).length;
    return { id: form.id, path: form.path, status: response.status, selects, ok: response.status === 200 };
  }));
  checks.push(...pages.map((page) => ({ name: `page:${page.id}`, ok: page.ok, detail: { status: page.status, selects: page.selects } })));

  const lookup = await getJson(fetcher, `${origin}/api/address-lookup?postcode=SW1A%201AA`);
  const addresses = lookup.body && Array.isArray(lookup.body.addresses) ? lookup.body.addresses.length : 0;
  const lookupOk = lookup.status === 200 && addresses > 0;
  checks.push({ name: 'address-lookup', ok: lookupOk, detail: { status: lookup.status, addresses, reason: lookup.body && lookup.body.reason || null } });

  const answers = factFindAnswers();
  const save = await getJson(fetcher, `${origin}/api/factfind`, { method: 'POST', headers, body: JSON.stringify({ action: 'save', step: 5, answers }) });
  const submit = save.body && save.body.ok
    ? await getJson(fetcher, `${origin}/api/factfind`, { method: 'POST', headers, body: JSON.stringify({ action: 'submit', code: save.body.code, answers }) })
    : { status: 0, body: null };
  const reference = submit.body && submit.body.reference;
  checks.push({ name: 'fact-find-submit', ok: !!(submit.body && submit.body.ok && String(reference).startsWith('TEST-WEB-')), detail: { status: submit.status, reference: reference || null, save: save.status } });

  const lead = await getJson(fetcher, `${origin}/api/lead`, { method: 'POST', headers, body: JSON.stringify(optionsLead(dealRef())) });
  checks.push({ name: 'get-your-options', ok: lead.status >= 200 && lead.status < 300, detail: { status: lead.status } });

  const acquisition = await getJson(fetcher, `${origin}/api/acquisition-lead`, { method: 'POST', headers, body: JSON.stringify(acquisitionLead()) });
  checks.push({ name: 'acquisition-finance', ok: !!(acquisition.body && acquisition.body.ok && acquisition.body.synthetic), detail: { status: acquisition.status, ref: acquisition.body && acquisition.body.ref || null } });

  if (reference && env.FF_SUPABASE_URL && env.FF_ALERT_SERVICE_KEY) {
    const stored = await getJson(fetcher, `${env.FF_SUPABASE_URL}/rest/v1/rpc/verify_web_lead`, {
      method: 'POST',
      headers: { apikey: env.FF_ALERT_SERVICE_KEY, authorization: `Bearer ${env.FF_ALERT_SERVICE_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_reference: reference }),
    });
    const row = stored.body;
    const alerts = row && Array.isArray(row.alerts) ? row.alerts : [];
    const staff = alerts.find((item) => item.kind === 'staff_alert');
    checks.push({
      name: 'supabase-alert',
      ok: !!(row && row.is_test === true && row.email === 'synthetic.verify@posfincapital.com' && row.assigned_seat && staff && (staff.state === 'sent' || staff.state === 'pending')),
      detail: { is_test: row && row.is_test, seat: row && row.assigned_seat, staff: staff ? staff.state : null, provider: staff ? staff.provider_id : null },
    });
  } else if (reference) {
    checks.push({ name: 'supabase-alert', ok: false, detail: { reason: 'service_key_missing' } });
  }

  const failed = checks.filter((item) => !item.ok);
  return { ok: failed.length === 0, checks, failed: failed.map((item) => item.name) };
}

async function alertFailure(summary, env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN || env.FF_ALERT_BOT_TOKEN;
  const chat = env.FF_ALERT_CHAT_ID;
  if (!token || !chat) return false;
  const text = `POSFIN VERIFY FAILED\n${summary}\nSynthetic only. No borrower was emailed.`;
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3500) }),
  });
  return response.ok;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  if (!authorised(req)) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false })); }
  try {
    const result = await runChecks();
    if (!result.ok) await alertFailure(result.failed.join(', '));
    res.statusCode = result.ok ? 200 : 503;
    res.end(JSON.stringify(result));
  } catch {
    await alertFailure('verify_worker_unavailable');
    res.statusCode = 503;
    res.end(JSON.stringify({ ok: false, error: 'verify_worker_unavailable' }));
  }
}
