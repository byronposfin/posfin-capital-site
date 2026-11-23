export function createFlowStore() {
  const activity = [];
  const approvals = [];
  const drafts = [];
  return {
    addActivity(entry) {
      activity.push(entry);
      return entry;
    },
    activity(caseRef) {
      if (!caseRef) return activity.slice();
      return activity.filter((entry) => entry.caseRef === caseRef);
    },
    addApproval(entry) {
      approvals.push(entry);
      return entry;
    },
    approvals(caseRef) {
      if (!caseRef) return approvals.slice();
      return approvals.filter((entry) => entry.caseRef === caseRef);
    },
    addDraft(entry) {
      const draft = { ...entry, autoSend: false, status: 'draft' };
      drafts.push(draft);
      return draft;
    },
    drafts(caseRef) {
      if (!caseRef) return drafts.slice();
      return drafts.filter((entry) => entry.caseRef === caseRef);
    },
  };
}

let shared = null;

export function sharedFlowStore() {
  if (!shared) shared = createFlowStore();
  return shared;
}

export function resetSharedFlowStore() {
  shared = createFlowStore();
  return shared;
}
