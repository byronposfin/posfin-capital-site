import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mintPreviewSession } from '../lib/cockpit-store.js';
import { boardFrom, pipelineConfig, pipelineMode } from '../api/staff-pipeline.js';
import handler from '../api/staff-pipeline.js';
import { renderPipeline, renderPipelineLogin } from '../lib/pipeline-html.js';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const MAIN = 'https://vgflcrfaudrvrdmxjdtl.supabase.co';
const PLACEHOLDERS = [
  'Example Pipeline One',
  'Example Pipeline Two',
  'Ada Caller',
  'Example Borrower One',
  'Example Borrower Two',
  'Example Borrower Three',
  'Example Borrower Four',
  'Example Bromet',
  'Example Messy Row',
];

function names(board) {
  return board.columns.flatMap((column) => column.cards).concat(board.parked, board.completed).map((card) => card.name);
}

function liveRow() {
  return {
    id: 'real-1',
    full_name: 'Real Borrower Live',
    email: 'real.borrower@example.invalid',
    phone: '',
    status: 'contacted',
    source: 'website',
    loan_amount_band: '250k',
    assigned_to: 'Chris',
    created_at: '2026-11-01T00:00:00Z',
    fb_created_time: null,
  };
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

test('pipeline key checks the service role before the anon key', () => {
  assert.equal(pipelineConfig({
    PIPELINE_SUPABASE_URL: MAIN,
    PIPELINE_SUPABASE_KEY: 'pipeline-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    FF_SUPABASE_KEY: 'anon-key',
  }).key, 'pipeline-key');
  assert.equal(pipelineConfig({
    SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    FF_SUPABASE_KEY: 'anon-key',
  }).key, 'service-role');
  assert.equal(pipelineConfig({
    PIPELINE_SUPABASE_KEY: '   ',
    SUPABASE_SERVICE_ROLE_KEY: ' service-role ',
    FF_SUPABASE_KEY: 'anon-key',
  }).key, 'service-role');
  assert.equal(pipelineConfig({ FF_SUPABASE_KEY: 'anon-key' }).key, 'anon-key');
  assert.equal(pipelineConfig({}).key, '');
  const source = readFileSync(new URL('../api/staff-pipeline.js', import.meta.url), 'utf8');
  assert.match(source, /PIPELINE_SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'FF_SUPABASE_KEY'/);
  assert.equal(source.split('FF_SUPABASE_KEY').length - 1, 1);
  assert.equal(source.includes('apikey: cfg.key'), true);
  assert.equal(/apikey:\s*[^c\n]*FF_SUPABASE_KEY/.test(source), false);
});

test('demo is recognised from the path, the query, and the posted field', () => {
  assert.equal(pipelineMode({ url: '/staff/cockpit/pipeline' }).demo, false);
  assert.equal(pipelineMode({ url: '/staff/cockpit/pipeline/demo' }).demo, true);
  assert.equal(pipelineMode({ url: '/api/staff-pipeline?demo=1&owner=chris' }).demo, true);
  assert.equal(pipelineMode({ url: '/api/staff-pipeline?demo=1&owner=chris' }).owner, 'chris');
  assert.equal(pipelineMode({ url: '/api/staff-pipeline', query: { demo: 'true' } }).demo, true);
  assert.equal(pipelineMode({ url: '/staff/cockpit/pipeline' }, { demo: '1' }).demo, true);
  assert.equal(pipelineMode({ url: '/staff/cockpit/pipeline?demo=0' }).demo, false);
});

test('live board keeps Supabase rows and drops every synthetic placeholder', () => {
  const board = boardFrom([liveRow()], NOW, 60, 'all', { demo: false });
  const shown = names(board);
  assert.deepEqual(shown, ['Real Borrower Live']);
  for (const name of PLACEHOLDERS) assert.equal(shown.includes(name), false, name);
  assert.equal(board.demo, false);
  assert.equal(board.intake.fetched, 1);
  const chris = names(boardFrom([liveRow()], NOW, 60, 'chris', { demo: false }));
  assert.deepEqual(chris, ['Real Borrower Live']);
  assert.deepEqual(names(boardFrom([liveRow()], NOW, 60, 'byron', { demo: false })), []);
});

test('demo board keeps synthetic placeholders and ignores live rows', () => {
  const board = boardFrom([liveRow()], NOW, 60, 'all', { demo: true });
  const shown = names(board);
  for (const name of PLACEHOLDERS) assert.equal(shown.includes(name), true, name);
  assert.equal(shown.includes('Real Borrower Live'), false);
  assert.equal(board.demo, true);
  assert.equal(board.intake.fetched, 0);
  assert.equal(shown.some((name) => name === 'Real Borrower Live'), false);
  const chris = names(boardFrom([liveRow()], NOW, 60, 'chris', { demo: true }));
  assert.equal(chris.includes('Ada Caller'), true);
  assert.equal(chris.includes('Example Bromet'), true);
  assert.equal(chris.includes('Example Pipeline Two'), true);
  assert.equal(chris.includes('Real Borrower Live'), false);
  assert.equal(chris.includes('Example Borrower One'), false);
});

test('live and demo copy point at each other and do not describe the wrong data', () => {
  const live = renderPipeline(
    { columns: [], parked: [], completed: [] },
    { owner: 'chris', banner: '2 live Supabase cards from 2 rows read.', demo: false },
  );
  assert.match(live, /data-mode="live"/);
  assert.match(live, /Live Supabase data only/);
  assert.match(live, /Synthetic placeholder cards are not on this board/);
  assert.match(live, /href="\/staff\/cockpit\/pipeline\/demo\?owner=chris"/);
  assert.match(live, /href="\/staff\/cockpit\/pipeline\?owner=chris"/);
  assert.equal(live.includes('Fixture cards are still shown'), false);
  assert.equal(live.includes('on this preview'), false);
  assert.equal(live.includes('Demo mode'), false);
  const demo = renderPipeline(
    { columns: [{ id: 'contacting', title: 'Lizzy contacting', move: 'Moves when the fact find is submitted', cards: [{ id: 'case:PC-026', caseRef: 'PC-026', name: 'Example Bromet', stage: 'parked', owner: 'Chris', source: 'crm-pipeline', flags: [], history: [] }] }], parked: [], completed: [] },
    { owner: 'all', demo: true, banner: 'Demo mode. 1 synthetic placeholder cards. Live client rows are not loaded.' },
  );
  assert.match(demo, /data-mode="demo"/);
  assert.match(demo, /class="demo-badge"/);
  assert.match(demo, /Demo mode · synthetic placeholder data/);
  assert.match(demo, /Live client rows are not loaded/);
  assert.match(demo, /action="\/staff\/cockpit\/pipeline\/demo"/);
  assert.match(demo, /name="demo" value="1"/);
  assert.match(demo, /href="\/staff\/cockpit\/pipeline">Live Deal flow/);
  assert.match(demo, /Example Bromet/);
  assert.equal(demo.includes('real.borrower@example.invalid'), false);
  const login = renderPipelineLogin();
  assert.match(login, /href="\/staff\/set-password">Forgot password\?/);
  assert.match(login, /href="\/staff\/cockpit\/pipeline\/demo">Demo view/);
  assert.equal(login.includes('class="demo-badge"'), false);
  assert.match(renderPipelineLogin({ demo: true }), /demo-badge/);
});

test('the desk serves live Supabase rows and a separate synthetic demo', async () => {
  const saved = {};
  const keys = ['COCKPIT_SOURCE', 'COCKPIT_AUTH', 'COCKPIT_PREVIEW_PASSWORD', 'STAFF_AUTH_MODE', 'PIPELINE_SUPABASE_URL', 'PIPELINE_SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'FF_SUPABASE_KEY', 'FF_SUPABASE_URL'];
  for (const key of keys) saved[key] = process.env[key];
  const previousFetch = globalThis.fetch;
  const previousBag = globalThis.__posfinPipelineActions;
  const calls = [];
  globalThis.__posfinPipelineActions = { lors: [], els: [], queue: [], moves: [] };
  process.env.COCKPIT_SOURCE = 'preview';
  process.env.COCKPIT_AUTH = 'preview';
  process.env.COCKPIT_PREVIEW_PASSWORD = 'preview-desk';
  process.env.STAFF_AUTH_MODE = 'preview';
  process.env.PIPELINE_SUPABASE_URL = MAIN;
  delete process.env.PIPELINE_SUPABASE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  process.env.FF_SUPABASE_KEY = 'anon-key-test';
  delete process.env.FF_SUPABASE_URL;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body || '' });
    return {
      ok: true,
      status: 200,
      json: async () => [liveRow()],
    };
  };
  const token = mintPreviewSession(process.env);
  const cookie = `pf_staff=${encodeURIComponent(token)}`;
  try {
    const anon = response();
    await handler({ method: 'GET', url: '/staff/cockpit/pipeline', headers: {} }, anon);
    assert.equal(anon.status, 401);
    assert.equal(anon.body.includes('Example Pipeline One'), false);
    assert.equal(anon.body.includes('real.borrower@example.invalid'), false);
    assert.equal(calls.length, 0);

    const live = response();
    await handler({ method: 'GET', url: '/staff/cockpit/pipeline', headers: { cookie } }, live);
    assert.equal(live.status, 200);
    assert.match(live.body, /data-mode="live"/);
    assert.match(live.body, /Real Borrower Live/);
    assert.match(live.body, /1 live Supabase cards from 1 rows read/);
    for (const name of PLACEHOLDERS) assert.equal(live.body.includes(name), false, name);
    assert.equal(live.body.includes('anon-key-test'), false);
    assert.equal(live.body.includes('service-role-test'), false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
    assert.match(calls[0].url, /\/rest\/v1\/leads\?/);
    assert.equal(calls[0].headers.apikey, 'service-role-test');
    assert.equal(calls[0].headers.Authorization, 'Bearer service-role-test');
    assert.equal(calls[0].body, '');
    const counts = JSON.parse(live.body.match(/<script type="application\/json" id="board-counts">([^<]+)<\/script>/)[1]);
    assert.equal(counts.mode, 'live');
    assert.equal(counts.supabaseCards, 1);
    assert.equal(counts.fixtureCards, 0);

    const beforeDemo = calls.length;
    const demo = response();
    await handler({ method: 'GET', url: '/staff/cockpit/pipeline/demo', headers: { cookie } }, demo);
    assert.equal(demo.status, 200);
    assert.equal(calls.length, beforeDemo);
    assert.match(demo.body, /data-mode="demo"/);
    assert.match(demo.body, /Demo mode · synthetic placeholder data/);
    assert.match(demo.body, /Live client rows are not loaded/);
    for (const name of PLACEHOLDERS) assert.equal(demo.body.includes(name), true, name);
    assert.equal(demo.body.includes('Real Borrower Live'), false);
    assert.equal(demo.body.includes('real.borrower@example.invalid'), false);
    const demoCounts = JSON.parse(demo.body.match(/<script type="application\/json" id="board-counts">([^<]+)<\/script>/)[1]);
    assert.equal(demoCounts.mode, 'demo');
    assert.equal(demoCounts.supabaseCards, 0);
    assert.equal(demoCounts.leads.fetched, 0);
    assert.ok(demoCounts.fixtureCards >= PLACEHOLDERS.length);

    const queryDemo = response();
    await handler({ method: 'GET', url: '/staff/cockpit/pipeline?demo=1&owner=chris', headers: { cookie } }, queryDemo);
    assert.equal(calls.length, beforeDemo);
    assert.match(queryDemo.body, /data-mode="demo"/);
    assert.match(queryDemo.body, /Ada Caller/);
    assert.match(queryDemo.body, /Example Bromet/);
    assert.equal(queryDemo.body.includes('Example Borrower One'), false);
    assert.equal(queryDemo.body.includes('Real Borrower Live'), false);
    assert.match(queryDemo.body, /href="\/staff\/cockpit\/pipeline\?owner=chris">Live Deal flow/);

    const moved = response();
    await handler({
      method: 'POST',
      url: '/staff/cockpit/pipeline',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: { action: 'move', case: 'lead:real-1', to: 'fact_find', moved_by: 'Lizzy' },
    }, moved);
    assert.equal(moved.status, 200);
    assert.match(moved.body, /Real Borrower Live moved from contacting to fact_find/);
    assert.match(moved.body, /Kept on this desk only/);
    assert.equal(moved.body.includes('on this preview'), false);
    assert.equal(moved.body.includes('Example Pipeline One'), false);
    const factFind = moved.body.split('data-stage="fact_find"')[1].split('data-stage=')[0];
    assert.match(factFind, /Real Borrower Live/);
    assert.equal(calls.every((call) => call.method === 'GET' && call.body === ''), true);

    const demoMoved = response();
    const callsAtDemoMove = calls.length;
    await handler({
      method: 'POST',
      url: '/api/staff-pipeline?demo=1',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: { action: 'move', case: 'TEST-PIPE-001', to: 'contacting', moved_by: 'Byron', demo: '1' },
    }, demoMoved);
    assert.equal(demoMoved.status, 200);
    assert.equal(calls.length, callsAtDemoMove);
    assert.match(demoMoved.body, /Demo board only/);
    assert.match(demoMoved.body, /TEST-PIPE-001 moved from completed to contacting/);
    assert.equal(demoMoved.body.includes('Real Borrower Live'), false);
    const contacting = demoMoved.body.split('data-stage="contacting"')[1].split('data-stage=')[0];
    assert.match(contacting, /Example Pipeline One/);

    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || 'GET', headers: options.headers || {}, body: options.body || '' });
      return {
        ok: true,
        status: 200,
        json: async () => [
          liveRow(),
          { ...liveRow(), id: 'real-2', full_name: 'Second Borrower Live', email: 'second.borrower@example.invalid' },
        ],
      };
    };
    const drafted = response();
    await handler({
      method: 'POST',
      url: '/staff/cockpit/pipeline',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: { action: 'lor', case: 'lead:real-1' },
    }, drafted);
    assert.equal(drafted.status, 200);
    assert.match(drafted.body, /LOR v1 saved for Real Borrower Live/);
    const afterLor = response();
    await handler({ method: 'GET', url: '/staff/cockpit/pipeline', headers: { cookie } }, afterLor);
    const articles = afterLor.body.split('<article class="card"').slice(1);
    const first = articles.find((article) => article.includes('Real Borrower Live'));
    const second = articles.find((article) => article.includes('Second Borrower Live'));
    assert.match(first, /LOR versions kept: 1/);
    assert.equal(second.includes('LOR versions kept'), false);
    assert.equal(second.includes('Real Borrower Live'), false);

    const blocked = response();
    process.env.PIPELINE_SUPABASE_URL = 'https://example.supabase.co';
    const callsAtBlocked = calls.length;
    await handler({ method: 'GET', url: '/staff/cockpit/pipeline', headers: { cookie } }, blocked);
    assert.equal(calls.length, callsAtBlocked);
    assert.match(blocked.body, /Synthetic placeholder cards are not shown/);
    assert.match(blocked.body, /not_main_project/);
    for (const name of PLACEHOLDERS) assert.equal(blocked.body.includes(name), false, name);

    process.env.PIPELINE_SUPABASE_URL = MAIN;
    globalThis.fetch = async () => { throw Object.assign(new Error('network'), { code: 'network' }); };
    const failed = response();
    await handler({ method: 'GET', url: '/staff/cockpit/pipeline', headers: { cookie } }, failed);
    assert.equal(failed.status, 503);
    assert.match(failed.body, /Synthetic placeholder cards are not shown/);
    for (const name of PLACEHOLDERS) assert.equal(failed.body.includes(name), false, name);
    assert.equal(failed.body.includes('Real Borrower Live'), false);
    const failedPost = response();
    await handler({
      method: 'POST',
      url: '/staff/cockpit/pipeline',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
      body: { action: 'move', case: 'lead:real-1', to: 'parked', moved_by: 'Byron' },
    }, failedPost);
    assert.equal(failedPost.status, 503);
    assert.match(failedPost.body, /Synthetic placeholder cards are not shown/);
    assert.equal(failedPost.body.includes('Example Pipeline One'), false);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.__posfinPipelineActions = previousBag;
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
