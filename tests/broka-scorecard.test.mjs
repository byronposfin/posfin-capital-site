import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBrokaDesk } from '../api/broka-desk.js';
import { PREVIEW_SCORE_ROWS, caseShortlist, lenderScorecard, responseScore } from '../lib/broka.js';
import { mintPreviewSession } from '../lib/cockpit-store.js';

const ENV = { COCKPIT_SOURCE: 'preview', COCKPIT_AUTH: 'preview', COCKPIT_PREVIEW_PASSWORD: 'preview-desk' };

function response() {
  const res = { headers: {}, body: '', status: 0, setHeader() {}, end(body) { this.body = body || ''; } };
  Object.defineProperty(res, 'statusCode', { set(value) { res.status = value; }, get() { return res.status; } });
  return res;
}

test('a quick decline keeps its speed out of the score, and the shortlist is the first five terms', () => {
  const tab = PREVIEW_SCORE_ROWS.find((row) => row.lender === 'TAB');
  const invocap = PREVIEW_SCORE_ROWS.find((row) => row.lender === 'Invocap');
  assert.equal(responseScore(tab), 36);
  assert.notEqual(responseScore(tab), 23);
  assert.equal(responseScore(invocap), 69);
  const board = lenderScorecard(PREVIEW_SCORE_ROWS);
  assert.equal(board.find((row) => row.lender === 'TAB').quickDeclines, 1);
  assert.equal(board[0].lender, 'Late Terms Ltd');
  const list = caseShortlist(PREVIEW_SCORE_ROWS);
  assert.deepEqual(list.map((row) => row.lender), [
    'Albatross Lending Group',
    'Invocap',
    'Harbour Bridge Co',
    'Dantis',
    'North Pier Finance',
  ]);
  assert.deepEqual(list.map((row) => row.shortlistRank), [1, 2, 3, 4, 5]);
  assert.equal(list.some((row) => row.lender === 'Late Terms Ltd'), false);
});

test('the scorecard tab renders the board and the case shortlist', async () => {
  const session = mintPreviewSession(ENV);
  const res = response();
  await handleBrokaDesk({
    method: 'GET',
    headers: { cookie: `pf_staff=${encodeURIComponent(session)}` },
    query: { view: 'scorecard' },
    url: '/staff/cockpit/broka/scorecard',
  }, res, { env: ENV, fetch: async () => { throw new Error('no network'); } });
  assert.equal(res.status, 200);
  assert.match(res.body, /Lender scorecard/);
  assert.match(res.body, /69\.00/);
  assert.match(res.body, /36\.00/);
  assert.match(res.body, /The first five sets of terms/);
  assert.match(res.body, /1\.<\/strong> Albatross Lending Group/);
  const list = res.body.slice(res.body.indexOf('Shortlist'), res.body.indexOf('</ol>'));
  assert.equal(list.includes('Late Terms'), false);
  assert.equal(/broka\.app/i.test(res.body), false);
});
