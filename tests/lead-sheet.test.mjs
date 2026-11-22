import test from 'node:test';
import assert from 'node:assert/strict';
import { SHEET_HEADERS, SHEET_SERVICE_ACCOUNT, appendLeadRow, drainSheet, sheetConfig, sheetCredentials, sheetRow, ukStamp } from '../lib/lead-sheet.js';

const LEAD_ID = '11111111-1111-4111-8111-111111111111';

function sample(extra = {}) {
  return {
    lead_id: LEAD_ID,
    submitted_at: '2026-11-24T09:04:00Z',
    full_name: 'Byron Hill',
    email: 'byron.hill@posfincapital.com',
    phone: '07700900111',
    postcode: 'SW1A 1AA',
    address: '1 Test Street',
    loan_amount: 250000,
    purpose: 'Bridge',
    utm_source: 'facebook',
    utm_medium: 'cpc',
    utm_campaign: 'nov-bridge',
    utm_content: 'video-a',
    contact_consent: true,
    consent_text_version: 'uk-consent-v2-2026-11-21',
    owner_name: 'Byron Hill',
    status: 'new',
    next_action: '',
    notes: 'Call after 10',
    ai_call_consent: false,
    is_test: true,
    ...extra,
  };
}

test('a sheet row follows the Leads header and does not promise a rate', () => {
  const row = sheetRow(sample());
  assert.deepEqual(SHEET_HEADERS, [
    'Received (UK time)', 'Lead ID', 'Name', 'Email', 'Phone', 'Property postcode', 'Property address',
    'Loan amount', 'Purpose', 'UTM source', 'UTM medium', 'UTM campaign', 'UTM content', 'Consent',
    'Consent version', 'Owner', 'Status', 'Contacted at', 'Next action', 'Notes',
  ]);
  assert.equal(row.length, 20);
  assert.equal(row[0], ukStamp('2026-11-24T09:04:00Z'));
  assert.equal(row[0], '24/11/2026 09:04');
  assert.deepEqual(row.slice(1, 17), [
    LEAD_ID, 'Byron Hill', 'byron.hill@posfincapital.com', '07700900111', 'SW1A 1AA', '1 Test Street',
    '250000', 'Bridge', 'facebook', 'cpc', 'nov-bridge', 'video-a', 'yes', 'uk-consent-v2-2026-11-21', 'Byron Hill', 'new',
  ]);
  assert.equal(row[17], '');
  assert.equal(row[18], '');
  assert.match(row[19], /SYNTHETIC TEST — DO NOT CONTACT/);
  assert.match(row[19], /NO AI CALL/);
  assert.match(row[19], /Call after 10/);
  assert.equal(sheetRow(sample({ contact_consent: false, is_test: false, ai_call_consent: true, notes: '' }))[13], 'no');
  assert.doesNotMatch(row.join(' '), /%/);
});

test('append finds an existing lead id and refuses a header that is not the Leads tab', async () => {
  const seen = [];
  const existing = await appendLeadRow({
    async get(range) {
      seen.push(range);
      if (range.endsWith('A1:V1')) return [SHEET_HEADERS];
      return [['Lead ID'], ['someone-else'], [LEAD_ID]];
    },
    async append() { throw Error('must not append'); },
  }, sample());
  assert.equal(existing.outcome, 'sent');
  assert.equal(existing.providerId, 'existing:Leads!B3');
  assert.deepEqual(seen, ['Leads!A1:V1', 'Leads!B:B']);
  const bad = await appendLeadRow({
    async get(range) { return range.endsWith('A1:V1') ? [['Old header']] : []; },
    async append() { throw Error('must not append'); },
  }, sample());
  assert.equal(bad.errorCode, 'sheet_header');
});

test('the sheet sender stays off until its own flag is set, then appends once and retries a failure', async () => {
  assert.equal(sheetConfig({ LEADS_SHEET_ENABLED: 'false' }).ok, false);
  const skipped = await drainSheet({ LEADS_SHEET_ENABLED: 'false' }, async () => { throw Error('must not fetch'); });
  assert.equal(skipped.skipped, true);
  const env = {
    LEADS_SHEET_ENABLED: 'true',
    VERCEL_ENV: 'preview',
    FF_TEST_RUN: 'true',
    FF_SUPABASE_URL: 'https://imcqwhccwsuglkzaxazg.supabase.co',
    FF_ALERT_SERVICE_KEY: 'service-key',
    LEADS_SHEET_ID: '1D75DSVCst4g5p0_Y4PiJXVsnFO5049nkfpLWt5KYx1A',
    GOOGLE_SA_EMAIL: 'sheets@example.iam.gserviceaccount.com',
    GOOGLE_SA_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
  };
  assert.equal(sheetConfig(env).ok, true);
  assert.doesNotMatch(sheetConfig(env).key, /\\\\n/);
  const created = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  let claim = 0;
  const appended = [];
  const finished = [];
  const client = {
    async get(range) {
      if (range.endsWith('A1:V1')) return [SHEET_HEADERS];
      return [['Lead ID'], ...appended.map((row) => [row[1]])];
    },
    async append(values) { appended.push(values); return 'Leads!A2:T2'; },
  };
  const result = await drainSheet(env, async (url, opts) => {
    if (url.endsWith('web_lead_sheet_raise_alarms')) return { ok: true, status: 200, json: async () => 1 };
    if (url.endsWith('web_lead_sheet_claim')) {
      claim++;
      return { ok: true, status: 200, json: async () => claim === 1 ? [
        { id: '1', lead_id: LEAD_ID, reference: 'TEST-WEB-ABC234', lease_id: 'lease-1', attempts: 1, created_at: created, payload: sample() },
        { id: '2', lead_id: '22222222-2222-4222-8222-222222222222', reference: 'TEST-WEB-ABC235', lease_id: 'lease-2', attempts: 1, created_at: created, payload: sample({ lead_id: '22222222-2222-4222-8222-222222222222' }) },
      ] : [] };
    }
    if (url.endsWith('web_lead_sheet_finish')) { finished.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: async () => true }; }
    throw Error(url);
  }, {
    ...client,
    async append(values) {
      if (values[1] === '22222222-2222-4222-8222-222222222222') throw Error('sheet_unavailable');
      return client.append(values);
    },
  });
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.overdue, true);
  assert.equal(result.alarms, 1);
  assert.equal(appended.length, 1);
  assert.equal(appended[0][1], LEAD_ID);
  assert.equal(finished.find((row) => row.p_id === '1').p_provider_id, 'Leads!A2:T2');
  assert.equal(finished.find((row) => row.p_id === '2').p_result, 'unknown');
  assert.doesNotMatch(JSON.stringify(result), /service-key|PRIVATE KEY/);
});

test('the sheet account is the shared service account, and a different blob is ignored', () => {
  const key = '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----';
  const blob = (email) => Buffer.from(JSON.stringify({ client_email: email, private_key: key })).toString('base64');
  const base = {
    LEADS_SHEET_ENABLED: 'true', VERCEL_ENV: 'production', FF_TEST_RUN: 'false',
    FF_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co', FF_ALERT_SERVICE_KEY: 'service-key',
    LEADS_SHEET_ID: '1D75DSVCst4g5p0_Y4PiJXVsnFO5049nkfpLWt5KYx1A',
  };
  const matched = sheetConfig({ ...base, GOOGLE_SA_B64: blob(SHEET_SERVICE_ACCOUNT) });
  assert.equal(matched.ok, true);
  assert.equal(matched.email, 'posfin-sheets@posfin-sheets.iam.gserviceaccount.com');
  assert.equal(sheetCredentials({ GOOGLE_SA_B64: blob('other@other.iam.gserviceaccount.com') }), null);
  assert.equal(sheetConfig({ ...base, GOOGLE_SA_B64: blob('other@other.iam.gserviceaccount.com') }).ok, false);
  const explicit = sheetCredentials({ GOOGLE_SA_EMAIL: SHEET_SERVICE_ACCOUNT, GOOGLE_SA_PRIVATE_KEY: key });
  assert.equal(explicit.email, SHEET_SERVICE_ACCOUNT);
  assert.match(explicit.key, /BEGIN PRIVATE KEY/);
});
