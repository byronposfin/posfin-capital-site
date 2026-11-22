import { esc } from './case-portal.js';
import { chargePhrase, pounds } from './flow-cases.js';
import { FROM_IDENTITIES, PROCESS_STEPS } from './flow-processing.js';

const CSS = `
:root{--navy:#0B1F3A;--teal:#138A9E;--lor:#0A7383;--tile:#E6F7F9;--tile2:#F2FBFC;--paper:#FEFDF8;--cream:#FBF7EE;--rule:#E3DCCB;--muted:#4F5F78;--ok:#1F7A4D;--error:#B42318;--gold:#FFF8E6;--gold-ink:#8A5A00;--banner:#FFF4D6;--banner-ink:#6B4E00}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"DM Sans",sans-serif;background:var(--paper);color:var(--navy);font-size:16px;line-height:1.45}
h1,h2,h3{font-family:Fraunces,Times,"Times New Roman",serif;font-weight:560;margin:0 0 8px}
a{color:var(--lor)}
button,input,select{font:inherit}
header.flow{background:#0B1F3A;color:#fff}
.flow-inner,.wrap{max-width:1080px;margin:0 auto}
header.flow .flow-inner{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:16px}
.wordmark{font-family:Fraunces,Times,serif;font-size:28px;margin:0;letter-spacing:-.02em}
.wordmark span{color:#138A9E}
.regline{margin:0;font-size:12px;text-align:right;color:rgba(255,255,255,.86)}
.sublabel{margin:0;padding:0 16px 12px;font-size:12px;letter-spacing:.04em;color:rgba(255,255,255,.78)}
.demo-banner{background:#FFF4D6;color:#6B4E00;padding:10px 16px;font-weight:700}
.wrap{padding:18px 16px 72px}
.bar,.actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}
.bar a,button.secondary,button.send{min-height:42px;border-radius:999px;padding:8px 14px;border:1px solid var(--rule);background:#fff;color:var(--navy);text-decoration:none;display:inline-flex;align-items:center;cursor:pointer}
button.send{background:var(--navy);color:#fff;border-color:var(--navy);font-weight:700}
.card,.sheet{background:#fff;border:1px solid var(--rule);border-radius:16px;padding:14px 16px;margin:0 0 14px}
.stack{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;padding:0;margin:0 0 16px;list-style:none}
.stack li{background:var(--cream);border:1px solid var(--rule);border-radius:12px;padding:10px}
.stack .count{font-family:"Space Grotesk",sans-serif;font-size:28px;display:block}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0 12px}
.tile{background:var(--tile);border-radius:12px;padding:10px}
.tile b{font-family:"Space Grotesk",sans-serif;display:block;font-size:20px}
.micro,.meta{color:var(--muted);font-size:13px}
.goldbar{background:#FFF8E6;color:#8A5A00;font-weight:700;padding:8px 10px;border-radius:8px}
.headline{font-size:26px;line-height:1.2}
.pills{display:flex;flex-wrap:wrap;gap:6px}
.pill{background:var(--tile2);color:var(--lor);border-radius:999px;padding:4px 10px;font-weight:700;font-size:13px}
.callout{border:2px solid var(--error);color:var(--error);border-radius:12px;padding:10px;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:6px;border-top:1px solid var(--rule);vertical-align:top}
.scroll{overflow-x:auto}
.watermark{position:fixed;left:50%;top:46%;transform:translate(-50%,-50%) rotate(45deg);font-size:90pt;line-height:1;color:rgba(180,180,180,.38);font-weight:700;pointer-events:none;z-index:4;letter-spacing:.04em}
.doc-foot,.footer-line{color:var(--muted);font-size:13px}
.error{color:var(--error);font-weight:700}
.tick{display:flex;gap:8px;align-items:flex-start;margin:6px 0}
.lor-mark{font-family:"Space Grotesk",sans-serif;font-size:42px;color:var(--lor);margin:0}
@media (max-width:700px){.regline{text-align:left}header.flow .flow-inner{flex-direction:column;align-items:flex-start}}
`;

function audienceQuery(audience) {
  return audience && audience !== 'internal' ? `?audience=${encodeURIComponent(audience)}` : '';
}

function hrefFor(path, audience) {
  return `${path}${audienceQuery(audience)}`;
}

export function flowShell(page, body, options = {}) {
  const watermark = options.watermark ? '<div class="watermark" aria-hidden="true">TEST</div>' : '';
  const audience = options.audience || 'internal';
  const viewLink = (id, label) => `<a href="?audience=${id}" data-audience="${id}"${audience === id ? ' aria-current="page"' : ''}>${label}</a>`;
  const switcher = `<nav class="bar" aria-label="Who is looking">${viewLink('investor', 'Investor')}${viewLink('introducer', 'Introducer')}${viewLink('internal', 'Posfin')}</nav>`;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>Posfin Flow · ${esc(page)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Fraunces:opsz,wght@9..144,560;9..144,640&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${watermark}<header class="flow"><div class="flow-inner"><p class="wordmark">Posfin <span>Flow</span></p><p class="regline">FCA FRN 913022 · NACFB member · Credit broker, not a lender</p></div><p class="sublabel">Demo · test data · nothing is sent</p></header><p class="demo-banner" role="status">Demo data. Nothing is sent to any lender or person.</p>${switcher}<main class="wrap">${body}</main></body></html>`;
}

function nav(current, audience = 'internal') {
  const link = (href, label) => `<a href="${hrefFor(href, audience)}"${current === label ? ' aria-current="page"' : ''}>${label}</a>`;
  const desk = audience === 'internal'
    ? `${link('/staff/flow/processing', 'Processing')}${link('/staff/flow/leadership', 'Leadership')}`
    : '';
  return `<div class="bar">${link('/staff/flow', 'Flow')}${link('/staff/flow/lenders', 'Placed lenders')}${desk}${link('/staff/cockpit', 'Board')}</div>`;
}

function rateSummary(rows) {
  const known = rows.filter((row) => row.tier === 'eligible' && row.rate_pcm != null);
  if (!known.length) return 'Lowest known rate: not known. Highest known rate: not known. Subject to status.';
  const low = known.reduce((best, row) => (row.rate_pcm < best.rate_pcm ? row : best));
  const high = known.reduce((best, row) => (row.rate_pcm > best.rate_pcm ? row : best));
  return `Lowest known rate among eligible: ${low.rate_pcm.toFixed(2)}% pcm. Highest known rate among eligible: ${high.rate_pcm.toFixed(2)}% pcm. Subject to status. website-stated, not lender-confirmed.`;
}

function viewLabel(audience) {
  if (audience === 'investor') return 'Investor view. Lender names are the real panel names. website-stated, not lender-confirmed.';
  if (audience === 'introducer') return 'Introducer view. Same case flow, with the real panel names. website-stated, not lender-confirmed.';
  return 'Posfin view. Processing for Jess and Cai, and the leadership line for Byron and Chris, sit after the case flow.';
}

export function renderHome(view) {
  const audience = view.audience || 'internal';
  const stages = view.stages.map((stage) => `<li><span class="count">${esc(stage.count)}</span>${esc(stage.label)}</li>`).join('');
  const cases = view.cases.map((item) => `<article class="card"><h2><a href="${hrefFor(`/staff/flow/case/${encodeURIComponent(item.ref)}`, audience)}">${esc(item.ref)}</a></h2><p>${esc(item.transaction_type)}</p><p class="meta">${esc(item.borrower_name)} · ${esc(chargePhrase(item))} · ${item.regulated ? 'Regulated' : 'Unregulated'}</p><p><a href="${hrefFor(`/staff/flow/case/${encodeURIComponent(item.ref)}`, audience)}">Open case</a></p></article>`).join('');
  const body = `${nav('Flow', audience)}<h1>From first call to completion, on one desk.</h1><p>${viewLabel(audience)}</p><p>Fixture counts for this demo. Nothing here is a live case.</p><ol class="stack">${stages}</ol><h2>Demo cases</h2>${cases}`;
  return flowShell('Home', body, { audience });
}

export function renderCasePage(view) {
  const item = view.flowCase;
  const match = view.match;
  const eligible = match.rows.filter((row) => row.tier === 'eligible').slice(0, 8);
  const rows = eligible.map((row) => `<li>${esc(row.name)} · ${row.rate_pcm == null ? 'rate not known' : `${esc(row.rate_pcm.toFixed(2))}% pcm`} · ${esc(row.source)} ${esc(row.source_date)} · grade ${esc(row.grade)} · website-stated, not lender-confirmed</li>`).join('');
  const counts = view.counts;
  const comps = item.residential ? `<h2>AVM and comparables</h2><p>AVM ${esc(pounds(item.avm.value))} (range ${esc(pounds(item.avm.low))}–${esc(pounds(item.avm.high))}, ${esc(item.avm.confidence)} confidence), subject to status.</p><table><thead><tr><th>Address</th><th>Sold</th><th>Price</th><th>£/sq ft</th><th>Distance</th><th>Type</th></tr></thead><tbody>${item.comparables.map((comp) => `<tr><td>${esc(comp.address)}</td><td>${esc(comp.sold_date)}</td><td>${esc(pounds(comp.price))}</td><td>${esc(pounds(comp.psf))}</td><td>${esc(comp.distance)}</td><td>${esc(comp.type)}</td></tr>`).join('')}</tbody></table>` : '<p class="meta">Comparables are not used on this development fixture.</p>';
  const charges = (item.existing_charges || []).map((charge) => `${charge.holder} ${pounds(charge.balance)}${charge.mandatory ? ' (mandatory redemption)' : ''}`).join('; ') || 'None';
  const log = view.activity.length ? view.activity.map((entry) => `<li>${esc(entry.at)} · ${esc(entry.via)} · ${esc(entry.mode)} · eligible ${esc(entry.eligible)} · unverified ${esc(entry.unverified)} · excluded ${esc(entry.excluded)}</li>`).join('') : '<li>No simulated placements yet.</li>';
  const approvals = view.approvals.length ? view.approvals.map((entry) => `<li data-status="${esc(entry.status)}">${esc(entry.at)} · ${esc(entry.status)} · ${esc(entry.via)}</li>`).join('') : '<li>No approval recorded.</li>';
  const audience = view.audience || 'internal';
  const body = `${nav('', audience)}<p class="bar"><a href="${hrefFor('/staff/flow', audience)}">All cases</a></p><article class="card"><p class="meta">${esc(item.ref)} · ${esc(item.stage)}</p><h1>${esc(item.transaction_type)}</h1><p>${esc(item.summary)}</p><h2>Fact find</h2><p>${esc(item.borrower_name)} · ${esc(item.address)} · ${esc(item.email)}</p><p>${esc(item.occupancy)}. ${esc(item.purpose)} Exit: ${esc(item.exit)}. Term ${esc(item.term)}.</p><p>${esc(item.property_label)} ${esc(pounds(item.property_value))}. Net ask ${esc(pounds(item.net_ask))}, ${esc(chargePhrase(item))}, ${item.regulated ? 'regulated' : 'unregulated'}. Subject to status.</p><p>Existing charges: ${esc(charges)}.</p>${comps}</article><article class="card"><h2>Placed shortlist</h2><p class="meta">Research / interpreted, not lender-confirmed. Eligible ${esc(counts.eligible)}, unverified ${esc(counts.unverified)}, excluded ${esc(counts.excluded)}. LTV ${esc(match.ltv)}%.</p><ul>${rows || '<li>No eligible lender on these criteria.</li>'}</ul><p>${esc(rateSummary(match.rows))}</p>${audience === 'internal' ? view.actions : '<p class="meta">This view follows the case. Drafts and placement controls stay on the Posfin desk.</p>'}</article><article class="card"><h2>Activity log</h2><ul>${log}</ul><h2>Approvals</h2><ul>${approvals}</ul></article>`;
  return flowShell(`Case ${item.ref}`, body, { audience });
}

function blockHtml(block) {
  if (block.type === 'h') return `<h2>${esc(block.text)}</h2>`;
  if (block.type === 'callout') return `<p class="callout">${esc(block.text)}</p>`;
  if (block.type === 'p' || block.type === 'note') {
    const tag = block.money ? 'section' : 'p';
    if (tag === 'section') return `<section data-money="note"><p>${esc(block.text)}</p></section>`;
    return `<p>${esc(block.text)}</p>`;
  }
  if (block.type === 'tiles') {
    const tiles = block.items.map((item) => `<div class="tile"><span class="micro">${esc(item.label)}</span><b>${esc(item.value)}</b><span class="micro">subject to status</span></div>`).join('');
    return `<section data-money="tiles"><p>${esc(block.caption || '')}</p><div class="tiles">${tiles}</div></section>`;
  }
  if (block.type === 'table') {
    const head = block.head.map((cell) => `<th>${esc(cell)}</th>`).join('');
    const rows = block.rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('');
    return `<section data-money="table"><p>${esc(block.caption || '')}</p><div class="scroll"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }
  if (block.type === 'sign') {
    return `<section class="card"><h2>${esc(block.title)}</h2><p>Signature (placeholder)</p><p>Name</p><p>Date</p></section>`;
  }
  return '';
}

export function renderDocument(model) {
  const gold = model.kind === 'lor' ? '<p class="goldbar">LENDER OFFER REQUEST — DEMO, NOT SENT</p>' : '';
  const mark = model.kind === 'lor' ? '<p class="lor-mark">LOR</p>' : '';
  const intro = model.kind === 'lor'
    ? `<p class="meta">${esc(model.version)} · ${esc(model.date)} · ${esc(model.ref)} · DEMO — NOT SENT</p><p>${esc(model.contact)}</p><h2 class="headline" data-headline>${esc(model.headline)}</h2><p class="pills"><span class="pill">${esc(model.pills)}</span></p>`
    : `<p class="meta">${esc(model.ref)} · ${esc(model.version)} · ${esc(model.date)}</p><p class="meta">FCA FRN 913022 · NACFB member · Credit broker, not a lender</p>`;
  const body = `${nav('')}<p class="bar"><a href="/staff/flow/case/${encodeURIComponent(model.ref)}">Case</a><a href="${esc(model.pdfHref)}">Download PDF</a></p><article class="sheet">${gold}${mark}<h1>${esc(model.title)}</h1>${intro}${model.blocks.map(blockHtml).join('')}<p class="footer-line">Subject to status. Posfin Capital Ltd is a credit broker, not a lender.</p><p class="doc-foot">Demo document · TEST data · not for issue · page 1 of 1</p></article>`;
  return flowShell(model.pageTitle, body, { watermark: true });
}

export function renderDocumentError(flowCase, message) {
  const ref = flowCase ? flowCase.ref : '';
  const back = ref ? `<p><a href="/staff/flow/case/${encodeURIComponent(ref)}">Back to the case</a></p>` : '';
  const body = `${nav('')}<article class="card"><h1>Document not produced</h1><p class="error" role="alert">${esc(message)}</p>${back}</article>`;
  return flowShell('Document', body);
}

function overview(flowCase, match) {
  const charges = (flowCase.existing_charges || []).map((item) => `${item.holder} ${pounds(item.balance)}${item.mandatory ? ' (mandatory redemption)' : ''}`).join('; ') || 'None';
  return `<section class="card"><h2>Search parameters overview</h2><h3>Loan facility, including LTV</h3><p>${esc(pounds(flowCase.net_ask))} net, ${esc(chargePhrase(flowCase))}, ${esc(flowCase.term)}. LTV ${esc(String(match.ltv))}%. ${esc(match.basis)}. Subject to status.</p><h3>Financial</h3><p>${esc(flowCase.property_label)} ${esc(pounds(flowCase.property_value))}. Existing charges: ${esc(charges)}. Net ask ${esc(pounds(flowCase.net_ask))}.</p><h3>Project</h3><p>${esc(flowCase.project)}</p><h3>Borrower</h3><p>${esc(flowCase.borrower_name)}. ${esc(flowCase.occupancy)}.</p><h3>Security</h3><p>${esc(flowCase.address)}. ${esc(chargePhrase(flowCase))}. ${flowCase.regulated ? 'Regulated' : 'Unregulated'}.</p><h3>Transaction type</h3><p>${esc(flowCase.transaction_type)}. Exit: ${esc(flowCase.exit)}.</p>${match.note ? `<p>${esc(match.note)}</p>` : ''}</section>`;
}

function groupTable(rows) {
  const body = rows.map((row) => {
    const reasons = row.tier === 'excluded' ? row.block : row.tier === 'unverified' ? row.unknown : row.why;
    return `<tr data-tier="${esc(row.tier)}" data-lender="${esc(row.id)}"><td>${esc(row.name)}</td><td>${row.stale ? 'Stale' : 'Current'}</td><td>${row.rate_pcm == null ? 'Not known' : `${esc(row.rate_pcm.toFixed(2))}% pcm`}</td><td>${row.limit == null ? 'Not known' : esc(String(row.limit))}</td><td>${esc((reasons || []).join('; ') || '—')}</td><td>${esc(row.source)} · ${esc(row.source_date)} · grade ${esc(row.grade)} · website-stated, not lender-confirmed</td></tr>`;
  }).join('');
  return `<div class="scroll"><table><thead><tr><th>Lender</th><th>Source age</th><th>Rate</th><th>Limit</th><th>Why</th><th>Source</th></tr></thead><tbody>${body || '<tr><td colspan="6">None</td></tr>'}</tbody></table></div>`;
}

export function renderPlace(view) {
  const item = view.flowCase;
  const groups = ['eligible', 'unverified', 'excluded'].map((tier) => {
    const rows = view.match.rows.filter((row) => row.tier === tier);
    const label = tier === 'unverified' ? 'Unverified (criteria missing)' : tier[0].toUpperCase() + tier.slice(1);
    return `<section class="card" id="${tier}"><h2>${label} · ${rows.length}</h2>${groupTable(rows)}</section>`;
  }).join('');
  const title = view.via === 'broka' ? 'What BROKA would be asked (simulated)' : 'What Placed matched (simulated)';
  const audience = view.audience || 'internal';
  const body = `${nav('', audience)}<article class="card"><h1>${esc(title)}</h1><p class="goldbar">Simulated. Nothing was sent to BROKA or any lender.</p><p>${esc(item.ref)} via ${esc(view.via)}. ${esc(rateSummary(view.match.rows))}</p><p class="meta">Every figure is website-stated, not lender-confirmed. Each row shows its source and date.</p></article>${overview(item, view.match)}${groups}`;
  return flowShell('Simulated placement', body, { watermark: true, audience });
}

export function renderApprove(view) {
  const item = view.flowCase;
  const eligible = view.match.rows.filter((row) => row.tier === 'eligible');
  const choices = eligible.map((row, index) => {
    const checked = index < 5 ? ' checked' : '';
    return `<label class="tick"><input type="checkbox" name="lender" value="${esc(row.id)}"${checked}> ${esc(row.name)}${row.rate_pcm == null ? '' : ` · ${esc(row.rate_pcm.toFixed(2))}% pcm`}</label>`;
  }).join('') || '<p>No eligible lender to tick.</p>';
  const action = view.principal
    ? '<button class="send" type="submit" name="action" value="confirm">Confirm (Byron)</button>'
    : '<button class="send" type="submit" name="action" value="request">Request Byron\'s approval</button>';
  const warning = view.warning ? `<p class="error" role="alert">${esc(view.warning)}</p>` : '';
  const done = view.result || '';
  const body = `${nav('')}<article class="card"><h1>Byron's confirmation</h1><p class="goldbar">Byron's confirmation required. Nothing is placed until Byron confirms.</p>${warning}${done ? `<p data-status="${esc(view.resultStatus || '')}">${esc(done)}</p>` : ''}<p>${esc(item.ref)} · ${esc(view.via)}. Nothing on this screen submits a case.</p></article>${overview(item, view.match)}<form class="card" method="post" action="/staff/flow/approve/${encodeURIComponent(item.ref)}"><input type="hidden" name="via" value="${esc(view.via)}"><h2>Eligible lenders</h2><p class="meta">Five are ticked to start. Tick at most five. Nothing is selected for sending on its own.</p>${choices}<label class="tick"><input type="checkbox" name="accurate" value="yes"> I confirm these parameters are correct</label><div class="actions">${action}</div></form>`;
  return flowShell('Byron\'s confirmation', body);
}

export function renderLenders(view) {
  const options = (name, values, current) => [`<option value="">Any</option>`, ...values.map((value) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(value)}</option>`)].join('');
  const coverage = Object.entries(view.coverage).map(([key, count]) => `<li>${esc(key)}: ${esc(count)}</li>`).join('');
  const rows = view.rows.map((row) => `<tr><td>${esc(row.id)}</td><td><a href="/staff/flow/lenders/${encodeURIComponent(row.id)}">${esc(row.name)}</a></td><td>${esc(row.grade)}</td><td>${esc(row.segment)}</td><td>${esc(row.charge || '—')}</td><td>${esc(row.regulated || '—')}</td><td>${row.stale ? 'Stale' : 'Current'}</td><td>${esc(row.source)} ${esc(row.source_date)}</td><td>${row.rate_pcm == null ? '—' : esc(row.rate_pcm)}</td></tr>`).join('');
  const body = `${nav('Placed lenders')}<h1>Placed lenders</h1><p class="meta">website-stated, not lender-confirmed. ${esc(view.rows.length)} shown of ${esc(view.total)}. Open a lender for the source URL and checked date on each figure.</p><form class="card" method="get" action="/staff/flow/lenders"><label for="charge">Charge</label><select id="charge" name="charge">${options('charge', view.filterOptions.charge, view.filters.charge)}</select><label for="regulated">Regulated</label><select id="regulated" name="regulated">${options('regulated', view.filterOptions.regulated, view.filters.regulated)}</select><label for="segment">Segment</label><select id="segment" name="segment">${options('segment', view.filterOptions.segment, view.filters.segment)}</select><label for="grade">Grade</label><select id="grade" name="grade">${options('grade', view.filterOptions.grade, view.filters.grade)}</select><label for="stale">Stale</label><select id="stale" name="stale">${options('stale', ['yes', 'no'], view.filters.stale)}</select><button class="send" type="submit">Filter</button></form><article class="card"><h2>Coverage</h2><ul>${coverage}</ul></article><div class="scroll"><table><thead><tr><th>Id</th><th>Lender</th><th>Grade</th><th>Segment</th><th>Charge</th><th>Regulated</th><th>Stale</th><th>Source</th><th>Rate pcm</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return flowShell('Placed lenders', body);
}

function sourceLink(url) {
  const text = String(url || '').trim();
  if (!/^https?:\/\//i.test(text)) return '—';
  return `<a href="${esc(text)}" rel="noreferrer">${esc(text)}</a>`;
}

export function renderLenderDetail(view) {
  const lender = view.lender;
  const detail = view.detail;
  const rows = detail.rows.map((row) => `<tr data-field="${esc(row.key)}"><td>${esc(row.label)}</td><td>${row.value ? esc(row.value) : 'Not found publicly'}</td><td>${sourceLink(row.source)}</td><td>${row.checked ? esc(row.checked) : '—'}</td><td>${row.value || row.source ? esc(row.tag) : '—'}</td></tr>`).join('');
  const note = detail.note ? `<p>${esc(detail.note)}</p>` : '';
  const body = `${nav('Placed lenders')}<p class="bar"><a href="/staff/flow/lenders">All lenders</a></p><article class="card"><p class="meta">${esc(lender.id)} · grade ${esc(lender.grade)} · ${esc(lender.source)} ${esc(lender.source_date)}${lender.stale ? ' · stale' : ''}</p><h1>${esc(lender.name)}</h1><p class="goldbar" data-research-tag="website-stated, not lender-confirmed">website-stated, not lender-confirmed</p><p class="meta">Blank means not found publicly. Nothing here is lender-confirmed.</p>${detail.guideDate ? `<p class="meta">Guide date ${esc(detail.guideDate)}.</p>` : ''}${note}</article><div class="scroll"><table><thead><tr><th>Figure</th><th>Value</th><th>Source URL</th><th>Checked</th><th>Tag</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return flowShell(lender.name, body);
}

function fromOptions(selected) {
  return FROM_IDENTITIES.map((name) => `<option${name === selected ? ' selected' : ''}>${esc(name)}</option>`).join('');
}

export function renderProcessingList(view) {
  const audience = 'internal';
  const cards = view.cases.map((item) => `<article class="card"><h2><a href="/staff/flow/processing/${encodeURIComponent(item.ref)}">${esc(item.ref)}</a></h2><p>${esc(item.transaction_type)}</p><p class="meta">${esc(view.lines.find((line) => line.ref === item.ref)?.nextStep || '')}</p></article>`).join('');
  const body = `${nav('Processing', audience)}<h1>Processing</h1><p>Desk for Jess and Cai. The checklist starts after placement. Drafts stay here for a person to review. Nothing is sent.</p>${cards}`;
  return flowShell('Processing', body, { audience });
}

export function renderProcessingCase(view) {
  const item = view.flowCase;
  const drafts = view.drafts || [];
  const steps = PROCESS_STEPS.map((step) => {
    const draft = drafts.find((entry) => entry.step === step.id);
    const saved = draft ? `<p data-draft="${esc(step.id)}" data-auto-send="off"><strong>Draft.</strong> From ${esc(draft.from)}. ${esc(draft.subject)}. Nothing was sent.</p><pre>${esc(draft.body)}</pre>` : '';
    return `<section class="card" id="${esc(step.id)}"><h2>${esc(step.label)}</h2><p class="meta">Waiting on ${esc(step.waitingOn)}.</p>${saved}<form method="post" action="/staff/flow/processing/${encodeURIComponent(item.ref)}"><input type="hidden" name="action" value="draft"><input type="hidden" name="step" value="${esc(step.id)}"><input type="hidden" name="audience" value="internal"><label for="from-${esc(step.id)}">From</label><select id="from-${esc(step.id)}" name="from">${fromOptions(view.from || 'Jess')}</select><label class="tick"><input type="checkbox" name="auto_send_visible" value="on" disabled> Auto-send</label><input type="hidden" name="auto_send" value="off"><p class="meta">Enabled only by Byron. Auto-send is off.</p><button class="secondary" type="submit">Draft next action</button></form></section>`;
  }).join('');
  const body = `${nav('Processing', 'internal')}<p class="bar"><a href="/staff/flow/processing">All processing</a></p><h1>${esc(item.ref)}</h1><p>Jess and Cai work this checklist. Each button saves a draft for review. Nothing is sent.</p>${steps}`;
  return flowShell(`Processing ${item.ref}`, body, { audience: 'internal' });
}

export function renderLeadership(view) {
  const rows = view.lines.map((line) => `<tr data-case="${esc(line.ref)}"><td><a href="/staff/flow/case/${encodeURIComponent(line.ref)}">${esc(line.ref)}</a></td><td>${esc(line.stage)}</td><td>${esc(line.nextStep)}</td><td>${esc(line.waitingOn)}</td><td data-draft-ready="${line.draftReady ? 'yes' : 'no'}">${line.draftReady ? 'Draft ready for approval' : 'No draft yet'}</td></tr>`).join('');
  const body = `${nav('Leadership', 'internal')}<h1>Leadership</h1><p>Byron and Chris. One line per case: the stage, the next step, who it is waiting on, and whether a draft is ready. Nothing on this page sends.</p><div class="scroll"><table><thead><tr><th>Case</th><th>Stage</th><th>Next step</th><th>Waiting on</th><th>Draft</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  return flowShell('Leadership', body, { audience: 'internal' });
}

export function renderFlowMessage(title, text) {
  const body = `${nav('')}<article class="card"><h1>${esc(title)}</h1><p>${esc(text)}</p><p><a href="/staff/flow">Posfin Flow</a></p></article>`;
  return flowShell(title, body);
}

export function renderNotFound() {
  return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Not found</title></head><body><h1>Not found</h1><p>This page is not available.</p></body></html>';
}
