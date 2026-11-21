// Stage-2 case spine. The model is a reusable case-type template.
// The Williamson record is one instance of that template.
// Facts below are taken from the 20 Nov 2026 LOR v5 and the title canon.
// PC-004 is a different case and must never be loaded here.

export const PILOT_REF = 'POSFIN-WEB-EYCTQ6';
export const NOT_THIS_CASE = 'PC-004';

export const EVIDENCE_STATUSES = ['HELD', 'DRAFT_READY', 'IN_PROGRESS', 'MISSING'];

export const URGENT_EVICTION_MODEL = {
  id: 'uk_regulated_bridging_urgent_eviction',
  title: 'UK Regulated Bridging — Urgent Eviction Refinance',
  stages: [
    { id: 'triage', title: 'Triage', exit: ['Borrower, security and urgency identified from the case file.'] },
    { id: 'kyc_title', title: 'KYC & Title', exit: ['Official copies held.', 'Photo ID held.', 'Clean proof of address and a second proof, each within 90 days.'] },
    { id: 'packaging_lor', title: 'Packaging & LOR', exit: ['LOR drafted for the named lender contact.', 'Solicitor pack drafted.'] },
    { id: 'indicative_n244', title: 'Indicative Terms & N244 Letter', exit: ['Ackroyds pack released by Byron outside this page.', 'LOR released by Byron outside this page.', 'N244 filing date confirmed.'] },
    { id: 'valuation', title: 'Valuation', exit: ['Priority valuation instructed.', 'Floor area confirmed by the valuer.'] },
    { id: 'offer_legals', title: 'Formal Offer & Legals', exit: ['Formal offer received.', 'Legals opened.'] },
    { id: 'redemption_completion', title: 'Redemption & Completion', exit: ['Redemption figures received for every charge.', 'Completion arranged.'] },
  ],
  evidenceChecklist: [
    'Official copies',
    'Lender offer request',
    'Solicitor pack',
    'Regulated application',
    'Existing-lender authority and redemption request',
    'Photo ID',
    'Proof of address and mortgage statement',
    'Redemption figures',
    'Photo and comparable sales',
  ],
  sla: {
    primary: 'Eviction warrant, recorded as given by the borrower.',
    court: 'N244 warrant-suspension filing.',
    redemption: 'Redemption statement target. The figure itself is still to follow.',
  },
};

const WILLIAMSON = {
  ref: PILOT_REF,
  modelId: URGENT_EVICTION_MODEL.id,
  preview: true,
  stageId: 'indicative_n244',
  stageLabel: 'Packaging & Urgent Lender Terms — N244 Court Gate',
  caseHeader: {
    ref: PILOT_REF,
    borrower: 'Christopher Nicholas Williamson',
    borrowerAsOnLor: 'Christopher Williamson, individual, sole name',
    security: '204 Cooden Drive, Bexhill-on-Sea, East Sussex TN39 3AH',
    property: 'Detached house',
    tenure: 'Freehold, title absolute',
    titleNumber: 'ESX86205',
    proprietorSince: 'Sole proprietor since 3 Dec 2002',
    pricePaid: '£330,000 paid 26 Nov 2002',
    statedValue: '£700,000',
    loanRequested: '£455,000 gross',
    ltv: 'Maximum 65% LTV, as stated on LOR v5',
    sizingQuestion: 'Byron has an open sizing question of £511,000. That figure is not on LOR v5 and is not a verified loan amount.',
    lender: 'MT Finance, for the attention of Joe Grace',
    lenderStatus: 'LOR v5 is a draft request. No indicative terms are recorded as received.',
    solicitor: 'Ackroyds, Ash Nejad',
    solicitorStatus: 'Instructed to apply to suspend the warrant. The pack is draft only.',
    purpose: 'Refinance the expired RBS first charge and clear the other registered interests so a new lender would take a clean first charge.',
    exit: 'Short-term facility. Exit by sale or refinance, still to be confirmed with the borrower.',
    notThisCase: 'PC-004 is Winslade Park / Mark Edworthy. It is not this case.',
  },
  primaryOwner: {
    name: 'Byron Hill',
    deskName: 'Byron',
    role: 'Lender terms, sizing, and sign-off before anything goes to Ackroyds or MT Finance.',
  },
  deskRoles: [
    { name: 'Jess', role: 'RBS letter of authority e-sign, and chasing the redemption figures.' },
    { name: 'Lizzy', role: 'Packaging, LOR versioning, and follow-ups.' },
  ],
  due: {
    primary: {
      id: 'eviction',
      label: 'Eviction warrant',
      at: '2026-11-24T10:00:00Z',
      display: 'Tue 24 Nov 2026, 10:00 GMT',
      detail: '10:00 UK time on Tuesday 24 November 2026, as told by the borrower. A warrant of possession has been issued.',
    },
    sub: [
      { id: 'n244', label: 'N244 filing and LOR v5', date: '2026-11-20', display: 'Fri 20 Nov 2026', detail: 'Ackroyds filing and the LOR are still drafts. This page cannot send either.' },
      { id: 'redemption', label: 'Redemption statement target', date: '2026-11-27', display: 'Fri 27 Nov 2026', detail: 'Target only. RBS is under £400,000, figure to follow. Amex and Rother DC figures are not yet held.' },
    ],
  },
  evidence: [
    {
      id: 'official-copies',
      title: 'HMLR official copies ESX86205',
      status: 'HELD',
      detail: 'Register and title plan, issued 19 Nov 2026 at 22:04:53 UK time, business e-services. Three charges: RBS registered charge 28 Mar 2008 with an RBS consent restriction; American Express interim charging order, Hastings County Court, 13 Apr 2012, reference 0JU75100; Rother District Council interim charging order, Hastings County Court, 19 Mar 2014, reference A00HS078.',
    },
    {
      id: 'lor-v5',
      title: 'LOR v5, Joe Grace / MT Finance',
      status: 'DRAFT_READY',
      detail: 'Draft of 20 Nov 2026 for Byron. Not sent. It asks for indicative terms, a priority valuation, and a short letter Ackroyds can put before the court.',
    },
    {
      id: 'ackroyds-pack',
      title: 'Ackroyds solicitor pack, Ash Nejad',
      status: 'DRAFT_READY',
      detail: 'Draft, awaiting Byron. Not sent. Ackroyds are instructed to apply to suspend the warrant.',
    },
    {
      id: 'mt-form',
      title: 'MT Finance regulated application pre-fill v001',
      status: 'IN_PROGRESS',
      detail: 'Byron records this pre-fill as 36.5% populated. Open points, not verified answers: £455,000 on the LOR against the open £511,000 sizing question; a 6-month term is not confirmed; Posfin address and adviser FCA details are still to be confirmed.',
    },
    {
      id: 'rbs-loa',
      title: 'RBS letter of authority v001 and redemption email draft',
      status: 'DRAFT_READY',
      detail: 'Draft, e-sign still pending. It does not yet produce a redemption statement.',
    },
    {
      id: 'driving-licence',
      title: 'KYC driving licence',
      status: 'HELD',
      detail: 'Photo ID held, as stated on LOR v5.',
    },
    {
      id: 'kyc-gaps',
      title: 'Clean Rother DC council tax, second proof of address, RBS mortgage statement',
      status: 'MISSING',
      detail: 'LOR v5 already records council tax correspondence as held. Still outstanding: a clean Rother DC council tax resend, a second proof of address dated within 90 days, and the latest RBS mortgage statement.',
    },
    {
      id: 'redemptions',
      title: 'Redemption figures',
      status: 'MISSING',
      detail: 'RBS redemption is under £400,000, figure to follow. American Express 0JU75100 and Rother DC A00HS078 are to be redeemed from the advance. No balances are held for either charging order.',
    },
    {
      id: 'photo-comps',
      title: 'Front photo and five Cooden Drive sales',
      status: 'HELD',
      detail: 'Front photo from Chris on WhatsApp, 19 Nov 2026 18:37: detached, double-fronted, two storeys plus roof space, attached garage, wide driveway. HM Land Registry sales: 202 Cooden Drive £630,000 (12 Jan 2022); 220 £685,000 (30 Apr 2026); 244 £660,000 (21 Oct 2024); 246 £735,000 (17 Oct 2022); 248 £635,000 (31 Mar 2025). EPC 0834-1729-2409-0065-3202 shows 640 m². Byron says that is likely a typo and the house is about 300–330 m², pending the survey. The floor area is not on the LOR.',
    },
  ],
  waiting: [
    { id: 'byron-ackroyds', text: 'Awaiting Byron before the Ackroyds pack can leave the desk.', metWhen: { type: 'action_done', actionId: 'ackroyds-pack' } },
    { id: 'byron-lor', text: 'Awaiting Byron before LOR v5 can go to Joe Grace.', metWhen: { type: 'action_done', actionId: 'lor-v5' } },
    { id: 'jess-loa', text: 'Awaiting Jess for the RBS letter of authority e-sign.', metWhen: { type: 'evidence', evidenceId: 'rbs-loa', status: 'HELD' } },
    { id: 'redemption-figures', text: 'Awaiting the RBS, American Express and Rother DC redemption statements.', metWhen: { type: 'evidence', evidenceId: 'redemptions', status: 'HELD' } },
    { id: 'mt-terms', text: 'Awaiting MT Finance indicative terms and the court letter. Nothing has been received.', metWhen: { type: 'evidence', evidenceId: 'lor-v5', status: 'HELD' } },
    { id: 'clean-kyc', text: 'Awaiting Chris for the clean council tax resend, a second proof of address, and the RBS mortgage statement.', metWhen: { type: 'evidence', evidenceId: 'kyc-gaps', status: 'HELD' } },
  ],
  actions: [
    { id: 'ackroyds-pack', position: 1, owner: 'Byron', due: '2026-11-20', title: 'Confirm the Ackroyds solicitor pack for Ash Nejad', detail: 'N244 warrant-suspension filing is aimed at Fri 20 Nov 2026. Marking this done on the desk does not send the pack.', done: false },
    { id: 'lor-v5', position: 2, owner: 'Byron', due: '2026-11-20', title: 'Confirm LOR v5 for Joe Grace at MT Finance', detail: 'The draft asks for indicative terms, a court comfort letter, and a priority valuation. Marking this done does not send the LOR.', done: false },
    { id: 'rbs-loa', position: 3, owner: 'Jess', due: '2026-11-27', title: 'RBS letter of authority v001 for e-sign, then ask for the redemption figures', detail: 'RBS redemption is under £400,000, figure to follow. Also request American Express 0JU75100 and Rother DC A00HS078. This page does not email RBS.', done: false },
    { id: 'kyc-chase', position: 4, owner: 'Lizzy', due: '2026-11-24', title: 'Ask Chris for the clean Rother DC council tax, a second proof of address, and the latest RBS mortgage statement', detail: 'The second proof of address needs to be dated within 90 days. Council tax correspondence is already noted as held on the LOR.', done: false },
    { id: 'mt-form-fields', position: 5, owner: 'Byron', due: '2026-11-20', title: 'Confirm the open MT Finance regulated form fields', detail: 'The LOR amount is £455,000 gross. £511,000 is an open sizing question, not a verified figure. A 6-month term, the Posfin address, and the adviser FCA details are not confirmed on the LOR.', done: false },
  ],
};

export function modelById(id) {
  return id === URGENT_EVICTION_MODEL.id ? URGENT_EVICTION_MODEL : null;
}

export function pilotSpine() {
  return structuredClone(WILLIAMSON);
}

export function waitingEngineFlag(env = process.env) {
  return String(env.STAGE2_WAITING_CONDITIONS_ENABLED || '').trim().toLowerCase() === 'true';
}

export function engineMode(env, query, sourceMode) {
  if (waitingEngineFlag(env)) return 'on';
  if (sourceMode !== 'supabase' && String(query && query.waiting || '') === 'preview') return 'preview';
  return 'off';
}

export function countdown(targetIso, now) {
  const ms = new Date(targetIso).getTime() - new Date(now).getTime();
  if (!Number.isFinite(ms)) return { urgent: true, label: 'Deadline not readable' };
  if (ms <= 0) return { urgent: true, overdue: true, label: 'Deadline has passed' };
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const unit = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  return {
    urgent: hours < 24 * 7,
    overdue: false,
    label: days > 0 ? `${unit(days, 'day')} ${unit(rest, 'hour')}` : unit(hours, 'hour'),
  };
}

export function londonDate(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}

export function subDueLabel(date, now) {
  const today = londonDate(now);
  if (date === today) return 'Today';
  if (date < today) return 'Date has passed';
  return 'Ahead';
}

function evidenceStatus(spine, id) {
  const row = spine.evidence.find((item) => item.id === id);
  return row ? row.status : '';
}

function actionDone(spine, id) {
  const row = spine.actions.find((item) => item.id === id);
  return !!(row && row.done);
}

export function evaluateWaiting(spine) {
  return spine.waiting.map((item) => {
    const rule = item.metWhen || {};
    let met = false;
    if (rule.type === 'action_done') met = actionDone(spine, rule.actionId);
    if (rule.type === 'evidence') met = evidenceStatus(spine, rule.evidenceId) === rule.status;
    return { id: item.id, text: item.text, met };
  });
}

export function stageReadiness(spine) {
  const model = modelById(spine.modelId);
  const stage = model.stages.find((item) => item.id === spine.stageId);
  const waiting = evaluateWaiting(spine);
  const unmet = waiting.filter((item) => !item.met);
  return {
    stageId: spine.stageId,
    stageTitle: stage ? stage.title : spine.stageId,
    stageLabel: spine.stageLabel,
    ready: unmet.length === 0,
    unmet: unmet.map((item) => item.id),
    met: waiting.filter((item) => item.met).map((item) => item.id),
    moved: false,
  };
}

export function presentSpine(spine, env, query, sourceMode, now) {
  const model = modelById(spine.modelId);
  const mode = engineMode(env, query, sourceMode);
  const clock = now || new Date().toISOString();
  const primary = countdown(spine.due.primary.at, clock);
  return {
    spine,
    model,
    engine: mode,
    primary,
    sub: spine.due.sub.map((item) => ({ ...item, relative: subDueLabel(item.date, clock) })),
    waiting: evaluateWaiting(spine),
    readiness: mode === 'off' ? null : stageReadiness(spine),
    rail: model.stages.map((stage, index) => {
      const current = model.stages.findIndex((item) => item.id === spine.stageId);
      return { ...stage, state: index < current ? 'earlier' : index === current ? 'now' : 'later' };
    }),
  };
}

export function spineRefStatus(ref) {
  const value = String(ref || '').trim();
  if (value === NOT_THIS_CASE) return 'wrong_case';
  if (value === PILOT_REF) return 'pilot';
  return 'unknown';
}
