import { readCookie, readFields, redirect, sendHtml, setPrivate, writeStaffCookie } from '../lib/case-http.js';
import { establishSession, sessionAllows } from '../lib/cockpit-store.js';
import { PREVIEW_CASES, PREVIEW_SCORE_ROWS, caseRefOk, caseShortlist, factFindSubmitted, groupResults, lenderScorecard, preflight } from '../lib/broka.js';
import { renderBrokaCase, renderBrokaLogin, renderBrokaMessage, renderScorecard } from '../lib/broka-html.js';
import { getSearchControl, latestJob, listDirectory, listPrepared, listResults, prepareEmails, recordResult, recordSentAt, setSearchPaused } from '../lib/broka-state.js';

const STAGES = new Set([
  'raw_lead', 'opener_sent', 'new_triage', 'contacting', 'fact_find', 'lor_requested',
  'el_issued', 'el_sent', 'el_signed', 'parked', 'completed', 'enquiry', 'factfind',
  'packaging', 'placement', 'terms_received', 'terms_issued', 'terms', 'applied', 'gathering',
]);

export function caseView(caseRef, stage) {
  const safeStage = STAGES.has(stage) ? stage : '';
  const fixture = PREVIEW_CASES[caseRef] || null;
  const submitted = fixture ? fixture.factFindSubmitted === true : factFindSubmitted({ stage: safeStage });
  const answers = fixture ? fixture.answers : {};
  return {
    caseRef,
    title: fixture ? fixture.title : caseRef,
    stage: fixture ? fixture.stage : safeStage,
    submitted,
    brokaCaseId: fixture ? fixture.brokaCaseId : null,
    preflight: preflight(answers, fixture ? fixture.regulated : null),
    control: getSearchControl(),
    job: latestJob(caseRef),
    results: groupResults(listResults(caseRef), listDirectory()),
    prepared: listPrepared(caseRef),
  };
}

function caseRefFrom(req) {
  const raw = req.query?.case || req.query?.caseRef || '';
  return caseRefOk(raw) ? raw : '';
}

export async function handleBrokaDesk(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  const depsEnv = { ...deps, env };
  try {
    if (req.method === 'POST') {
      const fields = await readFields(req);
      if (fields.password && !fields.action) {
        const login = await establishSession(String(fields.password || ''), depsEnv);
        if (!login.ok) return sendHtml(res, 401, renderBrokaLogin());
        writeStaffCookie(res, req, login.session);
        const next = caseRefOk(fields.case_ref) ? fields.case_ref : 'PREVIEW-NORTHGATE';
        return redirect(res, `/staff/cockpit/broka/${encodeURIComponent(next)}`);
      }
      const session = readCookie(req, 'pf_staff');
      if (!session || !await sessionAllows(session, depsEnv)) return sendHtml(res, 401, renderBrokaLogin());
      const caseRef = caseRefOk(fields.case_ref) ? fields.case_ref : caseRefFrom(req);
      if (!caseRef) return sendHtml(res, 404, renderBrokaMessage('Not on this desk', 'That case reference is not available.'));
      if (fields.action === 'prepare-emails') {
        const view = caseView(caseRef, fields.stage);
        if (!view.submitted) return sendHtml(res, 409, renderBrokaMessage('Not prepared', 'Prepare emails only after the fact find is submitted. Nothing was sent.'));
        const regulated = fields.regulated === 'yes' ? true : fields.regulated === 'no' ? false : view.preflight.regulated;
        const prepared = prepareEmails({ caseRef, regulated, now: deps.now });
        if (!prepared.ok) return sendHtml(res, 400, renderBrokaMessage('Not prepared', 'Those lender notes were not prepared. Nothing was sent.'));
        return sendHtml(res, 200, renderBrokaCase(caseView(caseRef, fields.stage), `${prepared.rows.length} lender notes prepared. Nothing was sent.`));
      }
      if (fields.action === 'record-sent') {
        const stamped = recordSentAt({ seat: String(fields.seat || ''), caseRef, responseId: String(fields.response_id || ''), now: deps.now });
        if (!stamped.ok) return sendHtml(res, 403, renderBrokaMessage('Not stamped', 'Only Byron can record sent_at. No email was sent.'));
        return sendHtml(res, 200, renderBrokaCase(caseView(caseRef, fields.stage), 'sent_at recorded. No email was sent.'));
      }
      if (fields.action === 'record-result') {
        const saved = recordResult({
          caseRef,
          lender: fields.lender,
          terms: {
            rate: fields.rate,
            fee: fields.fee,
            ltv: fields.ltv,
            term_months: fields.term_months,
            gross: fields.gross,
            net: fields.net,
          },
        });
        if (!saved.ok) return sendHtml(res, 400, renderBrokaMessage('Not recorded', 'That lender result was not stored. Nobody was contacted.'));
        const note = saved.created ? `${saved.result.lender} was added to the PLACED directory. Nobody was contacted.` : 'Result recorded. Nobody was contacted.';
        return sendHtml(res, 200, renderBrokaCase(caseView(caseRef, fields.stage), note));
      }
      if (fields.action === 'pause' || fields.action === 'resume') {
        const changed = setSearchPaused(String(fields.seat || ''), fields.action === 'pause');
        if (!changed.ok) return sendHtml(res, 403, renderBrokaMessage('Not changed', 'Only Byron can pause or resume searches. Nothing was sent.'));
        const view = caseView(caseRef, fields.stage);
        const text = changed.control.paused ? 'Searches are paused. New jobs wait for approval.' : 'Searches resumed under the standing approval.';
        return sendHtml(res, 200, renderBrokaCase(view, text));
      }
      return sendHtml(res, 400, renderBrokaMessage('Not available', 'That action is not on this check.'));
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendHtml(res, 405, renderBrokaMessage('Not available', 'Open the check in a browser.'));
    }
    const session = readCookie(req, 'pf_staff');
    if (!session || !await sessionAllows(session, depsEnv)) return sendHtml(res, 401, renderBrokaLogin());
    if (req.query?.view === 'scorecard' || req.query?.case === 'scorecard') {
      const focus = caseRefOk(req.query?.focus) ? req.query.focus : 'PREVIEW-NORTHGATE';
      const rows = PREVIEW_SCORE_ROWS.filter((row) => row.status !== 'withdrawn');
      return sendHtml(res, 200, renderScorecard({
        caseRef: focus,
        scorecard: lenderScorecard(rows),
        shortlist: caseShortlist(rows.filter((row) => row.caseRef === focus)),
      }));
    }
    const caseRef = caseRefFrom(req);
    if (!caseRef) return sendHtml(res, 404, renderBrokaMessage('Not on this desk', 'That case reference is not available.'));
    const stage = String(req.query?.stage || '');
    const notice = {
      approved: 'Job recorded as approved under the standing approval. BROKA was not contacted.',
      awaiting_approval: 'Job recorded and waiting for approval. BROKA was not contacted.',
    }[String(req.query?.notice || '')] || '';
    return sendHtml(res, 200, renderBrokaCase(caseView(caseRef, stage), notice));
  } catch (error) {
    console.error('[broka-desk]', error.code || 'broka_desk_failed');
    return sendHtml(res, 503, renderBrokaMessage('Please try again', 'The check is temporarily unavailable.'));
  }
}

export default function handler(req, res) {
  return handleBrokaDesk(req, res, {});
}
