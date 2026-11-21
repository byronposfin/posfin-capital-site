import { randomUUID } from 'node:crypto';
import { BASELINE_LENDERS, PREVIEW_CASES, PREVIEW_RESULTS, activeSeat, baselineLender, caseRefOk, textBlocked } from './broka.js';
import { postcodeDistrict, renderOutreach } from './broka-mail.js';

const initial = () => ({ standingApproval: true, paused: false, updatedBy: '' });

let control = initial();
let jobs = [];
let runs = [];
let events = [];
let directory = [];
let results = [];
let responses = [];

function freshDirectory() {
  return BASELINE_LENDERS.map((name) => ({
    name,
    baseline: true,
    contact: null,
    addedFromResult: false,
  }));
}

directory = freshDirectory();

export function resetBrokaState() {
  control = initial();
  jobs = [];
  runs = [];
  events = [];
  directory = freshDirectory();
  results = [];
  responses = [];
}

export function listDirectory() {
  return directory.map((item) => ({ ...item }));
}

function adoptLender(name) {
  const clean = String(name || '').trim();
  if (!clean || textBlocked(clean)) return { ok: false, error: 'blocked' };
  const existing = directory.find((item) => item.name.toLowerCase() === clean.toLowerCase());
  if (existing) return { ok: true, entry: existing, created: false };
  const entry = {
    name: clean,
    baseline: baselineLender(clean),
    contact: null,
    addedFromResult: true,
  };
  directory = directory.concat(entry);
  return { ok: true, entry, created: true };
}

export function listResults(caseRef) {
  const seeded = PREVIEW_RESULTS.filter((row) => row.caseRef === caseRef);
  for (const row of seeded) adoptLender(row.lender);
  const stored = results.filter((row) => row.caseRef === caseRef);
  return seeded.concat(stored).map((row) => ({ ...row, terms: { ...(row.terms || {}) } }));
}

export function recordResult({ caseRef, lender, terms }) {
  if (!caseRefOk(caseRef)) return { ok: false, error: 'case' };
  const cleanTerms = {};
  for (const [key, value] of Object.entries(terms || {})) {
    if (textBlocked(key) || textBlocked(value)) return { ok: false, error: 'blocked' };
    if (value != null && String(value).trim() !== '') cleanTerms[key] = String(value).trim();
  }
  const adopted = adoptLender(lender);
  if (!adopted.ok) return adopted;
  const row = { caseRef, lender: adopted.entry.name, terms: cleanTerms, contact: null };
  results = results.concat(row);
  return { ok: true, result: row, directory: listDirectory(), created: adopted.created };
}

export function latestJob(caseRef) {
  const rows = jobs.filter((job) => job.caseRef === caseRef);
  return rows.length ? { ...rows[rows.length - 1] } : null;
}

export function jobCounts() {
  return { jobs: jobs.length, runs: runs.length, events: events.length };
}

function heldCaseId(caseRef) {
  const fixture = PREVIEW_CASES[caseRef];
  return fixture && fixture.brokaCaseId ? fixture.brokaCaseId : null;
}

export function openJob({ seat, caseRef, submitted, regulated, preflight, now }) {
  const who = activeSeat(seat);
  if (!who) return { ok: false, error: 'seat' };
  if (!caseRefOk(caseRef)) return { ok: false, error: 'case' };
  if (submitted !== true) return { ok: false, error: 'factfind' };
  const standing = control.standingApproval === true;
  const paused = control.paused === true;
  const status = standing && !paused ? 'approved' : 'awaiting_approval';
  const brokaCaseId = heldCaseId(caseRef);
  const job = {
    id: randomUUID(),
    caseRef,
    brokaCaseId,
    seatCode: who.code,
    status,
    standingApproval: standing,
    paused,
    regulated: regulated == null ? null : !!regulated,
    preflight: preflight || {},
    createdAt: now || new Date().toISOString(),
  };
  const placedRun = {
    id: randomUUID(),
    jobId: job.id,
    caseRef,
    brokaCaseId,
    seatCode: who.code,
    status,
    called: false,
    createdAt: job.createdAt,
  };
  const event = {
    id: randomUUID(),
    jobId: job.id,
    eventType: status === 'approved' ? 'approved_standing' : 'awaiting_approval',
    actor: who.code,
    createdAt: job.createdAt,
  };
  jobs = jobs.concat(job);
  runs = runs.concat(placedRun);
  events = events.concat(event);
  return { ok: true, job: { ...job }, placedRun: { ...placedRun }, event: { ...event } };
}

export function getSearchControl() {
  return { ...control };
}

export function setStandingApproval(value) {
  control = { ...control, standingApproval: !!value };
  return getSearchControl();
}

export function listPrepared(caseRef) {
  return responses.filter((row) => row.caseRef === caseRef).map((row) => ({ ...row }));
}

export function prepareEmails({ caseRef, regulated, now }) {
  if (!caseRefOk(caseRef)) return { ok: false, error: 'case' };
  listResults(caseRef);
  const fixture = PREVIEW_CASES[caseRef] || {};
  const answers = fixture.answers || {};
  const district = postcodeDistrict(answers.security_postcode);
  const loan = answers.loan_amount ? String(answers.loan_amount) : '';
  const created = [];
  for (const lender of directory) {
    if (textBlocked(lender.name)) continue;
    if (responses.some((row) => row.caseRef === caseRef && row.lender === lender.name && row.status !== 'withdrawn')) continue;
    const draft = renderOutreach({
      caseRef,
      lender: lender.name,
      contact: lender.contact,
      regulated,
      district,
      loan,
    });
    if (textBlocked(draft)) continue;
    created.push({
      id: randomUUID(),
      lender: lender.name,
      caseRef,
      brokaCaseId: heldCaseId(caseRef),
      contact: lender.contact || null,
      sentAt: null,
      status: 'prepared',
      draft,
      createdAt: now || new Date().toISOString(),
    });
  }
  responses = responses.concat(created);
  return { ok: true, sent: false, rows: created.map((row) => ({ ...row })) };
}

export function recordSentAt({ seat, caseRef, responseId, now }) {
  if (seat !== 'byron') return { ok: false, error: 'byron_only' };
  const row = responses.find((item) => item.id === responseId && item.caseRef === caseRef);
  if (!row) return { ok: false, error: 'missing' };
  row.sentAt = now || new Date().toISOString();
  row.status = 'recorded_sent';
  return { ok: true, sent: false, row: { ...row } };
}

export function setSearchPaused(seatCode, paused) {
  if (seatCode !== 'byron') return { ok: false, error: 'byron_only' };
  control = { standingApproval: true, paused: !!paused, updatedBy: 'byron' };
  return { ok: true, control: getSearchControl() };
}
