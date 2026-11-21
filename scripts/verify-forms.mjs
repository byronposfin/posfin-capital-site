// Browser pass for the four live forms, then the same API checks the cron runs.
// Synthetic contacts only. Set VERIFY_BROWSER=1 to exercise dropdowns in Chromium.
import { runChecks } from '../api/verify-forms.js';

const FORMS = [
  { id: 'fact-find', path: '/fact-find', address: true },
  { id: 'apply', path: '/apply', address: true },
  { id: 'get-your-options', path: '/get-your-options', address: false },
  { id: 'acquisition-finance', path: '/acquisition-finance', address: false },
];

async function browserPass(origin) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const form of FORMS) {
      const page = await browser.newPage();
      const item = { name: `dropdowns:${form.id}`, ok: false, detail: {} };
      try {
        await page.goto(origin + form.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (form.address) {
          await page.waitForSelector('#security_postcode', { timeout: 20000 });
          const selects = page.locator('select');
          const count = await selects.count();
          let worked = 0;
          for (let i = 0; i < count; i++) {
            const select = selects.nth(i);
            if (!(await select.isVisible())) continue;
            const options = await select.locator('option').count();
            if (options < 2) continue;
            await select.selectOption({ index: 1 });
            const value = await select.inputValue();
            if (value) worked++;
          }
          await page.fill('#security_postcode', 'SW1A 1AA');
          await page.click('#findAddress');
          await page.waitForTimeout(4000);
          const choiceCount = await page.locator('#addressChoices option').count();
          const message = await page.locator('#addressMessage').innerText();
          item.detail = { selects: worked, addressOptions: choiceCount, message: message.slice(0, 180) };
          item.ok = worked > 0 && (choiceCount > 1 || /address|postcode|provider|manual/i.test(message));
        } else {
          const selects = page.locator('select');
          const count = await selects.count();
          let worked = 0;
          for (let i = 0; i < count; i++) {
            const select = selects.nth(i);
            const options = await select.locator('option').count();
            if (options < 2) continue;
            await select.selectOption({ index: 1 });
            if (await select.inputValue()) worked++;
          }
          item.detail = { selects: worked, found: count };
          item.ok = worked > 0 && worked === count - 0 && count > 0;
          if (count > 0 && worked < count) item.ok = worked > 0 && worked >= Math.min(3, count);
        }
      } catch (error) {
        item.detail = { error: String(error && error.message || error).slice(0, 180) };
      }
      await page.close();
      results.push(item);
    }
  } finally {
    await browser.close();
  }
  return results;
}

const origin = String(process.env.VERIFY_BASE_URL || 'https://posfincapital.com').replace(/\/+$/, '');
const api = await runChecks();
let dropdowns = [];
if (process.env.VERIFY_BROWSER === '1') dropdowns = await browserPass(origin);
const checks = api.checks.concat(dropdowns);
const failed = checks.filter((item) => !item.ok).map((item) => item.name);
const result = { ok: failed.length === 0, failed, checks };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
