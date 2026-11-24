import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { handleCommandDashboard } from '../api/command-dashboard.js';
import { readSeatUsageFile } from '../api/_seat-usage/load.js';
import { loadSeatUsage, presentSeatUsage, shareLabel } from '../lib/seat-usage.js';
import { seatByCode } from '../lib/staff-seats.js';

const NOTES = [
  'Shares only; token counts not available',
  'Other team members\' private seats (Chris, Jess, Cai, Aadi, Vanessa) are on their own accounts and are not included; figures to be added when available',
];

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
  const text = body == null ? '' : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: async () => text, json: async () => body };
}

function envFor() {
  return {
    STAFF_AUTH_MODE: 'supabase',
    VERCEL_ENV: 'production',
    STAFF_SUPABASE_URL: 'https://example.test',
    SUPABASE_URL: 'https://example.test',
    STAFF_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  };
}

function harness(seat) {
  const email = seatByCode(seat).email;
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    const headers = options.headers || {};
    calls.push({ url: target, method: options.method || 'GET' });
    if (target.includes('/auth/v1/user')) {
      if (headers.apikey !== 'anon-key') return json(401, {});
      return json(200, { email });
    }
    if (target.includes('/rpc/staff_caller')) return json(200, [{ email, seat_code: seat, role: seat === 'byron' ? 'principal' : 'case_owner' }]);
    return json(404, { message: 'unexpected' });
  };
  return { calls, fetchImpl };
}

async function call(method, seat, { query = {}, cookie = true } = {}) {
  const bag = harness(seat || 'byron');
  const params = new URLSearchParams(query);
  const req = {
    method,
    url: `/api/command-dashboard${params.toString() ? `?${params}` : ''}`,
    query,
    headers: cookie ? { cookie: `pf_staff=${encodeURIComponent('sb1.staff-access-token')}` } : {},
  };
  const res = response();
  await handleCommandDashboard(req, res, { env: envFor(), fetch: bag.fetchImpl });
  return { res, ...bag };
}

function parsed(res) {
  return JSON.parse(res.body || '{}');
}

test('the snapshot records shares, and a share under 1% is not stored as zero', () => {
  const file = readSeatUsageFile();
  assert.equal(file.schema, 'posfin.seat-usage.v1');
  assert.equal(file.version, 1);
  assert.equal(file.captured_at, '2026-11-24T17:14:00+01:00');
  assert.equal(file.captured_timezone, 'Europe/Paris');
  assert.equal(file.window.from, '2026-11-17');
  assert.equal(file.window.to, '2026-11-24');
  assert.equal(file.window.timezone, 'UTC');
  assert.deepEqual(file.notes, NOTES);
  assert.equal(file.plan.weekly_limit_used_percent, 90.5);
  assert.equal(file.plan.limit_shared_with_other_apps, true);
  assert.equal(file.plan.resets_at, '2026-11-27T10:48:00+01:00');
  assert.equal(file.plan.resets_label, 'Fri 27 Nov 2026 10:48 Paris');
  assert.equal(file.plan.on_demand, false);
  const lizzy = file.seats[0];
  assert.equal(lizzy.share.percent, 99);
  assert.equal(lizzy.daily.reduce((sum, day) => sum + day.percent, 0), 99);
  assert.deepEqual(lizzy.daily.map((day) => day.percent), [0, 0, 0, 5, 5, 14, 34, 41]);
  assert.equal(file.seats[1].share.about, 1);
  assert.equal(file.seats[1].daily.at(-1).percent, 1);
  assert.equal(file.seats[1].daily.slice(0, -1).every((day) => day.below === 1 && day.percent == null), true);
  for (const seat of file.seats.slice(2)) {
    assert.equal(seat.share.below, 1);
    assert.equal(seat.share.percent, undefined);
    assert.equal(Object.hasOwn(seat.share, 'percent'), false);
  }
  assert.equal(file.seats[2].bot_name, 'Lizzy – Posfin Team');
  const source = readFileSync(new URL('../api/_seat-usage/snapshot.json', import.meta.url), 'utf8');
  assert.equal(source.includes('@'), false);
  assert.equal(/sk-|eyJ|service_role|api[_-]?key/i.test(source), false);
});

test('labels keep under 1% distinct from zero and name the heaviest seat', () => {
  assert.equal(shareLabel({ kind: 'below', n: 1 }), '<1%');
  assert.equal(shareLabel({ kind: 'about', n: 1 }), 'about 1%');
  assert.equal(shareLabel({ kind: 'percent', n: 0 }), '0%');
  const view = loadSeatUsage();
  assert.equal(view.as_of, '2026-11-24T17:14:00+01:00');
  assert.equal(view.as_of_label, 'Tue 24 Nov 2026, 17:14 Paris');
  assert.equal(view.window_label, 'Last 7 days · 17–24 Nov 2026 (UTC)');
  assert.equal(view.measure_label, 'Shares of all Grok Bot usage on Byron\'s account');
  assert.deepEqual(view.notes, NOTES);
  assert.equal(view.plan.used_label, '90.5%');
  assert.equal(view.plan.used_percent, 90.5);
  assert.equal(view.plan.resets_label, 'Fri 27 Nov 2026 10:48 Paris');
  assert.equal(view.plan.on_demand, false);
  assert.equal(view.plan.on_demand_label, 'On-demand usage off');
  assert.match(view.plan.shared_note, /other apps on the plan/);
  assert.equal(view.heaviest.id, 'lizzy-chief-of-staff');
  assert.equal(view.heaviest.label, '99%');
  const lizzy = view.seats.find((seat) => seat.id === 'lizzy-chief-of-staff');
  const april = view.seats.find((seat) => seat.id === 'april');
  const team = view.seats.find((seat) => seat.id === 'team-lizzy');
  assert.equal(lizzy.heaviest, true);
  assert.equal(lizzy.label, '99%');
  assert.equal(lizzy.bar, 99);
  assert.equal(april.label, 'about 1%');
  assert.equal(april.bar, 1);
  assert.equal(april.heaviest, false);
  assert.equal(team.label, '<1%');
  assert.equal(team.bar, null);
  assert.equal(team.below, true);
  assert.equal(team.bot_name, 'Lizzy – Posfin Team');
  assert.equal(JSON.stringify(team).includes('0%'), false);
  const lizzyDays = view.chart.series[0].points;
  const aprilDays = view.chart.series[1].points;
  assert.equal(view.chart.axis_max, 50);
  assert.equal(view.chart.days[0].short, 'Tue 17');
  assert.equal(view.chart.days[3].full, 'Fri 20 Nov');
  assert.deepEqual(lizzyDays.map((point) => point.label), ['0%', '0%', '0%', '5%', '5%', '14%', '34%', '41%']);
  assert.equal(aprilDays[0].label, '<1%');
  assert.equal(aprilDays[0].below, true);
  assert.equal(aprilDays[0].bar, null);
  assert.equal(aprilDays.at(-1).label, '1%');
  assert.equal(view.chart.series.length, 2);
  assert.match(view.chart.caption, /Team Lizzy/);
  assert.match(view.chart.caption, /no day-by-day split/);
  assert.throws(() => presentSeatUsage({ seats: [] }), /snapshot/);
  const under = presentSeatUsage({
    captured_at: '2026-11-24T17:14:00+01:00',
    seats: [{ id: 'sample', name: 'Sample', share: { below: 1 } }],
  });
  assert.equal(under.seats[0].label, '<1%');
  assert.equal(under.seats[0].label.includes('0'), false);
});

test('signed-in staff can read seat usage and other seats stay unchanged', async () => {
  const anon = await call('GET', 'jess', { query: { action: 'seat-usage' }, cookie: false });
  assert.equal(anon.res.status, 401);
  assert.equal(anon.calls.length, 0);

  for (const seat of ['byron', 'jess', 'cai']) {
    const loaded = await call('GET', seat, { query: { action: 'seat-usage' } });
    assert.equal(loaded.res.status, 200, seat);
    const body = parsed(loaded.res);
    assert.equal(body.heaviest.name, 'Lizzy Chief of Staff');
    assert.equal(body.seats.find((item) => item.id === 'team-lizzy').label, '<1%');
    assert.deepEqual(body.notes, NOTES);
    assert.equal(loaded.calls.some((item) => item.url.includes('command_dashboard')), false);
    assert.equal(loaded.calls.some((item) => item.url.includes('service-role-test')), false);
  }

  const page = await call('GET', 'cai', { query: { view: 'page' } });
  assert.equal(page.res.status, 200);
  assert.match(page.res.body, /data-tab="usage"/);
  assert.match(page.res.body, />Seat usage</);
  assert.equal(page.res.body.includes('P&amp;L'), false);
  const byron = await call('GET', 'byron', { query: { view: 'page' } });
  assert.match(byron.res.body, /data-tab="usage"/);
  assert.match(byron.res.body, /P&amp;L &amp; cash flow/);
});

test('the seat usage panel renders labels, the gauge and the daily table', async () => {
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../staff/command-app.js', import.meta.url))]);
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../lib/seat-usage.js', import.meta.url))]);
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../api/_seat-usage/load.js', import.meta.url))]);
  const client = readFileSync(new URL('../staff/command-app.js', import.meta.url), 'utf8');
  assert.match(client, /action=seat-usage/);
  assert.equal(client.includes('style="'), false);
  assert.equal(/quickbooks|corporation_tax|\bcva\b/i.test(client), false);

  const listeners = {};
  const panel = { innerHTML: '' };
  const fresh = { textContent: '' };
  let hash = '#usage';
  const document = {
    hidden: false,
    activeElement: null,
    body: { dataset: { seat: 'byron', finance: '1', name: 'Byron Hill' } },
    querySelector(sel) {
      if (sel === '#panel') return panel;
      if (sel === '#fresh') return fresh;
      if (sel === '#seat-badge') return { textContent: '' };
      return null;
    },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
  };
  const urls = [];
  const context = {
    document,
    location: { get hash() { return hash; }, set hash(value) { hash = value; } },
    history: { replaceState(_state, _title, next) { if (String(next).startsWith('#')) hash = String(next); } },
    console,
    fetch: async (url) => {
      urls.push(String(url));
      const payload = String(url).includes('action=seat-usage')
        ? loadSeatUsage()
        : { ok: true, seat: 'byron', displayName: 'Byron Hill', canViewFinance: true, overview: { kpis: {}, standing_rules: [], highlights: [] }, pipeline: { cases: [] }, roster: { agents: [] }, tasks: { cards: [] }, lenders: {}, files: {}, thread: [] };
      return { ok: true, status: 200, json: async () => payload };
    },
    setInterval() { return 0; },
    clearInterval() {},
    setTimeout,
    clearTimeout,
    Map,
    Intl,
    URL,
    Promise,
  };
  context.window = { document, location: context.location, addEventListener(type, fn) { (listeners[type] ||= []).push(fn); } };
  vm.createContext(context);
  vm.runInContext(client, context);
  for (let i = 0; i < 20 && !panel.innerHTML.includes('<h2>Seat usage</h2>'); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const html = panel.innerHTML;
  assert.match(html, /<h2>Seat usage<\/h2>/);
  assert.match(html, /Snapshot as of Tue 24 Nov 2026, 17:14 Paris/);
  assert.equal(fresh.textContent, 'Snapshot as of Tue 24 Nov 2026, 17:14 Paris');
  assert.match(html, /Heaviest consumer/);
  assert.match(html, /Lizzy Chief of Staff/);
  assert.match(html, /99%/);
  assert.match(html, /about 1%/);
  assert.match(html, /Lizzy – Posfin Team/);
  assert.match(html, /90\.5%/);
  assert.match(html, /Resets Fri 27 Nov 2026 10:48 Paris/);
  assert.match(html, /On-demand usage off/);
  assert.match(html, /Shares only; token counts not available/);
  assert.match(html, /Chris, Jess, Cai, Aadi, Vanessa/);
  assert.match(html, /figures to be added when available/);
  assert.match(html, /width="99"/);
  assert.match(html, /Tue 17 Nov<\/th><td>0%<\/td><td>&lt;1%<\/td>/);
  assert.match(html, /Fri 20 Nov<\/th><td>5%<\/td><td>&lt;1%<\/td>/);
  assert.match(html, /Sun 22 Nov<\/th><td>14%<\/td><td>&lt;1%<\/td>/);
  assert.match(html, /Mon 23 Nov<\/th><td>34%<\/td><td>&lt;1%<\/td>/);
  assert.match(html, /Tue 24 Nov<\/th><td>41%<\/td><td>1%<\/td>/);
  assert.equal(html.includes('style='), false);
  const team = html.slice(html.indexOf('Team Lizzy'), html.indexOf('Social Thought Leadership'));
  assert.match(team, /&lt;1%/);
  assert.equal(team.includes('0%'), false);
  const social = html.slice(html.indexOf('Social Thought Leadership'), html.indexOf('Deleted bots'));
  assert.match(social, /&lt;1%/);
  assert.equal(social.includes('0%'), false);

  const click = (tab) => listeners.click[0]({ target: { closest: (sel) => (sel === '.tab' ? { dataset: { tab } } : null), id: '' } });
  await click('overview');
  assert.equal(hash, '#overview');
  assert.match(panel.innerHTML, /Open cases/);
  await click('usage');
  assert.equal(hash, '#usage');
  assert.match(panel.innerHTML, /<h2>Seat usage<\/h2>/);
  assert.equal(urls.filter((url) => url.includes('action=seat-usage')).length, 1);
});
