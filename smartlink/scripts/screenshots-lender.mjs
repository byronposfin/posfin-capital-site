// Lender criteria screenshots → ./screenshots/lender_*. Usage: BASE=http://localhost:3100 node scripts/screenshots-lender.mjs
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
rmSync(new URL("../data/lender", import.meta.url).pathname, { recursive: true, force: true });

const browser = await chromium.launch();
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1.5 };
async function shot(page, name, opts = {}) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log("✓", name);
}

// Summary + exports first (pristine demo answers)
{
  const ctx = await browser.newContext(desktop);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/lender/demo/summary`);
  await shot(p, "lender_summary_desktop", { fullPage: true });
  await ctx.close();
  const m = await browser.newContext(mobile);
  const mp = await m.newPage();
  await mp.goto(`${BASE}/lender/demo/summary`);
  await shot(mp, "lender_summary_mobile");
  await m.close();
  for (const [q, name] of [["", "lender_summary"], ["?brand=unbranded", "lender_summary_unbranded"]]) {
    const r = await fetch(`${BASE}/api/forms/lender/demo/pdf${q}`);
    writeFileSync(`${OUT}${name}.pdf`, Buffer.from(await r.arrayBuffer()));
    execFileSync("pdftoppm", ["-png", "-r", "110", "-f", "1", "-l", "1", "-singlefile", `${OUT}${name}.pdf`, `${OUT}${name}_pdf_page1`]);
    execFileSync("pdftoppm", ["-png", "-r", "110", "-f", "2", "-l", "2", "-singlefile", `${OUT}${name}.pdf`, `${OUT}${name}_pdf_page2`]);
  }
  writeFileSync(`${OUT}lender_summary.xlsx`, Buffer.from(await (await fetch(`${BASE}/api/forms/lender/demo/xlsx`)).arrayBuffer()));
  writeFileSync(`${OUT}lender_placed_export.json`, JSON.stringify(await (await fetch(`${BASE}/api/forms/lender/demo/export`)).json(), null, 2));
  console.log("✓ pdf/xlsx/json");
}

// Mobile flow — blank lender (what a new lender sees)
{
  const ctx = await browser.newContext(mobile);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/lender/demo-blank`);
  await shot(p, "lender_m0_intro");
  await p.getByRole("button", { name: "Start" }).click();
  await shot(p, "lender_m1_about");
  await p.goto(`${BASE}/lender/demo-blank?step=guide`);
  await shot(p, "lender_m2_guide_upload");
  await p.goto(`${BASE}/lender/demo-blank?step=legals`);
  await shot(p, "lender_m9_legals_blank", { fullPage: true });
  await p.goto(`${BASE}/lender/demo-blank?brand=unbranded`);
  await shot(p, "lender_m0_intro_unbranded");
  await ctx.close();
}

// Mobile flow — filled fictional lender
{
  const ctx = await browser.newContext(mobile);
  const p = await ctx.newPage();
  const at = async (step, name, opts) => { await p.goto(`${BASE}/lender/demo?step=${step}`); await shot(p, name, opts); };
  await at("core", "lender_m3_core_products");
  await at("core", "lender_m3_core_products_full", { fullPage: true });
  await at("prod_bridge_resi", "lender_m4_product_card");
  await p.evaluate(() => document.querySelector('[data-field="p_bridge_resi_term_min"]')?.scrollIntoView({ block: "start" }));
  await shot(p, "lender_m4b_term_early_repayment");
  await p.evaluate(() => document.querySelector('[data-field="p_bridge_resi_roll_offered"]')?.scrollIntoView({ block: "start" }));
  await shot(p, "lender_m4c_rollovers");
  await at("prod_bridge_resi", "lender_m4_product_card_full", { fullPage: true });
  await at("prod_mezz", "lender_m4d_mezz_card");
  await at("assets", "lender_m5_asset_appetite");
  await at("hair1", "lender_m6_hair_credit");
  await at("hair2", "lender_m7_hair_people", { fullPage: true });
  await at("valuation", "lender_m8_valuation");
  await at("legals", "lender_m9_legals");
  await at("readback", "lender_m10_readback");
  await at("readback", "lender_m10_readback_full", { fullPage: true });
  await at("cases1", "lender_m11_case_studies");
  await at("cases2", "lender_m11b_case_rollover", { fullPage: true });
  await at("partnership", "lender_m12_partnership");
  await at("partnership", "lender_m12_partnership_full", { fullPage: true });
  await at("feedback", "lender_m13_feedback");
  await at("review", "lender_m14_review");
  await ctx.close();
}
await browser.close();
