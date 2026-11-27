// Roy Kenny — Wirral Waters / CrowdProperty compliance response.
// Roy's verbatim stays in inputs/draft. Lender-facing wording lives only in proposed.
// Nothing here invents an answer.

import { POSFIN_PHONE_DISPLAY } from './contact.js';

export const SLUG = 'wirral-waters-roy-kenny';
export const ROUTE = '/wirral-waters-response';
export const REVIEW_QUERY = 'review';
export const MAX_ROUNDS = 20;
export const VERBATIM_MAX = 8000;
export const DOCUMENT_MAX = 2000;
export const PROPOSED_MAX = 8000;

export const POINTS = [
  {
    id: 'p1',
    number: 1,
    priority: 'critical',
    title: 'Inspired 2 Care Limited — Open HMRC Winding-Up Petition & Two Prior Petitions',
    prompt: 'CrowdProperty flagged an open winding-up petition from HMRC on Inspired 2 Care Limited, plus two previous winding-up petitions. Please explain what happened and clarify the current position (e.g. paid, disputed, payment plan, hearing date).',
  },
  {
    id: 'p2',
    number: 2,
    priority: '',
    title: 'Inspired 2 Care Limited — Dissolved 26 Nov 2019 & Re-incorporated 5 Dec 2019',
    prompt: 'Inspired 2 Care Limited was dissolved on 26 November 2019 and newly incorporated on 5 December 2019 (9 days later). Please explain the background to this.',
  },
  {
    id: 'p3',
    number: 3,
    priority: '',
    title: 'Nil Satis Nisi Limited (06454085) — Unsatisfied CCJ (£912, 09/01/2026, ref: M3BP95NV)',
    prompt: 'There is an unsatisfied CCJ of £912 dated 09/01/2026 (ref M3BP95NV) on Nil Satis Nisi Limited. Please confirm what this relates to and its current status.',
  },
  {
    id: 'p4',
    number: 4,
    priority: '',
    title: 'Southend Hall Limited — Unsatisfied CCJ (£302, 22/08/2024, ref: 553MC903)',
    prompt: 'An unsatisfied CCJ of £302 dated 22/08/2024 (ref 553MC903) is associated with Southend Hall Limited. Please confirm whether this is your company or a different entity with the same name.',
  },
  {
    id: 'p5',
    number: 5,
    priority: '',
    title: 'Liver Bird Developments Ltd — Written Explanation of Insolvency',
    prompt: 'CrowdProperty noted the insolvency of Liver Bird Developments Ltd (previously discussed on the video call) and requested a written explanation of the events that led to the insolvency.',
  },
];

export const POINT_IDS = POINTS.map((point) => point.id);

const ACTORS = new Set(['Byron', 'Lizzy']);

export function blankInputs() {
  return Object.fromEntries(POINT_IDS.map((id) => [id, { verbatim: '', documents: '' }]));
}

function blankSignoff() {
  return Object.fromEntries(POINT_IDS.map((id) => [id, false]));
}

export function freshState(now = new Date().toISOString()) {
  return {
    slug: SLUG,
    borrower: 'Roy Kenny',
    site: 'Wirral Waters, Dock Road',
    lenderContact: 'Sara Nasralla, CrowdProperty',
    revision: 0,
    updatedAt: now,
    draft: blankInputs(),
    rounds: [],
  };
}

export function cleanText(value, max) {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, max);
}

export function cleanInputs(raw) {
  const out = blankInputs();
  for (const id of POINT_IDS) {
    const row = raw && typeof raw === 'object' ? raw[id] : null;
    const source = row && typeof row === 'object' ? row : {};
    out[id] = {
      verbatim: cleanText(source.verbatim, VERBATIM_MAX),
      documents: cleanText(source.documents, DOCUMENT_MAX),
    };
  }
  return out;
}

function cleanProposed(raw) {
  const out = {};
  for (const id of POINT_IDS) {
    const row = raw && typeof raw === 'object' ? raw[id] : null;
    const wording = cleanText(row && typeof row === 'object' ? row.wording : row, PROPOSED_MAX);
    const at = row && typeof row === 'object' && row.at ? cleanText(row.at, 40) : null;
    out[id] = { wording, at: wording.trim() ? at : null };
  }
  return out;
}

function normaliseRound(round, index) {
  const inputs = cleanInputs(round && round.inputs);
  const proposed = cleanProposed(round && round.proposed);
  const signoff = blankSignoff();
  for (const id of POINT_IDS) signoff[id] = !!(round && round.signoff && round.signoff[id]);
  const history = Array.isArray(round && round.history)
    ? round.history.slice(-5).map((entry) => ({
      at: cleanText(entry && entry.at, 40),
      inputs: cleanInputs(entry && entry.inputs),
    }))
    : [];
  const complete = proposedComplete({ proposed });
  const overall = !!(round && round.overall) && complete && POINT_IDS.every((id) => signoff[id]);
  return {
    number: Number(round && round.number) || index + 1,
    submittedAt: cleanText(round && round.submittedAt, 40),
    inputs,
    history,
    proposed,
    proposedAt: complete ? cleanText(round && round.proposedAt, 40) || null : null,
    proposedBy: ACTORS.has(round && round.proposedBy) ? round.proposedBy : (round && round.proposedBy ? 'Posfin' : ''),
    signoff,
    overall,
    signedOffAt: overall && round && round.signedOffAt ? cleanText(round.signedOffAt, 40) : null,
  };
}

export function normaliseState(raw, now = new Date().toISOString()) {
  const base = freshState(now);
  if (!raw || typeof raw !== 'object') return base;
  const rounds = Array.isArray(raw.rounds) ? raw.rounds.slice(0, MAX_ROUNDS).map(normaliseRound) : [];
  return {
    ...base,
    revision: Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : 0,
    updatedAt: cleanText(raw.updatedAt, 40) || now,
    draft: cleanInputs(raw.draft),
    rounds,
  };
}

export function latestRound(state) {
  const rounds = state && Array.isArray(state.rounds) ? state.rounds : [];
  return rounds.length ? rounds[rounds.length - 1] : null;
}

export function proposedComplete(round) {
  if (!round || !round.proposed) return false;
  return POINT_IDS.every((id) => String(round.proposed[id] && round.proposed[id].wording || '').trim());
}

export function phaseOf(state) {
  const round = latestRound(state);
  if (!round) return 'collecting';
  if (round.signedOffAt && round.overall) return 'signed_off';
  if (proposedComplete(round)) return 'in_review';
  return 'awaiting_draft';
}

export function draftHasText(inputs) {
  return POINT_IDS.some((id) => String(inputs?.[id]?.verbatim || '').trim() || String(inputs?.[id]?.documents || '').trim());
}

function inputsChanged(previous, next) {
  return POINT_IDS.some((id) => {
    const before = previous[id];
    const after = next[id];
    return before.verbatim.trim() !== after.verbatim.trim() || before.documents.trim() !== after.documents.trim();
  });
}

function mergeInputs(previous, incoming) {
  const inputs = blankInputs();
  for (const id of POINT_IDS) {
    const typed = incoming[id].verbatim.trim() ? incoming[id].verbatim : (previous ? previous[id].verbatim : '');
    const docs = incoming[id].documents.trim() ? incoming[id].documents : (previous ? previous[id].documents : '');
    inputs[id] = { verbatim: typed, documents: docs };
  }
  const missing = POINT_IDS.filter((id) => !inputs[id].verbatim.trim());
  const changed = previous ? inputsChanged(previous, inputs) : missing.length === 0;
  return { inputs, missing, changed };
}

function fail(state, error, message, extra = {}) {
  return { ok: false, error, message, state, ...extra };
}

function ok(state) {
  return { ok: true, state };
}

function newRound(number, inputs, now) {
  return {
    number,
    submittedAt: now,
    inputs,
    history: [],
    proposed: cleanProposed({}),
    proposedAt: null,
    proposedBy: '',
    signoff: blankSignoff(),
    overall: false,
    signedOffAt: null,
  };
}

function withRevision(state, now) {
  return { ...state, revision: state.revision + 1, updatedAt: now };
}

export function pointLabel(id) {
  const point = POINTS.find((item) => item.id === id);
  return point ? `Point ${point.number}` : id;
}

export function applyAction(rawState, action, now = new Date().toISOString()) {
  const state = normaliseState(rawState, now);
  const type = action && action.type;
  if (type === 'save_draft') {
    return ok(withRevision({ ...state, draft: cleanInputs(action.inputs) }, now));
  }
  if (type === 'submit_inputs') {
    if (action.revision !== state.revision) return fail(state, 'conflict', 'This page was updated. Review the latest version, then send again.');
    if (state.rounds.length >= MAX_ROUNDS) {
      return fail(state, 'too_many_rounds', `This link has reached its round limit. Call Posfin on ${POSFIN_PHONE_DISPLAY}.`);
    }
    const incoming = cleanInputs(action.inputs);
    const round = latestRound(state);
    const open = round && !round.proposedAt && !round.signedOffAt;
    const merged = mergeInputs(open || round ? (open ? round.inputs : round.inputs) : null, incoming);
    if (!round) {
      if (merged.missing.length) {
        return fail(state, 'incomplete', `Add your own words on each point before sending. Still open: ${merged.missing.map(pointLabel).join(', ')}.`, { missing: merged.missing });
      }
      return ok(withRevision({ ...state, draft: blankInputs(), rounds: [newRound(1, merged.inputs, now)] }, now));
    }
    if (!merged.changed) {
      return fail(state, 'unchanged', open
        ? 'Change a point, or leave this as the version already sent to Byron.'
        : 'Add a correction in your own words, or confirm the wording above.');
    }
    if (merged.missing.length) {
      return fail(state, 'incomplete', `Add your own words on each point before sending. Still open: ${merged.missing.map(pointLabel).join(', ')}.`, { missing: merged.missing });
    }
    if (open) {
      const updated = {
        ...round,
        inputs: merged.inputs,
        history: round.history.concat([{ at: round.submittedAt, inputs: round.inputs }]).slice(-5),
        submittedAt: now,
        signoff: blankSignoff(),
        overall: false,
        signedOffAt: null,
      };
      return ok(withRevision({
        ...state,
        draft: blankInputs(),
        rounds: state.rounds.slice(0, -1).concat(updated),
      }, now));
    }
    return ok(withRevision({
      ...state,
      draft: blankInputs(),
      rounds: state.rounds.concat(newRound(round.number + 1, merged.inputs, now)),
    }, now));
  }
  if (type === 'save_proposed') {
    if (action.revision !== state.revision) return fail(state, 'conflict', 'Roy updated this page. Reload it, then send the wording again.');
    const round = latestRound(state);
    if (!round) return fail(state, 'no_round', 'Roy has not sent his words yet.');
    if (round.signedOffAt && round.overall) return fail(state, 'signed_off', 'Roy has already confirmed this round.');
    const actor = ACTORS.has(action.actor) ? action.actor : 'Posfin';
    const proposed = cleanProposed(action.proposed);
    const complete = proposedComplete({ proposed });
    const next = {
      ...round,
      proposed,
      proposedAt: complete ? (round.proposedAt || now) : null,
      proposedBy: complete || POINT_IDS.some((id) => proposed[id].wording.trim()) ? actor : '',
      signoff: blankSignoff(),
      overall: false,
      signedOffAt: null,
    };
    for (const id of POINT_IDS) {
      if (proposed[id].wording.trim()) proposed[id].at = proposed[id].at || now;
    }
    if (!POINT_IDS.some((id) => proposed[id].wording.trim())) {
      return fail(state, 'proposed_empty', "Write wording from Roy's exact words before saving.");
    }
    return ok(withRevision({ ...state, rounds: state.rounds.slice(0, -1).concat(next) }, now));
  }
  if (type === 'sign_off') {
    if (action.revision !== state.revision) return fail(state, 'conflict', 'This page was updated. Review the latest version, then confirm again.');
    const round = latestRound(state);
    if (!round) return fail(state, 'no_round', 'Send your own words before confirming.');
    if (!proposedComplete(round)) return fail(state, 'no_wording', 'Byron has not sent lender-facing wording for every point yet.');
    const signoff = blankSignoff();
    for (const id of POINT_IDS) signoff[id] = !!(action.signoff && action.signoff[id]);
    const wantOverall = action.overall === true;
    if (wantOverall && !POINT_IDS.every((id) => signoff[id])) {
      return fail(state, 'confirm_each', 'Tick each point before the overall confirmation. Nothing is marked ready while a point is still open.');
    }
    const overall = wantOverall && POINT_IDS.every((id) => signoff[id]);
    const next = {
      ...round,
      signoff,
      overall,
      signedOffAt: overall ? now : null,
    };
    return ok(withRevision({ ...state, rounds: state.rounds.slice(0, -1).concat(next) }, now));
  }
  return fail(state, 'bad_action', 'That action is not available.');
}

export function editorInputs(state) {
  const phase = phaseOf(state);
  const round = latestRound(state);
  if (phase === 'collecting') return state.draft;
  if (phase === 'awaiting_draft' && round && !draftHasText(state.draft)) return round.inputs;
  return state.draft;
}

export function answeredCount(inputs) {
  return POINT_IDS.filter((id) => String(inputs?.[id]?.verbatim || '').trim()).length;
}
