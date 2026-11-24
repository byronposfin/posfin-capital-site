import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleCockpit } from '../api/staff-cockpit.js';
import { renderCard } from '../lib/cockpit-html.js';
import {
  FILTERS, RELEASE_LINE, SECTIONS, applyEdit, cardFromStaff, cardsFromRemote, groupBoard, lizzyQueue, matchesFilter, safeHref,
} from '../lib/cockpit.js';
import { createPreviewStore, loadSupabaseBoard, mintPreviewSession, resetSharedPreviewStore, saveSupabase } from '../lib/cockpit-store.js';

const NOW = '2026-11-19T21:40:00.000Z';
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

function authed(store, extra = {}) {
  return { env: ENV, store, now: NOW, fetch: async () => { throw new Error('preview must not call the network'); }, ...extra };
}

test('preview board keeps the five lanes, filters, and fixture label', () => {
  const store = createPreviewStore();
  const cards = store.list();
  assert.equal(cards.length, 9);
  assert.equal(cards.every((item) => item.preview === true), true);
  assert.deepEqual(groupBoard(cards, 'all').map((section) => section.title), SECTIONS.map((section) => section.title));
  assert.equal(groupBoard(cards, 'urgent').every((section) => section.cards.every((item) => /URGENT/i.test(item.status))), true);
  assert.equal(groupBoard(cards, 'urgent').some((section) => section.cards.some((item) => item.id === 'preview-hale')), true);
  assert.equal(groupBoard(cards, 'build').every((section) => section.id === 'build'), true);
  assert.equal(groupBoard(cards, 'build').some((section) => section.cards.some((item) => item.id === 'task-schema')), true);
  assert.equal(groupBoard(cards, 'done').some((section) => section.cards.some((item) => item.id === 'task-handoff')), true);
  assert.equal(groupBoard(cards, 'todo').some((section) => section.cards.some((item) => item.id === 'task-handoff')), false);
  assert.equal(FILTERS.map((item) => item.label).join(','), 'All,To do,Urgent,Build-systems,Done');
  const hale = cards.find((item) => item.id === 'preview-hale');
  assert.equal(hale.status, 'URGENT · EVICTION 24TH');
  assert.equal(hale.releaseLine, RELEASE_LINE);
  assert.equal(safeHref('javascript:alert(1)'), '');
  assert.equal(safeHref(hale.evidence[0].href).startsWith('/staff/'), true);
});

test('save, reopen and back to shared source write an audit', () => {
  const store = createPreviewStore();
  const saved = store.save('preview-lizzy', {
    status: 'AWAITING REPLY',
    owner: 'Lizzy',
    nextAction: 'Hold the draft',
    note: 'Jess checked the fixture',
    dueOn: '2026-11-21',
    done: false,
    draftMessage: 'Still a draft. Do not send.',
  }, 'Jess', NOW);
  assert.equal(saved.ok, true);
  const audit = store.auditFor('preview-lizzy');
  const note = audit.find((row) => row.field === 'note');
  assert.equal(note.actor, 'Jess');
  assert.equal(note.at, NOW);
  assert.equal(note.oldValue, '');
  assert.equal(note.newValue, 'Jess checked the fixture');
  assert.equal(store.get('preview-lizzy').note, 'Jess checked the fixture');

  const closed = store.save('task-handoff', { done: true }, 'Byron', NOW);
  assert.equal(closed.ok, true);
  const opened = store.reopen('task-handoff', 'Byron', NOW);
  assert.equal(opened.card.done, false);
  assert.equal(store.auditFor('task-handoff').some((row) => row.field === 'done' && row.oldValue === 'true' && row.newValue === 'false'), true);
  assert.equal(matchesFilter(opened.card, 'done'), false);

  store.revert('preview-lizzy', 'Tom', NOW);
  assert.equal(store.get('preview-lizzy').note, '');
  assert.equal(store.auditFor('preview-lizzy').some((row) => row.actor === 'Tom' && row.field === 'source' && row.newValue === 'fixture'), true);
  assert.equal(applyEdit(store.get('preview-hale'), { send: 'yes' }, 'Byron').error, 'refused');
  assert.equal(store.addTask({ title: 'No', owner: 'Tom', section: 'build' }, 'Tom', NOW).error, 'bad_title');
});

test('staff portal rows become cards without tokens or borrower links', () => {
  const card = cardFromStaff({
    case_id: 'example-1',
    client_name: 'Example Person',
    kyc_status: 'not_started',
    stage: 'gathering',
    facts: { property_address: '1 Example Street', postcode: 'AB1 2CD' },
  }, {
    facts: { property_address: '1 Example Street', postcode: 'AB1 2CD', eviction_at: '2026-11-24T10:00:00Z', token: 'raw-token', token_hash: 'hashed' },
    submissions: [{ id: 'file-1', filename: 'warrant-note.pdf' }],
  });
  assert.equal(card.status, 'URGENT · EVICTION 24TH');
  assert.equal(card.owner, 'Byron');
  assert.equal(JSON.stringify(card).includes('raw-token'), false);
  assert.equal(JSON.stringify(card).includes('token_hash'), false);
  assert.equal(card.evidence.every((item) => item.href.startsWith('/staff/cases/')), true);
  assert.equal(card.evidence.some((item) => item.href.includes('/case/')), false);
  const remote = cardsFromRemote({
    cases: [{ case_id: 'example-2', client_name: 'Second Example', kyc_status: 'passed', stage: 'applied', facts: {}, overlay: { owner: 'Lizzy', note: 'Desk note' }, evidence: [] }],
    tasks: [{ id: 'task-abcd', title: 'Schema review', section: 'build', owner: 'Tom', done: false }],
  });
  assert.equal(remote.find((item) => item.id === 'example-2').owner, 'Lizzy');
  assert.equal(remote.find((item) => item.id === 'example-2').note, 'Desk note');
  assert.equal(remote.find((item) => item.id === 'task-abcd').kind, 'task');
});

test('a live case title opens its file and fixture cards stay labelled as examples', () => {
  const live = renderCard({
    id: 'example-1',
    kind: 'case',
    preview: false,
    title: 'Example Person',
    status: 'AWAITING REPLY',
    description: '1 Example Street',
    owner: 'Byron',
    nextAction: 'Review the example',
    knownDone: '',
    releaseLine: 'Tom releases borrower links on SmartLink.',
    dueOn: '',
    note: '',
    done: false,
    draftMessage: '',
    evidence: [],
  }, 'all', 'board');
  assert.match(live, /<a href="\/staff\/cases\/example-1">Example Person<\/a>/);
  assert.match(live, /<details class="edit"><summary>Edit<\/summary>/);
  assert.equal(live.includes('Example, no case file'), false);
  const fixture = renderCard({
    id: 'preview-quay',
    kind: 'case',
    preview: true,
    title: 'Quay Cottage — example redemption',
    status: 'AWAITING REPLY',
    description: 'Preview case.',
    owner: 'Jess',
    nextAction: '',
    knownDone: '',
    releaseLine: '',
    evidence: [],
  }, 'all', 'board');
  assert.match(fixture, /Example, no case file/);
  assert.equal(fixture.includes('/staff/cases/preview-quay'), false);
});

test('the cockpit page is the staff board, and Lizzy has drafts without a send control', async () => {
  const store = createPreviewStore();
  const session = mintPreviewSession(ENV);
  const open = response();
  await handleCockpit({ method: 'GET', headers: { cookie: `pf_staff=${encodeURIComponent(session)}` }, query: {}, url: '/staff/cockpit' }, open, authed(store));
  assert.equal(open.status, 200);
  assert.match(open.body, /Let's clear the board\./);
  assert.match(open.body, /New leads/);
  assert.match(open.body, /TEST-WEB-BYRON1/);
  assert.match(open.body, /href="\/staff\/new-leads#TEST-WEB-BYRON1"/);
  assert.match(open.body, /Example, no case file/);
  assert.match(open.body, /<summary>Edit<\/summary>/);
  assert.equal(open.body.includes('/staff/cases/preview-hale'), false);
  assert.equal(open.body.includes('/staff/cases/preview-quay'), false);
  assert.match(open.body, /Within SLA/);
  assert.match(open.body, /byron\.hill@posfincapital\.com/);
  assert.match(open.body, /No AI caller/);
  assert.equal(open.body.includes('service_role'), false);
  assert.match(open.body, /Preview data/);
  assert.match(open.body, /Do now/);
  assert.match(open.body, /Byron&#39;s review/);
  assert.match(open.body, /Build/);
  assert.match(open.body, /Strategic thought/);
  assert.match(open.body, /Completed today/);
  assert.match(open.body, /URGENT · EVICTION 24TH/);
  assert.match(open.body, /AWAITING REPLY/);
  assert.match(open.body, /BYRON REVIEW GATE/);
  assert.match(open.body, /TEST ONLY/);
  assert.match(open.body, /REVIEW TOMORROW/);
  assert.match(open.body, /@media \(min-width:960px\)/);
  assert.match(open.body, /\.lanes\{display:flex;flex-direction:column/);
  assert.equal(/<button[^>]*value="send"/i.test(open.body), false);
  assert.equal(/<button[^>]*>\s*Send/i.test(open.body), false);
  assert.equal(open.body.includes('wa.me'), false);

  const lizzy = response();
  await handleCockpit({ method: 'GET', headers: { cookie: `pf_staff=${encodeURIComponent(session)}` }, query: { view: 'lizzy' }, url: '/staff/cockpit?view=lizzy' }, lizzy, authed(store));
  assert.match(lizzy.body, /Lizzy queue/);
  assert.match(lizzy.body, /Example Quay/);
  assert.match(lizzy.body, /Borrower message draft/);
  assert.match(lizzy.body, /Nothing is sent from the cockpit/);
  assert.equal(/<button[^>]*value="send"/i.test(lizzy.body), false);
  assert.equal(lizzy.body.includes('wa.me'), false);
  const queue = lizzyQueue(store.list());
  assert.equal(queue.active.length, 1);
  assert.equal(queue.active[0].owner, 'Lizzy');
});

test('edits survive a fresh request and a refused send does not change the board', async () => {
  const store = createPreviewStore();
  const session = mintPreviewSession(ENV);
  const before = store.allAudit().length;
  const saved = response();
  await handleCockpit({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    body: {
      action: 'save',
      id: 'preview-northgate',
      kind: 'case',
      status: 'BYRON REVIEW GATE',
      owner: 'Byron',
      next_action: 'Byron to read the fixture summary',
      note: 'Note kept on the server <script>',
      due_on: '2026-11-19',
      draft_message: '',
      actor: 'Byron',
      filter: 'todo',
    },
  }, saved, authed(store));
  assert.equal(saved.status, 303);
  assert.match(saved.headers.location, /filter=todo#card-preview-northgate/);

  const again = response();
  await handleCockpit({ method: 'GET', headers: { cookie: `pf_staff=${encodeURIComponent(session)}` }, query: { filter: 'todo' }, url: '/staff/cockpit?filter=todo' }, again, authed(store));
  assert.match(again.body, /Note kept on the server &lt;script&gt;/);
  assert.match(again.body, /Byron to read the fixture summary/);
  assert.match(again.body, /note: — → Note kept on the server &lt;script&gt;/);

  const sent = response();
  await handleCockpit({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    body: { action: 'send', id: 'preview-lizzy', actor: 'Lizzy' },
  }, sent, authed(store));
  assert.equal(sent.status, 400);
  assert.match(sent.body, /does not send/);
  assert.equal(store.get('preview-lizzy').draftMessage.includes('fictional case'), true);
  assert.equal(store.allAudit().length > before, true);

  const opened = response();
  await handleCockpit({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    body: { action: 'reopen', id: 'task-handoff', kind: 'task', status: 'REVIEW TOMORROW', owner: 'Byron', actor: 'Cai', done: '1' },
  }, opened, authed(store));
  assert.equal(opened.status, 303);
  assert.equal(store.get('task-handoff').done, false);

  const back = response();
  await handleCockpit({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    body: { action: 'revert', id: 'preview-northgate', kind: 'case', actor: 'Tom' },
  }, back, authed(store));
  assert.equal(store.get('preview-northgate').note, '');
});

test('the page stays behind the staff session and preview login does not touch Supabase', async () => {
  const store = createPreviewStore();
  const anon = response();
  await handleCockpit({ method: 'GET', headers: {}, query: {}, url: '/staff/cockpit' }, anon, authed(store));
  assert.equal(anon.status, 401);
  assert.match(anon.body, /Staff password/);
  assert.equal(anon.body.includes('Hale'), false);

  let network = false;
  const login = response();
  await handleCockpit({
    method: 'POST',
    headers: {},
    body: { password: 'preview-desk' },
  }, login, authed(store, { fetch: async () => { network = true; throw new Error('no'); }, login: async () => { network = true; return { ok: true, session: 'live' }; } }));
  assert.equal(network, false);
  assert.equal(login.status, 303);
  assert.match(String(login.headers['set-cookie']), /pf_staff=pv\./);

  const logout = response();
  let loggedOut = false;
  await handleCockpit({
    method: 'POST',
    headers: { cookie: login.headers['set-cookie'].split(';')[0] },
    body: { action: 'logout' },
  }, logout, authed(store, { logout: async () => { loggedOut = true; } }));
  assert.equal(loggedOut, false);
  assert.equal(logout.status, 303);
});

test('a fresh server memory reopens a note from the preview cookie', async () => {
  resetSharedPreviewStore();
  const env = { ...ENV, COCKPIT_STORE_PATH: '' };
  const session = mintPreviewSession(env);
  const saved = response();
  await handleCockpit({
    method: 'POST',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    body: {
      action: 'save', id: 'preview-quay', kind: 'case', status: 'AWAITING REPLY', owner: 'Jess',
      next_action: 'Hold the chaser until Lizzy has a draft she is happy with.',
      note: 'From the cookie', due_on: '2026-11-20', draft_message: '', actor: 'Jess', filter: 'all',
    },
  }, saved, { env, now: NOW, fetch: async () => { throw new Error('preview must not call the network'); } });
  assert.equal(saved.status, 303);
  const state = String(saved.headers['set-cookie'] || '');
  assert.match(state, /pf_cockpit_state=/);
  resetSharedPreviewStore();
  const again = response();
  await handleCockpit({
    method: 'GET',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}; ${state.split(';')[0]}` },
    query: {},
    url: '/staff/cockpit',
  }, again, { env, fetch: async () => { throw new Error('preview must not call the network'); } });
  assert.equal(again.status, 200);
  assert.match(again.body, /From the cookie/);
  resetSharedPreviewStore();
});

test('a missing cockpit table refuses the write instead of touching case rows', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body });
    if (String(url).includes('case_portal_staff_list')) return { ok: true, status: 200, text: async () => '[]' };
    return { ok: false, status: 404, text: async () => '{"code":"PGRST202"}' };
  };
  const loaded = await loadSupabaseBoard('staff-session', { fetch: fetchImpl, env: {} });
  assert.equal(loaded.schema, false);
  assert.equal(loaded.cards.length, 0);
  const saved = await saveSupabase('staff-session', 'case', 'example-1', { note: 'nope', release: 'now', token: 'abc' }, 'Tom', { fetch: fetchImpl, env: {} });
  assert.equal(saved.error, 'schema_pending');
  assert.equal(calls.filter((call) => call.url.includes('ops_cockpit_save')).length, 1);
  const saveCall = calls.find((call) => call.url.includes('ops_cockpit_save'));
  assert.equal(saveCall.body.includes('release'), false);
  assert.equal(saveCall.body.includes('token'), false);
  assert.equal(calls.some((call) => /notification|case_tokens|staff_stage/.test(call.url)), false);
});

test('the migration is review-only and does not write portal rows', () => {
  const sql = readFileSync(new URL('../sql/20261119_ops_cockpit.sql', import.meta.url), 'utf8');
  assert.match(sql, /DO NOT APPLY/i);
  assert.match(sql, /create table if not exists public\.ops_tasks/);
  assert.match(sql, /create table if not exists public\.ops_case_desk/);
  assert.match(sql, /create table if not exists public\.ops_audit/);
  assert.match(sql, /revoke all on public\.ops_tasks from public, anon, authenticated/);
  assert.match(sql, /revoke all on public\.ops_audit from public, anon, authenticated/);
  assert.equal(/insert into public\.case_portal/i.test(sql), false);
  assert.equal(/insert into public\.case_completion\b/i.test(sql), false);
  assert.equal(/insert into public\.case_tokens/i.test(sql), false);
  assert.equal(/update public\.case_tokens/i.test(sql), false);
  assert.equal(/insert into public\.case_notifications/i.test(sql), false);
  assert.equal(/grant\s+(select|insert|update|delete)[^;]*ops_tasks/i.test(sql), false);
});
