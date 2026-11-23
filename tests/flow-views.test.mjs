import test from 'node:test';
import assert from 'node:assert/strict';
import { handleFlow } from '../api/flow.js';
import { mintPreviewSession } from '../lib/cockpit-store.js';
import { createFlowStore } from '../lib/flow-store.js';

const NOW = '2026-11-22T09:00:00.000Z';
const ENV = {
  COCKPIT_SOURCE: 'preview',
  COCKPIT_AUTH: 'preview',
  COCKPIT_PREVIEW_PASSWORD: 'preview-desk',
};

function response() {
  const headers = {};
  const res = {
    headers,
    body: '',
    status: 0,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    end(body) { this.body = body || ''; },
  };
  Object.defineProperty(res, 'statusCode', { set(value) { res.status = value; }, get() { return res.status; } });
  return res;
}

async function call({ method = 'GET', query = {}, body = {}, store = createFlowStore(), env = ENV } = {}) {
  let calls = 0;
  const res = response();
  await handleFlow({
    method,
    url: '/staff/flow',
    query,
    headers: {
      cookie: `pf_staff=${encodeURIComponent(mintPreviewSession(env))}`,
      'content-type': 'application/json',
    },
    body,
  }, res, {
    env,
    store,
    now: NOW,
    fetch: async () => { calls += 1; throw new Error('network'); },
  });
  return { status: res.status, body: res.body, calls, store };
}

test('investor and introducer views use real lender names', async () => {
  for (const audience of ['investor', 'introducer', 'internal']) {
    const page = await call({ query: { view: 'place', case: 'TEST-FLOW-001', via: 'placed', audience } });
    assert.equal(page.status, 200, audience);
    assert.match(page.body, /Albatross Lending Group/);
    assert.match(page.body, /website-stated, not lender-confirmed/);
    assert.equal(page.body.includes('Lender A'), false, audience);
    assert.equal(page.calls, 0);
  }
  const home = await call({ query: { view: 'home', audience: 'investor' } });
  assert.match(home.body, /Investor view/);
  assert.match(home.body, /data-audience="investor"/);
  const introducer = await call({ query: { view: 'home', audience: 'introducer' } });
  assert.match(introducer.body, /Introducer view/);
  const internal = await call({ query: { view: 'home', audience: 'internal' } });
  assert.match(internal.body, /href="\/staff\/flow\/processing"/);
  assert.match(internal.body, /href="\/staff\/flow\/leadership"/);
});

test('processing drafts stay draft-only and leadership shows them', async () => {
  const store = createFlowStore();
  const desk = await call({ query: { view: 'processing', case: 'TEST-FLOW-001' }, store });
  assert.equal(desk.status, 200);
  assert.match(desk.body, /Jess and Cai/);
  assert.match(desk.body, /Valuation/);
  assert.match(desk.body, /Legals/);
  assert.match(desk.body, /PLEs/);
  assert.match(desk.body, /KYC/);
  assert.match(desk.body, /Offer/);
  assert.match(desk.body, /Completion/);
  assert.match(desk.body, /Draft next action/);
  assert.match(desk.body, /Enabled only by Byron/);
  assert.match(desk.body, /name="auto_send" value="off"/);
  assert.match(desk.body, /auto_send_visible[\s\S]*disabled/);
  for (const name of ['Byron', 'Chris', 'Jess', 'Cai', 'Aadi', 'Tom', 'Liz']) {
    assert.match(desk.body, new RegExp(`<option(?: selected)?>${name}</option>`));
  }
  const saved = await call({
    method: 'POST',
    query: { view: 'processing', case: 'TEST-FLOW-001' },
    body: { action: 'draft', step: 'valuation', from: 'Cai', auto_send: 'on', audience: 'internal' },
    store,
  });
  assert.equal(saved.status, 200);
  assert.match(saved.body, /Nothing was sent/);
  assert.match(saved.body, /data-draft="valuation"/);
  assert.match(saved.body, /data-auto-send="off"/);
  assert.match(saved.body, /From Cai/);
  assert.equal(saved.calls, 0);
  assert.equal(store.drafts('TEST-FLOW-001')[0].autoSend, false);
  assert.equal(store.drafts('TEST-FLOW-001')[0].status, 'draft');
  const board = await call({ query: { view: 'leadership' }, store });
  assert.equal(board.status, 200);
  assert.match(board.body, /Byron and Chris/);
  assert.match(board.body, /data-case="TEST-FLOW-001"/);
  assert.match(board.body, /Lender match/);
  assert.match(board.body, /Valuation/);
  assert.match(board.body, /data-draft-ready="yes"/);
  const blocked = await call({
    method: 'POST',
    query: { view: 'processing', case: 'TEST-FLOW-002' },
    body: { action: 'draft', step: 'kyc', from: 'Liz', audience: 'investor' },
    store,
  });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.calls, 0);
  assert.equal(store.drafts('TEST-FLOW-002').length, 0);
});
