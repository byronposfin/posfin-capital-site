/**
 * SmartLink borrower page — /s/:token
 *
 * Serves HTML. Three states:
 *   1. Postcode gate (no session) — postcode input, no personal data shown.
 *   2. Questionnaire — gap engine batch (≤ 6 questions), autosave on blur.
 *   3. Complete — all sections done, summary view.
 *
 * The page talks to /api/case/:token for reads and writes.
 */

import { hashToken, resolveToken, getCase } from '../../lib/supabase.js';
import { verifyPostcode, verifySession, signSession, normalisePostcode } from '../../lib/postcode-gate.js';
import { verifyCode } from '../../lib/verification-code.js';
import { analyseGaps } from '../../lib/gap-engine.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function parseCookies(header) {
  const cookies = {};
  for (const pair of String(header || '').split(';')) {
    const [k, ...v] = pair.trim().split('=');
    if (k) cookies[k.trim()] = v.join('=').trim();
  }
  return cookies;
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/land.css">
<title>${esc(title)}</title>
<meta name="robots" content="noindex,nofollow">
<meta name="description" content="Your case. Your next steps.">
<style>
.sl-gate{max-width:440px;margin:60px auto;text-align:center}
.sl-gate input{text-align:center;font-size:20px;letter-spacing:.15em;max-width:260px;margin:12px auto}
.sl-gate .button{margin-top:16px;width:100%;max-width:260px}
.sl-err{color:#c53030;font-weight:600;margin:10px 0}
.sl-progress{background:#e2e8e7;border-radius:6px;height:8px;margin:18px 0;overflow:hidden}
.sl-progress-bar{background:var(--teal);height:100%;transition:width .3s}
.sl-batch{max-width:700px;margin:auto}
.sl-field{margin:22px 0}
.sl-field label{display:block;font-weight:600;margin-bottom:4px;color:#515868;font-size:14px}
.sl-field-value{font-size:16px;padding:4px 0}
.sl-sections{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
.sl-section-pill{padding:6px 14px;border-radius:16px;font-size:13px;font-weight:600}
.sl-section-pill.complete{background:#e6f7f6;color:#007b78}
.sl-section-pill.in_progress{background:#fff3d9;color:#8c6d00}
.sl-section-pill.not_started{background:#eee;color:#888}
.sl-done{text-align:center;padding:40px 20px}
.sl-done h2{color:#007b78}
</style>
</head><body><nav><img src="/images/social/posfin-og.png" alt="Posfin Capital" width="140"></nav>
<main>${body}</main>
<footer>Posfin Capital Ltd &middot; FCA FRN 913022<br>This is a private link. No personal data is shown in page metadata or search results.</footer>
</body></html>`;
}

function gateHTML(caseId, error) {
  return page('Posfin SmartLink', `
<div class="sl-gate">
  <h1>Verify your identity</h1>
  <p>Enter the postcode of the property on your case to continue.</p>
  ${error ? `<p class="sl-err">${esc(error)}</p>` : ''}
  <form method="GET">
    <div class="field">
      <input type="text" name="postcode" placeholder="e.g. SW1A 1AA" autocomplete="postal-code" required>
    </div>
    <button type="submit" class="button">Continue</button>
  </form>
</div>`);
}

function codeGateHTML(error) {
  return page('Posfin SmartLink — Verify', `
<div class="sl-gate">
  <h1>Enter your verification code</h1>
  <p>We sent a 6-digit code to your phone or email.</p>
  ${error ? `<p class="sl-err">${esc(error)}</p>` : ''}
  <form method="GET">
    <div class="field">
      <input type="text" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000" autocomplete="one-time-code" required>
    </div>
    <button type="submit" class="button">Verify</button>
  </form>
</div>`);
}

// Read-only field display. No inputs, no autosave.
// Autosave UI will be enabled in a future milestone after staging acceptance.
function renderField(f, currentValue) {
  const val = currentValue?.value;
  const display = val === 0 ? '0' : val === false ? 'No' : val === true ? 'Yes'
    : val ? esc(String(val).replace(/_/g, ' ')) : '<span style="color:#8c6d00">To confirm</span>';
  return `<div class="sl-field">
    <label>${esc(f.label)}</label>
    <div class="sl-field-value">${display}</div>
  </div>`;
}

function questionnaireHTML(caseData, gaps, token) {
  const sectionPills = Object.entries(gaps.sections).map(([name, s]) =>
    `<span class="sl-section-pill ${s.status}">${esc(name)} ${s.answered}/${s.total}</span>`
  ).join('');

  const fields = gaps.batch.map(f => renderField(f, caseData.fields?.[f.key])).join('');

  const done = gaps.batch.length === 0 && gaps.remaining === 0;
  if (done) {
    return page('Posfin SmartLink — Complete', `
<div class="sl-done">
  <h2>All questions answered</h2>
  <p>Thank you. Your broker will review your answers and confirm the next steps.</p>
  <p>You can return to this page at any time using your private link.</p>
  <div class="sl-sections">${sectionPills}</div>
</div>`);
  }

  // Read-only view — no autosave script, no form inputs.
  // Autosave UI will be enabled after staging acceptance.
  return page('Posfin SmartLink — Incomplete', `
<div class="sl-batch">
  <p class="eyebrow">YOUR CASE</p>
  <h1>Incomplete borrower journey</h1>
  <p>This case has outstanding questions that need to be completed before it can progress. ${gaps.progress.answered} of ${gaps.progress.total} answered${gaps.remaining > 0 ? ` &middot; ${gaps.remaining} remaining` : ''}.</p>
  <div class="sl-progress"><div class="sl-progress-bar" style="width:${gaps.progress.pct}%"></div></div>
  <div class="sl-sections">${sectionPills}</div>
  ${fields}
  <p style="margin-top:24px;color:#718096">This is a read-only view. Online completion is not yet available. Your broker will contact you to work through these questions.</p>
</div>`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (req.method !== 'GET') return res.status(405).send(page('Error', '<p>Method not allowed.</p>'));

  try {
    const rawToken = String(req.query.token || '');
    if (!rawToken || rawToken.length < 10) return res.status(400).send(page('Error', '<p>Invalid link.</p>'));

    const client = await (await import('../../lib/supabase.js')).supabase();
    const tokenResult = await resolveToken(client, hashToken(rawToken));

    if (!tokenResult) return res.status(404).send(page('Not Found', '<p>This link is not valid. Please contact Posfin.</p>'));
    if (tokenResult.revoked) return res.status(410).send(page('Link Revoked', '<p>This link has been revoked. Please contact Posfin for a new link.</p>'));

    const caseId = tokenResult.case_id;
    const caseData = await getCase(client, caseId);
    if (!caseData) return res.status(404).send(page('Not Found', '<p>Case not found.</p>'));

    // ── Postcode gate ──────────────────────────────────────────────
    const cookies = parseCookies(req.headers.cookie);
    const session = verifySession(cookies.smartlink_session);
    const sessionValid = session?.caseId === caseId;

    if (!sessionValid) {
      const submittedPostcode = req.query.postcode;
      const submittedCode = req.query.code;
      const storedPostcode = caseData.fields?.postcode?.value || caseData.fields?.home_postcode?.value || '';

      if (submittedCode) {
        const codeResult = await verifyCode(client, caseId, submittedCode);
        if (!codeResult.verified) return res.status(403).send(codeGateHTML(codeResult.reason));
        res.setHeader('Set-Cookie', `smartlink_session=${signSession(caseId)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 86400}`);
      } else if (submittedPostcode) {
        const gateResult = await verifyPostcode(client, caseId, submittedPostcode, storedPostcode);
        if (gateResult.locked) return res.status(429).send(page('Locked', '<p>Too many attempts. Try again in 15 minutes, or contact Posfin for a verification code.</p>'));
        if (!gateResult.passed) {
          if (gateResult.needsCode) return res.status(403).send(codeGateHTML());
          return res.status(403).send(gateHTML(caseId, 'Incorrect postcode. Please try again.'));
        }
        res.setHeader('Set-Cookie', `smartlink_session=${signSession(caseId)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 86400}`);
      } else {
        return res.status(403).send(gateHTML(caseId));
      }
    }

    // ── Questionnaire ──────────────────────────────────────────────
    const product = caseData.fields?.product_route?.value || 'main_loan';
    const gaps = analyseGaps(caseData, product);

    return res.status(200).send(questionnaireHTML(caseData, gaps, rawToken));

  } catch (err) {
    console.error('[SmartLink Page]', err.message);
    return res.status(500).send(page('Error', '<p>Unable to load your case. Please try again.</p>'));
  }
}
