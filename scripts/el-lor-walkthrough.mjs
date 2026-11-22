// Local preview walkthrough for the EL/LOR desk.
// Screenshots use TEST fixtures only. Nothing is sent.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || '/tmp/pw/package.json');
const { chromium } = require('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const OUT = process.env.EL_LOR_SHOTS || '/tmp/el-lor-shots';
const PORT = Number(process.env.PORT || 4183);
const SEED_PORT = Number(process.env.SEED_PORT || 8766);
const BASE = `http://127.0.0.1:${PORT}`;

const remote = {
  schema: 'posfin.el-lor-seed/v1',
  cases: [{
    case_ref: 'TEST-REMOTE-005',
    is_test: true,
    label: 'Remote example file',
    stage: 'enquiry',
    db_stage: 'enquiry',
    owner: 'Byron',
    product: 'SOMO',
    email: 'remote.borrower@example.invalid',
    postcode: 'SW1A 2HQ',
    security_label: 'Example remote security',
    broka_case_id: null,
    flags: [],
    lender_exclusions: [],
    eligible_lenders: [{ name: 'Dantis', contact: 'dantis.desk@example.invalid' }],
    signatories: [{ name: 'Remote Example', email: 'remote.borrower@example.invalid', role: 'borrower' }],
    money: { gross: 90000, retentions: 0, net_release: 90000, fee_confirmed: false },
    el: { state: 'none' },
    lor: { state: 'none' },
    blocking_tasks: [],
    next_action: 'Generate EL',
    fact_find_submitted: true,
    opened_at: '2026-11-21T09:00:00.000Z',
  }],
};

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

function startPreview(flag) {
  const child = spawn(process.execPath, ['scripts/cockpit-preview-server.mjs'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      COCKPIT_SOURCE: 'preview',
      COCKPIT_AUTH: 'preview',
      COCKPIT_PREVIEW_PASSWORD: 'preview-desk',
      FEATURE_EL_LOR_DESK: flag,
      EL_LOR_LIVE_SENDS: 'on',
      VERCEL_ENV: 'preview',
      EL_LOR_SEED_JSON_URL: flag === 'on' ? `http://127.0.0.1:${SEED_PORT}/seed.json` : '',
    },
    stdio: 'inherit',
  });
  return child;
}

async function login(page) {
  await page.goto(`${BASE}/staff/cockpit`, { waitUntil: 'domcontentloaded' });
  const password = page.locator('#password');
  if (await password.count()) {
    await password.fill('preview-desk');
    await page.locator('button[type=submit]').click();
  }
  await page.waitForSelector('h1');
}

const results = [];

function record(id, name, pass, file) {
  results.push({ id, name, pass, file });
  if (!pass) throw new Error(`${id} ${name} failed`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await mkdir(OUT, { recursive: true });

const seedServer = createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(remote));
});
await new Promise((resolve) => seedServer.listen(SEED_PORT, '127.0.0.1', resolve));

let preview = startPreview('off');
try {
  await waitFor(`${BASE}/staff/cockpit`);
  await login(page);
  const offHtml = await page.content();
  await page.screenshot({ path: `${OUT}/01-flag-off.png`, fullPage: true });
  record(1, 'flag off', !offHtml.includes('/staff/cockpit/live') && offHtml.includes('Stage-2 spine'), '01-flag-off.png');
} finally {
  preview.kill('SIGTERM');
  await new Promise((resolve) => preview.on('exit', resolve));
}

preview = startPreview('on');
try {
  await waitFor(`${BASE}/staff/cockpit`);
  await login(page);
  await page.goto(`${BASE}/staff/cockpit/live`);
  await page.waitForSelector('[data-case="TEST-EL-SOMO-001"]');
  const listHtml = await page.content();
  await page.screenshot({ path: `${OUT}/02-live-cases.png`, fullPage: true });
  const listed = ['TEST-EL-SOMO-001', 'TEST-LOR-BROKA-002', 'TEST-SIGNED-003', 'TEST-NOAI-004', 'TEST-REMOTE-005']
    .every((ref) => listHtml.includes(`data-case="${ref}"`));
  record(2, 'live cases', listed && listHtml.includes('data-mock="true"'), '02-live-cases.png');
  await page.screenshot({ path: `${OUT}/04-chips.png`, fullPage: true });
  const chips = listHtml.includes('>None<') && listHtml.includes('Pre-LOR v1') && listHtml.includes('Sent v1') && listHtml.includes('Draft v1');
  record(4, 'chips', chips, '04-chips.png');

  let opened = true;
  for (const ref of ['TEST-EL-SOMO-001', 'TEST-LOR-BROKA-002', 'TEST-SIGNED-003', 'TEST-NOAI-004', 'TEST-REMOTE-005']) {
    const response = await page.goto(`${BASE}/staff/cockpit/el/${ref}`);
    opened = opened && response.status() === 200;
  }
  await page.screenshot({ path: `${OUT}/03-case-page.png`, fullPage: true });
  record(3, 'case pages', opened, '03-case-page.png');

  await page.goto(`${BASE}/staff/cockpit/el/TEST-NOAI-004`);
  const noAi = await page.locator('[data-no-ai]').textContent();
  const disabled = await page.locator('button[value="request-esign"]').isDisabled();
  await page.screenshot({ path: `${OUT}/17-no-ai.png`, fullPage: true });
  record(17, 'no ai contact', disabled && noAi.includes('No AI contact: Byron handles'), '17-no-ai.png');

  await page.goto(`${BASE}/staff/cockpit/el/TEST-EL-SOMO-001`);
  await page.screenshot({ path: `${OUT}/10-move-disabled.png`, fullPage: true });
  const blocked = await page.locator('[data-processing="blocked"]').textContent();
  record(10, 'move disabled', /not signed by every signer/.test(blocked || ''), '10-move-disabled.png');

  await page.locator('#inject').fill('CIFAS\nBACS\nArtie');
  await page.locator('button[value="generate-el"]').click();
  await page.waitForSelector('[data-block="marker-c"]');
  const blockedHtml = await page.content();
  await page.screenshot({ path: `${OUT}/06-el-blocked.png`, fullPage: true });
  record(6, 'injected wording blocked', blockedHtml.includes('data-block="marker-c"') && blockedHtml.includes('data-block="payment-rail"') && blockedHtml.includes('data-block="team-name"') && !/\bCIFAS\b|\bBACS\b|\bArtie\b/.test(blockedHtml), '06-el-blocked.png');

  await page.locator('#inject').fill('');
  await page.locator('button[value="generate-el"]').click();
  await page.waitForSelector('text=Engagement letter draft saved');
  const draftHtml = await page.content();
  await page.screenshot({ path: `${OUT}/05-el-draft.png`, fullPage: true });
  record(5, 'generate EL', draftHtml.includes('[FOR BYRON TO CONFIRM]') && draftHtml.includes('Draft v1'), '05-el-draft.png');

  await page.goto(`${BASE}/staff/cockpit/el/TEST-EL-SOMO-001?doc=el`);
  const elHtml = await page.content();
  await page.screenshot({ path: `${OUT}/07-view-el.png`, fullPage: true });
  record(7, 'view EL', elHtml.includes('By signing below') && elHtml.includes('[sig|req|signer1]') && !/internal_private/i.test(elHtml), '07-view-el.png');

  await page.goto(`${BASE}/staff/cockpit/el/TEST-EL-SOMO-001`);
  await page.locator('button[value="request-esign"]').click();
  await page.waitForSelector('[data-approval]');
  await page.locator('select[id^="approve-seat-"]').selectOption('jess');
  await page.locator('button[value="approve"]').click();
  await page.waitForSelector('h1');
  const deniedHtml = await page.content();
  await page.screenshot({ path: `${OUT}/20-owner-403.png`, fullPage: false });
  record(20, 'non-owner 403', deniedHtml.includes('Owner seat required'), '20-owner-403.png');

  await page.goto(`${BASE}/staff/cockpit/el/TEST-EL-SOMO-001`);
  await page.locator('button[value="approve"]').click();
  await page.waitForSelector('text=HL-TEST-');
  const sentHtml = await page.content();
  await page.screenshot({ path: `${OUT}/08-mock-sent.png`, fullPage: true });
  record(8, 'mock e-sign', sentHtml.includes('Sent v1') && sentHtml.includes('HL-TEST-TEST-EL-SOMO-001') && sentHtml.includes('data-mock="true"'), '08-mock-sent.png');

  await page.locator('button[value="simulate-viewed"]').click();
  await page.waitForSelector('text=Viewed status recorded');
  await page.locator('button[value="simulate-signed"]').click();
  await page.waitForSelector('[data-processing="ready"]');
  const signedHtml = await page.content();
  await page.screenshot({ path: `${OUT}/09-signed-paris.png`, fullPage: true });
  record(9, 'viewed then signed', signedHtml.includes('Signed v1') && signedHtml.includes('Europe/Paris') && signedHtml.includes('viewed'), '09-signed-paris.png');
  await page.screenshot({ path: `${OUT}/11-move-enabled.png`, fullPage: false });
  record(11, 'move enabled before click', signedHtml.includes('data-processing="ready"') && signedHtml.includes('EL version 1'), '11-move-enabled.png');
  await page.locator('button[value="move-processing"]').click();
  await page.waitForSelector('[data-processing-task]');
  const movedHtml = await page.content();
  await page.screenshot({ path: `${OUT}/11b-processing.png`, fullPage: true });
  record(11, 'processing written', movedHtml.includes('database application') && movedHtml.includes('Instruct valuation / solicitors: Byron approval needed') && movedHtml.includes('data-audit'), '11b-processing.png');

  await page.goto(`${BASE}/staff/cockpit/el/TEST-LOR-BROKA-002`);
  const stackHtml = await page.content();
  await page.screenshot({ path: `${OUT}/14-broka-stack.png`, fullPage: true });
  const badges = (stackHtml.match(/data-baseline="true"/g) || []).length;
  record(14, 'baseline badges', badges === 4 && stackHtml.includes('TEST-22999') && stackHtml.includes('Submit to BROKA (eligibility check)'), '14-broka-stack.png');
  await page.screenshot({ path: `${OUT}/18-picker.png`, fullPage: false });
  record(18, 'excluded lender hidden', !stackHtml.includes('value="Excluded Lender Ltd"') && !stackHtml.includes('value="MT-12"'), '18-picker.png');
  record(19, 'no internal marker', !/internal_private/i.test(stackHtml) && !/internal_private/i.test(elHtml) && !/internal_private/i.test(listHtml), '19-clean-html.png');
  await page.screenshot({ path: `${OUT}/19-clean-html.png`, fullPage: false });

  await page.locator('#lor-inject').fill('broker fee 2%');
  await page.locator('button[value="generate-lor"]').click();
  await page.waitForSelector('[data-block="fee-wording"]');
  const feeHtml = await page.content();
  await page.screenshot({ path: `${OUT}/13-lor-blocked.png`, fullPage: true });
  record(13, 'fee wording blocked', feeHtml.includes('data-block="fee-wording"') && !/broker fee 2%/i.test(feeHtml), '13-lor-blocked.png');

  await page.locator('#lor-inject').fill('');
  await page.locator('button[value="generate-lor"]').click();
  await page.waitForSelector('text=Lender copy saved');
  await page.goto(`${BASE}/staff/cockpit/el/TEST-LOR-BROKA-002?doc=lor`);
  const lorHtml = await page.content();
  await page.screenshot({ path: `${OUT}/12-view-lor.png`, fullPage: true });
  record(12, 'view LOR', lorHtml.includes('Lender copy') && lorHtml.includes('Faster Payments or CHAPS') && !/internal_private/i.test(lorHtml), '12-view-lor.png');

  await page.goto(`${BASE}/staff/cockpit/el/TEST-LOR-BROKA-002`);
  for (const name of ['Invocap', 'TAB', 'Dantis']) {
    await page.locator(`input[value="${name}"]`).check();
  }
  await page.locator('button[value="request-lor-send"]').click();
  await page.waitForSelector('[data-approval]');
  await page.locator('button[value="approve"]').click();
  await page.waitForSelector('[data-sent-log="TAB"]');
  const sentLor = await page.content();
  await page.screenshot({ path: `${OUT}/15-sent-log.png`, fullPage: true });
  record(15, 'three pending rows', (sentLor.match(/data-sent-log=/g) || []).length === 3 && sentLor.includes('Sent to 3 lenders') && sentLor.includes('UNKNOWN') && sentLor.includes('pending'), '15-sent-log.png');

  await page.locator('select[name="outcome"]').first().selectOption('terms');
  await page.locator('button[value="record-response"]').first().click();
  await page.waitForSelector('text=Response recorded');
  const responded = await page.content();
  await page.screenshot({ path: `${OUT}/16-response.png`, fullPage: true });
  record(16, 'response recorded', responded.includes('>terms<'), '16-response.png');

  await page.goto(`${BASE}/staff/cockpit/live`);
  await page.waitForSelector('[data-case="TEST-REMOTE-005"]');
  const previewHtml = await page.content();
  await page.screenshot({ path: `${OUT}/21-preview-mock.png`, fullPage: true });
  record(21, 'preview stays mock', previewHtml.includes('TEST-REMOTE-005') && previewHtml.includes('Preview sends are mock'), '21-preview-mock.png');
} finally {
  await browser.close();
  preview.kill('SIGTERM');
  seedServer.close();
}

await writeFile(`${OUT}/matrix.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
