// Captures review screenshots into ./screenshots. Usage: BASE=http://localhost:3100 node scripts/screenshots.mjs
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
for (const f of ["al", "remortgage", "works"]) rmSync(new URL(`../data/${f}`, import.meta.url).pathname, { recursive: true, force: true });

const browser = await chromium.launch();
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5 };

async function shot(page, name, opts = {}) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log("✓", name);
}
const cont = (p) => p.getByRole("button", { name: "Continue", exact: true }).click();

// --- Statements & exports (before any flow edits the demo drafts)
{
  const ctx = await browser.newContext(desktop);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/al/demo/statement`);
  await shot(p, "al_statement_desktop", { fullPage: true });
  await p.goto(`${BASE}/works/demo/statement?brand=posfin`);
  await shot(p, "works_statement_posfin_desktop", { fullPage: true });
  await p.goto(`${BASE}/works/demo/statement?brand=unbranded`);
  await shot(p, "works_statement_unbranded_desktop", { fullPage: true });
  await p.goto(`${BASE}/remortgage/demo/summary?brand=ackroyds`);
  await shot(p, "remortgage_summary_ackroyds_desktop", { fullPage: true });
  await ctx.close();
  const m = await browser.newContext(mobile);
  const mp = await m.newPage();
  await mp.goto(`${BASE}/al/demo/statement`);
  await shot(mp, "al_statement_mobile", { fullPage: true });
  await mp.goto(`${BASE}/remortgage/demo/summary?brand=general`);
  await shot(mp, "remortgage_summary_general_mobile");
  await m.close();
  for (const [form, q, name] of [["al", "", "al_statement"], ["works", "?brand=posfin", "works_statement_posfin"], ["works", "?brand=unbranded", "works_statement_unbranded"]]) {
    const r = await fetch(`${BASE}/api/forms/${form}/demo/pdf${q}`);
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(`${OUT}${name}.pdf`, buf);
    execFileSync("pdftoppm", ["-png", "-r", "110", "-f", "1", "-l", "1", "-singlefile", `${OUT}${name}.pdf`, `${OUT}${name}_pdf_page1`]);
    const x = await fetch(`${BASE}/api/forms/${form}/demo/xlsx${q}`);
    writeFileSync(`${OUT}${name}.xlsx`, Buffer.from(await x.arrayBuffer()));
    console.log("✓", name, "pdf/xlsx");
  }
}

// --- A&L mobile flow
{
  const ctx = await browser.newContext(mobile);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/al/demo`);
  await shot(p, "al_m0_intro");
  await p.getByRole("button", { name: "Start" }).click();
  await shot(p, "al_m1_about_you");
  await cont(p);
  await p.locator("[data-item=p2] header button").first().click();
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector("[data-item=p2]")?.scrollIntoView({ block: "start" }));
  await shot(p, "al_m2_properties");
  await shot(p, "al_m2_properties_full", { fullPage: true });
  await cont(p);
  await shot(p, "al_m3_other_assets");
  await cont(p);
  await shot(p, "al_m4_liabilities");
  await cont(p);
  await p.locator("#decl-name").fill("Jordan Example");
  await p.getByRole("checkbox", { name: /I confirm the information/ }).click();
  await shot(p, "al_m5_review");
  await shot(p, "al_m5_review_full", { fullPage: true });
  await ctx.close();
}
// £10k friendly enforcement on a blank case
{
  const ctx = await browser.newContext(mobile);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/al/demo-blank?step=liabilities`);
  const cc = p.locator('[data-field="grouped_credit_cards"] input');
  await cc.click();
  await p.keyboard.type("12500");
  await p.evaluate(() => document.querySelector('[data-field="grouped_credit_cards"]')?.scrollIntoView({ block: "start" }));
  await shot(p, "al_m4b_over_10k_rule");
  await p.getByRole("button", { name: /List it individually/ }).click();
  await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector("[data-item]")?.scrollIntoView({ block: "start" }));
  await shot(p, "al_m4c_itemised_card");
  await ctx.close();
}

// --- Remortgage
for (const brand of ["general", "ackroyds"]) {
  rmSync(new URL(`../data/remortgage`, import.meta.url).pathname, { recursive: true, force: true });
  const ctx = await browser.newContext(mobile);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/remortgage/demo?brand=${brand}`);
  await shot(p, `remortgage_${brand}_m0_first_screen`);
  await p.getByRole("button", { name: "Start" }).click();
  await shot(p, `remortgage_${brand}_m1_about_you`);
  await p.goto(`${BASE}/remortgage/demo?brand=${brand}&step=title_insurance`);
  await shot(p, `remortgage_${brand}_title_insurance`);
  if (brand === "ackroyds") {
    await shot(p, `remortgage_${brand}_title_insurance_full`, { fullPage: true });
    await p.goto(`${BASE}/remortgage/demo?brand=${brand}&step=nominated_account`);
    await shot(p, `remortgage_${brand}_nominated_account`);
    await p.goto(`${BASE}/remortgage/demo?brand=${brand}&step=how_you_found_us`);
    await shot(p, `remortgage_${brand}_q21_how_heard`);
  }
  await ctx.close();
}

// --- Schedule of works
for (const brand of ["posfin", "unbranded"]) {
  rmSync(new URL(`../data/works`, import.meta.url).pathname, { recursive: true, force: true });
  const ctx = await browser.newContext(mobile);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/works/demo?brand=${brand}`);
  await shot(p, `works_${brand}_m0_intro`);
  await p.getByRole("button", { name: "Start" }).click();
  await shot(p, `works_${brand}_m1_project`);
  if (brand === "posfin") {
    await cont(p);
    await shot(p, "works_posfin_m2_consents");
    await cont(p);
    await p.locator("[data-item=w5] header button").first().click();
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector("[data-item=w5]")?.scrollIntoView({ block: "start" }));
    await shot(p, "works_posfin_m3_lines");
    await p.evaluate(() => document.querySelector('[aria-label="Live totals"]')?.scrollIntoView({ block: "center" }));
    await shot(p, "works_posfin_m3b_totals");
    await cont(p);
    await cont(p);
    await shot(p, "works_posfin_m5_review");
  }
  await ctx.close();
}
await browser.close();
for (const f of ["al", "remortgage", "works"]) rmSync(new URL(`../data/${f}`, import.meta.url).pathname, { recursive: true, force: true });
