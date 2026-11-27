// Current Race Card reads actual offers from public.current_race_card.
// Eligibility-Matched Lenders is a separate view and is never mixed into the card.
// Both reads use the Supabase service role, and only after a staff session is valid.

import { esc } from './case-portal.js';
import { commandServiceKey, commandSupabaseUrl } from './command-dashboard.js';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CASE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

export function normaliseCaseRef(value) {
  const ref = String(value || '').trim();
  return CASE_REF.test(ref) ? ref : '';
}

export function audienceOf(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'borrower' || raw === 'share' || raw === 'shareable') return 'borrower';
  return 'staff';
}

export function tabOf(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'eligibility' || raw === 'broad' || raw === 'broad-net') return 'eligibility';
  return 'card';
}

function text(value, max = 2000) {
  if (value == null) return '';
  return String(value).replace(/\u0000/g, '').trim().slice(0, max);
}

function redactEmails(value) {
  return text(value).replace(EMAIL, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
}

function shown(value, audience, max = 2000) {
  const clean = text(value, max);
  if (!clean) return '';
  if (audience !== 'borrower') return clean;
  return redactEmails(clean);
}

function num(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatGbp(value) {
  const number = num(value);
  if (number == null) return '';
  const digits = Number.isInteger(number) ? 0 : 2;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number);
}

export function formatPct(value) {
  const number = num(value);
  if (number == null) return '';
  const rounded = Math.round(number * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded}%`;
}

export function formatWhen(value) {
  const raw = text(value, 40);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(date);
}

export function bdmName(contact) {
  const withoutEmail = String(contact || '').replace(EMAIL, ' ');
  return withoutEmail.split(',')[0].replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isActualOffer(row) {
  if (!row || typeof row !== 'object') return false;
  if (!text(row.lender_name, 160)) return false;
  return row.gross_loan != null && row.gross_loan !== ''
    || row.net_loan != null && row.net_loan !== ''
    || row.ltv_pct != null && row.ltv_pct !== '';
}

export function headlineLine(offer, audience = 'staff') {
  if (!offer) return '';
  const lender = offer.lender_name || 'Lender';
  const who = audience === 'borrower' ? '' : (offer.bdm_name || '');
  const left = [lender, who].filter(Boolean).join(' / ');
  const ltv = offer.ltv_label ? `${offer.ltv_label} LTV` : '';
  const head = [left, ltv].filter(Boolean).join(' ');
  const amounts = [offer.gross_label ? `${offer.gross_label} gross` : '', offer.net_label ? `${offer.net_label} net` : ''].filter(Boolean).join(' / ');
  return amounts ? `${head} — ${amounts}` : head;
}

function presentOffer(row, audience) {
  if (!isActualOffer(row)) return null;
  const lender = text(row.lender_name, 160);
  const gross = num(row.gross_loan);
  const net = num(row.net_loan);
  const ltv = num(row.ltv_pct);
  const rate = num(row.rate_pm);
  const offer = {
    race_position: num(row.race_position),
    is_headline: row.is_headline === true,
    lender_name: lender,
    channel: shown(row.channel, audience, 80),
    product: shown(row.product, audience, 300),
    ltv_pct: ltv,
    ltv_label: formatPct(ltv),
    valuation_basis: num(row.valuation_basis),
    valuation_label: formatGbp(row.valuation_basis),
    gross_loan: gross,
    gross_label: formatGbp(gross),
    net_loan: net,
    net_label: formatGbp(net),
    rate_pm: rate,
    rate_label: rate == null ? '' : `${formatPct(rate)} per month`,
    term_months: num(row.term_months),
    arrangement_fee: shown(row.arrangement_fee, audience, 300),
    exit_fee: shown(row.exit_fee, audience, 300),
    conditions: shown(row.conditions, audience, 2000),
    date_received: text(row.date_received, 40),
    expiry: text(row.expiry, 40),
  };
  if (audience !== 'borrower') {
    offer.bdm_contact = text(row.bdm_contact, 240);
    offer.bdm_name = bdmName(row.bdm_contact);
    offer.proc_fee = text(row.proc_fee, 300);
    offer.offer_commentary = text(row.offer_commentary, 2000);
    offer.source = text(row.source, 400);
  }
  offer.headline_line = headlineLine(offer, audience);
  return offer;
}

function unwrapCard(payload) {
  let value = payload;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  if (Array.isArray(value)) value = value[0];
  return value && typeof value === 'object' ? value : {};
}

export function presentEligibility(rows, audience = 'staff') {
  const list = (Array.isArray(rows) ? rows : []).slice(0, 500).map((row) => {
    const lender = text(row?.lender_name, 160);
    if (!lender) return null;
    const offered = row.has_offer === true || row.has_offer === 'true' || row.has_offer === 't';
    const item = {
      lender_name: lender,
      has_offer: offered,
      status: offered ? 'Offer in' : 'Awaiting',
      match_source: shown(row.match_source, audience, 80),
      matched_at: text(row.matched_at, 40),
      lor_sent_at: text(row.lor_sent_at, 40),
      lor_channel: shown(row.lor_channel, audience, 80),
    };
    if (audience !== 'borrower') item.notes = text(row.notes, 500);
    return item;
  }).filter(Boolean);
  list.sort((a, b) => Number(b.has_offer) - Number(a.has_offer) || a.lender_name.localeCompare(b.lender_name));
  const offerIn = list.filter((item) => item.has_offer).length;
  return {
    matched: list.length,
    awaiting: list.length - offerIn,
    offer_in: offerIn,
    lenders: list,
  };
}

export function presentRaceBundle(cardPayload, matchRows, { caseRef, audience = 'staff', tab = 'card' } = {}) {
  const card = unwrapCard(cardPayload);
  const offers = (Array.isArray(card.offers) ? card.offers : [])
    .map((row) => presentOffer(row, audience))
    .filter(Boolean)
    .sort((a, b) => (a.race_position || 999) - (b.race_position || 999) || (b.net_loan || 0) - (a.net_loan || 0));
  const headline = presentOffer(card.headline_offer, audience) || offers.find((row) => row.is_headline) || offers[0] || null;
  return {
    ok: true,
    case_ref: caseRef || text(card.case_ref, 80),
    case_name: shown(card.case_name, audience, 200),
    audience,
    tab: tabOf(tab),
    commentary: shown(card.commentary, audience, 4000),
    updated_at: text(card.updated_at, 40),
    updated_label: formatWhen(card.updated_at),
    offer_count: offers.length,
    headline,
    offers,
    eligibility: presentEligibility(matchRows, audience),
  };
}

function fail(code, message) {
  const error = new Error(code);
  error.code = code;
  error.publicMessage = message;
  return error;
}

async function readJson(response) {
  const body = typeof response.text === 'function' ? await response.text() : '';
  if (!body) return null;
  try { return JSON.parse(body); } catch { return null; }
}

export async function loadRaceBundle(env, fetcher, caseRef, options = {}) {
  const ref = normaliseCaseRef(caseRef);
  if (!ref) throw fail('bad_case', 'A valid case reference is required.');
  const url = commandSupabaseUrl(env);
  const key = commandServiceKey(env);
  if (!url || !key) throw fail('not_configured', 'The race card is not configured on this server.');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };
  const fetchImpl = fetcher || fetch;
  const [cardRes, matchRes] = await Promise.all([
    fetchImpl(`${url}/rest/v1/rpc/current_race_card`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_case_ref: ref }),
    }),
    fetchImpl(`${url}/rest/v1/v_eligibility_matched_lenders?case_ref=eq.${encodeURIComponent(ref)}&select=case_ref,lender_name,match_source,matched_at,lor_sent_at,lor_channel,notes,has_offer&order=has_offer.desc,lender_name.asc&limit=500`, { headers }),
  ]);
  if (!cardRes.ok) {
    throw fail(cardRes.status === 404 ? 'schema_pending' : 'unavailable', 'The current race card could not be read.');
  }
  const card = await readJson(cardRes);
  let matches = [];
  if (matchRes.ok) {
    const rows = await readJson(matchRes);
    matches = Array.isArray(rows) ? rows : [];
  }
  const model = presentRaceBundle(card, matches, {
    caseRef: ref,
    audience: audienceOf(options.audience),
    tab: tabOf(options.tab),
  });
  if (!matchRes.ok) {
    model.eligibility_error = 'Eligibility matches could not be read.';
    const raw = unwrapCard(card);
    const matched = num(raw.eligibility_matched_count);
    const awaiting = num(raw.awaiting_count);
    if (matched != null) {
      model.eligibility.matched = matched;
      model.eligibility.awaiting = awaiting == null ? matched : awaiting;
      model.eligibility.offer_in = Math.max(matched - model.eligibility.awaiting, 0);
    }
  }
  return model;
}

export function racePaths(caseRef) {
  const id = encodeURIComponent(caseRef);
  return {
    commandCard: `/staff/command/race/${id}`,
    commandBroad: `/staff/command/eligibility/${id}`,
    pipelineCard: `/staff/cockpit/pipeline/race/${id}`,
    pipelineBroad: `/staff/cockpit/pipeline/eligibility/${id}`,
  };
}

function pageHref(surface, caseRef, tab, audience) {
  const paths = racePaths(caseRef);
  const pipeline = surface === 'pipeline';
  const base = tab === 'eligibility'
    ? (pipeline ? paths.pipelineBroad : paths.commandBroad)
    : (pipeline ? paths.pipelineCard : paths.commandCard);
  return audience === 'borrower' ? `${base}?audience=borrower` : base;
}

function backHref(surface) {
  return surface === 'pipeline' ? '/staff/cockpit/pipeline' : '/staff/command#pipeline';
}

function cell(value) {
  const clean = text(value, 2000);
  return clean ? esc(clean) : '—';
}

function offerRows(model) {
  const borrower = model.audience === 'borrower';
  const head = borrower
    ? ['#', 'Lender', 'Product', 'LTV', 'Gross', 'Net', 'Rate', 'Term', 'Arrangement', 'Exit', 'Received']
    : ['#', 'Lender', 'BDM', 'Product', 'LTV', 'Gross', 'Net', 'Rate', 'Term', 'Arrangement', 'Proc fee', 'Exit', 'Received', 'Broker notes'];
  const header = head.map((name) => `<th scope="col">${esc(name)}</th>`).join('');
  const body = model.offers.map((offer) => {
    const headline = offer.is_headline || offer.race_position === 1;
    const cells = borrower
      ? [offer.race_position || '', offer.lender_name, offer.product, offer.ltv_label, offer.gross_label, offer.net_label, offer.rate_label, offer.term_months ? `${offer.term_months} months` : '', offer.arrangement_fee, offer.exit_fee, offer.date_received]
      : [offer.race_position || '', offer.lender_name, offer.bdm_contact, offer.product, offer.ltv_label, offer.gross_label, offer.net_label, offer.rate_label, offer.term_months ? `${offer.term_months} months` : '', offer.arrangement_fee, offer.proc_fee, offer.exit_fee, offer.date_received, offer.offer_commentary];
    return `<tr${headline ? ' class="race-top"' : ''}>${cells.map((value) => `<td>${cell(value)}</td>`).join('')}</tr>`;
  }).join('');
  const empty = `<tr><td colspan="${head.length}">No lender has offered on this case yet. This card lists actual offers only.</td></tr>`;
  return `<div class="scroll"><table class="race-table"><caption>Live offers. Ranked by net loan. A newer offer from the same lender replaces the older one.</caption><thead><tr>${header}</tr></thead><tbody>${body || empty}</tbody></table></div>`;
}

function eligibilityRows(model) {
  const summary = model.eligibility || { matched: 0, awaiting: 0, offer_in: 0, lenders: [] };
  const counts = `${summary.matched} matched, ${summary.awaiting} awaiting, ${summary.offer_in} offer in`;
  const borrower = model.audience === 'borrower';
  const head = borrower
    ? ['Lender', 'Status', 'Source', 'Matched', 'LOR sent', 'Channel']
    : ['Lender', 'Status', 'Source', 'Matched', 'LOR sent', 'Channel', 'Notes'];
  const body = (summary.lenders || []).map((row) => {
    const cells = borrower
      ? [row.lender_name, row.status, row.match_source, formatWhen(row.matched_at) || row.matched_at, formatWhen(row.lor_sent_at) || row.lor_sent_at, row.lor_channel]
      : [row.lender_name, row.status, row.match_source, formatWhen(row.matched_at) || row.matched_at, formatWhen(row.lor_sent_at) || row.lor_sent_at, row.lor_channel, row.notes];
    return `<tr><td>${cells.map((value) => cell(value)).join('</td><td>')}</td></tr>`;
  }).join('');
  const empty = `<tr><td colspan="${head.length}">No eligibility-matched lenders for this case.</td></tr>`;
  const warning = model.eligibility_error ? `<p class="note">${esc(model.eligibility_error)}</p>` : '';
  return `<p class="race-counts"><b>${esc(counts)}</b> for ${esc(model.case_name || model.case_ref || 'this case')}.</p>${warning}<div class="scroll"><table class="race-table"><caption>Eligibility matches. This list is not a race card and includes lenders that have not offered.</caption><thead><tr>${head.map((name) => `<th scope="col">${esc(name)}</th>`).join('')}</tr></thead><tbody>${body || empty}</tbody></table></div>`;
}

function switcher(model, surface, interactive) {
  const cardOn = model.tab !== 'eligibility';
  const borrower = model.audience === 'borrower';
  if (interactive === 'drawer') {
    return `<div class="race-switch" role="tablist" aria-label="Case views"><button type="button" class="race-tab${cardOn ? ' on' : ''}" data-race-tab="card" aria-selected="${cardOn ? 'true' : 'false'}">Current Race Card</button><button type="button" class="race-tab${!cardOn ? ' on' : ''}" data-race-tab="eligibility" aria-selected="${cardOn ? 'false' : 'true'}">Eligibility-Matched Lenders (Broad Net)</button><button type="button" class="race-share" data-race-audience="${borrower ? 'staff' : 'borrower'}">${borrower ? 'Staff view' : 'Borrower-facing view'}</button></div>`;
  }
  const cardHref = pageHref(surface, model.case_ref, 'card', model.audience);
  const broadHref = pageHref(surface, model.case_ref, 'eligibility', model.audience);
  const shareHref = pageHref(surface, model.case_ref, model.tab, borrower ? 'staff' : 'borrower');
  return `<nav class="race-switch" aria-label="Case views"><a class="race-tab${cardOn ? ' on' : ''}" href="${esc(cardHref)}"${cardOn ? ' aria-current="page"' : ''}>Current Race Card</a><a class="race-tab${!cardOn ? ' on' : ''}" href="${esc(broadHref)}"${!cardOn ? ' aria-current="page"' : ''}>Eligibility-Matched Lenders (Broad Net)</a><a class="race-share" href="${esc(shareHref)}">${borrower ? 'Staff view' : 'Borrower-facing view'}</a></nav>`;
}

function cardPanel(model) {
  const headline = model.headline;
  const summary = model.eligibility || { matched: 0, awaiting: 0, offer_in: 0 };
  const counts = `${summary.matched} matched, ${summary.awaiting} awaiting, ${summary.offer_in} offer in`;
  const headlineHtml = headline
    ? `<article class="race-headline"><p class="race-kicker">Headline offer</p><h2>${esc(headline.headline_line)}</h2><p>${esc([headline.product, headline.rate_label, headline.term_months ? `${headline.term_months} months` : '', headline.valuation_label ? `Valuation ${headline.valuation_label}` : ''].filter(Boolean).join(' · '))}</p></article>`
    : `<article class="race-headline"><p class="race-kicker">Headline offer</p><h2>No offer in yet</h2><p>This card stays empty until a lender actually offers. Eligibility matches are not listed here.</p></article>`;
  const commentary = model.commentary
    ? `<aside class="race-commentary"><h3>Broker commentary</h3><p>${esc(model.commentary)}</p></aside>`
    : `<aside class="race-commentary"><h3>Broker commentary</h3><p>No broker commentary has been saved on this case.</p></aside>`;
  return `<div class="race-hero">${headlineHtml}${commentary}</div><p class="race-pointer">Eligibility-Matched Lenders (Broad Net): ${esc(counts)}. That list is a separate tab.</p>${offerRows(model)}`;
}

export function renderRaceCardFragment(model, options = {}) {
  const surface = options.surface === 'pipeline' ? 'pipeline' : 'command';
  const interactive = options.interactive === 'drawer' ? 'drawer' : 'page';
  const view = model && model.ok ? model : {
    ok: false,
    case_ref: model?.case_ref || '',
    case_name: '',
    audience: audienceOf(model?.audience),
    tab: tabOf(model?.tab),
    offers: [],
    eligibility: { matched: 0, awaiting: 0, offer_in: 0, lenders: [] },
  };
  const title = view.case_name || view.case_ref || 'Case';
  const modeNote = view.audience === 'borrower'
    ? 'Borrower-facing view. Lender BDM email addresses, the Posfin proc fee, and internal broker notes are hidden.'
    : (view.tab === 'eligibility'
      ? 'Staff view. Eligibility matches only. A lender is marked Offer in when an actual offer is on the race card.'
      : 'Staff view. Actual offers only.');
  const updated = view.updated_label ? `Updated ${view.updated_label}.` : '';
  const panel = view.ok
    ? (view.tab === 'eligibility' ? eligibilityRows(view) : cardPanel(view))
    : `<article class="note">${esc(model?.error || 'The current race card could not be loaded.')}</article>`;
  return `<article class="race-sheet" data-race-case="${esc(view.case_ref)}" data-audience="${esc(view.audience)}"><p class="race-back"><a href="${esc(backHref(surface))}">${surface === 'pipeline' ? 'Deal flow' : 'Command dashboard'}</a></p><header class="race-mast"><p class="race-kicker">Posfin</p><h1 id="race-title">${view.tab === 'eligibility' ? 'Eligibility-Matched Lenders (Broad Net)' : 'Current Race Card'}</h1><p>${esc(title)}${view.case_ref ? ` · ${esc(view.case_ref)}` : ''}</p><p class="race-live">${esc(updated)} This view refreshes as new offers arrive.</p></header>${switcher(view, surface, interactive)}<p class="race-mode">${esc(modeNote)}</p>${panel}</article>`;
}

export function renderRaceCardDocument(model, options = {}) {
  const surface = options.surface === 'pipeline' ? 'pipeline' : 'command';
  const fragment = renderRaceCardFragment(model, { ...options, surface, interactive: 'page' });
  const title = model?.tab === 'eligibility' ? 'Eligibility-Matched Lenders (Broad Net)' : 'Current Race Card';
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><meta http-equiv="refresh" content="20"><title>${esc(title)} — Posfin</title><link rel="stylesheet" href="/staff/command.css"></head><body class="race-page">${fragment}</body></html>`;
}
