// Staff and applicant copy. The applicant message is a draft until Byron approves it.
// Posfin is a credit broker. These messages do not offer or approve finance.

function clean(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
}

export function firstName(fullName) {
  const part = clean(fullName, 80).split(/\s+/)[0] || '';
  if (!part || part.includes('@') || part.length > 40) return 'there';
  return part;
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

function flags(lead) {
  const lines = [];
  if (lead.is_test === true) lines.push('SYNTHETIC TEST — DO NOT CONTACT THE APPLICANT.');
  if (lead.no_chase === true) lines.push('DO NOT CHASE. This record is marked no-chase.');
  if (lead.contact_consent !== true) lines.push('NO CONTACT CONSENT. Do not phone, email, or message the applicant.');
  if (lead.ai_call_consent !== true) lines.push('NO AI-CALL CONSENT. Do not use an automated or AI caller.');
  else lines.push('AI-call consent is yes. This system still does not place the call.');
  return lines;
}

function contactBlock(lead) {
  const owner = clean(lead.owner_name, 80) || 'Unassigned';
  const ownerEmail = clean(lead.owner_email, 120);
  return [
    `Reference: ${clean(lead.reference, 40)}`,
    `Owner: ${owner}${ownerEmail ? ` (${ownerEmail})` : ' (no email on the seat yet)'}`,
    `Name: ${clean(lead.full_name, 100) || '—'}`,
    `Email: ${clean(lead.email, 120) || '—'}`,
    `Phone: ${clean(lead.phone, 30) || '—'}`,
    lead.purpose ? `Purpose: ${clean(lead.purpose, 120)}` : '',
    money(lead.loan_amount) ? `Loan amount asked: ${money(lead.loan_amount)}` : '',
    money(lead.property_value) ? `Property value stated: ${money(lead.property_value)}` : '',
    lead.utm_source ? `UTM source: ${clean(lead.utm_source, 100)}` : '',
    lead.utm_medium ? `UTM medium: ${clean(lead.utm_medium, 100)}` : '',
    lead.utm_campaign ? `UTM campaign: ${clean(lead.utm_campaign, 150)}` : '',
    lead.utm_content ? `UTM content: ${clean(lead.utm_content, 150)}` : '',
  ].filter(Boolean);
}

export function staffAlertMessage(lead) {
  const ref = clean(lead.reference, 40);
  const owner = clean(lead.owner_name, 80) || 'Unassigned';
  const prefixes = [];
  if (lead.is_test === true) prefixes.push('TEST');
  if (lead.no_chase === true) prefixes.push('DO NOT CHASE');
  if (lead.contact_consent !== true) prefixes.push('NO CONTACT CONSENT');
  const subject = `${prefixes.length ? prefixes.join(' · ') + ' — ' : ''}New fact find ${ref} — owner ${owner}`;
  const text = [
    ...flags(lead),
    '',
    `New fact find ${ref}.`,
    ...contactBlock(lead),
    '',
    'Contact the applicant only when contact consent is yes and no-chase is no.',
    'Posfin Capital is the credit broker, not the lender. This alert is not a lending decision.',
    'Open the new-leads lane: https://posfincapital.com/staff/new-leads',
    'CRM: https://admin.posfincapital.com/leads',
  ].join('\n');
  return { subject, text };
}

export function applicantReplyMessage(lead) {
  const ref = clean(lead.reference, 40);
  const subject = `DRAFT — not approved — We have your enquiry ${ref}`;
  const text = [
    'DRAFT — not approved. Byron must approve this wording before it is sent to an applicant.',
    '',
    `Hello ${firstName(lead.full_name)},`,
    '',
    'Thank you for sending your enquiry to Posfin Capital. Posfin Capital is an FCA-authorised credit broker, FRN 913022, and an NACFB member. We are a broker, not a lender.',
    '',
    `Your reference is ${ref}. A person on the team will review what you sent.`,
    '',
    'This email is not a loan offer, an approval, or a promise of any rate. Nothing in this message means that finance will be offered, or that any lender has agreed terms. Any introduction is subject to checks and the lender\'s own decision.',
    '',
    'If you did not send this enquiry, or you do not want us to contact you, reply to this email and we will stop.',
    '',
    'Posfin Capital',
    'FCA-authorised credit broker (FRN 913022). NACFB member. Not a lender.',
    '96 Kensington High Street, London W8 4SG.',
    'Privacy notice: https://posfincapital.com/privacy-policy',
  ].join('\n');
  return { subject, text };
}

export function slaEscalationMessage(lead) {
  const ref = clean(lead.reference, 40);
  const owner = clean(lead.owner_name, 80) || 'Unassigned';
  const subject = `${lead.is_test === true ? 'TEST — ' : ''}SLA: ${ref} not contacted — owner ${owner}`;
  const text = [
    ...flags(lead),
    '',
    `${ref} was still uncontacted 15 minutes after submission inside Monday–Friday 09:00–18:00 Europe/London.`,
    'The clock does not run on Saturday or Sunday. Time after 18:00 waits until 09:00 the next weekday.',
    `Owner: ${owner}. Please take it or reassign it.`,
    ...contactBlock(lead),
    '',
    'This escalation does not place a call. Do not use an automated caller unless AI-call consent is yes.',
    'Posfin Capital is the credit broker, not the lender.',
    'https://posfincapital.com/staff/new-leads',
  ].join('\n');
  return { subject, text };
}

export function deliveryAlarmMessage(lead) {
  const ref = clean(lead.reference, 40);
  const subject = `ALARM: fact-find alert unsent for ${ref}`;
  const text = [
    `The ${clean(lead.about_kind, 40) || 'staff'} email for ${ref} was still unsent after 2 minutes.`,
    `State: ${clean(lead.about_state, 40) || 'unknown'}.`,
    lead.about_error ? `Last result: ${clean(lead.about_error, 80)}.` : '',
    'The original send will be retried. This alarm is so the lead is not missed.',
    '',
    ...flags(lead),
    '',
    ...contactBlock(lead),
    '',
    'Posfin Capital is the credit broker, not the lender.',
  ].filter((line) => line !== '').join('\n');
  return { subject, text };
}

export function messageFor(row) {
  const lead = row && row.payload ? row.payload : {};
  if (row.kind === 'staff_alert') return staffAlertMessage(lead);
  if (row.kind === 'applicant_reply') return applicantReplyMessage(lead);
  if (row.kind === 'sla_escalation') return slaEscalationMessage(lead);
  if (row.kind === 'delivery_alarm') return deliveryAlarmMessage(lead);
  return null;
}

function sameEmail(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

export function deliveryDecision(row, cfg) {
  const lead = row.payload || {};
  const message = messageFor(row);
  if (!message) return { suppress: true, reason: 'invalid_kind' };
  if (!/^(TEST-WEB-|POSFIN-WEB-)[A-Z2-9]{6}$/.test(String(row.reference || ''))) return { suppress: true, reason: 'invalid_reference' };
  if (!cfg.production && !String(row.reference).startsWith('TEST-WEB-')) return { suppress: true, reason: 'preview_blocked' };
  // Synthetic rows prove the queue. They are not delivered to a person.
  if (String(row.reference).startsWith('TEST-WEB-')) return { suppress: true, reason: 'synthetic', synthetic: true };
  if (row.kind === 'applicant_reply') {
    if (!cfg.autoreply) return { suppress: true, reason: 'autoreply_off' };
    if (lead.no_chase === true) return { suppress: true, reason: 'no_chase' };
    if (lead.contact_consent !== true) return { suppress: true, reason: 'no_consent' };
    if (!sameEmail(row.recipient_email, lead.email)) return { suppress: true, reason: 'recipient_mismatch' };
    if (cfg.autoreplyOnly && !sameEmail(row.recipient_email, cfg.autoreplyOnly)) return { suppress: true, reason: 'autoreply_allowlist' };
    return { suppress: false, message };
  }
  if (cfg.onlyAlert && !sameEmail(row.recipient_email, cfg.onlyAlert)) return { suppress: true, reason: 'alert_allowlist' };
  return { suppress: false, message };
}
