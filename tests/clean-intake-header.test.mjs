import test from 'node:test';
import assert from 'node:assert/strict';
import { CLEAN, RAW, saveIntake } from '../lib/clean-intake.js';

const RAW_HEADERS = ['Received', 'Name', 'Phone', 'Email', 'Lead Ref', 'Tom Summary', 'Lead Stage', '👣 Lead Touch / Progress'];

function sheetsFor(cleanHeaders) {
  const tables = { [RAW]: [RAW_HEADERS], [CLEAN]: [cleanHeaders] };
  const appended = [];
  return {
    appended,
    spreadsheets: {
      values: {
        async get({ range }) {
          const tab = range.split('!')[0].replace(/'/g, '');
          return { data: { values: tables[tab] } };
        },
        async append({ range, requestBody }) {
          const tab = range.split('!')[0].replace(/'/g, '');
          tables[tab].push(requestBody.values[0]);
          appended.push({ tab, row: requestBody.values[0] });
          return { data: { updates: { updatedRange: `'${tab}'!A${tables[tab].length}` } } };
        },
        async batchUpdate({ requestBody }) {
          appended.push({ batch: requestBody.data });
          return { data: {} };
        },
      },
    },
  };
}

const submission = {
  first_name: 'Byron',
  last_name: 'Test',
  mobile: '07700900000',
  email: 'byron.hill@posfincapital.com',
  deal_ref: 'POSFIN-HEADER-TEST1',
  property_address: 'TN39 3DH',
  property_value: 400000,
  loan_amount: 150000,
  first_charge_lender: 'Halifax',
  first_charge_balance: 100000,
  first_charge_arrears_amount: 0,
  second_charge_balance: 0,
  second_charge_present: 'no',
  exit_strategy: 'Sale',
  loan_purpose: 'Purchase',
  intake_nonce: 'nonce-1',
};

test('a clean sheet without the stated-value header still saves the main-loan submission', async () => {
  const sheets = sheetsFor(['🔖 Case ID', '📊 Scorecard link', '👤 Borrower', '📧 Email', '📊 Property Value (Stated)', '💷 Net req']);
  const saved = await saveIntake(sheets, 'sheet', submission, 'main_loan', 'https://posfincapital.com/score', () => true);
  assert.equal(saved.ok, true);
  assert.equal(saved.partial, false);
  const clean = sheets.appended.find((item) => item.tab === CLEAN);
  assert.ok(clean);
  const headers = ['🔖 Case ID', '📊 Scorecard link', '👤 Borrower', '📧 Email', '📊 Property Value (Stated)', '💷 Net req'];
  assert.equal(clean.row[headers.indexOf('📊 Property Value (Stated)')], 400000);
  assert.equal(clean.row[headers.indexOf('👤 Borrower')], 'Byron Test');
  assert.equal(clean.row.includes('📊 Stated value'), false);
});

test('a clean sheet with neither stated-value name still returns success', async () => {
  const sheets = sheetsFor(['🔖 Case ID', '📊 Scorecard link', '👤 Borrower', '📧 Email']);
  const saved = await saveIntake(sheets, 'sheet', { ...submission, deal_ref: 'POSFIN-HEADER-TEST2' }, 'main_loan', 'https://posfincapital.com/score', () => true);
  assert.equal(saved.ok, true);
  const clean = sheets.appended.find((item) => item.tab === CLEAN);
  assert.equal(clean.row[2], 'Byron Test');
});
