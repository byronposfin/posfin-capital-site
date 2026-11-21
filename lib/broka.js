export const ACTIVE_SEATS = [
  { code: 'byron', name: 'Byron Hill', role: 'principal', active: true },
  { code: 'aadi', name: 'Aadi', role: 'case_owner', active: true },
  { code: 'cai', name: 'Cai', role: 'case_owner', active: true },
  { code: 'chris', name: 'Chris Shipton', role: 'case_owner', active: true },
  { code: 'jess', name: 'Jess', role: 'case_owner', active: true },
];

export const REQUIRED_FIELDS = [
  { key: 'date_of_birth', label: 'DOB', aliases: ['dob', 'borrower_dob', 'dateOfBirth'] },
  { key: 'experience', label: 'Experience', aliases: ['developer_experience'] },
  { key: 'bedrooms', label: 'Bedrooms', aliases: ['bedroom_count'] },
  { key: 'rental_income', label: 'Rental income', aliases: ['rent', 'rentalIncome'] },
  { key: 'epc_rating', label: 'EPC', aliases: ['epc', 'epcRating'], lookup: ['epc_lookup', 'epcLookup'] },
];

export const BASELINE_LENDERS = ['Invocap', 'TAB', 'Albatross Lending Group', 'Dantis'];

export const TERM_KEYS = ['rate', 'fee', 'ltv', 'term_months', 'gross', 'net'];

const TEMPLATE_BLOCK = /mt\s*finance|\bdodds\b/i;

export const BLOCK_RULES = [
  { id: 'cifas', label: 'CIFAS', pattern: /\bcifas\b/i },
  { id: 'kpc', label: 'KPC', pattern: /\bkpc\b/i },
  { id: 'internal_private', label: 'internal_private', pattern: /internal_private/i },
  { id: 'barclays_letter', label: 'Barclays letter', pattern: /barclays letter/i },
];

const SUBMITTED_STAGES = new Set([
  'fact_find', 'lor_requested', 'el_issued', 'el_sent', 'el_signed',
  'factfind', 'packaging', 'nda', 'data_room', 'placement', 'terms_received',
  'terms_issued', 'application', 'valuation', 'legals', 'offer',
  'completion_pending', 'post_completion',
]);

export function caseRefOk(value) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(String(value || ''));
}

export function activeSeat(code) {
  return ACTIVE_SEATS.find((seat) => seat.code === String(code || '') && seat.active) || null;
}

export function factFindSubmitted(source) {
  if (!source) return false;
  if (source.factFindSubmitted === true || source.fact_find_submitted === true) return true;
  if (source.submittedAt || source.submitted_at) return true;
  const status = source.factfindStatus || source.factfind_status || source.factFindStatus;
  if (status === 'submitted') return true;
  return SUBMITTED_STAGES.has(String(source.stage || ''));
}

function present(value) {
  if (value === 0) return true;
  return value != null && String(value).trim() !== '';
}

function pick(answers, keys) {
  for (const key of keys) {
    if (present(answers?.[key])) return answers[key];
  }
  return '';
}

export function preflight(answers = {}, regulated) {
  const source = answers && typeof answers === 'object' ? answers : {};
  const fields = REQUIRED_FIELDS.map((field) => {
    const direct = pick(source, [field.key, ...(field.aliases || [])]);
    if (present(direct)) {
      return { key: field.key, label: field.label, missing: false, value: String(direct), source: 'factfind' };
    }
    const looked = pick(source, field.lookup || []);
    if (present(looked)) {
      return { key: field.key, label: field.label, missing: false, value: String(looked), source: 'epc_lookup' };
    }
    return { key: field.key, label: field.label, missing: true, value: '', source: '' };
  });
  const blob = JSON.stringify(source);
  const blocks = BLOCK_RULES.filter((rule) => rule.pattern.test(blob)).map((rule) => ({ id: rule.id, label: rule.label }));
  let regulatedValue = null;
  if (regulated === true || regulated === 'yes' || regulated === 'true') regulatedValue = true;
  else if (regulated === false || regulated === 'no' || regulated === 'false') regulatedValue = false;
  else if (present(source.regulated) || present(source.is_regulated)) {
    const raw = present(source.regulated) ? source.regulated : source.is_regulated;
    regulatedValue = raw === true || raw === 'yes' || raw === 'true';
  }
  return {
    fields,
    missing: fields.filter((field) => field.missing).map((field) => field.label),
    blocks,
    regulated: regulatedValue,
  };
}

export function statusChips({ submitted, control, job, regulated, blocks }) {
  const paused = !!(control && control.paused);
  const standing = !!(control && control.standingApproval);
  return [
    { id: 'factfind', label: submitted ? 'Fact find submitted' : 'Fact find not submitted', tone: submitted ? 'ok' : 'stop' },
    { id: 'standing', label: paused ? 'Searches paused' : standing ? 'Standing approval' : 'No standing approval', tone: paused ? 'wait' : standing ? 'ok' : 'wait' },
    { id: 'job', label: !job ? 'No BROKA job' : job.status === 'approved' ? 'Job approved' : 'Job awaiting approval', tone: job && job.status === 'approved' ? 'ok' : 'wait' },
    { id: 'regulated', label: regulated === true ? 'Regulated' : regulated === false ? 'Not regulated' : 'Regulated not set', tone: regulated == null ? 'wait' : 'plain' },
    { id: 'blocklist', label: blocks && blocks.length ? `Blocklist: ${blocks.map((item) => item.label).join(', ')}` : 'Blocklist clear', tone: blocks && blocks.length ? 'stop' : 'ok' },
  ];
}

export const PREVIEW_CASES = {
  'PREVIEW-NORTHGATE': {
    caseRef: 'PREVIEW-NORTHGATE',
    title: 'Northgate — example terms pack',
    stage: 'fact_find',
    factFindSubmitted: true,
    brokaCaseId: 'BK-PREVIEW-NORTH',
    answers: {
      date_of_birth: '1980-01-02',
      experience: 'Three prior bridges, example only',
      epc_lookup: 'C',
      security_postcode: 'SW1A 1AA',
      loan_amount: 250000,
      notes: 'Staff marker internal_private. Barclays letter held on the file.',
    },
  },
};

export function baselineLender(name) {
  const value = String(name || '').trim().toLowerCase();
  return BASELINE_LENDERS.some((item) => item.toLowerCase() === value);
}

export function knownTermCount(terms) {
  if (!terms || typeof terms !== 'object') return 0;
  return TERM_KEYS.filter((key) => terms[key] != null && String(terms[key]).trim() !== '').length;
}

export function textBlocked(value) {
  const text = String(value || '');
  return BLOCK_RULES.some((rule) => rule.pattern.test(text)) || TEMPLATE_BLOCK.test(text);
}

export function groupResults(rows, directory) {
  const groups = new Map();
  for (const row of rows || []) {
    const lender = String(row.lender || '').trim();
    if (!lender) continue;
    if (!groups.has(lender)) groups.set(lender, []);
    groups.get(lender).push(row);
  }
  return [...groups.entries()].map(([lender, items]) => {
    const fieldsKnown = Math.max(0, ...items.map((item) => knownTermCount(item.terms)));
    const entry = (directory || []).find((item) => item.name.toLowerCase() === lender.toLowerCase());
    return {
      lender,
      known: fieldsKnown,
      total: TERM_KEYS.length,
      label: `${fieldsKnown} of ${TERM_KEYS.length} known`,
      baseline: baselineLender(lender),
      isNew: !!(entry && entry.addedFromResult),
      contact: entry && entry.contact ? entry.contact : null,
    };
  });
}

export function quickDecline(row) {
  const sent = Date.parse(row.sentAt || row.sent_at || '');
  const first = Date.parse(row.firstResponseAt || row.first_response_at || '');
  return (row.responseType || row.response_type) === 'decline'
    && Number.isFinite(sent)
    && Number.isFinite(first)
    && first <= sent + 24 * 60 * 60 * 1000;
}

export function responseScore(row) {
  const speed = Number(row.speedScore ?? row.speed_score ?? 0);
  const terms = Number(row.termsScore ?? row.terms_score ?? 0);
  const complete = Number(row.completenessScore ?? row.completeness_score ?? 0);
  const score = quickDecline(row)
    ? (0.40 * terms + 0.10 * complete) / 0.50
    : 0.50 * speed + 0.40 * terms + 0.10 * complete;
  return Math.round(score * 100) / 100;
}

export function lenderScorecard(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    if (row.status === 'withdrawn') continue;
    const lender = String(row.lender || '').trim();
    if (!lender) continue;
    if (!groups.has(lender)) groups.set(lender, []);
    groups.get(lender).push(row);
  }
  return [...groups.entries()].map(([lender, items]) => {
    const known = items.filter((item) => item.terms && Object.keys(item.terms).length > 0).length;
    const scores = items.map((item) => responseScore(item));
    const score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    return {
      lender,
      approached: items.length,
      known,
      knownLabel: `${known} of ${items.length} known`,
      score: Math.round(score * 100) / 100,
      quickDeclines: items.filter((item) => quickDecline(item)).length,
    };
  }).sort((a, b) => b.score - a.score || a.lender.localeCompare(b.lender));
}

export function caseShortlist(rows) {
  const withTerms = (rows || []).filter((row) => knownTermCount(row.terms) > 0);
  const first = withTerms
    .slice()
    .sort((a, b) => String(a.firstResponseAt || a.first_response_at || a.createdAt || '').localeCompare(String(b.firstResponseAt || b.first_response_at || b.createdAt || '')))
    .slice(0, 5);
  return first
    .slice()
    .sort((a, b) => responseScore(b) - responseScore(a))
    .map((row, index) => ({ ...row, shortlistRank: index + 1, score: responseScore(row) }));
}

export const PREVIEW_SCORE_ROWS = [
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'Invocap', responseType: 'terms', terms: { rate: '0.85%', fee: '2%', ltv: '65%', term_months: '12' }, speedScore: 80, termsScore: 60, completenessScore: 50, sentAt: '2026-11-01T00:00:00Z', firstResponseAt: '2026-11-05T00:00:00Z' },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'TAB', responseType: 'decline', terms: {}, speedScore: 10, termsScore: 40, completenessScore: 20, sentAt: '2026-11-21T10:00:00Z', firstResponseAt: '2026-11-21T11:00:00Z' },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'Albatross Lending Group', responseType: 'terms', terms: { rate: '0.89%', fee: '2%', ltv: '70%', gross: '250000', net: '180000' }, speedScore: 90, termsScore: 80, completenessScore: 70, sentAt: '2026-11-02T00:00:00Z', firstResponseAt: '2026-11-02T06:00:00Z' },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'Dantis', responseType: 'terms', terms: { rate: '1.1%', fee: '2%' }, speedScore: 40, termsScore: 50, completenessScore: 30, sentAt: '2026-11-03T00:00:00Z', firstResponseAt: '2026-11-04T00:00:00Z' },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'Harbour Bridge Co', responseType: 'terms', terms: { rate: '0.99%', fee: '2%', ltv: '60%' }, speedScore: 70, termsScore: 55, completenessScore: 40, sentAt: '2026-11-06T00:00:00Z', firstResponseAt: '2026-11-06T08:00:00Z' },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'North Pier Finance', responseType: 'terms', terms: { rate: '1.05%' }, speedScore: 20, termsScore: 30, completenessScore: 20, sentAt: '2026-11-07T00:00:00Z', firstResponseAt: '2026-11-08T00:00:00Z' },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'Late Terms Ltd', responseType: 'terms', terms: { rate: '0.8%', fee: '1%', ltv: '60%', term_months: '9', gross: '200000', net: '150000' }, speedScore: 99, termsScore: 99, completenessScore: 99, sentAt: '2026-11-18T00:00:00Z', firstResponseAt: '2026-11-19T00:00:00Z' },
];

export const PREVIEW_RESULTS = [
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'Invocap', terms: { rate: '0.85%', fee: '2%', ltv: '65%', term_months: '12' } },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'TAB', terms: { rate: '0.95%', fee: '2%' } },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'Albatross Lending Group', terms: { rate: '0.89%', fee: '2%', ltv: '70%', term_months: '12', gross: '250000' } },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'Dantis', terms: { rate: '1.1%' } },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'Harbour Bridge Co', terms: { rate: '0.99%', fee: '2%', ltv: '60%' } },
  { caseRef: 'PREVIEW-NORTHGATE', lender: 'Albatross Capital', terms: { rate: '1%', fee: '2%' } },
];

export function launchModel(card) {
  const ref = caseRefOk(card?.caseRef) ? card.caseRef : caseRefOk(card?.id) ? card.id : '';
  const fixture = ref === 'preview-northgate' || ref === 'PREVIEW-NORTHGATE' ? PREVIEW_CASES['PREVIEW-NORTHGATE'] : null;
  const caseRef = fixture ? fixture.caseRef : ref;
  const submitted = fixture ? true : factFindSubmitted(card || {});
  return {
    caseRef,
    stage: fixture ? fixture.stage : (card && card.stage) || '',
    submitted,
  };
}
