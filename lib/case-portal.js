// Smart link case model. Client copy is assembled here.
// Known case facts come from the database. This file does not name a client or a lender.

export const GAPS = [
  {
    id: 'solicitor',
    priority: 10,
    kyc: false,
    title: 'Solicitor',
    options: ['I have a solicitor', "I don't have a solicitor yet", 'Please talk me through instructing one'],
    question: () => 'Do you have a solicitor acting for you? If you do, tell us their name and firm. If you do not, say so. The court date is close, so this is the first thing we need.',
  },
  {
    id: 'court_papers',
    priority: 20,
    kyc: false,
    title: 'Court papers',
    question: () => 'Please send a clear copy of the possession order, the warrant and the N54 eviction notice. A photo of each page is enough.',
  },
  {
    id: 'redemption',
    priority: 30,
    kyc: false,
    title: 'Redemption figure',
    question: () => 'What is the figure to clear the existing first charge, and on what date did that facility expire?',
  },
  {
    id: 'occupancy',
    priority: 40,
    kyc: false,
    title: 'Who lives there',
    options: ['Yes, it is my home', "No, I don't live there", "I'd rather explain"],
    question: () => 'Is this property your home, and who lives there? Please include anyone aged 17 or over.',
  },
  {
    id: 'exit',
    priority: 50,
    kyc: false,
    title: 'Exit plan',
    options: ['Sale of this property', 'Refinance', 'Sale of another asset', "Other / I'll explain"],
    question: () => 'How do you plan to repay this borrowing? For example a sale, a refinance, or something else.',
  },
  {
    id: 'property',
    priority: 60,
    kyc: false,
    title: 'Property',
    question: (facts) => {
      const floor = facts && facts.epc_floor_m2;
      const near = facts && facts.neighbour_floor;
      const extra = floor && near
        ? ` The energy performance certificate shows ${floor} square metres, while similar houses nearby are about ${near} square metres. Please explain that difference.`
        : '';
      return `Please describe the property and send photos of the outside, the inside and any extensions.${extra}`;
    },
  },
  {
    id: 'kyc_id',
    priority: 70,
    kyc: true,
    title: 'Photo ID',
    question: () => 'Please send a photo of your passport or driving licence. For a licence, include the front and the back.',
  },
  {
    id: 'kyc_poa',
    priority: 80,
    kyc: true,
    title: 'Proof of address',
    question: () => 'Please send proof of address dated within the last 3 months. A utility bill, a council tax bill, or a bank or card statement is fine. A photo is enough.',
  },
  {
    id: 'kyc_credit',
    priority: 90,
    kyc: true,
    title: 'Credit report',
    options: ['Experian', 'Check My File'],
    question: () => 'Please send a credit report from Experian or Check My File, dated within the last 3 months. A PDF, or clear photos of every page, is fine.',
  },
  {
    id: 'income',
    priority: 100,
    kyc: false,
    title: 'Income and statements',
    question: () => 'Please tell us about your income, and attach recent statements. A voice note is fine if that is easier.',
  },
  {
    id: 'debts',
    priority: 110,
    kyc: false,
    title: 'Other debts',
    question: () => 'Are there any other debts, county court judgments or arrangements we should know about? If there are none, say none.',
  },
  {
    id: 'insurance',
    priority: 120,
    kyc: false,
    title: 'Buildings insurance',
    options: ['Yes, it is insured', 'No, it is not insured', "I'm not sure"],
    question: () => 'Is there buildings insurance on the property? If there is, send the schedule or a photo of it. If there is not, say so.',
  },
];

export const CLIENT_FACT_KEYS = [
  'reference', 'property_address', 'postcode', 'client_value', 'desktop_low', 'desktop_high',
  'comparables_floor', 'loan_amount', 'equity_known', 'sole_name', 'claim_ref', 'warrant_ref',
  'warrant_date', 'eviction_at', 'facility_ended', 'epc_floor_m2', 'neighbour_floor',
  'epc_rating', 'property_type', 'comparables', 'ask_client', 'offer_issued', 'lender_name',
];

const GAP_IDS = new Set(GAPS.map((gap) => gap.id));
const AUDIO = new Set(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/aac', 'video/webm']);
const IMAGE = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const FILE_MIME = new Set([...AUDIO, ...IMAGE, 'application/pdf']);

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return '£' + Math.round(n).toLocaleString('en-GB');
}

export function ltv(loan, value) {
  const l = Number(loan);
  const v = Number(value);
  if (!l || !v) return null;
  return Math.round((l / v) * 1000) / 10;
}

export function ukDate(iso) {
  if (!iso) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'Europe/London', hourCycle: 'h12',
  }).format(date);
}

export function ukStamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
}

export function tokenOk(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export function presentFacts(facts) {
  const source = facts && typeof facts === 'object' ? facts : {};
  const out = {};
  for (const key of CLIENT_FACT_KEYS) {
    if (source[key] != null && source[key] !== '') out[key] = source[key];
  }
  if (Array.isArray(out.comparables)) {
    out.comparables = out.comparables.slice(0, 12).map((row) => ({
      address: String(row.address || '').slice(0, 160),
      sold: String(row.sold || '').slice(0, 40),
      indexed: Number(row.indexed) || null,
    }));
  }
  const terms = lineItems(source.terms);
  const useOfFunds = lineItems(source.use_of_funds);
  if (terms.length) out.terms = terms;
  if (useOfFunds.length) out.use_of_funds = useOfFunds;
  return out;
}

function lineItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((row) => ({
    label: String(row && row.label || '').slice(0, 180),
    value: String(row && row.value || '').slice(0, 600),
  })).filter((row) => row.label && row.value);
}

export function asksClient(facts) {
  return !facts || facts.ask_client !== false;
}

export function staffItems(broker) {
  const rows = broker && Array.isArray(broker.staff_items) ? broker.staff_items : [];
  return rows.slice(0, 40).map((row) => ({
    title: String(row && row.title || '').slice(0, 200),
    detail: String(row && row.detail || '').slice(0, 1000),
  })).filter((row) => row.title);
}

export function basicsKnown(facts) {
  const value = Number(facts && facts.client_value);
  const loan = Number(facts && facts.loan_amount);
  return value > 0 && loan > 0 && facts.equity_known === true;
}

export function resolveStage(facts, override) {
  if (override === 'applied') return 'applied';
  if (override === 'gathering') return 'gathering';
  if (basicsKnown(facts)) return 'terms';
  return 'gathering';
}

export function baseMime(mime) {
  return String(mime || '').split(';')[0].trim().toLowerCase();
}

function mimeAllowed(kind, mime) {
  const base = baseMime(mime);
  if (kind === 'voice') return AUDIO.has(base);
  if (kind === 'photo') return IMAGE.has(base);
  if (kind === 'file') return FILE_MIME.has(base);
  return false;
}

export function validateSubmission(input) {
  const gapId = input.gapId == null || input.gapId === '' ? null : String(input.gapId);
  if (gapId && !GAP_IDS.has(gapId)) return { error: 'bad_gap' };
  const gap = gapId ? GAPS.find((item) => item.id === gapId) : null;
  const text = String(input.text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 4000);
  let choice = String(input.choice || '').trim().slice(0, 200);
  if (choice && gap && gap.options && !gap.options.includes(choice)) return { error: 'bad_choice' };
  if (choice && !gap) choice = '';
  const file = input.file && input.file.bytes && input.file.bytes.length ? input.file : null;
  let kind = String(input.kind || '');
  if (file) {
    if (!['voice', 'file', 'photo'].includes(kind)) kind = baseMime(file.mime).startsWith('audio/') || baseMime(file.mime) === 'video/webm' ? 'voice' : 'file';
    if (!mimeAllowed(kind, file.mime)) return { error: 'bad_file' };
    if (file.bytes.length > 4194304) return { error: 'too_large' };
  } else if (choice) kind = 'choice';
  else kind = 'text';
  if (!file && kind === 'text' && !text) return { error: 'empty' };
  if (!file && kind === 'choice' && !choice) return { error: 'empty' };
  const clientRef = String(input.clientRef || '').trim();
  if (clientRef && !/^[A-Za-z0-9_-]{8,80}$/.test(clientRef)) return { error: 'bad_ref' };
  return { gapId, kind, text, choice, file, clientRef: clientRef || null };
}

function answerLine(submission) {
  return [submission.choice, submission.text, submission.filename].filter(Boolean).join(' — ');
}

export function buildModel(record, options = {}) {
  const facts = presentFacts(record && record.facts);
  const stage = resolveStage(facts, record && record.stage);
  const submissions = Array.isArray(record && record.submissions) ? record.submissions : [];
  const byGap = new Map(GAPS.map((gap) => [gap.id, []]));
  const general = [];
  for (const row of submissions) {
    const item = {
      id: String(row.id || ''),
      gapId: row.gap_id || null,
      kind: row.kind,
      text: row.text || '',
      choice: row.choice || '',
      filename: row.filename || '',
      mime: row.mime || '',
      bytes: Number(row.bytes) || 0,
      createdAt: row.created_at,
      line: answerLine({ choice: row.choice, text: row.text, filename: row.filename }),
    };
    if (item.gapId && byGap.has(item.gapId)) byGap.get(item.gapId).push(item);
    else general.push(item);
  }
  const urgentStage = stage === 'terms' || stage === 'applied';
  const gaps = asksClient(facts) ? GAPS.map((gap) => {
    const rows = byGap.get(gap.id);
    const open = rows.length === 0;
    return {
      ...gap,
      question: gap.question(facts),
      open,
      urgent: open && urgentStage,
      rows,
      latest: rows.length ? rows[rows.length - 1].line : '',
    };
  }) : [];
  const openCount = gaps.filter((gap) => gap.open).length;
  return {
    caseId: record && record.case_id || '',
    clientName: String(record && record.client_name || 'Your case').slice(0, 120),
    facts,
    stage,
    gaps,
    general,
    openCount,
    total: gaps.length,
    doneCount: gaps.length - openCount,
    highlightId: options.highlightId ? String(options.highlightId) : '',
  };
}

export function openCountFromAnswered(answeredIds) {
  const answered = new Set(answeredIds || []);
  return GAPS.filter((gap) => !answered.has(gap.id)).length;
}

export const STAGE_LABEL = {
  gathering: 'Gathering info',
  terms: 'Getting terms',
  applied: 'Applied',
};
