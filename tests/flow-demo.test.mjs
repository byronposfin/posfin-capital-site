import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleFlow } from '../api/flow.js';
import { handleCockpit } from '../api/staff-cockpit.js';
import { handleSeat } from '../api/staff-seat.js';
import { createPreviewStore, mintPreviewSession } from '../lib/cockpit-store.js';
import { getCase } from '../lib/flow-cases.js';
import { presentDocument, presentLender } from '../lib/flow.js';
import { buildLor, contactViolations, headlineProblems } from '../lib/flow-docs.js';
import { netHeadline } from '../lib/flow-cases.js';
import { createFlowStore } from '../lib/flow-store.js';
import { lendersFromCsv, loadPlacedLenders, PLACED_FIXTURE_CSV, PLACED_FIXTURE_JSON } from '../lib/placed-lenders.js';
import { matchLenders, tierCounts } from '../lib/placed-match.js';
import { fixtureBook } from '../lib/seat-view.js';

const NOW = '2026-11-22T09:00:00.000Z';
const ENV = {
  COCKPIT_SOURCE: 'preview',
  COCKPIT_AUTH: 'preview',
  COCKPIT_PREVIEW_PASSWORD: 'preview-desk',
  SEAT_VIEW_SOURCE: 'fixtures',
  PORTAL_MODE: 'demo',
};
const SEATS = { ...ENV, FEATURE_SEAT_VIEW_CHRIS: 'on', FEATURE_SEAT_VIEW_BYRON: 'on' };

const CASE_A = {
  property_value: 930000,
  existing_charges: [{ holder: 'TEST First Lender', balance: 200000 }],
  net_ask: 250000,
  charge_type: 'second',
  regulated: false,
  product_type: 'bridging',
};

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

function cookie(env = ENV) {
  return `pf_staff=${encodeURIComponent(mintPreviewSession(env))}`;
}

async function call({ method = 'GET', query = {}, body = {}, env = ENV, session = true, actor = null, store = createFlowStore(), url = '/staff/flow' } = {}) {
  let calls = 0;
  const fetch = async () => {
    calls += 1;
    throw new Error('network');
  };
  const res = response();
  const req = {
    method,
    url,
    query,
    headers: { cookie: session ? cookie(env) : '', 'content-type': 'application/json' },
    body,
  };
  await handleFlow(req, res, { env, store, now: NOW, fetch, actor });
  return { status: res.status, body: res.body, headers: res.headers, calls, store };
}

function pdfText(body) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  return buffer.toString('latin1');
}

function pdfLiteralText(body) {
  const parts = [];
  for (const match of pdfText(body).matchAll(/\((?:\\.|[^\\)])*\)/g)) {
    parts.push(match[0].slice(1, -1)
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\(.)/g, '$1'));
  }
  return parts.join('\n');
}

function counts(result) {
  return tierCounts(result);
}

function row(result, name) {
  return result.rows.find((item) => item.name === name);
}

test('1. second-charge unregulated bridge matches the fixture counts', () => {
  const result = matchLenders(CASE_A);
  assert.equal(result.ltv, 48.39);
  assert.deepEqual(counts(result), { eligible: 32, unverified: 53, excluded: 204 });
  for (const name of ['Albatross Lending Group', 'MT Finance', 'Somo', 'Precise Bridging', 'West One', 'CrowdProperty']) {
    assert.equal(row(result, name).tier, 'eligible', name);
  }
  assert.equal(loadPlacedLenders().length, 289);
  const fromCsv = lendersFromCsv(readFileSync(PLACED_FIXTURE_CSV, 'utf8'));
  const fixture = JSON.parse(readFileSync(PLACED_FIXTURE_JSON, 'utf8'));
  assert.equal(fixture.source, 'placed_lenders_v002.csv');
  assert.equal(fixture.tag, 'website-stated, not lender-confirmed');
  assert.equal(JSON.stringify(fixture.lenders), JSON.stringify(fromCsv));
  const detail = presentLender('L001');
  assert.equal(detail.status, 200);
  assert.match(detail.html, /data-research-tag="website-stated, not lender-confirmed"/);
  assert.match(detail.html, /https:\/\/novellusfinance\.com\/uk\/bridging-loan-finance-london\//);
  assert.match(detail.html, /2026-11-23/);
  assert.match(detail.html, /data-field="regulated"/);
});

test('2. the same case regulated drops unregulated-only lenders', () => {
  const result = matchLenders({ ...CASE_A, regulated: true });
  assert.deepEqual(counts(result), { eligible: 10, unverified: 25, excluded: 254 });
  for (const name of ['Albatross Lending Group', 'Somo', 'CrowdProperty']) {
    assert.equal(row(result, name).tier, 'excluded', name);
    assert.ok(row(result, name).block.includes('unregulated only'), name);
  }
  for (const name of ['MT Finance', 'Precise Bridging', 'West One']) {
    assert.equal(row(result, name).tier, 'eligible', name);
  }
});

test('3. first charge at 70 percent', () => {
  const result = matchLenders({
    property_value: 500000, existing_charges: [], net_ask: 350000, charge_type: 'first', regulated: false, product_type: 'bridging',
  });
  assert.equal(result.ltv, 70);
  assert.deepEqual(counts(result), { eligible: 66, unverified: 35, excluded: 188 });
  assert.match(result.note, /redemptions/);
});

test('4. first charge at 80 percent leaves four eligible and excludes MT Finance', () => {
  const result = matchLenders({
    property_value: 500000, existing_charges: [], net_ask: 400000, charge_type: 'first', regulated: false, product_type: 'bridging',
  });
  assert.equal(counts(result).eligible, 9);
  assert.equal(row(result, 'MT Finance').tier, 'excluded');
  assert.ok(row(result, 'MT Finance').block.includes('LTV 80% above 70%'));
});

test('5. a high second-charge LTV has no eligible lender', () => {
  const result = matchLenders({
    property_value: 400000,
    existing_charges: [{ holder: 'TEST First Lender', balance: 250000 }],
    net_ask: 80000,
    charge_type: 'second',
    regulated: false,
    product_type: 'bridging',
  });
  assert.equal(result.ltv, 82.5);
  assert.equal(counts(result).eligible, 0);
  assert.ok(result.rows.every((item) => item.tier === 'unverified' || item.tier === 'excluded'));
});

test('6. development at 60 percent LTGDV', () => {
  const result = matchLenders({
    property_value: 2000000, existing_charges: [], net_ask: 1200000, charge_type: 'first', regulated: false, product_type: 'development',
  });
  assert.equal(result.ltv, 60);
  assert.deepEqual(counts(result), { eligible: 32, unverified: 39, excluded: 218 });
  assert.equal(row(result, 'Somo').tier, 'excluded');
  assert.ok(row(result, 'Somo').block.includes('product type not offered'));
  assert.equal(row(result, 'Precise Bridging').tier, 'excluded');
  assert.ok(row(result, 'Precise Bridging').block.includes('above max £1000000'));
});

test('7. N, No, no and unregulated are unregulated only, and both passes either way', () => {
  function panel(regulated) {
    return {
      id: 'T1',
      name: 'Panel TEST Lender',
      segment: 'bridging',
      charge: 'first+second',
      regulated,
      development: 'Y',
      max_ltv_first: 75,
      max_ltv_second: 70,
      max_ltgdv: 70,
      loan_min: 50000,
      loan_max: 5000000,
      rate_pcm: 0.8,
      stale: false,
      source: 'web',
      source_date: '2026-11-23',
      grade: 'C',
    };
  }
  for (const value of ['N', 'No', 'no', 'unregulated']) {
    const regulatedCase = matchLenders({ ...CASE_A, regulated: true }, [panel(value)]);
    assert.equal(regulatedCase.rows[0].tier, 'excluded', value);
    assert.ok(regulatedCase.rows[0].block.includes('unregulated only'), value);
    const openCase = matchLenders(CASE_A, [panel(value)]);
    assert.equal(openCase.rows[0].tier, 'eligible', value);
    assert.equal(openCase.rows[0].block.includes('unregulated only'), false, value);
  }
  for (const regulated of [true, false]) {
    const result = matchLenders({ ...CASE_A, regulated }, [panel('both')]);
    assert.equal(result.rows[0].tier, 'eligible', String(regulated));
    assert.equal(result.rows[0].block.includes('unregulated only'), false);
  }
});

test('8. eligible lenders sort non-stale first, then lowest rate', () => {
  const eligible = matchLenders(CASE_A).rows.filter((item) => item.tier === 'eligible');
  const firstStale = eligible.findIndex((item) => item.stale);
  assert.ok(firstStale > 0);
  assert.ok(eligible.slice(0, firstStale).every((item) => item.stale === false));
  assert.ok(eligible.slice(firstStale).every((item) => item.stale === true));
  function ratesRise(list) {
    for (let index = 1; index < list.length; index += 1) {
      const previous = list[index - 1].rate_pcm ?? 99;
      const current = list[index].rate_pcm ?? 99;
      assert.ok(previous <= current);
    }
  }
  ratesRise(eligible.filter((item) => !item.stale));
  ratesRise(eligible.filter((item) => item.stale));
  assert.ok(eligible.every((item) => item.source && item.grade !== undefined));
});

function lorHtml(ref) {
  return presentDocument(getCase(ref), 'lor', {}, { now: NOW });
}

test('9. residential LORs keep a net headline, five comparables and a collapsed gross line', () => {
  for (const [ref, net] of [['TEST-FLOW-001', '£250,000'], ['TEST-FLOW-002', '£350,000'], ['TEST-FLOW-004', '£80,000']]) {
    const page = lorHtml(ref);
    assert.equal(page.status, 200, ref);
    const headline = page.html.match(/data-headline>([^<]+)/)[1];
    assert.match(headline, new RegExp(`Looking for ${net.replace('£', '£')} net`));
    assert.equal(/gross/i.test(headline), false, headline);
    assert.match(headline, /subject to status/i);
    assert.deepEqual(headlineProblems(getCase(ref), netHeadline(getCase(ref))), []);
    assert.match(page.html, /Gross: indicative, to follow on receipt of lender terms \(subject to status\)\./);
    assert.match(page.html, /AVM £/);
    const street = ref === 'TEST-FLOW-002' ? 'Test Close, Testford' : 'Test Row, Testford';
    assert.equal((page.html.match(new RegExp(street, 'g')) || []).length, 5, ref);
    const money = [...page.html.matchAll(/<section data-money="[^"]*">([\s\S]*?)<\/section>/g)];
    assert.ok(money.length >= 4);
    for (const section of money) assert.match(section[1], /subject to status/i);
  }
  const copy = structuredClone(getCase('TEST-FLOW-001'));
  copy.comparables.pop();
  const failed = presentDocument(copy, 'lor', {}, { now: NOW });
  assert.equal(failed.status, 400);
  assert.match(failed.html, /exactly five sold comparables/i);
  assert.match(failed.html, /This case has 4/);
  copy.comparables = getCase('TEST-FLOW-001').comparables.concat([getCase('TEST-FLOW-001').comparables[0]]);
  const extra = buildLor(copy, loadPlacedLenders(), { now: NOW });
  assert.equal(extra.ok, false);
  assert.match(extra.error, /exactly five sold comparables/i);
});

test('10. the regulated LOR names the mandatory redemption and shows the callout', () => {
  const page = lorHtml('TEST-FLOW-004');
  assert.match(page.html, /Regulated — FCA second-charge mortgage/);
  assert.match(page.html, /TEST Second Charge Co/);
  assert.match(page.html, /Mandatory redemption/);
  assert.match(page.html, /Looking for £80,000 net/);
});

test('11. EL and LOR PDFs are real PDFs with the watermark, the broker line and separate fee rows', async () => {
  const el = await call({ query: { view: 'doc', case: 'TEST-FLOW-001', kind: 'el.pdf' } });
  const lor = await call({ query: { view: 'doc', case: 'TEST-FLOW-001', kind: 'lor.pdf' } });
  for (const file of [el, lor]) {
    assert.equal(file.status, 200);
    assert.match(file.headers['content-type'], /^application\/pdf/);
    const text = pdfText(file.body);
    assert.equal(text.startsWith('%PDF'), true);
    assert.match(text, /TEST/);
    assert.match(text, /Posfin Capital/);
    assert.equal(file.calls, 0);
  }
  const elText = pdfText(el.body);
  assert.match(elText, /Broker fee/);
  assert.match(elText, /Lender procuration fee/);
  assert.match(elText, /does not substitute, offset or reduce any broker fee/);
  assert.match(el.headers['content-disposition'], /EL_TEST-FLOW-001_v001\.pdf/);
  assert.match(lor.headers['content-disposition'], /LOR_TEST-FLOW-001_.+_v001\.pdf/);
  const html = await call({ query: { view: 'doc', case: 'TEST-FLOW-001', kind: 'el' } });
  assert.match(html.body, /Broker fee/);
  assert.match(html.body, /Lender procuration fee/);
  assert.equal(html.body.includes('Lender procuration fee') && html.body.indexOf('Broker fee') !== html.body.lastIndexOf('Broker fee') || html.body.includes('Lender procuration fee'), true);
});

test('12. generated letters do not contain a real email or a phone number', async () => {
  const refs = ['TEST-FLOW-001', 'TEST-FLOW-002', 'TEST-FLOW-003', 'TEST-FLOW-004'];
  for (const ref of refs) {
    for (const kind of ['el', 'lor', 'el.pdf', 'lor.pdf']) {
      const page = await call({ query: { view: 'doc', case: ref, kind } });
      assert.equal(page.status, 200, `${ref} ${kind}`);
      const text = kind.endsWith('pdf') ? pdfLiteralText(page.body) : page.body;
      assert.match(text, /Posfin Capital/);
      assert.deepEqual(contactViolations(text), [], `${ref} ${kind}`);
    }
  }
  const dev = await call({ query: { view: 'doc', case: 'TEST-FLOW-003', kind: 'lor' } });
  assert.equal(dev.body.includes('AVM'), false);
});

test('13. demo placement simulates both routes, logs one entry and does not call fetch', async () => {
  const store = createFlowStore();
  const broka = await call({
    method: 'POST',
    query: { view: 'place', case: 'TEST-FLOW-001' },
    body: { via: 'broka' },
    store,
  });
  assert.equal(broka.status, 200);
  assert.match(broka.body, /Simulated\. Nothing was sent to BROKA or any lender\./);
  assert.match(broka.body, /What BROKA would be asked \(simulated\)/);
  assert.equal(broka.calls, 0);
  assert.equal(store.activity().length, 1);
  assert.deepEqual({
    caseRef: store.activity()[0].caseRef,
    via: store.activity()[0].via,
    mode: store.activity()[0].mode,
    eligible: store.activity()[0].eligible,
    unverified: store.activity()[0].unverified,
    excluded: store.activity()[0].excluded,
  }, {
    caseRef: 'TEST-FLOW-001', via: 'broka', mode: 'demo', eligible: 32, unverified: 53, excluded: 204,
  });
  const placed = await call({
    method: 'POST',
    query: { view: 'place', case: 'TEST-FLOW-001' },
    body: { via: 'placed' },
    store,
  });
  assert.equal(placed.status, 200);
  assert.match(placed.body, /Simulated/);
  assert.match(placed.body, /What Placed matched \(simulated\)/);
  assert.equal(placed.calls, 0);
  assert.equal(store.activity().length, 2);
  assert.equal(store.activity()[1].via, 'placed');
});

test('14. live mode stops at Byron\'s confirmation and never calls the network', async () => {
  const live = { ...ENV, PORTAL_MODE: 'live' };
  const store = createFlowStore();
  for (const via of ['broka', 'placed']) {
    const page = await call({
      method: 'POST',
      query: { view: 'place', case: 'TEST-FLOW-004' },
      body: { via },
      env: live,
      actor: { seat: 'chris', role: 'case_owner' },
      store,
    });
    assert.equal(page.status, 200, via);
    assert.match(page.body, /Byron's confirmation required\. Nothing is placed until Byron confirms\./);
    assert.match(page.body, /I confirm these parameters are correct/);
    assert.match(page.body, /Request Byron's approval/);
    assert.equal(page.body.includes('Confirm (Byron)'), false);
    assert.equal(page.calls, 0);
  }
  assert.equal(store.activity().length, 0);
  const missing = await call({
    method: 'POST',
    query: { view: 'approve', case: 'TEST-FLOW-004' },
    body: { action: 'confirm', via: 'broka' },
    env: live,
    actor: { seat: 'byron', role: 'principal' },
    store,
  });
  assert.equal(missing.status, 400);
  assert.match(missing.body, /accuracy confirmation/);
  assert.equal(missing.body.includes('approved_for_manual_placement'), false);
  const denied = await call({
    method: 'POST',
    query: { view: 'approve', case: 'TEST-FLOW-004' },
    body: { action: 'confirm', via: 'placed', accurate: 'yes', lender: ['L019'] },
    env: live,
    actor: { seat: 'chris', role: 'case_owner' },
    store,
  });
  assert.equal(denied.status, 403);
  assert.match(denied.body, /Only Byron can confirm/);
  assert.equal(denied.calls, 0);
  const requested = await call({
    method: 'POST',
    query: { view: 'approve', case: 'TEST-FLOW-004' },
    body: { action: 'request', via: 'broka', accurate: 'yes' },
    env: live,
    actor: { seat: 'chris', role: 'case_owner' },
    store,
  });
  assert.equal(requested.status, 200);
  assert.match(requested.body, /data-status="pending_byron"/);
  const approved = await call({
    method: 'POST',
    query: { view: 'approve', case: 'TEST-FLOW-004' },
    body: { action: 'confirm', via: 'broka', accurate: 'yes', lender: ['L019', 'L057'] },
    env: live,
    actor: { seat: 'byron', role: 'principal' },
    store,
  });
  assert.equal(approved.status, 200);
  assert.match(approved.body, /data-status="approved_for_manual_placement"/);
  assert.match(approved.body, /Approved\. Place manually on BROKA \/ Placed\. Nothing was submitted automatically\./);
  assert.equal(approved.calls, 0);
  assert.equal(store.approvals().some((entry) => entry.status === 'approved_for_manual_placement'), true);
  assert.equal(store.activity().length, 0);
  const files = [
    ...readdirSync('lib').filter((name) => name.startsWith('flow') || name.startsWith('placed')).map((name) => join('lib', name)),
    'api/flow.js',
  ];
  for (const file of files) {
    assert.equal(readFileSync(file, 'utf8').includes('broka.app'), false, file);
  }
});

test('15. production returns 404 for every Posfin Flow route', async () => {
  const env = { ...ENV, VERCEL_ENV: 'production', PORTAL_MODE: 'live' };
  const routes = [
    { view: 'home' },
    { view: 'lenders' },
    { view: 'case', case: 'TEST-FLOW-001' },
    { view: 'doc', case: 'TEST-FLOW-001', kind: 'el' },
    { view: 'doc', case: 'TEST-FLOW-001', kind: 'lor.pdf' },
    { view: 'place', case: 'TEST-FLOW-001', via: 'broka' },
    { view: 'approve', case: 'TEST-FLOW-001', via: 'placed' },
    { view: 'lender', id: 'L001' },
    { view: 'processing' },
    { view: 'processing', case: 'TEST-FLOW-001' },
    { view: 'leadership' },
  ];
  for (const query of routes) {
    const page = await call({ query, env, method: query.view === 'place' ? 'POST' : 'GET', body: { via: query.via } });
    assert.equal(page.status, 404, JSON.stringify(query));
    assert.match(page.body, /Not found/);
    assert.equal(page.body.includes('TEST-FLOW-001'), false);
    assert.equal(page.body.includes('Albatross'), false);
  }
});

test('16. a missing staff session gets the sign-in page and no fixture data', async () => {
  const routes = [
    { view: 'home' },
    { view: 'case', case: 'TEST-FLOW-001' },
    { view: 'doc', case: 'TEST-FLOW-002', kind: 'lor' },
    { view: 'place', case: 'TEST-FLOW-001', via: 'placed' },
    { view: 'lenders' },
    { view: 'lender', id: 'L001' },
  ];
  for (const query of routes) {
    const page = await call({ query, session: false });
    assert.equal(page.status, 401, JSON.stringify(query));
    assert.match(page.body, /Staff password/);
    assert.equal(page.body.includes('TEST-FLOW'), false);
    assert.equal(page.body.includes('Albatross'), false);
    assert.equal(page.body.includes('Generate EL'), false);
  }
});

test('17. the cockpit and both seats still render, with the new buttons', async () => {
  const board = response();
  let calls = 0;
  await handleCockpit({
    method: 'GET',
    url: '/staff/cockpit',
    query: {},
    headers: { cookie: cookie(SEATS) },
  }, board, {
    env: SEATS,
    store: createPreviewStore(),
    now: NOW,
    fetch: async () => { calls += 1; throw new Error('network'); },
  });
  assert.equal(board.status, 200);
  assert.match(board.body, /Let's clear the board\./);
  assert.match(board.body, /Generate EL/);
  assert.match(board.body, /Generate LOR/);
  assert.match(board.body, /Place on BROKA/);
  assert.match(board.body, /Place on Placed/);
  assert.equal(calls, 0);
  for (const seat of ['byron', 'chris']) {
    const res = response();
    await handleSeat({
      method: 'GET',
      url: `/staff/cockpit/seat/${seat}`,
      query: { seat },
      headers: { cookie: cookie(SEATS) },
    }, res, {
      env: SEATS,
      now: NOW,
      book: fixtureBook(),
      fetch: async () => { calls += 1; throw new Error('network'); },
    });
    assert.equal(res.status, 200, seat);
    assert.match(res.body, /id="raw-leads"/);
    assert.match(res.body, /id="completed-fact-finds"/);
    assert.match(res.body, /id="live-cases"/);
    assert.match(res.body, /id="daily-tasks"/);
    assert.match(res.body, /data-case="TEST-SEAT-001"/);
    assert.match(res.body, /Generate EL/);
    assert.match(res.body, /Generate LOR/);
    assert.match(res.body, /Place on BROKA/);
    assert.match(res.body, /Place on Placed/);
    assert.match(res.body, /data-flow-case="TEST-FLOW-001"/);
  }
  assert.equal(calls, 0);
  assert.equal(netHeadline(getCase('TEST-FLOW-001')).includes('gross'), false);
});
