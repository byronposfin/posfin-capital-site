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
