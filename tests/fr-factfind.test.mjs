import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/fr-factfind.js";
import {
  FIELDS, LOCKED_KEYS, applyLocked, buildStaffView, buildWhatsApp, formatMoney, formatNumber, langStorageKey, langSwitchState, luhnOk, normaliseFrPhone,
  parseFrAmount, parsePostcode, parseRegistration, prefillFromLead, questionsFor, resolveLang, toggleLang, validateStage, whatsappMessage,
} from "../lib/fr-factfind.js";

const NOW = new Date("2026-11-19T12:00:00Z");
const SIREN = "123456782";
const SIRET = "12345678200010";

test("SIREN and SIRET use the Luhn check and ignore spaces", () => {
  assert.equal(luhnOk(SIREN), true);
  assert.equal(luhnOk(SIRET), true);
  assert.equal(luhnOk("123456780"), false);
  assert.deepEqual(parseRegistration("123 456 782"), { ok: true, siren: SIREN, siret: null });
  assert.deepEqual(parseRegistration("12345678200010"), { ok: true, siren: SIREN, siret: SIRET });
  assert.equal(parseRegistration("12345678200011").ok, false);
  assert.equal(parseRegistration("12345678").ok, false);
  assert.equal(parseRegistration("AB1234567").ok, false);
});

test("French phone numbers and five-digit postcodes", () => {
  assert.equal(normaliseFrPhone("06 01 02 03 04"), "+33601020304");
  assert.equal(normaliseFrPhone("+33 6 01 02 03 04"), "+33601020304");
  assert.equal(normaliseFrPhone("0033601020304"), "+33601020304");
  assert.equal(normaliseFrPhone("01 42 68 53 00"), "+33142685300");
  assert.equal(normaliseFrPhone("+44 7700 900123"), null);
  assert.equal(normaliseFrPhone("12345"), null);
  assert.equal(parsePostcode("75008"), "75008");
  assert.equal(parsePostcode("7500"), null);
  assert.equal(parsePostcode("SW1A 1AA"), null);
});

test("known enquiry details are prefilled and not asked again", () => {
  const prefill = prefillFromLead({
    full_name: "Vanessa Test",
    email: "vanessa.test@example.invalid",
    phone: "06 01 02 03 04",
    company_name: "Vanessa Test SAS",
    raw_answers: { _is_test: true, first_name: "Vanessa", last_name: "Test" },
  });
  assert.deepEqual(prefill.locked, {
    first_name: "Vanessa",
    last_name: "Test",
    email: "vanessa.test@example.invalid",
    mobile: "+33601020304",
    company_name: "Vanessa Test SAS",
  });
  assert.equal(prefill.is_test, true);
  const asked = questionsFor(prefill.locked).map((field) => field.key);
  for (const key of LOCKED_KEYS) assert.equal(asked.includes(key), false, key);
  assert.equal(FIELDS.filter((field) => field.stage === 1).length, 0);
  assert.equal(asked.includes("trading_name"), true);
  assert.equal(asked.includes("registration"), true);
  assert.equal(asked.includes("date_of_birth"), true);
  assert.equal(asked.includes("home_postcode"), true);
  assert.equal(asked.includes("ownership_pct"), true);
  assert.equal(asked.includes("ownership_start_date"), true);
  const cleaned = applyLocked({ company_name: "Changed", first_name: "Nope", "fr.siren": SIREN }, prefill.locked);
  assert.equal(cleaned.company_name, undefined);
  assert.equal(cleaned.first_name, undefined);
  assert.equal(cleaned["fr.siren"], SIREN);
});

test("stage validation accepts French legal forms, comma amounts and rejects a child date of birth", () => {
  const locked = { company_name: "Vanessa Test SAS" };
  const stage2 = validateStage(2, {
    registration: "123 456 782 00010",
    legal_form: "SAS",
    business_phone: "01 42 68 53 00",
    business_street: "58 Rue de Monceau",
    business_town: "Paris",
    business_postcode: "75008",
    ownership_start_date: "01/03/2020",
    purpose: "Trésorerie",
    monthly_revenue_eur: "12 000,50",
    loan_amount: "25000",
    trading_name: "Oui Test",
  }, { strict: true, hasStatements: true, locked, now: NOW });
  assert.deepEqual(stage2.errors, {});
  assert.equal(stage2.clean["fr.siren"], SIREN);
  assert.equal(stage2.clean["fr.siret"], SIRET);
  assert.equal(stage2.clean["fr.legal_form"], "SAS");
  assert.equal(stage2.clean.monthly_revenue_eur, 12000.5);
  assert.equal(typeof stage2.clean.monthly_revenue_eur, "number");
  assert.equal(typeof stage2.clean.loan_amount, "number");
  assert.equal(stage2.clean.currency, "EUR");
  assert.equal(stage2.clean.referrer, "OuiCap");
  const tooYoung = validateStage(3, { date_of_birth: "2015-01-01", role: "Gérant", ownership_pct: "50,5", home_street: "1 rue", home_town: "Lyon", home_postcode: "69001", phone_landline: "04 72 00 00 00", consent: true }, { strict: true, hasStatements: true, locked, now: NOW });
  assert.equal(tooYoung.errors.date_of_birth, "dob");
  const llc = validateStage(2, { legal_form: "LLC" }, { strict: false, locked, now: NOW });
  assert.equal(llc.errors.legal_form, "select");
});

test("French amounts use a narrow space, a comma and a trailing euro; English keeps 12,000", () => {
  const frWhole = formatMoney(12000, "fr");
  const frNear = formatMoney(12050, "fr");
  const frCents = formatMoney(25000.5, "fr");
  assert.equal(frWhole, `12\u202f000\u00a0€`);
  assert.equal(frNear, `12\u202f050\u00a0€`);
  assert.equal(frCents, `25\u202f000,50\u00a0€`);
  assert.equal(formatMoney(12000, "en"), "€12,000");
  assert.equal(formatMoney(25000.5, "en"), "€25,000.50");
  assert.equal(formatNumber(50.5, "fr"), "50,5");
  assert.equal(formatNumber(50.5, "en"), "50.5");
  for (const typed of ["12 000", "12\u202f000", "12\u00a0000", "12 000 €", "12 000,00 €", "12000", "12,000", "12.000"]) {
    assert.equal(parseFrAmount(typed), 12000, typed);
  }
  assert.equal(parseFrAmount("25 000,50 €"), 25000.5);
  assert.equal(parseFrAmount("25,000.50"), 25000.5);
  assert.equal(parseFrAmount("25.000,50"), 25000.5);
  assert.equal(parseFrAmount("12000.50"), 12000.5);
  const saved = validateStage(2, { loan_amount: frCents, monthly_revenue_eur: "12 050 €" }, { strict: false, locked: { company_name: "Vanessa Test SAS" }, now: NOW });
  assert.equal(saved.clean.loan_amount, 25000.5);
  assert.equal(saved.clean.monthly_revenue_eur, 12050);
  assert.equal(typeof saved.clean.loan_amount, "number");
});

test("WhatsApp link is click-to-chat only and uses the French welcome", () => {
  const smartUrl = "https://preview.example/fr/fact-find?k=abcdefghijklmnopqrstuvwxyz12";
  const text = whatsappMessage("Vanessa", smartUrl);
  assert.equal(text, "Bonjour Vanessa, bienvenue chez Posfin France ! Pour avancer sur votre demande, merci de nous envoyer vos 6 derniers relevés bancaires professionnels via ce lien sécurisé : https://preview.example/fr/fact-find?k=abcdefghijklmnopqrstuvwxyz12");
  const link = buildWhatsApp({ phone: "+33601020304", firstName: "Vanessa", smartUrl });
  assert.equal(link.ok, true);
  assert.equal(link.url.startsWith("https://wa.me/33601020304?text="), true);
  assert.equal(decodeURIComponent(link.url.split("text=")[1]), text);
  assert.equal(buildWhatsApp({ phone: "+33142685300", firstName: "Vanessa", smartUrl }).ok, false);
  const view = buildStaffView({ firstName: "Vanessa", phone: "06 01 02 03 04", token: "abcdefghijklmnopqrstuvwxyz12", origin: "https://preview.example" });
  assert.equal(view.smart_url, smartUrl);
  assert.equal(view.whatsapp_url, link.url);
});

test("FR / EN switch defaults to French and toggles both ways", () => {
  assert.equal(resolveLang({}), "fr");
  assert.equal(resolveLang({ stored: "en" }), "en");
  assert.equal(resolveLang({ stored: "en", saved: "fr" }), "fr");
  assert.equal(toggleLang("fr"), "en");
  assert.equal(toggleLang("en"), "fr");
  assert.equal(toggleLang(toggleLang("fr")), "fr");
  const fr = langSwitchState("fr");
  const en = langSwitchState("en");
  assert.equal(fr.active, "FR");
  assert.equal(fr.ariaChecked, false);
  assert.equal(en.active, "EN");
  assert.equal(en.ariaChecked, true);
  assert.equal(langStorageKey("36c9eced1f3e7bc145974f73dafe61ec8524"), "posfin_fr_lang:36c9eced1f3e7bc145974f73dafe61ec8524");
});

test("staff lookup does not send the server admin token unless the caller supplied it", async () => {
  const saved = { ...process.env };
  Object.assign(process.env, {
    FR_SUPABASE_URL: "http://127.0.0.1:9999",
    FR_SUPABASE_KEY: "anon-test",
    FR_FACTFIND_ADMIN_TOKEN: "staff-secret",
  });
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({ ok: false, error: "not_found" }) };
  };
  try {
    let out;
    const res = { setHeader() {}, end(s) { out = JSON.parse(s); } };
    await handler({
      method: "POST",
      headers: { host: "preview.example", "x-forwarded-proto": "https" },
      body: { action: "staff", lead_id: "11111111-1111-4111-8111-111111111111" },
    }, res);
    assert.equal(out.ok, false);
    assert.equal(calls[0].p_admin_secret, "");
    assert.notEqual(calls[0].p_admin_secret, "staff-secret");
  } finally {
    globalThis.fetch = original;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("mint requires the admin token, prefills the lead, and never calls WhatsApp", async () => {
  const saved = { ...process.env };
  Object.assign(process.env, {
    FR_SUPABASE_URL: "http://127.0.0.1:9999",
    FR_SUPABASE_KEY: "anon-test",
    FR_FACTFIND_ADMIN_TOKEN: "staff-secret",
  });
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), body: JSON.parse(opts.body) });
    const fn = String(url).split("/").pop();
    if (fn === "fr_factfind_mint") {
      return { ok: true, json: async () => ({ ok: true, lead_id: "11111111-1111-4111-8111-111111111111", full_name: "Vanessa Test", company_name: "Vanessa Test SAS", first_name: "Vanessa", phone: "+33601020304", is_test: true, email: "vanessa.test@example.invalid", source: "fr_factfind_test" }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const run = async (headers, body) => {
    let out;
    const res = { setHeader() {}, end(s) { out = JSON.parse(s); } };
    await handler({ method: "POST", headers, body }, res);
    return { code: res.statusCode, ...out };
  };
  try {
    const denied = await run({ host: "preview.example", "x-forwarded-proto": "https" }, { action: "mint", lead_id: "11111111-1111-4111-8111-111111111111" });
    assert.equal(denied.code, 401);
    assert.equal(calls.length, 0);
    const minted = await run(
      { host: "preview.example", "x-forwarded-proto": "https", "x-fr-admin-token": "staff-secret" },
      { action: "mint", lead_id: "11111111-1111-4111-8111-111111111111" },
    );
    assert.equal(minted.ok, true);
    assert.equal(minted.sends_message, false);
    assert.equal(minted.full_name, "Vanessa Test");
    assert.match(minted.smart_url, /^https:\/\/preview\.example\/fr\/fact-find\?k=/);
    assert.match(minted.whatsapp_url, /^https:\/\/wa\.me\/33601020304\?text=/);
    assert.match(decodeURIComponent(minted.whatsapp_url.split("text=")[1]), /Bonjour Vanessa, bienvenue chez Posfin France !/);
    assert.equal(calls.every((call) => call.url.startsWith("http://127.0.0.1:9999/rest/v1/rpc/")), true);
    assert.equal(calls.some((call) => /wa\.me|whatsapp|twilio|graph\.facebook|lender/i.test(call.url)), false);
    assert.equal(calls[0].body.p_admin_secret, "staff-secret");
    assert.equal(calls[0].body.p_lead_id, "11111111-1111-4111-8111-111111111111");
  } finally {
    globalThis.fetch = original;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
