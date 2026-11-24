import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { handleCommandDashboard } from '../api/command-dashboard.js';
import { renderBoard } from '../lib/cockpit-html.js';
import {
  pipelineSeatMatch,
  presentDashboard,
  presentFinance,
  taskSeatMatch,
} from '../lib/command-dashboard.js';
import { renderSeat } from '../lib/seat-html.js';
import { seatByCode } from '../lib/staff-seats.js';

const SEATS = ['cai', 'jess', 'chris', 'aadi', 'vanessa'];

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

function json(status, body) {
  const text = JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => body };
}

function envFor(extra = {}) {
  return {
    STAFF_AUTH_MODE: 'supabase',
    VERCEL_ENV: 'production',
    STAFF_SUPABASE_URL: 'https://example.test',
    SUPABASE_URL: 'https://example.test',
    STAFF_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    XAI_API_KEY: 'xai-test-key',
    ...extra,
  };
}

function fixtureRows() {
  return [
    {
      section: 'overview',
      byron_only: false,
      source_updated_at: '2026-11-23T18:00:00.000Z',
      payload: {
        generated_at: '2026-11-23T18:00:00.000Z',
        kpis: {
          total_open_non_private: 4,
          live_deals: 3,
          urgent_emergency: 1,
          cai_assigned_live: 1,
          jess_assigned_live: 1,
          tasks_total: 1,
          open_decisions: 1,
          active_lenders: 1,
          lender_timing_metrics_available: true,
        },
        standing_rules: [{ id: 'R-001', title: 'Case assignment', set_by: 'Byron', set_at: '23 Nov 2026', text: 'WhatsApp assignment is the source for Cai and Jess.', applied: 'Seat filters use assigned seats.' }],
        highlights: ['Example highlight'],
      },
    },
    {
      section: 'roster',
      byron_only: false,
      payload: {
        generated_at: '2026-11-23T18:00:00.000Z',
        note: 'Private Lizzys are bridge pending.',
        agents: [
          { id: 'lizzy-cai', name: "Cai's private Lizzy", lane: 'Processing', status: 'bridge_pending' },
          { id: 'tom', name: 'Tom', lane: 'OpenClaw gateway', status: 'off' },
        ],
      },
    },
    {
      section: 'pipeline',
      byron_only: false,
      payload: {
        generated_at: '2026-11-23T18:00:00.000Z',
        rule_r001: { cai_count: 1, jess_count: 1, rule_text: 'Shared deals stay on both seats.', applied: 'assigned_seats lists every seat.' },
        totals: { open: 2, live_deals: 1, urgent_emergency: 1 },
        cases: [
          {
            id: 'TEST-SHARED-001',
            name: 'Example shared case',
            lane: 'Live deal',
            stage: 'Processing',
            owner: 'Cai',
            urgent: 'URGENT',
            needs_byron: false,
            loan: 'Example facility',
            fee: 'Example fee',
            el_status: 'Draft',
            last_message_date: '2026-11-22',
            days_since_last_message: 1,
            next_action: 'Chase the example document',
            next_action_owner: 'Cai',
            as_of: '2026-11-23',
            product: 'Bridge',
            assigned_seat: 'cai+jess',
            assigned_seats: ['cai', 'jess'],
            whatsapp_assigned: true,
          },
          {
            id: 'TEST-HIDDEN-INLINE',
            name: 'Should stay off the team register',
            lane: 'Live deal',
            stage: 'Processing',
            private: true,
            assigned_seat: 'byron',
          },
        ],
      },
    },
    {
      section: 'tasks',
      byron_only: false,
      payload: {
        generated_at: '2026-11-23T18:00:00.000Z',
        sheet_title: '23 Nov task cards',
        cards: [{ n: 1, case: 'Example shared case', need: 'Chase the example document', context: 'Shared seat', action: 'Call the lender', urgency: 'URGENT', case_id: 'TEST-SHARED-001', assigned_seat: 'cai+jess' }],
        private_cards_withheld: 1,
        byron_decisions: [{ title: 'Example decision', detail: 'Choose the example route.' }],
        byron_next_move_deals: [{ id: 'TEST-SHARED-001', name: 'Example shared case', urgent: 'URGENT', next_action: 'Byron to confirm', assigned_seat: 'byron' }],
      },
    },
    {
      section: 'lenders',
      byron_only: false,
      payload: {
        generated_at: '2026-11-23T18:00:00.000Z',
        source_status: { deep_dive_file: 'lender_metrics.json', deep_dive_present: true, note: 'Timing is loaded.' },
        active_case_lenders: [{ lender: 'Example Lender', open_cases: 1, case_ids: ['TEST-SHARED-001'], median_days_since_last_case_message: 1, max_days_since_last_case_message: 1 }],
        deep_dive_metrics: {
          schema: 'v1',
          as_of: '2026-11-23',
          timezone: 'Europe/London',
          internal_only: true,
          method: 'Example method',
          lenders: [{ id: 'example', name: 'Example Lender', status: 'Active', broka_median_h: 2, days_to_offer: 3, offer_to_completion: 4, dead_air: 1, live_cases: 1, open_items: 0 }],
        },
      },
    },
    {
      section: 'files',
      byron_only: false,
      payload: {
        generated_at: '2026-11-23T18:00:00.000Z',
        key_sheets: [
          { label: 'Register', name: 'CASE_REGISTER.csv', folder: 'CASE_REGISTER', description: 'Open cases', present: true, updated_at: '2026-11-23T00:00:00.000Z' },
          { label: 'Secret', name: 'credentials.txt', folder: '/secure/raw', description: 'Do not show' },
        ],
        recent_outputs: [{ name: 'notes.md', folder: 'outputs', category: 'note', updated_at: '2026-11-23T00:00:00.000Z', size_kb: 4 }],
      },
    },
    {
      section: 'finance_byron_only',
      byron_only: true,
      payload: {
        generated_at: '2026-11-22T00:00:00.000Z',
        basis: 'Revolut cash only',
        excluded_notice: 'Cash reconciliation only.',
        last_12_months: { period: 'SYNTHETIC-PERIOD', fee_receipts_cash: 1 },
        october_2026: { fee_receipts_cash: 1, business_operating_costs: 1, introducer_case_client_payments: 1, operating_cash_after_pay: 1 },
        november_2026_to_22nd: { fee_receipts_cash: 1, business_operating_costs: 1, introducer_case_client_payments: 1, operating_cash_after_pay: 1, partial: true },
        balances: { main_gbp_22_nov_2026: 1, card_declines_insufficient_balance_oct_nov_2026: 2 },
        months: [{ month: '2026-10', fee_receipts_cash: 1, cva: 99, vat: 99, corporation_tax: 99, quickbooks_status: 'no' }],
        cva: 99,
        vat: 99,
        quickbooks_total: 99,
        corporation_tax: 99,
        not_included: ['Example exclusion'],
        sources: ['revolut.csv', '/secure/raw/secret.csv'],
      },
    },
    {
      section: 'pipeline_private_byron',
      byron_only: true,
      payload: {
        generated_at: '2026-11-23T18:00:00.000Z',
        cases: [{ id: 'TEST-PRIVATE-001', name: 'Withheld example', lane: 'Live deal', stage: 'Processing', assigned_seat: 'byron', whatsapp_assigned: false }],
      },
    },
  ];
}

function requestedSections(url) {
  const match = String(url).match(/section=in\.\(([^)]*)\)/);
  return match ? match[1].split(',') : [];
}

function harness(seat) {
  const email = seatByCode(seat).email;
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    const headers = options.headers || {};
    calls.push({ url: target, method: options.method || 'GET', headers, body: options.body || '' });
    if (target.includes('/auth/v1/user')) {
      if (headers.apikey !== 'anon-key' || !String(headers.Authorization || '').includes('staff-access-token')) return json(401, {});
      return json(200, { email });
    }
    if (target.includes('/rpc/staff_caller')) {
      if (headers.apikey !== 'anon-key' || !String(headers.Authorization || '').includes('staff-access-token')) return json(401, {});
      return json(200, [{ email, seat_code: seat, role: seat === 'byron' ? 'principal' : 'case_owner' }]);
    }
    if (target.includes('api.x.ai')) {
      return json(200, { choices: [{ message: { content: 'From the dashboard only.' } }] });
    }
    if (target.includes('/command_dashboard_snapshots')) {
      if (headers.apikey !== 'service-role-test' || headers.Authorization !== 'Bearer service-role-test') return json(401, {});
      const wanted = requestedSections(target);
      return json(200, fixtureRows().filter((row) => wanted.includes(row.section)));
    }
    if (target.includes('/command_dashboard_thread')) {
      if (headers.apikey !== 'service-role-test') return json(401, {});
      if ((options.method || 'GET') === 'POST') {
        const posted = JSON.parse(options.body);
        return json(201, [{ id: 7, created_at: '2026-11-23T12:00:00.000Z', ...posted }]);
      }
      return json(200, [
        { id: 2, created_at: '2026-11-23T12:00:00.000Z', from_agent: 'cai', to_agent: 'all', seat: 'cai', message: 'Newer note' },
        { id: 1, created_at: '2026-11-23T11:00:00.000Z', from_agent: 'jess', to_agent: 'lizzy', seat: 'jess', message: 'Older note' },
        { id: 3, created_at: '2026-11-23T10:00:00.000Z', from_agent: 'cai', to_agent: 'tom', seat: 'cai', message: 'Do not show this route' },
      ]);
    }
    return json(404, { message: 'unexpected' });
  };
  return { calls, fetchImpl, email };
}

async function call(method, seat, { query = {}, body, headers = {}, cookie = true, env } = {}) {
  const bag = harness(seat || 'cai');
  const params = new URLSearchParams(query);
  const req = {
    method,
    url: `/api/command-dashboard${params.toString() ? `?${params}` : ''}`,
    query,
    headers: {
      ...(cookie ? { cookie: `pf_staff=${encodeURIComponent('sb1.staff-access-token')}` } : {}),
      ...headers,
    },
    body,
  };
  const res = response();
  await handleCommandDashboard(req, res, { env: env || envFor(), fetch: bag.fetchImpl });
  return { res, ...bag };
}

function parsed(res) {
  return JSON.parse(res.body || '{}');
}

function snapshotCalls(calls) {
  return calls.filter((item) => item.url.includes('/command_dashboard_snapshots'));
}

test('overlap seats match Cai and Jess together and separately', () => {
  const shared = { assigned_seat: 'cai+jess', assigned_seats: ['cai', 'jess'] };
  assert.equal(pipelineSeatMatch(shared, 'cai'), true);
  assert.equal(pipelineSeatMatch(shared, 'jess'), true);
  assert.equal(pipelineSeatMatch(shared, 'chris'), false);
  assert.equal(pipelineSeatMatch({ assigned_seat: 'cai+jess' }, 'jess'), true);
  assert.equal(taskSeatMatch({ assigned_seat: 'cai+jess' }, 'cai'), true);
  assert.equal(taskSeatMatch({ assigned_seat: 'cai+jess' }, 'jess'), true);
  assert.equal(taskSeatMatch({ assigned_seat: 'jess' }, 'cai'), false);
});

test('finance presentation keeps the cash columns and drops excluded ledgers', () => {
  const finance = presentFinance(fixtureRows().find((row) => row.section === 'finance_byron_only').payload);
  assert.equal(finance.last_12_months.period, 'SYNTHETIC-PERIOD');
  assert.equal(finance.months[0].fee_receipts_cash, 1);
  assert.equal(finance.months[0].cva, undefined);
  assert.equal(finance.quickbooks_total, undefined);
  assert.equal(finance.vat, undefined);
  assert.equal(finance.corporation_tax, undefined);
  assert.equal(JSON.stringify(finance.months).includes('cva'), false);
  assert.equal(finance.sources.includes('revolut.csv'), true);
  assert.equal(finance.sources.some((item) => item.includes('secure')), false);
});

test('a presenter given Byron-only rows still withholds them from every other seat', () => {
  const hidden = presentDashboard({
    seat: 'cai',
    email: seatByCode('cai').email,
    displayName: 'Cai',
    rows: fixtureRows(),
    thread: [],
  });
  assert.equal(hidden.canViewFinance, false);
  assert.equal(hidden.finance, null);
  assert.equal(Object.hasOwn(hidden, 'privateCases'), false);
  assert.equal(JSON.stringify(hidden).includes('TEST-PRIVATE-001'), false);
  assert.equal(JSON.stringify(hidden).includes('SYNTHETIC-PERIOD'), false);
  assert.equal(hidden.pipeline.cases.some((item) => item.id === 'TEST-HIDDEN-INLINE'), false);
  assert.equal(hidden.roster.agents.some((item) => /tom|gateway|openclaw/i.test(item.name + item.lane)), false);
});

test('unauthenticated command requests return 401 and do not query Supabase', async () => {
  const denied = await call('GET', 'cai', { cookie: false });
  assert.equal(denied.res.status, 401);
  assert.equal(parsed(denied.res).error, 'Sign in is required.');
  assert.equal(denied.calls.length, 0);
  const posted = await call('POST', 'cai', { cookie: false, query: { action: 'thread' }, body: { message: 'Hello', to_agent: 'all' } });
  assert.equal(posted.res.status, 401);
  assert.equal(posted.calls.length, 0);
  const finance = await call('GET', 'cai', { cookie: false, query: { section: 'finance' } });
  assert.equal(finance.res.status, 401);
  const bearer = await call('GET', 'cai', {
    cookie: false,
    headers: { authorization: 'Bearer service-role-test' },
  });
  assert.equal(bearer.res.status, 401);
  assert.equal(bearer.calls.length, 0);
});

test('team seats never receive finance or private cases and finance requests return 403', async () => {
  for (const seat of SEATS) {
    const loaded = await call('GET', seat, { headers: seat === 'jess' ? { cookie: '', authorization: 'Bearer staff-access-token' } : {} });
    assert.equal(loaded.res.status, 200, seat);
    const body = parsed(loaded.res);
    assert.equal(body.seat, seat);
    assert.equal(body.email, seatByCode(seat).email);
    assert.equal(body.canViewFinance, false);
    assert.equal(body.finance, null);
    assert.equal(Object.hasOwn(body, 'privateCases'), false);
    const packed = JSON.stringify(body);
    assert.equal(packed.includes('finance_byron_only'), false);
    assert.equal(packed.includes('pipeline_private_byron'), false);
    assert.equal(packed.includes('TEST-PRIVATE-001'), false);
    assert.equal(packed.includes('SYNTHETIC-PERIOD'), false);
    assert.equal(packed.includes('service-role-test'), false);
    assert.equal(body.pipeline.cases.some((item) => item.id === 'TEST-SHARED-001'), true);
    assert.deepEqual(body.pipeline.cases.find((item) => item.id === 'TEST-SHARED-001').assigned_seats, ['cai', 'jess']);
    assert.equal(body.overview.kpis.cai_assigned_live, 1);
    assert.equal(body.tasks.cards[0].assigned_seat, 'cai+jess');
    assert.equal(body.thread.some((item) => item.to_agent === 'tom'), false);
    assert.equal(body.thread[0].id, 1);
    const snaps = snapshotCalls(loaded.calls);
    assert.equal(snaps.length, 1);
    assert.equal(snaps[0].url.includes('finance_byron_only'), false);
    assert.equal(snaps[0].url.includes('pipeline_private_byron'), false);
    assert.match(snaps[0].url, /section=in\.\(overview,roster,pipeline,tasks,lenders,files\)/);
    assert.equal(snaps[0].headers['Accept-Profile'], 'pipeline');
    assert.equal(snaps[0].headers.apikey, 'service-role-test');
    const auth = loaded.calls.find((item) => item.url.includes('/auth/v1/user'));
    assert.equal(auth.headers.apikey, 'anon-key');
    assert.equal(auth.headers.Authorization, 'Bearer staff-access-token');

    const blocked = await call('GET', seat, { query: { section: 'finance' } });
    assert.equal(blocked.res.status, 403);
    assert.equal(snapshotCalls(blocked.calls).length, 0);
    const renamed = await call('GET', seat, { query: { section: 'pipeline_private_byron' } });
    assert.equal(renamed.res.status, 403);
    assert.equal(snapshotCalls(renamed.calls).length, 0);
  }
});

test('Byron receives finance, private cases, and a narrow finance response', async () => {
  const loaded = await call('GET', 'byron');
  assert.equal(loaded.res.status, 200);
  const body = parsed(loaded.res);
  assert.equal(body.canViewFinance, true);
  assert.equal(body.displayName, 'Byron Hill');
  assert.equal(body.finance.last_12_months.period, 'SYNTHETIC-PERIOD');
  assert.equal(body.finance.months[0].cva, undefined);
  assert.equal(body.privateCases.some((item) => item.id === 'TEST-PRIVATE-001'), true);
  assert.equal(snapshotCalls(loaded.calls)[0].url.includes('finance_byron_only'), true);
  assert.equal(snapshotCalls(loaded.calls)[0].url.includes('pipeline_private_byron'), true);

  const finance = await call('GET', 'byron', { query: { section: 'finance' } });
  assert.equal(finance.res.status, 200);
  const narrow = parsed(finance.res);
  assert.equal(narrow.canViewFinance, true);
  assert.equal(narrow.finance.last_12_months.fee_receipts_cash, 1);
  assert.equal(Object.hasOwn(narrow, 'privateCases'), false);
  const url = snapshotCalls(finance.calls)[0].url;
  assert.match(url, /section=in\.\(finance_byron_only\)/);
  assert.equal(url.includes('pipeline_private_byron'), false);
});

test('thread posts aimed at Tom, the gateway or OpenClaw return 400', async () => {
  for (const toAgent of ['tom', 'Tom', 'openclaw', 'OpenClaw', 'gateway', 'the gateway']) {
    const denied = await call('POST', 'cai', { query: { action: 'thread' }, body: { to_agent: toAgent, message: 'Hello' } });
    assert.equal(denied.res.status, 400, toAgent);
    assert.match(parsed(denied.res).error, /not connected/);
    assert.equal(denied.calls.some((item) => item.method === 'POST' && item.url.includes('command_dashboard_thread')), false);
  }
  const routed = await call('POST', 'jess', {
    query: { action: 'thread' },
    body: { to_agent: 'all', target: 'gateway', message: 'Hello team' },
  });
  assert.equal(routed.res.status, 400);
  assert.equal(routed.calls.some((item) => item.url.includes('command_dashboard_thread')), false);

  const allowed = await call('POST', 'cai', {
    query: { action: 'thread' },
    body: { from_agent: 'tom', to_agent: 'lizzy', message: 'Please leave Tom out of this.' },
  });
  assert.equal(allowed.res.status, 201);
  const insert = allowed.calls.find((item) => item.method === 'POST' && item.url.includes('command_dashboard_thread'));
  const stored = JSON.parse(insert.body);
  assert.equal(stored.from_agent, 'cai');
  assert.equal(stored.seat, 'cai');
  assert.equal(stored.to_agent, 'lizzy');
  assert.equal(stored.message, 'Please leave Tom out of this.');
  assert.equal(insert.headers['Content-Profile'], 'pipeline');

  const empty = await call('POST', 'aadi', { query: { action: 'thread' }, body: { to_agent: 'all', message: '   ' } });
  assert.equal(empty.res.status, 400);
  const huge = await call('POST', 'vanessa', { query: { action: 'thread' }, body: { to_agent: 'social', message: 'x'.repeat(2001) } });
  assert.equal(huge.res.status, 400);
});

test('Ask Lizzy strips finance and private context for team seats and reports a missing key', async () => {
  const team = await call('POST', 'cai', { query: { action: 'ask' }, body: { question: 'How many live deals are there?' } });
  assert.equal(team.res.status, 200);
  assert.equal(parsed(team.res).model, 'grok-3-mini');
  assert.equal(JSON.stringify(parsed(team.res)).includes('xai-test-key'), false);
  const sent = JSON.parse(team.calls.find((item) => item.url.includes('api.x.ai')).body);
  assert.equal(sent.model, 'grok-3-mini');
  assert.equal(sent.temperature, 0.2);
  const context = JSON.parse(sent.messages[1].content.slice(sent.messages[1].content.indexOf('{'), sent.messages[1].content.lastIndexOf('}') + 1));
  assert.equal(context.finance, undefined);
  assert.equal(context.private_cases, undefined);
  assert.equal(JSON.stringify(context).includes('TEST-PRIVATE-001'), false);
  assert.equal(JSON.stringify(context).includes('SYNTHETIC-PERIOD'), false);
  assert.equal(snapshotCalls(team.calls)[0].url.includes('finance_byron_only'), false);
  assert.match(sent.messages[0].content, /British English/);
  assert.match(sent.messages[0].content, /Never invent figures/);

  const byron = await call('POST', 'byron', { query: { action: 'ask' }, body: { question: 'What cash is on the dashboard?' } });
  const byronSent = JSON.parse(byron.calls.find((item) => item.url.includes('api.x.ai')).body);
  const byronContext = JSON.parse(byronSent.messages[1].content.slice(byronSent.messages[1].content.indexOf('{'), byronSent.messages[1].content.lastIndexOf('}') + 1));
  assert.equal(byronContext.finance.last_12_months.period, 'SYNTHETIC-PERIOD');
  assert.equal(byronContext.private_cases.some((item) => item.id === 'TEST-PRIVATE-001'), true);

  const missing = await call('POST', 'jess', {
    query: { action: 'ask' },
    body: { question: 'Hello' },
    env: envFor({ XAI_API_KEY: '' }),
  });
  assert.equal(missing.res.status, 503);
  assert.equal(parsed(missing.res).error, 'Ask Lizzy is awaiting server AI key configuration.');
  assert.equal(missing.calls.some((item) => item.url.includes('api.x.ai')), false);
  assert.equal(snapshotCalls(missing.calls).length, 0);
});

test('the sign-in form returns to the command dashboard with the staff cookie', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push(String(url));
    const headers = options.headers || {};
    if (String(url).includes('/auth/v1/token')) {
      assert.equal(headers.apikey, 'anon-key');
      return json(200, { access_token: 'staff-access-token' });
    }
    if (String(url).includes('/auth/v1/user')) return json(200, { email: seatByCode('chris').email });
    if (String(url).includes('/rpc/staff_caller')) {
      return json(200, [{ email: seatByCode('chris').email, seat_code: 'chris', role: 'case_owner' }]);
    }
    return json(404, {});
  };
  const req = {
    method: 'POST',
    url: '/api/command-dashboard?view=page',
    query: { view: 'page' },
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: { email: seatByCode('chris').email, password: 'unique-password' },
  };
  const res = response();
  await handleCommandDashboard(req, res, { env: envFor(), fetch: fetchImpl });
  assert.equal(res.status, 303);
  assert.equal(res.headers.location, '/staff/command');
  assert.match(String(res.headers['set-cookie']), /pf_staff=/);
  assert.equal(calls.some((url) => url.includes('command_dashboard')), false);
  assert.equal(JSON.stringify(calls).includes('service-role-test'), false);
});

test('the command page uses the staff sign-in and only Byron sees the finance tab', async () => {
  const anon = await call('GET', 'cai', { cookie: false, query: { view: 'page' } });
  assert.equal(anon.res.status, 401);
  assert.match(anon.res.body, /Work email/);
  assert.match(anon.res.body, /Staff password/);
  assert.match(anon.res.body, /action="\/staff\/command"/);
  assert.equal(anon.calls.length, 0);

  const cai = await call('GET', 'cai', { query: { view: 'page' } });
  assert.equal(cai.res.status, 200);
  assert.equal(cai.res.body.includes('data-finance="0"'), true);
  assert.equal(cai.res.body.includes('P&amp;L'), false);
  assert.match(cai.res.body, /Staff Cockpit \/ Run Sheet/);
  assert.match(cai.res.body, /\/staff\/command-app\.js/);
  assert.equal(snapshotCalls(cai.calls).length, 0);

  const byron = await call('GET', 'byron', { query: { view: 'page' } });
  assert.equal(byron.res.status, 200);
  assert.match(byron.res.body, /data-finance="1"/);
  assert.match(byron.res.body, /P&amp;L &amp; cash flow/);
  assert.match(byron.res.body, /data-seat="byron"/);
});

test('the cockpit and seat views link to the command dashboard', () => {
  const board = renderBoard({
    mode: 'preview',
    filter: 'all',
    schemaPending: false,
    sections: [],
    newLeadsHtml: '',
    liveCases: false,
    seatLinks: [],
  });
  assert.match(board, /href="\/staff\/command"/);
  assert.match(board, /Team Lizzy &amp; Command Dashboard/);
  const seat = renderSeat({
    seat: { code: 'jess', name: 'Jess', role: 'case_owner' },
    today: '23 Nov 2026',
    query: { from: '', to: '', source: 'all' },
    sources: [],
    tasks: [],
    leads: [],
    completed: [],
    cases: [],
    warning: '',
    source: 'live',
    schemaPending: false,
    leadsAvailable: true,
    casesAvailable: true,
  });
  assert.match(seat, /href="\/staff\/command"/);
  assert.match(seat, /Team Lizzy &amp; Command Dashboard/);
});

test('the client, migration and routes stay free of secrets and excluded columns', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const client = readFileSync(new URL('../staff/command-app.js', import.meta.url), 'utf8');
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../staff/command-app.js', import.meta.url))]);
  assert.match(client, /Array\.isArray\(c\.assigned_seats\) \? c\.assigned_seats\.includes\(seat\) : String\(c\.assigned_seat \|\| ""\)\.split\("\+"\)\.includes\(seat\)/);
  assert.match(client, /String\(item\.assigned_seat \|\| ""\)\.split\("\+"\)\.includes\(seat\)/);
  assert.equal(/quickbooks|corporation_tax|\bcva\b/i.test(client), false);
  assert.match(client, /\/staff\/command\/data/);

  const sql = readFileSync(new URL('../supabase/migrations/20261123_command_dashboard.sql', import.meta.url), 'utf8');
  assert.match(sql, /pipeline\.command_dashboard_snapshots/);
  assert.match(sql, /pipeline\.command_dashboard_thread/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.equal(/create policy/i.test(sql), false);
  assert.equal(/\binsert into\b/i.test(sql), false);
  assert.equal(/grant\s+.+\s+to\s+(anon|authenticated)/i.test(sql), false);

  const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  assert.match(vercel, /\/staff\/command"/);
  assert.match(vercel, /\/staff\/command\.html/);
  assert.match(vercel, /\/staff\/command\/data/);

  const banned = [
    /eyJ[A-Za-z0-9_-]{10,}/,
    /sk-[A-Za-z0-9]{8,}/,
    /sb_secret_/,
    /56697/,
    /680359/,
    /byronhill739@gmail\.com/,
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]+['"]/,
    /XAI_API_KEY\s*=\s*['"][^'"]+['"]/,
  ];
  const paths = [
    'api/command-dashboard.js',
    'lib/command-dashboard.js',
    'lib/command-page.js',
    'staff/command-app.js',
    'staff/command.css',
    'supabase/migrations/20261123_command_dashboard.sql',
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    for (const pattern of banned) assert.equal(pattern.test(source), false, `${path} ${pattern}`);
  }
  assert.equal(root.endsWith('/'), true);
});

test('a pipeline row click opens the case detail and urgency counts filter the list', async () => {
  const listeners = {};
  const panel = { innerHTML: '' };
  let hash = '#overview';
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
  const location = {
    get hash() { return hash; },
    set hash(value) { hash = value; },
  };
  const history = {
    replaceState(_state, _title, next) {
      if (String(next).startsWith('#')) hash = String(next);
    },
  };
  const dashboard = {
    ok: true,
    seat: 'chris',
    displayName: 'Chris Shipton',
    canViewFinance: false,
    finance: null,
    freshness: {},
    overview: { kpis: {}, standing_rules: [], highlights: [] },
    roster: { agents: [] },
    pipeline: {
      cases: [
        {
          id: 'TEST-SHARED-001', name: 'Example shared case', lane: 'Live deal', stage: 'Processing',
          owner: 'Cai', urgent: 'URGENT', loan: 'Example facility', fee: 'Example fee',
          last_message_date: '2026-11-22', days_since_last_message: 1, next_action: 'Chase the example document',
          assigned_seat: 'cai+jess', assigned_seats: ['cai', 'jess'], whatsapp_assigned: true,
        },
        {
          id: 'TEST-EMERG-001', name: 'Example emergency', lane: 'Live deal', stage: 'Packaging',
          owner: 'Byron', urgent: 'EMERGENCY', loan: 'Emergency facility', fee: 'Emergency fee',
          last_message_date: '2026-11-23', days_since_last_message: 0, next_action: 'Byron to decide',
          assigned_seat: 'byron', whatsapp_assigned: true,
        },
        { id: 'short', name: 'Too short to file', lane: 'Enquiry', stage: 'New', urgent: '', loan: '', fee: '' },
      ],
    },
    tasks: { cards: [] },
    lenders: { active_case_lenders: [] },
    files: { key_sheets: [], recent_outputs: [] },
    thread: [],
  };
  const context = {
    document,
    location,
    history,
    console,
    fetch: async () => ({ ok: true, status: 200, json: async () => dashboard }),
    setInterval() { return 0; },
    clearInterval() {},
    setTimeout,
    clearTimeout,
    Map,
    Intl,
    URL,
    Promise,
  };
  context.window = {
    document,
    location,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL('../staff/command-app.js', import.meta.url), 'utf8'), context);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.match(panel.innerHTML, /data-mode="emergency"/);
  assert.match(panel.innerHTML, /data-mode="urgent-only"/);

  const click = (closest) => listeners.click[0]({ target: { closest, id: '' } });
  await click((sel) => (sel === '[data-case-id]' ? { dataset: { caseId: 'TEST-SHARED-001' } } : null));
  assert.equal(hash, '#pipeline/TEST-SHARED-001');
  assert.match(panel.innerHTML, /data-case-detail="TEST-SHARED-001"/);
  assert.match(panel.innerHTML, /Chase the example document/);
  assert.match(panel.innerHTML, /Example facility/);
  assert.match(panel.innerHTML, /Example fee/);
  assert.match(panel.innerHTML, /1 day/);
  assert.match(panel.innerHTML, /href="\/staff\/cases\/TEST-SHARED-001"/);
  assert.match(panel.innerHTML, /Open the case file/);

  await click((sel) => (sel === '[data-pipeline-back]' ? { dataset: {} } : null));
  assert.equal(hash, '#pipeline');
  assert.match(panel.innerHTML, /data-case-id="TEST-SHARED-001"/);
  assert.match(panel.innerHTML, /data-case-id="short"/);

  await click((sel) => (sel === '[data-case-id]' ? { dataset: { caseId: 'short' } } : null));
  assert.match(panel.innerHTML, /No staff case file for this row/);
  assert.equal(panel.innerHTML.includes('/staff/cases/short'), false);

  await click((sel) => (sel === '[data-mode]' ? { dataset: { mode: 'emergency' } } : null));
  assert.equal(hash, '#pipeline');
  assert.match(panel.innerHTML, /data-case-id="TEST-EMERG-001"/);
  assert.equal(panel.innerHTML.includes('TEST-SHARED-001'), false);
  assert.match(panel.innerHTML, /aria-pressed="true"/);
});
