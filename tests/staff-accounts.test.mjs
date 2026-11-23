import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { mapRegisterRow, mapRegisterRows } from '../lib/case-register.js';
import { filterOwner } from '../lib/pipeline.js';
import { renderPipeline } from '../lib/pipeline-html.js';
import { renderLiveCases } from '../lib/el-lor-html.js';
import { loadCaseRegister } from '../lib/case-register.js';
import { loadSeed } from '../lib/el-lor-seed.js';
import { previewPasswordAllowed, supabasePasswordLogin } from '../lib/staff-auth.js';
import { establishSession, sessionAllows } from '../lib/cockpit-store.js';
import { ownerSeat, seatEmail } from '../lib/staff-seats.js';
import { presentList } from '../lib/el-lor-desk.js';
import { createElLorStore } from '../lib/el-lor-store.js';

test('Chris Shipton keeps his own email and does not inherit Byron', () => {
  const chris = ownerSeat('Chris Shipton');
  assert.equal(chris.code, 'chris');
  assert.equal(seatEmail('chris'), 'chris.shipton@posfincapital.com');
  assert.equal(seatEmail('Chris'), 'chris.shipton@posfincapital.com');
  assert.notEqual(seatEmail('chris'), seatEmail('byron'));
  assert.equal(ownerSeat('byronhill739@gmail.com'), null);
  assert.equal(seatEmail('cai'), 'cai@posfincapital.com');
  assert.equal(seatEmail('vanessa'), 'vanessa@posfincapital.com');
  assert.equal(ownerSeat('cai@posfincapital.com').code, 'cai');
  assert.equal(ownerSeat('vanessa@posfincapital.com').role, 'case_owner');
});

test('the Chris seat filter matches Chris Shipton and stays off Byron', () => {
  const cards = [
    { owner: 'Chris Shipton', caseRef: 'TEST-A' },
    { owner: 'Chris', caseRef: 'TEST-B' },
    { owner: 'Byron Hill', caseRef: 'TEST-C' },
  ];
  assert.equal(filterOwner(cards, 'Chris').length, 2);
  assert.equal(filterOwner(cards, 'chris').length, 2);
  assert.equal(filterOwner(cards, 'Byron').length, 1);
  const html = renderPipeline(
    { columns: [], parked: [], completed: [] },
    { owner: 'chris', banner: 'Preview' },
  );
  assert.match(html, /owner=chris/);
  assert.match(html, /chris\.shipton@posfincapital\.com/);
  assert.equal(html.includes('byronhill739@gmail.com'), false);
  assert.equal(html.includes('mailto:byron'), false);
});

test('a register row for Chris does not take a stray mailbox as his seat', () => {
  const mapped = mapRegisterRow({
    case_ref: 'TEST-REG-001',
    case_label: 'Example Borrower',
    stage: 'factfind',
    owner: 'Chris Shipton',
    product: 'SOMO',
    email: 'borrower@example.invalid',
    case_flags: ['no_ai_contact'],
    external_refs: { broka_case_id: 'TEST-100', gross: 250000, retentions: 15000, net_release: 235000 },
    contact_email: 'byronhill739@gmail.com',
  });
  assert.equal(mapped.owner, 'Chris Shipton');
  assert.equal(mapped.seat_code, 'chris');
  assert.equal(mapped.seat_email, 'chris.shipton@posfincapital.com');
  assert.equal(mapped.email, 'borrower@example.invalid');
  assert.equal(mapped.money.gross, 250000);
  assert.equal(mapped.flags.includes('no_ai_contact'), true);
  const skipped = mapRegisterRows([{ case_label: 'No ref' }, mapped && {
    case_ref: 'TEST-REG-001', case_label: 'Example Borrower', stage: 'factfind', owner: 'Chris', product: 'SOMO',
  }]);
  assert.equal(skipped.skipped, 1);
  assert.equal(skipped.cases.length, 1);
});

test('the live desk owner link for Chris is his seat, not Byron', () => {
  const store = createElLorStore();
  store.useSeed([{
    case_ref: 'TEST-REG-001',
    is_test: true,
    label: 'Example Borrower',
    stage: 'Fact find',
    db_stage: 'factfind',
    owner: 'Chris Shipton',
    product: 'SOMO',
    email: 'borrower@example.invalid',
    postcode: 'AA1 1AA',
    flags: [],
    lender_exclusions: [],
    eligible_lenders: [],
    signatories: [{ name: 'Example Borrower', email: 'borrower@example.invalid', role: 'borrower' }],
    money: { gross: 1, retentions: 0, net_release: 1, fee_confirmed: false },
    el: { state: 'none' },
    lor: { state: 'none' },
    fact_find_submitted: true,
  }]);
  const list = presentList(store, { owner: 'chris' }, '2026-11-22T12:00:00.000Z', '');
  assert.equal(list.rows.length, 1);
  assert.equal(presentList(store, { owner: 'byron' }, '2026-11-22T12:00:00.000Z', '').rows.length, 0);
  const html = renderLiveCases(list);
  assert.match(html, /owner=chris/);
  assert.match(html, /chris\.shipton@posfincapital\.com/);
  assert.equal(html.includes('byronhill739@gmail.com'), false);
});

test('production refuses the shared preview password once individual login is on', async () => {
  const env = {
    VERCEL_ENV: 'production',
    STAFF_AUTH_MODE: 'supabase',
    COCKPIT_PREVIEW_PASSWORD: 'preview-desk',
    COCKPIT_SOURCE: 'preview',
  };
  assert.equal(previewPasswordAllowed(env), false);
  const blocked = await establishSession({ email: 'chris.shipton@posfincapital.com', password: 'preview-desk' }, { env, fetch: async () => { throw new Error('network'); } });
  assert.equal(blocked.ok, false);
  assert.notEqual(blocked.error, undefined);
  const preview = await establishSession('preview-desk', {
    env: { COCKPIT_SOURCE: 'preview', COCKPIT_AUTH: 'preview', COCKPIT_PREVIEW_PASSWORD: 'preview-desk' },
  });
  assert.equal(preview.ok, true);
  assert.equal(await sessionAllows(preview.session, { env }), false);
});

test('password login uses the anon key and the allowlist, and the service key stays off the page', async () => {
  const calls = [];
  const env = {
    STAFF_AUTH_MODE: 'supabase',
    VERCEL_ENV: 'preview',
    STAFF_SUPABASE_URL: 'https://example.test',
    STAFF_SUPABASE_ANON_KEY: 'anon-key',
    STAFF_SUPABASE_SERVICE_KEY: 'service-key-secret',
  };
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, headers: options.headers, body: options.body });
    if (String(url).includes('/auth/v1/token')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'access-token' }) };
    }
    if (String(url).includes('/auth/v1/user')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ email: 'chris.shipton@posfincapital.com' }) };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ email: 'chris.shipton@posfincapital.com', seat_code: 'chris', role: 'case_owner', active: true }]),
    };
  };
  const login = await supabasePasswordLogin('chris.shipton@posfincapital.com', 'unique-password', { env, fetch: fetchImpl });
  assert.equal(login.ok, true);
  assert.equal(login.seat, 'chris');
  assert.equal(login.session.startsWith('sb1.'), true);
  assert.equal(calls[0].headers.apikey, 'anon-key');
  assert.equal(JSON.stringify(calls[0]).includes('service-key-secret'), false);
  const allow = calls.find((call) => String(call.url).includes('/rpc/staff_caller'));
  assert.equal(allow.headers.Authorization, 'Bearer access-token');
  assert.equal(allow.headers.apikey, 'anon-key');
  assert.equal(allow.headers['Accept-Profile'], 'pipeline');
  assert.equal(JSON.stringify(calls).includes('service-key-secret'), false);
  assert.equal(await sessionAllows(login.session, { env, fetch: fetchImpl }), true);
  const html = renderLiveCases({ rows: [], total: 0, stages: [], owners: [], warning: '', query: {} });
  assert.equal(html.includes('service-key-secret'), false);
});

test('the case register is read with the staff session and fails closed', async () => {
  const calls = [];
  const env = {
    VERCEL_ENV: 'production',
    STAFF_SUPABASE_URL: 'https://example.test',
    STAFF_SUPABASE_ANON_KEY: 'anon-key',
    STAFF_SUPABASE_SERVICE_KEY: 'service-key-secret',
    SUPABASE_REVOLUT_API_KEY: 'revolut-secret',
  };
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), headers: options.headers || {}, body: options.body });
    if (calls.length === 1) {
      return { ok: false, status: 401, text: async () => '{"message":"not_allowed"}' };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{
        case_ref: 'TEST-REG-009',
        case_label: 'Example Borrower',
        stage: 'factfind',
        owner: 'Chris Shipton',
        product: 'SOMO',
        email: 'borrower@example.invalid',
      }]),
    };
  };
  const denied = await loadCaseRegister(env, fetchImpl, 'user-access');
  assert.equal(denied.ok, false);
  assert.deepEqual(denied.cases, []);
  assert.match(denied.warning, /not substituted/);
  const closed = await loadSeed(env, fetchImpl, 'user-access');
  assert.equal(closed.cases.some((row) => row.case_ref === 'TEST-EL-SOMO-001'), false);
  assert.equal(closed.cases[0].case_ref, 'TEST-REG-009');
  assert.equal(closed.cases[0].owner, 'Chris Shipton');
  const none = await loadCaseRegister(env, fetchImpl, '');
  assert.deepEqual(none.cases, []);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/rpc\/staff_case_register$/);
  assert.equal(calls[0].headers.apikey, 'anon-key');
  assert.equal(calls[0].headers.Authorization, 'Bearer user-access');
  assert.equal(calls[0].headers['Accept-Profile'], 'pipeline');
  assert.equal(calls[0].headers['Content-Profile'], 'pipeline');
  const sent = JSON.stringify(calls);
  assert.equal(sent.includes('service-key-secret'), false);
  assert.equal(sent.includes('revolut-secret'), false);
  const reader = readFileSync(new URL('../lib/case-register.js', import.meta.url), 'utf8');
  const auth = readFileSync(new URL('../lib/staff-auth.js', import.meta.url), 'utf8');
  assert.equal(reader.includes('STAFF_SUPABASE_SERVICE_KEY'), false);
  assert.equal(auth.includes('STAFF_SUPABASE_SERVICE_KEY'), false);
});
