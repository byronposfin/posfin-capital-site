import { readFileSync } from 'node:fs';
import { textBlocked } from './broka.js';

const templatePath = new URL('../templates/broka-lender-outreach.txt', import.meta.url);

export function loadOutreachTemplate() {
  return readFileSync(templatePath, 'utf8');
}

export function postcodeDistrict(value) {
  const match = String(value || '').toUpperCase().match(/[A-Z]{1,2}\d[A-Z\d]?/);
  return match ? match[0] : '';
}

function clean(value, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (textBlocked(text)) return '[removed]';
  return text;
}

export function renderOutreach(fields, template = loadOutreachTemplate()) {
  const values = {
    case_ref: clean(fields.caseRef, 'UNKNOWN'),
    lender_name: clean(fields.lender, 'UNKNOWN'),
    contact: clean(fields.contact, 'UNKNOWN'),
    regulated: fields.regulated === true ? 'Yes' : fields.regulated === false ? 'No' : 'Not set',
    postcode_district: clean(fields.district, 'UNKNOWN'),
    loan_label: clean(fields.loan, 'UNKNOWN'),
  };
  let text = String(template || '');
  for (const [key, value] of Object.entries(values)) text = text.replaceAll(`{{${key}}}`, value);
  text = text.replace(/\{\{[a-z0-9_]+\}\}/gi, 'UNKNOWN');
  return text;
}
