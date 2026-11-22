import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyDeskMoves, assumedFee, attachCalls, attachCallsExport, buildCases, filterOwner, leadSelected, loadCrmBoard, loadMasterIndex, mergeCrmCards, parseCallsExport, parsePipelineCsv, selectLeads, stageFromIndex, stageFromPipelineStatus, summariseLeads,
} from '../lib/pipeline.js';
import { feeDraft, lenderChoices, nextLor, queueExternal } from '../lib/pipeline-actions.js';

const NOW = Date.parse('2026-11-20T09:16:00Z');
const DAY = 86400000;

function lead(overrides) {
  return {
    id: '1',
    full_name: 'Ada Example',
    email: 'ada@example.invalid',
    phone: '',
    status: 'new',
    source: 'facebook',
    loan_amount_band: '',
    created_at: '2026-11-01T00:00:00Z',
    fb_created_time: null,
    ...overrides,
  };
}

test('intake selection keeps 60 days, older active leads, and drops tests and archived new', () => {
  const rows = [
    lead({ id: 'recent' }),
    lead({ id: 'old-new', created_at: '2026-08-01T00:00:00Z', status: 'new' }),
    lead({ id: 'old-contacted', created_at: '2026-06-01T00:00:00Z', status: 'contacted', email: 'old@example.invalid' }),
    lead({ id: 'old-declined', created_at: '2026-05-01T00:00:00Z', status: 'declined', email: 'no@example.invalid' }),
    lead({ id: 'archived', source: 'facebook_archived', status: 'new' }),
    lead({ id: 'archived-live', source: 'facebook_archived', status: 'contacted', email: 'arch@example.invalid', created_at: '2026-01-01T00:00:00Z' }),
    lead({ id: 'test', source: 'fr_factfind_test' }),
    lead({ id: 'webtest', source: 'web_factfind_test' }),
  ];
  assert.equal(leadSelected(rows[1], NOW, 60), false);
  assert.equal(leadSelected(rows[3], NOW, 60), true);
  const cards = selectLeads(rows, NOW, 60);
  const ids = cards.map((card) => card.id).sort();
  assert.deepEqual(ids, ['lead:archived-live', 'lead:old-contacted', 'lead:old-declined', 'lead:recent']);
  assert.equal(cards.find((card) => card.id === 'lead:old-declined').stage, 'parked');
  assert.equal(cards.find((card) => card.id === 'lead:old-contacted').stage, 'contacting');
  assert.equal(cards.find((card) => card.id === 'lead:recent').stage, 'raw_lead');
});

test('one card per contact, newest lead wins, older ids stay linked', () => {
  const cards = selectLeads([
    lead({ id: 'older', created_at: '2026-10-01T00:00:00Z', status: 'contacted' }),
    lead({ id: 'newer', created_at: '2026-11-02T00:00:00Z', status: 'new', phone: '+44 7700 900123' }),
  ], NOW, 60);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, 'lead:newer');
  assert.deepEqual(cards[0].linked, ['older']);
  const byPhone = selectLeads([
    lead({ id: 'a', email: '', phone: '+44 7700 900111', created_at: '2026-11-01T00:00:00Z' }),
    lead({ id: 'b', email: '', phone: '44 7700 900111', created_at: '2026-11-10T00:00:00Z' }),
  ], NOW, 60);
  assert.equal(byPhone.length, 1);
  assert.equal(byPhone[0].id, 'lead:b');
});

test('index and pipeline statuses land on the named columns', () => {
  assert.equal(stageFromIndex('Qualified Opportunity').stage, 'fact_find');
  assert.equal(stageFromIndex('Terms in / LOR sent').stage, 'lor_requested');
  assert.equal(stageFromIndex('Offer').stage, 'el_issued');
  assert.equal(stageFromIndex('EL presented').stage, 'el_issued');
  assert.equal(stageFromIndex('EL signed').stage, 'el_signed');
  assert.equal(stageFromIndex('Valuation/Legals (processing)').substatus, 'Valuation/Legals');
  assert.equal(stageFromIndex('Stalled').stage, 'parked');
  assert.equal(stageFromPipelineStatus('DEAD').stage, 'parked');
  assert.equal(stageFromPipelineStatus('RAW_ROUTER_IMPORTED — NEEDS QUALIFICATION').stage, 'new_triage');
  assert.equal(stageFromPipelineStatus('BORROWER ENGAGED — NEEDS QUALIFICATION').stage, 'new_triage');
  assert.equal(stageFromPipelineStatus('ROUTER COMPLETE').stage, 'fact_find');
  assert.equal(stageFromPipelineStatus('TERMS REQUESTED').stage, 'lor_requested');
  assert.equal(stageFromPipelineStatus('OFFER RECEIVED').stage, 'el_issued');
  assert.equal(stageFromPipelineStatus('EL SIGNED / PROCESSING').stage, 'el_signed');
  assert.equal(stageFromPipelineStatus('LEGALS').stage, 'el_signed');
  assert.equal(stageFromPipelineStatus('COMPLETING').stage, 'el_signed');
  assert.equal(stageFromPipelineStatus('COMPLETED').stage, 'completed');
  assert.equal(stageFromPipelineStatus('EL SENT').stage, 'el_sent');
  assert.equal(stageFromPipelineStatus('DEAD - CLIENT GHOSTING').stage, 'parked');
  assert.equal(stageFromPipelineStatus('DEAD - CLIENT GHOSTING').reason, 'DEAD - CLIENT GHOSTING');
  assert.equal(stageFromPipelineStatus('Website').stage, 'new_triage');
  assert.equal(stageFromPipelineStatus('TRIAGE').stage, 'new_triage');
  assert.equal(stageFromPipelineStatus('ARCHIVED — COMPLETED / SHADOW BOOK').stage, 'completed');
  assert.equal(stageFromPipelineStatus('PROCESSING').stage, 'el_signed');
});

test('20 Nov stage wins over the 14 Nov index and both stay in history', () => {
  const index = loadMasterIndex();
  assert.equal(index.length, 5);
  assert.equal(index.filter((row) => row.tier.startsWith('A')).length, 2);
  assert.equal(index.filter((row) => row.tier.startsWith('B')).length, 2);
  assert.equal(index.filter((row) => row.tier.startsWith('D')).length, 1);
  const cards = buildCases(index);
  const first = cards.find((card) => card.caseRef === 'PC-001');
  assert.equal(first.name, 'Example Borrower One');
  assert.equal(first.stage, 'el_signed');
  assert.equal(first.loan, 250000);
  assert.equal(first.feeVerified, 7500);
  assert.equal(first.feeAssumed, null);
  assert.equal(first.driveUrl.startsWith('https://drive.google.com/'), true);
  assert.equal(first.history[0].source, 'master-index-14-nov');
  assert.equal(first.history[1].source, 'pipeline-20-nov');
  const second = cards.find((card) => card.caseRef === 'PC-002');
  assert.equal(second.stage, 'fact_find');
  assert.equal(second.loan, 180000);
  const fourth = cards.find((card) => card.caseRef === 'PC-004');
  assert.equal(fourth.name, 'Example Borrower Four');
  assert.equal(fourth.stage, 'el_sent');
  assert.equal(fourth.flags.includes('EL not on file'), true);
  assert.equal(fourth.flags.includes('Byron/Chris to confirm'), true);
  assert.equal(assumedFee(185000, 'lor_requested'), 9250);
  assert.equal(assumedFee(null, 'lor_requested'), null);
  const third = cards.find((card) => card.caseRef === 'PC-003');
  assert.equal(third.feeVerified, 9250);
  assert.equal(third.feeAssumed, 9250);
});

test('call tabs attach by source row or name, and a new caller becomes an intake card', () => {
  const cards = buildCases(loadMasterIndex());
  const withCalls = attachCalls(cards, [
    { date: '2026-11-17', name: 'Ada Caller', owner: 'Chris', sourceRow: '', email: 'ada.caller@example.invalid', phone: '447700900123', note: 'Further questions only. Synthetic.' },
    { date: '2026-10-22', name: 'Example Case', owner: 'Chris', sourceRow: 'Pipeline:94 | META-31483305', email: '', phone: '', note: 'Router complete and fact find submitted.' },
    { date: '2026-07-27', name: 'Example Bromet', owner: 'Chris', sourceRow: 'Existing synthetic file', email: '', phone: '', note: 'Called again.' },
  ]);
  const ada = withCalls.find((card) => card.name === 'Ada Caller');
  assert.equal(ada.stage, 'contacting');
  assert.equal(ada.owner, 'Chris');
  assert.equal(ada.flags.includes('Not on the Pipeline tab'), true);
  const meta = withCalls.find((card) => card.caseRef === 'META-31483305');
  assert.equal(meta.stage, 'fact_find');
  assert.equal(meta.callNotes[0].sourceRow.includes('META-31483305'), true);
  const bromet = withCalls.find((card) => card.caseRef === 'PC-026');
  assert.equal(bromet.name, 'Example Bromet');
  assert.equal(bromet.stage, 'parked');
  assert.equal(bromet.callNotes[0].owner, 'Chris');
  assert.equal(bromet.owner, 'Chris');
});

test('pipeline CSV import uses case_id and does not require a sheet write', () => {
  const csv = 'case_id,borrower_name,status,owner_sales,next_step\nPOSFIN.26.0115,Elliot Example,COMPLETED,Chris,Check the file\n';
  const rows = parsePipelineCsv(csv);
  assert.equal(rows[0].caseRef, 'POSFIN.26.0115');
  assert.equal(rows[0].stage, 'completed');
  assert.equal(rows[0].owner, 'Chris');
  const sql = readFileSync(new URL('../sql/20261120_pipeline_stage.sql', import.meta.url), 'utf8');
  assert.match(sql, /DO NOT APPLY/);
  assert.match(sql, /from_stage/);
  assert.match(sql, /to_stage/);
  assert.match(sql, /moved_by/);
  assert.match(sql, /moved_at/);
  assert.equal(/update public\.leads/i.test(sql), false);
  assert.equal(/delete from public\.leads/i.test(sql), false);
});

test('external actions queue for Byron and drop blocked names', () => {
  assert.deepEqual(lenderChoices(['Together', 'CIFAS', 'Neville Finance', 'KPC Investors']), ['BROKA (whole lender set)', 'Together']);
  const card = { caseRef: 'PC-003', name: 'Example', loan: 185000 };
  const first = nextLor([], card, 'Byron', '2026-11-20T09:00:00Z');
  const second = nextLor([first.doc], card, 'Byron', '2026-11-20T10:00:00Z');
  assert.equal(first.doc.version, 1);
  assert.equal(second.doc.version, 2);
  assert.equal(second.kept, 1);
  assert.equal(first.doc.leavesPosfin, false);
  const fees = feeDraft(100000, 2, 3);
  assert.equal(fees.proc, 2000);
  assert.equal(fees.broker, 3000);
  const queued = queueExternal({
    kind: 'send-lor',
    caseRef: 'PC-003',
    lenders: ['Together', 'CIFAS'],
    chosen: ['CIFAS', 'Together'],
    cost: 'No send fee is charged from this page.',
    actor: 'Byron',
    now: '2026-11-20T09:00:00Z',
  });
  assert.equal(queued.status, 'awaiting Byron approval');
  assert.equal(queued.sent, false);
  assert.equal(queued.charged, false);
  assert.equal(queued.placed.called, false);
  assert.deepEqual(queued.recipients, ['Together']);
  assert.equal(/bacs/i.test(JSON.stringify(queued)), false);
});

test('a desk move writes history and an owner filter keeps Chris', () => {
  const [card] = buildCases(loadMasterIndex()).filter((item) => item.caseRef === 'PC-003');
  const moved = applyDeskMoves([card], [{
    caseRef: 'PC-003',
    from: card.stage,
    to: 'contacting',
    owner: 'Chris',
    movedBy: 'Lizzy',
    note: 'Routed to Chris',
  }]);
  assert.equal(moved[0].stage, 'contacting');
  assert.equal(moved[0].owner, 'Chris');
  assert.match(moved[0].history.at(-1).note, /Lizzy/);
  assert.equal(filterOwner(moved, 'Chris').length, 1);
  assert.equal(filterOwner(moved, 'Aadi').length, 0);
});

test('crm exports keep messy rows and match by case id then name', () => {
  const csv = [
    'case_id,borrower_name,status,owner_sales,next_action',
    'POSFIN-X,Ann Example,━━ DEAL STATUS — note COMPLETED on 10 Apr,Byron,Check',
    ',Jean Example,Website,Byron,Call',
    'POSFIN-D,Pat Example,DEAD - CLIENT GHOSTING,Chris,Stop',
  ].join('\n');
  const rows = parsePipelineCsv(csv);
  assert.equal(rows.length, 3);
  const messy = rows.find((row) => row.caseRef === 'POSFIN-X');
  assert.equal(messy.flags.includes('source data needs cleanup'), true);
  assert.equal(messy.stage, 'completed');
  assert.equal(rows.find((row) => row.name === 'Jean Example').stage, 'new_triage');
  const base = [{ caseRef: 'PC-001', name: 'Jean Example', stage: 'raw_lead', owner: 'Lizzy', flags: [], history: [{ source: 'index', stage: 'raw_lead' }], callNotes: [] }];
  const merged = mergeCrmCards(base, rows.filter((row) => row.name === 'Jean Example'));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].caseRef, 'PC-001');
  assert.equal(merged[0].stage, 'new_triage');
  assert.equal(merged[0].owner, 'Byron');
  assert.match(merged[0].history.map((row) => row.note).join(' '), /Earlier stage raw_lead/);
  const calls = parseCallsExport('owner_tab,date,lead_name,note_summary,case_id_matched,source_row_or_case_ref\nCHRIS CALLS,2026-11-17,Ada Caller,Further questions,,\nBYRON CALLS,2026-11-01,Pat Example,Spoke,POSFIN-D,PIPELINE\n');
  const withCalls = attachCallsExport([{ caseRef: 'POSFIN-D', name: 'Pat Example', stage: 'parked', owner: 'Chris', flags: [], history: [], callNotes: [] }], calls);
  assert.equal(withCalls.length, 2);
  assert.equal(withCalls.find((card) => card.caseRef === 'POSFIN-D').callNotes.length, 1);
  const ada = withCalls.find((card) => card.name === 'Ada Caller');
  assert.equal(ada.owner, 'Chris');
  assert.equal(ada.stage, 'contacting');
  assert.equal(ada.flags.includes('Not on the Pipeline tab'), true);
});

test('synthetic crm fixtures keep every exported row', () => {
  const pipeline = parsePipelineCsv(readFileSync(new URL('../fixtures/synthetic-crm/pipeline-tab.csv', import.meta.url), 'utf8'));
  const clean = parsePipelineCsv(readFileSync(new URL('../fixtures/synthetic-crm/pipeline-clean.csv', import.meta.url), 'utf8'));
  const calls = parseCallsExport(readFileSync(new URL('../fixtures/synthetic-crm/calls.csv', import.meta.url), 'utf8'));
  assert.equal(pipeline.length, 3);
  assert.equal(clean.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls.filter((call) => call.caseRef).length, 1);
  const cards = loadCrmBoard();
  assert.equal(cards.length > pipeline.length, true);
  assert.equal(cards.some((card) => card.flags.includes('source data needs cleanup')), true);
  assert.equal(cards.some((card) => /@(?!example\.invalid)/.test(card.email || '')), false);
});

test('lead summary counts skips and contact dedupe without writing', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  const rows = [
    { id: 'a', full_name: 'Ada', email: 'ada@example.com', status: 'new', source: 'facebook', fb_created_time: '2026-11-01T00:00:00Z' },
    { id: 'b', full_name: 'Ada older', email: 'ada@example.com', status: 'new', source: 'facebook', fb_created_time: '2026-10-01T00:00:00Z' },
    { id: 'c', full_name: 'Test', email: 't@example.com', status: 'new', source: 'fr_factfind_test', created_at: '2026-11-01T00:00:00Z' },
    { id: 'd', full_name: 'Old', email: 'old@example.com', status: 'new', source: 'facebook', created_at: '2026-01-01T00:00:00Z' },
    { id: 'e', full_name: 'Roy', email: 'roy@example.com', status: 'contacted', source: 'facebook', created_at: '2026-11-02T00:00:00Z' },
  ];
  const summary = summariseLeads(rows, now, 60, new Set(['roy']));
  assert.equal(summary.fetched, 5);
  assert.equal(summary.skipped.test_source, 1);
  assert.equal(summary.skipped.outside_window_still_new, 1);
  assert.equal(summary.dedupedByContact, 1);
  assert.equal(summary.nameClash, 1);
  assert.equal(summary.cardsAdded, 1);
});
