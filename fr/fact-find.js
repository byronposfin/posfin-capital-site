import { CONSENT, COPY, formAnswers, formatMoney, formatNumber, langStorageKey, langSwitchState, questionsFor, resolveLang, toggleLang } from "/lib/fr-factfind.js?v=20261119-fr3";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let token = new URLSearchParams(location.search).get("k") || "";
let lang = "fr";
try { lang = resolveLang({ stored: localStorage.getItem(langStorageKey(token)) }); } catch { lang = "fr"; }
let payload = null;
let stage = 1;
let answers = {};
let files = [];
let done = false;
let busy = false;

const t = () => COPY[lang];
const label = (field) => field.label[lang] || field.label.fr;

function paintLang() {
  const state = langSwitchState(lang);
  const button = $("lang");
  button.setAttribute("aria-checked", state.ariaChecked ? "true" : "false");
  button.setAttribute("aria-label", state.label);
  button.querySelectorAll("[data-side]").forEach((el) => el.classList.toggle("on", el.dataset.side === state.lang));
  document.documentElement.lang = t().htmlLang;
  document.title = lang === "en" ? "Financing request · Posfin France" : "Demande de financement · Posfin France";
  $("title").textContent = t().title;
  $("intro").textContent = t().intro;
}

function rememberLang() {
  try { localStorage.setItem(langStorageKey(token), lang); } catch { /* private mode */ }
}

function setLang(next) {
  if (document.getElementById("ff")) readForm();
  lang = next === "en" ? "en" : "fr";
  rememberLang();
  paintLang();
  render();
}

async function api(body) {
  const response = await fetch("/api/fr-factfind", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json = {};
  try { json = await response.json(); } catch { json = {}; }
  return { status: response.status, json };
}

function readForm() {
  for (const field of questionsFor(payload?.locked)) {
    const el = document.getElementById(field.key);
    if (!el) continue;
    answers[field.key] = field.type === "bool" ? el.checked : el.value;
  }
}

function showErrors(errors) {
  document.querySelectorAll(".err").forEach((el) => { el.textContent = ""; });
  document.querySelectorAll(".bad").forEach((el) => el.classList.remove("bad"));
  let first = null;
  for (const [key, code] of Object.entries(errors || {})) {
    const msg = t().err[code] || t().err.req;
    const slot = document.getElementById(`e_${key}`);
    const input = document.getElementById(key);
    if (slot) slot.textContent = msg;
    if (input) {
      input.classList.add("bad");
      if (!first) first = input;
    }
  }
  if (!first && errors?.statements) {
    const slot = document.getElementById("e_statements");
    if (slot) slot.textContent = t().err.statements;
  }
  if (first) first.focus();
}

function fileList(list) {
  if (!list.length) return `<p class="note">${esc(t().noneYet)}</p>`;
  return `<ul class="files">${list.map((file) => `<li>${esc(file.file_name)}</li>`).join("")}</ul>`;
}

function prettyPhone(value) {
  const phone = String(value || "");
  return /^\+33\d{9}$/.test(phone) ? `+33 ${phone.slice(3, 4)} ${phone.slice(4, 6)} ${phone.slice(6, 8)} ${phone.slice(8, 10)} ${phone.slice(10)}` : phone;
}
function knownCard() {
  const locked = payload?.locked || {};
  const bits = [locked.first_name, locked.last_name].filter(Boolean).join(" ");
  const lines = [bits, locked.company_name, prettyPhone(locked.mobile), locked.email].filter(Boolean);
  if (!lines.length) return "";
  return `<div class="known"><b>${esc(t().known)}</b><p>${lines.map(esc).join("<br>")}</p></div>`;
}

function shownAmount(field, value) {
  if (value === "" || value === undefined || value === null) return "";
  if (field.type === "money") return formatMoney(value, lang) || String(value);
  if (field.type === "pct") return formatNumber(value, lang) || String(value);
  return value;
}

function fieldHtml(field) {
  const id = field.key;
  const value = field.type === "money" || field.type === "pct" ? shownAmount(field, answers[id]) : (answers[id] ?? "");
  let control;
  if (field.type === "select") {
    control = `<select id="${id}" name="${id}"><option value="">${esc(t().select)}</option>${field.options.map((option) => `<option value="${esc(option)}"${option === value ? " selected" : ""}>${esc(option)}</option>`).join("")}</select>`;
  } else if (field.type === "textarea") {
    control = `<textarea id="${id}" name="${id}" maxlength="${field.max || 400}">${esc(value)}</textarea>`;
  } else if (field.type === "bool") {
    return `<div class="field"><label class="chk"><input type="checkbox" id="${id}" name="${id}"${value === true ? " checked" : ""}><span>${esc(label(field))}</span></label><p class="note">${esc(t().consentNote)}</p><div class="err" id="e_${id}"></div></div>`;
  } else {
    const type = field.type === "date" ? "date" : field.type === "tel" ? "tel" : "text";
    const mode = field.type === "money" || field.type === "pct" ? ` inputmode="decimal" data-amount="1"` : (field.inputmode ? ` inputmode="${field.inputmode}"` : "");
    const max = field.type === "money" ? 32 : (field.max || 80);
    control = `<input type="${type}" id="${id}" name="${id}"${mode} maxlength="${max}" value="${esc(value)}" autocomplete="off">`;
  }
  return `<div class="field"><label class="l" for="${id}">${esc(label(field))}</label>${control}<div class="err" id="e_${id}"></div></div>`;
}

function render() {
  const copy = t();
  const app = $("app");
  if (!token) {
    app.innerHTML = `<div class="card"><p>${esc(copy.noToken)}</p></div>`;
    return;
  }
  if (!payload) {
    app.innerHTML = `<p class="status">${esc(copy.saving)}</p>`;
    return;
  }
  if (done || payload.step === 4) {
    app.innerHTML = `${payload.is_test ? `<p class="testbar">${esc(copy.test)}</p>` : ""}<div class="card"><h2>${esc(copy.doneTitle)}</h2><p>${esc(copy.doneBody)}</p><p class="note">${esc(payload.reference || "")}</p></div>`;
    return;
  }
  const fields = questionsFor(payload.locked).filter((field) => field.stage === stage);
  const rail = copy.stage.map((name, index) => `<div class="${index + 1 === stage ? "on" : ""} ${index + 1 < stage ? "done" : ""}">${index + 1 < 10 ? "0" : ""}${index + 1} ${esc(name)}</div>`).join("");
  const statements = files.filter((file) => file.doc_type === "bank_statements");
  let body = "";
  if (stage === 1) {
    body = `${knownCard()}<div class="drop"><p>${esc(copy.stageBody[0])}</p><div class="row"><button class="btn btn-primary" type="button" id="photoBtn">${esc(copy.photo)}</button><button class="btn btn-ghost" type="button" id="fileBtn">${esc(copy.file)}</button></div><input class="hide" id="camera" type="file" accept="image/*" capture="environment"><input class="hide" id="picker" type="file" accept="application/pdf,image/*" multiple><p class="note" id="uploadedLabel">${esc(copy.uploaded)}</p>${fileList(statements)}<div class="err" id="e_statements"></div></div>`;
  } else {
    body = `${stage === 2 ? knownCard() : ""}<div class="grid">${fields.map(fieldHtml).join("")}</div>`;
    if (stage === 3) {
      const extras = files.filter((file) => file.doc_type !== "bank_statements");
      body += `<div class="field"><p class="l">${esc(copy.extra)}</p><div class="row"><button class="btn btn-ghost" type="button" id="idBtn">${esc(copy.idDoc)}</button><button class="btn btn-ghost" type="button" id="poaBtn">${esc(copy.poa)}</button></div><input class="hide" id="idFile" type="file" accept="image/*,application/pdf"><input class="hide" id="poaFile" type="file" accept="image/*,application/pdf">${extras.length ? fileList(extras) : ""}</div>`;
    }
  }
  const actions = stage === 1
    ? `<button class="btn btn-primary" type="button" id="next">${esc(copy.continue)}</button>`
    : `<button class="btn btn-ghost" type="button" id="back">${esc(copy.back)}</button><button class="btn btn-ghost" type="button" id="draft">${esc(copy.draft)}</button><button class="btn btn-primary" type="button" id="next">${esc(stage === 3 ? copy.finish : copy.continue)}</button>`;
  app.innerHTML = `${payload.is_test ? `<p class="testbar">${esc(copy.test)}</p>` : ""}<form class="card" id="ff">${`<div class="rail">${rail}</div><h2>${esc(copy.stageTitle[stage - 1])}</h2><p class="sub">${esc(copy.stageBody[stage - 1])}</p>`}${body}<div class="actions">${actions}</div><p class="status" id="status" role="status"></p></form>`;
  bind();
}

function bind() {
  $("photoBtn")?.addEventListener("click", () => $("camera").click());
  $("fileBtn")?.addEventListener("click", () => $("picker").click());
  $("camera")?.addEventListener("change", (event) => uploadFiles(event.target.files, "bank_statements"));
  $("picker")?.addEventListener("change", (event) => uploadFiles(event.target.files, "bank_statements"));
  $("idBtn")?.addEventListener("click", () => $("idFile").click());
  $("poaBtn")?.addEventListener("click", () => $("poaFile").click());
  $("idFile")?.addEventListener("change", (event) => uploadFiles(event.target.files, "id"));
  $("poaFile")?.addEventListener("change", (event) => uploadFiles(event.target.files, "proof_of_address"));
  document.querySelectorAll("[data-amount]").forEach((input) => {
    input.addEventListener("blur", () => {
      const field = questionsFor(payload?.locked).find((item) => item.key === input.id);
      if (!field) return;
      const shown = shownAmount(field, input.value);
      if (shown) input.value = shown;
    });
  });
  $("back")?.addEventListener("click", () => { readForm(); stage = Math.max(1, stage - 1); render(); });
  $("draft")?.addEventListener("click", () => save(false));
  $("next")?.addEventListener("click", async () => {
    if (stage === 1) {
      if (!files.some((file) => file.doc_type === "bank_statements")) {
        const slot = $("e_statements");
        if (slot) slot.textContent = t().needFile;
        return;
      }
      stage = 2;
      render();
      return;
    }
    await save(true);
  });
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function uploadFiles(list, docType) {
  if (!list?.length || busy) return;
  busy = true;
  const status = $("status");
  if (status) status.textContent = t().saving;
  for (const file of list) {
    if (file.size > 3500000) {
      if (status) { status.textContent = t().err.large; status.className = "status bad"; }
      continue;
    }
    const data_base64 = toBase64(await file.arrayBuffer());
    const content_type = file.type === "image/jpg" ? "image/jpeg" : (file.type || "application/pdf");
    const { json } = await api({ action: "upload", token, file_name: file.name, content_type, data_base64, doc_type: docType });
    if (!json.ok) {
      if (status) { status.textContent = t().err[json.error] || t().err.upload; status.className = "status bad"; }
    } else {
      files = json.files || files;
      if (status) { status.textContent = t().saved; status.className = "status ok"; }
    }
  }
  busy = false;
  const keep = status ? status.textContent : "";
  readForm();
  render();
  const again = $("status");
  if (again && keep) { again.textContent = keep; again.className = "status ok"; }
}

async function save(strict) {
  if (busy) return;
  readForm();
  busy = true;
  const status = $("status");
  if (status) status.textContent = t().saving;
  const consent_text = lang === "en" ? CONSENT.en : CONSENT.fr;
  const { json } = await api({ action: "save", token, stage, answers, strict, consent_text, lang });
  busy = false;
  if (!json.ok) {
    showErrors(json.fieldErrors || {});
    if (status) { status.textContent = t().err[json.error] || t().err.save; status.className = "status bad"; }
    return;
  }
  if (json.reference) payload.reference = json.reference;
  if (strict && stage === 3) {
    payload.step = 4;
    done = true;
    render();
    return;
  }
  if (strict && stage === 2) {
    stage = 3;
    render();
    return;
  }
  if (status) { status.textContent = t().saved; status.className = "status ok"; }
}

async function openToken() {
  paintLang();
  $("lang").addEventListener("click", () => setLang(toggleLang(lang)));
  if (!token) { render(); return; }
  render();
  const { json } = await api({ action: "load", token });
  if (!json.ok) {
    $("app").innerHTML = `<div class="card"><p class="status bad">${esc(t().err.save)}</p></div>`;
    return;
  }
  payload = json;
  lang = resolveLang({ stored: lang, saved: json.lang });
  rememberLang();
  answers = formAnswers(json.answers);
  files = json.files || [];
  stage = json.step >= 4 ? 4 : json.step || 1;
  if (stage === 4) done = true;
  else if (stage < 1 || stage > 3) stage = 1;
  paintLang();
  render();
}

openToken();
