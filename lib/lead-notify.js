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

function propertyPhrase(lead) {
  const address = clean(lead.address || lead.security_address, 160);
  const postcode = clean(lead.postcode || lead.security_postcode, 12);
  const place = [address, postcode].filter(Boolean).join(', ');
  return place ? `about ${place}` : 'about your property';
}

function htmlText(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

// Already hosted on the public site. The email links to it and does not attach the file.
export const TEAM_BANNER_URL = 'https://posfincapital.com/posfin-wati-byron-uk-banner-v3-20261101.png';
export const TEAM_BANNER_ALT = 'Posfin Capital. UK property finance.';
// Source file for the portrait: lizzy_approved_teal.jpg, kept under 100KB. Hosted, not attached.
export const LIZZY_PHOTO_URL = 'https://posfincapital.com/lizzy-approved-teal.jpg';
export const LIZZY_PHOTO_ALT = 'Lizzy, Byron’s AI assistant at Posfin Capital.';
export const LIZZY_PHONE_DISPLAY = '07365 587773';
export const LIZZY_PHONE_TEL = '+447365587773';
const FCA_FOOTER = 'Posfin Capital Ltd is authorised and regulated by the Financial Conduct Authority (FRN 913022) and is a member of the NACFB.';

export function applicantReplyMessage(lead) {
  const subject = "We've received your enquiry";
  const hello = `Hello ${firstName(lead.full_name)},`;
  const thanks = `Thank you. We've received your enquiry ${propertyPhrase(lead)}.`;
  const hours = 'Someone from Posfin Capital will be in touch, Monday to Saturday, 09:00 to 18:00 UK time.';
  const question = 'Would you like a quick call with Byron?';
  const sign = ['Lizzy', 'on behalf of Byron Hill', 'Posfin Capital'];
  const text = [hello, '', thanks, '', hours, '', question, '', ...sign, '', FCA_FOOTER].join('\n');
  const html = [
    `<img src="${TEAM_BANNER_URL}" alt="${TEAM_BANNER_ALT}" width="600">`,
    `<p>${htmlText(hello)}</p>`,
    `<p>${htmlText(thanks)}</p>`,
    `<p>${htmlText(hours)}</p>`,
    `<p>${htmlText(question)}</p>`,
    `<p>${sign.map(htmlText).join('<br>')}</p>`,
    `<p>${htmlText(FCA_FOOTER)}</p>`,
  ].join('\n');
  return { subject, text, html };
}

export function isPositiveCallReply(value) {
  const text = String(value || '').toLowerCase().replace(/[^a-z\s']/g, ' ');
  if (!text.trim()) return false;
  if (/\b(no|nope|stop|unsubscribe|not now|don't|do not)\b/.test(text)) return false;
  return /\b(yes|yeah|yep|yup|ok|okay|sure|please|absolutely|definitely|go ahead|call me)\b/.test(text);
}

export function lizzyFollowUpMessage(lead) {
  const name = firstName(lead && lead.full_name);
  const subject = "I'll call you now";
  const hello = `Hi ${name},`;
  const body = "It's Lizzy, Byron's AI assistant. Byron's tied up right now, so I'll give you a quick call straight away to get things moving, and Byron will call you personally after.";
  const ai = 'This call is with Lizzy, an AI assistant, not a person.';
  const button = `Call Lizzy now (${LIZZY_PHONE_DISPLAY})`;
  const text = [hello, '', body, '', ai, '', button, '', FCA_FOOTER].join('\n');
  const html = [
    `<img src="${LIZZY_PHOTO_URL}" alt="${htmlText(LIZZY_PHOTO_ALT)}" width="96">`,
    `<p>${htmlText(hello)}</p>`,
    `<p>${htmlText(body)}</p>`,
    `<p>${htmlText(ai)}</p>`,
    `<p><a href="tel:${LIZZY_PHONE_TEL}">${htmlText(button)}</a></p>`,
    `<p>${htmlText(FCA_FOOTER)}</p>`,
  ].join('\n');
  return { subject, text, html };
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
    if (lead.is_test === true) return { suppress: true, reason: 'is_test', synthetic: true };
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
