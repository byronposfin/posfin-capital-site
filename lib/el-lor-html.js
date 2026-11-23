import { esc } from './case-portal.js';
import { ACTIVE_SEATS } from './broka.js';
import { NO_AI_TOOLTIP, PROCESSING_TASK } from './el-lor-config.js';

const CSS = `
:root{--navy:#1C184F;--ink:#13113A;--paper:#F6F4EF;--line:#E4DFD4;--teal:#0E7C78;--stop:#9F1239;--stop-bg:#FDECEC;--wait:#8A5A00;--wait-bg:#FFF6DF;--ok:#E7F6F3}
*{box-sizing:border-box}
body{margin:0;font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--paper);color:var(--ink);font-size:16px;line-height:1.45}
header.top{background:#13113A;color:#fff;padding:18px 16px}
h1{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:32px;margin:8px 0}
h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:26px;margin:0 0 8px}
.wrap{max-width:1120px;margin:0 auto;padding:16px 16px 64px}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px;margin:0 0 12px}
.meta{color:#5C5670;font-size:14px}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
a,button,input,select{font:inherit}
a.send,button.send,button.secondary{min-height:44px;border-radius:999px;padding:10px 14px;border:1px solid var(--navy);background:var(--navy);color:#fff;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-weight:700;cursor:pointer}
button.secondary{background:#fff;color:var(--ink);border-color:var(--line)}
button:disabled{background:#E7E2D8;color:#5C5670;border-color:#E7E2D8;cursor:not-allowed}
.chip{display:inline-block;border-radius:999px;padding:4px 8px;font-size:13px;font-weight:700;background:#E7E2D8;color:var(--navy)}
.chip.ok{background:var(--ok);color:var(--teal)}
.chip.wait{background:var(--wait-bg);color:var(--wait)}
.chip.stop{background:var(--stop-bg);color:var(--stop)}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:8px 6px;border-top:1px solid var(--line);vertical-align:top}
label{display:block;font-weight:700;margin:8px 0 4px}
select,input[type=text],input[type=password]{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;padding:8px}
.banner{background:#FFF6DF;border:1px solid #E2C98A;border-radius:14px;padding:12px;font-weight:700}
.fail{background:var(--stop-bg);color:var(--stop);border-radius:12px;padding:10px}
pre{white-space:pre-wrap;background:#F7F4EA;border-radius:12px;padding:10px}
.scroll{overflow-x:auto}
.choice{font-weight:700}
@media (min-width:800px){h1{font-size:42px}}
`;

const NOTICES = {
  'el-draft': 'Engagement letter draft saved. Nothing was sent.',
  'lor-draft': 'Lender copy saved. Nothing was sent.',
  'approval-pending': 'Owner approval is waiting. Nothing was sent.',
  'mock-sent': 'Mock e-sign returned sent. No external network call was made.',
  viewed: 'Viewed status recorded on this TEST case.',
  signed: 'Signed status recorded on this TEST case.',
  marked: 'Marked signed from the private file reference. Nothing was sent.',
  'lor-sent': 'Lender rows recorded as pending. Nothing left this preview.',
  response: 'Response recorded.',
  processing: 'Stage written. Nothing was sent.',
};

const BLOCK_CODE = {
  cifas: 'marker-c',
  bacs: 'payment-rail',
  artie: 'team-name',
  kai: 'team-name',
  jerry: 'team-name',
  internal_private: 'internal-marker',
  acknowledgement: 'blocked-heading',
  kpc: 'investor-name',
  broker_fee: 'fee-wording',
  procuration: 'fee-wording',
  proc_fee: 'fee-wording',
  success_fee: 'fee-wording',
  commission: 'fee-wording',
  introducer: 'fee-wording',
  percent_broker: 'fee-wording',
  excluded_lender: 'excluded-lender',
  bank_letter_1999: 'historic-letter',
  required: 'required',
  product: 'product',
  net_release: 'net-release',
  signing_line: 'signing-line',
  signature_row: 'signature-row',
  anchor: 'anchor',
  draft_tag: 'draft-tag',
  signatories: 'signatories',
  fee_line: 'fee-line',
};

function shell(title, body) {
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
  if (/internal_private/i.test(html)) {
    return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Withheld</title></head><body><p>This page was withheld by the content check.</p></body></html>`;
  }
  return html;
}

function seats(selected = 'byron') {
  return ACTIVE_SEATS.map((seat) => `<option value="${esc(seat.code)}"${seat.code === selected ? ' selected' : ''}>${esc(seat.name)}</option>`).join('');
}

function nav(current) {
  const live = current === 'live' ? ' aria-current="page"' : '';
  return `<p class="bar"><a href="/staff/cockpit">Board</a><a href="/staff/cockpit/live"${live}>Live cases</a><a href="/staff/cockpit/pipeline">Deal flow</a><a href="/staff/cockpit/broka/scorecard">Scorecard</a><a href="/staff/cases">Cases</a></p>`;
}

function scrub(value) {
  return String(value ?? '')
    .replace(/internal_private/gi, '[withheld]')
    .replace(/\bCIFAS\b/g, '[withheld]')
    .replace(/\bcifas\b/gi, '[withheld]')
    .replace(/\bBACS\b/gi, '[withheld]')
    .replace(/\bArtie\b/g, '[withheld]')
    .replace(/\bKai\b/g, '[withheld]')
    .replace(/\bJerry\b/g, '[withheld]')
    .replace(/\bKPC\b/g, '[withheld]');
}

export function renderElLorLogin(nextPath) {
  const body = `<header class="top"><div class="wrap"><h1>Live cases</h1></div></header><main class="wrap"><article class="card"><form method="post" action="${esc(nextPath)}"><label for="email">Work email</label><input id="email" name="email" type="email" autocomplete="username"><label for="password">Staff password</label><input id="password" name="password" type="password" required minlength="8"><button class="send" type="submit">Open the desk</button></form><p class="meta">On this preview each seat uses its own email once individual login is on. The shared preview password still opens the sample desk until then.</p></article></main>`;
  return shell('Live cases — Posfin', body);
}

export function renderElLorMissing() {
  const body = `<header class="top"><div class="wrap"><h1>Not available</h1></div></header><main class="wrap"><article class="card"><p>This desk is switched off.</p><p><a href="/staff/cockpit">Back to the board</a></p></article></main>`;
  return shell('Not available — Posfin', body);
}

export function renderElLorDenied(text) {
  const body = `<header class="top"><div class="wrap"><h1>Not allowed</h1></div></header><main class="wrap"><article class="card"><p>${esc(text)}</p><p><a href="/staff/cockpit/live">Live cases</a></p></article></main>`;
  return shell('Not allowed — Posfin', body);
}

export function renderElLorMessage(title, text) {
  const body = `<header class="top"><div class="wrap"><h1>${esc(title)}</h1></div></header><main class="wrap"><article class="card"><p>${esc(text)}</p><p><a href="/staff/cockpit/live">Live cases</a></p></article></main>`;
  return shell(`${title} — Posfin`, body);
}

function filters(model) {
  const stage = model.query.stage || 'all';
  const owner = model.query.owner || 'all';
  const stageOptions = ['all', ...model.stages].map((item) => `<option value="${esc(item)}"${item === stage ? ' selected' : ''}>${esc(item === 'all' ? 'All stages' : item)}</option>`).join('');
  const ownerOptions = ['all', ...model.owners].map((item) => `<option value="${esc(item)}"${item === owner ? ' selected' : ''}>${esc(item === 'all' ? 'All owners' : item)}</option>`).join('');
  const elMissing = model.query.el === 'missing' ? ' checked' : '';
  const lorMissing = model.query.lor === 'missing' ? ' checked' : '';
  const ready = model.query.ready === '1' || model.query.ready === 'yes' ? ' checked' : '';
  return `<form class="card" method="get" action="/staff/cockpit/live"><div class="bar"><label for="stage">Stage</label><select id="stage" name="stage">${stageOptions}</select><label for="owner">Owner</label><select id="owner" name="owner">${ownerOptions}</select></div><label class="choice"><input type="checkbox" name="el" value="missing"${elMissing}> EL missing</label><label class="choice"><input type="checkbox" name="lor" value="missing"${lorMissing}> LOR missing</label><label class="choice"><input type="checkbox" name="ready" value="1"${ready}> Ready for Processing</label><button class="secondary" type="submit">Filter</button></form>`;
}

export function renderLiveCases(model) {
  const warning = model.warning ? `<p class="banner" role="status">${esc(model.warning)}</p>` : '';
  const mock = '<p class="banner" data-mock="true">Preview sends are mock. Live sends stay off.</p><p class="banner" data-demo="el-lor">EL/LOR demo. TEST rows. The real cases are on each person’s seat.</p>';
  const rows = model.rows.map((row) => {
    const broka = row.brokaId
      ? `<a href="/staff/cockpit/el/${encodeURIComponent(row.caseRef)}#broka">${esc(row.brokaId)}</a>`
      : '—';
    const flags = row.flags.length ? row.flags.map((flag) => esc(scrub(flag))).join(', ') : '—';
    return `<tr data-case="${esc(row.caseRef)}" data-ready="${row.ready ? 'yes' : 'no'}"><td><a href="/staff/cockpit/el/${encodeURIComponent(row.caseRef)}">${esc(row.caseRef)}</a></td><td>${esc(scrub(row.label))}</td><td>${esc(row.stageLabel)}</td><td data-db-stage>${esc(row.dbStage)}</td><td>${esc(row.owner)}</td><td data-el-chip>${esc(row.elChip)}</td><td data-lor-chip>${esc(row.lorChip)}</td><td>${broka}</td><td data-eligible>${esc(String(row.eligibleCount))}</td><td>${flags}</td><td>${esc(row.nextAction)}</td></tr>`;
  }).join('');
  const body = `<header class="top"><div class="wrap"><p class="meta">Staff</p><h1>Live cases</h1></div></header><main class="wrap">${nav('live')}${warning}${mock}${filters(model)}<article class="card"><div class="scroll"><table><thead><tr><th>Case ref</th><th>Label</th><th>Stage</th><th>DB stage</th><th>Owner</th><th>EL</th><th>LOR</th><th>BROKA id</th><th>Eligible lenders</th><th>Flags</th><th>Next action</th></tr></thead><tbody>${rows || '<tr><td colspan="11">No cases on this filter.</td></tr>'}</tbody></table></div><p class="meta">${esc(String(model.rows.length))} shown of ${esc(String(model.total))}.</p></article></main>`;
  return shell('Live cases — Posfin', body);
}

function failureList(failures) {
  if (!failures || !failures.length) return '';
  const items = failures.map((item) => {
    const code = BLOCK_CODE[item.id] || 'blocked';
    return `<li data-block="${esc(code)}">${esc(item.label)}</li>`;
  }).join('');
  return `<div class="fail" role="alert"><p>The checker stopped this draft. Nothing was stored and nothing was sent.</p><ul>${items}</ul></div>`;
}

function historyRows(items, empty) {
  if (!items.length) return `<p>${empty}</p>`;
  return `<ul>${items.map((item) => `<li>v${esc(String(item.version))} · ${esc(item.status)}${item.current ? ' · current' : ''}${item.hlDocId ? ` · ${esc(item.hlDocId)}` : ''}${item.feeLine ? `<br>Fee: ${esc(item.feeLine)}` : ''}<br>${item.filename ? `${esc(item.filename)}. ` : ''}${esc('File held privately: request copy')}</li>`).join('')}</ul>`;
}

export function renderCasePage(view) {
  const notice = NOTICES[view.notice] ? `<p class="banner" role="status">${esc(NOTICES[view.notice])}</p>` : '';
  const flags = view.flags.length ? view.flags.map((flag) => `<span class="chip stop" data-flag="${esc(flag)}">${esc(scrub(flag))}</span>`).join(' ') : '<span class="chip">No flags</span>';
  const sendTitle = view.noAi ? NO_AI_TOOLTIP : (view.currentElStatus === 'draft' ? '' : 'A current draft is required.');
  const sendDisabled = view.noAi || view.currentElStatus !== 'draft';
  const sendButton = `<button class="send" type="submit" name="action" value="request-esign"${sendDisabled ? ' disabled' : ''}${sendTitle ? ` title="${esc(sendTitle)}"` : ''}>Send for e-sign</button>`;
  const simulate = view.canSimulate ? `<form method="post" action="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}"><input type="hidden" name="seat" value="byron"><button class="secondary" type="submit" name="action" value="simulate-viewed">Simulate viewed</button> <button class="secondary" type="submit" name="action" value="simulate-signed">Simulate signed</button><p class="meta">TEST cases only. Times are Europe/Paris.</p></form>` : '';
  const signerRows = view.signers.length
    ? `<ul>${view.signers.map((signer) => `<li data-signer="${esc(signer.name)}">${esc(signer.name)} · viewed ${esc(signer.viewed || 'not yet')} · signed ${esc(signer.signed || 'not yet')}</li>`).join('')}</ul>`
    : '<p>No signers on the current letter.</p>';
  const approvals = view.approvals.filter((item) => item.status === 'pending').map((item) => `<form method="post" action="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}" data-approval="${esc(item.id)}"><input type="hidden" name="approval_id" value="${esc(item.id)}"><p>Approval ${esc(item.actionType)} is pending.</p><label for="approve-seat-${esc(item.id)}">Seat</label><select id="approve-seat-${esc(item.id)}" name="seat">${seats('byron')}</select><button class="send" type="submit" name="action" value="approve">Approve</button></form>`).join('');
  const lenderChoices = view.lenders.map((lender) => `<label class="choice"><input type="checkbox" name="lenders" value="${esc(lender.name)}"> ${esc(lender.name)} · ${esc(lender.contact)}</label>`).join('');
  const stack = view.lenders.map((lender) => `<section data-lender="${esc(lender.name)}" data-baseline="${lender.baseline ? 'true' : 'false'}"><h3>${esc(lender.name)}</h3><p class="bar">${lender.baseline ? '<span class="chip">Baseline</span>' : ''}<span class="chip">Contact ${esc(lender.contact)}</span>${lender.sentVersion ? `<span class="chip wait" data-sent-marker>already sent LOR v${esc(String(lender.sentVersion))}</span>` : ''}</p></section>`).join('');
  const sentRows = view.sentLog.map((item) => `<tr data-sent-log="${esc(item.lender)}"><td>${esc(item.lender)}</td><td>${esc(item.contact)}</td><td>v${esc(String(item.version))}</td><td>${esc(item.sentAt)}</td><td data-outcome>${esc(item.outcome)}</td><td><form method="post" action="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}"><input type="hidden" name="response_id" value="${esc(item.id)}"><input type="hidden" name="seat" value="byron"><label for="outcome-${esc(item.id)}">Outcome</label><select id="outcome-${esc(item.id)}" name="outcome"><option value="terms">terms</option><option value="decline">decline</option><option value="referred">referred</option><option value="no_reply">no_reply</option></select><button class="secondary" type="submit" name="action" value="record-response">Record response</button></form></td></tr>`).join('');
  const move = view.processing.enabled
    ? `<form method="post" action="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}" data-processing="ready"><p>EL version ${esc(String(view.processing.version))}</p><ul>${view.processing.signers.map((signer) => `<li>${esc(signer.name)} · ${esc(signer.signed || 'not signed')}</li>`).join('')}</ul><p class="meta">This writes database stage ${esc(view.processing.dbStage)} and shows it as ${esc(view.processing.label)}. Nothing is sent.</p><label for="move-seat">Seat</label><select id="move-seat" name="seat">${seats('byron')}</select><button class="send" type="submit" name="action" value="move-processing">Move to Processing</button></form>`
    : `<p data-processing="blocked">${esc(view.processing.reason)}</p><button class="send" type="button" disabled>Move to Processing</button>`;
  const brokaButton = view.factFindSubmitted
    ? `<form method="post" action="/staff/cockpit/broka-jobs"><input type="hidden" name="case_ref" value="${esc(view.caseRef)}"><input type="hidden" name="stage" value="${esc(view.dbStageForBroka)}"><label for="broka-seat">Seat</label><select id="broka-seat" name="seat">${seats('byron')}</select><input type="hidden" name="regulated" value="no"><button class="send" type="submit">Submit to BROKA (eligibility check)</button></form>`
    : '<button class="send" type="button" disabled>Submit to BROKA (eligibility check)</button><p class="meta">Enabled only when the fact find is submitted.</p>';
  const brokaId = view.brokaId
    ? `<p>BROKA id <a href="/staff/cockpit/broka/${encodeURIComponent(view.caseRef)}">${esc(view.brokaId)}</a></p>`
    : '<p>No BROKA id is stored. This desk does not mint one.</p>';
  const probe = view.isTest ? '<label for="inject">Add a line to the draft before the check</label><input id="inject" name="inject" type="text" maxlength="200">' : '';
  const body = `<header class="top"><div class="wrap"><p class="meta">Staff</p><h1>${esc(scrub(view.label))}</h1><p>${esc(view.caseRef)}</p></div></header><main class="wrap">${nav('')}${notice}${failureList(view.failures)}<p class="banner" data-mock="true">Preview sends are mock. Live sends stay off.</p><p class="bar"><span class="chip" data-el-chip>${esc(view.elChip)}</span><span class="chip" data-lor-chip>${esc(view.lorChip)}</span>${flags}</p><p class="meta">${esc(view.stageLabel)} · database ${esc(view.dbStage)} · ${esc(view.owner)} · ${esc(view.nextAction)}</p>
<article class="card" id="el"><h2>Engagement letter</h2>${historyRows(view.elHistory, 'No engagement letter yet.')}${signerRows}<form method="post" action="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}"><label for="el-seat">Seat</label><select id="el-seat" name="seat">${seats('byron')}</select>${probe}<div class="bar"><button class="secondary" type="submit" name="action" value="generate-el">Generate EL</button></div></form><p class="bar"><a class="send" href="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}?doc=el">View EL</a></p><form method="post" action="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}">${view.noAi ? `<p data-no-ai>${esc(NO_AI_TOOLTIP)}</p>` : ''}<label for="send-seat">Seat</label><select id="send-seat" name="seat">${seats('byron')}</select><div class="bar">${sendButton}</div></form>${approvals}${simulate}<form method="post" action="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}"><label for="mark-seat">Seat</label><select id="mark-seat" name="seat">${seats('byron')}</select><label for="file_name">Private file name</label><input id="file_name" name="file_name" type="text" maxlength="120"><label for="file_link">Private link</label><input id="file_link" name="file_link" type="text" maxlength="200"><button class="secondary" type="submit" name="action" value="mark-signed">Mark signed</button><p class="meta">Owner seat only. The file stays private. ${esc('File held privately: request copy')}</p></form></article>
<article class="card" id="lor"><h2>LOR</h2><p class="meta">Lender-copy versions only. Internal drafts are not shown here.</p>${historyRows(view.lorHistory, 'No lender copy yet.')}<form method="post" action="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}"><label for="lor-seat">Seat</label><select id="lor-seat" name="seat">${seats('byron')}</select>${view.isTest ? '<label for="lor-inject">Add a line to the lender copy before the check</label><input id="lor-inject" name="inject" type="text" maxlength="200">' : ''}<button class="secondary" type="submit" name="action" value="generate-lor">Generate LOR</button></form><p class="bar"><a class="send" href="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}?doc=lor">View LOR</a></p><form method="post" action="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}"><fieldset><legend>Eligible lenders</legend>${lenderChoices || '<p>No eligible lender is on this case.</p>'}</fieldset><p class="meta" data-excluded-count="${esc(String(view.excludedCount))}">Lenders on the exclusion list are not offered.</p><label for="lor-send-seat">Seat</label><select id="lor-send-seat" name="seat">${seats('byron')}</select><button class="secondary" type="submit" name="action" value="request-lor-send">Send to lenders</button></form><h3>Sent log</h3><div class="scroll"><table><thead><tr><th>Lender</th><th>Contact</th><th>Version</th><th>Sent</th><th>Outcome</th><th></th></tr></thead><tbody>${sentRows || '<tr><td colspan="6">Nothing sent.</td></tr>'}</tbody></table></div></article>
<article class="card" id="broka"><h2>BROKA</h2>${brokaId}<p>Job status: ${esc(view.job ? view.job.status : 'No BROKA job')}</p>${brokaButton}<h3>Eligible stack</h3>${stack || '<p>No eligible lender is on this case.</p>'}<p class="meta">Indicative terms, apply and attestation stay manual. This page does not contact BROKA.</p></article>
<article class="card" id="stage"><h2>Stage and Processing</h2><ol>${view.timeline.map((item) => `<li>${esc(item.at)} · ${esc(item.actor)} · ${esc(item.label)} · ${esc(item.from || '—')} → ${esc(item.to)}</li>`).join('') || '<li>No events.</li>'}</ol>${move}<h3>Tasks</h3><ul>${view.tasks.map((task) => `<li${task.title === PROCESSING_TASK ? ' data-processing-task' : ''}>${esc(task.title)}${task.open ? ' · open' : ''}</li>`).join('') || '<li>No tasks.</li>'}</ul><h3>Audit</h3><ul>${view.audit.map((item) => `<li data-audit>${esc(item.at)} · ${esc(item.actor)} · ${esc(item.table)} · ${esc(item.stage)}</li>`).join('') || '<li>No audit rows from this desk.</li>'}</ul></article></main>`;
  return shell(`${view.caseRef} — Live case`, body);
}

export function renderDocument(view) {
  const body = `<header class="top"><div class="wrap"><p class="meta">Staff</p><h1>${esc(view.title)}</h1></div></header><main class="wrap">${nav('')}<article class="card"><p>${esc(view.filename)}. File held privately: request copy</p><pre>${esc(view.body)}</pre><p><a href="/staff/cockpit/el/${encodeURIComponent(view.caseRef)}">Back to the case</a></p></article></main>`;
  return shell(`${view.title} — Posfin`, body);
}
