import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate } from '../lib/ff-schema.js';
import { buildBrokaSpine } from '../lib/broka-spine.js';
import { matchCertificate, certificateDetails, lookupEpc } from '../lib/ff-epc.js';

const adult = '1980-04-02';
const base = {
  full_name: 'Byron Hill TEST', phone: '07700900000', email: 'byron.hill@posfincapital.com',
  ownership: 'Personal name — sole owner', asset_type: 'Residential', applicant_dob: adult,
  property_experience: '2–5 properties', security_postcode: 'TN39 3DH', property_value: '400000',
  bedrooms: '3', rental_status: 'Not let', loan_amount: '150000', purpose: 'Refinance / repay existing lender',
  timescale: 'Within a month', charge_position: 'First charge — replacing/clearing the current lender',
  first_charge_lender: 'HALIFAX', redemption_structure: 'Deduct within requested amount',
  legal_buffer: '2000', contingency_buffer: '0', panel_solicitor_opt_in: 'Not sure — discuss on call',
  credit_profile: 'Good — minor historic issues only', contact_consent: true,
};

test('BROKA applicant, experience, bedrooms and rental answers are required', () => {
  const missing = validate({ ...base, applicant_dob: '', property_experience: '', bedrooms: '', rental_status: '' }, true, false);
  assert.equal(missing.errors.applicant_dob, 'Required');
  assert.equal(missing.errors.property_experience, 'Required');
  assert.equal(missing.errors.bedrooms, 'Required');
  assert.equal(missing.errors.rental_status, 'Required');
  const young = validate({ ...base, applicant_dob: '2015-01-01' }, true, false);
  assert.match(young.errors.applicant_dob, /18 or over/);
  const joint = validate({ ...base, ownership: 'Joint with spouse or partner' }, true, false);
  assert.equal(joint.errors.applicant_2_dob, 'Required');
  const letOut = validate({ ...base, rental_status: 'Let' }, true, false);
  assert.match(letOut.errors.rental_income_monthly, /monthly rent/);
  const ok = validate({ ...base, rental_status: 'Let', rental_income_monthly: '1200', ownership: 'Joint with spouse or partner', applicant_2_dob: '1982-06-01' }, true, false);
  assert.equal(ok.errors.applicant_dob, undefined);
  assert.equal(ok.errors.rental_income_monthly, undefined);
  assert.equal(ok.clean.rental_income_monthly, 1200);
  const notLet = validate({ ...base, rental_income_monthly: '900' }, false, false);
  assert.equal(notLet.clean.rental_income_monthly, undefined);
  assert.equal(ok.errors.epc_rating, undefined);
});

test('the case spine carries applicants, experience, bedrooms, rent and EPC', () => {
  const clean = validate({
    ...base, rental_status: 'Let', rental_income_monthly: '950',
    epc_rating: 'C', epc_certificate_number: '0000-0000-0000-0000-0001', epc_registration_date: '2020-05-04',
    epc_floor_area_m2: '86.5', epc_habitable_rooms: '5', epc_lookup_status: 'matched',
  }, true, false).clean;
  assert.deepEqual(buildBrokaSpine(clean), {
    version: 'broka-spine-v1',
    applicants: [{ role: 'applicant', date_of_birth: adult }],
    property_experience: '2–5 properties',
    bedrooms: '3',
    rental: { status: 'Let', monthly_income: 950 },
    epc: { rating: 'C', certificate_number: '0000-0000-0000-0000-0001', registration_date: '2020-05-04', floor_area_m2: 86.5, habitable_rooms: 5, lookup_status: 'matched' },
  });
});

test('EPC matching uses one certificate and reads floor area without treating habitable rooms as bedrooms', () => {
  const rows = [
    { certificateNumber: '1111-1111-1111-1111-1111', addressLine1: '1 Test Road', postTown: 'Bexhill', postcode: 'TN39 3DH', currentEnergyEfficiencyBand: 'C', registrationDate: '2020-05-04' },
    { certificateNumber: '2222-2222-2222-2222-2222', addressLine1: '3 Test Road', postTown: 'Bexhill', postcode: 'TN39 3DH', currentEnergyEfficiencyBand: 'D', registrationDate: '2019-01-01' },
  ];
  assert.equal(matchCertificate('1 Test Road, Bexhill, TN39 3DH', rows).certificateNumber, '1111-1111-1111-1111-1111');
  assert.equal(matchCertificate('Test Road, Bexhill', rows), null);
  assert.deepEqual(certificateDetails({ data: { 'total-floor-area': '86.5', 'number-habitable-rooms': '5' } }), { floorAreaM2: 86.5, habitableRooms: 5, bedrooms: null });
  assert.equal(certificateDetails({ data: { bedrooms: '3' } }).bedrooms, 3);
});

test('a postcode and address are fetched once and then served from the case cache', async () => {
  const calls = [];
  const cache = new Map();
  const fetcher = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/api/domestic/search')) {
      return { ok: true, status: 200, json: async () => ({ data: [{ certificateNumber: '1111-1111-1111-1111-1111', addressLine1: '1 Test Road', postcode: 'TN39 3DH', currentEnergyEfficiencyBand: 'C', registrationDate: '2020-05-04T00:00:00Z' }] }) };
    }
    return { ok: true, status: 200, json: async () => ({ data: { 'total-floor-area': '90', 'number-habitable-rooms': '4' } }) };
  };
  const first = await lookupEpc({ postcode: 'TN39 3DH', address: '1 Test Road', apiKey: 'token', fetcher, cache, now: 1 });
  const second = await lookupEpc({ postcode: 'tn39 3dh', address: '1 test road', apiKey: 'token', fetcher, cache, now: 2 });
  assert.equal(first.status, 'matched');
  assert.equal(first.epc.rating, 'C');
  assert.equal(first.epc.floorAreaM2, 90);
  assert.equal(first.epc.habitableRooms, 4);
  assert.equal(first.epc.bedrooms, null);
  assert.equal(second.cached, true);
  assert.equal(calls.length, 2);
  const bare = await lookupEpc({ postcode: 'TN39 3DH', address: '1 Test Road', apiKey: '', fetcher, cache: new Map() });
  assert.equal(bare.status, 'not_configured');
  assert.equal(calls.length, 2);
});

test('the BROKA migration only adds columns and a trigger', () => {
  const sql = readFileSync(new URL('../sql/20261121_broka_factfind_fields.sql', import.meta.url), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /broka_case_spine/);
  assert.match(sql, /applicant_dob/);
  assert.match(sql, /epc_floor_area_m2/);
  assert.doesNotMatch(sql, /drop table|truncate|delete from|drop column/i);
});
