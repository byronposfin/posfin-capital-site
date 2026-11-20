import { esc } from './case-portal.js';
import { COLUMNS } from './pipeline.js';

const CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#F6F4EF;color:#13113A}
header.top{background:#13113A;color:#fff;padding:16px}
h1{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:32px;margin:8px 0}
.wrap{padding:12px}
.banner{background:#FFF6DF;border:1px solid #E2C98A;border-radius:14px;padding:12px;font-weight:700}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.bar a,button{min-height:44px;border-radius:999px;padding:8px 12px;border:1px solid #E4DFD4;background:#fff;color:#13113A;text-decoration:none}
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
  return `<article class="card"><h3>${esc(item.name || 'Unnamed')}</h3><p class="meta">${esc(item.caseRef || 'No case ref')} · ${esc(item.owner || 'Owner blank')} · ${esc(item.lender || 'Lender blank')}</p><p>${esc(loan || 'Loan blank')}</p><p>${esc(verified)}</p>${assumed ? `<p>${esc(assumed)}</p>` : ''}<p>${esc(item.nextAction || 'Next action blank')}</p>${item.substatus ? `<p class="meta">${esc(item.substatus)}</p>` : ''}${item.reason ? `<p class="meta">${esc(item.reason)}</p>` : ''}<p>${flags}</p>${drive}${item.linked && item.linked.length ? `<p class="meta">${item.linked.length} older lead${item.linked.length === 1 ? '' : 's'} linked</p>` : ''}<details><summary>Stage history</summary><ul>${history}</ul></details></article>`;
}

export function renderPipeline(board, meta) {
  const columns = board.columns.map((column) => `<section class="col${column.highlight ? ' money' : ''}" data-stage="${esc(column.id)}"><h2>${esc(column.title)} <span class="meta">${column.cards.length}</span></h2><p class="meta">${esc(column.move)}</p>${column.cards.map(card).join('') || '<p class="meta">None</p>'}</section>`).join('');
  const parked = `<section class="col" data-stage="parked"><h2>Parked / Declined <span class="meta">${board.parked.length}</span></h2>${board.parked.map(card).join('') || '<p class="meta">None</p>'}</section>`;
  const done = `<section class="col" data-stage="completed"><h2>Completed <span class="meta">${board.completed.length}</span></h2>${board.completed.map(card).join('') || '<p class="meta">None</p>'}</section>`;
  const body = `<header class="top"><div class="wrap"><p class="meta">Staff</p><h1>Deal flow</h1><p>Read-only. Existing Supabase rows and the Master CRM sheet are not changed.</p></div></header><main class="wrap"><p class="banner">${esc(meta.banner)}</p><div class="bar"><a href="/staff/cockpit">Board</a><a href="/staff/cases">Cases</a><a href="/staff/cockpit/spine/POSFIN-WEB-EYCTQ6">Stage-2 spine</a></div><div class="columns">${columns}${parked}${done}</div></main>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Deal flow — Posfin</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Playfair+Display:wght@500&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}</body></html>`;
}

export function renderPipelineLogin() {
  const body = `<header class="top"><div class="wrap"><h1>Deal flow</h1></header><main class="wrap"><form method="post" action="/staff/cockpit/pipeline"><label for="password">Staff password</label><input id="password" name="password" type="password" required minlength="8"><button type="submit">Open the pipeline</button></form></main>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deal flow</title></head><body>${body}</body></html>`;
}
