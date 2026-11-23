import { esc } from './case-portal.js';
import { ACTIVE_SEATS, caseRefOk, statusChips } from './broka.js';

const CSS = `
:root{--navy:#1C184F;--ink:#13113A;--paper:#F6F4EF;--line:#E4DFD4;--teal:#0E7C78;--stop:#9F1239;--stop-bg:#FDECEC;--wait:#8A5A00;--wait-bg:#FFF6DF;--ok:#E7F6F3}
*{box-sizing:border-box}
body{margin:0;font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--paper);color:var(--ink);font-size:16px;line-height:1.45}
header.top{background:#13113A;color:#fff;padding:18px 16px}
h1{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:32px;margin:8px 0}
.wrap{max-width:880px;margin:0 auto;padding:16px 16px 64px}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px;margin:0 0 12px}
.meta{color:#5C5670;font-size:14px}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
a,button{font:inherit}
a.send,button.send,button.secondary{min-height:44px;border-radius:999px;padding:10px 14px;border:1px solid var(--navy);background:var(--navy);color:#fff;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-weight:700;cursor:pointer}
button.secondary{background:#fff;color:var(--ink);border-color:var(--line)}
button:disabled,a.send[aria-disabled="true"]{background:#E7E2D8;color:#5C5670;border-color:#E7E2D8;cursor:not-allowed}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0;padding:0;list-style:none}
.chip{display:inline-block;border-radius:999px;padding:6px 10px;font-size:13px;font-weight:700}
.chip.ok{background:var(--ok);color:var(--teal)}
.chip.wait{background:var(--wait-bg);color:var(--wait)}
.chip.stop{background:var(--stop-bg);color:var(--stop)}
.chip.plain{background:#E7E2D8;color:var(--navy)}
.missing{color:var(--stop);font-weight:700}
.check{margin:0;padding:0;list-style:none}
.check li{padding:6px 0;border-top:1px solid var(--line)}
label{display:block;font-weight:700;margin:8px 0 4px}
select,input[type=text]{width:100%;min-height:48px;border:1px solid var(--line);border-radius:12px;padding:10px}
.choice{font-weight:700}
pre.draft{white-space:pre-wrap;background:#F7F4EA;border-radius:12px;padding:10px;font:14px/1.4 ui-monospace,monospace}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:8px 6px;border-top:1px solid var(--line);vertical-align:top}
.banner{background:#FFF6DF;border:1px solid #E2C98A;border-radius:14px;padding:12px;font-weight:700}
@media (min-width:800px){h1{font-size:44px}}
`;

function shell(title, body) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

export function brokaLaunch(model) {
  const label = 'Submit to BROKA (eligibility check)';
  if (!model || !caseRefOk(model.caseRef) || !model.submitted) {
    const why = model && caseRefOk(model.caseRef)
      ? 'Enabled only when the fact find is submitted.'
      : 'This card has no case reference yet.';
    return `<p><button type="button" class="send" disabled>${label}</button></p><p class="meta">${esc(why)} Nothing on this page contacts BROKA.</p>`;
  }
  return `<form method="get" action="/staff/cockpit/broka/${encodeURIComponent(model.caseRef)}"><input type="hidden" name="stage" value="${esc(model.stage || '')}"><button class="send" type="submit">${label}</button></form><p class="meta">Opens the eligibility check. BROKA is not contacted.</p>`;
}

function fieldList(check) {
  return check.fields.map((field) => {
    if (field.missing) return `<li class="missing">${esc(field.label)}</li>`;
    const extra = field.source === 'epc_lookup' ? ' <span class="meta">prefilled from EPC lookup</span>' : '';
    return `<li>${esc(field.label)}: ${esc(field.value)}${extra}</li>`;
  }).join('');
}

function outreachBlock(view) {
  const rows = (view.prepared || []).map((row) => `<section class="result"><h3>${esc(row.lender)}</h3><p class="meta">Status ${esc(row.status)}. sent_at ${esc(row.sentAt || 'not set')}. Contact ${esc(row.contact || 'UNKNOWN')}.</p><pre class="draft">${esc(row.draft || '')}</pre><form method="post" action="/staff/cockpit/broka/${encodeURIComponent(view.caseRef)}"><input type="hidden" name="case_ref" value="${esc(view.caseRef)}"><input type="hidden" name="action" value="record-sent"><input type="hidden" name="response_id" value="${esc(row.id)}"><label for="sent-seat-${esc(row.id)}">Seat</label><select id="sent-seat-${esc(row.id)}" name="seat"><option value="byron" selected>Byron Hill</option><option value="jess">Jess</option></select><button class="secondary" type="submit">Record sent_at</button></form></section>`).join('');
  return `<article class="card"><h2>Lender notes</h2><p class="meta">Prepare writes one row per eligible lender and renders the outreach file. It does not send.</p><form method="post" action="/staff/cockpit/broka/${encodeURIComponent(view.caseRef)}"><input type="hidden" name="case_ref" value="${esc(view.caseRef)}"><button class="secondary" type="submit" name="action" value="prepare-emails">Prepare lender emails</button></form>${rows}</article>`;
}

function chips(view) {
  return statusChips({
    submitted: view.submitted,
    control: view.control,
    job: view.job,
    regulated: view.preflight.regulated,
    blocks: view.preflight.blocks,
  }).map((chip) => `<li class="chip ${esc(chip.tone)}" data-chip="${esc(chip.id)}">${esc(chip.label)}</li>`).join('');
}

export function renderBrokaCase(view, message = '') {
  const seats = ACTIVE_SEATS.map((seat) => `<option value="${esc(seat.code)}"${seat.code === 'byron' ? ' selected' : ''}>${esc(seat.name)}</option>`).join('');
  const regulated = view.preflight.regulated;
  const submit = view.submitted
    ? `<button class="send" type="submit" name="action" value="open-job">Submit to BROKA (eligibility check)</button>`
    : `<button class="send" type="button" disabled>Submit to BROKA (eligibility check)</button>`;
  const pauseLabel = view.control.paused ? 'Resume searches' : 'Pause searches';
  const pauseValue = view.control.paused ? 'resume' : 'pause';
  const pauseSeats = ACTIVE_SEATS.map((seat) => `<option value="${esc(seat.code)}"${seat.code === 'byron' ? ' selected' : ''}>${esc(seat.name)}</option>`).join('');
  const banner = message ? `<p class="banner" role="status">${esc(message)}</p>` : '';
  const held = view.brokaCaseId ? `<p>Existing BROKA case id: <strong>${esc(view.brokaCaseId)}</strong>. A second id will not be created.</p>` : '<p>No BROKA case id is stored. This check will not mint one.</p>';
  const body = `<header class="top"><div class="wrap"><p class="meta">Staff</p><h1>${esc(view.title)}</h1><p>${esc(view.caseRef)}</p></div></header><main class="wrap">${banner}<p class="bar"><a href="/staff/cockpit">Board</a><a href="/staff/cockpit/pipeline">Deal flow</a><a href="/staff/cases">Cases</a><a href="/staff/cockpit/broka/scorecard">Scorecard</a></p><ul class="chips">${chips(view)}</ul><article class="card"><h2>Pre-flight</h2><p class="meta">Missing required fields are in red. This page does not contact BROKA, a lender, or a borrower.</p><ul class="check">${fieldList(view.preflight)}</ul>${held}<form method="post" action="/staff/cockpit/broka-jobs"><input type="hidden" name="case_ref" value="${esc(view.caseRef)}"><label for="seat">Seat</label><select id="seat" name="seat">${seats}</select><fieldset><legend>Regulated</legend><label class="choice"><input type="radio" name="regulated" value="yes"${regulated === true ? ' checked' : ''}> Regulated</label><label class="choice"><input type="radio" name="regulated" value="no"${regulated === false ? ' checked' : ''}> Not regulated</label></fieldset><div class="bar">${submit}</div><p class="meta">The button records a job inside Posfin when the fact find is submitted. It does not send a search.</p></form></article><article class="card"><h2>Results</h2><p class="meta">Grouped by lender. A lender that is not already in the directory is added to PLACED immediately. Contacts are not guessed.</p>${(view.results || []).map((group) => `<section class="result" data-lender="${esc(group.lender)}"><h3>${esc(group.lender)} · ${esc(group.label)}</h3><p class="bar">${group.baseline ? '<span class="chip plain">Baseline</span>' : ''}${group.isNew ? '<span class="chip wait">New lender</span>' : ''}<span class="chip plain">Contact ${esc(group.contact || 'UNKNOWN')}</span></p></section>`).join('') || '<p>No results recorded.</p>'}<form method="post" action="/staff/cockpit/broka/${encodeURIComponent(view.caseRef)}"><input type="hidden" name="case_ref" value="${esc(view.caseRef)}"><input type="hidden" name="action" value="record-result"><label for="lender">Lender already heard from</label><input id="lender" name="lender" type="text" maxlength="80"><label for="rate">Rate</label><input id="rate" name="rate" type="text" maxlength="40"><div class="bar"><button class="secondary" type="submit">Record this result</button></div><p class="meta">Stores the result on this desk. It does not email the lender.</p></form></article>${outreachBlock(view)}<article class="card"><h2>Search pause</h2><p class="meta">Standing approval is on. Byron can pause it. A paused search waits for approval.</p><form method="post" action="/staff/cockpit/broka/${encodeURIComponent(view.caseRef)}"><input type="hidden" name="case_ref" value="${esc(view.caseRef)}"><label for="pause-seat">Seat for the pause switch</label><select id="pause-seat" name="seat">${pauseSeats}</select><button class="secondary" type="submit" name="action" value="${pauseValue}">${pauseLabel}</button><p class="meta">Only Byron can change the pause switch.</p></form></article></main>`;
  return shell(`${view.caseRef} — BROKA check`, body);
}

export function renderScorecard(model) {
  const rows = (model.scorecard || []).map((row) => `<tr><td>${esc(row.lender)}</td><td>${esc(String(row.approached))}</td><td>${esc(row.knownLabel)}</td><td>${esc(row.score.toFixed(2))}</td><td>${esc(String(row.quickDeclines))}</td></tr>`).join('');
  const shortlist = (model.shortlist || []).map((row) => `<li><strong>${esc(String(row.shortlistRank))}.</strong> ${esc(row.lender)} · score ${esc(row.score.toFixed(2))} · ${esc(knownLabel(row))}</li>`).join('');
  const body = `<header class="top"><div class="wrap"><p class="meta">Staff</p><h1>Lender scorecard</h1></div></header><main class="wrap"><p class="bar"><a href="/staff/cockpit">Board</a><a href="/staff/cockpit/pipeline">Deal flow</a><a href="/staff/cockpit/broka/PREVIEW-NORTHGATE">Example case</a><a href="/staff/cockpit/broka/scorecard" aria-current="page">Scorecard</a></p><article class="card"><h2>All lenders</h2><p class="meta">Score is 50% speed, 40% terms and 10% completeness. A decline inside 24 hours is not penalised on speed.</p><table><thead><tr><th>Lender</th><th>Approached</th><th>Known</th><th>Score</th><th>Quick declines</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No scored responses yet.</td></tr>'}</tbody></table></article><article class="card"><h2>Shortlist · ${esc(model.caseRef || '')}</h2><p class="meta">The first five sets of terms, ranked by score.</p><ol>${shortlist || '<li>No terms yet.</li>'}</ol></article></main>`;
  return shell('Lender scorecard — Posfin', body);
}

function knownLabel(row) {
  const count = row.terms ? Object.keys(row.terms).filter((key) => row.terms[key] != null && String(row.terms[key]).trim() !== '').length : 0;
  return `${count} of 6 known`;
}

export function renderBrokaLogin() {
  const body = `<header class="top"><div class="wrap"><h1>BROKA check</h1></div></header><main class="wrap"><article class="card"><form method="post" action="/staff/cockpit/broka/PREVIEW-NORTHGATE"><label for="email">Work email</label><input id="email" name="email" type="email" autocomplete="username"><label for="password">Staff password</label><input id="password" name="password" type="password" required minlength="8"><button class="send" type="submit">Open the check</button></form></article></main>`;
  return shell('BROKA check — Posfin', body);
}

export function renderBrokaMessage(title, text) {
  const body = `<header class="top"><div class="wrap"><h1>${esc(title)}</h1></div></header><main class="wrap"><article class="card"><p>${esc(text)}</p><p><a href="/staff/cockpit">Back to the board</a></p></article></main>`;
  return shell(title, body);
}
