import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleCockpit } from '../api/staff-cockpit.js';
import { handleElLorDesk } from '../api/el-lor-desk.js';
import { dispatchAdapter, sendsAreMock } from '../lib/el-lor-adapters.js';
import { checkEngagementLetter, checkLenderCopy, offeredLenders } from '../lib/el-lor-check.js';
import { buildEngagementLetter, buildLenderCopy } from '../lib/el-lor-templates.js';
import { elLorEnabled } from '../lib/el-lor-flag.js';
import { loadSeed, readFixtureSeed, validateSeed } from '../lib/el-lor-seed.js';
import { createElLorStore } from '../lib/el-lor-store.js';
import { mintPreviewSession, resetSharedPreviewStore } from '../lib/cockpit-store.js';
import { PROCESSING_TASK } from '../lib/el-lor-config.js';

const NOW = '2026-11-22T00:30:00.000Z';
const BASE = {
  COCKPIT_SOURCE: 'preview',
  COCKPIT_AUTH: 'preview',
  COCKPIT_PREVIEW_PASSWORD: 'preview-desk',
  EL_LOR_LIVE_SENDS: 'off',
};
const ON = { ...BASE, FEATURE_EL_LOR_DESK: 'on' };

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

async function call(store, { method = 'GET', query = {}, body = {}, env = ON, cookie = true, fetchImpl } = {}) {
  const res = response();
  const networkLog = [];
  let fetches = 0;
  const fetch = fetchImpl || (async () => { fetches += 1; throw new Error('network'); });
  const req = {
    method,
    url: '/staff/cockpit/live',
    query,
    headers: { cookie: cookie ? `pf_staff=${encodeURIComponent(mintPreviewSession(env))}` : '' },
    body,
  };
  await handleElLorDesk(req, res, { env, store, now: NOW, fetch, networkLog });
  return { status: res.status, body: res.body, location: res.headers.location || '', networkLog, fetches };
}

async function follow(store, location, env = ON) {
  const url = new URL(location, 'http://127.0.0.1');
  const query = Object.fromEntries(url.searchParams);
  const match = url.pathname.match(/\/el\/([^/]+)$/);
  if (match) query.case = decodeURIComponent(match[1]);
  return call(store, { query, env });
}

function row(html, ref) {
  const match = html.match(new RegExp(`<tr data-case="${ref}"[\\s\\S]*?</tr>`));
  assert.ok(match, ref);
  return match[0];
}

test('committed fixtures are TEST cases and the loader degrades when the seed URL is unset', async () => {
  const raw = readFileSync(new URL('../fixtures/el-lor-test-seed.json', import.meta.url), 'utf8');
  assert.equal(/internal_private|CIFAS|\bBACS\b|Artie|@(?!example\.invalid)/i.test(raw), false);
  const validated = validateSeed(readFixtureSeed(), { committed: true });
  assert.equal(validated.ok, true);
  assert.deepEqual(validated.cases.map((item) => item.case_ref), [
    'TEST-EL-SOMO-001', 'TEST-LOR-BROKA-002', 'TEST-SIGNED-003', 'TEST-NOAI-004',
  ]);
  const loaded = await loadSeed({ ...ON });
  assert.equal(loaded.source, 'fixtures');
  assert.match(loaded.warning, /unset/);
  assert.equal(loaded.cases.length, 4);
  const failed = await loadSeed({ ...ON, EL_LOR_SEED_JSON_URL: 'https://seed.example.invalid/missing.json' }, async () => {
    throw new Error('offline');
  });
  assert.equal(failed.cases.length, 4);
  assert.match(failed.warning, /unreachable/);
  assert.equal(elLorEnabled({}), false);
  assert.equal(elLorEnabled({ VERCEL_ENV: 'preview' }), true);
  assert.equal(elLorEnabled({ VERCEL_ENV: 'preview', FEATURE_EL_LOR_DESK: 'off' }), false);
  assert.equal(elLorEnabled({ VERCEL_ENV: 'production' }), false);
  assert.equal(sendsAreMock({ COCKPIT_SOURCE: 'supabase', VERCEL_ENV: 'preview', EL_LOR_LIVE_SENDS: 'on' }), true);
});

test('flag off leaves the cockpit nav byte-for-byte and the desk route closed', async () => {
  resetSharedPreviewStore();
  const res = response();
  await handleCockpit({
    method: 'GET',
    url: '/staff/cockpit',
    query: {},
    headers: { cookie: `pf_staff=${encodeURIComponent(mintPreviewSession(BASE))}` },
  }, res, { env: BASE, now: NOW, fetch: async () => { throw new Error('network'); } });
  assert.equal(res.status, 200);
  assert.equal(res.body.includes('/staff/cockpit/live'), false);
  assert.match(res.body, /<div class="bar"><a href="\/staff\/cases">Cases<\/a><a href="\/staff\/france">France desk<\/a><a href="\/staff\/cockpit\/pipeline">Pipeline<\/a><a href="\/staff\/cockpit\/broka\/scorecard">Scorecard<\/a><a href="\/staff\/cockpit\/spine\/POSFIN-WEB-EYCTQ6">Stage-2 spine<\/a><a href="\/staff\/cockpit\?view=lizzy"/);
  const closed = await call(createElLorStore(), { env: BASE });
  assert.equal(closed.status, 404);
  assert.match(closed.body, /switched off/);
});

test('live cases list the TEST rows and the chips match the seed', async () => {
  const store = createElLorStore();
  const page = await call(store);
  assert.equal(page.status, 200);
  assert.equal(page.fetches, 0);
  const somo = row(page.body, 'TEST-EL-SOMO-001');
  assert.match(somo, /data-el-chip>None</);
  assert.match(somo, /data-lor-chip>Pre-LOR v1</);
  const broka = row(page.body, 'TEST-LOR-BROKA-002');
  assert.match(broka, /TEST-22999/);
  assert.match(broka, /data-eligible>6</);
  assert.match(row(page.body, 'TEST-SIGNED-003'), /data-el-chip>Sent v1</);
  assert.match(row(page.body, 'TEST-NOAI-004'), /no_ai_contact/);
  for (const ref of ['TEST-EL-SOMO-001', 'TEST-LOR-BROKA-002', 'TEST-SIGNED-003', 'TEST-NOAI-004']) {
    const opened = await call(store, { query: { case: ref } });
    assert.equal(opened.status, 200, ref);
    assert.equal(/internal_private/i.test(opened.body), false);
  }
});

test('engagement letter generates, blocks injected wording, views, and reaches a signed Processing move without a network call', async () => {
  const store = createElLorStore();
  const blocked = await call(store, {
    method: 'POST',
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'generate-el', seat: 'byron', inject: 'CIFAS\nBACS\nArtie' },
  });
  assert.equal(blocked.status, 400);
  assert.match(blocked.body, /data-block="marker-c"/);
  assert.match(blocked.body, /data-block="payment-rail"/);
  assert.match(blocked.body, /data-block="team-name"/);
  assert.equal(/\bCIFAS\b|\bBACS\b|\bArtie\b/.test(blocked.body), false);
  assert.equal(store.documentsFor('TEST-EL-SOMO-001').some((doc) => doc.audience === 'client'), false);

  const drafted = await call(store, {
    method: 'POST',
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'generate-el', seat: 'byron' },
  });
  assert.equal(drafted.status, 303);
  const draftPage = await follow(store, drafted.location);
  assert.match(draftPage.body, /Draft v1/);
  assert.match(draftPage.body, /\[FOR BYRON TO CONFIRM\]/);
  assert.match(draftPage.body, /data-processing="blocked"/);
  assert.match(draftPage.body, /not signed by every signer/);

  const viewed = await call(store, { query: { case: 'TEST-EL-SOMO-001', doc: 'el' } });
  assert.equal(viewed.status, 200);
  assert.match(viewed.body, /By signing below/);
  assert.match(viewed.body, /\[sig\|req\|signer1\]/);
  assert.match(viewed.body, /\[FOR BYRON TO CONFIRM\]/);
  assert.match(viewed.body, /File held privately: request copy/);
  assert.equal(/internal_private/i.test(viewed.body), false);

  const asked = await call(store, {
    method: 'POST',
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'request-esign', seat: 'byron' },
  });
  const pending = await follow(store, asked.location);
  const approval = pending.body.match(/data-approval="([^"]+)"/);
  assert.ok(approval);
  const denied = await call(store, {
    method: 'POST',
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'approve', seat: 'jess', approval_id: approval[1] },
  });
  assert.equal(denied.status, 403);
  const markDenied = await call(store, {
    method: 'POST',
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'mark-signed', seat: 'jess', file_name: 'TEST-letter.pdf' },
  });
  assert.equal(markDenied.status, 403);

  const approved = await call(store, {
    method: 'POST',
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'approve', seat: 'byron', approval_id: approval[1] },
  });
  assert.equal(approved.fetches, 0);
  assert.equal(approved.networkLog.every((item) => item.network === false && item.mode === 'mock'), true);
  assert.equal(approved.networkLog.some((item) => item.name === 'highlevel'), true);
  const sent = await follow(store, approved.location);
  assert.match(sent.body, /Sent v1/);
  assert.match(sent.body, /HL-TEST-TEST-EL-SOMO-001-v1/);
  assert.match(sent.body, /data-processing="blocked"/);

  const seen = await call(store, {
    method: 'POST',
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'simulate-viewed', seat: 'byron' },
  });
  const seenPage = await follow(store, seen.location);
  assert.match(seenPage.body, /data-el-chip>Viewed</);
  assert.match(seenPage.body, /Europe\/Paris/);
  assert.match(seenPage.body, /01:30/);

  const signed = await call(store, {
    method: 'POST',
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'simulate-signed', seat: 'byron' },
  });
  const signedPage = await follow(store, signed.location);
  assert.match(signedPage.body, /data-el-chip>Signed v1</);
  assert.match(signedPage.body, /data-processing="ready"/);
  assert.match(signedPage.body, /Example Borrower/);
  assert.match(signedPage.body, /01:30/);

  const moved = await call(store, {
    method: 'POST',
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'move-processing', seat: 'byron' },
  });
  assert.equal(moved.networkLog.filter((item) => item.name !== 'highlevel').length, 0);
  const done = await follow(store, moved.location);
  assert.match(done.body, /Processing/);
  assert.match(done.body, /database application/);
  assert.match(done.body, new RegExp(PROCESSING_TASK));
  assert.match(done.body, /data-audit/);
  assert.match(done.body, /application/);
  const event = store.eventsFor('TEST-EL-SOMO-001').find((item) => item.label === 'Processing');
  assert.equal(event.to_stage, 'application');
  assert.equal(store.auditsFor('TEST-EL-SOMO-001').length, 1);
  assert.equal(store.tasksFor('TEST-EL-SOMO-001').some((item) => item.title === PROCESSING_TASK), true);
});

test('lender copy, baseline stack, exclusion list and sent log stay inside the mock store', async () => {
  const store = createElLorStore();
  const poisoned = await call(store, {
    method: 'POST',
    query: { case: 'TEST-LOR-BROKA-002' },
    body: { action: 'generate-lor', seat: 'byron', inject: 'broker fee 2%' },
  });
  assert.equal(poisoned.status, 400);
  assert.match(poisoned.body, /data-block="fee-wording"/);
  assert.equal(/broker fee 2%/i.test(poisoned.body), false);
  assert.equal(store.documentsFor('TEST-LOR-BROKA-002').some((doc) => doc.audience === 'lender'), false);

  const drafted = await call(store, {
    method: 'POST',
    query: { case: 'TEST-LOR-BROKA-002' },
    body: { action: 'generate-lor', seat: 'jess' },
  });
  assert.equal(drafted.status, 303);
  const view = await call(store, { query: { case: 'TEST-LOR-BROKA-002', doc: 'lor' } });
  assert.equal(view.status, 200);
  assert.match(view.body, /Lender copy/);
  assert.equal(/broker fee|procuration|commission|introducer|internal_private/i.test(view.body), false);

  const page = await call(store, { query: { case: 'TEST-LOR-BROKA-002' } });
  const baselines = page.body.match(/data-baseline="true"/g) || [];
  assert.equal(baselines.length, 4);
  assert.match(page.body, /Submit to BROKA \(eligibility check\)/);
  assert.match(page.body, /TEST-22999/);
  assert.equal(page.body.includes('value="Excluded Lender Ltd"'), false);
  assert.equal(page.body.includes('value="MT-12"'), false);
  assert.equal(/internal_private/i.test(page.body), false);

  const excluded = await call(store, {
    method: 'POST',
    query: { case: 'TEST-LOR-BROKA-002' },
    body: { action: 'request-lor-send', seat: 'jess', lenders: ['Excluded Lender Ltd', 'Invocap'] },
  });
  assert.equal(excluded.status, 400);
  assert.equal(store.approvalsFor('TEST-LOR-BROKA-002').length, 0);

  const asked = await call(store, {
    method: 'POST',
    query: { case: 'TEST-LOR-BROKA-002' },
    body: { action: 'request-lor-send', seat: 'jess', lenders: ['Invocap', 'TAB', 'Dantis'] },
  });
  const pending = await follow(store, asked.location);
  const approval = pending.body.match(/data-approval="([^"]+)"/);
  const stranger = await call(store, {
    method: 'POST',
    query: { case: 'TEST-LOR-BROKA-002' },
    body: { action: 'approve', seat: 'jess', approval_id: approval[1] },
  });
  assert.equal(stranger.status, 403);
  const approved = await call(store, {
    method: 'POST',
    query: { case: 'TEST-LOR-BROKA-002' },
    body: { action: 'approve', seat: 'byron', approval_id: approval[1] },
  });
  assert.equal(approved.fetches, 0);
  assert.deepEqual(approved.networkLog.map((item) => item.name), ['lender_email']);
  const sent = await follow(store, approved.location);
  assert.match(sent.body, /Sent to 3 lenders/);
  assert.equal((sent.body.match(/data-sent-log=/g) || []).length, 3);
  assert.match(sent.body, /UNKNOWN/);
  assert.match(sent.body, /already sent LOR v1/);
  const responseId = sent.body.match(/name="response_id" value="([^"]+)"/)[1];
  const recorded = await call(store, {
    method: 'POST',
    query: { case: 'TEST-LOR-BROKA-002' },
    body: { action: 'record-response', seat: 'jess', response_id: responseId, outcome: 'terms' },
  });
  const after = await follow(store, recorded.location);
  assert.match(after.body, /data-outcome>terms</);
});

test('no_ai_contact disables the client send and a remote seed still cannot send live from preview', async () => {
  const store = createElLorStore();
  const page = await call(store, { query: { case: 'TEST-NOAI-004' } });
  assert.match(page.body, /No AI contact: Byron handles/);
  assert.match(page.body, /disabled[^>]*title="No AI contact: Byron handles"|title="No AI contact: Byron handles"[^>]*disabled/);
  const posted = await call(store, {
    method: 'POST',
    query: { case: 'TEST-NOAI-004' },
    body: { action: 'request-esign', seat: 'byron' },
  });
  assert.equal(posted.status, 403);
  assert.match(posted.body, /No AI contact: Byron handles/);

  let transportCalls = 0;
  const remote = {
    schema: 'posfin.el-lor-seed/v1',
    cases: [{
      ...readFixtureSeed().cases[0],
      case_ref: 'TEST-REMOTE-005',
      label: 'Remote example file',
      email: 'remote.borrower@example.invalid',
      is_test: false,
      el: { state: 'none' },
      lor: { state: 'none' },
      signatories: [{ name: 'Remote Example', email: 'remote.borrower@example.invalid', role: 'borrower' }],
    }],
  };
  const env = {
    ...ON,
    COCKPIT_SOURCE: 'supabase',
    VERCEL_ENV: 'preview',
    EL_LOR_LIVE_SENDS: 'on',
    EL_LOR_SEED_JSON_URL: 'https://seed.example.invalid/cases.json',
  };
  const listed = await call(store, {
    env,
    fetchImpl: async (url) => {
      assert.equal(url, env.EL_LOR_SEED_JSON_URL);
      return { ok: true, json: async () => remote };
    },
  });
  assert.match(listed.body, /TEST-REMOTE-005/);
  assert.match(listed.body, /data-mock="true"/);
  const previewStore = createElLorStore();
  const remoteDraft = await call(previewStore, {
    method: 'POST',
    env,
    query: { case: 'TEST-REMOTE-005' },
    body: { action: 'generate-el', seat: 'byron', inject: 'CIFAS' },
    fetchImpl: async () => ({ ok: true, json: async () => remote }),
  });
  assert.equal(remoteDraft.status, 303);
  const remoteView = await call(previewStore, {
    env,
    query: { case: 'TEST-REMOTE-005', doc: 'el' },
    fetchImpl: async () => ({ ok: true, json: async () => remote }),
  });
  assert.equal(/\bCIFAS\b/.test(remoteView.body), false);
  const generated = await call(previewStore, {
    method: 'POST',
    env,
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'generate-el', seat: 'byron' },
    fetchImpl: async () => ({ ok: true, json: async () => remote }),
  });
  assert.equal(generated.status, 303);
  const asked = await call(previewStore, {
    method: 'POST',
    env,
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'request-esign', seat: 'byron' },
    fetchImpl: async () => ({ ok: true, json: async () => remote }),
  });
  const pending = await follow(previewStore, asked.location, env);
  const approval = pending.body.match(/data-approval="([^"]+)"/)[1];
  const sent = dispatchAdapter('highlevel', {
    case_ref: 'TEST-EL-SOMO-001',
    version: 1,
    approval: { status: 'approved', action_type: 'sign' },
  }, env, { transport() { transportCalls += 1; return { ok: true, network: true }; } });
  assert.equal(sent.mode, 'mock');
  assert.equal(sent.network, false);
  assert.equal(transportCalls, 0);
  const approved = await call(previewStore, {
    method: 'POST',
    env,
    query: { case: 'TEST-EL-SOMO-001' },
    body: { action: 'approve', seat: 'byron', approval_id: approval },
    fetchImpl: async () => ({ ok: true, json: async () => remote }),
  });
  assert.equal(approved.networkLog.every((item) => item.mode === 'mock' && item.network === false), true);
});

test('checker rejects a broken net release and live mode stays unwired without approval', () => {
  const row = readFixtureSeed().cases[0];
  const built = buildEngagementLetter(row);
  assert.equal(built.checked.ok, true);
  const broken = checkEngagementLetter(built.body, { ...row.money, case_ref: row.case_ref, product: row.product, signatories: row.signatories, postcode: row.postcode, net_release: 1, gross: row.money.gross, retentions: row.money.retentions });
  assert.equal(broken.ok, false);
  const lor = buildLenderCopy(readFixtureSeed().cases[1], 1);
  assert.equal(lor.checked.ok, true);
  assert.equal(checkLenderCopy(`${lor.body}\nKPC investor`).ok, false);
  assert.equal(offeredLenders(
    [{ name: 'Invocap' }, { name: 'Excluded Lender Ltd' }, { name: 'MT-12' }, { name: 'ELL' }],
    readFixtureSeed().cases[1].lender_exclusions,
  ).map((item) => item.name).join(','), 'Invocap');
  const live = dispatchAdapter('telegram', {
    approval: { status: 'pending', action_type: 'send_external' },
  }, { COCKPIT_SOURCE: 'supabase', VERCEL_ENV: 'production', EL_LOR_LIVE_SENDS: 'on' }, {
    transport() { throw new Error('network'); },
  });
  assert.equal(live.ok, false);
  assert.equal(live.network, false);
  assert.equal(live.error, 'approval');
});
