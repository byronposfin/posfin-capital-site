import { checkEngagementLetter, checkLenderCopy, formatPounds } from './el-lor-check.js';

function feeLine(money) {
  if (money && money.fee_confirmed && money.fee_text) return String(money.fee_text);
  return '[FOR BYRON TO CONFIRM]';
}

export function buildEngagementLetter(row, extra = '') {
  const money = row.money || {};
  const signatories = row.signatories || [];
  const signatures = signatories.map((signer, index) => [
    `<tr><th>Signature</th><td>${signer.name}</td></tr>`,
    `<tr><td colspan="2">[sig|req|signer${index + 1}]</td></tr>`,
  ].join('')).join('');
  const body = [
    'DRAFT',
    `Engagement letter ${row.case_ref} version draft`,
    `Product: ${row.product}`,
    `Borrower email: ${row.email}`,
    `Security: ${row.security_label || 'Example security'}`,
    `Postcode: ${row.postcode}`,
    `Gross facility: ${formatPounds(money.gross)}`,
    `Retentions: ${formatPounds(money.retentions || 0)}`,
    `Net release: ${formatPounds(money.net_release)}`,
    `Fee: ${feeLine(money)}`,
    'Completion money is paid by Faster Payments or CHAPS.',
    'Prepared for Byron, Jess, Aadi, Cai, Chris, Tom and Lizzy.',
    'By signing below the parties accept this draft engagement letter.',
    '<table>',
    signatures,
    '</table>',
    String(extra || ''),
  ].join('\n');
  const checked = checkEngagementLetter(body, {
    case_ref: row.case_ref,
    product: row.product,
    signatories,
    gross: money.gross,
    retentions: money.retentions || 0,
    net_release: money.net_release,
    postcode: row.postcode,
    fee_confirmed: money.fee_confirmed === true,
    fee_amount: money.fee_amount,
    fee_text: money.fee_text,
  });
  return { body, checked, fee_line: feeLine(money) };
}

export function buildLenderCopy(row, version, extra = '') {
  const money = row.money || {};
  const body = [
    'DRAFT',
    `Lender copy ${row.case_ref} v${version}`,
    `Product: ${row.product}`,
    `Security: ${row.security_label || 'Example security'}`,
    `Postcode: ${row.postcode}`,
    `Facility requested: ${formatPounds(money.gross)}`,
    'Any completion money is paid by Faster Payments or CHAPS.',
    'This draft asks the lender for terms. Posfin Capital.',
    String(extra || ''),
  ].join('\n');
  const checked = checkLenderCopy(body, row.lender_exclusions || []);
  return { body, checked };
}
