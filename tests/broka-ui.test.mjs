import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCockpit } from '../api/staff-cockpit.js';
import { handleBrokaDesk } from '../api/broka-desk.js';
import { launchModel, preflight } from '../lib/broka.js';
import { brokaLaunch } from '../lib/broka-html.js';
import { renderStaffCase, renderStaffList } from '../lib/case-portal-html.js';
import { buildModel } from '../lib/case-portal.js';
import { mintPreviewSession, resetSharedPreviewStore } from '../lib/cockpit-store.js';
import { resetBrokaState } from '../lib/broka-state.js';

const ENV = { COCKPIT_SOURCE: 'preview', COCKPIT_AUTH: 'preview', COCKPIT_PREVIEW_PASSWORD: 'preview-desk' };

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

test('pre-flight marks missing fields in red data and prefills EPC from the lookup', () => {
  const check = preflight({
    date_of_birth: '1980-01-02',
    experience: 'Three prior bridges',
    epc_lookup: 'C',
    notes: 'internal_private and a Barclays letter',
  }, null);
  assert.deepEqual(check.missing, ['Bedrooms', 'Rental income']);
  const epc = check.fields.find((field) => field.key === 'epc_rating');
  assert.equal(epc.missing, false);
  assert.equal(epc.value, 'C');
  assert.equal(epc.source, 'epc_lookup');
  assert.deepEqual(check.blocks.map((item) => item.id), ['internal_private', 'barclays_letter']);
  assert.equal(check.regulated, null);
});

test('the launch control is disabled until a fact find is submitted', () => {
  const closed = brokaLaunch(launchModel({ id: 'preview-hale', kind: 'case' }));
  assert.match(closed, /disabled/);
  assert.match(closed, /fact find is submitted/);
  const open = brokaLaunch(launchModel({ id: 'preview-northgate', kind: 'case' }));
  assert.doesNotMatch(open, /disabled/);
  assert.match(open, /\/staff\/cockpit\/broka\/PREVIEW-NORTHGATE/);
  assert.match(open, /Submit to BROKA \(eligibility check\)/);
  const early = brokaLaunch(launchModel({ caseRef: 'PC-003', stage: 'contacting' }));
  assert.match(early, /disabled/);
  const ready = brokaLaunch(launchModel({ caseRef: 'PC-003', stage: 'fact_find' }));
  assert.match(ready, /\/staff\/cockpit\/broka\/PC-003/);
});

test('the case page shows the pre-flight, regulated toggle and chips', async () => {
  resetBrokaState();
  const session = mintPreviewSession(ENV);
  const res = response();
  await handleBrokaDesk({
    method: 'GET',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    query: { case: 'PREVIEW-NORTHGATE' },
    url: '/staff/cockpit/broka/PREVIEW-NORTHGATE',
  }, res, { env: ENV, fetch: async () => { throw new Error('no network'); } });
  assert.equal(res.status, 200);
  assert.match(res.body, /class="missing">Bedrooms/);
  assert.match(res.body, /class="missing">Rental income/);
  assert.match(res.body, /prefilled from EPC lookup/);
  assert.match(res.body, /name="regulated"/);
  assert.match(res.body, /Standing approval/);
  assert.match(res.body, /Fact find submitted/);
  assert.match(res.body, /Blocklist: internal_private, Barclays letter/);
  assert.match(res.body, /BK-PREVIEW-NORTH/);
  assert.equal(/broka\.app/i.test(res.body), false);
  assert.equal(res.body.includes('held on the file'), false);
});

test('only Byron can pause searches', async () => {
  resetBrokaState();
  const session = mintPreviewSession(ENV);
  const denied = response();
  await handleBrokaDesk({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    query: { case: 'PREVIEW-NORTHGATE' },
    body: { action: 'pause', seat: 'jess', case_ref: 'PREVIEW-NORTHGATE' },
  }, denied, { env: ENV });
  assert.equal(denied.status, 403);
  const paused = response();
  await handleBrokaDesk({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    query: { case: 'PREVIEW-NORTHGATE' },
    body: { action: 'pause', seat: 'byron', case_ref: 'PREVIEW-NORTHGATE' },
  }, paused, { env: ENV });
  assert.equal(paused.status, 200);
  assert.match(paused.body, /Searches paused/);
});

test('cockpit cards and the staff case page carry the same control', async () => {
  resetSharedPreviewStore();
  const session = mintPreviewSession(ENV);
  const board = response();
  await handleCockpit({
    method: 'GET',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    query: {},
    url: '/staff/cockpit',
  }, board, { env: ENV, fetch: async () => { throw new Error('no network'); } });
  assert.match(board.body, /Submit to BROKA \(eligibility check\)/);
  assert.match(board.body, /PREVIEW-NORTHGATE/);
  assert.equal(/<button[^>]*value="send"/i.test(board.body), false);
  const model = buildModel({
    case_id: 'examplecase1',
    client_name: 'Example Borrower',
    stage: 'gathering',
    facts: { property_address: '1 Example Street', postcode: 'SW1A 1AA', ask_client: true },
    kyc: { status: 'passed' },
    submissions: [],
  });
  const staff = renderStaffCase(model, {});
  assert.match(staff, /disabled/);
  assert.match(staff, /Submit to BROKA \(eligibility check\)/);
  const ready = renderStaffCase(model, { fact_find_submitted: true });
  assert.match(ready, /\/staff\/cockpit\/broka\/examplecase1/);
  const list = renderStaffList([{ caseId: 'examplecase1', clientName: 'Example', stageLabel: 'Gathering', openCount: 1, kycStatus: 'passed' }]);
  assert.match(list, /disabled/);
});
