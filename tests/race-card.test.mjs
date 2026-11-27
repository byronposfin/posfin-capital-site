import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { handleCommandDashboard } from '../api/command-dashboard.js';
import pipeline from '../api/staff-pipeline.js';
import { establishSession } from '../lib/cockpit-store.js';
import { renderPipeline } from '../lib/pipeline-html.js';
import { byronOnlyCaseKeys } from '../lib/command-dashboard.js';
import {
  bdmName,
  headlineLine,
  normaliseCaseRef,
  presentEligibility,
  presentRaceBundle,
  renderRaceCardDocument,
  renderRaceCardFragment,
} from '../lib/race-card.js';

const OFFER = {
  race_position: 1,
  is_headline: true,
  lender_name: 'Westone Loans',
  bdm_contact: 'Lux Mathiy (Lux.Mathiy@westoneloans.co.uk), ref 829271',
  channel: 'direct',
  product: 'Regulated 1st-charge bridge',
  ltv_pct: 70,
  valuation_basis: 420000,
  gross_loan: 294000,
  net_loan: 244406,
  rate_pm: 1,
  term_months: 12,
  arrangement_fee: '2% (£5,880)',
  proc_fee: '1.5% to Posfin',
  exit_fee: 'None stated',
  conditions: 'Indicative, subject to valuation.',
  offer_commentary: 'Benchmark to beat. Internal broker note only.',
  source: 'Outlook: Lux Mathiy',
  date_received: '2026-11-27',
};

const CARD = {
  case_ref: 'UNASSIGNED-HIMANSHU',
  case_name: 'Himanshu — 70 Salvesen Gardens',
  commentary: 'Where we are: West One is the benchmark. Contact nobody@example.test if needed.',
  updated_at: '2026-11-27T14:18:28.936Z',
  headline_offer: OFFER,
  offers: [OFFER],
  offer_count: 1,
  eligibility_matched_count: 45,
  awaiting_count: 44,
};

function matches(count = 45) {
  const rows = [{
    lender_name: 'Westone Loans',
    has_offer: true,
    match_source: 'criteria',
    matched_at: '2026-11-20T10:00:00.000Z',
    lor_channel: 'placed',
    notes: 'Internal match note',
  }];
  for (let i = 1; i < count; i += 1) {
    rows.push({
      lender_name: `Awaiting Lender ${i}`,
      has_offer: false,
      match_source: 'broad',
      matched_at: '2026-11-21T10:00:00.000Z',
      notes: `Hidden note ${i}`,
    });
  }
  return rows;
}

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

function json(status, body) {
  const text = JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => body };
}

test('the headline line ranks the actual offer and keeps the BDM name off the email', () => {
  assert.equal(bdmName(OFFER.bdm_contact), 'Lux Mathiy');
  const staff = presentRaceBundle(CARD, matches(), { caseRef: 'UNASSIGNED-HIMANSHU', audience: 'staff' });
  assert.equal(staff.headline.headline_line, 'Westone Loans / Lux Mathiy 70% LTV — £294,000 gross / £244,406 net');
  assert.equal(headlineLine(staff.headline, 'staff'), staff.headline.headline_line);
  assert.equal(staff.offer_count, 1);
  assert.equal(staff.offers[0].lender_name, 'Westone Loans');
  assert.equal(staff.offers.some((row) => row.lender_name.startsWith('Awaiting')), false);
  assert.equal(staff.eligibility.matched, 45);
  assert.equal(staff.eligibility.awaiting, 44);
  assert.equal(staff.eligibility.offer_in, 1);
  assert.equal(staff.offers[0].proc_fee, '1.5% to Posfin');
  assert.match(staff.offers[0].bdm_contact, /Lux\.Mathiy@westoneloans\.co\.uk/);
});

test('the borrower view hides the BDM email, proc fee and broker-only notes', () => {
  const view = presentRaceBundle(CARD, matches(2), { caseRef: 'UNASSIGNED-HIMANSHU', audience: 'borrower' });
  const packed = JSON.stringify(view);
  assert.equal(packed.includes('westoneloans.co.uk'), false);
  assert.equal(packed.includes('nobody@example.test'), false);
  assert.equal(packed.includes('1.5% to Posfin'), false);
  assert.equal(packed.includes('Benchmark to beat'), false);
  assert.equal(packed.includes('Internal match note'), false);
  assert.equal(packed.includes('Hidden note'), false);
  assert.equal(Object.hasOwn(view.offers[0], 'proc_fee'), false);
  assert.equal(Object.hasOwn(view.offers[0], 'bdm_contact'), false);
  assert.equal(Object.hasOwn(view.offers[0], 'offer_commentary'), false);
  assert.match(view.commentary, /West One is the benchmark/);
  assert.equal(view.headline.headline_line, 'Westone Loans 70% LTV — £294,000 gross / £244,406 net');
  const html = renderRaceCardFragment(view, { surface: 'command', interactive: 'drawer' });
  assert.match(html, /Current Race Card/);
  assert.match(html, /Eligibility-Matched Lenders \(Broad Net\)/);
  assert.match(html, /Borrower-facing view/);
  assert.equal(html.includes('westoneloans.co.uk'), false);
  assert.equal(html.includes('1.5% to Posfin'), false);
  assert.equal(html.includes('<script'), false);
});

test('eligibility counts stay off the offer table', () => {
  const summary = presentEligibility(matches(), 'staff');
  assert.equal(summary.matched, 45);
  assert.equal(summary.awaiting, 44);
  assert.equal(summary.offer_in, 1);
  assert.equal(summary.lenders[0].status, 'Offer in');
  assert.equal(summary.lenders[1].status, 'Awaiting');
  const staff = presentRaceBundle(CARD, matches(), { caseRef: 'UNASSIGNED-HIMANSHU', audience: 'staff', tab: 'card' });
  const page = renderRaceCardDocument(staff, { surface: 'pipeline' });
  assert.match(page, /45 matched, 44 awaiting, 1 offer in/);
  assert.match(page, /Broker commentary/);
  assert.match(page, /Where we are/);
  assert.match(page, /Live offers/);
  assert.equal(page.includes('Awaiting Lender 1'), false);
  const broad = renderRaceCardDocument({ ...staff, tab: 'eligibility' }, { surface: 'pipeline' });
  assert.match(broad, /Eligibility-Matched Lenders \(Broad Net\)/);
  assert.match(broad, /Awaiting Lender 1/);
  assert.match(broad, /This list is not a race card/);
  assert.equal(normaliseCaseRef("UNASSIGNED-HIMANSHU"), 'UNASSIGNED-HIMANSHU');
  assert.equal(normaliseCaseRef("bad ref"), '');
  assert.equal(normaliseCaseRef("x' or 1=1"), '');
});

test('the command route calls the race card RPC with the service role and leaves the dashboard route alone', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, method: options.method || 'GET', headers: options.headers || {}, body: options.body || '' });
    if (target.includes('/auth/v1/user')) return json(200, { email: 'cai@posfincapital.com' });
    if (target.includes('/rpc/staff_caller')) return json(200, [{ email: 'cai@posfincapital.com', seat_code: 'cai', role: 'case_owner' }]);
    if (target.includes('/rpc/current_race_card')) return json(200, CARD);
    if (target.includes('/v_eligibility_matched_lenders')) return json(200, matches());
    return json(404, { message: 'unexpected' });
  };
  const env = {
    STAFF_AUTH_MODE: 'supabase',
    VERCEL_ENV: 'production',
    STAFF_SUPABASE_URL: 'https://example.test',
    SUPABASE_URL: 'https://example.test',
    STAFF_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  };
  const denied = response();
  await handleCommandDashboard({
    method: 'GET',
    url: '/api/command-dashboard?action=race-card&case=UNASSIGNED-HIMANSHU',
    query: { action: 'race-card', case: 'UNASSIGNED-HIMANSHU' },
    headers: {},
  }, denied, { env, fetch: fetchImpl });
  assert.equal(denied.status, 401);
  assert.equal(calls.length, 0);

  const res = response();
  await handleCommandDashboard({
    method: 'GET',
    url: '/api/command-dashboard?action=race-card&case=UNASSIGNED-HIMANSHU&audience=borrower',
    query: { action: 'race-card', case: 'UNASSIGNED-HIMANSHU', audience: 'borrower' },
    headers: { cookie: 'pf_staff=sb1.staff-access-token' },
  }, res, { env, fetch: fetchImpl });
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.headline.headline_line, 'Westone Loans 70% LTV — £294,000 gross / £244,406 net');
  assert.equal(JSON.stringify(body).includes('westoneloans.co.uk'), false);
  assert.equal(body.eligibility.matched, 45);
  const rpc = calls.find((item) => item.url.includes('/rpc/current_race_card'));
  assert.equal(rpc.method, 'POST');
  assert.equal(rpc.headers.apikey, 'service-role-test');
  assert.equal(rpc.headers.Authorization, 'Bearer service-role-test');
  assert.equal(rpc.headers['Accept-Profile'], undefined);
  assert.deepEqual(JSON.parse(rpc.body), { p_case_ref: 'UNASSIGNED-HIMANSHU' });
  assert.equal(calls.some((item) => item.url.includes('v_eligibility_matched_lenders?case_ref=eq.UNASSIGNED-HIMANSHU')), true);
  const snaps = calls.filter((item) => item.url.includes('command_dashboard_snapshots'));
  assert.equal(snaps.length, 1);
  assert.match(snaps[0].url, /pipeline_private_byron/);
  assert.equal(snaps[0].url.includes('finance_byron_only'), false);

  const page = response();
  await handleCommandDashboard({
    method: 'GET',
    url: '/staff/command?view=page',
    query: { view: 'page' },
    headers: { cookie: 'pf_staff=sb1.staff-access-token' },
  }, page, { env, fetch: fetchImpl });
  assert.equal(page.status, 200);
  assert.match(page.body, /Team Lizzy/);
});

test('deal flow keeps its board and adds a separate race card page', async () => {
  const html = renderPipeline({
    columns: [{ id: 'live', title: 'Live', move: 'Forward', highlight: false, cards: [{ id: 'card-1', caseRef: 'UNASSIGNED-HIMANSHU', name: 'Himanshu', stage: 'live', source: 'sheet' }] }],
    parked: [],
    completed: [],
  }, { owner: 'all', banner: 'Preview' });
  assert.match(html, /Current Race Card/);
  assert.match(html, /\/staff\/cockpit\/pipeline\/race\/UNASSIGNED-HIMANSHU/);
  assert.match(html, /Create\/Update LOR/);

  const env = {
    COCKPIT_SOURCE: 'preview',
    COCKPIT_AUTH: 'preview',
    COCKPIT_PREVIEW_PASSWORD: 'preview-desk',
    SUPABASE_URL: 'https://example.test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  };
  const login = await establishSession('preview-desk', { env });
  assert.equal(login.ok, true);
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body || '', headers: options.headers || {} });
    if (String(url).includes('/rpc/current_race_card')) return json(200, CARD);
    if (String(url).includes('/v_eligibility_matched_lenders')) return json(200, matches());
    return json(404, {});
  };
  const board = response();
  await pipeline({
    method: 'GET',
    url: '/staff/cockpit/pipeline',
    headers: { cookie: `pf_staff=${encodeURIComponent(login.session)}` },
  }, board, { env, fetch: fetchImpl });
  assert.equal(board.status, 200);
  assert.match(board.body, /Deal flow/);
  assert.equal(calls.some((item) => item.url.includes('current_race_card')), false);

  const card = response();
  await pipeline({
    method: 'GET',
    url: '/api/staff-pipeline?race=UNASSIGNED-HIMANSHU&tab=eligibility&audience=borrower',
    query: { race: 'UNASSIGNED-HIMANSHU', tab: 'eligibility', audience: 'borrower' },
    headers: { cookie: `pf_staff=${encodeURIComponent(login.session)}` },
  }, card, { env, fetch: fetchImpl });
  assert.equal(card.status, 200);
  assert.match(card.body, /Eligibility-Matched Lenders \(Broad Net\)/);
  assert.match(card.body, /45 matched, 44 awaiting, 1 offer in/);
  assert.equal(card.body.includes('westoneloans.co.uk'), false);
  assert.equal(card.body.includes('1.5% to Posfin'), false);
  assert.equal(calls.some((item) => item.url.includes('/rpc/current_race_card')), true);
});

test('a private case stays with Byron on the race card routes', async () => {
  assert.equal(byronOnlyCaseKeys([
    { section: 'pipeline', payload: { cases: [{ id: 'PUBLIC-1', private: false }, { id: 'HIDE-1', private: 'Y', case_ref: 'hide-1' }] } },
    { section: 'pipeline_private_byron', payload: { cases: [{ id: 'TEST-PRIVATE-001', case_ref: 'UNASSIGNED-SECRET' }] } },
  ]).has('TEST-PRIVATE-001'), true);
  const keys = byronOnlyCaseKeys([
    { section: 'pipeline_private_byron', payload: { cases: [{ id: 'TEST-PRIVATE-001', case_ref: 'UNASSIGNED-SECRET' }] } },
    { section: 'pipeline', payload: { cases: [{ id: 'PUBLIC-1' }, { id: 'HIDE-1', byron_only: true }] } },
  ]);
  assert.equal(keys.has('UNASSIGNED-SECRET'), true);
  assert.equal(keys.has('HIDE-1'), true);
  assert.equal(keys.has('PUBLIC-1'), false);

  const env = {
    STAFF_AUTH_MODE: 'supabase',
    VERCEL_ENV: 'production',
    STAFF_SUPABASE_URL: 'https://example.test',
    SUPABASE_URL: 'https://example.test',
    STAFF_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  };
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    calls.push(target);
    if (target.includes('/auth/v1/user')) {
      const token = String(options.headers?.Authorization || '');
      const email = token.includes('byron-token') ? 'byron.hill@posfincapital.com' : 'cai@posfincapital.com';
      return json(200, { email });
    }
    if (target.includes('/rpc/staff_caller')) {
      const token = String(options.headers?.Authorization || '');
      const byron = token.includes('byron-token');
      return json(200, [{ email: byron ? 'byron.hill@posfincapital.com' : 'cai@posfincapital.com', seat_code: byron ? 'byron' : 'cai', role: byron ? 'principal' : 'case_owner' }]);
    }
    if (target.includes('command_dashboard_snapshots')) {
      return json(200, [{ section: 'pipeline_private_byron', payload: { cases: [{ id: 'TEST-PRIVATE-001' }] } }]);
    }
    if (target.includes('/rpc/current_race_card')) return json(200, CARD);
    if (target.includes('/v_eligibility_matched_lenders')) return json(200, matches(1));
    return json(404, {});
  };
  const cai = response();
  await handleCommandDashboard({
    method: 'GET',
    url: '/api/command-dashboard?action=race-card&case=TEST-PRIVATE-001',
    query: { action: 'race-card', case: 'TEST-PRIVATE-001' },
    headers: { cookie: 'pf_staff=sb1.cai-token' },
  }, cai, { env, fetch: fetchImpl });
  assert.equal(cai.status, 403);
  assert.match(cai.body, /limited to Byron/);
  assert.equal(calls.some((url) => url.includes('/rpc/current_race_card')), false);

  const byron = response();
  await handleCommandDashboard({
    method: 'GET',
    url: '/api/command-dashboard?action=race-card&case=TEST-PRIVATE-001',
    query: { action: 'race-card', case: 'TEST-PRIVATE-001' },
    headers: { cookie: 'pf_staff=sb1.byron-token' },
  }, byron, { env, fetch: fetchImpl });
  assert.equal(byron.status, 200);
  assert.equal(JSON.parse(byron.body).case_ref, 'TEST-PRIVATE-001');
  assert.equal(calls.some((url) => url.includes('/rpc/current_race_card')), true);
});

test('a late staff refresh does not replace the borrower view', async () => {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../staff/command-app.js', import.meta.url))]);
  const listeners = {};
  let intervalFn = null;
  const panel = { innerHTML: '' };
  const slot = { innerHTML: '' };
  const document = {
    hidden: false,
    activeElement: null,
    body: { dataset: { seat: 'chris', finance: '0', name: 'Chris Shipton' } },
    querySelector(sel) {
      if (sel === '#panel') return panel;
      if (sel === '#fresh' || sel === '#seat-badge') return { textContent: '' };
      return null;
    },
    querySelectorAll() { return []; },
    getElementById(id) { return id === 'race-body' ? slot : null; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
  };
  const dashboard = {
    ok: true,
    seat: 'chris',
    displayName: 'Chris Shipton',
    canViewFinance: false,
    pipeline: { cases: [{ id: 'UNASSIGNED-HIMANSHU', name: 'Himanshu', stage: 'Live' }] },
    overview: { kpis: {}, standing_rules: [], highlights: [] },
    roster: { agents: [] },
    tasks: { cards: [] },
    lenders: { active_case_lenders: [] },
    files: {},
    thread: [],
  };
  let staffLoads = 0;
  let releaseStaff = () => {};
  const context = {
    document,
    location: { hash: '#pipeline' },
    history: { replaceState() {} },
    console,
    fetch: async (url) => {
      const target = String(url);
      if (target.includes('action=race-card') && target.includes('audience=borrower')) {
        return { ok: true, status: 200, text: async () => '<article class="race-sheet">Borrower-facing view</article>', json: async () => ({}) };
      }
      if (target.includes('action=race-card')) {
        staffLoads += 1;
        if (staffLoads > 1) await new Promise((resolve) => { releaseStaff = resolve; });
        return { ok: true, status: 200, text: async () => '<article class="race-sheet">1.5% to Posfin</article>', json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => dashboard, text: async () => '' };
    },
    setInterval(fn) { intervalFn = fn; return 1; },
    clearInterval() {},
    setTimeout,
    clearTimeout,
    Map,
    Intl,
    URL,
    URLSearchParams,
    Promise,
  };
  context.window = { document, location: context.location, addEventListener(type, fn) { (listeners[type] ||= []).push(fn); } };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../staff/command-app.js', import.meta.url), 'utf8'), context);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const click = (closest) => listeners.click[0]({ target: { closest, dataset: {}, id: '', getAttribute: () => '' } });
  await click((sel) => (sel === '[data-race-card]' ? { dataset: { raceCard: 'UNASSIGNED-HIMANSHU' }, getAttribute: () => 'UNASSIGNED-HIMANSHU' } : null));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(panel.innerHTML, /1\.5% to Posfin/);
  const slow = intervalFn();
  await click((sel) => (sel === '[data-race-audience]' ? { dataset: { raceAudience: 'borrower' } } : null));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(panel.innerHTML, /Borrower-facing view/);
  releaseStaff();
  await slow;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(panel.innerHTML, /Borrower-facing view/);
  assert.equal(panel.innerHTML.includes('1.5% to Posfin'), false);
  assert.equal(slot.innerHTML.includes('1.5% to Posfin'), false);
});

test('the command client opens the race card without leaving the case list', async () => {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../staff/command-app.js', import.meta.url))]);
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../lib/race-card.js', import.meta.url))]);
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../api/command-dashboard.js', import.meta.url))]);
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../api/staff-pipeline.js', import.meta.url))]);
  const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  assert.match(vercel, /\/staff\/command\/race\/:caseRef/);
  assert.match(vercel, /\/staff\/command\/eligibility\/:caseRef/);
  assert.match(vercel, /\/staff\/cockpit\/pipeline\/race\/:caseRef/);
  assert.match(vercel, /\/staff\/cockpit\/pipeline\/eligibility\/:caseRef/);
  assert.match(vercel, /\/staff\/command"/);
  assert.match(vercel, /\/staff\/command\/data/);
  assert.match(vercel, /\/staff\/cockpit\/pipeline"/);

  const listeners = {};
  const panel = { innerHTML: '' };
  const document = {
    hidden: false,
    activeElement: null,
    body: { dataset: { seat: 'chris', finance: '0', name: 'Chris Shipton' } },
    querySelector(sel) {
      if (sel === '#panel') return panel;
      if (sel === '#fresh' || sel === '#seat-badge') return { textContent: '' };
      return null;
    },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
  };
  const dashboard = {
    ok: true,
    seat: 'chris',
    displayName: 'Chris Shipton',
    canViewFinance: false,
    pipeline: { cases: [{ id: 'UNASSIGNED-HIMANSHU', name: 'Himanshu', stage: 'Live', urgent: '', loan: '£294,000', fee: '' }] },
    overview: { kpis: {}, standing_rules: [], highlights: [] },
    roster: { agents: [] },
    tasks: { cards: [] },
    lenders: { active_case_lenders: [] },
    files: {},
    thread: [],
  };
  const fetched = [];
  const context = {
    document,
    location: { hash: '#pipeline' },
    history: { replaceState() {} },
    console,
    fetch: async (url) => {
      fetched.push(String(url));
      if (String(url).includes('action=race-card')) {
        return { ok: true, status: 200, text: async () => '<article class="race-sheet"><h1>Current Race Card</h1><p>Westone Loans 70% LTV</p><button type="button" data-race-tab="eligibility">Eligibility-Matched Lenders (Broad Net)</button></article>', json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => dashboard, text: async () => '' };
    },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout,
    clearTimeout,
    Map,
    Intl,
    URL,
    URLSearchParams,
    Promise,
  };
  context.window = { document, location: context.location, addEventListener(type, fn) { (listeners[type] ||= []).push(fn); } };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../staff/command-app.js', import.meta.url), 'utf8'), context);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(panel.innerHTML, /data-race-card="UNASSIGNED-HIMANSHU"/);
  assert.match(panel.innerHTML, /Current Race Card/);
  const click = (closest) => listeners.click[0]({ target: { closest, dataset: {}, id: '', getAttribute: () => '' } });
  await click((sel) => (sel === '[data-race-card]' ? { dataset: { raceCard: 'UNASSIGNED-HIMANSHU' }, getAttribute: () => 'UNASSIGNED-HIMANSHU' } : null));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(panel.innerHTML, /race-drawer/);
  assert.match(panel.innerHTML, /Westone Loans 70% LTV/);
  assert.match(fetched.join('\n'), /action=race-card/);
  assert.match(fetched.join('\n'), /case=UNASSIGNED-HIMANSHU/);
  assert.match(panel.innerHTML, /data-case-id="UNASSIGNED-HIMANSHU"/);
});
