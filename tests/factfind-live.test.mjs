import test from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeTestLead, referencePrefix, responseTestMode } from '../lib/ff-test-lead.js';
import { createSingleFlight, resumeTokenForLoad } from '../lib/ff-save-queue.js';
import { displayAddress, renderProperties } from '../lib/ff-properties.js';
import { parseServiceAccount, resolveServiceAccount } from '../lib/lead-email.js';
import { deliveryDecision } from '../lib/lead-notify.js';
import { drainLeadOps } from '../lib/lead-ops.js';

const leads = { backend: { ref: 'POSFIN-WEB-', testRef: 'TEST-WEB-', test: false }, testRun: false };

test('TEST in the name or notes is a saved test lead and not a live reference', () => {
  assert.equal(looksLikeTestLead({ full_name: 'Byron Hill TEST' }), true);
  assert.equal(looksLikeTestLead({ notes: 'please ignore, TEST only' }), true);
  assert.equal(looksLikeTestLead({ company_name: 'Test Holdings' }), true);
  assert.equal(looksLikeTestLead({ full_name: 'Latest Applicant' }), false);
  assert.equal(looksLikeTestLead({ full_name: 'Sarah Contest' }), false);
  assert.equal(referencePrefix(leads, { full_name: 'Byron Hill TEST' }), 'TEST-WEB-');
  assert.equal(referencePrefix(leads, { full_name: 'Sarah Jones' }), 'POSFIN-WEB-');
  assert.equal(responseTestMode(leads, { full_name: 'TEST' }), true);
  assert.equal(responseTestMode(leads, { full_name: 'Sarah Jones' }), false);
});

test('a test name is not emailed and does not fail the alert drain', async () => {
  const cfg = { production: true, autoreply: true };
  const named = { reference: 'POSFIN-WEB-ABC234', kind: 'staff_alert', payload: { full_name: 'Byron TEST', is_test: false, contact_consent: true } };
  assert.equal(deliveryDecision(named, cfg).reason, 'test_lead');
  const flagged = { reference: 'POSFIN-WEB-ABC234', kind: 'staff_alert', payload: { full_name: 'Sarah Jones', is_test: true, contact_consent: true } };
  assert.equal(deliveryDecision(flagged, cfg).reason, 'test_lead');
  const env = {
    LEAD_ALERT_EMAIL: 'true', VERCEL_ENV: 'production', FF_TEST_RUN: 'false',
    FF_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co', FF_ALERT_SERVICE_KEY: 'service-key',
    LEAD_EMAIL_PROVIDER: 'resend', LEAD_EMAIL_API_KEY: 're_test', LEAD_EMAIL_FROM: 'Posfin <byron.hill@posfincapital.com>',
  };
  let providerCalls = 0;
  const result = await drainLeadOps(env, async (url) => {
    if (String(url).includes('api.resend.com')) { providerCalls++; return { ok: true, status: 200, json: async () => ({ id: 'msg' }) }; }
    if (String(url).endsWith('web_lead_email_claim')) {
      return { ok: true, status: 200, json: async () => [{ id: '1', reference: 'POSFIN-WEB-UP7GDX', kind: 'staff_alert', recipient_email: 'byron.hill@posfincapital.com', lease_id: 'lease', attempts: 1, idempotency_key: 'idem', created_at: new Date().toISOString(), payload: { full_name: 'Byron TEST', is_test: true, contact_consent: true, reference: 'POSFIN-WEB-UP7GDX' } }] };
    }
    return { ok: true, status: 200, json: async () => true };
  });
  assert.equal(providerCalls, 0);
  assert.equal(result.ok, true);
  assert.equal(result.failed, 0);
});

test('Continue waits for an in-flight save instead of dropping the click', async () => {
  const order = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const save = createSingleFlight(async (label) => {
    order.push('start:' + label);
    if (label === 'first') await gate;
    order.push('end:' + label);
    return label;
  });
  const first = save('first');
  await Promise.resolve();
  const second = save('second');
  assert.deepEqual(order, ['start:first']);
  release();
  assert.deepEqual(await Promise.all([first, second]), ['first', 'second']);
  assert.deepEqual(order, ['start:first', 'end:first', 'start:second', 'end:second']);
});

test('confirmation address does not repeat the postcode, and zero arrears omit treatment', () => {
  assert.equal(displayAddress('1 Test Road, Bexhill, TN39 3DH', 'TN39 3DH'), '1 Test Road, Bexhill, TN39 3DH');
  assert.equal(displayAddress('1 Test Road, Bexhill', 'TN39 3DH'), '1 Test Road, Bexhill, TN39 3DH');
  const html = renderProperties({ security_address: '1 Test Road, Bexhill, TN39 3DH', security_postcode: 'TN39 3DH', arrears: 'No', first_charge_arrears_amount: 0, arrears_included_in_balance: 'Not sure' });
  assert.equal(html.split('TN39 3DH').length - 1, 1);
  assert.doesNotMatch(html, /Treatment not confirmed|Arrears treatment/);
});

test('a saved resume code opens that draft, and a later Land link in the same tab starts fresh', () => {
  assert.deepEqual(resumeTokenForLoad({ query: 'ABCD-EFGH-JKLM', stored: 'OLD', navigation: 'navigate' }), { token: 'ABCD-EFGH-JKLM', clearStored: false });
  assert.deepEqual(resumeTokenForLoad({ handedOff: 'ABCD-EFGH-JKLM', stored: 'ABCD-EFGH-JKLM', navigation: 'navigate' }), { token: 'ABCD-EFGH-JKLM', clearStored: false });
  assert.deepEqual(resumeTokenForLoad({ stored: 'ABCD-EFGH-JKLM', navigation: 'reload' }), { token: 'ABCD-EFGH-JKLM', clearStored: false });
  assert.deepEqual(resumeTokenForLoad({ stored: 'ABCD-EFGH-JKLM', navigation: 'navigate' }), { token: '', clearStored: true });
});

test('Gmail credentials accept a private key stored with escaped newlines and fall back to the other env var', () => {
  const encoded = Buffer.from(JSON.stringify({ client_email: 'sheets@example.com', private_key: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n' })).toString('base64');
  const parsed = parseServiceAccount(encoded);
  assert.match(parsed.private_key, /BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----/);
  const fallback = JSON.stringify({ client_email: 'mailer@example.com', private_key: '-----BEGIN PRIVATE KEY-----\nREADY\n-----END PRIVATE KEY-----\n' });
  const resolved = resolveServiceAccount({ GOOGLE_SA_B64: 'not-json', GOOGLE_SERVICE_ACCOUNT_JSON: fallback });
  assert.equal(resolved.client_email, 'mailer@example.com');
  assert.match(resolved.private_key, /\nREADY\n/);
});
