import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePriority, foldEntries, forSeat, cleanAnswer, cleanItem, itemFromCase } from '../lib/run-sheet.js';
import { handleRunSheet } from '../api/staff-run-sheet.js';
import { handleRunSheetApi } from '../api/run-sheet.js';
import { renderRunSheet } from '../lib/run-sheet-html.js';

function response() {
  const headers = {};
  return { statusCode: 200, body: '', headers, setHeader(k, v) { headers[k.toLowerCase()] = v; }, getHeader(k) { return headers[k.toLowerCase()]; }, end(b) { this.body = b || ''; } };
}
const item = (ref, p, at = '2026-11-23T08:00:00Z') => ({ id: ref, item_ref: ref, entry_kind: 'item', payload: p, actor_email: 'lizzy', created_at: at });

test('priority: urgency, then due date, then 15 s before 1 min', () => {
  const list = [
    { n: 1, urg: 'Normal', t: 'about 15 seconds' },
    { n: 2, urg: 'Emergency', t: 'under 1 minute' },
    { n: 3, urg: 'Urgent', t: 'under 1 minute', due: '2026-11-25' },
    { n: 4, urg: 'Urgent', t: 'under 1 minute', due: '2026-11-24' },
    { n: 5, urg: 'Urgent', t: 'about 15 seconds', due: '2026-11-24' },
    { n: 6, urg: 'Watch', t: 'about 15 seconds' },
  ].sort(comparePriority).map((x) => x.n);
  assert.deepEqual(list, [2, 5, 4, 3, 6, 1]);
});

test('answered cards move to done; a new urgent card lands at the top', () => {
  const rows = [
    item('T-1', { n: 1, case: 'A', urg: 'Normal', t: 'about 15 seconds' }),
    item('T-2', { n: 2, case: 'B', urg: 'Normal', t: 'under 1 minute' }),
    { id: 'x', item_ref: 'T-1', entry_kind: 'answer', payload: { decision: 'yes' }, actor_email: 'cai@posfincapital.com', created_at: '2026-11-23T09:00:00Z' },
    item('T-9', { n: 9, case: 'New', urg: 'Urgent', t: 'under 1 minute' }, '2026-11-23T10:00:00Z'),
  ];
  const f = foldEntries(rows);
  assert.deepEqual(f.open.map((i) => i.ref), ['T-9', 'T-2']);
  assert.equal(f.done[0].ref, 'T-1');
  assert.equal(f.done[0].answer.by, 'cai@posfincapital.com');
});

test('shared card: answered by one seat is done for the other; seats see only their own and shared cards', () => {
  const rows = [
    item('S-1', { case: 'Shared', urg: 'Normal', assignees: ['cai', 'jess'] }),
    item('S-2', { case: 'Byron only', urg: 'Normal', assignees: ['byron'] }),
    { id: 'y', item_ref: 'S-1', entry_kind: 'answer', payload: { decision: 'yes' }, actor_email: 'cai@posfincapital.com', created_at: '2026-11-23T09:00:00Z' },
  ];
  const jess = forSeat(foldEntries(rows), 'jess');
  assert.equal(jess.open.length, 0);
  assert.equal(jess.done[0].ref, 'S-1');
  const byron = forSeat(foldEntries(rows), 'byron');
  assert.deepEqual(byron.open.map((i) => i.ref), ['S-2']);
  assert.equal(byron.done.length, 0);
});

test('item updates and retire', () => {
  const rows = [item('U-1', { case: 'Old', urg: 'Normal' }), item('U-1', { case: 'New', urg: 'Urgent' }, '2026-11-23T09:00:00Z'), item('U-2', { case: 'Gone' }), { id: 'r', item_ref: 'U-2', entry_kind: 'retire', payload: {}, created_at: '2026-11-23T09:30:00Z' }];
  const f = foldEntries(rows);
  assert.deepEqual(f.open.map((i) => i.case), ['New']);
});

test('answer validation and item cleaning', () => {
  assert.equal(cleanAnswer({ ref: 'T-1', decision: 'maybe' }).error, 'bad_decision');
  assert.equal(cleanAnswer({ ref: 'T-1', decision: 'edit', edit_text: ' ' }).error, 'edit_empty');
  assert.ok(cleanAnswer({ ref: 'T-1', decision: 'edit', edit_text: 'Change the figure' }).ok);
  const c = cleanItem({ ref: 'T-3', case: 'X', urg: 'Urgent', links: [{ kind: 'case', label: 'Desk', href: '/staff/cases' }, { kind: 'url', label: 'bad', href: 'javascript:alert(1)' }], assignees: ['Cai', 'jess'] });
  assert.equal(c.payload.links.length, 1);
  assert.deepEqual(c.payload.assignees, ['cai', 'jess']);
  assert.equal(cleanItem({ ref: 'bad ref' }).error, 'bad_ref');
});

test('case cards keep the cockpit rows and links', () => {
  const it = itemFromCase({ id: 'preview-hale', title: 'Hale', status: 'URGENT · EVICTION 24TH', owner: 'Byron', nextAction: 'Read it', knownDone: 'Nothing filed', releaseLine: 'Tom releases', dueOn: '2026-11-24', evidence: [{ kind: 'email', label: 'Desk', href: 'mailto:a@example.invalid' }] });
  assert.equal(it.urg, 'Urgent');
  assert.equal(it.links[0].kind, 'email');
  const html = renderRunSheet({ open: [{ ...it, history: [], voice: [] }], done: [], date: '2026-11-23', canSave: true, storeOk: true, seat: 'byron' });
  assert.match(html, /Run sheet/);
  assert.match(html, /Dashboard/);
  assert.doesNotMatch(html, /service_role|SERVICE_KEY|RUN_SHEET_API_SECRET/);
});

test('run sheet asks for sign-in without a session', async () => {
  const res = response();
  await handleRunSheet({ method: 'GET', url: '/staff/run', headers: {} }, res, { env: {} });
  assert.equal(res.statusCode, 401);
  assert.match(res.body, /Open the run sheet/);
});

test('machine API refuses without the secret and writes items with it', async () => {
  const secret = 'x'.repeat(40);
  const env = { RUN_SHEET_API_SECRET: secret, RUN_SHEET_SERVICE_KEY: 'svc' };
  const r1 = response();
  await handleRunSheetApi({ method: 'GET', url: '/api/run-sheet', headers: { authorization: 'Bearer nope' } }, r1, { env });
  assert.equal(r1.statusCode, 404);
  const calls = [];
  const fetch = async (url, opts) => { calls.push({ url, opts }); return { ok: true, status: 201, json: async () => [] }; };
  const r2 = response();
  await handleRunSheetApi({ method: 'POST', url: '/api/run-sheet', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: { date: '2026-11-23', items: [{ ref: 'TEST-1', case: 'Test', urg: 'Urgent', assignees: ['byron'] }] } }, r2, { env, fetch });
  assert.equal(r2.statusCode, 200);
  assert.equal(JSON.parse(r2.body).written, 1);
  assert.match(calls[0].url, /run_sheet_entries$/);
  assert.doesNotMatch(r2.body, /svc/);
});
