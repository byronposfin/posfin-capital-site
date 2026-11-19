import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/fr-staff.js";
import { luhnOk } from "../lib/fr-factfind.js";
import {
  TRAINING_CASES, borrowerPhone, caseLinks, deskOrigin, missingFields, presentCase, sirensAreValid, statementStatus, trainingLoad,
} from "../lib/fr-desk.js";
import { renderFranceList } from "../lib/fr-desk-html.js";

const ORIGIN = "https://posfincapital.com";

test("training cases are fictional, at different stages, with valid SIRENs and placeholder phones", () => {
  assert.equal(TRAINING_CASES.length, 4);
  assert.equal(sirensAreValid(), true);
  assert.equal(new Set(TRAINING_CASES.map((item) => item.stage)).size >= 3, true);
  assert.equal(TRAINING_CASES.filter((item) => item.lender === "ouicap" && statementStatus(item).count === 0).length >= 1, true);
  assert.equal(TRAINING_CASES.some((item) => item.lender === "ulend"), true);
  for (const item of TRAINING_CASES) {
    assert.equal(luhnOk(item.siren), true);
    assert.match(item.email, /@example\.invalid$/);
    assert.match(item.placeholderPhone, /^\+3360000000\d$/);
    assert.equal(item.company.toLowerCase().includes("ltd"), false);
    const links = caseLinks(item, ORIGIN, {});
    assert.equal(links.smartUrl.startsWith("https://posfincapital.com/fr/fact-find?k="), true);
    assert.equal(links.smartUrl.includes("127.0.0.1"), false);
    assert.equal(links.smartUrl.includes("localhost"), false);
    assert.equal(links.whatsappText.includes(links.smartUrl), true);
  }
  const nuages = TRAINING_CASES.find((item) => item.id === "fr-nuages");
  assert.equal(statementStatus(nuages).complete, false);
  assert.equal(missingFields(nuages).some((field) => field.key === "fr.siren"), true);
  const fleurs = TRAINING_CASES.find((item) => item.id === "fr-fleurs");
  assert.equal(statementStatus(fleurs).count, 6);
  assert.deepEqual(missingFields(fleurs).map((field) => field.key), ["home_postcode"]);
  const cartes = TRAINING_CASES.find((item) => item.id === "fr-cartes");
  assert.equal(missingFields(cartes).some((field) => field.key === "factor_rate" && field.tbc), true);
});

test("borrower and agent numbers come from env, never a hard-coded live number", () => {
  const item = TRAINING_CASES[0];
  assert.equal(borrowerPhone(item, {}), "+33600000001");
  assert.equal(borrowerPhone(item, { TEST_BORROWER_WHATSAPP: "+33600000099" }), "+33600000099");
  const shown = presentCase(item, "fr", ORIGIN, { TEST_BORROWER_WHATSAPP: "+33600000099", FR_AGENT_WHATSAPP: "+33600000098" });
  assert.equal(shown.phoneUsed, "+33600000099");
  assert.equal(shown.agentPhone, "+33600000098");
  assert.equal(shown.placeholderPhone, "+33600000001");
  assert.equal(deskOrigin({ PUBLIC_SITE_URL: "https://posfincapital.com" }, "http://127.0.0.1:4173"), "https://posfincapital.com");
});

test("France desk renders both lenders and the FR / EN switch", async () => {
  const cases = TRAINING_CASES.map((item) => presentCase(item, "fr", ORIGIN, {}));
  const html = renderFranceList(cases, "fr");
  assert.match(html, /role="switch"/);
  assert.match(html, /aria-checked="false"/);
  assert.match(html, />FR</);
  assert.match(html, />EN</);
  assert.match(html, /OuiCap/);
  assert.match(html, /ULend/);
  assert.match(html, /TBC/);
  assert.match(html, /Boulangerie des Nuages SAS/);
  assert.equal(html.includes("127.0.0.1"), false);
  const en = renderFranceList(TRAINING_CASES.map((item) => presentCase(item, "en", ORIGIN, {})), "en");
  assert.match(en, /aria-checked="true"/);
  assert.match(en, /New lead/);
  assert.match(en, /Offer/);

  let status = 0;
  let body = "";
  const res = { setHeader() {}, end(s) { body = s; } };
  Object.defineProperty(res, "statusCode", { set(v) { status = v; } });
  await handler({ method: "GET", headers: {}, query: {}, url: "/api/fr-staff" }, res);
  assert.equal(status, 401);
  assert.match(body, /role="switch"/);
  const loaded = trainingLoad("aa11aa11aa11aa11aa11aa11aa11aa11");
  assert.equal(loaded.is_test, true);
  assert.equal(loaded.locked.company_name, "Boulangerie des Nuages SAS");
});
