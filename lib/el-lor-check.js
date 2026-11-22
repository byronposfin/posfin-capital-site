import { PRODUCTS } from './el-lor-config.js';

const TEAM_MISSPELL = [
  { id: 'artie', pattern: /\bArtie\b/ },
  { id: 'kai', pattern: /\bKai\b/ },
  { id: 'jerry', pattern: /\bJerry\b/ },
];

const FEE_RULES = [
  { id: 'broker_fee', pattern: /broker fee/i },
  { id: 'procuration', pattern: /\bprocuration\b/i },
  { id: 'proc_fee', pattern: /\bproc\b/i },
  { id: 'success_fee', pattern: /success fee/i },
  { id: 'commission', pattern: /\bcommission\b/i },
  { id: 'introducer', pattern: /\bintroducer\b/i },
  { id: 'percent_broker', pattern: /%\s*broker|broker\s*%/i },
];

function fail(id, label) {
  return { id, label };
}

function moneyClose(gross, retentions, fee, net) {
  const left = Number(gross) - Number(retentions) - Number(fee);
  return Number.isFinite(left) && Number.isFinite(Number(net)) && Math.abs(left - Number(net)) <= 1;
}

export function checkEngagementLetter(text, meta = {}) {
  const failures = [];
  const body = String(text || '');
  const signatories = Array.isArray(meta.signatories) ? meta.signatories : [];
  if (!meta.case_ref || !meta.product || !signatories.length || meta.gross == null || meta.net_release == null || !meta.postcode) {
    failures.push(fail('required', 'Required fields are missing.'));
  }
  if (!PRODUCTS.includes(meta.product)) failures.push(fail('product', 'Product must be SOMO, MTF or SUB_LOAN.'));
  const fee = meta.fee_confirmed ? Number(meta.fee_amount || 0) : 0;
  if (!moneyClose(meta.gross, meta.retentions || 0, fee, meta.net_release)) {
    failures.push(fail('net_release', 'Net release is not within £1 of the facility arithmetic.'));
  }
  for (const rule of TEAM_MISSPELL) {
    if (rule.pattern.test(body)) failures.push(fail(rule.id, 'A team name is misspelt.'));
  }
  if (/\bCIFAS\b/i.test(body)) failures.push(fail('cifas', 'A blocked marker is present.'));
  if (/\bBACS\b/i.test(body)) failures.push(fail('bacs', 'Payment wording must be Faster Payments or CHAPS.'));
  if (/internal_private/i.test(body)) failures.push(fail('internal_private', 'An internal marker is present.'));
  if (/Acknowledgement/i.test(body)) failures.push(fail('acknowledgement', 'A blocked heading is present.'));
  if (!body.includes('By signing below')) failures.push(fail('signing_line', 'The signing line is missing.'));
  if (!/\bSignature\b/.test(body)) failures.push(fail('signature_row', 'A Signature row is missing.'));
  if (!body.includes('[sig|req|signer1]')) failures.push(fail('anchor', 'The signer anchor is missing.'));
  if (!/\bDRAFT\b/.test(body)) failures.push(fail('draft_tag', 'The draft tag is missing.'));
  for (const signer of signatories) {
    const name = String(signer.name || '').trim();
    if (!name || !body.includes(name) || !new RegExp(`Signature[\\s\\S]{0,80}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(body)) {
      failures.push(fail('signatories', 'Signatories do not match the signature block.'));
      break;
    }
  }
  if (meta.fee_confirmed) {
    const feeText = String(meta.fee_text || '').trim();
    if (!feeText || !body.includes(feeText)) failures.push(fail('fee_line', 'The confirmed fee line is missing.'));
  } else if (!body.includes('[FOR BYRON TO CONFIRM]')) {
    failures.push(fail('fee_line', 'The fee line must stay unconfirmed.'));
  }
  const netText = formatPounds(meta.net_release);
  if (netText && !body.includes(netText)) failures.push(fail('net_release', 'The net release figure is not on the letter.'));
  return { ok: failures.length === 0, failures };
}

export function lenderExcluded(lender, rules) {
  const name = String(lender?.name || lender || '').trim();
  if (!name) return false;
  for (const rule of rules || []) {
    const banned = String(rule.name || '').trim();
    if (banned && name.toLowerCase() === banned.toLowerCase()) return true;
    for (const abbr of rule.abbreviations || []) {
      const token = String(abbr || '').trim();
      if (!token) continue;
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(name)) return true;
    }
    for (const pattern of rule.patterns || []) {
      const source = String(pattern || '');
      if (!source || source.length > 40) continue;
      try {
        if (new RegExp(source, 'i').test(name)) return true;
      } catch {
        /* a bad pattern never matches */
      }
    }
  }
  return false;
}

export function offeredLenders(lenders, rules) {
  return (lenders || []).filter((lender) => !lenderExcluded(lender, rules));
}

export function checkLenderCopy(text, exclusions = []) {
  const failures = [];
  const body = String(text || '');
  for (const rule of FEE_RULES) {
    if (rule.pattern.test(body)) failures.push(fail(rule.id, 'Fee wording is not allowed on a lender copy.'));
  }
  if (/\bCIFAS\b/i.test(body)) failures.push(fail('cifas', 'A blocked marker is present.'));
  if (/\bKPC\b/.test(body)) failures.push(fail('kpc', 'An investor name is not allowed on a lender copy.'));
  if (/internal_private/i.test(body)) failures.push(fail('internal_private', 'An internal marker is present.'));
  if (/1999[\s\S]{0,80}bank letter|bank letter[\s\S]{0,80}1999/i.test(body)) {
    failures.push(fail('bank_letter_1999', 'A blocked historic letter is present.'));
  }
  if (/\bBACS\b/i.test(body)) failures.push(fail('bacs', 'Payment wording must be Faster Payments or CHAPS.'));
  for (const rule of exclusions || []) {
    const name = String(rule.name || '').trim();
    if (name && body.toLowerCase().includes(name.toLowerCase())) {
      failures.push(fail('excluded_lender', 'An excluded lender is named on the lender copy.'));
      break;
    }
    for (const pattern of rule.patterns || []) {
      const source = String(pattern || '');
      if (!source || source.length > 40) continue;
      try {
        if (new RegExp(source, 'i').test(body)) {
          failures.push(fail('excluded_lender', 'An excluded lender is named on the lender copy.'));
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (!/\bDRAFT\b/.test(body)) failures.push(fail('draft_tag', 'The draft tag is missing.'));
  return { ok: failures.length === 0, failures };
}

export function formatPounds(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function contactLabel(contact) {
  const value = String(contact || '').trim();
  return value || 'UNKNOWN';
}
