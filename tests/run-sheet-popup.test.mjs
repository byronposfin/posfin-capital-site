import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleRunSheet } from '../api/staff-run-sheet.js';
import { handleRunSheetApi } from '../api/run-sheet.js';
import { renderBoard } from '../lib/cockpit-html.js';
import { renderCommandPage } from '../lib/command-page.js';
import {
  buildPopupModel, byronOnlyCard, carryOpen, cleanAnswer, isSampleCard, meetingItems, popupEnabled, redactText,
} from '../lib/run-sheet.js';
import { transcribe } from '../lib/run-sheet-store.js';

function response() {
  const headers = {};
  return {
    statusCode: 200,
    body: '',
    headers,
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    getHeader(k) { return headers[k.toLowerCase()]; },
    end(b) { this.body = b || ''; },
  };
}

const item = (ref, payload, at = '2026-11-23T08:00:00Z') => ({
  id: ref, sheet_date: '2026-11-23', item_ref: ref, entry_kind: 'item', payload, actor_email: 'lizzy', created_at: at,
});

const realCase = {
  id: 'POSFIN-WEB-EYCTQ6',
  kind: 'case',
  title: 'Eyct file',
  section: 'do_now',
  status: 'BYRON REVIEW GATE',
  owner: 'Byron',
  nextAction: 'Read the file',
  done: false,
  preview: false,
};

const hale = {
  id: 'preview-hale',
  preview: true,
  kind: 'case',
  title: 'Hale — example eviction file',
  section: 'do_now',
  status: 'URGENT · EVICTION 24TH',
  owner: 'Byron',
  nextAction: 'Read the example warrant note',
  done: false,
};

function world(over = {}) {
  const saved = [];
  const cockpit = [];
  const commands = [];
  const fetches = [];
  const queries = [];
  const deps = {
    env: {
      RUN_SHEET_POPUP: '1',
      VERCEL_ENV: 'preview',
      STAFF_SUPABASE_URL: 'https://staff.example.test',
      STAFF_SUPABASE_ANON_KEY: 'anon-test',
      COCKPIT_SOURCE: 'supabase',
      ...(over.env || {}),
    },
    now: over.now || '2026-11-25T08:00:00Z',
    sessionAllows: async () => true,
    supabaseAccessToken: () => 'token',
    staffActorFromToken: async () => ({
      ok: true,
      email: 'byron.hill@posfincapital.com',
      seat: { code: over.seat || 'byron' },
    }),
    loadEntries: async () => ({ ok: true, rows: over.rows || [] }),
    loadEarlierEntries: async () => ({ ok: true, rows: over.earlier || [] }),
    loadStaffTable: async (_env, _token, query) => {
      queries.push(query);
      if (/finance/i.test(query)) throw new Error('finance query');
      if (String(query).includes('command_meeting')) return { ok: true, rows: [] };
      return { ok: true, rows: over.snaps || [] };
    },
    loadSupabaseBoard: async () => ({ ok: true, cards: over.cards === undefined ? [realCase, hale] : over.cards }),
    cockpitMode: (env) => (env.COCKPIT_SOURCE === 'supabase' ? 'supabase' : 'preview'),
    sharedPreviewStore: () => { throw new Error('fixture store'); },
    insertEntry: async (_env, _token, row) => {
      saved.push(row);
      return { ok: true, id: `id-${saved.length}`, at: '2026-11-25T09:41:00Z' };
    },
    saveSupabase: async (_session, kind, id, patch) => {
      cockpit.push({ kind, id, patch });
      return { ok: true };
    },
    commandPost: async (action, body) => {
      commands.push({ action, body });
      return { status: 201, json: { ok: true, message: { id: 1 } } };
    },
    transcribe: async () => ({ status: 'no_key' }),
    fetch: async (url) => {
      fetches.push(String(url));
      throw new Error(`external ${url}`);
    },
  };
  return { deps, saved, cockpit, commands, fetches, queries };
}

async function post(fields, over = {}) {
  const bag = world(over);
  const res = response();
  await handleRunSheet({
    method: 'POST',
    url: '/staff/run?view=popup',
    headers: { cookie: 'pf_staff=sb1.token', 'content-type': 'application/json' },
    body: { view: 'popup', date: '2026-11-25', client_id: `client${Math.random().toString(36).slice(2, 10)}`, ...fields },
  }, res, bag.deps);
  return { ...bag, res, json: JSON.parse(res.body || '{}') };
}

async function get(query, over = {}) {
  const bag = world(over);
  const res = response();
  await handleRunSheet({
    method: 'GET',
    url: `/staff/tasks?${query}`,
    headers: { cookie: 'pf_staff=sb1.token' },
    query: Object.fromEntries(new URLSearchParams(query)),
  }, res, bag.deps);
  return { ...bag, res };
}

test('the pop-up flag is preview only', () => {
  assert.equal(popupEnabled({}), false);
  assert.equal(popupEnabled({ RUN_SHEET_POPUP: '1', VERCEL_ENV: 'production' }), false);
  assert.equal(popupEnabled({ RUN_SHEET_POPUP: '1', VERCEL_ENV: 'preview' }), true);
});

test('flag off leaves the run sheet unchanged, including on production with the flag set', async () => {
  const plain = response();
  await handleRunSheet({ method: 'GET', url: '/staff/run', headers: {} }, plain, { env: {} });
  const flagged = response();
  await handleRunSheet({ method: 'GET', url: '/staff/run?view=popup', headers: {}, query: { view: 'popup' } }, flagged, { env: {} });
  const production = response();
  await handleRunSheet({
    method: 'GET', url: '/staff/run?view=popup', headers: {}, query: { view: 'popup' },
  }, production, { env: { RUN_SHEET_POPUP: '1', VERCEL_ENV: 'production' } });
  assert.equal(plain.body, flagged.body);
  assert.equal(plain.body, production.body);
  assert.match(plain.body, /Open the run sheet/);
  assert.doesNotMatch(plain.body, /Voice transcription key is not set/);
  assert.doesNotMatch(plain.body, /id="my-tasks"/);
  const refused = await post({ op: 'done', ref: 'T-1' }, { env: { RUN_SHEET_POPUP: '0', VERCEL_ENV: 'preview' } });
  assert.equal(refused.res.statusCode, 400);
  assert.equal(refused.json.error, 'bad_decision');
  assert.equal(refused.saved.length, 0);
  assert.equal(refused.fetches.length, 0);
});

test('carry-over keeps unanswered cards and drops retired, answered and sample cards', () => {
  const rows = [
    item('OLD-1', { case: 'Carry me', urg: 'Urgent', assignees: ['byron'] }),
    item('OLD-2', { case: 'Answered', urg: 'Normal' }),
    { id: 'a', item_ref: 'OLD-2', entry_kind: 'answer', payload: { decision: 'yes' }, actor_email: 'byron.hill@posfincapital.com', created_at: '2026-11-23T10:00:00Z' },
    item('case-preview-hale', { case: 'Hale', urg: 'Emergency' }),
    item('GONE', { case: 'Retired' }),
    { id: 'r', item_ref: 'GONE', entry_kind: 'retire', payload: {}, created_at: '2026-11-23T11:00:00Z' },
  ];
  const open = carryOpen(rows);
  assert.deepEqual(open.map((row) => row.ref), ['OLD-1']);
  assert.equal(open[0].carried, true);
});

test("Byron's pop-up lists live work and hides sample cards, private cards and finance from other seats", async () => {
  const snaps = [
    {
      section: 'tasks',
      byron_only: false,
      payload: {
        byron_decisions: [{ title: 'Sign the pack', detail: 'Yes or no today' }],
        byron_next_move_deals: [{ id: 'deal-1', name: 'Yarde', next_action: 'Call the solicitor', assigned_seat: 'jess', urgent: 'urgent' }],
      },
    },
    {
      section: 'pipeline_private_byron',
      byron_only: true,
      payload: { cases: [{ id: 'KURDI1', name: 'Kurdi file', next_action: 'Byron only', stage: 'Review' }] },
    },
  ];
  const rows = [
    item('B20261125-01', { case: 'Morning pack', need: 'CIFAS marker and account number 12-34-56', urg: 'Urgent', assignees: ['byron'], kind: 'task' }, '2026-11-25T06:40:00Z'),
    item('FIN-1', { case: 'November cash position', kind: 'finance', finance: true, assignees: ['byron'] }),
    item('case-preview-hale', { case: 'Hale fixture', urg: 'Emergency', assignees: ['byron'] }),
  ];
  const earlier = [item('OLD-1', { case: 'Carried task', urg: 'Watch', assignees: ['byron'] })];
  const byron = await get('view=popup&format=json&date=2026-11-25', { rows, earlier, snaps, cards: [realCase, hale] });
  assert.equal(byron.res.statusCode, 200);
  const body = JSON.parse(byron.res.body);
  const refs = body.open.map((row) => row.ref);
  assert.equal(body.popup, true);
  assert.equal(body.transcription, 'no_key');
  assert.ok(refs.includes('case-POSFIN-WEB-EYCTQ6'));
  assert.ok(refs.includes('B20261125-01'));
  assert.ok(refs.includes('OLD-1'));
  assert.ok(refs.includes('decision-Signthepack'));
  assert.ok(refs.includes('private-KURDI1'));
  assert.ok(refs.includes('FIN-1'));
  assert.ok(refs.some((ref) => ref.includes('newey-compliance')));
  assert.equal(refs.includes('case-preview-hale'), false);
  assert.equal(JSON.stringify(body).toLowerCase().includes('preview-hale'), false);
  assert.equal(JSON.stringify(body).toLowerCase().includes('cifas'), false);
  assert.match(JSON.stringify(body), /\[withheld\]/);
  assert.equal(byron.queries.some((query) => /finance/i.test(query)), false);
  assert.equal(byron.fetches.length, 0);

  const jess = await get('view=popup&format=json&date=2026-11-25', { rows, earlier, snaps, seat: 'jess', cards: [realCase, hale] });
  const jessRefs = JSON.parse(jess.res.body).open.map((row) => row.ref);
  assert.equal(jessRefs.includes('private-KURDI1'), false);
  assert.equal(jessRefs.includes('FIN-1'), false);
  assert.equal(jessRefs.includes('decision-Signthepack'), false);
  assert.equal(jessRefs.includes('case-preview-hale'), false);
  assert.ok(jessRefs.includes('move-deal-1'));
  assert.equal(JSON.parse(jess.res.body).open.some((row) => /kurdi/i.test(`${row.case} ${row.ref}`)), false);
});

test('preview mode never reads the fixture store for the pop-up', async () => {
  const view = await get('view=popup&format=json', {
    env: { RUN_SHEET_POPUP: '1', VERCEL_ENV: 'preview', COCKPIT_SOURCE: 'preview', STAFF_SUPABASE_URL: 'https://staff.example.test', STAFF_SUPABASE_ANON_KEY: 'anon-test' },
    cards: [hale],
  });
  assert.equal(view.res.statusCode, 200);
  assert.equal(JSON.stringify(JSON.parse(view.res.body).open).includes('preview-hale'), false);
  assert.equal(isSampleCard(hale), true);
  assert.equal(byronOnlyCard({ kind: 'finance', case: 'P&L' }), true);
  assert.equal(redactText('sort code 20-00-00'), '[withheld]');
});

test('every save path stores an answer and does not fetch an external service', async () => {
  const paths = [
    { op: 'yes', ref: 'B20261125-02', rows: [item('B20261125-02', { case: 'Pack', act: 'File the signed pack', next_action: 'File the signed pack', urg: 'Normal', assignees: ['byron'] })] },
    { op: 'no', ref: 'T-NO' },
    { op: 'edit', ref: 'T-ED', edit_text: 'Change the figure', decision: 'edit' },
    { op: 'done', ref: 'case-POSFIN-WEB-EYCTQ6' },
    { op: 'reopen', ref: 'case-POSFIN-WEB-EYCTQ6' },
    { op: 'partial', ref: 'T-PART', partial: true },
    { op: 'owner', ref: 'case-POSFIN-WEB-EYCTQ6', owner: 'Chris' },
    { op: 'due', ref: 'case-POSFIN-WEB-EYCTQ6', due: '2026-11-30' },
    { op: 'note', ref: 'case-POSFIN-WEB-EYCTQ6', edit_text: 'Left a note', note: 'Left a note' },
    { op: 'draft', ref: 'T-DR', channel: 'email', edit_text: 'Draft body', subject: 'Update' },
    { op: 'draft', ref: 'T-WA', channel: 'whatsapp', edit_text: 'WhatsApp draft' },
    { op: 'draft', ref: 'case-POSFIN-WEB-EYCTQ6', channel: 'borrower', edit_text: 'Borrower draft' },
    { op: 'add', ref: 'add-task1', case: 'Call back', need: 'Confirm the time', owner: 'Jess' },
    { op: 'ask', ref: 'T-ASK', edit_text: '[T-ASK] What is the next step?', to_agent: 'lizzy' },
    { op: 'thread', ref: 'T-TH', edit_text: '[T-TH] Noted for the team', to_agent: 'all' },
    { op: 'meeting', ref: 'meet-daily-marketing-newey-compliance', meeting_id: 'daily-marketing', edit_text: 'tick', progress: { items: {}, actions: { 'newey-compliance': { done: true } }, extra_actions: [] } },
    { op: 'yes', ref: 'T-FLAG', rows: [item('T-FLAG', { case: 'No next', act: 'Leave a note on the next step.', assignees: ['byron'] })] },
  ];
  for (const fields of paths) {
    const result = await post(fields, { rows: fields.rows || [] });
    assert.equal(result.res.statusCode, 200, fields.op);
    assert.equal(result.json.ok, true, fields.op);
    assert.equal(result.fetches.length, 0, fields.op);
    assert.equal(result.saved[0].entry_kind, 'answer');
    assert.equal(result.saved[0].payload.op, fields.op);
    assert.equal(result.saved[0].actor_email, 'byron.hill@posfincapital.com');
  }

  const voice = await post({
    op: 'voice',
    ref: 'T-VOICE',
    mime: 'audio/webm',
    audio_b64: Buffer.from('voice-bytes').toString('base64'),
    client_id: 'voicecid1',
  });
  assert.equal(voice.res.statusCode, 200);
  assert.equal(voice.json.transcript_status, 'no_key');
  assert.equal(voice.saved[0].entry_kind, 'voice');
  assert.equal(voice.fetches.length, 0);
  const missing = await transcribe({}, Buffer.from('abc'), 'audio/webm', { fetch: async () => { throw new Error('fetched'); } });
  assert.equal(missing.status, 'no_key');

  const done = await post({ op: 'done', ref: 'case-POSFIN-WEB-EYCTQ6' });
  assert.deepEqual(done.cockpit[0], { kind: 'case', id: 'POSFIN-WEB-EYCTQ6', patch: { done: true } });
  const reopen = await post({ op: 'reopen', ref: 'case-POSFIN-WEB-EYCTQ6' });
  assert.equal(reopen.cockpit[0].patch.done, false);
  const owner = await post({ op: 'owner', ref: 'case-POSFIN-WEB-EYCTQ6', owner: 'Chris' });
  assert.equal(owner.cockpit[0].patch.owner, 'Chris Shipton');
  const due = await post({ op: 'due', ref: 'case-POSFIN-WEB-EYCTQ6', due: '2026-11-30' });
  assert.equal(due.cockpit[0].patch.dueOn, '2026-11-30');
  const note = await post({ op: 'note', ref: 'case-POSFIN-WEB-EYCTQ6', edit_text: 'Left a note' });
  assert.equal(note.cockpit[0].patch.note, 'Left a note');
  const borrower = await post({ op: 'draft', ref: 'case-POSFIN-WEB-EYCTQ6', channel: 'borrower', edit_text: 'Borrower draft' });
  assert.equal(borrower.cockpit[0].patch.draftMessage, 'Borrower draft');

  const sample = await post({ op: 'done', ref: 'case-preview-hale' });
  assert.equal(sample.cockpit.length, 0);
  assert.equal(sample.fetches.length, 0);

  const asked = await post({ op: 'ask', ref: 'T-ASK', edit_text: '[T-ASK] What is the next step?' });
  assert.equal(asked.commands[0].action, 'thread');
  assert.equal(asked.commands[0].body.to_agent, 'lizzy');
  assert.match(asked.commands[0].body.message, /T-ASK/);
  const thread = await post({ op: 'thread', ref: 'T-TH', edit_text: '[T-TH] Noted for the team' });
  assert.equal(thread.commands[0].body.to_agent, 'all');
  const meeting = await post({
    op: 'meeting',
    ref: 'meet-daily-marketing-newey-compliance',
    meeting_id: 'daily-marketing',
    edit_text: 'tick',
    progress: { items: {}, actions: { 'newey-compliance': { done: true } }, extra_actions: [] },
  });
  assert.equal(meeting.commands[0].action, 'meetings');
  assert.equal(meeting.commands[0].body.id, 'daily-marketing');

  const stepped = await post({ op: 'yes', ref: 'B20261125-02' }, {
    rows: [item('B20261125-02', { case: 'Pack', act: 'File the signed pack', next_action: 'File the signed pack', urg: 'Normal', assignees: ['byron'] })],
  });
  assert.equal(stepped.json.next.kind, 'card');
  assert.equal(stepped.saved.some((row) => row.item_ref === 'B20261125-02-next' && row.payload.op === 'add'), true);
  const flagged = await post({ op: 'done', ref: 'T-FLAG' }, {
    rows: [item('T-FLAG', { case: 'No next', act: 'Leave a note on the next step.', assignees: ['byron'] })],
  });
  assert.equal(flagged.json.next.kind, 'flag');
  assert.match(flagged.json.next.text, /Lizzy to generate next/);

  const blocked = await post({ op: 'ask', ref: 'T-ASK', edit_text: 'Tell Tom', to_agent: 'tom' });
  assert.equal(blocked.res.statusCode, 400);
  assert.equal(blocked.saved.length, 0);
  assert.equal(blocked.commands.length, 0);
  const send = await post({ op: 'send', ref: 'T-1' });
  assert.equal(send.res.statusCode, 400);
  assert.equal(send.saved.length, 0);
  assert.equal(send.fetches.length, 0);
});

test('the pop-up page exposes every control as a same-site action and no send', async () => {
  const view = await get('view=popup&date=2026-11-25', { cards: [realCase, hale] });
  const html = view.res.body;
  assert.equal(view.res.statusCode, 200);
  assert.equal(view.res.headers['x-frame-options'], 'SAMEORIGIN');
  for (const label of [
    'Yes', 'No', 'Edit', 'Save edit', 'Voice note', 'Done', 'Part done', 'Save note',
    'Borrower message draft', 'Draft email', 'Copy text', 'Copy with headers', 'Draft WhatsApp',
    'Submit to BROKA (eligibility check)', 'EL / LOR desk', 'Ask Lizzy', 'Post to team thread',
    'Open case file', 'Files & sheets', 'Add task', 'Show done', 'Tick meeting item',
  ]) {
    assert.match(html, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(html, /Voice transcription key is not set/);
  assert.doesNotMatch(html, /preview-hale/);
  assert.doesNotMatch(html, /mailto:/i);
  assert.doesNotMatch(html, /api\.x\.ai|api\.resend|graph\.facebook|whatsapp\.com|twilio/i);
  const fetches = [...html.matchAll(/fetch\(([^)]*)\)/g)].map((match) => match[1]);
  assert.ok(fetches.length >= 2, JSON.stringify(fetches));
  assert.ok(fetches.every((target) => target.includes('/staff/run')), JSON.stringify(fetches.map((target) => target.slice(0, 80))));
  assert.doesNotMatch(html, />Send</);
  assert.equal(cleanAnswer({ ref: 'T-1', op: 'send' }, { popup: true }).error, 'bad_decision');
});

test('My tasks is added only while the flag is on', () => {
  const board = { mode: 'preview', filter: 'all', schemaPending: false, sections: [], newLeadsHtml: '', liveCases: false, seatLinks: [] };
  assert.doesNotMatch(renderBoard(board), /id="my-tasks"/);
  assert.match(renderBoard({ ...board, popup: true }), /id="my-tasks"/);
  assert.match(renderBoard({ ...board, popup: true }), /\/staff\/run-popup\.js/);
  const actor = { seat: 'byron', displayName: 'Byron' };
  assert.doesNotMatch(renderCommandPage(actor), /id="my-tasks"/);
  assert.match(renderCommandPage(actor, { popup: true }), /id="my-tasks"/);
  const launcher = readFileSync(new URL('../staff/run-popup.js', import.meta.url), 'utf8');
  assert.match(launcher, /\/staff\/tasks/);
  assert.doesNotMatch(launcher, /fetch\(|https?:\/\//);
  const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  assert.match(vercel, /\/staff\/tasks"/);
});

test('the machine API accepts an idempotent daily batch and still writes a one-off card', async () => {
  const secret = 'y'.repeat(40);
  const env = { RUN_SHEET_API_SECRET: secret, RUN_SHEET_SERVICE_KEY: 'svc-test' };
  const stored = [];
  const calls = [];
  const fetch = async (url, opts = {}) => {
    if (String(url).includes('select=item_ref')) {
      return { ok: true, status: 200, json: async () => stored.map((row) => ({ item_ref: row.item_ref })) };
    }
    const rows = JSON.parse(opts.body);
    calls.push({ url: String(url), ids: rows.map((row) => row.client_id) });
    for (const row of rows) {
      if (!stored.some((have) => have.client_id === row.client_id)) stored.push(row);
    }
    return { ok: true, status: 201, json: async () => [] };
  };
  const first = response();
  await handleRunSheetApi({
    method: 'POST',
    url: '/api/run-sheet',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: {
      date: '2026-11-25',
      items: [
        { ref: 'B20261125-01', case: 'Morning pack', urg: 'Urgent', assignees: ['byron'] },
        { ref: 'B20261125-01', case: 'Morning pack again', urg: 'Urgent' },
        { ref: 'B20261125-02', case: 'Second card', urg: 'Normal', assignees: ['byron'] },
      ],
    },
  }, first, { env, fetch });
  const firstBody = JSON.parse(first.body);
  assert.equal(first.statusCode, 200);
  assert.equal(firstBody.written, 2);
  assert.equal(firstBody.idempotent, true);
  assert.equal(stored.length, 2);
  assert.deepEqual(calls[0].ids, ['batch-2026-11-25-B20261125-01', 'batch-2026-11-25-B20261125-02']);
  assert.match(calls[0].url, /on_conflict=client_id/);
  const second = response();
  await handleRunSheetApi({
    method: 'POST',
    url: '/api/run-sheet',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: { date: '2026-11-25', items: [{ ref: 'B20261125-01', case: 'Morning pack', urg: 'Urgent' }] },
  }, second, { env, fetch });
  assert.equal(JSON.parse(second.body).written, 0);
  assert.equal(JSON.parse(second.body).skipped, 1);
  assert.equal(stored.length, 2);
  assert.doesNotMatch(second.body, /svc-test/);
  const today = buildPopupModel({
    seat: 'byron',
    viewer: 'byron',
    date: '2026-11-25',
    todayRows: stored.map((row) => ({ ...row, entry_kind: 'item', payload: row.payload, created_at: '2026-11-25T06:40:00Z' })),
    earlierRows: [],
    cases: [],
    decisions: [],
    moves: [],
    privateCases: [],
    meetingRows: [],
    canSave: true,
    storeOk: true,
  });
  assert.deepEqual(today.open.map((row) => row.ref).sort(), ['B20261125-01', 'B20261125-02']);
  assert.equal(meetingItems([], 'byron', new Date('2026-11-25T08:00:00Z')).some((row) => row.owner === 'Byron'), true);
});
