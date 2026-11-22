import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleCockpit } from '../api/staff-cockpit.js';
import { handleSeat } from '../api/staff-seat.js';
import { mintPreviewSession, resetSharedPreviewStore } from '../lib/cockpit-store.js';
import { seatFlagName, seatViewEnabled } from '../lib/seat-flag.js';
import { dataMode, loadBook, resetSharedSeatStore } from '../lib/seat-store.js';
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

test('the chris flag is off by default, closed in production, and reusable for another seat', () => {
  assert.equal(seatFlagName('chris'), 'FEATURE_SEAT_VIEW_CHRIS');
  assert.equal(seatFlagName('geri'), 'FEATURE_SEAT_VIEW_GERI');
  assert.equal(seatViewEnabled({}, 'chris'), false);
  assert.equal(seatViewEnabled({ FEATURE_SEAT_VIEW_CHRIS: 'on', VERCEL_ENV: 'production' }, 'chris'), false);
  assert.equal(seatViewEnabled({ FEATURE_SEAT_VIEW_GERI: 'on' }, 'geri'), true);
  assert.equal(seatByCode('geri').name, 'Geri');
  assert.equal(dataMode({ VERCEL_ENV: 'production', SEAT_VIEW_SOURCE: 'supabase' }), 'closed');
  assert.equal(dataMode({ SEAT_VIEW_SOURCE: 'fixtures' }), 'fixtures');
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
  assert.equal(production.status, 404);
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
  assert.match(page.body, /data-task="chris:case:TEST-SEAT-001:2026-11-22"/);
  assert.equal(page.body.includes('chris:case:TEST-SEAT-002'), false);
  const dated = await call(null, { query: { seat: 'chris', from: '2026-11-18', source: 'all' } });
  assert.match(dated.body, /data-lead="lead-not-started"/);
  assert.equal(dated.body.includes('data-lead="lead-older"'), false);
  assert.equal(dated.body.includes('data-lead="lead-completed"'), false);
  assert.match(dated.body, /data-completed="lead-submitted"/);
  assert.equal(dated.body.includes('data-completed="lead-completed"'), false);
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

test('a live read that fails does not invent rows, and fixtures do not call the network', async () => {
  let calls = 0;
  const fixtures = await loadBook({
    SEAT_VIEW_SOURCE: 'fixtures',
    PIPELINE_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co',
    PIPELINE_SUPABASE_KEY: 'test-key-not-a-secret',
  }, { fetch: async () => { calls += 1; throw new Error('network'); } });
  assert.equal(calls, 0);
  assert.equal(fixtures.source, 'fixtures');
  assert.equal(fixtures.cases.length, 3);
  const failed = await loadBook({
    SEAT_VIEW_SOURCE: 'supabase',
    VERCEL_ENV: 'preview',
    PIPELINE_SUPABASE_URL: 'https://vgflcrfaudrvrdmxjdtl.supabase.co',
    PIPELINE_SUPABASE_KEY: 'test-key-not-a-secret',
  }, { fetch: async () => { throw new Error('offline'); } });
  assert.equal(failed.source, 'unavailable');
  assert.equal(failed.cases.length, 0);
  assert.match(failed.warning, /Nothing was substituted/);
});

test('the proposed answer table is additive and has not been applied by this test', () => {
  const sql = readFileSync(new URL('../supabase/proposed/20261122_seat_task_answers.sql', import.meta.url), 'utf8');
  assert.match(sql, /DO NOT APPLY/);
  assert.match(sql, /create table if not exists pipeline\.seat_task_answers/);
  assert.match(sql, /answer = any \(array\['yes', 'no', 'edit'\]\)/);
  assert.equal(/\bdrop\b|\bdelete\b|\btruncate\b/i.test(sql), false);
  assert.equal(/broker_fee|case_register/i.test(sql.replace(/does not alter pipeline\.case_register/, '')), false);
});
