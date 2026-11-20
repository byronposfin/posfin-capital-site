import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  assumedFee, attachCalls, buildCases, leadSelected, loadMasterIndex, parsePipelineCsv, selectLeads, stageFromIndex, stageFromPipelineStatus,
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
});

test('20 Nov stage wins over the 14 Nov index and both stay in history', () => {
  const index = loadMasterIndex();
  assert.equal(index.length, 33);
  assert.equal(index.filter((row) => row.tier.startsWith('A')).length, 19);
  assert.equal(index.filter((row) => row.tier.startsWith('B')).length, 9);
  assert.equal(index.filter((row) => row.tier.startsWith('D')).length, 5);
  const cards = buildCases(index);
  const roy = cards.find((card) => card.caseRef === 'PC-002');
  assert.equal(roy.stage, 'el_signed');
  assert.equal(roy.loan, 1500000);
  assert.equal(roy.feeVerified, 45000);
  assert.equal(roy.feeAssumed, null);
  assert.equal(roy.driveUrl.startsWith('https://drive.google.com/'), true);
  assert.equal(roy.history[0].source, 'master-index-14-nov');
  assert.equal(roy.history[1].source, 'pipeline-20-nov');
  const williamson = cards.find((card) => card.caseRef === 'POSFIN-WEB-EYCTQ6');
  assert.equal(williamson.stage, 'fact_find');
  assert.equal(williamson.loan, 455000);
  assert.equal(cards.some((card) => card.caseRef === 'PC-004' && card.name.includes('Williamson')), false);
  const morys = cards.find((card) => card.caseRef === 'PC-004');
  assert.match(morys.name, /Morys/);
  assert.equal(morys.stage, 'el_sent');
  assert.equal(morys.flags.includes('EL not on file'), true);
  const unsure = cards.find((card) => card.caseRef === 'PC-027');
  assert.equal(unsure.flags.includes('Byron/Chris to confirm'), true);
  assert.equal(assumedFee(185000, 'lor_requested'), 9250);
  assert.equal(assumedFee(null, 'lor_requested'), null);
  const mcdonald = cards.find((card) => card.caseRef === 'PC-003');
  assert.equal(mcdonald.feeVerified, 9250);
  assert.equal(mcdonald.feeAssumed, 9250);
});

test('call tabs attach by source row or name, and a new caller becomes an intake card', () => {
  const cards = buildCases(loadMasterIndex());
  const withCalls = attachCalls(cards, [
    { date: '2026-11-17', name: 'Rod Sim', owner: 'Chris', sourceRow: '', email: 'rsimdevelopments@gmail.com', phone: '447515970811', note: 'He answered the questions yesterday and Byron asked further questions.' },
    { date: '2026-10-22', name: 'Someone Else', owner: 'Chris', sourceRow: 'Pipeline:94 | META-31483305', email: '', phone: '', note: 'Router complete and fact find submitted.' },
    { date: '2026-07-27', name: 'Edward Bromet', owner: 'Chris', sourceRow: 'Existing client came back', email: '', phone: '', note: 'Called again.' },
  ]);
  const rod = withCalls.find((card) => card.name === 'Rod Sim');
  assert.equal(rod.stage, 'contacting');
  assert.equal(rod.owner, 'Chris');
  assert.equal(rod.flags.includes('Not on the Pipeline tab'), true);
  const stratford = withCalls.find((card) => card.caseRef === 'META-31483305');
  assert.equal(stratford.stage, 'fact_find');
  assert.equal(stratford.callNotes[0].sourceRow.includes('META-31483305'), true);
  const bromet = withCalls.find((card) => card.caseRef === 'PC-026');
  assert.equal(bromet.stage, 'parked');
  assert.equal(bromet.callNotes[0].owner, 'Chris');
  assert.equal(bromet.owner, 'Chris');
});

test('pipeline CSV import uses case_id and does not require a sheet write', () => {
  const csv = 'case_id,borrower_name,status,owner_sales,next_step\nPOSFIN.26.0115,Elliot Hill,COMPLETED,Chris,Check the file\n';
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
