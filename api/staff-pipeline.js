import { readCookie, readFields, redirect, sendHtml, sendJson, setPrivate, writeStaffCookie } from '../lib/case-http.js';
import { establishSession, sessionAllows } from '../lib/cockpit-store.js';
import { applyDeskMoves, filterOwner, groupColumns, loadCrmBoard, selectLeads, summariseLeads, windowDays } from '../lib/pipeline.js';
import { renderConfirm, renderPipeline, renderPipelineLogin } from '../lib/pipeline-html.js';
import { BROKA, confirmCopy, feeDraft, lenderChoices, nextLor, queueExternal, scrub } from '../lib/pipeline-actions.js';
import { audienceOf, loadRaceBundle, normaliseCaseRef, renderRaceCardDocument, tabOf } from '../lib/race-card.js';

const MAIN = 'https://vgflcrfaudrvrdmxjdtl.supabase.co';

export function pipelineConfig(env = process.env) {
  return {
    url: String(env.PIPELINE_SUPABASE_URL || env.FF_SUPABASE_URL || '').replace(/\/+$/, ''),
    key: String(env.PIPELINE_SUPABASE_KEY || env.FF_SUPABASE_KEY || '').trim(),
    days: windowDays(env),
  };
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

export function boardFrom(leads, now, days, owner = 'all') {
  const state = globalThis.__posfinPipelineActions || { moves: [] };
  const cases = applyDeskMoves(loadCrmBoard(), state.moves);
  const intake = selectLeads(leads, now, days);
  const caseNames = new Set(cases.map((card) => String(card.name || '').toLowerCase()).filter(Boolean));
  const leadsOnly = applyDeskMoves(intake.filter((card) => !card.name || !caseNames.has(String(card.name).toLowerCase())), state.moves);
  const board = stamp(groupColumns(filterOwner(cases.concat(leadsOnly), owner)));
  board.intake = summariseLeads(leads, now, days, caseNames);
  return board;
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

function handleAction(fields, res, env, owner) {
  const stages = new Set(['raw', 'opener', 'new', 'contacting', 'fact_find', 'lor_requested', 'el_issued', 'el_sent', 'el_signed', 'parked', 'completed']);
  if (fields.action === 'move' || fields.action === 'route-chris') {
    const board = boardFrom([], Date.now(), windowDays(env), owner);
    const flat = board.columns.flatMap((column) => column.cards).concat(board.parked, board.completed);
    const card = flat.find((item) => item.caseRef === fields.case || item.id === fields.case);
    if (!card) return sendHtml(res, 404, renderPipeline(board, { owner, banner: 'That card is not on this board. Nothing was written.' }));
    const now = new Date().toISOString();
    const movedBy = ['Byron', 'Chris', 'Aadi', 'Lizzy'].includes(fields.moved_by) ? fields.moved_by : 'Byron';
    const to = fields.action === 'route-chris' ? card.stage : fields.to;
    if (!stages.has(to)) return sendHtml(res, 400, renderPipeline(board, { owner, banner: 'That stage is not on the board. Nothing was written.' }));
    bag().moves.push({
      caseRef: card.caseRef || card.id,
      from: card.stage,
      to,
      owner: fields.action === 'route-chris' ? 'Chris' : undefined,
      movedBy,
      at: now,
      note: fields.action === 'route-chris' ? 'Routed to Chris' : (to === 'parked' ? 'Parked from the desk' : 'Stage move on the preview'),
    });
    const next = boardFrom([], Date.now(), windowDays(env), owner);
    const label = fields.action === 'route-chris' ? `${card.caseRef || card.name} is now on Chris.` : `${card.caseRef || card.name} moved from ${card.stage} to ${to}.`;
    return sendHtml(res, 200, renderPipeline(next, { owner, banner: `${label} History is on this preview only. No lead, deal, or sheet row was changed.` }));
  }
  const board = boardFrom([], Date.now(), windowDays(env), owner);
  const flat = board.columns.flatMap((column) => column.cards).concat(board.parked, board.completed);
  const card = flat.find((item) => item.caseRef === fields.case || item.id === fields.case);
  if (!card) return sendHtml(res, 404, renderPipeline(board, { banner: 'That card is not on this board. Nothing was sent.' }));
  const now = new Date().toISOString();
  const actor = 'Byron';
  const lenders = lenderChoices([].concat(fields.lenders || []));
  if (fields.action === 'lor') {
    const made = nextLor(bag().lors, card, actor, now);
    bag().lors.push(made.doc);
    card.history.push({ source: 'desk', stage: card.stage, note: `LOR v${made.doc.version} drafted. Prior versions kept: ${made.kept}. Not sent.` });
    return sendHtml(res, 200, renderPipeline(board, { owner, banner: `LOR v${made.doc.version} saved for ${card.caseRef}. It has not been sent. PLACED was not called.` }));
  }
  if (fields.action === 'el') {
    const fees = feeDraft(card.loan, fields.proc, fields.broker);
    bag().els.push({ caseRef: card.caseRef, at: now, ...fees, status: 'draft' });
    const amounts = fees.loan == null ? 'Loan not confirmed, so the fee amounts are blank.' : `Proc ${fees.procPct}% and broker ${fees.brokerPct}%.`;
    return sendHtml(res, 200, renderPipeline(board, { owner, banner: `EL draft saved for ${card.caseRef}. ${amounts} Not sent for signature.` }));
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
    return sendHtml(res, 200, renderConfirm(scrub(confirmCopy(preview)), { ...fields, lenders: preview.recipients }));
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
  return sendHtml(res, 200, renderPipeline(board, { owner, banner: `${queued.caseRef} is awaiting Byron approval. Recipients: ${queued.recipients.join(', ')}. Nothing was sent or charged.` }));
}

function queryOf(req) {
  let fromUrl = {};
  try {
    fromUrl = Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);
  } catch {
    fromUrl = {};
  }
  return { ...fromUrl, ...(req.query || {}) };
}

async function serveRace(res, env, deps, query) {
  const caseRef = normaliseCaseRef(query.race);
  const audience = audienceOf(query.audience);
  const tab = tabOf(query.tab);
  const format = String(query.format || '').trim().toLowerCase();
  if (!caseRef) {
    const message = 'A valid case reference is required.';
    return format === 'json'
      ? sendJson(res, 400, { error: message })
      : sendHtml(res, 400, renderRaceCardDocument({ ok: false, error: message, audience, tab }, { surface: 'pipeline' }));
  }
  try {
    const model = await loadRaceBundle(env, deps.fetch || fetch, caseRef, { audience, tab });
    if (format === 'json') return sendJson(res, 200, model);
    return sendHtml(res, 200, renderRaceCardDocument(model, { surface: 'pipeline' }));
  } catch (error) {
    const status = error?.code === 'not_configured' || error?.code === 'schema_pending' ? 503 : 502;
    const message = error?.publicMessage || 'The current race card could not be read.';
    if (format === 'json') return sendJson(res, status, { error: message });
    return sendHtml(res, status, renderRaceCardDocument({ ok: false, error: message, case_ref: caseRef, audience, tab }, { surface: 'pipeline' }));
  }
}

export default async function handler(req, res, deps = {}) {
  setPrivate(res);
  const env = deps.env || process.env;
  try {
    if (req.method === 'POST') {
      const fields = await readFields(req);
      if (fields.password && !fields.action) {
        const login = await establishSession({ email: fields.email, password: fields.password }, { env });
        if (!login.ok) return sendHtml(res, 401, renderPipelineLogin());
        writeStaffCookie(res, req, login.session);
        return redirect(res, '/staff/cockpit/pipeline');
      }
      if (fields.action === 'lor' || fields.action === 'el' || fields.action === 'title' || fields.action === 'send-lor' || fields.action === 'move' || fields.action === 'route-chris') {
        const session = readCookie(req, 'pf_staff');
        if (!session || !await sessionAllows(session, { env })) return sendHtml(res, 401, renderPipelineLogin());
        return handleAction(fields, res, env, 'all');
      }
    }
    const session = readCookie(req, 'pf_staff');
    if (!session || !await sessionAllows(session, { env, fetch: deps.fetch })) return sendHtml(res, 401, renderPipelineLogin());
    const query = queryOf(req);
    if (query.race) return serveRace(res, env, deps, query);
    const now = Date.now();
    const cfg = pipelineConfig(env);
    const loaded = await fetchLeads(cfg, fetch, now);
    const owner = new URL(req.url || '/', 'https://posfin.local').searchParams.get('owner') || 'all';
    const board = boardFrom(loaded.rows, now, cfg.days, owner);
    const lanes = board.columns.map((column) => [column.title, column.cards]).concat([['Parked / Declined', board.parked], ['Completed', board.completed]]);
    const columns = lanes.map(([title, cards]) => ({
      title,
      total: cards.length,
      supabase: cards.filter((card) => card.source === 'supabase-leads').length,
      fixture: cards.filter((card) => card.source !== 'supabase-leads').length,
    }));
    const supabaseCards = columns.reduce((sum, column) => sum + column.supabase, 0);
    const counts = { supabaseCards, columns, leads: board.intake || null, blocked: loaded.blocked || '' };
    const banner = loaded.blocked
      ? `Lead rows were not read (${loaded.blocked}). Fixture cards are still shown. Nothing was written.`
      : `${supabaseCards} Supabase cards from ${counts.leads.fetched} rows read. Last ${cfg.days} days, plus older leads that are not still new. No rows were updated or deleted.`;
    return sendHtml(res, 200, renderPipeline(board, { owner, banner, counts }));
  } catch (error) {
    console.error('[pipeline]', error.code || 'pipeline_failed');
    return sendHtml(res, 503, renderPipeline(boardFrom([], Date.now(), 60), { banner: 'The pipeline could not be read. Nothing was written.' }));
  }
}
