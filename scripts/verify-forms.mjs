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
        await page.waitForSelector('select, #findAddress', { state: 'attached', timeout: 20000 });
        const summary = await page.evaluate(() => {
          const formEl = document.querySelector('#ff');
          if (formEl) formEl.removeAttribute('inert');
          document.querySelectorAll('.step').forEach((section) => section.classList.remove('hide'));
          const selects = [...document.querySelectorAll('select')];
          let worked = 0;
          for (const select of selects) {
            if (select.options.length < 2 || select.disabled) continue;
            select.selectedIndex = 1;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            if (select.value) worked++;
          }
          return { found: selects.length, worked };
        });
        item.detail = { ...summary };
        if (form.address) {
          await page.evaluate(() => {
            const postcode = document.querySelector('#security_postcode');
            if (postcode) {
              postcode.value = 'SW1A 1AA';
              postcode.dispatchEvent(new Event('input', { bubbles: true }));
            }
          });
          await page.locator('#findAddress').click({ force: true });
          await page.waitForTimeout(4000);
          const address = await page.evaluate(() => ({
            options: document.querySelectorAll('#addressChoices option').length,
            message: (document.querySelector('#addressMessage') || {}).textContent || '',
          }));
          item.detail.addressOptions = address.options;
          item.detail.message = address.message.slice(0, 180);
          item.ok = summary.worked > 0 && (address.options > 1 || /address|postcode|manual|unavailable/i.test(address.message));
        } else {
          item.ok = summary.found > 0 && summary.worked >= Math.min(3, summary.found);
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
const api = process.env.VERIFY_BROWSER_ONLY === '1' ? { checks: [] } : await runChecks();
let dropdowns = [];
if (process.env.VERIFY_BROWSER === '1') dropdowns = await browserPass(origin);
const checks = api.checks.concat(dropdowns);
const failed = checks.filter((item) => !item.ok).map((item) => item.name);
const result = { ok: failed.length === 0, failed, checks };
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
