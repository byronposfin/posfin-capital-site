// Fixture walkthrough for a staff seat. Screenshots use TEST fixtures only.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/tmp/pw/package.json');
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SEAT_SHOTS || '/tmp/seat-shots';
const PORT = Number(process.env.PORT || 4191);
const BASE = `http://127.0.0.1:${PORT}`;

function startPreview() {
  const env = { ...process.env };
  for (const key of ['FF_ALERT_SERVICE_KEY', 'FF_SUPABASE_KEY', 'FF_SUPABASE_URL', 'PIPELINE_SUPABASE_KEY', 'PIPELINE_SUPABASE_URL']) {
    delete env[key];
  }
  return spawn(process.execPath, ['scripts/cockpit-preview-server.mjs'], {
    cwd: ROOT,
    env: {
      ...env,
      PORT: String(PORT),
      COCKPIT_SOURCE: 'preview',
      COCKPIT_AUTH: 'preview',
      COCKPIT_PREVIEW_PASSWORD: 'preview-desk',
      SEAT_VIEW_SOURCE: 'fixtures',
      VERCEL_ENV: 'preview',
      FEATURE_SEAT_VIEW_CHRIS: 'on',
    },
    stdio: 'inherit',
  });
}

function waitFor(url) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.status) return resolve();
      } catch { /* retry */ }
      if (Date.now() - started > 8000) return reject(new Error(`no server at ${url}`));
      setTimeout(tick, 150);
    };
    tick();
  });
}

async function shot(page, locator, file) {
  await locator.scrollIntoViewIfNeeded();
  await locator.screenshot({ path: join(OUT, file) });
}

const preview = startPreview();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await mkdir(OUT, { recursive: true });
  await waitFor(`${BASE}/staff/cockpit/seat/chris`);
  await page.goto(`${BASE}/staff/cockpit/seat/chris`, { waitUntil: 'domcontentloaded' });
  await page.locator('#password').fill('preview-desk');
  await page.locator('button[type=submit]').click();
  await page.waitForSelector('#raw-leads');
  const html = await page.content();
  if (!html.includes('example.invalid') || /broker_fee|Example Harbour|@gmail\.com/i.test(html)) {
    throw new Error('fixture page failed the synthetic-data check');
  }
  const filter = await page.locator('form.filter-card').boundingBox();
  const leads = await page.locator('#raw-leads').boundingBox();
  await page.screenshot({
    path: join(OUT, '01-raw-leads.png'),
    clip: { x: 0, y: Math.max(0, filter.y - 8), width: 1280, height: leads.y + leads.height - filter.y + 16 },
  });
  await shot(page, page.locator('#completed-fact-finds'), '02-completed-fact-finds.png');
  await shot(page, page.locator('#live-cases'), '03-live-cases.png');

  const caseTask = page.locator('[data-task="chris:case:TEST-SEAT-001:2026-11-22"]');
  await caseTask.locator('select[name="actor"]').selectOption('Byron Hill');
  await caseTask.locator('button[value="yes"]').click();
  await page.waitForSelector('[data-task="chris:case:TEST-SEAT-001:2026-11-22"][data-answer="yes"]');

  const leadTask = page.locator('[data-task="chris:lead:lead-not-started:2026-11-22"]');
  await leadTask.locator('button[value="no"]').click();
  await page.waitForSelector('[data-task="chris:lead:lead-not-started:2026-11-22"][data-answer="no"]');

  const editTask = page.locator('[data-task="chris:case:TEST-SEAT-003:2026-11-22"]');
  await editTask.locator('button[value="edit"]').click();
  await page.locator('textarea[name="edited_text"]').fill('Ring the example office');
  await page.locator('button[value="save-edit"]').click();
  await page.waitForSelector('[data-task="chris:case:TEST-SEAT-003:2026-11-22"][data-answer="edit"]');
  await shot(page, page.locator('#daily-tasks'), '04-daily-tasks.png');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-answer="yes"]');
  await page.waitForSelector('[data-answer="no"]');
  await page.waitForSelector('text=Ring the example office');

  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, page.locator('#daily-tasks'), '05-daily-tasks-mobile.png');
  console.log('seat walkthrough ok');
} finally {
  await browser.close();
  preview.kill('SIGTERM');
}
