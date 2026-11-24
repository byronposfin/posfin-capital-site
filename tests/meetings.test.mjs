import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { handleCommandDashboard } from '../api/command-dashboard.js';
import { readMeetingsFile } from '../api/_meetings/load.js';
import {
  loadMeetingsSeed,
  nextWeekday,
  normaliseProgress,
  presentMeetingList,
  sortMeetings,
} from '../lib/meetings.js';
import { seatByCode } from '../lib/staff-seats.js';

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

function envFor(extra = {}) {
  return {
    STAFF_AUTH_MODE: 'supabase',
    VERCEL_ENV: 'production',
    STAFF_SUPABASE_URL: 'https://example.test',
    SUPABASE_URL: 'https://example.test',
    STAFF_SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    ...extra,
  };
}

function harness(seat, { progressStatus = 200, progressRows = [] } = {}) {
  const email = seatByCode(seat).email;
  const calls = [];
  const stored = new Map(progressRows.map((row) => [row.meeting_id, row]));
  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    const headers = options.headers || {};
    calls.push({ url: target, method: options.method || 'GET', headers, body: options.body || '' });
    if (target.includes('/auth/v1/user')) {
      if (headers.apikey !== 'anon-key' || !String(headers.Authorization || '').includes('staff-access-token')) return json(401, {});
      return json(200, { email });
    }
    if (target.includes('/rpc/staff_caller')) {
      return json(200, [{ email, seat_code: seat, role: seat === 'byron' ? 'principal' : 'case_owner' }]);
    }
    if (target.includes('/command_meeting_progress')) {
      if (headers.apikey !== 'service-role-test' || headers.Authorization !== 'Bearer service-role-test') return json(401, {});
      if (headers['Accept-Profile'] !== 'pipeline' || headers['Content-Profile'] !== 'pipeline') return json(401, {});
      if (progressStatus === 404) return json(404, { code: 'PGRST205' });
      if ((options.method || 'GET') === 'POST') {
        const posted = JSON.parse(options.body);
        stored.set(posted.meeting_id, posted);
        return json(201, '');
      }
      return json(200, [...stored.values()]);
    }
    return json(404, { message: 'unexpected' });
  };
  return { calls, fetchImpl, stored, email };
}

async function call(method, seat, { query = {}, body, cookie = true, progressStatus = 200, progressRows = [] } = {}) {
  const bag = harness(seat || 'byron', { progressStatus, progressRows });
  const params = new URLSearchParams(query);
  const req = {
    method,
    url: `/api/command-dashboard${params.toString() ? `?${params}` : ''}`,
    query,
    headers: cookie ? { cookie: `pf_staff=${encodeURIComponent('sb1.staff-access-token')}` } : {},
    body,
  };
  const res = response();
  await handleCommandDashboard(req, res, { env: envFor(), fetch: bag.fetchImpl });
  return { res, ...bag };
}

function parsed(res) {
  return JSON.parse(res.body || '{}');
}

const tuesday = new Date('2026-11-24T09:00:00.000Z');
const sunday = new Date('2026-11-29T09:00:00.000Z');

test('the seed is the editable agenda and documents its own schema', () => {
  const file = readMeetingsFile();
  assert.equal(file.schema, 'posfin.staff.meetings.v1');
  assert.match(file.edit, /only file/);
  assert.equal(file.fields.tentative.includes('Tentative'), true);
  assert.equal(file.fields['sections.minutes'].includes('minutes'), true);
  const ids = file.meetings.map((meeting) => meeting.id);
  assert.deepEqual(ids, ['daily-marketing', 'joanne-isherwood-lark', 'sally-jones']);
  const daily = file.meetings[0];
  assert.equal(daily.when.recurrence, 'weekdays');
  assert.equal(daily.when.duration_minutes, 10);
  assert.equal(daily.when.allow_minutes, 15);
  assert.equal(daily.sections.reduce((sum, section) => sum + section.minutes, 0), 10);
  const titles = daily.sections.flatMap((section) => section.items.map((item) => item.title));
  for (const name of ['Newey', 'Jason Lawal', 'Yarde / Charlene', 'Bouchon', 'Adam Vers', 'Connie Stilwell', 'SOMO', 'LARK', 'Ackroyds', 'Credicus', 'Aadi', 'Jess', 'Cai', 'Chris', 'Vanessa']) {
    assert.equal(titles.includes(name), true, name);
  }
  assert.match(daily.sections.find((section) => section.id === 'marketing').items.find((item) => item.id === 'events').detail, /not attending/);
  assert.equal(file.meetings[1].party.includes('L.A.R.K'), true);
  assert.equal(file.meetings[2].tentative, true);
  assert.equal(file.meetings[2].purpose_tbc, true);
  assert.equal(file.meetings[2].purpose, '');
  assert.match(file.meetings[2].when.note, /WhatsApp/);
  const source = readFileSync(new URL('../api/_meetings/seed.json', import.meta.url), 'utf8');
  assert.equal(/07\d{8,}/.test(source), false);
  assert.equal(source.includes('@'), false);
});

test('upcoming meetings are listed before untimed and tentative ones', () => {
  const listed = presentMeetingList([], tuesday);
  assert.deepEqual(listed.map((meeting) => meeting.id), ['daily-marketing', 'joanne-isherwood-lark', 'sally-jones']);
  assert.equal(listed[0].duration_label, '10 minutes, allow 15');
  assert.match(listed[0].next_label, /^Next: Tue 24 Nov$/);
  assert.equal(listed[1].tentative, false);
  assert.equal(listed[2].tentative, true);
  assert.equal(listed[2].purpose_tbc, true);
  assert.equal(listed[2].next_label, 'Time TBC');
  assert.equal(listed[0].sections[0].items[0].status, 'open');
  const weekend = presentMeetingList([], sunday);
  assert.match(weekend[0].next_label, /^Next: Mon 30 Nov$/);
  assert.equal(nextWeekday(sunday).toISOString().slice(0, 10), '2026-11-30');

  const sorted = sortMeetings([
    { id: 'past', title: 'Past', tentative: false, when: { recurrence: 'once', label: 'Done', starts_at: '2026-11-01T10:00:00.000Z' }, sections: [], actions: [] },
    { id: 'soon', title: 'Soon', tentative: false, when: { recurrence: 'once', label: 'Soon', starts_at: '2026-11-25T10:00:00.000Z' }, sections: [], actions: [] },
    { id: 'tentative', title: 'Tentative', tentative: true, when: { recurrence: 'tbc', label: 'Time TBC', starts_at: '2026-11-24T10:00:00.000Z' }, sections: [], actions: [] },
  ], tuesday);
  assert.deepEqual(sorted.map((meeting) => meeting.id), ['soon', 'tentative', 'past']);
});

test('a saved tick overlays the seed and a bad status is refused', () => {
  const [daily] = loadMeetingsSeed();
  const bad = normaliseProgress(daily, { items: { newey: { status: 'sent', notes: '' } } });
  assert.equal(bad.ok, false);
  const saved = normaliseProgress(daily, {
    items: { newey: { status: 'actioned', notes: 'Chased today.' }, missing: { status: 'open', notes: 'no' } },
    actions: { 'newey-compliance': { done: true } },
    extra_actions: [{ id: 'extra-note1', text: 'Send the pack', owner: 'Jess', done: false }],
  });
  assert.equal(saved.ok, true);
  const [view] = presentMeetingList([{ meeting_id: 'daily-marketing', payload: saved.progress, updated_by: 'byron' }], tuesday);
  const newey = view.sections[0].items.find((item) => item.id === 'newey');
  assert.equal(newey.status, 'actioned');
  assert.equal(newey.notes, 'Chased today.');
  assert.equal(view.actions.find((action) => action.id === 'newey-compliance').done, true);
  assert.equal(view.actions.find((action) => action.id === 'extra-note1').extra, true);
  assert.equal(view.actioned_count >= 1, true);
});

test('signed-out meeting requests are refused and do not read the agenda store', async () => {
  const denied = await call('GET', 'byron', { cookie: false, query: { action: 'meetings' } });
  assert.equal(denied.res.status, 401);
  assert.equal(parsed(denied.res).error, 'Sign in is required.');
  assert.equal(denied.res.body.includes('Newey'), false);
  assert.equal(denied.res.body.includes('Sally'), false);
  assert.equal(denied.calls.length, 0);
  const posted = await call('POST', 'cai', {
    cookie: false,
    query: { action: 'meetings' },
    body: { id: 'daily-marketing', progress: { items: { newey: { status: 'actioned', notes: '' } } } },
  });
  assert.equal(posted.res.status, 401);
  assert.equal(posted.calls.length, 0);
  const page = await call('GET', 'byron', { cookie: false, query: { view: 'page' } });
  assert.equal(page.res.status, 401);
  assert.equal(page.res.body.includes('Sally Jones'), false);
  assert.equal(page.res.body.includes('Daily Marketing'), false);
});

test('a signed-in seat gets the three meetings with upcoming first', async () => {
  for (const seat of ['byron', 'cai']) {
    const loaded = await call('GET', seat, { query: { action: 'meetings' } });
    assert.equal(loaded.res.status, 200, seat);
    const body = parsed(loaded.res);
    assert.equal(body.storage, 'supabase');
    assert.equal(body.persisted, true);
    assert.match(body.note, /saved for the team/i);
    assert.deepEqual(body.meetings.map((meeting) => meeting.id), ['daily-marketing', 'joanne-isherwood-lark', 'sally-jones']);
    assert.equal(body.meetings[2].tentative, true);
    assert.equal(body.meetings[2].purpose_tbc, true);
    assert.equal(body.meeting, null);
    assert.equal(JSON.stringify(body).includes('service-role-test'), false);
    assert.equal(loaded.calls.some((item) => item.url.includes('command_dashboard_snapshots')), false);
    const progress = loaded.calls.find((item) => item.url.includes('command_meeting_progress'));
    assert.equal(progress.headers.apikey, 'service-role-test');
    assert.equal(progress.headers['Accept-Profile'], 'pipeline');
  }
  const one = await call('GET', 'jess', { query: { action: 'meetings', id: 'joanne-isherwood-lark' } });
  const detail = parsed(one.res).meeting;
  assert.equal(detail.title.includes('L.A.R.K'), true);
  assert.equal(detail.sections.some((section) => /deed of priority/i.test(section.title)), true);
});

test('checking an item off is stored for the team and read back', async () => {
  const bag = harness('byron');
  const post = response();
  await handleCommandDashboard({
    method: 'POST',
    url: '/api/command-dashboard?action=meetings',
    query: { action: 'meetings' },
    headers: { cookie: `pf_staff=${encodeURIComponent('sb1.staff-access-token')}` },
    body: {
      id: 'daily-marketing',
      progress: { items: { newey: { status: 'discussed', notes: 'Waiting on the compliance email.' } }, actions: { 'jason-deed': { done: true } } },
    },
  }, post, { env: envFor(), fetch: bag.fetchImpl });
  assert.equal(post.status, 200);
  const saved = parsed(post);
  assert.equal(saved.persisted, true);
  assert.equal(saved.meeting.sections[0].items[0].status, 'discussed');
  assert.equal(saved.meeting.sections[0].items[0].notes, 'Waiting on the compliance email.');
  assert.equal(saved.meeting.actions.find((action) => action.id === 'jason-deed').done, true);
  const row = bag.stored.get('daily-marketing');
  assert.equal(row.updated_by, 'byron');
  assert.equal(row.payload.items.newey.status, 'discussed');
  assert.equal(JSON.stringify(row).includes('@'), false);
  const insert = bag.calls.find((item) => item.method === 'POST' && item.url.includes('command_meeting_progress'));
  assert.match(insert.headers.Prefer, /resolution=merge-duplicates/);

  const again = response();
  await handleCommandDashboard({
    method: 'GET',
    url: '/api/command-dashboard?action=meetings&id=daily-marketing',
    query: { action: 'meetings', id: 'daily-marketing' },
    headers: { cookie: `pf_staff=${encodeURIComponent('sb1.staff-access-token')}` },
  }, again, { env: envFor(), fetch: bag.fetchImpl });
  const read = parsed(again).meeting;
  assert.equal(read.sections[0].items.find((item) => item.id === 'newey').status, 'discussed');
  assert.equal(read.saved_by, 'byron');
});

test('a missing meetings table keeps the agenda and says ticks stay in the browser', async () => {
  const loaded = await call('GET', 'aadi', { query: { action: 'meetings' }, progressStatus: 404 });
  assert.equal(loaded.res.status, 200);
  const body = parsed(loaded.res);
  assert.equal(body.storage, 'browser');
  assert.equal(body.persisted, false);
  assert.match(body.note, /this browser only/);
  assert.equal(body.meetings.length, 3);
  assert.equal(body.meetings[0].sections[0].items[0].status, 'open');

  const posted = await call('POST', 'aadi', {
    query: { action: 'meetings' },
    progressStatus: 404,
    body: { id: 'sally-jones', progress: { items: { introductions: { status: 'actioned', notes: 'Done on the call.' } } } },
  });
  assert.equal(posted.res.status, 200);
  const saved = parsed(posted.res);
  assert.equal(saved.persisted, false);
  assert.equal(saved.storage, 'browser');
  assert.equal(saved.meeting.sections[0].items[0].status, 'actioned');
  assert.equal(posted.stored.size, 0);
});

test('meeting updates that are not on the agenda are refused before a write', async () => {
  const missing = await call('POST', 'chris', { query: { action: 'meetings' }, body: { id: 'unknown', progress: {} } });
  assert.equal(missing.res.status, 404);
  assert.equal(missing.calls.some((item) => item.method === 'POST' && item.url.includes('command_meeting_progress')), false);
  const bad = await call('POST', 'vanessa', {
    query: { action: 'meetings' },
    body: { id: 'daily-marketing', progress: { items: { newey: { status: 'closed' } } } },
  });
  assert.equal(bad.res.status, 400);
  assert.match(parsed(bad.res).error, /open, discussed, actioned or parked/);
  assert.equal(bad.calls.some((item) => item.method === 'POST' && item.url.includes('command_meeting_progress')), false);
  const blank = await call('POST', 'byron', {
    query: { action: 'meetings' },
    body: { id: 'sally-jones', progress: { extra_actions: [{ id: 'extra-blank1', text: '   ', owner: 'Byron' }] } },
  });
  assert.equal(blank.res.status, 400);
});

test('the signed-in shell has a Meetings tab and the migration stays private', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const client = readFileSync(new URL('../staff/command-app.js', import.meta.url), 'utf8');
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../staff/command-app.js', import.meta.url))]);
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../lib/meetings.js', import.meta.url))]);
  execFileSync(process.execPath, ['--check', fileURLToPath(new URL('../api/_meetings/load.js', import.meta.url))]);
  assert.match(client, /data-open-meeting/);
  assert.match(client, /posfin-meeting-progress-v1/);
  assert.match(client, /Saved for the team/);
  assert.match(client, /Saved in this browser only/);
  assert.match(client, /state\.saveTail = state\.saveTail\.then\(\(\) => persistMeeting\(id\)\)/);
  assert.match(client, /if \(newer\) continue/);
  assert.equal(client.includes('saveMeeting(liveMeeting()'), false);
  assert.match(client, /enqueueSave\(current\)/);
  assert.match(client, /flushNoteSave\(\)/);
  assert.equal(/quickbooks|corporation_tax|\bcva\b/i.test(client), false);

  const sql = readFileSync(new URL('../supabase/migrations/20261124_command_meetings.sql', import.meta.url), 'utf8');
  assert.match(sql, /pipeline\.command_meeting_progress/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.equal(/create policy/i.test(sql), false);
  assert.equal(/\binsert into\b/i.test(sql), false);
  assert.equal(/grant\s+.+\s+to\s+(anon|authenticated)/i.test(sql), false);
  assert.equal(sql.includes('Newey'), false);

  const page = readFileSync(new URL('../lib/command-page.js', import.meta.url), 'utf8');
  assert.match(page, /\['meetings', 'Meetings'\]/);
  assert.equal(root.endsWith('/'), true);
});
