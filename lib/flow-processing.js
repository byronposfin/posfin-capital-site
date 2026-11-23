import { FLOW_STAGES } from './flow-cases.js';

export const PROCESS_STEPS = [
  { id: 'valuation', label: 'Valuation', waitingOn: 'Valuer' },
  { id: 'legals', label: 'Legals', waitingOn: 'Solicitor' },
  { id: 'ples', label: 'PLEs', waitingOn: 'Lender' },
  { id: 'kyc', label: 'KYC', waitingOn: 'Borrower' },
  { id: 'offer', label: 'Offer', waitingOn: 'Lender' },
  { id: 'completion', label: 'Completion', waitingOn: 'Solicitor' },
];

export const FROM_IDENTITIES = ['Byron', 'Chris', 'Jess', 'Cai', 'Aadi', 'Tom', 'Liz'];

const STAGE_LABELS = Object.fromEntries(FLOW_STAGES);

export function cleanFrom(value) {
  const text = String(value || '').trim().toLowerCase();
  return FROM_IDENTITIES.find((name) => name.toLowerCase() === text) || 'Jess';
}

export function stepById(id) {
  return PROCESS_STEPS.find((step) => step.id === String(id || '').trim().toLowerCase()) || null;
}

export function stageLabel(stage) {
  return STAGE_LABELS[stage] || 'Case';
}

export function draftCopy(flowCase, step, from) {
  return {
    subject: `${flowCase.ref} · ${step.label} · draft next action`,
    body: `Draft for review by ${from}. Case ${flowCase.ref}, ${flowCase.borrower_name}. Next step: ${step.label}. This asks the ${step.waitingOn.toLowerCase()} to move that step on. Subject to status. Nothing in this draft has been sent.`,
  };
}

export function leadershipLine(flowCase, drafts) {
  const mine = (drafts || []).filter((draft) => draft.caseRef === flowCase.ref && draft.status === 'draft');
  const open = PROCESS_STEPS.find((step) => !mine.some((draft) => draft.step === step.id));
  const next = open || PROCESS_STEPS[PROCESS_STEPS.length - 1];
  return {
    ref: flowCase.ref,
    stage: stageLabel(flowCase.stage),
    nextStep: next.label,
    waitingOn: open ? next.waitingOn : 'Byron and Chris',
    draftReady: mine.length > 0,
  };
}
