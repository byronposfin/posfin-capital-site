import { flowActionsHtml, portalMode } from './flow-links.js';
import {
  getCase, listCases, loadFlowCases, matchInput, stageCounts,
} from './flow-cases.js';
import { buildEl, buildLor, renderPdf } from './flow-docs.js';
import {
  renderApprove, renderCasePage, renderDocument, renderDocumentError, renderHome, renderLenders, renderPlace,
} from './flow-html.js';
import { loadPlacedLenders } from './placed-lenders.js';
import { matchLenders, tierCounts } from './placed-match.js';
import { sharedFlowStore } from './flow-store.js';

export function isPrincipal(actor) {
  const seat = String(actor?.seat || actor?.code || '').trim().toLowerCase();
  const role = String(actor?.role || '').trim().toLowerCase();
  return seat === 'byron' || role === 'principal';
}

export function audienceOf(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'investor' || text === 'introducer') return text;
  return 'staff';
}

export function cleanVia(value) {
  const via = String(value || '').trim().toLowerCase();
  return via === 'broka' || via === 'placed' ? via : '';
}

function storeOf(deps) {
  return deps.store || sharedFlowStore();
}

function nowOf(deps) {
  return deps.now || new Date().toISOString();
}

function filled(value) {
  return value != null && String(value).trim() !== '';
}

export function presentHome() {
  const cases = listCases();
  return { status: 200, html: renderHome({ stages: stageCounts(cases), cases }) };
}

export function presentCase(flowCase, query, deps) {
  const match = matchLenders(matchInput(flowCase));
  const store = storeOf(deps);
  const html = renderCasePage({
    flowCase,
    match,
    counts: tierCounts(match),
    audience: audienceOf(query.audience),
    activity: store.activity(flowCase.ref),
    approvals: store.approvals(flowCase.ref),
    actions: flowActionsHtml(flowCase.ref),
    mode: portalMode(deps.env),
  });
  return { status: 200, html };
}

export function presentDocument(flowCase, kind, query, deps) {
  const options = {
    now: nowOf(deps),
    lender: query.lender,
    audience: audienceOf(query.audience),
  };
  const built = kind === 'el' ? buildEl(flowCase, options) : buildLor(flowCase, loadPlacedLenders(), options);
  if (!built.ok) return { status: 400, html: renderDocumentError(flowCase, built.error) };
  if (query.pdf) {
    return { status: 200, pdf: renderPdf(built.model), filename: built.model.filename };
  }
  return { status: 200, html: renderDocument(built.model) };
}

export function presentPlace(flowCase, via, deps, { record = false } = {}) {
  const match = matchLenders(matchInput(flowCase));
  const counts = tierCounts(match);
  if (record) {
    storeOf(deps).addActivity({
      at: nowOf(deps),
      caseRef: flowCase.ref,
      via,
      mode: 'demo',
      eligible: counts.eligible,
      unverified: counts.unverified,
      excluded: counts.excluded,
    });
  }
  return {
    status: 200,
    html: renderPlace({
      flowCase,
      match,
      via,
      audience: audienceOf(deps.audience),
      mode: 'demo',
    }),
  };
}

function lenderList(fields) {
  const value = fields.lender;
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (value == null || value === '') return [];
  return [String(value)];
}

function accurate(fields) {
  const value = fields.accurate;
  return value === true || value === 'yes' || value === 'on' || value === '1';
}

export function presentApprove(flowCase, via, actor, deps, extras = {}) {
  const match = matchLenders(matchInput(flowCase));
  return {
    status: extras.status || 200,
    html: renderApprove({
      flowCase,
      match,
      via,
      principal: isPrincipal(actor),
      warning: extras.warning || '',
      result: extras.result || '',
      resultStatus: extras.resultStatus || '',
    }),
  };
}

export function submitApproval(flowCase, fields, actor, deps) {
  const via = cleanVia(fields.via);
  if (!via) return presentApprove(flowCase, 'placed', actor, deps, { status: 400, warning: 'Choose BROKA or Placed. Nothing was submitted.' });
  const action = String(fields.action || '');
  const lenders = lenderList(fields);
  if (action === 'confirm') {
    if (!isPrincipal(actor)) {
      return presentApprove(flowCase, via, actor, deps, {
        status: 403,
        warning: 'Only Byron can confirm. Nothing was submitted.',
      });
    }
    if (!accurate(fields)) {
      return presentApprove(flowCase, via, actor, deps, {
        status: 400,
        warning: 'Tick the accuracy confirmation before this can be approved. Nothing was submitted.',
      });
    }
    if (lenders.length > 5) {
      return presentApprove(flowCase, via, actor, deps, {
        status: 400,
        warning: 'Choose at most five lenders. Nothing was submitted.',
      });
    }
    const entry = {
      at: nowOf(deps),
      caseRef: flowCase.ref,
      via,
      mode: 'live',
      status: 'approved_for_manual_placement',
      lenders,
      seat: actor.seat || 'byron',
    };
    storeOf(deps).addApproval(entry);
    return presentApprove(flowCase, via, actor, deps, {
      status: 200,
      result: 'Approved. Place manually on BROKA / Placed. Nothing was submitted automatically.',
      resultStatus: 'approved_for_manual_placement',
    });
  }
  if (action === 'request') {
    const entry = {
      at: nowOf(deps),
      caseRef: flowCase.ref,
      via,
      mode: 'live',
      status: 'pending_byron',
      lenders,
      seat: actor.seat || '',
    };
    storeOf(deps).addApproval(entry);
    return presentApprove(flowCase, via, actor, deps, {
      status: 200,
      result: "Approval requested. Byron's confirmation required. Nothing is placed until Byron confirms.",
      resultStatus: 'pending_byron',
    });
  }
  return presentApprove(flowCase, via, actor, deps, { status: 400, warning: 'That action is not available. Nothing was submitted.' });
}

export function presentLenders(query) {
  const all = loadPlacedLenders();
  const filters = {
    charge: String(query.charge || ''),
    regulated: String(query.regulated || ''),
    segment: String(query.segment || ''),
    grade: String(query.grade || ''),
    stale: String(query.stale || ''),
  };
  const rows = all.filter((row) => {
    if (filters.charge === 'unknown') {
      if (row.charge) return false;
    } else if (filters.charge && !String(row.charge).includes(filters.charge)) return false;
    if (filters.regulated === 'unknown') {
      if (row.regulated) return false;
    } else if (filters.regulated && row.regulated !== filters.regulated) return false;
    if (filters.segment && row.segment !== filters.segment) return false;
    if (filters.grade && row.grade !== filters.grade) return false;
    if (filters.stale === 'yes' && row.stale !== true) return false;
    if (filters.stale === 'no' && row.stale === true) return false;
    return true;
  });
  const columns = [
    'grade', 'source', 'source_date', 'segment', 'charge', 'regulated', 'development',
    'max_ltv_first', 'max_ltv_second', 'max_ltgdv', 'max_ltc', 'loan_min', 'loan_max',
    'term_max', 'rate_pcm', 'valuation', 'avm_desktop', 'in_house_valuer', 'dual_rep', 'build_costs',
  ];
  const coverage = { lenders: all.length, stale: all.filter((row) => row.stale).length };
  for (const column of columns) coverage[column] = all.filter((row) => filled(row[column])).length;
  const unique = (key) => [...new Set(all.map((row) => row[key]).filter(filled))].sort((a, b) => String(a).localeCompare(String(b)));
  return {
    status: 200,
    html: renderLenders({
      rows,
      total: all.length,
      filters,
      coverage,
      filterOptions: {
        charge: ['first', 'second', 'unknown'],
        regulated: ['Y', 'N', 'both', 'unknown'],
        segment: unique('segment'),
        grade: unique('grade'),
      },
    }),
  };
}

export function findFlowCase(ref) {
  return getCase(ref);
}

export function flowCaseCount() {
  return loadFlowCases().length;
}
