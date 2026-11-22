import { esc } from './case-portal.js';
import { SEATS } from './seat-view.js';

const CSS = `
:root{--navy:#1C184F;--ink:#13113A;--paper:#F6F4EF;--line:#E4DFD4;--teal:#0E7C78;--urgent:#9F1239;--urgent-bg:#FDECEC;--wait:#8A5A00;--wait-bg:#FFF6DF;--ok:#E7F6F3}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper);font-size:16px;line-height:1.45}
button,input,select,textarea{font:inherit}
a{color:var(--teal)}
img{max-width:100%;height:auto}
header.top{background:linear-gradient(180deg,#1C184F 0%,#13113A 100%);color:#fff;padding:18px 16px 22px}
.top-inner,.wrap{max-width:1120px;margin:0 auto}
.wrap{padding:16px 16px 64px}
.brand{display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand img{height:34px;width:auto}
.private{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72)}
header.top h1{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:34px;line-height:1.05;margin:16px 0 6px}
.sub{margin:0;color:rgba(255,255,255,.82)}
.banner{background:#FFF6DF;border:1px solid #E2C98A;color:#5C4300;border-radius:16px;padding:12px 14px;margin:0 0 14px;font-weight:700}
.bar,.filters,.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}
.filters a,.bar a,button.secondary,button.send{min-height:44px;border-radius:999px;padding:10px 14px;border:1px solid var(--line);background:#fff;color:var(--ink);text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.filters a[aria-current="page"]{background:var(--navy);color:#fff;border-color:var(--navy)}
button.send{background:var(--navy);color:#fff;border-color:var(--navy);font-weight:700;cursor:pointer}
button.secondary{cursor:pointer;background:#fff}
.lane{margin:0 0 22px}
.lane h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:28px;margin:0}
.kicker{margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);font-weight:700}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px;margin:0 0 12px}
.card h3{margin:8px 0 6px;font-size:20px}
.meta{color:#5C5670;font-size:14px}
.pill{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;padding:5px 8px;border-radius:999px;background:#E7E2D8;color:var(--navy)}
.pill.urgent{background:var(--urgent-bg);color:var(--urgent)}
.pill.wait{background:var(--wait-bg);color:var(--wait)}
.pill.review{background:var(--navy);color:#fff}
.pill.test{background:var(--ok);color:var(--teal)}
label{display:block;font-weight:700;margin:8px 0 4px}
textarea,select,input[type=text],input[type=password],input[type=date]{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff;min-height:48px}
textarea{min-height:88px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:18px}
th,td{text-align:left;padding:8px 6px;border-top:1px solid var(--line);vertical-align:top}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:18px;background:#fff}
.empty{color:#5C5670}
.footer{margin-top:22px;color:#5C5670;font-size:14px}
.filter-card{display:grid;gap:8px}
@media (min-width:800px){
  header.top h1{font-size:48px}
  .filter-card{grid-template-columns:160px 160px 1fr auto;align-items:end}
}
`;

function shell(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Playfair+Display:wght@500&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}</body></html>`;
}

function standClass(stand) {
  if (stand === 'completed') return 'test';
  if (stand === 'submitted') return 'review';
  if (stand === 'started') return 'wait';
  return '';
}

function answerClass(answer) {
  if (answer === 'yes') return 'test';
  if (answer === 'no') return 'urgent';
  if (answer === 'edit') return 'review';
  return '';
}

function answerLabel(answer) {
  if (answer === 'yes') return 'Yes';
  if (answer === 'no') return 'No';
  if (answer === 'edit') return 'Edited';
  return 'Open';
}

export function renderSeatLogin(message, next) {
  const path = next || '/staff/cockpit/seat/chris';
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff</span></div><h1>Staff seat</h1><p class="sub">Same staff password as the cockpit.</p></div></header><main class="wrap"><article class="card"><form method="post" action="${esc(path)}"><label for="password">Staff password</label><input id="password" name="password" type="password" autocomplete="current-password" required minlength="8"><p>${esc(message || '')}</p><button class="send" type="submit">Open the seat</button></form><p><a href="/staff/cockpit">Board</a></p></article></main>`;
  return shell('Staff seat — Posfin', body);
}

export function renderSeatMessage(title, text) {
  const body = `<header class="top"><div class="top-inner"><h1>${esc(title)}</h1></div></header><main class="wrap"><article class="card"><p>${esc(text)}</p><p><a href="/staff/cockpit">Back to the board</a></p></article></main>`;
  return shell(`${title} — Posfin`, body);
}

function banner(view) {
  if (view.warning) return `<p class="banner" role="status">${esc(view.warning)}</p>`;
  if (view.source === 'live') {
    return '<p class="banner" role="status">Live staff seat. Cases are the migration book. Answers are stored for the seat, so Byron sees this same sheet. Nothing here sends a message.</p>';
  }
  return '<p class="banner" role="status">Preview fixtures. Not live clients. Answers stay in this staff session until the proposed seat table is applied. Nothing here sends a message.</p>';
}

function pending(view) {
  if (!view.schemaPending) return '';
  return '<p class="banner" role="status">The seat answer table is not on the database yet. Answers stay in this browser.</p>';
}

function leadRows(leads, attr) {
  if (!leads.length) return '<p class="empty">Nothing in this list.</p>';
  const rows = leads.map((lead) => `<tr ${attr}="${esc(lead.id)}" data-stand="${esc(lead.stand)}" data-source="${esc(lead.source)}"><td>${esc(lead.day || '—')}</td><td>${esc(lead.name)}</td><td>${esc(lead.email)}</td><td>${esc(lead.source || '—')}</td><td><span class="pill ${standClass(lead.stand)}">${esc(lead.stand)}</span></td><td>${esc(lead.owner || '—')}</td><td>${esc(lead.reference || '—')}</td></tr>`).join('');
  return `<div class="scroll"><table><thead><tr><th>Arrived</th><th>Name</th><th>Email</th><th>Source</th><th>Fact find</th><th>Owner</th><th>Reference</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function caseRows(cases) {
  if (!cases.length) return '<p class="empty">No live cases on this seat.</p>';
  const rows = cases.map((item) => `<tr data-case="${esc(item.caseRef)}" data-owner="${esc(item.owner)}" data-seed="${esc(item.seedSource)}"><td>${esc(item.caseRef)}</td><td>${esc(item.label)}</td><td>${esc(item.stage)}</td><td>${esc(item.owner || '—')}</td><td>${esc(item.nextAction || '—')}</td><td>${esc(item.lender || '—')}</td></tr>`).join('');
  return `<div class="scroll"><table><thead><tr><th>Case</th><th>Label</th><th>Stage</th><th>Owner</th><th>Next action</th><th>Lender</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function taskCard(view, task) {
  const path = `/staff/cockpit/seat/${encodeURIComponent(view.seat.code)}`;
  const hidden = `<input type="hidden" name="seat" value="${esc(view.seat.code)}"><input type="hidden" name="task_id" value="${esc(task.id)}"><input type="hidden" name="from" value="${esc(view.query.from)}"><input type="hidden" name="to" value="${esc(view.query.to)}"><input type="hidden" name="source" value="${esc(view.query.source)}">`;
  const actors = SEATS.map((seat) => `<option${seat.name === view.seat.name ? ' selected' : ''}>${esc(seat.name)}</option>`).join('');
  const pill = task.answer ? `<p><span class="pill ${answerClass(task.answer)}" data-answer-label>${esc(answerLabel(task.answer))}</span> <span class="meta">${esc(task.answeredBy || '')}</span></p>` : '';
  const was = task.answer === 'edit' && task.editedText && task.originalPrompt !== task.prompt
    ? `<p class="meta">Was: ${esc(task.originalPrompt)}</p>`
    : '';
  const editor = view.editing === task.id
    ? `<form method="post" action="${esc(path)}">${hidden}<label for="edit-${esc(task.id)}">Next action</label><textarea id="edit-${esc(task.id)}" name="edited_text" maxlength="400">${esc(task.editedText || task.prompt)}</textarea><label for="edit-actor-${esc(task.id)}">Recorded by</label><select id="edit-actor-${esc(task.id)}" name="actor">${actors}</select><div class="actions"><button class="send" type="submit" name="action" value="save-edit">Save</button></div></form>`
    : '';
  return `<article class="card" id="task-${esc(task.id)}" data-task="${esc(task.id)}" data-answer="${esc(task.answer)}"><p class="kicker">${esc(task.kind)}</p><h3>${esc(task.title)}</h3><p>${esc(task.prompt)}</p>${was}${pill}<form method="post" action="${esc(path)}">${hidden}<label for="actor-${esc(task.id)}">Recorded by</label><select id="actor-${esc(task.id)}" name="actor">${actors}</select><div class="actions"><button class="send" type="submit" name="action" value="yes">Yes</button><button class="secondary" type="submit" name="action" value="no">No</button><button class="secondary" type="submit" name="action" value="edit">Edit</button></div></form>${editor}</article>`;
}

export function renderSeat(view) {
  const path = `/staff/cockpit/seat/${encodeURIComponent(view.seat.code)}`;
  const sourceOptions = ['all', ...view.sources].map((source) => `<option value="${esc(source)}"${source === view.query.source ? ' selected' : ''}>${esc(source === 'all' ? 'All sources' : source)}</option>`).join('');
  const tasks = view.tasks.length
    ? view.tasks.map((task) => taskCard(view, task)).join('')
    : '<p class="empty">No next actions for this seat today.</p>';
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff</span></div><h1>${esc(view.seat.name)}'s seat</h1><p class="sub">${esc(view.seat.role)} · every seat can view every case · ${esc(view.today)}</p></div></header><main class="wrap">${banner(view)}${pending(view)}<div class="bar"><a href="/staff/cockpit">Board</a><a href="#raw-leads">Raw leads</a><a href="#completed-fact-finds">Completed fact finds</a><a href="#live-cases">Live cases</a><a href="#daily-tasks">Today's sheet</a><form method="post" action="${esc(path)}"><input type="hidden" name="action" value="logout"><button class="secondary" type="submit">Log out</button></form></div><form class="card filter-card" method="get" action="${esc(path)}"><div><label for="from">From</label><input id="from" name="from" type="date" value="${esc(view.query.from)}"></div><div><label for="to">To</label><input id="to" name="to" type="date" value="${esc(view.query.to)}"></div><div><label for="source">Source</label><select id="source" name="source">${sourceOptions}</select></div><button class="send" type="submit">Filter</button></form><section class="lane" id="raw-leads" data-section="raw-leads"><p class="kicker">Over time</p><h2>Raw leads</h2><p class="meta">${view.leads.length} leads, newest first. Fact find stand comes from the lead and the fact find already stored.</p>${leadRows(view.leads, 'data-lead')}</section><section class="lane" id="completed-fact-finds" data-section="completed-fact-finds"><p class="kicker">Finished forms</p><h2>Completed fact finds</h2><p class="meta">People whose fact find is submitted or completed. Same date and source filters as raw leads.</p>${leadRows(view.completed, 'data-completed')}</section><section class="lane" id="live-cases" data-section="live-cases"><p class="kicker">Case register</p><h2>Live cases</h2><p class="meta">Every case on the migration book. Lender names are shown as Lender A–D. Same sheet for Byron's seat.</p>${caseRows(view.cases)}</section><section class="lane" id="daily-tasks" data-section="daily-tasks"><p class="kicker">${esc(view.seat.name)} · ${esc(view.today)}</p><h2>Today's sheet</h2><p class="meta">Next actions for this seat. Yes, No and Edit are saved for the seat, so Byron and ${esc(view.seat.name)} read the same answers.</p>${tasks}</section><footer class="footer"><p><strong>Posfin Capital</strong> · staff only · not an offer of finance</p></footer></main>`;
  return shell(`${view.seat.name}'s seat — Posfin`, body);
}
