import { esc } from './case-portal.js';
import { COLUMNS } from './pipeline.js';
import { BROKA, lenderChoices } from './pipeline-actions.js';
import { launchModel } from './broka.js';
import { brokaLaunch } from './broka-html.js';

const CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#F6F4EF;color:#13113A}
header.top{background:#13113A;color:#fff;padding:16px}
h1{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:32px;margin:8px 0}
.wrap{padding:12px}
.banner{background:#FFF6DF;border:1px solid #E2C98A;border-radius:14px;padding:12px;font-weight:700}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.bar a,button{min-height:44px;border-radius:999px;padding:8px 12px;border:1px solid #E4DFD4;background:#fff;color:#13113A;text-decoration:none}
button:disabled{opacity:.55;cursor:not-allowed}
.columns{display:flex;flex-direction:column;gap:12px}
.col{background:#fff;border:1px solid #E4DFD4;border-radius:16px;padding:12px}
.col.money{outline:2px solid #0E7C78}
.col h2{font-size:18px;margin:0 0 8px}
.card{border-top:1px solid #E4DFD4;padding:10px 0}
.card h3{margin:0 0 4px;font-size:16px}
.meta{color:#5C5670;font-size:14px}
.flag{display:inline-block;background:#FDECEC;color:#9F1239;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:700}
.money-flag{background:#E7F6F3;color:#0E7C78}
a.drive{color:#0E7C78}
@media (min-width:1100px){
  h1{font-size:42px}
  .columns{display:grid;grid-template-columns:repeat(3,1fr);align-items:start}
}
`;

function money(value) {
  if (!Number.isFinite(value)) return '';
  return '£' + value.toLocaleString('en-GB');
}

function card(item) {
  const loan = Number.isFinite(item.loan) ? money(item.loan) : (item.loanLabel || '');
  const verified = Number.isFinite(item.feeVerified) ? `Verified fee ${money(item.feeVerified)}` : 'Verified fee blank';
  const assumed = Number.isFinite(item.feeAssumed) ? `Assumed LOR fee ${money(item.feeAssumed)} (2% proc + 3% broker). Not added to the verified fee.` : '';
  const drive = item.driveUrl ? `<p><a class="drive" href="${esc(item.driveUrl)}">Drive folder</a></p>` : '';
  const flags = (item.flags || []).map((flag) => `<span class="flag">${esc(flag)}</span>`).join(' ');
  const history = (item.history || []).map((row) => `<li>${esc(row.source)}: ${esc(row.stage)}${row.note ? ' — ' + esc(row.note) : ''}</li>`).join('');
  return `<article class="card" data-source="${esc(item.source || '')}"><h3>${esc(item.name || 'Unnamed')}</h3><p class="meta">${esc(item.caseRef || 'No case ref')} · ${esc(item.owner || 'Owner blank')} · ${esc(item.lender || 'Lender blank')}</p><p>${esc(loan || 'Loan blank')}</p><p>${esc(verified)}</p>${assumed ? `<p>${esc(assumed)}</p>` : ''}<p>${esc(item.nextAction || 'Next action blank')}</p>${item.substatus ? `<p class="meta">${esc(item.substatus)}</p>` : ''}${item.reason ? `<p class="meta">${esc(item.reason)}</p>` : ''}<p>${flags}</p>${drive}${item.linked && item.linked.length ? `<p class="meta">${item.linked.length} older lead${item.linked.length === 1 ? '' : 's'} linked</p>` : ''}${(item.callNotes || []).map((note) => `<p class="meta">${esc(note.owner)} calls${note.date ? ' ' + esc(note.date) : ''}${note.sourceRow ? ' · ' + esc(note.sourceRow) : ''}. ${esc(note.note)}</p>`).join('')}
<details><summary>Stage history</summary><ul>${history}</ul></details>
<form method="post" action="/staff/cockpit/pipeline">
<input type="hidden" name="case" value="${esc(item.caseRef || item.id)}">
<label for="proc-${esc(item.id)}">Proc %</label>
<input id="proc-${esc(item.id)}" name="proc" type="number" min="0" max="20" step="0.1" value="2">
<label for="broker-${esc(item.id)}">Broker %</label>
<input id="broker-${esc(item.id)}" name="broker" type="number" min="0" max="20" step="0.1" value="3">
<label for="lenders-${esc(item.id)}">Lenders</label>
<select id="lenders-${esc(item.id)}" name="lenders" multiple size="4">${lenderChoices(item.lenderOptions).map((name) => `<option${name === BROKA ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select>
<div class="bar">
<button type="submit" name="action" value="lor">Create/Update LOR</button>
<button type="submit" name="action" value="title">Title</button>
<button type="submit" name="action" value="el">Create EL</button>
<button type="submit" name="action" value="send-lor">Send LOR to lenders</button>
</div>
<p class="meta">Send, Title and an e-sign request stop for Byron. Create LOR and Create EL stay inside Posfin.</p>
</form>
${moveForm(item)}
${brokaLaunch(launchModel(item))}
</article>`;
}

const STAGE_OPTIONS = COLUMNS.map((column) => column.id).concat(['parked', 'completed']);

function moveForm(item) {
  const options = STAGE_OPTIONS.map((id) => `<option${id === item.stage ? ' selected' : ''}>${esc(id)}</option>`).join('');
  return `<form method="post" action="/staff/cockpit/pipeline"><input type="hidden" name="case" value="${esc(item.caseRef || item.id)}"><label for="to-${esc(item.id)}">Move to</label><select id="to-${esc(item.id)}" name="to">${options}</select><label for="by-${esc(item.id)}">Moved by</label><select id="by-${esc(item.id)}" name="moved_by"><option>Byron</option><option>Chris</option><option>Aadi</option><option>Lizzy</option></select><div class="bar"><button type="submit" name="action" value="move">Move</button><button type="submit" name="action" value="route-chris">Route to Chris</button></div></form>`;
}

export function renderPipeline(board, meta) {
  const owner = meta.owner || 'all';
  const owners = ['all', 'Byron', 'Chris', 'Aadi', 'Lizzy'].map((name) => `<a href="/staff/cockpit/pipeline?owner=${encodeURIComponent(name)}"${name === owner ? ' aria-current="page"' : ''}>${esc(name === 'all' ? 'All owners' : name)}</a>`).join('');
  const columns = board.columns.map((column) => `<section class="col${column.highlight ? ' money' : ''}" data-stage="${esc(column.id)}"><h2>${esc(column.title)} <span class="meta">${column.cards.length}</span></h2><p class="meta">${esc(column.move)}</p>${column.cards.map(card).join('') || '<p class="meta">None</p>'}</section>`).join('');
  const parked = `<section class="col" data-stage="parked"><h2>Parked / Declined <span class="meta">${board.parked.length}</span></h2>${board.parked.map(card).join('') || '<p class="meta">None</p>'}</section>`;
  const done = `<section class="col" data-stage="completed"><h2>Completed <span class="meta">${board.completed.length}</span></h2>${board.completed.map(card).join('') || '<p class="meta">None</p>'}</section>`;
  const counts = meta.counts ? `<script type="application/json" id="board-counts">${JSON.stringify(meta.counts)}</script>` : '';
  const body = `<header class="top"><div class="wrap"><p class="meta">Staff</p><h1>Deal flow</h1><p>Existing Supabase rows and the Master CRM sheet are not changed. Stage moves stay on this preview.</p></div></header><main class="wrap"><p class="banner">${esc(meta.banner)}</p><div class="bar"><a href="/staff/cockpit">Board</a><a href="/staff/cases">Cases</a><a href="/staff/cockpit/broka/scorecard">Scorecard</a><a href="/staff/cockpit/spine/POSFIN-WEB-EYCTQ6">Stage-2 spine</a>${owners}</div><div class="columns">${columns}${parked}${done}</div></main>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Deal flow — Posfin</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Playfair+Display:wght@500&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}${counts}</body></html>`;
}

export function renderConfirm(text, fields) {
  const hidden = ['case', 'action', 'proc', 'broker'].map((name) => `<input type="hidden" name="${name}" value="${esc(fields[name] || '')}">`).join('');
  const lenders = [].concat(fields.lenders || []).map((name) => `<input type="hidden" name="lenders" value="${esc(name)}">`).join('');
  const body = `<header class="top"><div class="wrap"><h1>Confirm before anything leaves Posfin</h1></div></header><main class="wrap"><article class="col"><p>${esc(text)}</p><form method="post" action="/staff/cockpit/pipeline">${hidden}${lenders}<input type="hidden" name="confirm" value="yes"><button type="submit">Queue for Byron</button></form><p><a href="/staff/cockpit/pipeline">Back without queueing</a></p></article></main>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

export function renderPipelineLogin() {
  const body = `<header class="top"><div class="wrap"><h1>Deal flow</h1></header><main class="wrap"><form method="post" action="/staff/cockpit/pipeline"><label for="password">Staff password</label><input id="password" name="password" type="password" required minlength="8"><button type="submit">Open the pipeline</button></form></main>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deal flow</title></head><body>${body}</body></html>`;
}
