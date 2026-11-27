import { readCookie, readFields, redirect, sendHtml, setPrivate, writeStaffCookie } from '../lib/case-http.js';
import { establishSession, sessionAllows } from '../lib/cockpit-store.js';
import { applyDeskMoves, filterOwner, groupColumns, loadCrmBoard, selectLeads, summariseLeads, windowDays } from '../lib/pipeline.js';
import { renderConfirm, renderPipeline, renderPipelineLogin } from '../lib/pipeline-html.js';
import { BROKA, confirmCopy, feeDraft, lenderChoices, nextLor, queueExternal, scrub } from '../lib/pipeline-actions.js';

const MAIN = 'https://vgflcrfaudrvrdmxjdtl.supabase.co';
// Dedicated pipeline key, then the service role. The anon key is last: under RLS it reads 0 lead rows.
const KEY_ORDER = ['PIPELINE_SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'FF_SUPABASE_KEY'];

function firstSet(env, names) {
  for (const name of names) {
    const value = String(env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

export function pipelineConfig(env = process.env) {
  return {
    url: String(env.PIPELINE_SUPABASE_URL || env.FF_SUPABASE_URL || '').replace(/\/+$/, ''),
    key: firstSet(env, KEY_ORDER),
    days: windowDays(env),
  };
}

export function pipelineMode(req, fields = {}) {
  const url = new URL(req.url || '/', 'https://posfin.local');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const queryDemo = String(url.searchParams.get('demo') || (req.query && req.query.demo) || '').trim();
  const posted = String((fields && fields.demo) || '').trim();
  const demo = path === '/staff/cockpit/pipeline/demo'
    || path.endsWith('/pipeline/demo')
    || queryDemo === '1'
    || queryDemo === 'true'
    || posted === '1'
    || posted === 'true';
  const owner = String(url.searchParams.get('owner') || (req.query && req.query.owner) || 'all').trim() || 'all';
  return { demo, owner };
}

export async function fetchLeads(cfg, fetcher = fetch, now = Date.now()) {
  if (!cfg.url || !cfg.key || cfg.url !== MAIN) return { rows: [], blocked: cfg.url && cfg.url !== MAIN ? 'not_main_project' : 'missing_key' };
  const since = new Date(now - cfg.days * 86400000).toISOString();
  const query = [
    'select=id,full_name,email,phone,status,source,loan_amount_band,assigned_to,created_at,fb_created_time',
    `or=(and(fb_created_time.gte.${encodeURIComponent(since)}),and(fb_created_time.is.null,created_at.gte.${encodeURIComponent(since)}),status.neq.new)`,
    'limit=2000',
  ].join('&');
  const res = await fetcher(`${cfg.url}/rest/v1/leads?${query}`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
  });
  if (!res.ok) return { rows: [], blocked: `read_failed_${res.status}` };
  const rows = await res.json();
  return { rows: Array.isArray(rows) ? rows : [], blocked: '' };
}

export function boardFrom(leads, now, days, owner = 'all', options = {}) {
  const demo = !!(options && options.demo);
  const state = globalThis.__posfinPipelineActions || { moves: [] };
  if (demo) {
    const cases = applyDeskMoves(loadCrmBoard(), state.moves);
    const board = stamp(groupColumns(filterOwner(cases, owner)));
    board.intake = emptyIntake();
    board.demo = true;
    return board;
  }
  const rows = Array.isArray(leads) ? leads : [];
  const leadsOnly = applyDeskMoves(selectLeads(rows, now, days), state.moves);
  const board = stamp(groupColumns(filterOwner(leadsOnly, owner)));
  board.intake = summariseLeads(rows, now, days, new Set());
  board.demo = false;
  return board;
}

function emptyIntake() {
  return {
    fetched: 0,
    skipped: { test_source: 0, archived_new: 0, outside_window_still_new: 0 },
    selectedRows: 0,
    dedupedByContact: 0,
    nameClash: 0,
    cardsAdded: 0,
  };
}

function stamp(board) {
  const state = globalThis.__posfinPipelineActions || { lors: [], els: [], queue: [] };
  const cards = board.columns.flatMap((column) => column.cards).concat(board.parked, board.completed);
  for (const card of cards) {
    const versions = state.lors.filter((item) => item.caseRef === card.caseRef).map((item) => item.version);
    if (versions.length) card.history.push({ source: 'desk', stage: card.stage, note: `LOR versions kept: ${versions.join(', ')}` });
    const waiting = state.queue.filter((item) => item.caseRef === card.caseRef && item.status === 'awaiting Byron approval');
    for (const item of waiting) card.history.push({ source: 'desk', stage: card.stage, note: `${item.kind} awaiting Byron approval` });
  }
  return board;
}

function bag() {
  if (!globalThis.__posfinPipelineActions) globalThis.__posfinPipelineActions = { lors: [], els: [], queue: [], moves: [] };
  return globalThis.__posfinPipelineActions;
}

async function readBoard(env, owner, demo, fetcher = fetch) {
  const now = Date.now();
  if (demo) {
    return {
      board: boardFrom([], now, windowDays(env), owner, { demo: true }),
      loaded: { rows: [], blocked: '' },
      cfg: pipelineConfig(env),
    };
  }
  const cfg = pipelineConfig(env);
  const loaded = await fetchLeads(cfg, fetcher, now);
  return {
    board: boardFrom(loaded.rows, now, cfg.days, owner, { demo: false }),
    loaded,
    cfg,
  };
}

function boardCounts(board, loaded, demo) {
  const lanes = board.columns.map((column) => [column.title, column.cards]).concat([['Parked / Declined', board.parked], ['Completed', board.completed]]);
  const columns = lanes.map(([title, cards]) => ({
    title,
    total: cards.length,
    supabase: cards.filter((card) => card.source === 'supabase-leads').length,
    fixture: cards.filter((card) => card.source !== 'supabase-leads').length,
  }));
  const supabaseCards = columns.reduce((sum, column) => sum + column.supabase, 0);
  const fixtureCards = columns.reduce((sum, column) => sum + column.fixture, 0);
  return {
    mode: demo ? 'demo' : 'live',
    supabaseCards,
    fixtureCards,
    columns,
    leads: demo ? emptyIntake() : (board.intake || null),
    blocked: demo ? '' : (loaded.blocked || ''),
  };
}

function pageBanner(loaded, counts, days, demo) {
  if (demo) return `Demo mode. ${counts.fixtureCards} synthetic placeholder cards. Live client rows are not loaded.`;
  if (loaded.blocked) return `Live Supabase leads were not read (${loaded.blocked}). Synthetic placeholder cards are not shown. Nothing was written.`;
  const fetched = counts.leads && counts.leads.fetched != null ? counts.leads.fetched : 0;
  return `${counts.supabaseCards} live Supabase cards from ${fetched} rows read. Last ${days} days, plus older leads that are not still new. No rows were updated or deleted.`;
}

function viewOptions(board, loaded, cfg, owner, demo, banner) {
  return { owner, demo, banner, counts: boardCounts(board, loaded, demo), days: cfg.days };
}

async function handleAction(fields, res, env, owner, demo) {
  const stages = new Set(['raw', 'opener', 'new', 'contacting', 'fact_find', 'lor_requested', 'el_issued', 'el_sent', 'el_signed', 'parked', 'completed']);
  const current = await readBoard(env, owner, demo);
  const flat = current.board.columns.flatMap((column) => column.cards).concat(current.board.parked, current.board.completed);
  const card = flat.find((item) => item.caseRef === fields.case || item.id === fields.case);
  if (fields.action === 'move' || fields.action === 'route-chris') {
    if (!card) return sendHtml(res, 404, renderPipeline(current.board, viewOptions(current.board, current.loaded, current.cfg, owner, demo, 'That card is not on this board. Nothing was written.')));
    const now = new Date().toISOString();
    const movedBy = ['Byron', 'Chris', 'Aadi', 'Lizzy'].includes(fields.moved_by) ? fields.moved_by : 'Byron';
    const to = fields.action === 'route-chris' ? card.stage : fields.to;
    if (!stages.has(to)) return sendHtml(res, 400, renderPipeline(current.board, viewOptions(current.board, current.loaded, current.cfg, owner, demo, 'That stage is not on the board. Nothing was written.')));
    bag().moves.push({
      caseRef: card.caseRef || card.id,
      from: card.stage,
      to,
      owner: fields.action === 'route-chris' ? 'Chris' : undefined,
      movedBy,
      at: now,
      note: fields.action === 'route-chris' ? 'Routed to Chris' : (to === 'parked' ? 'Parked from the desk' : (demo ? 'Stage move on the demo board' : 'Stage move on the desk')),
    });
    const next = await readBoard(env, owner, demo);
    const label = fields.action === 'route-chris' ? `${card.caseRef || card.name} is now on Chris.` : `${card.caseRef || card.name} moved from ${card.stage} to ${to}.`;
    const banner = demo
      ? `${label} Demo board only. No live client row was read or changed.`
      : `${label} Kept on this desk only. No lead row was updated or deleted.`;
    return sendHtml(res, 200, renderPipeline(next.board, viewOptions(next.board, next.loaded, next.cfg, owner, demo, banner)));
  }
  if (!card) return sendHtml(res, 404, renderPipeline(current.board, viewOptions(current.board, current.loaded, current.cfg, owner, demo, 'That card is not on this board. Nothing was sent.')));
  const now = new Date().toISOString();
  const actor = 'Byron';
  const lenders = lenderChoices([].concat(fields.lenders || []));
  if (fields.action === 'lor') {
    const made = nextLor(bag().lors, card, actor, now);
    bag().lors.push(made.doc);
    card.history.push({ source: 'desk', stage: card.stage, note: `LOR v${made.doc.version} drafted. Prior versions kept: ${made.kept}. Not sent.` });
    return sendHtml(res, 200, renderPipeline(current.board, viewOptions(current.board, current.loaded, current.cfg, owner, demo, `LOR v${made.doc.version} saved for ${card.caseRef}. It has not been sent. PLACED was not called.`)));
  }
  if (fields.action === 'el') {
    const fees = feeDraft(card.loan, fields.proc, fields.broker);
    bag().els.push({ caseRef: card.caseRef, at: now, ...fees, status: 'draft' });
    const amounts = fees.loan == null ? 'Loan not confirmed, so the fee amounts are blank.' : `Proc ${fees.procPct}% and broker ${fees.brokerPct}%.`;
    return sendHtml(res, 200, renderPipeline(current.board, viewOptions(current.board, current.loaded, current.cfg, owner, demo, `EL draft saved for ${card.caseRef}. ${amounts} Not sent for signature.`)));
  }
  const external = fields.action === 'title' || fields.action === 'send-lor';
  if (external && fields.confirm !== 'yes') {
    const preview = queueExternal({
      kind: fields.action,
      caseRef: card.caseRef,
      lenders,
      chosen: [].concat(fields.lenders || [BROKA]),
      cost: fields.action === 'title' ? 'HMLR official copies are a paid order. The price is not confirmed here.' : 'No send fee is charged from this page.',
      actor,
      now,
    });
    return sendHtml(res, 200, renderConfirm(scrub(confirmCopy(preview)), { ...fields, demo: demo ? '1' : '', lenders: preview.recipients }));
  }
  const queued = queueExternal({
    kind: fields.action,
    caseRef: card.caseRef,
    lenders,
    chosen: [].concat(fields.lenders || [BROKA]),
    cost: fields.action === 'title' ? 'HMLR official copies are a paid order. The price is not confirmed here.' : 'No send fee is charged from this page.',
    actor,
    now,
  });
  bag().queue.push(queued);
  card.history.push({ source: 'desk', stage: card.stage, note: `${queued.kind} queued as ${queued.status}. PLACED not called.` });
  return sendHtml(res, 200, renderPipeline(current.board, viewOptions(current.board, current.loaded, current.cfg, owner, demo, `${queued.caseRef} is awaiting Byron approval. Recipients: ${queued.recipients.join(', ')}. Nothing was sent or charged.`)));
}

export default async function handler(req, res) {
  setPrivate(res);
  const env = process.env;
  try {
    if (req.method === 'POST') {
      const fields = await readFields(req);
      const { demo } = pipelineMode(req, fields);
      if (fields.password && !fields.action) {
        const login = await establishSession({ email: fields.email, password: fields.password }, { env });
        if (!login.ok) return sendHtml(res, 401, renderPipelineLogin({ demo }));
        writeStaffCookie(res, req, login.session);
        return redirect(res, demo ? '/staff/cockpit/pipeline/demo' : '/staff/cockpit/pipeline');
      }
      if (fields.action === 'lor' || fields.action === 'el' || fields.action === 'title' || fields.action === 'send-lor' || fields.action === 'move' || fields.action === 'route-chris') {
        const session = readCookie(req, 'pf_staff');
        if (!session || !await sessionAllows(session, { env })) return sendHtml(res, 401, renderPipelineLogin({ demo }));
        return handleAction(fields, res, env, 'all', demo);
      }
    }
    const { demo, owner } = pipelineMode(req);
    const session = readCookie(req, 'pf_staff');
    if (!session || !await sessionAllows(session, { env })) return sendHtml(res, 401, renderPipelineLogin({ demo }));
    const loaded = await readBoard(env, owner, demo);
    const banner = pageBanner(loaded.loaded, boardCounts(loaded.board, loaded.loaded, demo), loaded.cfg.days, demo);
    return sendHtml(res, 200, renderPipeline(loaded.board, viewOptions(loaded.board, loaded.loaded, loaded.cfg, owner, demo, banner)));
  } catch (error) {
    console.error('[pipeline]', error.code || 'pipeline_failed');
    let demo = false;
    try { demo = pipelineMode(req).demo; } catch { demo = false; }
    const board = boardFrom([], Date.now(), 60, 'all', { demo });
    const banner = demo
      ? 'The demo board could not be read. Nothing was written.'
      : 'Live Supabase leads could not be read. Synthetic placeholder cards are not shown. Nothing was written.';
    return sendHtml(res, 503, renderPipeline(board, { owner: 'all', demo, banner }));
  }
}
