import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleCockpit } from '../api/staff-cockpit.js';
import { handleSeat } from '../api/staff-seat.js';
import { mintPreviewSession, resetSharedPreviewStore } from '../lib/cockpit-store.js';
import { enabledSeatLinks, seatFlagName, seatViewEnabled } from '../lib/seat-flag.js';
import { renderSeatLogin } from '../lib/seat-html.js';
import { renderLogin } from '../lib/cockpit-html.js';
import { renderBrokaLogin } from '../lib/broka-html.js';
import { renderElLorLogin } from '../lib/el-lor-html.js';
import { renderFranceLogin } from '../lib/fr-desk-html.js';
import { renderPipelineLogin } from '../lib/pipeline-html.js';
import { dataMode, loadBook, resetSharedSeatStore, saveAnswer } from '../lib/seat-store.js';
import {
  factFindStand, fixtureBook, hiddenCaseKeys, presentSeat, seatByCode,
} from '../lib/seat-view.js';

const NOW = '2026-11-22T09:00:00.000Z';
const BASE = {
  COCKPIT_SOURCE: 'preview',
  COCKPIT_AUTH: 'preview',
  COCKPIT_PREVIEW_PASSWORD: 'preview-desk',
  SEAT_VIEW_SOURCE: 'fixtures',
};
const ON = { ...BASE, FEATURE_SEAT_VIEW_CHRIS: 'on' };

function response() {
  const headers = {};
  const res = {
    headers,
    body: '',
    status: 0,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    end(body) { this.body = body || ''; },
  };
  Object.defineProperty(res, 'statusCode', { set(value) { res.status = value; }, get() { return res.status; } });
  return res;
}

function cookie(env = ON) {
  return `pf_staff=${encodeURIComponent(mintPreviewSession(env))}`;
}

async function call(store, { method = 'GET', query = { seat: 'chris' }, body = {}, env = ON, session = true, book } = {}) {
  const res = response();
  const req = {
    method,
    url: `/staff/cockpit/seat/${query.seat || 'chris'}`,
    query,
    headers: { cookie: session ? cookie(env) : '' },
    body,
  };
  await handleSeat(req, res, {
    env,
    store,
    now: NOW,
    book: book || fixtureBook(),
    fetch: async () => { throw new Error('network'); },
  });
  return { status: res.status, body: res.body, location: res.headers.location || '', cookie: res.headers['set-cookie'] || '' };
}

test('fixtures stay synthetic and fact-find stands come from the lead and the fact find', () => {
  const book = fixtureBook();
  const blob = JSON.stringify(book);
  const emails = blob.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+/gi) || [];
  assert.ok(emails.length >= 5);
  assert.ok(emails.every((email) => email.endsWith('@example.invalid')));
  assert.ok(book.cases.every((item) => item.case_ref.startsWith('TEST-')));
  assert.equal(factFindStand({ status: 'new' }, null), 'not started');
  assert.equal(factFindStand({ status: 'statements_received' }, null), 'started');
  assert.equal(factFindStand({}, { form_stage: 'partial', form_step: 2 }), 'started');
  assert.equal(factFindStand({ source: 'web_factfind_uk' }, null), 'submitted');
  assert.equal(factFindStand({}, { form_stage: 'submitted', submitted_at: NOW }), 'submitted');
  assert.equal(factFindStand({ status: 'fact_find_complete' }, { form_stage: 'submitted' }), 'completed');
  const view = presentSeat({ ...book, seat: seatByCode('chris'), now: NOW, query: {} });
  assert.deepEqual(view.leads.map((lead) => [lead.id, lead.stand]), [
    ['lead-not-started', 'not started'],
    ['lead-started', 'started'],
    ['lead-submitted', 'submitted'],
    ['lead-completed', 'completed'],
    ['lead-older', 'not started'],
  ]);
  assert.deepEqual(view.completed.map((lead) => lead.id), ['lead-submitted', 'lead-completed']);
  assert.deepEqual(view.cases.map((item) => item.caseRef), ['TEST-SEAT-001', 'TEST-SEAT-002', 'TEST-SEAT-003']);
  assert.equal(view.cases.some((item) => item.owner === 'Jess'), true);
  assert.deepEqual(view.cases.map((item) => item.lender).filter(Boolean), ['Lender A', 'Lender B']);
  assert.equal(JSON.stringify(view.cases).includes('broker_fee'), false);
  assert.equal(JSON.stringify(view.cases).includes('1.25'), false);
  assert.ok(hiddenCaseKeys(book.cases[0]).includes('broker_fee_pct'));
  const filtered = presentSeat({ ...book, seat: seatByCode('chris'), now: NOW, query: { source: 'facebook', from: '2026-11-18' } });
  assert.deepEqual(filtered.leads.map((lead) => lead.id), ['lead-not-started']);
  assert.equal(filtered.completed.length, 0);
});

test('a seat flag opens on Production and fixtures stay off Production', () => {
  assert.equal(seatFlagName('chris'), 'FEATURE_SEAT_VIEW_CHRIS');
  assert.equal(seatFlagName('geri'), 'FEATURE_SEAT_VIEW_GERI');
  assert.equal(seatViewEnabled({}, 'chris'), false);
  assert.equal(seatViewEnabled({ VERCEL_ENV: 'production' }, 'chris'), false);
  assert.equal(seatViewEnabled({ FEATURE_SEAT_VIEW_CHRIS: 'on', VERCEL_ENV: 'production' }, 'chris'), true);
  assert.equal(seatViewEnabled({ FEATURE_SEAT_VIEW_GERI: 'on' }, 'geri'), true);
  assert.equal(seatByCode('geri').name, 'Geri');
  assert.equal(dataMode({ VERCEL_ENV: 'production', SEAT_VIEW_SOURCE: 'fixtures' }), 'unavailable');
  assert.equal(dataMode({ VERCEL_ENV: 'production', SEAT_VIEW_SOURCE: 'fixtures', STAFF_AUTH_MODE: 'supabase' }), 'session');
  assert.equal(dataMode({ SEAT_VIEW_SOURCE: 'fixtures' }), 'fixtures');
  assert.equal(dataMode({
    VERCEL_ENV: 'preview',
    FF_ALERT_SERVICE_KEY: 'service-key-secret',
    PIPELINE_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co',
    PIPELINE_SUPABASE_KEY: 'pipeline-secret',
  }), 'fixtures');
  assert.equal(dataMode({ VERCEL_ENV: 'preview', STAFF_AUTH_MODE: 'supabase' }), 'session');
  assert.equal(seatViewEnabled({ FEATURE_SEAT_VIEW_BYRON: 'on', VERCEL_ENV: 'preview' }, 'byron'), true);
  assert.equal(seatViewEnabled({ FEATURE_SEAT_VIEW_BYRON: 'on', VERCEL_ENV: 'production' }, 'byron'), true);
  assert.equal(seatByCode('vanessa').name, 'Vanessa');
  assert.equal(seatByCode('cai').name, 'Cai');
  const links = enabledSeatLinks({
    FEATURE_SEAT_VIEW_CHRIS: 'on',
    FEATURE_SEAT_VIEW_BYRON: 'on',
    FEATURE_SEAT_VIEW_JESS: 'on',
    FEATURE_SEAT_VIEW_AADI: 'on',
    FEATURE_SEAT_VIEW_CAI: 'on',
    FEATURE_SEAT_VIEW_VANESSA: 'on',
  });
  assert.deepEqual(links.map((item) => item.code), ['chris', 'byron', 'jess', 'aadi', 'cai', 'vanessa']);
  const pages = [
    renderSeatLogin('', '/staff/cockpit/seat/cai'),
    renderLogin(''),
    renderBrokaLogin(),
    renderElLorLogin('/staff/cockpit/live'),
    renderFranceLogin('', 'en'),
    renderPipelineLogin(),
  ];
  for (const html of pages) assert.match(html, /href="\/staff\/set-password">Forgot password\?/);
});

test('flag off leaves the cockpit nav unchanged and the seat route closed', async () => {
  resetSharedPreviewStore();
  resetSharedSeatStore();
  const board = response();
  await handleCockpit({
    method: 'GET',
    url: '/staff/cockpit',
    query: {},
    headers: { cookie: cookie(BASE) },
  }, board, { env: BASE, now: NOW, fetch: async () => { throw new Error('network'); } });
  assert.equal(board.status, 200);
  assert.equal(board.body.includes('/staff/cockpit/seat/'), false);
  assert.match(board.body, /<div class="bar"><a href="\/staff\/cases">Cases<\/a><a href="\/staff\/france">France desk<\/a><a href="\/staff\/cockpit\/pipeline">Pipeline<\/a><a href="\/staff\/cockpit\/broka\/scorecard">Scorecard<\/a><a href="\/staff\/cockpit\/spine\/POSFIN-WEB-EYCTQ6">Stage-2 spine<\/a><a href="\/staff\/cockpit\?view=lizzy"/);
  const closed = await call(null, { env: BASE });
  assert.equal(closed.status, 404);
  assert.match(closed.body, /switched off/);
  const production = await call(null, { env: { ...ON, VERCEL_ENV: 'production' } });
  assert.equal(production.status, 401);
  assert.match(production.body, /Sample cards are not shown/);
  assert.equal(production.body.includes('Pat Example'), false);
  assert.equal(production.body.includes('TEST-SEAT-'), false);
  const unknown = await call(null, { query: { seat: 'not-a-seat' } });
  assert.equal(unknown.status, 404);
  assert.match(unknown.body, /not on this desk/);
  const anon = await call(null, { session: false });
  assert.equal(anon.status, 401);
});

test('the four sections render from fixtures and the cockpit links Chris when the flag is on', async () => {
  resetSharedPreviewStore();
  const board = response();
  await handleCockpit({
    method: 'GET',
    url: '/staff/cockpit',
    query: {},
    headers: { cookie: cookie(ON) },
  }, board, { env: ON, now: NOW, fetch: async () => { throw new Error('network'); } });
  assert.match(board.body, /data-tab="seat-chris"/);
  assert.match(board.body, /href="\/staff\/set-password\?change=1">Change password/);
  const page = await call(null);
  assert.equal(page.status, 200);
  assert.match(page.body, /id="raw-leads"/);
  assert.match(page.body, /id="completed-fact-finds"/);
  assert.match(page.body, /id="live-cases"/);
  assert.match(page.body, /id="daily-tasks"/);
  assert.match(page.body, /data-lead="lead-not-started"[^>]*data-stand="not started"/);
  assert.match(page.body, /data-lead="lead-started"[^>]*data-stand="started"/);
  assert.match(page.body, /data-completed="lead-submitted"/);
  assert.match(page.body, /data-completed="lead-completed"/);
  assert.match(page.body, /data-case="TEST-SEAT-002"[^>]*data-owner="Jess"/);
  assert.match(page.body, /data-seed="migration_20261122"/);
  assert.match(page.body, /Lender A/);
  assert.match(page.body, /Lender B/);
  assert.equal(page.body.includes('Example Harbour'), false);
  assert.equal(page.body.includes('Example North'), false);
  assert.equal(page.body.includes('broker_fee'), false);
  assert.equal(page.body.includes('1.25'), false);
  assert.match(page.body, /Same sheet for Byron's seat/);
  assert.match(page.body, /href="\/staff\/set-password\?change=1">Change password/);
  assert.match(page.body, /data-task="chris:case:TEST-SEAT-001:2026-11-22"/);
  assert.equal(page.body.includes('chris:case:TEST-SEAT-002'), false);
  const dated = await call(null, { query: { seat: 'chris', from: '2026-11-18', source: 'all' } });
  assert.match(dated.body, /data-lead="lead-not-started"/);
  assert.equal(dated.body.includes('data-lead="lead-older"'), false);
  assert.equal(dated.body.includes('data-lead="lead-completed"'), false);
  assert.match(dated.body, /data-completed="lead-submitted"/);
  assert.equal(dated.body.includes('data-completed="lead-completed"'), false);
  assert.equal(board.body.includes('data-tab="seat-byron"'), false);
  const byronOff = await call(null, { query: { seat: 'byron' } });
  assert.equal(byronOff.status, 404);
  assert.match(byronOff.body, /switched off/);
});

test('Yes, No and Edit persist on the seat and Byron reads the same answers', async () => {
  const { createSeatStore } = await import('../lib/seat-store.js');
  const store = createSeatStore();
  const yes = await call(store, {
    method: 'POST',
    body: { action: 'yes', task_id: 'chris:case:TEST-SEAT-001:2026-11-22', actor: 'Byron Hill', seat: 'chris' },
  });
  assert.equal(yes.status, 303);
  const no = await call(store, {
    method: 'POST',
    body: { action: 'no', task_id: 'chris:lead:lead-not-started:2026-11-22', actor: 'Chris Shipton', seat: 'chris' },
  });
  assert.equal(no.status, 303);
  const edit = await call(store, {
    method: 'POST',
    body: { action: 'edit', task_id: 'chris:case:TEST-SEAT-003:2026-11-22', actor: 'Chris Shipton', seat: 'chris' },
  });
  assert.equal(edit.status, 303);
  assert.match(edit.location, /edit=chris/);
  const open = await call(store, { query: { seat: 'chris', edit: 'chris:case:TEST-SEAT-003:2026-11-22' } });
  assert.match(open.body, /name="edited_text"/);
  const saved = await call(store, {
    method: 'POST',
    body: {
      action: 'save-edit',
      task_id: 'chris:case:TEST-SEAT-003:2026-11-22',
      actor: 'Byron Hill',
      edited_text: 'Ring the example office',
      seat: 'chris',
    },
  });
  assert.equal(saved.status, 303);
  const again = await call(store);
  assert.match(again.body, /data-task="chris:case:TEST-SEAT-001:2026-11-22" data-answer="yes"/);
  assert.match(again.body, /Byron Hill/);
  assert.match(again.body, /data-task="chris:lead:lead-not-started:2026-11-22" data-answer="no"/);
  assert.match(again.body, /data-task="chris:case:TEST-SEAT-003:2026-11-22" data-answer="edit"/);
  assert.match(again.body, /Ring the example office/);
  const refused = await call(store, {
    method: 'POST',
    body: { action: 'send', task_id: 'chris:case:TEST-SEAT-001:2026-11-22', actor: 'Byron Hill' },
  });
  assert.equal(refused.status, 400);
  assert.match(refused.body, /does not send/);
});

test('another seat reuses the same four sections and still sees every case', async () => {
  const env = { ...BASE, FEATURE_SEAT_VIEW_GERI: 'on' };
  const page = await call(null, { env, query: { seat: 'geri' } });
  assert.equal(page.status, 200);
  assert.match(page.body, /Geri's seat/);
  assert.match(page.body, /id="raw-leads"/);
  assert.match(page.body, /id="completed-fact-finds"/);
  assert.match(page.body, /id="live-cases"/);
  assert.match(page.body, /id="daily-tasks"/);
  assert.match(page.body, /data-case="TEST-SEAT-001"/);
  assert.match(page.body, /data-case="TEST-SEAT-002"/);
  assert.match(page.body, /No next actions for this seat today/);
  const chrisOff = await call(null, { env, query: { seat: 'chris' } });
  assert.equal(chrisOff.status, 404);
});

test('a service key is ignored and sample cards stay on when individual sign-in is off', async () => {
  let calls = 0;
  const fixtures = await loadBook({
    VERCEL_ENV: 'preview',
    SEAT_VIEW_SOURCE: 'fixtures',
    STAFF_AUTH_MODE: 'supabase',
    STAFF_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co',
    STAFF_SUPABASE_ANON_KEY: 'anon-key',
    FF_ALERT_SERVICE_KEY: 'service-key-secret',
    PIPELINE_SUPABASE_KEY: 'pipeline-secret',
  }, { fetch: async () => { calls += 1; throw new Error('network'); }, accessToken: 'user-access' });
  assert.equal(calls, 0);
  assert.equal(fixtures.source, 'fixtures');
  assert.equal(fixtures.cases.length, 3);
  const samples = await loadBook({
    VERCEL_ENV: 'preview',
    PIPELINE_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co',
    FF_ALERT_SERVICE_KEY: 'service-key-secret',
  }, { fetch: async () => { calls += 1; throw new Error('network'); } });
  assert.equal(calls, 0);
  assert.equal(samples.source, 'fixtures');
  assert.match(samples.warning, /samples/);
  const reader = readFileSync(new URL('../lib/seat-store.js', import.meta.url), 'utf8');
  assert.equal(reader.includes('FF_ALERT_SERVICE_KEY'), false);
  assert.equal(reader.includes('PIPELINE_SUPABASE_KEY'), false);
  assert.equal(reader.includes('SERVICE_ROLE'), false);
  assert.equal(reader.includes('service_role'), false);
});

test('both seat flags can be on, and Byron sees the same sample cases', async () => {
  resetSharedPreviewStore();
  const env = { ...ON, FEATURE_SEAT_VIEW_BYRON: 'on' };
  const board = response();
  await handleCockpit({
    method: 'GET',
    url: '/staff/cockpit',
    query: {},
    headers: { cookie: cookie(env) },
  }, board, { env, now: NOW, fetch: async () => { throw new Error('network'); } });
  assert.match(board.body, /data-tab="seat-chris"/);
  assert.match(board.body, /data-tab="seat-byron"/);
  const byron = await call(null, { env, query: { seat: 'byron' } });
  assert.equal(byron.status, 200);
  assert.match(byron.body, /Byron Hill's seat/);
  assert.equal(byron.body.includes('switched off'), false);
  assert.match(byron.body, /data-case="TEST-SEAT-001"/);
  assert.match(byron.body, /data-case="TEST-SEAT-002"/);
  assert.match(byron.body, /No next actions for this seat today/);
});

function sessionFetch(calls, rows) {
  return async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body || '' });
    const target = String(url);
    const json = (status, payload) => ({ ok: status < 400, status, text: async () => (payload == null ? '' : JSON.stringify(payload)) });
    if (target.includes('/auth/v1/token')) return json(200, { access_token: 'user-access' });
    if (target.includes('/auth/v1/user')) return json(200, { email: 'chris.shipton@posfincapital.com' });
    if (target.includes('/rpc/staff_caller')) {
      return json(200, [{ email: 'chris.shipton@posfincapital.com', seat_code: 'chris', role: 'case_owner' }]);
    }
    if (target.includes('/rpc/staff_case_register')) return json(200, rows);
    if (target.includes('/rest/v1/leads') || target.includes('/rest/v1/web_leads')) return json(401, { message: 'permission denied' });
    if (target.includes('/rest/v1/seat_task_answers')) return json(404, { message: 'not found' });
    return json(500, { message: 'unexpected' });
  };
}

const LIVE_ENV = {
  VERCEL_ENV: 'preview',
  STAFF_AUTH_MODE: 'supabase',
  STAFF_SUPABASE_URL: 'https://example.test',
  STAFF_SUPABASE_ANON_KEY: 'anon-key',
  FF_ALERT_SERVICE_KEY: 'service-key-secret',
  PIPELINE_SUPABASE_KEY: 'pipeline-secret',
  FEATURE_SEAT_VIEW_CHRIS: 'on',
  FEATURE_SEAT_VIEW_BYRON: 'on',
};

test('a signed-in session reads the register and does not substitute sample leads', async () => {
  const calls = [];
  const fetchImpl = sessionFetch(calls, [{
    case_ref: 'TEST-MIG-001',
    case_label: 'Example file',
    stage: 'factfind',
    status: 'open',
    owner: 'Chris Shipton',
    next_action_summary: 'Call the example contact',
    seed_source: 'migration_20261122',
    existing_lender_label: 'Example Harbour',
    broker_fee_pct: 1.5,
    created_at: '2026-11-22T08:00:00.000Z',
  }, {
    case_ref: 'TEST-OTHER',
    case_label: 'Other file',
    stage: 'enquiry',
    seed_source: 'other',
    broker_fee_pct: 9,
  }]);
  const book = await loadBook(LIVE_ENV, { fetch: fetchImpl, accessToken: 'user-access' });
  assert.equal(book.source, 'live');
  assert.equal(book.casesAvailable, true);
  assert.equal(book.leadsAvailable, false);
  assert.deepEqual(book.cases.map((row) => row.case_ref), ['TEST-MIG-001']);
  assert.equal(JSON.stringify(book).includes('broker_fee'), false);
  assert.equal(JSON.stringify(book).includes('1.5'), false);
  assert.equal(JSON.stringify(book).includes('service-key-secret'), false);
  const rpc = calls.find((item) => item.url.includes('/rpc/staff_case_register'));
  assert.equal(rpc.headers.apikey, 'anon-key');
  assert.equal(rpc.headers.Authorization, 'Bearer user-access');
  assert.equal(rpc.headers['Accept-Profile'], 'pipeline');
  assert.equal(JSON.stringify(calls).includes('service-key-secret'), false);
  assert.equal(JSON.stringify(calls).includes('pipeline-secret'), false);
  const failed = await loadBook(LIVE_ENV, { fetch: async () => { throw new Error('offline'); }, accessToken: 'user-access' });
  assert.equal(failed.source, 'unavailable');
  assert.equal(failed.cases.length, 0);
  assert.match(failed.warning, /not substituted/);

  const res = response();
  await handleSeat({
    method: 'GET',
    url: '/staff/cockpit/seat/byron',
    query: { seat: 'byron' },
    headers: { cookie: `pf_staff=${encodeURIComponent('sb1.user-access')}` },
  }, res, { env: LIVE_ENV, now: NOW, fetch: fetchImpl });
  assert.equal(res.status, 200);
  assert.match(res.body, /Byron Hill's seat/);
  assert.match(res.body, /data-case="TEST-MIG-001"/);
  assert.match(res.body, /data-leads="unavailable"/);
  assert.equal(res.body.includes('Example Harbour'), false);
  assert.equal(res.body.includes('Pat Example'), false);
  assert.equal(res.body.includes('broker_fee'), false);
  assert.equal(res.body.includes('switched off'), false);
});

test('individual sign-in refuses the shared preview password', async () => {
  const calls = [];
  const res = response();
  await handleSeat({
    method: 'POST',
    url: '/staff/cockpit/seat/chris',
    query: { seat: 'chris' },
    headers: {},
    body: { email: 'chris.shipton@posfincapital.com', password: 'preview-desk' },
  }, res, {
    env: {
      ...LIVE_ENV,
      COCKPIT_SOURCE: 'preview',
      COCKPIT_AUTH: 'preview',
      COCKPIT_PREVIEW_PASSWORD: 'preview-desk',
    },
    fetch: async (url, options = {}) => {
      calls.push({ url: String(url), headers: options.headers || {}, body: options.body || '' });
      return { ok: false, status: 401, text: async () => '{"error":"invalid_grant"}' };
    },
  });
  assert.equal(res.status, 401);
  assert.match(res.body, /not recognised/);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/auth\/v1\/token/);
  assert.equal(calls[0].headers.apikey, 'anon-key');
  assert.equal(JSON.stringify(calls).includes('service-key-secret'), false);
  assert.equal(JSON.stringify(calls).includes('pipeline-secret'), false);
});

test('Production asks anonymous visitors to sign in, refuses the shared password, and strips fees', async () => {
  const env = {
    ...LIVE_ENV,
    VERCEL_ENV: 'production',
    SEAT_VIEW_SOURCE: 'fixtures',
    COCKPIT_SOURCE: 'preview',
    COCKPIT_AUTH: 'preview',
    COCKPIT_PREVIEW_PASSWORD: 'preview-desk',
  };
  let reads = 0;
  const anon = response();
  await handleSeat({
    method: 'GET',
    url: '/staff/cockpit/seat/chris',
    query: { seat: 'chris' },
    headers: {},
  }, anon, {
    env,
    now: NOW,
    book: fixtureBook(),
    fetch: async () => { reads += 1; throw new Error('network'); },
  });
  assert.equal(anon.status, 401);
  assert.match(anon.body, /Work email/);
  assert.match(anon.body, /Staff password/);
  assert.equal(anon.body.includes('Pat Example'), false);
  assert.equal(anon.body.includes('TEST-SEAT-'), false);
  assert.equal(reads, 0);
  const forced = await loadBook(env, { book: fixtureBook(), fetch: async () => { reads += 1; throw new Error('network'); } });
  assert.equal(forced.source, 'unavailable');
  assert.equal(forced.cases.length, 0);
  assert.equal(reads, 0);

  const calls = [];
  const refused = response();
  await handleSeat({
    method: 'POST',
    url: '/staff/cockpit/seat/chris',
    query: { seat: 'chris' },
    headers: {},
    body: { email: 'chris.shipton@posfincapital.com', password: 'preview-desk' },
  }, refused, {
    env,
    fetch: async (url, options = {}) => {
      calls.push({ url: String(url), headers: options.headers || {} });
      return { ok: false, status: 401, text: async () => '{"error":"invalid_grant"}' };
    },
  });
  assert.equal(refused.status, 401);
  assert.match(refused.body, /not recognised/);
  assert.equal(String(refused.headers['set-cookie'] || '').includes('pv.'), false);
  assert.equal(JSON.stringify(calls).includes('service-key-secret'), false);

  const seen = [];
  const page = response();
  await handleSeat({
    method: 'GET',
    url: '/staff/cockpit/seat/chris',
    query: { seat: 'chris' },
    headers: { cookie: `pf_staff=${encodeURIComponent('sb1.user-access')}` },
  }, page, {
    env,
    now: NOW,
    book: fixtureBook(),
    fetch: sessionFetch(seen, [{
      case_ref: 'TEST-MIG-001',
      case_label: 'Example file',
      stage: 'factfind',
      owner: 'Chris Shipton',
      next_action_summary: 'Call the example contact',
      seed_source: 'migration_20261122',
      existing_lender_label: 'Example Harbour',
      broker_fee_pct: 1.5,
      created_at: '2026-11-22T08:00:00.000Z',
    }]),
  });
  assert.equal(page.status, 200);
  assert.match(page.body, /data-case="TEST-MIG-001"/);
  assert.equal(page.body.includes('broker_fee'), false);
  assert.equal(page.body.includes('1.5'), false);
  assert.equal(page.body.includes('Example Harbour'), false);
  assert.equal(page.body.includes('Pat Example'), false);
  assert.equal(page.body.includes('TEST-SEAT-'), false);
  const rpc = seen.find((item) => item.url.includes('staff_case_register'));
  assert.equal(rpc.headers.Authorization, 'Bearer user-access');
  assert.equal(rpc.headers.apikey, 'anon-key');
});

test('answer writes use the staff session and stay in the browser when the table is absent', async () => {
  const calls = [];
  const fetchImpl = sessionFetch(calls, []);
  const { createSeatStore } = await import('../lib/seat-store.js');
  const store = createSeatStore();
  const row = {
    id: 'chris:case:TEST-MIG-001:2026-11-22',
    seat: 'chris',
    kind: 'case',
    subjectId: 'TEST-MIG-001',
    taskDate: '2026-11-22',
    prompt: 'Call the example contact',
    answer: 'yes',
    editedText: '',
    answeredBy: 'Chris Shipton',
    at: NOW,
  };
  const saved = await saveAnswer(LIVE_ENV, row, { fetch: fetchImpl, accessToken: 'user-access', store });
  assert.equal(saved.ok, true);
  assert.equal(saved.stored, 'session');
  assert.equal(saved.schemaPending, true);
  const write = calls.filter((item) => item.url.includes('seat_task_answers'));
  assert.equal(write.length, 1);
  assert.equal(write[0].headers.apikey, 'anon-key');
  assert.equal(write[0].headers.Authorization, 'Bearer user-access');
  assert.equal(JSON.stringify(write).includes('service-key-secret'), false);
  assert.equal(store.list()[0].answer, 'yes');
});

test('the proposed answer table is additive and has not been applied by this test', () => {
  const sql = readFileSync(new URL('../supabase/proposed/20261122_seat_task_answers.sql', import.meta.url), 'utf8');
  assert.match(sql, /DO NOT APPLY/);
  assert.match(sql, /create table if not exists pipeline\.seat_task_answers/);
  assert.match(sql, /answer = any \(array\['yes', 'no', 'edit'\]\)/);
  assert.equal(/\bdrop\b|\bdelete\b|\btruncate\b/i.test(sql), false);
  assert.equal(/broker_fee|case_register/i.test(sql.replace(/does not alter pipeline\.case_register/, '')), false);
});
