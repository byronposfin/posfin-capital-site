import { randomBytes } from 'node:crypto';

export function createElLorStore() {
  const documents = [];
  const approvals = [];
  const placements = [];
  const responses = [];
  const events = [];
  const audits = [];
  const tasks = [];
  const overlays = new Map();
  const seen = new Set();
  let seed = [];

  function id() {
    return randomBytes(8).toString('hex');
  }

  return {
    useSeed(cases) { seed = Array.isArray(cases) ? cases : []; },
    listSeed() { return seed.slice(); },
    seedRow(ref) { return seed.find((row) => row.case_ref === ref) || null; },
    seen(ref) { return seen.has(ref); },
    markSeen(ref) { seen.add(ref); },
    id,
    documents: () => documents.map((row) => ({ ...row, signers: (row.signers || []).map((signer) => ({ ...signer })) })),
    documentsFor(ref) { return documents.filter((row) => row.case_ref === ref); },
    addDocument(row) {
      for (const prior of documents) {
        if (prior.case_ref === row.case_ref && prior.doc_type === row.doc_type && prior.audience === row.audience) prior.is_current = false;
      }
      const stored = { id: id(), is_current: true, storage_kind: 'preview_memory', counterparty_signed_at: null, ...row };
      documents.push(stored);
      return stored;
    },
    updateDocument(docId, patch) {
      const row = documents.find((item) => item.id === docId);
      if (!row) return null;
      Object.assign(row, patch);
      return row;
    },
    addApproval(row) {
      const stored = { id: id(), status: 'pending', ...row };
      approvals.push(stored);
      return stored;
    },
    approvalsFor(ref) { return approvals.filter((row) => row.case_ref === ref); },
    findApproval(approvalId) { return approvals.find((row) => row.id === approvalId) || null; },
    addPlacement(row) {
      const stored = { id: id(), outcome: 'pending', ...row };
      placements.push(stored);
      return stored;
    },
    placementsFor(ref) { return placements.filter((row) => row.case_ref === ref); },
    addResponse(row) {
      const stored = { id: id(), outcome: 'pending', ...row };
      responses.push(stored);
      return stored;
    },
    responsesFor(ref) { return responses.filter((row) => row.case_ref === ref); },
    updateResponse(responseId, outcome) {
      const row = responses.find((item) => item.id === responseId);
      if (!row) return null;
      row.outcome = outcome;
      const placement = placements.find((item) => item.id === row.placement_id);
      if (placement) placement.outcome = outcome;
      return row;
    },
    addEvent(row) {
      const stored = { id: id(), ...row };
      events.push(stored);
      return stored;
    },
    eventsFor(ref) { return events.filter((row) => row.case_ref === ref); },
    addAudit(row) {
      const stored = { id: id(), action: 'INSERT', ...row };
      audits.push(stored);
      return stored;
    },
    auditsFor(ref) { return audits.filter((row) => row.case_ref === ref); },
    addTask(row) {
      const stored = { id: id(), open: true, blocking: false, ...row };
      tasks.push(stored);
      return stored;
    },
    tasksFor(ref) { return tasks.filter((row) => row.case_ref === ref); },
    overlay(ref) { return overlays.get(ref) || null; },
    setOverlay(ref, patch) {
      const next = { ...(overlays.get(ref) || {}), ...patch };
      overlays.set(ref, next);
      return next;
    },
  };
}

let shared = createElLorStore();

export function sharedElLorStore() {
  return shared;
}

export function resetSharedElLorStore() {
  shared = createElLorStore();
  return shared;
}
