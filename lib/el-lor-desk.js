import { activeSeat, baselineLender } from './broka.js';
import { sameSeat } from './staff-seats.js';
import { latestJob } from './broka-state.js';
import { dispatchAdapter, sendsAreMock } from './el-lor-adapters.js';
import { contactLabel, offeredLenders, lenderExcluded } from './el-lor-check.js';
import { NO_AI_TOOLTIP, PROCESSING_TASK, processingWrite } from './el-lor-config.js';
import { buildEngagementLetter, buildLenderCopy } from './el-lor-templates.js';

const OUTCOMES = new Set(['pending', 'terms', 'decline', 'referred', 'no_reply']);

export function formatParis(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${text} Europe/Paris`;
}

function signersFrom(row) {
  return (row.signatories || []).map((signer) => ({
    name: signer.name,
    email: signer.email,
    viewed_at: null,
    signed_at: null,
  }));
}

export function ensureCase(store, row, now) {
  if (!row || store.seen(row.case_ref)) return;
  store.markSeen(row.case_ref);
  store.addEvent({
    case_ref: row.case_ref,
    from_stage: '',
    to_stage: row.db_stage,
    label: 'On the desk',
    at: row.opened_at || now,
    actor: 'desk',
  });
  for (const task of row.blocking_tasks || []) {
    store.addTask({
      case_ref: row.case_ref,
      title: task.title,
      open: task.open !== false,
      blocking: task.blocking !== false,
    });
  }
  const el = row.el || { state: 'none' };
  if (el.state && el.state !== 'none') {
    const built = buildEngagementLetter(row);
    if (built.checked.ok) {
      const version = el.version || 1;
      store.addDocument({
        case_ref: row.case_ref,
        doc_type: 'engagement_letter',
        audience: 'client',
        version_no: version,
        status: el.state,
        body: built.body,
        filename: `${row.case_ref}-engagement-letter-v${version}.html`,
        signers: signersFrom(row),
        fee_line: built.fee_line,
        created_at: row.opened_at || now,
      });
    }
  }
  const lor = row.lor || { state: 'none' };
  if (lor.state === 'pre_lor') {
    const version = lor.version || 1;
    store.addDocument({
      case_ref: row.case_ref,
      doc_type: 'lender_pack',
      audience: 'internal',
      version_no: version,
      status: 'pre_lor',
      body: '',
      filename: '',
      signers: [],
      fee_line: '',
      created_at: row.opened_at || now,
    });
  } else if (lor.state === 'lender_copy') {
    const version = lor.version || 1;
    const built = buildLenderCopy(row, version);
    if (built.checked.ok) {
      store.addDocument({
        case_ref: row.case_ref,
        doc_type: 'lender_pack',
        audience: 'lender',
        version_no: version,
        status: 'draft',
        body: built.body,
        filename: `${row.case_ref}-lender-copy-v${version}.html`,
        signers: [],
        fee_line: '',
        created_at: row.opened_at || now,
      });
    }
  }
}

function currentDoc(store, ref, docType, audience) {
  const rows = store.documentsFor(ref).filter((row) => row.doc_type === docType && row.audience === audience && row.is_current);
  return rows.length ? rows[rows.length - 1] : null;
}

function nextVersion(store, ref, docType, audience) {
  const versions = store.documentsFor(ref)
    .filter((row) => row.doc_type === docType && row.audience === audience)
    .map((row) => Number(row.version_no) || 0);
  return versions.length ? Math.max(...versions) + 1 : 1;
}

export function elChip(docs) {
  const current = (docs || []).filter((row) => row.doc_type === 'engagement_letter' && row.audience === 'client' && row.is_current).slice(-1)[0];
  if (!current) return 'None';
  if (current.status === 'draft') return `Draft v${current.version_no}`;
  if (current.status === 'sent') return `Sent v${current.version_no}`;
  if (current.status === 'viewed') return 'Viewed';
  if (current.status === 'partly_signed') return 'Partly signed';
  if (current.status === 'signed') return `Signed v${current.version_no}`;
  return 'None';
}

export function lorChip(docs, placements) {
  const sent = new Set((placements || []).map((row) => row.lender));
  if (sent.size) return `Sent to ${sent.size} lenders`;
  const lender = (docs || []).filter((row) => row.doc_type === 'lender_pack' && row.audience === 'lender' && row.is_current).slice(-1)[0];
  if (lender) return `v${lender.version_no} lender copy`;
  const pre = (docs || []).filter((row) => row.doc_type === 'lender_pack' && row.audience === 'internal' && row.status === 'pre_lor').slice(-1)[0];
  if (pre) return `Pre-LOR v${pre.version_no}`;
  return 'None';
}

function nextAction(row, el, lor) {
  const noAi = (row.flags || []).includes('no_ai_contact');
  if (noAi && !el.startsWith('Signed')) return 'Byron handles client contact';
  if (el === 'None') return 'Generate EL';
  if (el.startsWith('Draft')) return 'Send EL for e-sign';
  if (el.startsWith('Sent') || el === 'Viewed' || el === 'Partly signed') return 'Await signature';
  if (el.startsWith('Signed') && !String(lor).startsWith('Sent')) return 'Send LOR';
  if (el.startsWith('Signed')) return 'Move to Processing';
  return row.next_action || 'Review';
}

function processingGate(store, ref) {
  const current = currentDoc(store, ref, 'engagement_letter', 'client');
  const blocking = store.tasksFor(ref).filter((task) => task.open && task.blocking);
  const signed = current && current.status === 'signed' && (current.signers || []).length > 0 && current.signers.every((signer) => signer.signed_at);
  if (!signed) return { enabled: false, reason: 'Current engagement letter is not signed by every signer.', current };
  if (blocking.length) return { enabled: false, reason: 'A blocking task is still open.', current };
  return { enabled: true, reason: '', current };
}

function stageOf(store, row) {
  const overlay = store.overlay(row.case_ref);
  return {
    stageLabel: overlay?.stageLabel || row.stage,
    dbStage: overlay?.dbStage || row.db_stage,
  };
}

function summarise(store, row, now) {
  ensureCase(store, row, now);
  const docs = store.documentsFor(row.case_ref);
  const placements = store.placementsFor(row.case_ref);
  const el = elChip(docs);
  const lor = lorChip(docs, placements);
  const stage = stageOf(store, row);
  const gate = processingGate(store, row.case_ref);
  const offered = offeredLenders(row.eligible_lenders, row.lender_exclusions);
  return {
    caseRef: row.case_ref,
    label: row.label,
    owner: row.owner,
    product: row.product,
    flags: row.flags || [],
    noAi: (row.flags || []).includes('no_ai_contact'),
    brokaId: row.broka_case_id || '',
    isTest: row.is_test === true,
    stageLabel: stage.stageLabel,
    dbStage: stage.dbStage,
    elChip: el,
    lorChip: lor,
    eligibleCount: offered.length,
    nextAction: nextAction(row, el, lor),
    ready: gate.enabled && stage.stageLabel !== 'Processing',
    email: row.email,
  };
}

export function presentList(store, query, now, warning) {
  const rows = store.listSeed().map((row) => summarise(store, row, now));
  const stages = [...new Set(rows.map((row) => row.stageLabel))];
  const owners = [...new Set(rows.map((row) => row.owner))];
  const filtered = rows.filter((row) => {
    if (query.stage && query.stage !== 'all' && row.stageLabel !== query.stage && row.dbStage !== query.stage) return false;
    if (query.owner && query.owner !== 'all' && !sameSeat(row.owner, query.owner) && row.owner !== query.owner) return false;
    if (query.el === 'missing' && row.elChip !== 'None') return false;
    if (query.lor === 'missing' && row.lorChip !== 'None') return false;
    if ((query.ready === '1' || query.ready === 'yes') && !row.ready) return false;
    return true;
  });
  return { rows: filtered, total: rows.length, stages, owners, warning: warning || '', query };
}

export function presentCase(store, row, now, extras = {}) {
  ensureCase(store, row, now);
  const summary = summarise(store, row, now);
  const docs = store.documentsFor(row.case_ref);
  const elDocs = docs.filter((doc) => doc.doc_type === 'engagement_letter' && doc.audience === 'client');
  const lorDocs = docs.filter((doc) => doc.doc_type === 'lender_pack' && doc.audience === 'lender');
  const current = currentDoc(store, row.case_ref, 'engagement_letter', 'client');
  const currentLor = currentDoc(store, row.case_ref, 'lender_pack', 'lender');
  const gate = processingGate(store, row.case_ref);
  const placements = store.placementsFor(row.case_ref);
  const offered = offeredLenders(row.eligible_lenders, row.lender_exclusions).map((lender) => {
    const sent = placements.filter((item) => item.lender === lender.name);
    const latest = sent.length ? sent[sent.length - 1] : null;
    return {
      name: lender.name,
      contact: contactLabel(lender.contact),
      baseline: baselineLender(lender.name),
      sentVersion: latest ? latest.version_no : null,
    };
  });
  const job = latestJob(row.case_ref);
  const target = processingWrite(extras.env || process.env);
  return {
    ...summary,
    elHistory: elDocs.map((doc) => ({
      id: doc.id,
      version: doc.version_no,
      status: doc.status,
      current: doc.is_current,
      filename: doc.filename,
      feeLine: doc.fee_line,
      hlDocId: doc.hl_doc_id || '',
    })),
    lorHistory: lorDocs.map((doc) => ({
      id: doc.id,
      version: doc.version_no,
      status: doc.status,
      current: doc.is_current,
      filename: doc.filename,
    })),
    signers: (current?.signers || []).map((signer) => ({
      name: signer.name,
      email: signer.email,
      viewed: signer.viewed_at ? formatParis(signer.viewed_at) : '',
      signed: signer.signed_at ? formatParis(signer.signed_at) : '',
    })),
    processing: {
      enabled: gate.enabled && summary.stageLabel !== 'Processing',
      reason: summary.stageLabel === 'Processing' ? 'Already in Processing.' : gate.reason,
      version: current ? current.version_no : '',
      signers: (current?.signers || []).map((signer) => ({
        name: signer.name,
        signed: signer.signed_at ? formatParis(signer.signed_at) : '',
      })),
      dbStage: target.stage,
      label: target.label,
    },
    lenders: offered,
    excludedCount: (row.eligible_lenders || []).length - offered.length + (row.lender_exclusions || []).length > 0
      ? (row.lender_exclusions || []).length
      : 0,
    sentLog: store.responsesFor(row.case_ref).map((item) => ({
      id: item.id,
      lender: item.lender,
      contact: contactLabel(placements.find((rowItem) => rowItem.id === item.placement_id)?.contact),
      version: item.version_no,
      sentAt: formatParis(item.sent_at),
      outcome: item.outcome,
    })),
    approvals: store.approvalsFor(row.case_ref).map((item) => ({
      id: item.id,
      actionType: item.action_type,
      status: item.status,
    })),
    timeline: store.eventsFor(row.case_ref).map((item) => ({
      label: item.label,
      from: item.from_stage,
      to: item.to_stage,
      at: formatParis(item.at),
      actor: item.actor,
    })),
    tasks: store.tasksFor(row.case_ref).map((item) => ({ title: item.title, open: item.open, blocking: item.blocking })),
    audit: store.auditsFor(row.case_ref).map((item) => ({
      action: item.action,
      actor: item.actor,
      at: formatParis(item.at),
      table: item.table_name,
      stage: item.new_row?.stage || '',
    })),
    job: job ? { status: job.status, id: job.id } : null,
    factFindSubmitted: row.fact_find_submitted === true,
    dbStageForBroka: summary.dbStage,
    mockSends: sendsAreMock(extras.env || process.env),
    noAiTooltip: NO_AI_TOOLTIP,
    canSimulate: row.is_test === true && !!current && current.status !== 'draft' && current.status !== 'none',
    currentElStatus: current?.status || 'none',
    currentLorVersion: currentLor ? currentLor.version_no : '',
    failures: extras.failures || [],
    notice: extras.notice || '',
    fileHeld: 'File held privately: request copy',
  };
}

function seatOf(fields) {
  return activeSeat(fields.seat);
}

function redirect(ref, notice) {
  return { status: 303, redirect: `/staff/cockpit/el/${encodeURIComponent(ref)}?notice=${encodeURIComponent(notice)}` };
}

export function runAction(store, row, fields, now, env = process.env, hooks = {}) {
  const seat = seatOf(fields);
  if (!seat) return { status: 401, error: 'seat' };
  const action = String(fields.action || '');
  const ref = row.case_ref;
  ensureCase(store, row, now);

  if (action === 'generate-el') {
    const extra = row.is_test === true ? String(fields.inject || '') : '';
    const built = buildEngagementLetter(row, extra);
    if (!built.checked.ok) return { status: 400, error: 'blocked', failures: built.checked.failures };
    const version = nextVersion(store, ref, 'engagement_letter', 'client');
    store.addDocument({
      case_ref: ref,
      doc_type: 'engagement_letter',
      audience: 'client',
      version_no: version,
      status: 'draft',
      body: built.body,
      filename: `${ref}-engagement-letter-v${version}.html`,
      signers: signersFrom(row),
      fee_line: built.fee_line,
      created_at: now,
    });
    return redirect(ref, 'el-draft');
  }

  if (action === 'generate-lor') {
    const extra = row.is_test === true ? String(fields.inject || '') : '';
    const version = nextVersion(store, ref, 'lender_pack', 'lender');
    const built = buildLenderCopy(row, version, extra);
    if (!built.checked.ok) return { status: 400, error: 'blocked', failures: built.checked.failures };
    store.addDocument({
      case_ref: ref,
      doc_type: 'lender_pack',
      audience: 'lender',
      version_no: version,
      status: 'draft',
      body: built.body,
      filename: `${ref}-lender-copy-v${version}.html`,
      signers: [],
      fee_line: '',
      created_at: now,
    });
    return redirect(ref, 'lor-draft');
  }

  if (action === 'request-esign') {
    if ((row.flags || []).includes('no_ai_contact')) return { status: 403, error: 'no_ai' };
    const current = currentDoc(store, ref, 'engagement_letter', 'client');
    if (!current || current.status !== 'draft') return { status: 409, error: 'draft' };
    const pending = store.approvalsFor(ref).find((item) => item.status === 'pending' && item.action_type === 'sign');
    if (!pending) {
      store.addApproval({
        case_ref: ref,
        action_type: 'sign',
        requested_by: seat.code,
        created_at: now,
        payload: { version: current.version_no, document_id: current.id },
      });
    }
    return redirect(ref, 'approval-pending');
  }

  if (action === 'request-lor-send') {
    const chosen = [].concat(fields.lenders || []).map((item) => String(item || '').trim()).filter(Boolean);
    if (!chosen.length) return { status: 400, error: 'lender' };
    const current = currentDoc(store, ref, 'lender_pack', 'lender');
    if (!current) return { status: 409, error: 'lor' };
    const picked = [];
    for (const name of chosen) {
      if (lenderExcluded({ name }, row.lender_exclusions)) return { status: 400, error: 'excluded' };
      const lender = offeredLenders(row.eligible_lenders, row.lender_exclusions).find((item) => item.name === name);
      if (!lender) return { status: 400, error: 'lender' };
      picked.push({ name: lender.name, contact: lender.contact || null });
    }
    const pending = store.approvalsFor(ref).find((item) => item.status === 'pending' && item.action_type === 'send_external');
    if (!pending) {
      store.addApproval({
        case_ref: ref,
        action_type: 'send_external',
        requested_by: seat.code,
        created_at: now,
        payload: { version: current.version_no, lenders: picked },
      });
    }
    return redirect(ref, 'approval-pending');
  }

  if (action === 'approve') {
    if (seat.code !== 'byron') return { status: 403, error: 'owner_only' };
    const approval = store.findApproval(String(fields.approval_id || ''));
    if (!approval || approval.case_ref !== ref) return { status: 404, error: 'approval' };
    if (approval.status !== 'approved') {
      approval.status = 'approved';
      approval.approved_by = seat.code;
      approval.approved_at = now;
      if (approval.action_type === 'sign') {
        const sent = dispatchAdapter('highlevel', {
          case_ref: ref,
          version: approval.payload.version,
          approval,
        }, env, hooks);
        if (!sent.ok) return { status: 409, error: sent.error || 'send' };
        const doc = store.documentsFor(ref).find((item) => item.id === approval.payload.document_id);
        if (doc) {
          doc.status = 'sent';
          doc.hl_doc_id = sent.docId;
        }
        return redirect(ref, 'mock-sent');
      }
      if (approval.action_type === 'send_external') {
        for (const lender of approval.payload.lenders || []) {
          if (lenderExcluded(lender, row.lender_exclusions)) return { status: 400, error: 'excluded' };
        }
        const sent = dispatchAdapter('lender_email', {
          case_ref: ref,
          lenders: approval.payload.lenders,
          approval,
        }, env, hooks);
        if (!sent.ok) return { status: 409, error: sent.error || 'send' };
        for (const lender of approval.payload.lenders || []) {
          const placement = store.addPlacement({
            case_ref: ref,
            lender: lender.name,
            contact: lender.contact,
            channel: 'direct_email',
            outcome: 'pending',
            sent_at: now,
            version_no: approval.payload.version,
          });
          store.addResponse({
            placement_id: placement.id,
            case_ref: ref,
            lender: lender.name,
            outcome: 'pending',
            sent_at: now,
            version_no: approval.payload.version,
          });
        }
        return redirect(ref, 'lor-sent');
      }
    }
    return redirect(ref, 'approval-pending');
  }

  if (action === 'simulate-viewed' || action === 'simulate-signed') {
    if (row.is_test !== true) return { status: 403, error: 'test_only' };
    const current = currentDoc(store, ref, 'engagement_letter', 'client');
    if (!current || current.status === 'draft') return { status: 409, error: 'draft' };
    if (action === 'simulate-viewed') {
      const signer = (current.signers || []).find((item) => !item.viewed_at);
      if (signer) signer.viewed_at = now;
    } else {
      const signer = (current.signers || []).find((item) => !item.signed_at);
      if (signer) {
        signer.signed_at = now;
        if (!signer.viewed_at) signer.viewed_at = now;
      }
    }
    const signers = current.signers || [];
    const signed = signers.filter((item) => item.signed_at).length;
    const viewed = signers.filter((item) => item.viewed_at).length;
    if (signers.length && signed === signers.length) {
      current.status = 'signed';
      current.counterparty_signed_at = now;
    } else if (signed > 0) current.status = 'partly_signed';
    else if (viewed === signers.length) current.status = 'viewed';
    return redirect(ref, action === 'simulate-viewed' ? 'viewed' : 'signed');
  }

  if (action === 'mark-signed') {
    if (seat.code !== 'byron') return { status: 403, error: 'owner_only' };
    const fileName = String(fields.file_name || '').trim();
    const fileLink = String(fields.file_link || '').trim();
    if (!fileName && !fileLink) return { status: 400, error: 'file' };
    const current = currentDoc(store, ref, 'engagement_letter', 'client');
    if (!current) return { status: 409, error: 'draft' };
    for (const signer of current.signers || []) {
      if (!signer.signed_at) signer.signed_at = now;
      if (!signer.viewed_at) signer.viewed_at = now;
    }
    current.status = 'signed';
    current.counterparty_signed_at = now;
    if (fileName) current.filename = fileName;
    if (fileLink) current.file_link = fileLink;
    return redirect(ref, 'marked');
  }

  if (action === 'record-response') {
    const outcome = String(fields.outcome || '');
    if (!OUTCOMES.has(outcome)) return { status: 400, error: 'outcome' };
    const updated = store.updateResponse(String(fields.response_id || ''), outcome);
    if (!updated || updated.case_ref !== ref) return { status: 404, error: 'response' };
    return redirect(ref, 'response');
  }

  if (action === 'move-processing') {
    const gate = processingGate(store, ref);
    const stage = stageOf(store, row);
    if (!gate.enabled || stage.stageLabel === 'Processing') {
      return { status: 409, error: 'processing', reason: stage.stageLabel === 'Processing' ? 'Already in Processing.' : gate.reason };
    }
    const target = processingWrite(env);
    store.setOverlay(ref, { stageLabel: target.label, dbStage: target.stage });
    store.addEvent({
      case_ref: ref,
      from_stage: stage.dbStage,
      to_stage: target.stage,
      label: target.label,
      at: now,
      actor: seat.code,
    });
    store.addAudit({
      table_name: 'pipeline.case_register',
      case_ref: ref,
      row_id: ref,
      action: 'UPDATE',
      actor: seat.code,
      at: now,
      new_row: { stage: target.stage, label: target.label, el_version: gate.current.version_no },
    });
    store.addTask({
      case_ref: ref,
      title: PROCESSING_TASK,
      open: true,
      blocking: false,
      created_at: now,
    });
    return redirect(ref, 'processing');
  }

  return { status: 400, error: 'action' };
}

export function documentBody(store, row, kind, now) {
  ensureCase(store, row, now);
  if (kind === 'el') {
    const current = currentDoc(store, row.case_ref, 'engagement_letter', 'client');
    if (!current || !current.body) return null;
    return { title: `Engagement letter v${current.version_no}`, body: current.body, filename: current.filename, kind: 'el' };
  }
  if (kind === 'lor') {
    const current = currentDoc(store, row.case_ref, 'lender_pack', 'lender');
    if (!current || !current.body) return null;
    return { title: `Lender copy v${current.version_no}`, body: current.body, filename: current.filename, kind: 'lor' };
  }
  return null;
}
