import { randomUUID } from 'node:crypto';
import { BASELINE_LENDERS, PREVIEW_CASES, PREVIEW_RESULTS, activeSeat, baselineLender, caseRefOk, textBlocked } from './broka.js';

const initial = () => ({ standingApproval: true, paused: false, updatedBy: '' });

let control = initial();
let jobs = [];
let runs = [];
let events = [];
let directory = [];
let results = [];

function freshDirectory() {
  return BASELINE_LENDERS.map((name) => ({
    name,
    baseline: true,
    contact: null,
    addedFromResult: false,
  }));
}

export function resetBrokaState() {
  control = initial();
  jobs = [];
  runs = [];
  events = [];
  directory = freshDirectory();
  results = [];
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

export function setSearchPaused(seatCode, paused) {
  if (seatCode !== 'byron') return { ok: false, error: 'byron_only' };
  control = { standingApproval: true, paused: !!paused, updatedBy: 'byron' };
  return { ok: true, control: getSearchControl() };
}
