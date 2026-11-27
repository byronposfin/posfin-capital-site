import { esc } from './case-portal.js';
import { POSFIN_PHONE_DISPLAY, POSFIN_PHONE_TEL, POSFIN_WHATSAPP } from './contact.js';
import {
  POINTS,
  POINT_IDS,
  ROUTE,
  phaseOf,
  latestRound,
  editorInputs,
  answeredCount,
  normaliseState,
  proposedComplete,
} from './wirral-response.js';

const RULE = 'Your words only — we will never put words in your mouth. Speak or type your exact facts below, and we\'ll iterate the lender-facing wording back and forth with you until you confirm it\'s complete and ready.';
const PROPOSED_LABEL = 'Positioned strictly from your exact inputs — nothing added';
const CONFIRM = 'I confirm this is accurate, complete, and ready for CrowdProperty';

const CSS = `
:root{--navy:#1C184F;--ink:#13113A;--gold:#D4A853;--paper:#F6F4EF;--line:#E4DFD4;--teal:#0E7C78;--urgent:#9F1239;--ok:#E7F6F3}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper);font-size:16px;line-height:1.5}
button,input,textarea{font:inherit}
a{color:var(--teal)}
.wrap{max-width:720px;margin:0 auto;padding:0 16px 64px}
header.top{background:linear-gradient(180deg,#1C184F 0%,#13113A 100%);color:#fff;padding:18px 16px 22px}
.top-inner{max-width:720px;margin:0 auto}
.brand{display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand img{height:34px;width:auto}
.private{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72)}
header.top h1{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:32px;line-height:1.1;margin:18px 0 6px}
.addr{margin:0;color:rgba(255,255,255,.82)}
.banner{margin-top:18px;border-radius:16px;padding:16px;background:#fff;color:var(--ink)}
.eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal);font-weight:700;margin:0 0 4px}
.banner h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:26px;line-height:1.15;margin:0 0 8px}
.banner p{margin:0}
.rule{margin:14px 0 0;border-radius:16px;padding:14px 16px;background:#FFF6DF;color:#3d3010;border:1px solid #E2C98A}
.rule p{margin:0}
.rule strong{display:block;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8A6116;margin-bottom:4px}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;margin:0 0 12px}
.card.critical{border-color:#E2C98A;box-shadow:inset 4px 0 0 var(--gold)}
.card h3{margin:6px 0;font-size:18px;line-height:1.3}
.q{margin:0 0 12px}
.badge{display:inline-block;background:#FFF6DF;color:#8A6116;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:4px 8px;border-radius:999px}
.done-flag{display:inline-block;background:var(--ok);color:var(--teal);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;padding:4px 8px;border-radius:999px}
label{display:block;font-weight:700;margin:10px 0 6px}
textarea,input[type=text],select{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff;min-height:48px}
textarea{min-height:120px;resize:vertical}
.mic{width:100%;display:flex;align-items:center;gap:12px;margin:12px 0;padding:12px;border-radius:16px;border:0;background:var(--navy);color:#fff;cursor:pointer;text-align:left}
.mic .orb{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;background:#fff;color:var(--navy);flex:0 0 auto}
.mic strong{display:block;font-size:17px}
.mic.rec{background:#9F1239}
.mic.rec .orb{color:#9F1239;animation:micpulse 1s ease-in-out infinite}
@keyframes micpulse{0%{box-shadow:0 0 0 0 rgba(212,168,83,.75)}100%{box-shadow:0 0 0 16px rgba(212,168,83,0)}}
.timer{font-variant-numeric:tabular-nums;font-weight:700;color:var(--gold);margin:0 0 8px}
.hint,.voice-note{color:#5C5670;font-size:14px;margin:8px 0 0}
.voice-note{min-height:1.2em;font-weight:700;color:var(--navy)}
button.send,button.secondary{min-height:48px;border-radius:12px;padding:12px 14px;border:1px solid var(--line);background:#fff;cursor:pointer}
button.send{background:var(--navy);color:#fff;border-color:var(--navy);font-weight:700;width:100%}
button.secondary{font-weight:700}
button:disabled{opacity:.55;cursor:default}
.pair{display:grid;gap:10px;margin-top:8px}
.slot{margin:0;padding:12px;border-radius:12px;background:#F6F4EF}
.slot.proposed{background:#FFF6DF}
.slot .k{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6B6578;font-weight:700}
.slot p{margin:6px 0 0;white-space:pre-wrap}
.confirm{display:flex;gap:10px;align-items:flex-start;font-weight:700;margin-top:12px}
.confirm input{width:22px;height:22px;margin-top:2px;flex:0 0 auto}
.submit-bar{padding:16px 0 8px}
.notice{background:var(--ok);border-radius:12px;padding:12px;margin:0 0 12px}
.notice p{margin:0}
.staff-banner{background:#13113A;color:#fff;border-radius:18px;padding:16px;margin:0 0 12px}
.staff-banner a{color:var(--gold)}
.footer{margin-top:28px;padding-top:16px;border-top:1px solid var(--line);color:#5C5670;font-size:14px}
.footer strong{color:var(--navy)}
details.history{margin-top:8px}
details.history summary{cursor:pointer;font-weight:700}
@media (min-width:720px){
  header.top h1{font-size:40px}
  .pair{grid-template-columns:1fr 1fr}
}
@media (prefers-reduced-motion:reduce){
  .mic.rec .orb{animation:none}
}
`;

function ukStamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function micIcon() {
  return '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2z"/></svg>';
}

function micControl() {
  return `<button type="button" class="mic" data-mic aria-pressed="false"><span class="orb">${micIcon()}</span><span><strong>Tap to speak your answer</strong><span class="mic-state">Your words appear in the box as you speak. You can edit them before anything is sent.</span></span></button><p class="timer" data-timer hidden>0:00</p><p class="voice-note" data-voice-note role="status"></p>`;
}

function quote(text) {
  const value = String(text || '').trim();
  if (!value) return '<p class="hint">Nothing here yet.</p>';
  return `<p>${esc(value)}</p>`;
}

function captureBox(point, value, documents, field) {
  const verbatim = field === 'proposed' ? 'data-proposed' : 'data-verbatim';
  const doc = field === 'proposed' ? '' : `<label for="${point.id}-docs">Supporting document reference, optional</label><textarea id="${point.id}-docs" data-documents maxlength="2000" placeholder="For example, HMRC correspondence or a CCJ satisfaction receipt. Name it here, and send the copy to Byron on WhatsApp if he needs it.">${esc(documents || '')}</textarea>`;
  const label = field === 'proposed' ? 'Lender-facing wording' : 'Your exact words';
  return `<div data-capture><label for="${point.id}-${field}">${label}</label>${micControl()}<textarea id="${point.id}-${field}" ${verbatim} maxlength="${field === 'proposed' ? 8000 : 8000}" placeholder="Your exact words">${esc(value || '')}</textarea>${doc}</div>`;
}

function exactBlock(inputs) {
  const docs = String(inputs.documents || '').trim();
  return `<div class="slot"><span class="k">Your exact input</span>${quote(inputs.verbatim)}${docs ? `<p class="hint">Documents: ${esc(docs)}</p>` : ''}</div>`;
}

function proposedBlock(proposed) {
  const wording = proposed && proposed.wording;
  return `<div class="slot proposed"><span class="k">Proposed lender-facing wording</span><p class="hint">${esc(PROPOSED_LABEL)}</p>${wording && String(wording).trim() ? quote(wording) : '<p class="hint">Byron has not sent wording for this point yet. Nothing here is invented.</p>'}</div>`;
}

function statusCopy(phase, round) {
  if (phase === 'collecting') return 'Round 1 — your exact facts. Nothing is sent until you press the button.';
  if (phase === 'awaiting_draft') return `Round ${round.number} is with Byron. These are your words. Correct anything that is wrong, then send the update. Lender-facing wording appears only after you have seen it.`;
  if (phase === 'in_review') return `Round ${round.number} — please check the wording. Your exact input is beside it. A blank correction keeps the exact words you already sent for that point.`;
  return `You confirmed round ${round.number}. It is marked ready for CrowdProperty. Posfin has not sent it until Byron does.`;
}

function history(rounds) {
  if (!rounds || rounds.length < 2) return '';
  const older = rounds.slice(0, -1);
  const blocks = older.map((round) => {
    const points = POINTS.map((point) => `<h3>${esc(point.title)}</h3>${exactBlock(round.inputs[point.id])}${proposedBlock(round.proposed[point.id])}`).join('');
    return `<article class="card"><p class="eyebrow">Round ${esc(round.number)} · ${esc(ukStamp(round.submittedAt))}</p>${points}</article>`;
  }).join('');
  return `<details class="history"><summary>Earlier rounds</summary>${blocks}</details>`;
}

function borrowerCard(point, state, phase, round) {
  const badge = point.priority === 'critical' ? '<span class="badge">High priority</span>' : '';
  const confirmed = round && round.signoff[point.id];
  const flag = confirmed ? '<span class="done-flag">Confirmed</span>' : badge;
  if (phase === 'in_review' || phase === 'signed_off') {
    const locked = phase === 'signed_off' ? ' disabled' : '';
    const checked = confirmed ? ' checked' : '';
    const draft = state.draft[point.id];
    return `<article class="card${point.priority === 'critical' ? ' critical' : ''}" id="${point.id}" data-point="${point.id}">${flag}<h3>${point.number}. ${esc(point.title)}</h3><p class="q">${esc(point.prompt)}</p><div class="pair">${exactBlock(round.inputs[point.id])}${proposedBlock(round.proposed[point.id])}</div><label class="confirm"><input type="checkbox" data-confirm="${point.id}"${checked}${locked}> Point ${point.number} — ${esc(CONFIRM)}</label><h3>Correction, only if this point is wrong</h3><p class="hint">Leave this blank to keep the exact words you already sent.</p>${captureBox(point, draft.verbatim, draft.documents, 'refine')}</article>`;
  }
  const editing = editorInputs(state);
  const row = editing[point.id];
  return `<article class="card${point.priority === 'critical' ? ' critical' : ''}" id="${point.id}" data-point="${point.id}">${flag}<h3>${point.number}. ${esc(point.title)}</h3><p class="q">${esc(point.prompt)}</p>${captureBox(point, row.verbatim, row.documents, 'answer')}</article>`;
}

function refineSection(state) {
  const phase = phaseOf(state);
  if (phase !== 'in_review' && phase !== 'signed_off') return '';
  return `<div class="submit-bar"><button class="send" type="button" data-submit="answers">Submit my corrections to Byron</button></div>`;
}

function composer(state) {
  const phase = phaseOf(state);
  if (phase !== 'collecting' && phase !== 'awaiting_draft') return '';
  const editing = editorInputs(state);
  const count = answeredCount(editing);
  const label = phase === 'collecting' ? 'Submit my inputs to Byron' : 'Send my corrected words to Byron';
  return `<div class="submit-bar" id="composer-bar"><p class="hint" data-count>${count} of 5 points have your words.</p><button class="send" type="button" data-submit="composer">${label}</button></div>`;
}

function confirmBar(state) {
  const phase = phaseOf(state);
  const round = latestRound(state);
  if (!round || (phase !== 'in_review' && phase !== 'signed_off')) return '';
  const locked = phase === 'signed_off' ? ' disabled' : '';
  const checked = round.overall ? ' checked' : '';
  return `<article class="card" id="overall"><h3>Overall confirmation</h3><p class="q">Tick this only when every point above is right. Posfin will not treat the pack as ready before that.</p><label class="confirm"><input type="checkbox" data-overall${checked}${locked}> ${esc(CONFIRM)}</label><div class="submit-bar"><button class="send" type="button" data-signoff${locked}>Save my confirmation</button></div></article>`;
}

function staffCard(point, round, draft) {
  const inputs = round ? round.inputs[point.id] : (draft[point.id] || { verbatim: '', documents: '' });
  const proposed = round && round.proposed[point.id] ? round.proposed[point.id].wording : '';
  const pending = !round;
  const exact = `<div class="slot"><span class="k">${pending ? 'On Roy\'s screen — not submitted' : 'Roy\'s exact input'}</span><div data-exact>${quote(inputs.verbatim)}</div>${inputs.documents ? `<p class="hint">Documents: ${esc(inputs.documents)}</p>` : ''}</div>`;
  const copy = String(inputs.verbatim || '').trim()
    ? '<button class="secondary" type="button" data-copy>Start from Roy\'s exact words</button>'
    : '';
  const editor = pending ? '<p class="hint">The wording boxes open once Roy submits.</p>' : `<div data-capture><label for="${point.id}-proposed">Lender-facing wording for Roy to check</label>${micControl()}<textarea id="${point.id}-proposed" data-proposed maxlength="8000" placeholder="Write only what his exact words support">${esc(proposed)}</textarea>${copy}</div>`;
  const badge = point.priority === 'critical' ? '<span class="badge">High priority</span>' : '';
  const confirmed = round && round.signoff[point.id] ? '<span class="done-flag">Roy confirmed</span>' : '';
  return `<article class="card${point.priority === 'critical' ? ' critical' : ''}" id="${point.id}" data-point="${point.id}">${badge}${confirmed}<h3>${point.number}. ${esc(point.title)}</h3><p class="q">${esc(point.prompt)}</p><div class="pair">${exact}${editor}</div></article>`;
}

function staffBar(state) {
  const round = latestRound(state);
  if (!round) return '';
  const ready = proposedComplete(round);
  return `<div class="submit-bar"><label for="actor">Sending as</label><select id="actor" data-actor><option>Byron</option><option>Lizzy</option></select><p class="hint">${ready ? 'Every point has wording. Saving again clears Roy\'s ticks so he can re-check.' : 'Roy can review this once every point has wording. Empty points are not filled in for him.'}</p><button class="send" type="button" data-save-proposed>Send this wording back to Roy</button></div>`;
}

export function renderApp(raw, options = {}) {
  const state = normaliseState(raw);
  const mode = options.mode === 'review' ? 'review' : 'borrower';
  const phase = phaseOf(state);
  const round = latestRound(state);
  const notice = options.notice ? `<div class="notice" role="status"><p>${esc(options.notice)}</p></div>` : '';
  const storage = options.persisted ? '' : '<article class="card" id="storage-note"><p>Your words are kept for this visit. The Posfin database table is not connected yet, so another device may not see them until that update is applied. Submit still stores them on this server while it stays warm, and in this browser.</p></article>';
  const flash = '<p class="voice-note" id="flash" role="status"></p>';
  if (mode === 'review') {
    const cards = POINTS.map((point) => staffCard(point, round, state.draft)).join('');
    const sign = round && round.overall ? `<article class="card"><p class="done-flag">Roy confirmed round ${esc(round.number)}</p><p>${esc(ukStamp(round.signedOffAt))}</p></article>` : '';
    return `<main class="wrap" id="main" data-mode="review" data-phase="${esc(phase)}" data-revision="${esc(state.revision)}">${notice}${storage}<div class="staff-banner"><p><strong>Internal view for Byron and Lizzy.</strong> This is not the page Roy uses. Write only what his exact words support. Nothing is pre-filled.</p><p><a href="${ROUTE}">Open the page Roy sees</a></p></div>${flash}<p id="status">${esc(round ? statusCopy(phase, round) : 'Waiting for Roy\'s first submit.')}</p>${sign}${cards}${staffBar(state)}${history(state.rounds)}<footer class="footer"><p><strong>Posfin Capital</strong> · credit broker, not a lender · FCA FRN 913022</p><p><a href="${POSFIN_PHONE_TEL}">${POSFIN_PHONE_DISPLAY}</a></p></footer></main>`;
  }
  const cards = POINTS.map((point) => borrowerCard(point, state, phase, round)).join('');
  const sectionId = phase === 'collecting' || phase === 'awaiting_draft' ? ' id="composer"' : ' id="answers"';
  return `<main class="wrap" id="main" data-mode="borrower" data-phase="${esc(phase)}" data-revision="${esc(state.revision)}">${notice}${storage}${flash}<p id="status">${esc(statusCopy(phase, round || { number: 1 }))}</p><div${sectionId}>${cards}</div>${composer(state)}${confirmBar(state)}${refineSection(state)}${history(state.rounds)}<footer class="footer"><p><strong>Posfin Capital</strong> is a credit broker, not a lender. Authorised and regulated by the Financial Conduct Authority, FRN 913022.</p><p>Call or WhatsApp <a href="${POSFIN_PHONE_TEL}">${POSFIN_PHONE_DISPLAY}</a> · <a href="${esc(POSFIN_WHATSAPP)}">WhatsApp</a></p><p>96 Kensington High Street, London W8 4SG</p></footer></main>`;
}

function bootData(state, options) {
  return {
    mode: options.mode === 'review' ? 'review' : 'borrower',
    revision: state.revision,
    storage: options.storage || 'local',
    persisted: !!options.persisted,
    phase: phaseOf(state),
  };
}

export function renderLocked() {
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Private link</span></div><h1>Posfin Capital</h1></div></header><main class="wrap"><article class="card"><p>This private link is not valid. Call or WhatsApp <a href="${POSFIN_PHONE_TEL}">${POSFIN_PHONE_DISPLAY}</a> and we will send a fresh one.</p></article><footer class="footer"><p><strong>Posfin Capital</strong> is a credit broker, not a lender. FCA FRN 913022.</p></footer></main>`;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><title>Private link — Posfin Capital</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

export function renderPage(raw, options = {}) {
  const state = normaliseState(raw);
  const mode = options.mode === 'review' ? 'review' : 'borrower';
  const boot = JSON.stringify(bootData(state, { ...options, mode })).replace(/</g, '\\u003c');
  const title = mode === 'review' ? 'Wirral Waters review — Posfin Capital' : 'Wirral Waters — CrowdProperty Compliance Points — Posfin Capital';
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">${mode === 'review' ? 'Staff review' : 'Private link'}</span></div><h1>Roy Kenny</h1><p class="addr">Wirral Waters, Dock Road</p><div class="banner"><p class="eyebrow">Posfin Capital</p><h2>Wirral Waters — CrowdProperty Compliance Points</h2><p>Sara Nasralla at CrowdProperty raised 5 points from their credit and company checks. Byron wants your own facts first, so Posfin can help position your exact answers as clearly as possible before anything goes back to Sara.</p></div><aside class="rule"><strong>The rule</strong><p>${esc(RULE)}</p></aside></div></header><div id="app">${renderApp(state, { ...options, mode })}</div><noscript><p>Voice needs JavaScript. You can still read the five points and call ${esc(POSFIN_PHONE_DISPLAY)}.</p></noscript>`;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Playfair+Display:wght@500&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}<script id="boot" type="application/json">${boot}</script><script>${CLIENT}</script></body></html>`;
}

export function responseParts(raw, options = {}) {
  const state = normaliseState(raw);
  const mode = options.mode === 'review' ? 'review' : 'borrower';
  return {
    html: renderApp(state, { ...options, mode }),
    boot: bootData(state, { ...options, mode }),
    revision: state.revision,
    phase: phaseOf(state),
  };
}

const CLIENT = `
(function () {
  var page = { revision: 0, mode: 'borrower' };
  var active = null;
  var draftTimer = null;
  var draftFlight = null;
  var dirty = false;
  var KEY = 'posfin-wirral-waters-roy-kenny';

  function boot() {
    try { return JSON.parse(document.getElementById('boot').textContent || '{}'); }
    catch (e) { return {}; }
  }
  function main() { return document.getElementById('main'); }
  function flash(text) {
    var el = document.getElementById('flash');
    if (el) el.textContent = text || '';
  }
  function readBoot() {
    var data = boot();
    page.revision = Number(data.revision || 0);
    page.mode = data.mode === 'review' ? 'review' : 'borrower';
    page.storage = data.storage || 'local';
    page.persisted = !!data.persisted;
  }
  function inputsFrom(root) {
    var inputs = {};
    if (!root) return inputs;
    var cards = root.querySelectorAll('[data-point]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var id = card.getAttribute('data-point');
      var box = card.querySelector('[data-verbatim]');
      var docs = card.querySelector('[data-documents]');
      if (!box) continue;
      inputs[id] = { verbatim: box.value, documents: docs ? docs.value : '' };
    }
    return inputs;
  }
  function composerRoot() {
    return document.getElementById('composer') || document.getElementById('answers');
  }
  function rememberLocal(inputs) {
    try { localStorage.setItem(KEY, JSON.stringify({ revision: page.revision, inputs: inputs, at: Date.now() })); }
    catch (e) {}
  }
  function restoreLocal() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!saved || saved.revision !== page.revision || !saved.inputs || page.mode === 'review') return;
      var cards = document.querySelectorAll('[data-point]');
      for (var i = 0; i < cards.length; i++) {
        var id = cards[i].getAttribute('data-point');
        var row = saved.inputs[id];
        if (!row) continue;
        var box = cards[i].querySelector('[data-verbatim]');
        var docs = cards[i].querySelector('[data-documents]');
        if (box && !box.value && row.verbatim) box.value = row.verbatim;
        if (docs && !docs.value && row.documents) docs.value = row.documents;
      }
    } catch (e) {}
  }
  function countWords() {
    var root = document.getElementById('composer');
    var el = document.querySelector('[data-count]');
    if (!root || !el) return;
    var n = 0;
    var boxes = root.querySelectorAll('[data-verbatim]');
    for (var i = 0; i < boxes.length; i++) if (boxes[i].value.trim()) n += 1;
    el.textContent = n + ' of 5 points have your words.';
  }
  function post(payload) {
    var url = page.mode === 'review' ? '/api/wirral-waters-response?mode=review' : '/api/wirral-waters-response';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Posfin-Page': 'wirral' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().then(function (body) { body._status = res.status; return body; });
    });
  }
  function applyBody(body) {
    if (!body || !body.html) return;
    stopActive();
    var app = document.getElementById('app');
    if (app) app.innerHTML = body.html;
    if (body.boot) {
      var node = document.getElementById('boot');
      if (node) node.textContent = JSON.stringify(body.boot);
    }
    readBoot();
    restoreLocal();
    countWords();
    var status = document.getElementById('status');
    if (status && status.scrollIntoView) status.scrollIntoView({ block: 'start' });
  }
  function saveDraft() {
    if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
    if (draftFlight) return draftFlight;
    if (!dirty || page.mode === 'review') return Promise.resolve();
    var inputs = inputsFrom(composerRoot());
    if (!Object.keys(inputs).length) { dirty = false; return Promise.resolve(); }
    dirty = false;
    rememberLocal(inputs);
    var flight = post({ action: 'save_draft', inputs: inputs }).then(function (body) {
      if (body && body.ok && typeof body.revision === 'number') page.revision = body.revision;
      else dirty = true;
    }).catch(function () {
      dirty = true;
      flash('Saved on this phone. Not sent to Byron yet.');
    }).then(function () {
      if (draftFlight === flight) draftFlight = null;
    });
    draftFlight = flight;
    return flight;
  }
  function flushDraft() {
    if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
    var pending = draftFlight || Promise.resolve();
    return pending.then(function () {
      if (dirty) return saveDraft();
    });
  }
  function scheduleDraft() {
    dirty = true;
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 800);
  }
  function stopActive() {
    var current = active;
    active = null;
    if (!current) return;
    current.alive = false;
    if (current.timer) clearInterval(current.timer);
    if (current.recognition) { try { current.recognition.stop(); } catch (e) {} }
    if (current.recorder && current.recorder.state === 'recording') { try { current.recorder.stop(); } catch (e) {} }
    if (current.stream) current.stream.getTracks().forEach(function (track) { track.stop(); });
    if (current.button) {
      current.button.classList.remove('rec');
      current.button.setAttribute('aria-pressed', 'false');
      var state = current.button.querySelector('.mic-state');
      if (state) state.textContent = 'Your words appear in the box as you speak. You can edit them before anything is sent.';
    }
    if (current.timerEl) current.timerEl.hidden = true;
  }
  function paintTimer(session) {
    var seconds = Math.floor((Date.now() - session.started) / 1000);
    var mins = Math.floor(seconds / 60);
    var rest = seconds % 60;
    if (session.timerEl) {
      session.timerEl.hidden = false;
      session.timerEl.textContent = mins + ':' + (rest < 10 ? '0' : '') + rest;
    }
    if (seconds >= 180) stopActive();
  }
  function beginSession(button, box, note) {
    stopActive();
    var timerEl = button.parentNode.querySelector('[data-timer]');
    var session = { alive: true, button: button, box: box, note: note, timerEl: timerEl, started: Date.now(), prefix: box.value ? box.value.replace(/\\s+$/, '') + ' ' : '', finals: '' };
    button.classList.add('rec');
    button.setAttribute('aria-pressed', 'true');
    var state = button.querySelector('.mic-state');
    if (state) state.textContent = 'Listening — tap to stop';
    session.timer = setInterval(function () { if (active === session) paintTimer(session); }, 250);
    paintTimer(session);
    active = session;
    return session;
  }
  function writeSpeech(session, extra) {
    session.box.value = (session.prefix + session.finals + (extra || '')).replace(/^\\s+/, '');
    session.box.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function startSpeech(session) {
    var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return false;
    var recognition = new Ctor();
    recognition.lang = 'en-GB';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = function (event) {
      if (active !== session) return;
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var text = event.results[i][0].transcript;
        if (event.results[i].isFinal) session.finals += text + ' ';
        else interim += text;
      }
      writeSpeech(session, interim);
    };
    recognition.onerror = function (event) {
      if (active !== session) return;
      var code = event && event.error;
      if (code === 'aborted' || code === 'no-speech') return;
      if (code === 'not-allowed') {
        if (session.note) session.note.textContent = 'The microphone is blocked. Type your exact words in the box. We only keep what you confirm there.';
        stopActive();
        return;
      }
      if (session.note) session.note.textContent = 'Live speech-to-text stopped. Recording instead, or type your exact words.';
      try { recognition.stop(); } catch (e) {}
      session.recognition = null;
      startRecorder(session);
    };
    recognition.onend = function () {
      if (active === session && session.recognition === recognition) {
        try { recognition.start(); } catch (e) { stopActive(); }
      }
    };
    try { recognition.start(); }
    catch (e) { return false; }
    session.recognition = recognition;
    if (session.note) session.note.textContent = '';
    return true;
  }
  function transcribeBlob(session, blob) {
    if (!blob || blob.size < 800) {
      if (session.note) session.note.textContent = 'That recording was too short. Try again, or type your exact words.';
      return;
    }
    if (blob.size > 2500000) {
      if (session.note) session.note.textContent = 'That recording is too long to send. Type your exact words, or record a shorter answer.';
      return;
    }
    if (session.note) session.note.textContent = 'Turning the recording into text…';
    var reader = new FileReader();
    reader.onload = function () {
      var data = String(reader.result || '');
      var comma = data.indexOf(',');
      var audio = comma >= 0 ? data.slice(comma + 1) : data;
      post({ action: 'transcribe', audio: audio, mime: blob.type || 'audio/webm' }).then(function (body) {
        if (body && body.text) {
          var prefix = session.box.value ? session.box.value.replace(/\\s+$/, '') + ' ' : '';
          session.box.value = prefix + body.text;
          session.box.dispatchEvent(new Event('input', { bubbles: true }));
          if (session.note) session.note.textContent = 'Draft text added. Read it and correct anything that is not what you said.';
        } else if (session.note) {
          session.note.textContent = (body && body.message) || 'This browser cannot turn speech into text here. Type your exact words in the box. We only send what you confirm.';
        }
      }).catch(function () {
        if (session.note) session.note.textContent = 'This browser cannot turn speech into text here. Type your exact words in the box. We only send what you confirm.';
      });
    };
    reader.readAsDataURL(blob);
  }
  function startRecorder(session) {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      if (session.note) session.note.textContent = 'This browser cannot turn speech into text (this is common on Firefox and some iPhones). Type your exact words in the box. We only send what you confirm.';
      stopActive();
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (active !== session) { stream.getTracks().forEach(function (track) { track.stop(); }); return; }
      session.stream = stream;
      var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      var mime = '';
      for (var i = 0; i < types.length; i++) {
        if (window.MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) { mime = types[i]; break; }
      }
      var recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      var chunks = [];
      recorder.ondataavailable = function (event) { if (event.data && event.data.size) chunks.push(event.data); };
      recorder.onstop = function () {
        stream.getTracks().forEach(function (track) { track.stop(); });
        var blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
        transcribeBlob(session, blob);
      };
      session.recorder = recorder;
      var state = session.button.querySelector('.mic-state');
      if (state) state.textContent = 'Recording — tap to stop';
      if (session.note && !session.recognition) session.note.textContent = 'Live text is not available in this browser. We will try to transcribe the recording when you stop.';
      recorder.start();
    }).catch(function () {
      if (session.note) session.note.textContent = 'We could not use the microphone. Type your exact words in the box.';
      stopActive();
    });
  }
  function onMic(button) {
    if (button.classList.contains('rec')) { stopActive(); return; }
    var capture = button.closest('[data-capture]');
    var box = capture && (capture.querySelector('[data-verbatim]') || capture.querySelector('[data-proposed]'));
    if (!box) return;
    var note = capture.querySelector('[data-voice-note]');
    var session = beginSession(button, box, note);
    if (!startSpeech(session)) startRecorder(session);
  }
  function signoffPayload() {
    var signoff = {};
    var boxes = document.querySelectorAll('[data-confirm]');
    for (var i = 0; i < boxes.length; i++) signoff[boxes[i].getAttribute('data-confirm')] = !!boxes[i].checked;
    var overall = document.querySelector('[data-overall]');
    return { action: 'sign_off', revision: page.revision, signoff: signoff, overall: !!(overall && overall.checked) };
  }
  function proposedPayload() {
    var proposed = {};
    var boxes = document.querySelectorAll('[data-proposed]');
    for (var i = 0; i < boxes.length; i++) {
      var card = boxes[i].closest('[data-point]');
      if (card) proposed[card.getAttribute('data-point')] = boxes[i].value;
    }
    var actor = document.querySelector('[data-actor]');
    return { action: 'save_proposed', revision: page.revision, actor: actor ? actor.value : 'Byron', proposed: proposed };
  }
  document.addEventListener('click', function (event) {
    var mic = event.target.closest && event.target.closest('[data-mic]');
    if (mic) { event.preventDefault(); onMic(mic); return; }
    var copy = event.target.closest && event.target.closest('[data-copy]');
    if (copy) {
      event.preventDefault();
      var card = copy.closest('[data-point]');
      var exact = card && card.querySelector('[data-exact]');
      var box = card && card.querySelector('[data-proposed]');
      if (exact && box) {
        var text = exact.innerText || exact.textContent || '';
        box.value = text.replace(/^Nothing here yet\\.\\s*/, '').trim();
        box.focus();
      }
      return;
    }
    var submit = event.target.closest && event.target.closest('[data-submit]');
    if (submit) {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      var root = document.getElementById(submit.getAttribute('data-submit'));
      flash('Sending your exact words…');
      Promise.resolve(flushDraft()).then(function () {
        return post({ action: 'submit_inputs', revision: page.revision, inputs: inputsFrom(root) });
      }).then(function (body) {
        submit.disabled = false;
        if (body && body.ok) { applyBody(body); flash(''); }
        else flash((body && body.message) || 'That did not send. Your words are still in the boxes.');
      }).catch(function () { submit.disabled = false; flash('That did not send. Your words are still in the boxes.'); });
      return;
    }
    var sign = event.target.closest && event.target.closest('[data-signoff]');
    if (sign) {
      event.preventDefault();
      sign.disabled = true;
      Promise.resolve(flushDraft()).then(function () {
        return post(signoffPayload());
      }).then(function (body) {
        sign.disabled = false;
        if (body && body.ok) applyBody(body);
        else flash((body && body.message) || 'That confirmation did not save.');
      }).catch(function () { sign.disabled = false; flash('That confirmation did not save.'); });
      return;
    }
    var save = event.target.closest && event.target.closest('[data-save-proposed]');
    if (save) {
      event.preventDefault();
      save.disabled = true;
      post(proposedPayload()).then(function (body) {
        save.disabled = false;
        if (body && body.ok) applyBody(body);
        else flash((body && body.message) || 'That wording did not save.');
      }).catch(function () { save.disabled = false; flash('That wording did not save.'); });
    }
  });
  document.addEventListener('input', function (event) {
    var box = event.target;
    if (!box || !box.matches) return;
    if (box.matches('[data-verbatim]') || box.matches('[data-documents]')) {
      countWords();
      scheduleDraft();
    }
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveDraft();
  });
  readBoot();
  restoreLocal();
  countWords();
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    var notes = document.querySelectorAll('[data-voice-note]');
    for (var i = 0; i < notes.length; i++) {
      if (!notes[i].textContent) notes[i].textContent = 'Live speech-to-text is not in this browser. Tap the microphone to record and we will try to transcribe it. If that cannot run, type your exact words.';
    }
  }
})();
`;

export const COPY = { RULE, PROPOSED_LABEL, CONFIRM, POINT_IDS };
