const BLOCKED = /neville|\bkpc\b|cifas|\bbacs\b/i;

export const BROKA = 'BROKA (whole lender set)';

export function scrub(text) {
  return String(text || '').replace(BLOCKED, '[removed]');
}

export function lenderChoices(names) {
  const clean = [];
  for (const name of names || []) {
    const value = String(name || '').trim();
    if (!value || BLOCKED.test(value)) continue;
    if (!clean.includes(value) && value !== BROKA) clean.push(value);
  }
  return [BROKA, ...clean];
}

export function feeDraft(loan, procPct = 2, brokerPct = 3) {
  const proc = Number(procPct);
  const broker = Number(brokerPct);
  const safeProc = Number.isFinite(proc) ? proc : 2;
  const safeBroker = Number.isFinite(broker) ? broker : 3;
  const base = Number.isFinite(loan) ? loan : null;
  return {
    procPct: safeProc,
    brokerPct: safeBroker,
    proc: base == null ? null : Math.round(base * safeProc) / 100,
    broker: base == null ? null : Math.round(base * safeBroker) / 100,
    loan: base,
  };
}

export function nextLor(versions, card, actor, now) {
  const prior = (versions || []).filter((item) => item.caseRef === card.caseRef);
  const version = prior.length + 1;
  const doc = {
    caseRef: card.caseRef,
    version,
    at: now,
    actor,
    status: 'draft',
    leavesPosfin: false,
    text: scrub(`${card.name}. ${card.caseRef}. Loan ${card.loan ?? 'not confirmed'}.`),
  };
  return { doc, kept: prior.length };
}

export function queueExternal(input) {
  const lenders = lenderChoices(input.lenders || []);
  const chosen = (input.chosen || []).filter((item) => item && !BLOCKED.test(String(item))).map((item) => scrub(item));
  const recipients = chosen.length ? chosen : [BROKA];
  return {
    id: `${input.kind}:${input.caseRef}:${input.now}`,
    kind: input.kind,
    caseRef: input.caseRef,
    status: 'awaiting Byron approval',
    recipients,
    cost: input.cost,
    actor: input.actor,
    at: input.now,
    placed: {
      called: false,
      operation: input.kind === 'send-lor' ? 'record_lender_submission' : 'attach_document',
      caseRef: input.caseRef,
      note: 'Queued only. PLACED was not called.',
    },
    sent: false,
    charged: false,
  };
}

export function confirmCopy(request) {
  const who = request.recipients.join(', ');
  return `${request.kind} for ${request.caseRef}. Recipients: ${who}. ${request.cost} Status will be awaiting Byron approval. Nothing is sent and nothing is charged.`;
}
