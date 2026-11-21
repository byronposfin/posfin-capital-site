import test from 'node:test';
import assert from 'node:assert/strict';
import { leadEmailConfig, drainLeadOps } from '../lib/lead-ops.js';
import { sendViaHighLevel } from '../lib/lead-email.js';

const base = {
  LEAD_ALERT_EMAIL: 'true', VERCEL_ENV: 'production', FF_TEST_RUN: 'false',
  FF_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co', FF_ALERT_SERVICE_KEY: 'service-key',
  LEAD_EMAIL_PROVIDER: 'highlevel', HIGHLEVEL_PRIVATE_TOKEN: 'pit-test', HIGHLEVEL_LOCATION_ID: 'loc-test',
  LEAD_EMAIL_FROM: 'Posfin Capital <byron.hill@posfincapital.com>',
};

test('HighLevel is selected only when the token and location are set, and Gmail is not used instead', () => {
  const cfg = leadEmailConfig(base);
  assert.equal(cfg.ok, true);
  assert.equal(cfg.provider, 'highlevel');
  assert.equal(cfg.from, 'Posfin Capital <byron.hill@posfincapital.com>');
  assert.equal(leadEmailConfig({ ...base, HIGHLEVEL_PRIVATE_TOKEN: '' }).ok, false);
  assert.equal(leadEmailConfig({ ...base, HIGHLEVEL_LOCATION_ID: '' }).ok, false);
  assert.equal(leadEmailConfig({ ...base, GOOGLE_SA_B64: 'still-there', HIGHLEVEL_PRIVATE_TOKEN: '' }).provider, 'highlevel');
});

test('a staff alert looks up the existing contact and sends one HighLevel email to that address', async () => {
  const calls = [];
  const result = await sendViaHighLevel({
    token: 'pit-test', locationId: 'loc-test', from: 'Posfin Capital <byron.hill@posfincapital.com>',
    to: 'jessica@posfincapital.com', subject: 'Staff test', text: 'One staff alert.',
  }, async (url, opts) => {
    calls.push({ url: String(url), method: opts.method, body: opts.body ? JSON.parse(opts.body) : null, auth: opts.headers.Authorization });
    if (String(url).includes('/contacts/lookup')) return { ok: true, status: 200, json: async () => ({ contacts: [{ id: 'contact-1', email: 'jessica@posfincapital.com' }] }) };
    return { ok: true, status: 200, json: async () => ({ emailMessageId: 'email-1', messageId: 'msg-1' }) };
  });
  assert.equal(result.outcome, 'sent');
  assert.equal(result.providerId, 'email-1');
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /locationId=loc-test/);
  assert.match(calls[0].url, /email=jessica%40posfincapital.com/);
  assert.equal(calls[1].body.type, 'Email');
  assert.equal(calls[1].body.contactId, 'contact-1');
  assert.equal(calls[1].body.emailTo, 'jessica@posfincapital.com');
  assert.equal(calls[1].body.emailFrom, 'byron.hill@posfincapital.com');
  assert.equal(calls[1].auth, 'Bearer pit-test');
  assert.doesNotMatch(JSON.stringify(result), /pit-test/);
});

test('a missing HighLevel contact is not created and no message is posted', async () => {
  let posted = 0;
  const result = await sendViaHighLevel({
    token: 'pit-test', locationId: 'loc-test', from: 'byron.hill@posfincapital.com',
    to: 'byron.hill@posfincapital.com', subject: 'Staff test', text: 'One staff alert.',
  }, async (url) => {
    if (String(url).includes('/conversations/messages')) posted += 1;
    return { ok: true, status: 200, json: async () => ({ contacts: [] }) };
  });
  assert.equal(result.errorCode, 'highlevel_contact_missing');
  assert.equal(posted, 0);
});

test('the outbox drain uses HighLevel for the existing staff recipients and does not call Gmail', async () => {
  const calls = [];
  const row = {
    id: '1', reference: 'POSFIN-WEB-ABC234', kind: 'staff_alert', recipient_email: 'byron.hill@posfincapital.com',
    lease_id: 'lease', attempts: 1, idempotency_key: 'idem', created_at: new Date().toISOString(),
    payload: { reference: 'POSFIN-WEB-ABC234', full_name: 'Sarah Jones', is_test: false, contact_consent: true, owner_name: 'Byron' },
  };
  const result = await drainLeadOps(base, async (url, opts) => {
    const target = String(url);
    if (target.includes('leadconnectorhq.com')) {
      calls.push(target);
      if (target.includes('/contacts/lookup')) return { ok: true, status: 200, json: async () => ({ contacts: [{ id: 'byron-contact' }] }) };
      return { ok: true, status: 200, json: async () => ({ messageId: 'msg-byron' }) };
    }
    if (target.endsWith('web_lead_email_raise_alarms')) return { ok: true, status: 200, json: async () => 0 };
    if (target.endsWith('web_lead_email_claim')) return { ok: true, status: 200, json: async () => calls.length ? [] : [row] };
    if (target.endsWith('web_lead_email_finish')) return { ok: true, status: 200, json: async () => true };
    throw new Error('unexpected ' + target);
  });
  assert.equal(result.ok, true);
  assert.equal(result.sent, 1);
  assert.equal(calls.some((url) => url.includes('gmail.googleapis.com') || url.includes('api.resend.com')), false);
  assert.equal(calls.filter((url) => url.includes('/conversations/messages')).length, 1);
});
