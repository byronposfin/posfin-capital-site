// Read-only importer. Prints stage counts. Does not write to Supabase or Sheets.
// Usage: node scripts/import-pipeline-csv.mjs path/to/pipeline.csv
import { readFileSync } from 'node:fs';
import { groupColumns, parsePipelineCsv } from '../lib/pipeline.js';

const file = process.argv[2];
if (!file) {
  console.error('Pass a CSV with headers case_id,borrower_name,status,owner_sales,next_step');
  process.exit(1);
}
const cards = parsePipelineCsv(readFileSync(file, 'utf8'));
const board = groupColumns(cards);
const counts = Object.fromEntries(board.columns.map((column) => [column.id, column.cards.length]));
counts.parked = board.parked.length;
counts.completed = board.completed.length;
console.log(JSON.stringify({ rows: cards.length, counts }, null, 2));
