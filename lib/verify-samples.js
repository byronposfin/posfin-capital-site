import { SYNTHETIC } from './verify-request.js';

export function factFindAnswers() {
  return {
    full_name: SYNTHETIC.full_name,
    email: SYNTHETIC.email,
    phone: SYNTHETIC.phone,
    ownership: 'Personal name — sole owner',
    asset_type: 'Residential',
    residential_type: 'House',
    security_address: '10 Downing Street',
    security_postcode: 'SW1A 2AA',
    property_value: '500000',
    loan_amount: '100000',
    loan_basis: 'Gross borrowing amount',
    purpose: 'Refinance / repay existing lender',
    timescale: 'Flexible — no immediate pressure',
    charge_position: 'First charge — replacing/clearing the current lender',
    exit_plan: 'Synthetic verification. Do not contact.',
    first_charge_lender: 'Synthetic',
    first_charge_status: 'No mortgage',
    arrears: 'No',
    second_charges: 'No',
    redemption_structure: 'Not sure — discuss on call',
    credit_profile: 'Not sure',
    legal_buffer: 'Not sure',
    contingency_buffer: 'Not sure',
    panel_solicitor_opt_in: 'Not sure — discuss on call',
    contact_consent: true,
    ai_call_consent: false,
    total_properties_owned: 1,
    notes: 'Synthetic verification. Not a borrower.',
  };
}

export function optionsLead(ref) {
  return {
    product: 'main_loan',
    deal_ref: ref,
    first_name: 'Synthetic',
    last_name: 'Verify',
    email: SYNTHETIC.email,
    mobile: SYNTHETIC.phone,
    property_address: '10 Downing Street, SW1A 2AA',
    loan_amount: '100000',
    page_source: 'verify-loop',
  };
}

export function acquisitionLead() {
  return {
    name: SYNTHETIC.full_name,
    email: SYNTHETIC.email,
    phone: SYNTHETIC.phone,
    company: 'Synthetic Verify Ltd',
    type: 'Commercial property',
    ticket: '£1m – £3m',
    target: 'Synthetic verification target',
    other_assets: 'No — standalone acquisition',
    timeline: 'Exploring / early stage',
    brief: 'Synthetic verification. Not a borrower.',
    ack_later: true,
    ack_indicative: true,
    source: 'verify-loop',
  };
}
