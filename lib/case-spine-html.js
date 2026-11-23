import { esc } from './case-portal.js';
import { OWNERS } from './cockpit.js';
import { PILOT_REF } from './case-spine.js';

const CSS = `
:root{--navy:#1C184F;--ink:#13113A;--paper:#F6F4EF;--line:#E4DFD4;--teal:#0E7C78;--urgent:#9F1239;--urgent-bg:#FDECEC}
*{box-sizing:border-box}
body{margin:0;font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper);font-size:16px;line-height:1.45}
header.top{background:linear-gradient(180deg,#1C184F,#13113A);color:#fff;padding:18px 16px 22px}
.top-inner,.wrap{max-width:1120px;margin:0 auto}
.wrap{padding:16px 16px 64px}
.brand{display:flex;justify-content:space-between;align-items:center;gap:12px}
.brand img{height:34px}
.private{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72)}
h1{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:32px;line-height:1.1;margin:14px 0 6px}
h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:26px;margin:0 0 8px}
.sub{margin:0;color:rgba(255,255,255,.82)}
.banner{background:#FFF6DF;border:1px solid #E2C98A;color:#5C4300;border-radius:16px;padding:12px 14px;margin:0 0 14px;font-weight:700}
.banner.off{background:#F3F0E8;border-color:var(--line);color:#3d3850}
.deadline{background:var(--urgent-bg);color:var(--urgent);border-radius:16px;padding:14px;margin:0 0 14px}
.deadline strong{display:block;font-size:18px}
.bar,.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.bar{margin:0 0 14px}
.bar a,button{min-height:44px;border-radius:999px;padding:10px 14px;border:1px solid var(--line);background:#fff;color:var(--ink);text-decoration:none;display:inline-flex;align-items:center}
button.send{background:var(--navy);color:#fff;border-color:var(--navy);font-weight:700}
button.linkish{color:var(--teal);background:#fff}
.grid{display:flex;flex-direction:column;gap:12px}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:14px}
.kicker{margin:0;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);font-weight:700}
.rail{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.rail li{border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:#fff}
.rail li.now{border-color:var(--navy);background:#F4F2FA;font-weight:700}
.rail li.earlier{background:#E7F6F3}
.pill{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;border-radius:999px;padding:4px 8px}
.pill.HELD{background:#E7F6F3;color:var(--teal)}
.pill.DRAFT_READY{background:#E8EEF8;color:#1C3D73}
.pill.IN_PROGRESS{background:#FFF6DF;color:#8A5A00}
.pill.MISSING{background:var(--urgent-bg);color:var(--urgent)}
.pill.met{background:#E7F6F3;color:var(--teal)}
.pill.unmet{background:var(--urgent-bg);color:var(--urgent)}
dl{margin:0}
dt{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6B6578;margin-top:8px}
dd{margin:0}
ol.actions-list,ul.plain{margin:0;padding-left:18px}
label{display:block;font-weight:700;margin:8px 0 4px}
select{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;padding:8px}
.meta{color:#5C5670;font-size:14px}
@media (min-width:960px){
  h1{font-size:44px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
  .span-2{grid-column:1 / -1}
  .rail{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
  .rail li{min-height:100%}
}
`;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Playfair+Display:wght@500&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}</body></html>`;
}

function engineBanner(view) {
  if (view.engine === 'on') return '<p class="banner">Waiting-condition engine: Flag ON. This preview only reports whether the stage looks ready. It does not move the stage, send a pack, or write to Supabase.</p>';
  if (view.engine === 'preview') return '<p class="banner">Waiting-condition engine: preview sandbox. Flag OFF in the environment. This toggle is preview-only. It does not send anything or write to the database.</p>';
  return '<p class="banner off" role="status">Waiting-condition engine: Flag OFF. Conditions are parked and read-only. Nothing on this page moves the stage.</p>';
}

function toggleLink(view) {
  const base = `/staff/cockpit/spine/${encodeURIComponent(view.spine.ref)}`;
  if (view.engine === 'on') return '';
  if (view.engine === 'preview') return `<a href="${base}">Hide the sandbox</a>`;
  return `<a href="${base}?waiting=preview">Preview the waiting-condition sandbox</a>`;
}

export function renderSpine(view, auditByAction) {
  const spine = view.spine;
  const header = spine.caseHeader;
  const deadline = view.primary.overdue
    ? 'Deadline has passed'
    : `${view.primary.label} to the warrant`;
  const rail = view.rail.map((stage) => `<li class="${esc(stage.state)}"><span class="meta">${esc(stage.state === 'now' ? 'Now' : stage.state === 'earlier' ? 'Earlier' : 'Later')}</span><br>${esc(stage.title)}${stage.state === 'now' ? `<br><span class="meta">${esc(spine.stageLabel)}</span>` : ''}</li>`).join('');
  const facts = [
    ['Case', header.ref],
    ['Borrower', `${header.borrower}. LOR names him as ${header.borrowerAsOnLor}.`],
    ['Security', `${header.security}. ${header.property}.`],
    ['Title', `${header.tenure}, ${header.titleNumber}. ${header.proprietorSince}. ${header.pricePaid}.`],
    ['Stated value', header.statedValue],
    ['Loan requested', `${header.loanRequested}. ${header.ltv}.`],
    ['Sizing', header.sizingQuestion],
    ['Lender contact', `${header.lender}. ${header.lenderStatus}`],
    ['Borrower solicitor', `${header.solicitor}. ${header.solicitorStatus}`],
    ['Purpose', header.purpose],
    ['Exit', header.exit],
    ['Not this case', header.notThisCase],
  ].map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join('');
  const owners = `<p><strong>${esc(spine.primaryOwner.name)}</strong> — ${esc(spine.primaryOwner.role)}</p><ul class="plain">${spine.deskRoles.map((role) => `<li><strong>${esc(role.name)}</strong> — ${esc(role.role)}</li>`).join('')}</ul>`;
  const actions = spine.actions.map((item) => {
    const history = (auditByAction[item.id] || []).slice().reverse().map((row) => `<li>${esc(row.actor)} · ${esc(row.at)} · ${esc(row.field)}: ${esc(row.oldValue)} → ${esc(row.newValue)}</li>`).join('');
    return `<li id="action-${esc(item.id)}"><strong>${esc(item.title)}</strong><br><span class="meta">${esc(item.owner)} · due ${esc(item.due)} · ${item.done ? 'Marked done on the desk' : 'Open'}</span><p>${esc(item.detail)}</p>
      <form method="post" action="/staff/cockpit/spine/${encodeURIComponent(spine.ref)}">
        <input type="hidden" name="spine" value="${esc(spine.ref)}">
        <input type="hidden" name="id" value="${esc(item.id)}">
        <input type="hidden" name="waiting" value="${view.engine === 'preview' ? 'preview' : ''}">
        <label for="actor-${esc(item.id)}">Recorded by</label>
        <select id="actor-${esc(item.id)}" name="actor">${OWNERS.map((name) => `<option${name === item.owner ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select>
        <div class="actions">
          <button class="send" type="submit" name="action" value="${item.done ? 'spine-reopen' : 'spine-done'}">${item.done ? 'Reopen' : 'Mark done on the desk'}</button>
        </div>
      </form>
      ${history ? `<ul class="plain">${history}</ul>` : ''}
    </li>`;
  }).join('');
  const evidence = spine.evidence.map((item) => `<article class="card"><span class="pill ${esc(item.status)}">${esc(item.status)}</span><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></article>`).join('');
  const waiting = view.waiting.map((item) => `<li><span class="pill ${item.met ? 'met' : 'unmet'}">${item.met ? 'Satisfied in this preview' : 'Unmet'}</span> ${esc(item.text)}</li>`).join('');
  const readiness = view.readiness
    ? `<p><strong>Stage readiness:</strong> ${view.readiness.ready ? 'The recorded conditions are all satisfied.' : 'Not ready to leave this stage.'} The stage stays on ${esc(view.readiness.stageTitle)}. Satisfied: ${view.readiness.met.length}. Unmet: ${view.readiness.unmet.length}. No automatic move.</p>`
    : '<p class="meta">Readiness is not being evaluated while the flag is off.</p>';
  const dues = `<p><strong>${esc(spine.due.primary.display)}</strong> — ${esc(spine.due.primary.label)}. ${esc(spine.due.primary.detail)}</p><ul class="plain">${view.sub.map((item) => `<li><strong>${esc(item.display)}</strong> — ${esc(item.label)}. ${esc(item.relative)}. ${esc(item.detail)}</li>`).join('')}</ul>`;
  const checklist = view.model.evidenceChecklist.map((item) => `<li>${esc(item)}</li>`).join('');
  const exits = view.model.stages.map((stage) => `<li><strong>${esc(stage.title)}</strong>: ${stage.exit.map(esc).join(' ')}</li>`).join('');
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff · Stage-2 pilot</span></div><h1>${esc(header.borrower)}</h1><p class="sub">${esc(header.ref)} · ${esc(header.security)}</p></div></header>
  <main class="wrap">
    <p class="banner">Verified pilot facts from LOR v5 (20 Nov 2026) and the title canon. Preview only. Not the live release. This page does not send the Ackroyds pack, the LOR, the RBS authority, or a borrower link.</p>
    ${engineBanner(view)}
    <div class="deadline"><span class="kicker">Hard deadline</span><strong>${esc(deadline)}</strong><span>${esc(spine.due.primary.display)} · eviction warrant</span></div>
    <div class="bar"><a href="/staff/cockpit">Board</a><a href="/staff/cases">Cases</a>${toggleLink(view)}<form method="post" action="/staff/cockpit"><input type="hidden" name="action" value="logout"><button type="submit">Log out</button></form></div>
    <div class="grid">
      <section class="card span-2"><p class="kicker">Stage</p><h2>${esc(spine.stageLabel)}</h2><p class="meta">Model stage on the rail: ${esc(view.rail.find((stage) => stage.state === 'now').title)}. Position is recorded. The engine does not advance it.</p><ol class="rail">${rail}</ol></section>
      <section class="card"><p class="kicker">Case</p><h2>Canonical header</h2><dl>${facts}</dl></section>
      <section class="card"><p class="kicker">Owner</p><h2>Who decides</h2>${owners}<p class="kicker">Due time</p>${dues}</section>
      <section class="card span-2"><p class="kicker">Model</p><h2>${esc(view.model.title)}</h2><p class="meta">Model id <code>${esc(view.model.id)}</code>. The case is an instance. Another Posfin case type is a new model config, not a new page.</p><p class="kicker">SLA</p><p>${esc(view.model.sla.primary)} ${esc(view.model.sla.court)} ${esc(view.model.sla.redemption)}</p><p class="kicker">Evidence checklist</p><ul class="plain">${checklist}</ul><p class="kicker">Stage exit criteria</p><ol>${exits}</ol></section>
      <section class="card span-2"><p class="kicker">Next actions</p><h2>Ordered desk work</h2><ol class="actions-list">${actions}</ol><form method="post" action="/staff/cockpit/spine/${encodeURIComponent(spine.ref)}"><input type="hidden" name="action" value="spine-revert"><input type="hidden" name="spine" value="${esc(spine.ref)}"><label for="actor-revert">Recorded by</label><select id="actor-revert" name="actor">${OWNERS.map((name) => `<option${name === 'Byron' ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select><div class="actions"><button class="linkish" type="submit">Back to shared source</button></div></form></section>
      <section class="card span-2"><p class="kicker">Evidence</p><h2>Ledger</h2><div class="grid">${evidence}</div></section>
      <section class="card span-2"><p class="kicker">Waiting condition</p><h2>What this case is waiting on</h2>${readiness}<ul class="plain">${waiting}</ul></section>
      <section class="card span-2"><details><summary>Clone blueprint</summary><p>This pilot is one instance of <code>${esc(view.model.id)}</code>. The next case type adds a model config and a case record. It does not need a new screen. See docs/STAGE2_CASE_SPINE_CLONE_BLUEPRINT.md. Do not copy ${esc(PILOT_REF)} onto another borrower. Do not use PC-004 for the pilot borrower.</p></details></section>
    </div>
  </main>`;
  return page(`${header.ref} — Stage-2 spine`, body);
}

export function renderSpineLogin(error, next) {
  const message = error ? 'That staff password was not recognised.' : '';
  const hidden = next ? `<input type="hidden" name="next" value="${esc(next)}">` : '';
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff</span></div><h1>Stage-2 case spine</h1><p class="sub">Same sign-in as the cockpit.</p></div></header><main class="wrap"><article class="card"><form method="post" action="/staff/cockpit"><label for="email">Work email</label><input id="email" name="email" type="email" autocomplete="username"><label for="password">Staff password</label><input id="password" name="password" type="password" autocomplete="current-password" required minlength="8">${hidden}<p>${esc(message)}</p><button class="send" type="submit">Open the spine</button></form><p><a href="/staff/set-password">Forgot password?</a></p></article></main>`;
  return page('Stage-2 spine — Posfin', body);
}
