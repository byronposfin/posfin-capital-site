import { randomUUID } from 'node:crypto';
import { PREVIEW_CASES, activeSeat, caseRefOk } from './broka.js';

const initial = () => ({ standingApproval: true, paused: false, updatedBy: '' });

let control = initial();
let jobs = [];
let runs = [];
let events = [];

export function resetBrokaState() {
  control = initial();
  jobs = [];
  runs = [];
  events = [];
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
