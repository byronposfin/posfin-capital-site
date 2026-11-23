import { esc } from './case-portal.js';
import { FILTERS, OWNERS, STATUSES, pillClass, safeHref } from './cockpit.js';
import { launchModel } from './broka.js';
import { brokaLaunch } from './broka-html.js';

const CSS = `
:root{--navy:#1C184F;--ink:#13113A;--gold:#D4A853;--paper:#F6F4EF;--line:#E4DFD4;--teal:#0E7C78;--urgent:#9F1239;--urgent-bg:#FDECEC;--wait:#8A5A00;--wait-bg:#FFF6DF;--ok:#E7F6F3}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper);font-size:16px;line-height:1.45}
button,input,select,textarea{font:inherit}
a{color:var(--teal)}
img{max-width:100%;height:auto}
header.top{background:linear-gradient(180deg,#1C184F 0%,#13113A 100%);color:#fff;padding:18px 16px 22px}
.top-inner{max-width:1120px;margin:0 auto}
.brand{display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand img{height:34px;width:auto}
.private{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72)}
header.top h1{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:34px;line-height:1.05;margin:16px 0 6px}
.sub{margin:0;color:rgba(255,255,255,.82)}
.wrap{max-width:1120px;margin:0 auto;padding:16px 16px 64px}
.banner{background:#FFF6DF;border:1px solid #E2C98A;color:#5C4300;border-radius:16px;padding:12px 14px;margin:0 0 14px;font-weight:700}
.bar,.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}
.filters a,.bar a,button.secondary,button.send,button.linkish{min-height:44px;border-radius:999px;padding:10px 14px;border:1px solid var(--line);background:#fff;color:var(--ink);text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.filters a[aria-current="page"]{background:var(--navy);color:#fff;border-color:var(--navy)}
button.send{background:var(--navy);color:#fff;border-color:var(--navy);font-weight:700;cursor:pointer}
button.send:disabled{background:#E7E2D8;color:#5C5670;border-color:#E7E2D8;cursor:not-allowed}
button.secondary,button.linkish{cursor:pointer;background:#fff}
button.linkish{color:var(--teal)}
.lanes{display:flex;flex-direction:column;gap:16px}
.lane{background:transparent}
.lane h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:28px;margin:0}
.kicker{margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);font-weight:700}
.cards{display:flex;flex-direction:column;gap:12px;margin-top:10px}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px}
.card h3{margin:8px 0 6px;font-size:20px;line-height:1.2}
.card p{margin:0 0 8px}
.meta{color:#5C5670;font-size:14px}
.pill{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;padding:5px 8px;border-radius:999px;background:#E7E2D8;color:var(--navy)}
.pill.urgent{background:var(--urgent-bg);color:var(--urgent)}
.pill.wait{background:var(--wait-bg);color:var(--wait)}
.pill.review{background:var(--navy);color:#fff}
.pill.test{background:var(--ok);color:var(--teal)}
.pill.later{background:#E8EEF8;color:#1C3D73}
.pill.green{background:#E5F6E8;color:#135C24}
.pill.amber{background:#FFF3D6;color:#6A4B00}
.pill.red{background:#FDE8E6;color:#8A1F14}
.pill.done{background:#ECEAF3;color:#13113A}
.preview-chip{display:inline-block;margin-left:6px;font-size:11px;font-weight:700;letter-spacing:.08em;color:#5C4300}
.lines{margin:8px 0;padding:0;list-style:none}
.lines li{padding:4px 0;border-top:1px solid var(--line)}
.lines strong{display:inline-block;min-width:6.5rem}
.evidence{margin:8px 0;padding:0;list-style:none}
.evidence li{margin:4px 0}
label{display:block;font-weight:700;margin:8px 0 4px}
textarea,select,input[type=text],input[type=email],input[type=password],input[type=date]{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff;min-height:48px}
textarea{min-height:88px;resize:vertical}
.tick{display:flex;align-items:center;gap:10px;font-weight:700;margin:8px 0}
.tick input{width:22px;height:22px}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.draft{background:#F7F4EA;border-radius:12px;padding:10px;margin-top:8px}
.audit{margin-top:8px}
.audit li{font-size:14px;padding:4px 0;border-top:1px solid var(--line)}
.empty{color:#5C5670}
.footer{margin-top:22px;color:#5C5670;font-size:14px}
@media (min-width:960px){
  header.top h1{font-size:48px}
  .lanes{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
  .lane.do_now,.lane.done,.lane.new_leads,.add-task{grid-column:1 / -1}
  .lane.do_now .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}
}
`;

function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Playfair+Display:wght@500&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}</body></html>`;
}

function banner(mode) {
  if (mode === 'supabase') {
    return '<p class="banner" role="status">Staff cockpit. Not the integrated release until Tom reviews and merges it. This page does not send messages or release borrower links.</p>';
  }
  return '<p class="banner" role="status">Preview data. Not the live case book, and not the integrated release. These cards are fixtures. Saves stay on this preview and are not written to Supabase. Nothing here sends a message or releases a borrower link.</p>';
}

function nav(filter, view, liveCases, seatLinks) {
  const filters = FILTERS.map((item) => {
    const current = view !== 'lizzy' && item.id === filter ? ' aria-current="page"' : '';
    return `<a href="/staff/cockpit?filter=${item.id}"${current}>${esc(item.label)}</a>`;
  }).join('');
  const lizzy = view === 'lizzy' ? ' aria-current="page"' : '';
  const live = liveCases ? '<a href="/staff/cockpit/live" data-tab="live-cases">Live cases</a>' : '';
  const seats = (seatLinks || []).map((item) => `<a href="${esc(item.href)}" data-tab="seat-${esc(item.code)}">${esc(item.label)}</a>`).join('');
  return `<div class="bar"><a href="/staff/cases">Cases</a><a href="/staff/france">France desk</a><a href="/staff/cockpit/pipeline">Pipeline</a><a href="/staff/cockpit/broka/scorecard">Scorecard</a><a href="/staff/cockpit/spine/POSFIN-WEB-EYCTQ6">Stage-2 spine</a>${live}${seats}<a href="/staff/cockpit?view=lizzy"${lizzy}>Lizzy queue</a><a href="/staff/set-password?change=1">Change password</a><form method="post" action="/staff/cockpit"><input type="hidden" name="action" value="logout"><button class="secondary" type="submit">Log out</button></form></div><nav class="filters" aria-label="Filters">${filters}</nav>`;
}

function options(list, current) {
  const values = list.includes(current) || !current ? list : [current, ...list];
  return values.map((value) => `<option${value === current ? ' selected' : ''}>${esc(value)}</option>`).join('');
}

function evidenceList(items) {
  const links = (items || []).map((item) => {
    const href = safeHref(item.href);
    if (!href) return '';
    const kind = item.kind === 'pr' ? 'Pull request' : item.kind === 'email' ? 'Email' : item.kind === 'document' ? 'Document' : item.kind === 'url' ? 'Link' : 'Case';
    return `<li><a href="${esc(href)}">${esc(kind)} · ${esc(item.label)}</a></li>`;
  }).join('');
  return links ? `<ul class="evidence">${links}</ul>` : '';
}

function auditList(rows) {
  if (!rows || !rows.length) return '<p class="meta">No edits yet.</p>';
  return `<ol class="audit">${rows.slice().reverse().map((row) => `<li><strong>${esc(row.actor)}</strong> · ${esc(row.at || '')}<br>${esc(row.field)}: ${esc(row.oldValue || '—')} → ${esc(row.newValue || '—')}</li>`).join('')}</ol>`;
}

function cardForm(item, filter, view) {
  const showDraft = view === 'lizzy' || item.owner === 'Lizzy' || String(item.draftMessage || '').trim();
  const draft = showDraft ? `<div class="draft"><label for="draft-${esc(item.id)}">Borrower message draft — text only</label><textarea id="draft-${esc(item.id)}" name="draft_message" maxlength="2000">${esc(item.draftMessage || '')}</textarea><p class="meta">Draft only. There is no send control. SmartLink keeps its own approval gate. Tom releases borrower links.</p></div>` : `<input type="hidden" name="draft_message" value="${esc(item.draftMessage || '')}">`;
  const reopen = item.done ? '<button class="secondary" type="submit" name="action" value="reopen">Reopen</button>' : '';
  return `<form method="post" action="/staff/cockpit">
    <input type="hidden" name="kind" value="${esc(item.kind)}">
    <input type="hidden" name="id" value="${esc(item.id)}">
    <input type="hidden" name="filter" value="${esc(filter)}">
    <input type="hidden" name="view" value="${esc(view)}">
    <label class="tick" for="done-${esc(item.id)}"><input id="done-${esc(item.id)}" type="checkbox" name="done" value="1"${item.done ? ' checked' : ''}> Done</label>
    <label for="status-${esc(item.id)}">Status</label>
    <select id="status-${esc(item.id)}" name="status">${options(STATUSES, item.status)}</select>
    <label for="owner-${esc(item.id)}">Owner</label>
    <select id="owner-${esc(item.id)}" name="owner">${options(OWNERS, item.owner)}</select>
    <label for="next-${esc(item.id)}">Next action</label>
    <input id="next-${esc(item.id)}" name="next_action" type="text" maxlength="400" value="${esc(item.nextAction || '')}">
    <label for="due-${esc(item.id)}">Due date</label>
    <input id="due-${esc(item.id)}" name="due_on" type="date" value="${esc(item.dueOn || '')}">
    <label for="note-${esc(item.id)}">Note</label>
    <textarea id="note-${esc(item.id)}" name="note" maxlength="2000">${esc(item.note || '')}</textarea>
    ${draft}
    <label for="actor-${esc(item.id)}">Recorded by</label>
    <select id="actor-${esc(item.id)}" name="actor">${options(OWNERS, item.owner)}</select>
    <div class="actions">
      <button class="send" type="submit" name="action" value="save">Save</button>
      ${reopen}
      <button class="linkish" type="submit" name="action" value="revert">Back to shared source</button>
    </div>
  </form>`;
}

export function renderCard(item, filter, view) {
  const chip = item.preview ? '<span class="preview-chip">PREVIEW</span>' : '';
  return `<article class="card" id="card-${esc(item.id)}">
    <span class="pill ${esc(pillClass(item.status))}">${esc(item.status || 'Status')}</span>${chip}
    <h3>${esc(item.title)}</h3>
    <p>${esc(item.description || '')}</p>
    <ul class="lines">
      <li><strong>Next</strong> ${esc(item.nextAction || '—')}</li>
      <li><strong>Status</strong> ${esc(item.status || '—')}</li>
      <li><strong>Known done</strong> ${esc(item.knownDone || '—')}</li>
      <li><strong>Release</strong> ${esc(item.releaseLine || '—')}</li>
    </ul>
    <p class="meta">${esc(item.kind === 'task' ? 'Task' : 'Case')} · ${esc(item.owner || 'Unassigned')}${item.dueOn ? ` · due ${esc(item.dueOn)}` : ''}</p>
    ${evidenceList(item.evidence)}
    ${item.kind === 'case' ? brokaLaunch(launchModel(item)) : ''}
    ${cardForm(item, filter, view)}
    <details class="audit"><summary>Audit history</summary>${auditList(item.audit)}</details>
  </article>`;
}

function lane(section, filter, view) {
  const cards = section.cards.length
    ? section.cards.map((item) => renderCard(item, filter, view)).join('')
    : '<p class="empty">Nothing in this lane.</p>';
  return `<section class="lane ${esc(section.id)}" data-section="${esc(section.id)}"><p class="kicker">${esc(section.kicker)}</p><h2>${esc(section.title)}</h2><div class="cards">${cards}</div></section>`;
}

function addTask(filter) {
  return `<section class="add-task card"><h2>Add a systems task</h2><p class="meta">For build and strategic work that is not a case. Preview only until the task table is approved.</p>
    <form method="post" action="/staff/cockpit">
      <input type="hidden" name="action" value="add">
      <input type="hidden" name="filter" value="${esc(filter)}">
      <input type="hidden" name="view" value="board">
      <label for="task-title">Title</label>
      <input id="task-title" name="title" type="text" maxlength="140" required>
      <label for="task-section">Lane</label>
      <select id="task-section" name="section"><option value="build">Build / systems</option><option value="strategic">Strategic thought</option></select>
      <label for="task-owner">Owner</label>
      <select id="task-owner" name="owner">${options(OWNERS, 'Tom')}</select>
      <label for="task-next">Next action</label>
      <input id="task-next" name="next_action" type="text" maxlength="400">
      <label for="task-actor">Recorded by</label>
      <select id="task-actor" name="actor">${options(OWNERS, 'Tom')}</select>
      <div class="actions"><button class="send" type="submit">Add task</button></div>
    </form></section>`;
}

export function renderBoard(model) {
  const lanes = model.sections.map((section) => lane(section, model.filter, 'board')).join('');
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff</span></div><h1>Let's clear the board.</h1><p class="sub">Same sign-in as Cases. English desk for live work, review, systems and the ideas we are keeping warm.</p></div></header><main class="wrap">${banner(model.mode)}${model.schemaPending ? '<p class="banner">The cockpit tables are not on the database yet. Case cards are read from the portal. Edits are not being saved.</p>' : ''}${nav(model.filter, 'board', model.liveCases, model.seatLinks)}<div class="lanes">${model.newLeadsHtml || ''}${lanes}${addTask(model.filter)}</div><footer class="footer"><p><strong>Posfin Capital</strong> · staff only · not an offer of finance</p></footer></main>`;
  return shell("Let's clear the board. — Posfin", body);
}

export function renderLizzy(model) {
  const active = model.queue.active.length
    ? model.queue.active.map((item) => renderCard(item, model.filter, 'lizzy')).join('')
    : '<p class="empty">Lizzy has no active cases on this board.</p>';
  const others = model.queue.otherDrafts.length
    ? model.queue.otherDrafts.map((item) => renderCard(item, model.filter, 'lizzy')).join('')
    : '';
  const otherBlock = others ? `<section class="lane"><p class="kicker">Drafts</p><h2>Other borrower drafts</h2><div class="cards">${others}</div></section>` : '';
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff</span></div><h1>Lizzy queue</h1><p class="sub">Active cases for Lizzy, plus borrower message drafts. Draft text only.</p></div></header><main class="wrap">${banner(model.mode)}${model.schemaPending ? '<p class="banner">The cockpit tables are not on the database yet. Edits are not being saved.</p>' : ''}${nav(model.filter, 'lizzy', model.liveCases, model.seatLinks)}<section class="lane do_now"><p class="kicker">Queue</p><h2>Lizzy’s active cases</h2><div class="cards">${active}</div></section>${otherBlock}<footer class="footer"><p>No message leaves this page. Tom releases borrower links on SmartLink.</p></footer></main>`;
  return shell('Lizzy queue — Posfin', body);
}

export function renderLogin(error) {
  const message = error === 'preview_password'
    ? 'This preview is not using the live staff password. Set the preview password, or sign in on Cases first.'
    : (error ? 'That staff password was not recognised.' : '');
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff</span></div><h1>Let's clear the board.</h1><p class="sub">Each seat signs in with its own email once individual login is on. The shared preview password stays on Preview only.</p></div></header><main class="wrap">${banner('preview')}<article class="card"><form method="post" action="/staff/cockpit"><label for="email">Work email</label><input id="email" name="email" type="email" autocomplete="username"><label for="password">Staff password</label><input id="password" name="password" type="password" autocomplete="current-password" required minlength="8"><p>${esc(message)}</p><button class="send" type="submit">Open the cockpit</button></form><p><a href="/staff/set-password">Forgot password?</a></p><p><a href="/staff/cases">Cases</a> · <a href="/staff/france">France desk</a></p></article></main>`;
  return shell('Staff cockpit — Posfin', body);
}

export function renderMessage(title, text) {
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff</span></div><h1>${esc(title)}</h1></div></header><main class="wrap"><article class="card"><p>${esc(text)}</p><p><a href="/staff/cockpit">Back to the board</a></p></article></main>`;
  return shell(`${title} — Posfin`, body);
}
