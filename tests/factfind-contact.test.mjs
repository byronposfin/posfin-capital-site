import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate } from '../lib/ff-schema.js';
import { validateLand } from '../lib/ff-land.js';
import { dobError, ukMobileError } from '../lib/ff-uk.js';
import { looksLikeTestLead } from '../lib/ff-test-lead.js';
import { DOB_HEADERS, SHEET_HEADERS, sheetHeaderMode, sheetRow } from '../lib/lead-sheet.js';
import { applicantReplyMessage, staffAlertMessage } from '../lib/lead-notify.js';
import { productionAlert } from '../lib/ff-alert-outbox.js';

const now = new Date('2026-11-21T12:00:00Z');
const adult = {
  full_name: 'Alex Example', phone: '07700900123', email: 'alex@example.com',
  ownership: 'Personal name — sole owner', asset_type: 'Residential', applicant_dob: '1980-04-02',
  property_experience: '1 property', security_postcode: 'SW1A 1AA', property_value: '500000',
  bedrooms: '2', rental_status: 'Not let', loan_amount: '200000', purpose: 'Property purchase',
  timescale: 'Within a month', charge_position: 'First charge — replacing/clearing the current lender',
  first_charge_lender: 'NONE', redemption_structure: 'Not sure — discuss on call',
  legal_buffer: '0', contingency_buffer: '0', panel_solicitor_opt_in: 'Not sure — discuss on call',
  credit_profile: 'Excellent — clean credit history', contact_consent: true,
};

test('a UK mobile is required and accepts 07 and +44', () => {
  for (const phone of ['07700900123', '07700 900123', '+44 7700 900123', '+447700900123', '00447700900123']) {
    assert.equal(ukMobileError(phone), '');
    assert.equal(validate({ ...adult, phone }, true, false).errors.phone, undefined);
  }
  assert.match(validate({ ...adult, phone: '' }, true, false).errors.phone, /Required/);
  assert.match(validate({ ...adult, phone: '02079460000' }, true, false).errors.phone, /07 or \+44/);
  assert.match(validate({ ...adult, phone: '12345' }, true, false).errors.phone, /07 or \+44/);
});

test('date of birth is a real past date and the applicant is 18 or over', () => {
  assert.equal(dobError('1980-04-02', now), '');
  assert.equal(dobError('2008-11-21', now), '');
  assert.match(dobError('2008-11-22', now), /18 or over/);
  assert.match(dobError('2020-02-31', now), /real date/);
  assert.match(dobError('2023-02-29', now), /real date/);
  assert.match(dobError('2026-11-22', now), /real date/);
  assert.match(validate({ ...adult, applicant_dob: '2015-06-01' }, true, false).errors.applicant_dob, /18 or over/);
  const joint = validate({ ...adult, ownership: 'Joint with spouse or partner', applicant_2_dob: '1982-06-01' }, true, false);
  assert.equal(joint.errors.applicant_2_dob, undefined);
  assert.equal(joint.clean.applicant_2_dob, '1982-06-01');
  const dropped = validate({ ...adult, ownership: 'Personal name — sole owner', applicant_2_dob: '1982-06-01' }, true, false);
  assert.equal(dropped.clean.applicant_2_dob, undefined);
});

test('a TEST name is still detected when phone and date of birth are ordinary', () => {
  assert.equal(looksLikeTestLead({ ...adult, full_name: 'Alex TEST' }), true);
  assert.equal(looksLikeTestLead(adult), false);
});

test('land keeps the existing mobile and requires a date of birth', () => {
  const land = { asset_type: 'Land', phone: '+44 7700 900123', applicant_dob: '1980-04-02', email: 'a@b.co', property_value: 200000, loan_amount: 1 };
  assert.equal(validateLand(land, true).errors.phone, undefined);
  assert.equal(validateLand(land, true).errors.applicant_dob, undefined);
  assert.match(validateLand({ ...land, phone: '020 7946 0000' }, true).errors.phone, /07 or \+44/);
  assert.match(validateLand({ ...land, applicant_dob: '2010-01-01' }, true).errors.applicant_dob, /18 or over/);
});

test('staff alerts and the extended lead sheet carry phone and date of birth; the applicant reply does not', () => {
  const lead = { reference: 'POSFIN-WEB-ABC234', full_name: 'Alex Example', email: 'alex@example.com', phone: '07700900123', applicant_dob: '1980-04-02', joint_applicant_dob: '1982-06-01', contact_consent: true, ai_call_consent: false };
  const staff = staffAlertMessage(lead).text;
  assert.match(staff, /Phone: 07700900123/);
  assert.match(staff, /Date of birth: 02\/04\/1980/);
  assert.match(staff, /Joint date of birth: 01\/06\/1982/);
  const reply = applicantReplyMessage(lead);
  assert.doesNotMatch(reply.text, /1980|date of birth/i);
  assert.doesNotMatch(reply.html, /1980/);
  const telegram = productionAlert('POSFIN-WEB-ABC234', { phone: '07700900123', dob: '1980-04-02', joint: '' });
  assert.match(telegram, /Phone: 07700900123/);
  assert.match(telegram, /Date of birth: 02\/04\/1980/);
  assert.doesNotMatch(telegram, /Joint date of birth/);
  assert.match(productionAlert('POSFIN-WEB-ABC234', null), /main CRM/);
  assert.doesNotMatch(productionAlert('POSFIN-WEB-ABC234', null), /Date of birth/);
  const extended = sheetRow({ lead_id: '11111111-1111-4111-8111-111111111111', phone: '07700900123', applicant_dob: '1980-04-02', joint_applicant_dob: '1982-06-01', contact_consent: true, ai_call_consent: true }, 'extended');
  assert.equal(extended[4], '07700900123');
  assert.deepEqual(extended.slice(-2), ['1980-04-02', '1982-06-01']);
  assert.equal(sheetRow({ lead_id: 'x', contact_consent: false, ai_call_consent: true }).length, SHEET_HEADERS.length);
  assert.equal(sheetHeaderMode([...SHEET_HEADERS, '', '']), 'core');
  assert.equal(sheetHeaderMode([...SHEET_HEADERS, ...DOB_HEADERS]), 'extended');
  assert.equal(sheetHeaderMode(['Nope']), '');
});

test('the contact migration only adds columns, readers and a trigger', () => {
  const sql = readFileSync(new URL('../sql/20261121_factfind_phone_dob.sql', import.meta.url), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /add column if not exists applicant_dob/);
  assert.match(sql, /add column if not exists joint_applicant_dob/);
  assert.match(sql, /staff_new_web_leads_v3/);
  assert.match(sql, /staff_new_web_leads_service_v2/);
  assert.match(sql, /grant execute on function public\.staff_new_web_leads_v3\(boolean\) to authenticated/);
  assert.match(sql, /grant execute on function public\.staff_new_web_leads_service_v2\(boolean\) to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.staff_new_web_leads_v3\(boolean\) to anon/);
  assert.doesNotMatch(sql, /drop table|truncate|delete from|drop column|drop function/i);
  const page = readFileSync(new URL('../fact-find.js', import.meta.url), 'utf8');
  assert.match(page, /Date of birth/);
  assert.match(page, /data-dob="\$\{k\}"/);
  assert.match(page, /ac:"tel"/);
  assert.doesNotMatch(page, /console\.(log|info|debug).*dob|console\.(log|info|debug).*applicant_dob/i);
});
