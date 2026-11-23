import { esc } from "./case-portal.js";
import { OUICAP_FIELDS, ULEND_FIELDS } from "./fr-desk.js";

const CSS = `
:root{--navy:#0B1F3A;--ink:#0B1F3A;--paper:#FBF7EE;--line:#E3DCCB;--teal:#0F8F9A;--gold:#D4A853}
*{box-sizing:border-box}
body{margin:0;font:16px/1.5 "DM Sans",system-ui,sans-serif;color:var(--ink);background:var(--paper)}
a{color:var(--teal)}
header.top{background:var(--navy);color:#fff;padding:14px 16px}
.top-inner{max-width:880px;margin:0 auto}
.brand{display:flex;justify-content:space-between;align-items:center;gap:12px}
.brand strong{letter-spacing:.12em;font-size:13px}
h1{font-family:Georgia,serif;font-weight:500;font-size:30px;line-height:1.15;margin:14px 0 4px}
.sub{margin:0;color:rgba(255,255,255,.8)}
.wrap{max-width:880px;margin:0 auto;padding:16px 16px 48px}
.lang{display:inline-flex;align-items:center;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:3px;color:#fff;text-decoration:none;min-height:40px}
.lang span{min-width:36px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:0 8px;color:rgba(255,255,255,.7);font-weight:700}
.lang span.on{background:#fff;color:var(--navy)}
.lang i{font-style:normal;color:rgba(255,255,255,.55);padding:0 1px}
.bar{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;margin:0 0 12px}
.card h2{font-size:20px;margin:0 0 6px}
.meta{color:#4F5F78;margin:0 0 8px}
.pills{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.pill{background:#F2FBFC;color:#0F5F66;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700}
.pill.warn{background:#FFF6E8;color:#8A5A00}
.pill.tbc{background:#F4F0FF;color:#4C3A8A}
.products{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:760px){.products{grid-template-columns:1fr 1fr}}
button,a.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 14px;border-radius:999px;border:0;background:var(--navy);color:#fff;font-weight:700;text-decoration:none;width:100%}
a.ghost,button.ghost{background:#fff;color:var(--navy);border:1.5px solid rgba(11,31,58,.25)}
.row{display:flex;flex-wrap:wrap;gap:8px}
.row a,.row button{width:auto;flex:1}
ul.gaps{margin:8px 0 0;padding-left:18px}
input[type=password]{width:100%;min-height:48px;border-radius:12px;border:1px solid var(--line);padding:12px;font:inherit}
.test{background:#8A1C1C;color:#fff;border-radius:12px;padding:10px 12px;font-weight:700}
.side{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:760px){.side{grid-template-columns:1fr 1fr}}
dt{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#4F5F78;margin-top:8px}
dd{margin:0;font-weight:700}
dd.miss{color:#8A1C1C}
`;

function page(title, body) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${body}</body></html>`;
}

export function langSwitch(lang, hrefBase) {
  const en = lang === "en";
  const next = en ? "fr" : "en";
  const label = en ? "Language: English. Switch to French" : "Langue : français. Passer en anglais";
  return `<a class="lang" role="switch" aria-checked="${en ? "true" : "false"}" aria-label="${esc(label)}" href="${esc(hrefBase)}?lang=${next}"><span class="${en ? "" : "on"}">FR</span><i aria-hidden="true">/</i><span class="${en ? "on" : ""}">EN</span></a>`;
}

const COPY = {
  fr: {
    title: "Bureau France",
    hello: "Dossiers de Vanessa",
    intro: "OuiCap et ULend. Rien n'est envoyé tant que Vanessa n'appuie pas sur envoyer dans WhatsApp.",
    uk: "Dossiers Royaume-Uni",
    out: "Déconnexion",
    products: "Les deux prêteurs",
    ouicap: "OuiCap — prêt professionnel. Champs du formulaire de demande.",
    ulend: "ULend — avance sur ventes futures, remboursée selon un coefficient fixe, pas un intérêt. Les champs sont TBC : le formulaire ULend n'est pas encore reçu.",
    statements: "Relevés",
    gaps: "champs manquants",
    open: "Ouvrir",
    wa: "WhatsApp — Vanessa envoie",
    factfind: "Fact find du client",
    missing: "Il manque",
    none: "Rien ne manque pour ce produit.",
    months: "mois reçus",
    tbc: "TBC",
    agent: "Téléphone de Vanessa (FR_AGENT_WHATSAPP)",
    agentMissing: "FR_AGENT_WHATSAPP n'est pas configuré. Le lien ouvre WhatsApp sur le téléphone de Vanessa, vers le numéro de test.",
    placeholder: "Numéro fictif du dossier",
    test: "CAS DE FORMATION — entreprises fictives. Ne pas contacter. Ne rien envoyer à un prêteur.",
    login: "Mot de passe staff",
    loginBtn: "Ouvrir le bureau France",
    other: "Autre produit, pas ce dossier",
  },
  en: {
    title: "France desk",
    hello: "Vanessa's cases",
    intro: "OuiCap and ULend. Nothing is sent until Vanessa presses send in WhatsApp.",
    uk: "United Kingdom cases",
    out: "Log out",
    products: "Both lenders",
    ouicap: "OuiCap — a business loan. Fields from their application form.",
    ulend: "ULend — an advance on future sales, repaid as a fixed multiple, not interest. These fields are TBC: the ULend form has not arrived.",
    statements: "Statements",
    gaps: "fields still missing",
    open: "Open",
    wa: "WhatsApp — Vanessa sends",
    factfind: "Client fact find",
    missing: "Still missing",
    none: "Nothing missing for this product.",
    months: "months received",
    tbc: "TBC",
    agent: "Vanessa's phone (FR_AGENT_WHATSAPP)",
    agentMissing: "FR_AGENT_WHATSAPP is not set. The link opens WhatsApp on Vanessa's phone, to the test number.",
    placeholder: "Fictional case number",
    test: "TRAINING CASES — fictional businesses. Do not contact anyone. Do not send anything to a lender.",
    login: "Staff password",
    loginBtn: "Open the France desk",
    other: "Other product, not this case",
  },
};

function t(lang) {
  return COPY[lang === "en" ? "en" : "fr"];
}

function productCard(title, text, fields, lang) {
  const copy = t(lang);
  const list = fields.map((field) => `<li>${esc(field[lang === "en" ? "en" : "fr"])}${field.tbc ? ` <span class="pill tbc">${esc(copy.tbc)}</span>` : ""}</li>`).join("");
  return `<article class="card"><h2>${esc(title)}</h2><p>${esc(text)}</p><ul>${list}</ul></article>`;
}

export function renderFranceLogin(error, lang) {
  const copy = t(lang);
  const body = `<header class="top"><div class="top-inner"><div class="brand"><strong>POSFIN FRANCE</strong>${langSwitch(lang, "/staff/france")}</div><h1>${esc(copy.title)}</h1></div></header><main class="wrap"><p class="test">${esc(copy.test)}</p><article class="card"><form method="post" action="/staff/france"><input type="hidden" name="lang" value="${lang === "en" ? "en" : "fr"}"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username"><label for="password">${esc(copy.login)}</label><input id="password" name="password" type="password" autocomplete="current-password" required minlength="8"><p>${error ? esc(error) : ""}</p><button type="submit">${esc(copy.loginBtn)}</button></form><p><a href="/staff/set-password">Forgot password?</a></p><p><a href="/staff/cases">${esc(copy.uk)}</a></p></article></main>`;
  return page(copy.title, body);
}

export function renderFranceList(cases, lang) {
  const copy = t(lang);
  const cards = cases.map((item) => `<article class="card"><h2>${esc(item.company)}</h2><p class="meta">${esc(item.firstName)} ${esc(item.lastName)} · ${esc(item.town)} · ${esc(item.lenderLabel)}</p><div class="pills"><span class="pill">${esc(item.stageLabel)}</span><span class="pill${item.statements.complete ? "" : " warn"}">${esc(copy.statements)} ${item.statements.count}/${item.statements.needed}</span><span class="pill${item.gapCount ? " warn" : ""}">${item.gapCount} ${esc(copy.gaps)}</span></div><div class="row"><a class="ghost" href="/staff/france/${esc(item.id)}?lang=${lang === "en" ? "en" : "fr"}">${esc(copy.open)}</a><a href="${esc(item.whatsappUrl || "#")}"${item.whatsappOk ? "" : " aria-disabled=\"true\""}>${esc(copy.wa)}</a></div></article>`).join("");
  const agent = cases[0] && cases[0].agentPhone ? `<p class="meta">${esc(copy.agent)} : ${esc(cases[0].agentPhone)}</p>` : `<p class="meta">${esc(copy.agentMissing)}</p>`;
  const body = `<header class="top"><div class="top-inner"><div class="brand"><strong>POSFIN FRANCE</strong>${langSwitch(lang, "/staff/france")}</div><h1>${esc(copy.hello)}</h1><p class="sub">${esc(copy.intro)}</p></div></header><main class="wrap"><p class="test">${esc(copy.test)}</p><div class="bar"><a href="/staff/cases">${esc(copy.uk)}</a><form method="post" action="/staff/france"><input type="hidden" name="action" value="logout"><button class="ghost" type="submit">${esc(copy.out)}</button></form></div>${agent}<section class="products"><h2 class="meta">${esc(copy.products)}</h2>${productCard("OuiCap", copy.ouicap, OUICAP_FIELDS, lang)}${productCard("ULend", copy.ulend, ULEND_FIELDS, lang)}</section>${cards}</main>`;
  return page(copy.hello, body);
}

function fieldList(fields, lang, copy) {
  return fields.map((field) => `<dt>${esc(field[lang === "en" ? "en" : "fr"])}${field.tbc ? ` · ${esc(copy.tbc)}` : ""}</dt><dd class="${field.missing ? "miss" : ""}">${field.missing ? "—" : esc(String(field.value))}</dd>`).join("");
}

export function renderFranceCase(item, lang) {
  const copy = t(lang);
  const other = item.lender === "ulend" ? OUICAP_FIELDS : ULEND_FIELDS;
  const gaps = item.missing.length ? `<p>${esc(copy.missing)} (${item.gapCount})</p><ul class="gaps">${item.missing.map((field) => `<li>${esc(field[lang === "en" ? "en" : "fr"])}${field.tbc ? ` (${esc(copy.tbc)})` : ""}</li>`).join("")}</ul>` : `<p>${esc(copy.none)}</p>`;
  const body = `<header class="top"><div class="top-inner"><div class="brand"><strong>POSFIN FRANCE</strong>${langSwitch(lang, `/staff/france/${item.id}`)}</div><h1>${esc(item.company)}</h1><p class="sub">${esc(item.stageLabel)} · ${esc(item.lenderLabel)} · SIREN ${esc(item.siren)}</p></div></header><main class="wrap"><p class="test">${esc(copy.test)}</p><p><a href="/staff/france?lang=${lang === "en" ? "en" : "fr"}">${esc(copy.hello)}</a></p><article class="card"><div class="pills"><span class="pill${item.statements.complete ? "" : " warn"}">${esc(copy.statements)} ${item.statements.count}/${item.statements.needed} ${esc(copy.months)}</span></div><p class="meta">${item.statements.months.map(esc).join(", ") || "—"}</p>${gaps}<div class="row"><a href="${esc(item.smartUrl)}">${esc(copy.factfind)}</a><a href="${esc(item.whatsappUrl || "#")}">${esc(copy.wa)}</a></div><p class="meta">${esc(copy.placeholder)} : ${esc(item.placeholderPhone)}</p></article><section class="side"><article class="card"><h2>${esc(item.lenderLabel)}</h2><dl>${fieldList(item.fields, lang, copy)}</dl></article><article class="card"><h2>${esc(copy.other)}</h2><ul>${other.map((field) => `<li>${esc(field[lang === "en" ? "en" : "fr"])}${field.tbc ? ` <span class="pill tbc">${esc(copy.tbc)}</span>` : ""}</li>`).join("")}</ul></article></section></main>`;
  return page(item.company, body);
}
