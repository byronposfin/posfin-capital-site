#!/usr/bin/env node
/**
 * Repair Raw Leads rows 408–410 from the 125-answer snapshot.
 *
 * Reads the packed state from the Tom Summary column, unpacks the full answer
 * set, then re-writes the row using header-name-based column mapping —
 * identical to the live saveIntake path in lib/clean-intake.js.
 *
 * DRY RUN by default. Pass --apply to write.
 *
 * Usage:
 *   GOOGLE_SA_B64=... FACTFIND_SHEET_ID=... node scripts/repair-raw-leads.js [--apply] [--rows 408,409,410]
 *
 * Environment:
 *   GOOGLE_SA_B64        — base64-encoded Google service account JSON
 *   FACTFIND_SHEET_ID    — target sheet ID (MUST be staging, never production master)
 */

import { google } from 'googleapis';
import { readTable, unpack, RAW, MASTER } from '../lib/clean-intake.js';

const APPLY = process.argv.includes('--apply');
const rowsArg = process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--rows');
const TARGET_ROWS = (rowsArg || '408,409,410').split(',').map(Number).filter(n => n > 1);

const col = n => { let s = ''; for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };

async function main() {
  const sheetId = process.env.FACTFIND_SHEET_ID;
  if (!sheetId) { console.error('FACTFIND_SHEET_ID is required (must be staging)'); process.exit(1); }
  if (sheetId === MASTER) { console.error('Refusing to run against production master sheet'); process.exit(1); }

  const saB64 = process.env.GOOGLE_SA_B64;
  if (!saB64) { console.error('GOOGLE_SA_B64 is required'); process.exit(1); }
  const credentials = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  const table = await readTable(sheets, sheetId, RAW);
  const h = table.headers;
  const refIdx = h.indexOf('Lead Ref');
  const summaryIdx = h.indexOf('Tom Summary');

  if (refIdx < 0 || summaryIdx < 0) { console.error('Missing required headers: Lead Ref, Tom Summary'); process.exit(1); }

  console.log(`Sheet: ${sheetId}`);
  console.log(`Tab: ${RAW}`);
  console.log(`Headers: ${h.length} columns`);
  console.log(`Rows: ${table.rows.length} data rows`);
  console.log(`Target rows: ${TARGET_ROWS.join(', ')}`);
  console.log(`Mode: ${APPLY ? 'APPLY (will write)' : 'DRY RUN (pass --apply to write)'}`);
  console.log('---');

  for (const rowNum of TARGET_ROWS) {
    const rowIdx = rowNum - 2; // rows are 0-indexed from row 2
    if (rowIdx < 0 || rowIdx >= table.rows.length) {
      console.log(`Row ${rowNum}: OUT OF RANGE (sheet has rows 2–${table.rows.length + 1})`);
      continue;
    }
    const row = table.rows[rowIdx];
    const ref = row[refIdx] || '(empty)';
    const summary = row[summaryIdx] || '';
    const state = unpack(summary);

    console.log(`Row ${rowNum}: ref=${ref}`);
    if (!state) {
      console.log(`  NO PACKED STATE — cannot repair from snapshot`);
      continue;
    }

    const answers = state.answers || {};
    const answerCount = Object.keys(answers).filter(k => answers[k] !== null && answers[k] !== undefined && answers[k] !== '').length;
    console.log(`  Packed state: version=${state.version}, progress=${state.progress}, answers=${answerCount}`);

    // Build the record using the same header-name mapping as clean-intake.js save()
    const phone = v => { let p = String(v || '').replace(/\D/g, ''); return p.startsWith('0') ? '44' + p.slice(1) : p; };
    const record = {
      'Name': `${answers.first_name || ''} ${answers.last_name || ''}`.trim(),
      'Phone': phone(answers.mobile),
      'Email': answers.email || '',
      'Lead Ref': answers.deal_ref || ref,
      'Tom Summary': summary, // preserve the packed state as-is
      '👣 Lead Touch / Progress': state.progress || '',
    };
    if (state.declined) record['Lead Stage'] = 'Below minimum value';

    // Check column alignment: compare what's in the sheet vs what the record says
    let misaligned = 0;
    for (const [header, expected] of Object.entries(record)) {
      if (header === 'Tom Summary') continue; // too large to compare meaningfully
      const colIdx = h.indexOf(header);
      if (colIdx < 0) { console.log(`  WARN: header "${header}" not found in sheet`); continue; }
      const actual = row[colIdx] || '';
      if (String(actual).trim() !== String(expected).trim()) {
        console.log(`  MISALIGNED: "${header}" (col ${col(colIdx)}): sheet="${String(actual).slice(0, 60)}" vs expected="${String(expected).slice(0, 60)}"`);
        misaligned++;
      }
    }

    if (misaligned === 0) {
      console.log(`  ALIGNED — no repair needed`);
      continue;
    }

    console.log(`  ${misaligned} column(s) misaligned`);

    if (APPLY) {
      const data = Object.entries(record)
        .filter(([hdr]) => h.indexOf(hdr) >= 0)
        .map(([hdr, v]) => ({
          range: `'${RAW}'!${col(h.indexOf(hdr))}${rowNum}`,
          values: [[v]]
        }));
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { valueInputOption: 'RAW', data },
      });
      console.log(`  REPAIRED (${data.length} cells written)`);
    } else {
      console.log(`  WOULD REPAIR (dry run)`);
    }
  }

  console.log('---');
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
