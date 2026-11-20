// Read-only importer. Prints stage counts. Does not write to Supabase or Sheets.
// node scripts/import-pipeline-csv.mjs
// node scripts/import-pipeline-csv.mjs path/to/pipeline.csv
// node scripts/import-pipeline-csv.mjs --pipeline data/pipeline-tab-20261120.csv --clean data/pipeline-clean-20261120.csv --calls data/calls-20261120.csv
import { readFileSync } from 'node:fs';
import {
  attachCallsExport, buildCases, filterOwner, groupColumns, loadCrmBoard, loadMasterIndex, mergeCrmCards, parseCallsExport, parsePipelineCsv,
} from '../lib/pipeline.js';

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function countsFor(cards) {
  const board = groupColumns(cards);
  const counts = Object.fromEntries(board.columns.map((column) => [column.title, column.cards.length]));
  counts['Parked / Declined'] = board.parked.length;
  counts.Completed = board.completed.length;
  return counts;
}

const single = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
if (single) {
  const cards = parsePipelineCsv(readFileSync(single, 'utf8'));
  console.log(JSON.stringify({ file: single, rows: cards.length, counts: countsFor(cards) }, null, 2));
} else {
  const pipelinePath = option('--pipeline') || new URL('../data/pipeline-tab-20261120.csv', import.meta.url);
  const cleanPath = option('--clean') || new URL('../data/pipeline-clean-20261120.csv', import.meta.url);
  const callsPath = option('--calls') || new URL('../data/calls-20261120.csv', import.meta.url);
  const pipeline = parsePipelineCsv(readFileSync(pipelinePath, 'utf8'));
  const clean = parsePipelineCsv(readFileSync(cleanPath, 'utf8'));
  const calls = parseCallsExport(readFileSync(callsPath, 'utf8'));
  const cards = option('--pipeline') || option('--clean') || option('--calls')
    ? attachCallsExport(mergeCrmCards(mergeCrmCards(buildCases(loadMasterIndex()), pipeline), clean), calls)
    : loadCrmBoard();
  const chris = filterOwner(cards, 'Chris');
  console.log(JSON.stringify({
    pipelineRows: pipeline.length,
    cleanRows: clean.length,
    callRows: calls.length,
    matchedCalls: calls.filter((call) => call.caseRef).length,
    cards: cards.length,
    counts: countsFor(cards),
    chris: countsFor(chris),
  }, null, 2));
}
