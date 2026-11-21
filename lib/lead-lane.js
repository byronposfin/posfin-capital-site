import { ageLabel, slaColour } from './lead-sla.js';

export function presentLead(row, now = new Date()) {
  const sla = slaColour(row, now);
  return {
    id: row.id,
    reference: row.reference,
    submittedAt: row.submitted_at,
    age: ageLabel(row.submitted_at, now),
    fullName: row.full_name || '',
    email: row.email || '',
    phone: row.phone || '',
    ownerName: row.owner_name || 'Unassigned',
    ownerEmail: row.owner_email || '',
    seat: row.assigned_seat || '',
    contactedAt: row.contacted_at,
    slaDueAt: row.sla_due_at,
    slaColour: sla.colour,
    slaLabel: sla.label,
    contactConsent: row.contact_consent === true,
    aiCallConsent: row.ai_call_consent === true,
    noChase: row.no_chase === true,
    isTest: row.is_test === true,
    status: row.status || '',
    nextAction: row.next_action || '',
    note: row.staff_note || '',
    consentVersion: row.consent_text_version || '',
  };
}
