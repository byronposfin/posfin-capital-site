import { esc, money, ltv, ukDate, ukStamp, STAGE_LABEL, staffItems, portalUnlocked, POA_TYPES } from './case-portal.js';

const CSS = `
:root{--navy:#1C184F;--ink:#13113A;--gold:#D4A853;--paper:#F6F4EF;--line:#E4DFD4;--teal:#0E7C78;--urgent:#9F1239;--urgent-bg:#FDECEC;--ok:#E7F6F3;--placeholder:#FFF6DF}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper);font-size:16px;line-height:1.5}
img{max-width:100%;height:auto}
button,input,select,textarea{font:inherit}
a{color:var(--teal)}
.wrap{max-width:720px;margin:0 auto;padding:0 16px 48px}
header.top{background:linear-gradient(180deg,#1C184F 0%,#13113A 100%);color:#fff;padding:18px 16px 22px}
.top-inner{max-width:720px;margin:0 auto}
.brand{display:flex;align-items:center;justify-content:space-between;gap:12px}
.brand img{height:34px;width:auto}
.private{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72)}
header.top h1{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:32px;line-height:1.1;margin:18px 0 6px}
.addr{margin:0;color:rgba(255,255,255,.82)}
.banner{margin-top:18px;border-radius:16px;padding:16px;background:#fff;color:var(--ink)}
.banner.terms{background:#fff}
.eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal);font-weight:700;margin:0 0 4px}
.banner h2{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:26px;line-height:1.15;margin:0 0 8px}
.banner p{margin:0}
.steps{display:flex;gap:6px;list-style:none;padding:0;margin:14px 0 0}
.steps li{flex:1;text-align:center;font-size:12px;padding:8px 4px;border-radius:999px;background:#F3F0E8;color:#6B6578}
.steps li.on{background:var(--navy);color:#fff;font-weight:700}
.steps li.done{background:#E7F6F3;color:var(--teal);font-weight:700}
.progress{margin:18px 0}
.progress p{margin:0 0 8px}
.bar{height:10px;background:#E7E2D8;border-radius:999px;overflow:hidden}
.bar span{display:block;height:100%;background:var(--teal)}
section{margin:22px 0}
h2.sec{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:26px;margin:0 0 12px}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;margin:0 0 12px}
.card h3{margin:6px 0;font-size:18px}
.card .q{margin:0 0 12px}
.urgent{display:inline-block;background:var(--urgent-bg);color:var(--urgent);font-size:11px;font-weight:700;letter-spacing:.12em;padding:4px 8px;border-radius:999px}
.done-flag{display:inline-block;background:var(--ok);color:var(--teal);font-size:11px;font-weight:700;letter-spacing:.12em;padding:4px 8px;border-radius:999px}
label{display:block;font-weight:700;margin:10px 0 6px}
textarea,select,input[type=text],input[type=password]{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff;min-height:48px}
textarea{min-height:96px;resize:vertical}
.row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.filebtn,button.send,button.secondary{min-height:48px;border-radius:12px;padding:12px 14px;border:1px solid var(--line);background:#fff;cursor:pointer}
button.send{background:var(--navy);color:#fff;border-color:var(--navy);font-weight:700;width:100%;margin-top:12px}
.mic{width:100%;display:flex;align-items:center;gap:12px;margin:12px 0;padding:12px;border-radius:16px;border:0;background:var(--navy);color:#fff;cursor:pointer;text-align:left}
.mic .orb{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;background:#fff;color:var(--navy);flex:0 0 auto}
.mic strong{display:block;font-size:17px}
.mic.rec{background:#9F1239}
.mic.rec .orb{color:#9F1239}
.hint{color:#5C5670;font-size:14px;margin:8px 0 0}
.err{color:var(--urgent);font-weight:700;min-height:1.2em}
.received{background:var(--ok);border-radius:12px;padding:10px 12px;margin:8px 0}
.received p{margin:0 0 4px}
.slot{margin:0 0 10px;padding:10px 12px;border-radius:12px;background:#fff}
.slot .k{display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6B6578}
.slot.open{background:var(--placeholder);outline:1px dashed #E2C98A}
.slot .ph{font-weight:700}
.comps{list-style:none;padding:0;margin:0}
.comps li{display:grid;grid-template-columns:1fr auto;gap:4px 12px;padding:10px 0;border-top:1px solid var(--line)}
.comps small{grid-column:1 / -1;color:#6B6578}
.timeline{list-style:none;padding:0;margin:0}
.timeline li{padding:8px 0;border-top:1px solid var(--line)}
.footer{margin-top:28px;padding-top:16px;border-top:1px solid var(--line);color:#5C5670;font-size:14px}
.footer strong{color:var(--navy)}
.just-in{font-weight:700;color:var(--teal)}
.staff-bar{display:flex;justify-content:space-between;gap:8px;align-items:center}
.pack{max-width:840px;margin:24px auto;padding:24px;background:#fff;color:#15131F}
.pack h1{font-family:"Playfair Display",Georgia,serif;color:#1C184F}
.pack table{width:100%;border-collapse:collapse;margin:12px 0}
.pack th,.pack td{border:1px solid #E4DFD4;padding:8px;vertical-align:top;text-align:left}
.pack th{background:#F6F4EF}
@media (min-width:720px){
  header.top h1{font-size:40px}
  .comps li{grid-template-columns:1.4fr .8fr auto}
  .comps small{grid-column:auto}
}
`;

function shell(title, body, token) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Playfair+Display:wght@500&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}${token ? script() : ''}</body></html>`;
}

function micIcon() {
  return '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2z"/></svg>';
}

function receivedBlock(rows, token, caseId, staff) {
  if (!rows.length) return '';
  return `<div class="received">${rows.map((row) => {
    const when = ukStamp(row.createdAt);
    const href = row.filename
      ? (staff ? `/staff/cases/${encodeURIComponent(caseId)}/file/${encodeURIComponent(row.id)}` : `/case/${encodeURIComponent(token)}/file/${encodeURIComponent(row.id)}`)
      : '';
    const file = href ? `<a href="${href}">${esc(row.filename)}</a>` : '';
    const words = [row.choice, row.text].filter(Boolean).join(' — ');
    return `<p>${esc(when)}${words ? ' — ' + esc(words) : ''}${file ? ' — ' + file : ''}</p>`;
  }).join('')}</div>`;
}

function answerForm(gap, token) {
  const options = gap.options ? `<label for="${gap.id}-choice">Choose one if it fits</label><select id="${gap.id}-choice" name="choice"><option value="">Select if this fits</option>${gap.options.map((option) => `<option>${esc(option)}</option>`).join('')}</select>` : '';
  return `<form class="gap" method="post" action="/case/${encodeURIComponent(token)}/submit" enctype="multipart/form-data">
    <input type="hidden" name="gap_id" value="${esc(gap.id)}">
    <input type="hidden" name="kind" value="text">
    <input type="hidden" name="client_ref" value="">
    <button type="button" class="mic" data-mic><span class="orb">${micIcon()}</span><span><strong>Just tell us in a voice note</strong><span class="mic-state">Tap the microphone and talk. We will send it with this question.</span></span></button>
    ${options}
    <label for="${gap.id}-text">Or type it</label>
    <textarea id="${gap.id}-text" name="text" maxlength="4000" placeholder="Type the answer here"></textarea>
    <div class="row">
      <label class="filebtn">Attach a file<input name="file" type="file" accept="image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.heic,.webp" hidden data-file></label>
      <label class="filebtn">Take a photo<input name="photo" type="file" accept="image/*" capture="environment" hidden data-photo></label>
    </div>
    <p class="hint">Photos and files up to 4MB. For a long document, photograph the pages.</p>
    <p class="err" role="alert"></p>
    <button class="send" type="submit">Send this answer</button>
  </form>`;
}

function card(gap, token, highlightId) {
  const flag = gap.open && gap.urgent ? '<span class="urgent">URGENT</span>' : (!gap.open ? '<span class="done-flag">Received</span>' : '');
  const just = gap.rows.some((row) => row.id === highlightId) ? '<p class="just-in" id="just-in">Received just now</p>' : '';
  return `<article class="card" id="gap-${esc(gap.id)}">${flag}<h3>${esc(gap.title)}</h3><p class="q">${esc(gap.question)}</p>${just}${receivedBlock(gap.rows, token, '', false)}${answerForm(gap, token)}</article>`;
}

function generalForm(token) {
  return `<article class="card" id="general"><h3>Anything else</h3><p class="q">Anything else we should know? Type it, say it in a voice note, or attach a photo.</p>
    <form class="gap" method="post" action="/case/${encodeURIComponent(token)}/submit" enctype="multipart/form-data">
      <input type="hidden" name="gap_id" value=""><input type="hidden" name="kind" value="text"><input type="hidden" name="client_ref" value="">
      <button type="button" class="mic" data-mic><span class="orb">${micIcon()}</span><span><strong>Just tell us in a voice note</strong><span class="mic-state">Tap the microphone and talk.</span></span></button>
      <label for="general-text">Or type it</label>
      <textarea id="general-text" name="text" maxlength="4000" placeholder="Tell us here"></textarea>
      <div class="row"><label class="filebtn">Attach a file<input name="file" type="file" accept="image/*,application/pdf,.pdf" hidden data-file></label><label class="filebtn">Take a photo<input name="photo" type="file" accept="image/*" capture="environment" hidden data-photo></label></div>
      <p class="err" role="alert"></p>
      <button class="send" type="submit">Send this answer</button>
    </form></article>`;
}

function slot(label, value, open) {
  return `<div class="slot${open ? ' open' : ''}"><span class="k">${esc(label)}</span>${open || !value ? `<span class="ph">Still needed</span>` : `<span>${esc(value)}</span>`}</div>`;
}

function summary(model) {
  const facts = model.facts;
  const byId = Object.fromEntries(model.gaps.map((gap) => [gap.id, gap]));
  const loan = Number(facts.loan_amount);
  const clientLtv = ltv(loan, facts.client_value);
  const compLtv = ltv(loan, facts.comparables_floor);
  const address = [facts.property_address, facts.postcode].filter(Boolean).join(', ');
  const comps = Array.isArray(facts.comparables) ? facts.comparables : [];
  const compList = comps.length ? `<ul class="comps">${comps.map((row) => `<li><span>${esc(row.address)}</span><small>${esc(row.sold)}</small><b>${row.indexed ? esc(money(row.indexed)) : ''}</b></li>`).join('')}</ul>` : '';
  const timeline = [];
  if (facts.facility_ended) timeline.push(`The existing facility ended ${facts.facility_ended}.`);
  if (facts.claim_ref) timeline.push(`Court claim ${facts.claim_ref}, to be checked against the papers.`);
  if (facts.warrant_ref) timeline.push(`Warrant ${facts.warrant_ref}${facts.warrant_date ? ', dated ' + ukDate(facts.warrant_date) : ''}.`);
  if (facts.eviction_at) timeline.push(`Eviction appointment ${ukDate(facts.eviction_at)} UK time.`);
  return `<section><h2 class="sec">Your case</h2><div class="card">
    ${slot('Property', address, !address)}
    ${facts.property_type ? slot('Property type', facts.property_type, false) : ''}
    ${facts.epc_rating ? slot('Energy certificate', facts.epc_rating, false) : ''}
    ${slot('Your value', facts.client_value ? money(facts.client_value) : '', !facts.client_value)}
    ${slot('Desktop range', facts.desktop_low && facts.desktop_high ? `${money(facts.desktop_low)} to ${money(facts.desktop_high)}` : '', !(facts.desktop_low && facts.desktop_high))}
    ${slot('Nearby sales', facts.comparables_floor ? `Around ${money(facts.comparables_floor)}` : '', !facts.comparables_floor)}
    ${slot('Amount needed', loan ? `About ${money(loan)}, to clear the existing first charge` : '', !loan)}
    ${slot('Loan to value', clientLtv ? `${clientLtv.toFixed(1)}% at your figure${compLtv ? `, and ${compLtv.toFixed(1)}% at the nearby sales` : ''}. Working figures while we ask for terms, not an offer.` : '', !clientLtv)}
    ${facts.sole_name ? slot('Ownership', 'In your sole name, as you told us.', false) : slot('Ownership', '', true)}
    ${slot('Redemption figure and expiry', byId.redemption.latest, byId.redemption.open)}
    ${slot('Solicitor', byId.solicitor.latest, byId.solicitor.open)}
    ${slot('Who lives there', byId.occupancy.latest, byId.occupancy.open)}
    ${slot('Property description', byId.property.latest, byId.property.open)}
    ${slot('Exit', byId.exit.latest, byId.exit.open)}
    ${slot('Income', byId.income.latest, byId.income.open)}
    ${slot('Other debts', byId.debts.latest, byId.debts.open)}
    ${slot('Buildings insurance', byId.insurance.latest, byId.insurance.open)}
    ${slot('Possession order, warrant and N54', byId.court_papers.latest, byId.court_papers.open)}
    ${slot('Identity', byId.kyc_id.latest, byId.kyc_id.open)}
    ${slot('Proof of address', byId.kyc_poa.latest, byId.kyc_poa.open)}
    ${slot('Credit report', byId.kyc_credit.latest, byId.kyc_credit.open)}
    <h3>Timeline</h3><ul class="timeline">${timeline.map((line) => `<li>${esc(line)}</li>`).join('') || '<li>Timeline still being confirmed.</li>'}</ul>
    ${compList ? `<h3>Nearby sales</h3>${compList}` : ''}
    <p class="hint">Posfin Capital is a credit broker. These figures are for your case page. They are not an offer of finance.</p>
  </div></section>`;
}

function steps(model) {
  const order = ['gathering', 'terms', 'applied'];
  const index = order.indexOf(model.stage);
  return `<ol class="steps">${order.map((key, i) => `<li class="${i === index ? 'on' : i < index ? 'done' : ''}">${esc(STAGE_LABEL[key])}</li>`).join('')}</ol>`;
}

function banner(model) {
  if (model.facts.ask_client === false) {
    const who = model.facts.lender_name ? `${model.facts.lender_name} has issued terms. ` : 'Terms have been issued. ';
    const title = model.facts.offer_issued ? 'Offer issued' : STAGE_LABEL[model.stage];
    return `<div class="banner applied"><p class="eyebrow">Status</p><h2>${esc(title)}</h2><p>${esc(who)}The figures are set out below. Posfin Capital is the broker, not the lender. This page does not ask you for anything.</p>${steps(model)}</div>`;
  }
  const copy = {
    gathering: ['Gathering info', 'We still need the property figure, the amount you need and the equity before we ask for terms.'],
    terms: ["We're getting terms now", 'We have the basic numbers and the equity. Anything still open is marked urgent. This is not an offer of finance.'],
    applied: ['Applied', 'Your case has been sent on for a decision. We will update you here. This is not an offer of finance.'],
  }[model.stage];
  const pct = model.total ? Math.round((model.doneCount / model.total) * 100) : 0;
  return `<div class="banner ${esc(model.stage)}"><p class="eyebrow">Status</p><h2>${esc(copy[0])}</h2><p>${esc(copy[1])}</p>${steps(model)}</div>
    <div class="progress"><p><strong>${model.openCount}</strong> still to answer</p><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${model.total}" aria-valuenow="${model.doneCount}" aria-label="Answers received"><span style="width:${pct}%"></span></div></div>`;
}

function lineCards(rows) {
  return (rows || []).map((row) => `<div class="slot"><span class="k">${esc(row.label)}</span><span>${esc(row.value)}</span></div>`).join('');
}

function documentLinks(rows, token, caseId, staff) {
  return rows.filter((row) => row.filename).map((row) => {
    const href = staff
      ? `/staff/cases/${encodeURIComponent(caseId)}/file/${encodeURIComponent(row.id)}`
      : `/case/${encodeURIComponent(token)}/file/${encodeURIComponent(row.id)}`;
    const label = row.text || row.filename;
    return `<li><a href="${href}">${esc(label)}</a></li>`;
  }).join('');
}

function termsView(model, token, staff) {
  const docs = documentLinks(model.general, token, model.caseId, staff);
  return `<section><h2 class="sec">Terms</h2><div class="card">${lineCards(model.facts.terms) || '<p>Terms will show here.</p>'}</div></section>
    <section><h2 class="sec">Use of funds</h2><div class="card">${lineCards(model.facts.use_of_funds) || '<p>The use of funds will show here.</p>'}</div></section>
    <section><h2 class="sec">Documents</h2><div class="card">${docs ? `<ul>${docs}</ul>` : '<p>No documents yet.</p>'}</div></section>`;
}

function pageHead(model) {
  const address = [model.facts.property_address, model.facts.postcode].filter(Boolean).join(', ');
  return `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Private link</span></div><h1>${esc(model.clientName)}</h1><p class="addr">${esc(address || 'Your case')}</p>${model.facts.reference ? `<p class="addr">Reference ${esc(model.facts.reference)}</p>` : ''}${banner(model)}</div></header>`;
}

function footer(model) {
  const line = model.facts.ask_client === false
    ? 'Posfin Capital is an FCA-authorised credit broker, FRN 913022. We are not a lender. The terms on this page are the offer already issued.'
    : 'Posfin Capital is an FCA-authorised credit broker, FRN 913022. We are not a lender. We are working to get terms. Nothing on this page is an offer of finance.';
  return `<footer class="footer"><p><strong>Posfin Capital</strong></p><p>${line}</p><p>96 Kensington High Street, London W8 4SG<br>+44 7446 950 389</p><p>Save this private link. It is the only way back to this page.</p></footer>`;
}

export function renderPortal(model, token) {
  if (model.facts.ask_client === false) {
    return `${pageHead(model)}<main class="wrap" id="portal">${termsView(model, token, false)}${footer(model)}</main>`;
  }
  const outstanding = model.gaps.filter((gap) => gap.open && !gap.kyc);
  const kyc = model.gaps.filter((gap) => gap.kyc && gap.open);
  const done = model.gaps.filter((gap) => !gap.open);
  return `${pageHead(model)}
  <main class="wrap" id="portal">
    <section><h2 class="sec">Still to answer</h2>${outstanding.length ? outstanding.map((gap) => card(gap, token, model.highlightId)).join('') : '<article class="card"><p>Those questions are in. Thank you.</p></article>'}</section>
    <section><h2 class="sec">Identity and credit file</h2><article class="card"><p>We need photo ID, proof of address from the last 3 months, and a credit report from Experian or Check My File from the last 3 months.</p></article>${kyc.map((gap) => card(gap, token, model.highlightId)).join('')}</section>
    <section><h2 class="sec">Anything else</h2>${generalForm(token)}${model.general.some((row) => row.id === model.highlightId) ? '<p class="just-in" id="just-in">Received just now</p>' : ''}${model.general.length ? receivedBlock(model.general, token, '', false) : ''}</section>
    ${summary(model)}
    <section><h2 class="sec">Received</h2>${done.length ? done.map((gap) => card(gap, token, model.highlightId)).join('') : '<article class="card"><p>Answers will show here as soon as they arrive, with the time we received them.</p></article>'}</section>
    ${footer(model)}
  </main>`;
}

function poaFields(id, label) {
  const options = POA_TYPES.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join('');
  return `<div class="card" data-poa="${esc(id)}">
    <h3>${esc(label)}</h3>
    <label for="${esc(id)}-type">What is it?</label>
    <select id="${esc(id)}-type" data-type><option value="">Select one</option>${options}</select>
    <label for="${esc(id)}-date">Date on the document</label>
    <input id="${esc(id)}-date" data-date type="date">
    <p class="hint">It must be dated within the last 90 days.</p>
    <div class="row">
      <label class="filebtn">Take a photo<input data-photo type="file" accept="image/*" capture="environment" hidden></label>
      <label class="filebtn">Attach a file<input data-file type="file" accept="image/*,application/pdf,.pdf" hidden></label>
    </div>
  </div>`;
}

function kycHead() {
  return `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Private link</span></div><h1>Identity check</h1><p class="addr">Posfin Capital</p></div></header>`;
}

function renderKyc(model, token) {
  const name = model.kyc.fullName || (model.clientName !== 'Your case' ? model.clientName : '');
  const knownAddress = [model.facts.property_address, model.facts.postcode].filter(Boolean).join(', ');
  const address = model.kyc.address || knownAddress;
  if (model.kyc.status === 'submitted') {
    return `${kycHead()}<main class="wrap" id="portal"><article class="card"><h2>We've got your identity check</h2><p>Thank you. Your Posfin portal opens once we have confirmed it. We can then send your details to lenders and ask for terms.</p><p>Nothing else is needed from you on this page just now.</p></article><footer class="footer"><p><strong>Posfin Capital</strong></p></footer></main>`;
  }
  const again = model.kyc.status === 'failed' ? '<article class="card"><p>We could not confirm the identity check from what we received. Please send it again, with proofs of address dated within the last 90 days.</p></article>' : '';
  return `${kycHead()}<main class="wrap" id="portal">${again}
    <article class="card">
      <h2>Open your Posfin portal</h2>
      <p>This short identity check is what opens your portal. Once it is confirmed, we can send your details to lenders and ask for terms.</p>
      <p>A passport is best. If you do not have one, a UK driving licence is fine. Every proof of address needs a date within the last 90 days.</p>
      <button type="button" class="mic" data-mic><span class="orb"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2z"/></svg></span><span><strong>Just tell us in a voice note</strong><span class="mic-state">Tap the microphone, say your name and address, then still check the boxes below.</span></span></button>
      <form id="kyc-form" method="post" action="/case/${encodeURIComponent(token)}/kyc" enctype="multipart/form-data">
        <label for="kyc-name">Full name</label>
        <input id="kyc-name" name="full_name" type="text" required maxlength="160" value="${esc(name)}" autocomplete="name">
        <label for="kyc-address">Current address</label>
        <textarea id="kyc-address" name="address" required maxlength="300">${esc(address)}</textarea>
        <label for="has-passport">Do you have a passport?</label>
        <select id="has-passport" name="has_passport" required><option value="">Select one</option><option value="yes">Yes, I have a passport</option><option value="no">No, I don't have a passport</option></select>
        <div id="passport-block" hidden>
          <h3>Passport</h3>
          <p>Photograph the photo page.</p>
          <div class="row"><label class="filebtn">Take a photo<input data-role="passport" type="file" accept="image/*" capture="environment" hidden></label><label class="filebtn">Attach a photo<input data-role="passport-file" type="file" accept="image/*" hidden></label></div>
        </div>
        <div id="licence-id-block" hidden>
          <h3>UK driving licence</h3>
          <p>You don't have a passport, so photograph the front of your driving licence. This is your photo ID.</p>
          <div class="row"><label class="filebtn">Take a photo<input data-role="licence-id" type="file" accept="image/*" capture="environment" hidden></label><label class="filebtn">Attach a photo<input data-role="licence-id-file" type="file" accept="image/*" hidden></label></div>
        </div>
        <div id="poa-with-passport" hidden>
          <h3>Proof of address</h3>
          <p>With a passport we need your driving licence, plus one other document. Both must be dated within the last 90 days.</p>
          <div class="card" data-poa="licence">
            <h3>Driving licence</h3>
            <label for="licence-date">Date on the licence</label>
            <input id="licence-date" data-date type="date">
            <p class="hint">Use the date printed on it. It must be within the last 90 days.</p>
            <div class="row"><label class="filebtn">Take a photo<input data-role="licence-poa" type="file" accept="image/*" capture="environment" hidden></label><label class="filebtn">Attach a photo<input data-role="licence-poa-file" type="file" accept="image/*" hidden></label></div>
          </div>
          ${poaFields('poa-a', 'One other proof of address')}
        </div>
        <div id="poa-without" hidden>
          <h3>Two proofs of address</h3>
          <p>Your driving licence is the photo ID. Please also send two proofs of address, each dated within the last 90 days.</p>
          ${poaFields('poa-b', 'First proof of address')}
          ${poaFields('poa-c', 'Second proof of address')}
        </div>
        <p class="err" id="kyc-err" role="alert"></p>
        <button class="send" type="submit">Send my identity check</button>
      </form>
    </article>
    <footer class="footer"><p><strong>Posfin Capital</strong></p><p>Posfin Capital is an FCA-authorised credit broker, FRN 913022. We are not a lender.</p></footer>
  </main>${kycScript()}`;
}

function kycScript() {
  return `<script>
(function () {
  var pass = document.getElementById('has-passport');
  if (!pass) return;
  function show() {
    var yes = pass.value === 'yes';
    var no = pass.value === 'no';
    arm('passport-block', !yes);
    arm('licence-id-block', !no);
    arm('poa-with-passport', !yes);
    arm('poa-without', !no);
  }
  function arm(id, hide) {
    var root = document.getElementById(id);
    root.hidden = hide;
    root.querySelectorAll('input, select, textarea').forEach(function (el) { el.disabled = hide; });
  }
  pass.addEventListener('change', show);
  show();
  var mic = document.querySelector('[data-mic]');
  if (mic) mic.addEventListener('click', function () { startNote(mic); });
  document.getElementById('kyc-form').addEventListener('submit', function (event) {
    event.preventDefault();
    sendKyc(event.target);
  });
  function uid(){return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())).replace(/-/g,'').slice(0,32);}
  function fileOf(selector, root) {
    var input = (root || document).querySelector(selector);
    return input && input.files && input.files[0] ? input.files[0] : null;
  }
  function picked(role) {
    return fileOf('[data-role="' + role + '"]') || fileOf('[data-role="' + role + '-file"]');
  }
  async function startNote(button) {
    var err = document.getElementById('kyc-err');
    if (!navigator.mediaDevices || !window.MediaRecorder) { err.textContent = 'This browser cannot record. Please type your name and address.'; return; }
    if (button.classList.contains('rec') && button._rec) { button._rec.stop(); return; }
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      var mime = ['audio/webm','audio/mp4','audio/ogg'].find(function (t) { return MediaRecorder.isTypeSupported(t); }) || '';
      var rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      var chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        button.classList.remove('rec');
        button._voice = new File(chunks, 'voice-note.webm', { type: rec.mimeType || 'audio/webm' });
        var state = button.querySelector('.mic-state');
        if (state) state.textContent = 'Voice note ready. It will send with your identity check.';
      };
      button._rec = rec;
      button.classList.add('rec');
      rec.start();
      setTimeout(function () { if (rec.state === 'recording') rec.stop(); }, 90000);
    } catch (e) { err.textContent = 'We could not use the microphone. You can type instead.'; }
  }
  function poaFrom(id) {
    var card = document.querySelector('[data-poa="' + id + '"]');
    var photo = fileOf('[data-photo]', card);
    var file = fileOf('[data-file]', card);
    return { type: card.querySelector('[data-type]').value, date: card.querySelector('[data-date]').value, file: photo || file };
  }
  async function postPart(form, fields, file) {
    var data = new FormData();
    Object.keys(fields).forEach(function (key) { data.set(key, fields[key]); });
    if (file) data.set('file', file, file.name);
    data.set('client_ref', uid());
    var res = await fetch(form.action, { method: 'POST', body: data, headers: { 'Accept': 'application/json', 'X-Posfin-Fetch': '1' } });
    var payload = await res.json();
    if (!res.ok || !payload.ok) throw new Error(payload.message || 'That did not send.');
  }
  async function sendKyc(form) {
    var err = document.getElementById('kyc-err');
    var send = form.querySelector('.send');
    err.textContent = '';
    if (form._busy) return;
    var id = pass.value;
    if (id !== 'yes' && id !== 'no') { err.textContent = 'Tell us whether you have a passport.'; return; }
    var parts = [];
    if (id === 'yes') {
      var passport = picked('passport');
      var licence = picked('licence-poa');
      var other = poaFrom('poa-a');
      if (!passport || !licence || !other.file || !other.type || !document.getElementById('licence-date').value || !other.date) {
        err.textContent = 'Add your passport, your driving licence, and one other proof of address, each with its date.'; return;
      }
      parts.push({ fields: { part: 'passport' }, file: passport });
      parts.push({ fields: { part: 'licence', doc_type: 'driving_licence', doc_date: document.getElementById('licence-date').value }, file: licence });
      parts.push({ fields: { part: 'poa', doc_type: other.type, doc_date: other.date }, file: other.file });
    } else {
      var licenceId = picked('licence-id');
      var first = poaFrom('poa-b');
      var second = poaFrom('poa-c');
      if (!licenceId || !first.file || !second.file || !first.type || !second.type || !first.date || !second.date) {
        err.textContent = 'Add your driving licence and two proofs of address, each with its date.'; return;
      }
      parts.push({ fields: { part: 'licence', doc_type: 'photo_id' }, file: licenceId });
      parts.push({ fields: { part: 'poa', doc_type: first.type, doc_date: first.date }, file: first.file });
      parts.push({ fields: { part: 'poa', doc_type: second.type, doc_date: second.date }, file: second.file });
    }
    form._busy = true;
    if (send) send.textContent = 'Sending…';
    try {
      var voice = document.querySelector('[data-mic]');
      if (voice && voice._voice) await postPart(form, { part: 'note' }, voice._voice);
      for (var i = 0; i < parts.length; i++) await postPart(form, parts[i].fields, parts[i].file);
      var done = await fetch(form.action, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Posfin-Fetch': '1' }, body: JSON.stringify({ finish: true, full_name: form.full_name.value, address: form.address.value, id_type: id === 'yes' ? 'passport' : 'driving_licence' }) });
      var payload = await done.json();
      if (!done.ok || !payload.ok) throw new Error(payload.message || 'That did not send.');
      if (payload.html) document.getElementById('app').innerHTML = payload.html;
    } catch (e) {
      err.textContent = e.message || 'That did not send. Please try again.';
      form._busy = false;
      if (send) send.textContent = 'Send my identity check';
    }
  }
})();
</script>`;
}

export function renderDocument(model, token) {
  if (!portalUnlocked(model)) {
    return shell(`${model.clientName} — Posfin Capital`, `<div id="app">${renderKyc(model, token)}</div>`, '');
  }
  const interactive = model.facts.ask_client !== false;
  return shell(`${model.clientName} — Posfin Capital`, `<div id="app">${renderPortal(model, token)}</div>`, interactive ? token : '');
}

export function renderMessage(title, message) {
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Private link</span></div><h1>${esc(title)}</h1></div></header><main class="wrap"><article class="card"><p>${esc(message)}</p><p><strong>Posfin Capital</strong></p></article></main>`;
  return shell(`${title} — Posfin Capital`, body, '');
}

function script() {
  return `<script>
document.addEventListener('click', function (event) {
  var mic = event.target.closest('[data-mic]');
  if (!mic) return;
  event.preventDefault();
  var form = mic.closest('form');
  if (mic.classList.contains('rec') && form._rec) { form._rec.stop(); return; }
  startNote(form, mic);
});
document.addEventListener('submit', function (event) {
  var form = event.target.closest('form.gap');
  if (!form) return;
  event.preventDefault();
  sendForm(form);
});
function uid(){return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(16).slice(2)).replace(/-/g,'').slice(0,32);}
function setKind(form, kind){ form.querySelector('[name=kind]').value = kind; }
async function shrink(file){
  if (!file || !/^image\\/(jpeg|png|webp)$/.test(file.type) || file.size < 900000) return file;
  try {
    var bmp = await createImageBitmap(file);
    var scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.72); });
    if (!blob) return file;
    return new File([blob], (file.name || 'photo').replace(/\\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) { return file; }
}
async function startNote(form, mic){
  var err = form.querySelector('.err');
  if (!navigator.mediaDevices || !window.MediaRecorder) { err.textContent = 'This browser cannot record a voice note. Please type the answer instead.'; return; }
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    var types = ['audio/webm', 'audio/mp4', 'audio/ogg'];
    var mime = types.find(function (t) { return MediaRecorder.isTypeSupported(t); }) || '';
    var rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      stream.getTracks().forEach(function (t) { t.stop(); });
      mic.classList.remove('rec');
      var blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      form._voice = new File([blob], 'voice-note.webm', { type: blob.type || 'audio/webm' });
      setKind(form, 'voice');
      sendForm(form);
    };
    form._rec = rec;
    mic.classList.add('rec');
    var state = mic.querySelector('.mic-state');
    if (state) state.textContent = 'Recording. Tap again to stop and send.';
    rec.start();
    form._timer = setTimeout(function () { if (rec.state === 'recording') rec.stop(); }, 90000);
  } catch (e) {
    err.textContent = 'We could not use the microphone. You can type the answer, or attach a file.';
  }
}
async function sendForm(form){
  var err = form.querySelector('.err');
  var send = form.querySelector('.send');
  if (form._busy) return;
  err.textContent = '';
  var photo = form.querySelector('[data-photo]');
  var file = form.querySelector('[data-file]');
  var chosen = null;
  var kind = 'text';
  if (form._voice) { chosen = form._voice; kind = 'voice'; }
  else if (photo && photo.files && photo.files[0]) { chosen = await shrink(photo.files[0]); kind = 'photo'; }
  else if (file && file.files && file.files[0]) { chosen = await shrink(file.files[0]); kind = 'file'; }
  else if (form.querySelector('[name=choice]') && form.querySelector('[name=choice]').value) kind = 'choice';
  setKind(form, kind);
  if (chosen && chosen.size > 4194304) { err.textContent = 'That file is over 4MB. Please photograph the pages, or send a smaller file.'; return; }
  var data = new FormData(form);
  if (chosen) { data.delete('file'); data.delete('photo'); data.set('file', chosen, chosen.name); }
  if (!data.get('client_ref')) data.set('client_ref', uid());
  form._busy = true;
  if (send) send.textContent = 'Sending…';
  try {
    var res = await fetch(form.action, { method: 'POST', body: data, headers: { 'Accept': 'application/json', 'X-Posfin-Fetch': '1' } });
    var payload = await res.json();
    if (!res.ok || !payload.ok) { err.textContent = payload.message || 'That did not send. Please try again.'; form._busy = false; if (send) send.textContent = 'Send this answer'; return; }
    var app = document.getElementById('app');
    if (payload.html && app) app.innerHTML = payload.html;
    else location.reload();
    var here = document.getElementById('just-in');
    if (here) here.scrollIntoView({ block: 'center' });
  } catch (e) {
    err.textContent = 'That did not send. Please try again. It is received only when you see it listed.';
    form._busy = false;
    if (send) send.textContent = 'Send this answer';
  }
}
</script>`;
}

export function renderStaffLogin(error) {
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff</span></div><h1>Case folder</h1></div></header><main class="wrap"><article class="card"><form method="post" action="/staff/cases"><label for="password">Staff password</label><input id="password" name="password" type="password" autocomplete="current-password" required minlength="20"><p class="err">${error ? esc(error) : ''}</p><button class="send" type="submit">Open cases</button></form></article><footer class="footer"><p><strong>Posfin Capital</strong></p></footer></main>`;
  return shell('Staff — Posfin Capital', body, '');
}

export function renderStaffList(cases) {
  const cards = cases.length ? cases.map((item) => `<article class="card"><h3>${esc(item.clientName)}</h3><p>${esc(item.address || '')}</p><p>${esc(item.stageLabel)} · ${item.openCount} ${esc(item.openLabel || 'still to answer')}</p><p>Identity check: ${esc(item.kycStatus || 'not_started')}</p><p><a href="/staff/cases/${encodeURIComponent(item.caseId)}">Open case</a></p></article>`).join('') : '<article class="card"><p>No cases yet.</p></article>';
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff</span></div><h1>Cases</h1></div></header><main class="wrap"><div class="staff-bar"><p>Internal view. Not for clients.</p><form method="post" action="/staff/cases"><input type="hidden" name="action" value="logout"><button class="secondary" type="submit">Log out</button></form></div>${cards}</main>`;
  return shell('Cases — Posfin Capital', body, '');
}

export function renderStaffCase(model, broker) {
  const lender = broker && broker.existing_charge_lender ? String(broker.existing_charge_lender) : '';
  const files = model.gaps.flatMap((gap) => gap.rows).concat(model.general).filter((row) => row.filename);
  const fileList = files.map((row) => `<li>${esc(ukStamp(row.createdAt))} — ${esc(row.kind)} — <a href="/staff/cases/${encodeURIComponent(model.caseId)}/file/${encodeURIComponent(row.id)}">${esc(row.text || row.filename)}</a></li>`).join('');
  const items = staffItems(broker);
  const parties = broker && Array.isArray(broker.parties) ? broker.parties : [];
  const partyCard = parties.length ? `<article class="card"><h3>Parties</h3><ul>${parties.map((party) => `<li><strong>${esc(party.role || '')}</strong> — ${esc(party.name || '')}</li>`).join('')}</ul></article>` : '';
  const internal = items.length ? `<article class="card"><h3>Internal items</h3><p class="hint">Staff only. Not shown to the client.</p><ul>${items.map((item) => `<li><strong>${esc(item.title)}</strong>${item.detail ? ' — ' + esc(item.detail) : ''}</li>`).join('')}</ul></article>${partyCard}` : partyCard;
  const asking = model.facts.ask_client !== false;
  const answers = asking ? `<article class="card"><h3>Answers</h3><ul>${model.gaps.map((gap) => `<li><strong>${esc(gap.title)}</strong> — ${gap.open ? 'Still needed' : esc(gap.latest)} <span class="hint">${gap.rows.map((row) => ukStamp(row.createdAt)).join(', ')}</span></li>`).join('')}</ul></article>` : internal;
  const status = asking
    ? `${STAGE_LABEL[model.stage]}. ${model.openCount} still to answer.`
    : `${model.facts.offer_issued ? 'Offer issued' : STAGE_LABEL[model.stage]}. ${items.length} internal items. No questions are sent to the client.`;
  const kycLabel = { not_started: 'Not started', submitted: 'Submitted', passed: 'Passed', failed: 'Failed' }[model.kyc.status] || 'Not started';
  const kycDocs = model.kycDocs.map((row) => `<li>${esc(row.choice || row.gapId)} — ${esc(row.text || '')} — <a href="/staff/cases/${encodeURIComponent(model.caseId)}/file/${encodeURIComponent(row.id)}">${esc(row.filename || 'file')}</a></li>`).join('');
  const kycCard = `<article class="card"><h3>Identity check</h3><p>Status: <strong>${esc(kycLabel)}</strong>. ${model.kyc.status === 'passed' ? 'The client can see the portal.' : 'The client cannot see terms, documents or requirements until you mark this as passed.'}</p>${model.kyc.fullName ? `<p>${esc(model.kyc.fullName)}<br>${esc(model.kyc.address)}</p>` : ''}${model.kyc.idType ? `<p>Photo ID: ${esc(model.kyc.idType === 'passport' ? 'Passport' : 'UK driving licence')}</p>` : ''}${kycDocs ? `<ul>${kycDocs}</ul>` : ''}<form method="post" action="/staff/cases/${encodeURIComponent(model.caseId)}"><input type="hidden" name="action" value="kyc"><button class="send" name="status" value="passed" type="submit">Mark KYC passed</button><button class="secondary" name="status" value="failed" type="submit">Mark KYC failed</button></form></article>`;
  const body = `<header class="top"><div class="top-inner"><div class="brand"><img src="/logo.png" alt="Posfin Capital"><span class="private">Staff</span></div><h1>${esc(model.clientName)}</h1><p class="addr">${esc([model.facts.property_address, model.facts.postcode].filter(Boolean).join(', '))}</p></div></header>
  <main class="wrap">
    <div class="staff-bar"><a href="/staff/cases">All cases</a><a class="send" style="display:inline-block;width:auto;text-decoration:none;text-align:center" href="/staff/cases/${encodeURIComponent(model.caseId)}/export">Export loan pack</a></div>
    ${kycCard}
    <article class="card"><p>${esc(status)}</p>${lender ? `<p>Existing first charge holder, staff only: ${esc(lender)}</p>` : ''}<form method="post" action="/staff/cases/${encodeURIComponent(model.caseId)}"><input type="hidden" name="action" value="stage"><label for="stage">Stage</label><select id="stage" name="stage"><option value="gathering"${model.stage === 'gathering' ? ' selected' : ''}>Gathering info</option><option value="terms"${model.stage === 'terms' ? ' selected' : ''}>Getting terms</option><option value="applied"${model.stage === 'applied' ? ' selected' : ''}>Applied</option></select><button class="send" type="submit">Update stage</button></form></article>
    ${answers}
    <article class="card"><h3>Documents</h3>${fileList ? `<ul>${fileList}</ul>` : '<p>No files yet.</p>'}</article>
    ${asking ? summary(model) : termsView(model, '', true)}
  </main>`;
  return shell(`${model.clientName} — staff`, body, '');
}

export function renderExport(model, broker) {
  const lender = broker && broker.existing_charge_lender ? String(broker.existing_charge_lender) : 'Not confirmed';
  const docs = model.gaps.flatMap((gap) => gap.rows.map((row) => ({ ...row, title: gap.title }))).concat(model.general.map((row) => ({ ...row, title: 'General' })));
  const rows = docs.map((row) => `<tr><td>${esc(ukStamp(row.createdAt))}</td><td>${esc(row.title)}</td><td>${esc(row.kind)}</td><td>${esc([row.choice, row.text, row.filename].filter(Boolean).join(' — '))}</td></tr>`).join('');
  const items = staffItems(broker);
  const open = model.facts.ask_client === false
    ? items.map((item) => `<li>${esc(item.title)}${item.detail ? ' — ' + esc(item.detail) : ''}</li>`).join('')
    : model.gaps.filter((gap) => gap.open).map((gap) => `<li>${esc(gap.title)}</li>`).join('');
  const packBody = model.facts.ask_client === false ? termsView(model, '', true) : summary(model);
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Loan pack — Posfin Capital</title><style>${CSS}</style></head><body><article class="pack"><p>Posfin Capital · draft loan pack for lender review</p><h1>${esc(model.clientName)}</h1><p>${esc([model.facts.property_address, model.facts.postcode].filter(Boolean).join(', '))}</p><p>Existing first charge holder: ${esc(lender)}</p><p>Stage: ${esc(STAGE_LABEL[model.stage])}. ${model.facts.ask_client === false ? items.length + ' internal items' : model.openCount + ' items still open'}.</p>${packBody}<h2>Documents and answers received</h2><table><thead><tr><th>Received (UK)</th><th>Item</th><th>Type</th><th>Detail</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Nothing received yet.</td></tr>'}</tbody></table><h2>Still open</h2><ul>${open || '<li>None</li>'}</ul><p><strong>Posfin Capital</strong> is a credit broker, not a lender. This pack is not an offer of finance.</p></article></body></html>`;
}
