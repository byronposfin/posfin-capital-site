/**
 * Posfin Capital — Introducer Registration API
 * POST /api/introducer
 *
 * Flow:
 * 1. Save introducer details to Google Sheets ("Introducers" tab)
 * 2. Generate Introducer Agreement PDF via DocuSign template
 * 3. Send DocuSign envelope to introducer for e-signature
 * 4. Alert Byron via Telegram
 * 5. Return signing URL
 */

import { google } from 'googleapis';
import docusign from 'docusign-esign';
import { SignJWT } from 'jose';
import crypto from 'crypto';

const SHEET_ID   = '1aqFwX7GabZRLPE3H4cb6OiFYeOmbxms5oKX05HhZksQ';
const DS_INTEGRATION_KEY = '87b0a588-6156-418c-8f2e-a01de79c3d9a';
const DS_ACCOUNT_ID      = '4276c59c-df78-46b3-8814-a930b0a29a37';
const DS_USER_ID         = process.env.DS_USER_ID || '';
const DS_BASE_URL        = 'https://eu.docusign.net/restapi';
const TELE_TOKEN         = process.env.TELEGRAM_BOT_TOKEN || '';
const BYRON_CHAT_ID      = '1750758657';
const BASE_URL           = process.env.NEXT_PUBLIC_BASE_URL || 'https://posfincapital.com';

// ── Helpers ────────────────────────────────────────────────────────────────
function genRef() {
  const d = new Date();
  return `PCL/INT/${d.getFullYear().toString().slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

function today() {
  return new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
}

// ── DocuSign JWT Auth ──────────────────────────────────────────────────────
async function getDSToken() {
  const privateKey = Buffer.from(process.env.DS_PRIVATE_KEY_B64 || '', 'base64').toString('utf8');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: DS_INTEGRATION_KEY,
    sub: DS_USER_ID,
    aud: 'account-d.docusign.com',
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  };
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256' })
    .sign(crypto.createPrivateKey(privateKey));

  const res = await fetch('https://account-d.docusign.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`,
  });
  const data = await res.json();
  return data.access_token;
}

// ── Build Introducer Agreement HTML → DocuSign ─────────────────────────────
function buildAgreementHTML(d) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;font-size:12px;color:#1A1A2E;padding:40px;max-width:700px;">
<div style="text-align:center;margin-bottom:32px;">
<img src="https://posfincapital.com/logo.png" style="height:48px;" alt="Posfin Capital"/>
<h1 style="font-size:18px;color:#1C184F;margin:16px 0 4px;">POSFIN CAPITAL LIMITED</h1>
<h2 style="font-size:14px;color:#1C184F;margin:0;font-weight:normal;">MASTER INTRODUCER AGREEMENT</h2>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:11px;">
<tr><td style="padding:6px 12px;background:#F5F5F5;border:1px solid #E0E0E0;font-weight:700;width:30%;">Date</td><td style="padding:6px 12px;border:1px solid #E0E0E0;">${today()}</td></tr>
<tr><td style="padding:6px 12px;background:#F5F5F5;border:1px solid #E0E0E0;font-weight:700;">Reference</td><td style="padding:6px 12px;border:1px solid #E0E0E0;">${d.ref}</td></tr>
</table>
<p style="font-size:11px;color:#666;margin-bottom:20px;"><strong>BETWEEN:</strong></p>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:11px;">
<tr><td style="padding:8px 12px;background:#1C184F;color:#fff;font-weight:700;" colspan="2">POSFIN CAPITAL LIMITED ("The Company")</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #E0E0E0;background:#F9F9F9;width:35%;">Company No.</td><td style="padding:6px 12px;border:1px solid #E0E0E0;">12148846</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #E0E0E0;background:#F9F9F9;">Trading Address</td><td style="padding:6px 12px;border:1px solid #E0E0E0;">96 Kensington High Street, London W8 4SG</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #E0E0E0;background:#F9F9F9;">FCA FRN</td><td style="padding:6px 12px;border:1px solid #E0E0E0;">913022</td></tr>
</table>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;font-size:11px;">
<tr><td style="padding:8px 12px;background:#00B5B0;color:#fff;font-weight:700;" colspan="2">${d.company || d.full_name} ("The Introducer")</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #E0E0E0;background:#F9F9F9;width:35%;">Name</td><td style="padding:6px 12px;border:1px solid #E0E0E0;">${d.full_name}</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #E0E0E0;background:#F9F9F9;">Company / Trading As</td><td style="padding:6px 12px;border:1px solid #E0E0E0;">${d.company || 'Individual'}</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #E0E0E0;background:#F9F9F9;">Email</td><td style="padding:6px 12px;border:1px solid #E0E0E0;">${d.email}</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #E0E0E0;background:#F9F9F9;">Mobile</td><td style="padding:6px 12px;border:1px solid #E0E0E0;">${d.mobile}</td></tr>
<tr><td style="padding:6px 12px;border:1px solid #E0E0E0;background:#F9F9F9;">FCA Status</td><td style="padding:6px 12px;border:1px solid #E0E0E0;">${d.fca_status}</td></tr>
</table>
<h3 style="font-size:13px;color:#1C184F;border-bottom:2px solid #1C184F;padding-bottom:6px;margin-bottom:16px;">1. APPOINTMENT &amp; SCOPE</h3>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:8px;"><strong>1.1</strong> The Company appoints the Introducer as a non-exclusive referral partner.</p>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:8px;"><strong>1.2</strong> The Introducer shall refer potential Borrowers seeking Property Finance (including Bridging Finance, Development Finance, and Commercial Mortgages).</p>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:16px;"><strong>1.3</strong> The Introducer acknowledges that the Company acts as a Principal Brokerage and may fund the loan directly or broker to third-party institutions at its sole discretion.</p>
<h3 style="font-size:13px;color:#1C184F;border-bottom:2px solid #1C184F;padding-bottom:6px;margin-bottom:16px;">2. HAND-OFF PROTOCOL (Strict Liability)</h3>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:8px;"><strong>2.1 Introduction Only:</strong> The Introducer's role is strictly limited to passing the Name, Contact Details, and Loan Requirement to the Company.</p>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:8px;"><strong>2.2 No Advice (Regulatory Firewall):</strong> The Introducer warrants they have not and will not provide advice on loan products, complete fact-finds, or assess suitability — especially for Regulated Mortgage Contracts. This ensures the Introducer operates under the FCA "Mere Introducer" exclusion.</p>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:16px;"><strong>2.3 Total Control:</strong> Once the introduction is made, the Company assumes full control of the client journey, compliance, and underwriting.</p>
<h3 style="font-size:13px;color:#1C184F;border-bottom:2px solid #1C184F;padding-bottom:6px;margin-bottom:16px;">3. REMUNERATION (Percentage Yield — 25% of Total GP)</h3>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:8px;"><strong>3.1 Referral Fee:</strong> The Company shall pay the Introducer a fixed fee of <strong>25% of Posfin Capital's total Gross Profit on the funded case (comprising broker fee, proc fee, and success fee where applicable)</strong> per completed loan case. No VAT applicable.</p>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:8px;"><strong>3.2 Payment Trigger:</strong> The Fee is payable strictly upon Net Drawdown (completion) of the loan facility.</p>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:16px;"><strong>3.3 Invoicing:</strong> The Introducer shall submit an invoice to Posfin Capital Limited upon confirmation of completion.</p>
<h3 style="font-size:13px;color:#1C184F;border-bottom:2px solid #1C184F;padding-bottom:6px;margin-bottom:16px;">4. CAPITAL PROTECTION (Clawback)</h3>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:16px;"><strong>4.1 The 90-Day Rule:</strong> If the Borrower defaults, enters arrears, or is subject to enforcement action within 90 Days of Drawdown, 100% of the Referral Fee shall be repayable by the Introducer within 7 days of demand.</p>
<h3 style="font-size:13px;color:#1C184F;border-bottom:2px solid #1C184F;padding-bottom:6px;margin-bottom:16px;">5. NON-CIRCUMVENTION &amp; OWNERSHIP</h3>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:8px;"><strong>5.1</strong> Once an Introduction is made, the Borrower is deemed a client of the Company for all future business.</p>
<p style="font-size:11px;line-height:1.8;color:#333;margin-bottom:28px;"><strong>5.2</strong> If the Borrower returns within 24 months, no further Referral Fee is payable.</p>
<div style="background:#F5F5F5;border:1px solid #E0E0E0;padding:24px;margin-top:32px;">
<p style="font-size:12px;font-weight:700;color:#1C184F;margin-bottom:20px;">EXECUTION</p>
<table style="width:100%;font-size:11px;">
<tr>
<td style="width:50%;padding-right:24px;vertical-align:top;">
<p style="font-weight:700;margin-bottom:12px;">SIGNED for and on behalf of POSFIN CAPITAL LIMITED:</p>
<div style="height:50px;border-bottom:1px solid #999;margin-bottom:6px;">[sig|req|signer1]</div>
<p>Name: Byron Hill (Director)</p>
<p style="margin-top:6px;">Date: [date_signed|req|signer1]</p>
</td>
<td style="width:50%;padding-left:24px;vertical-align:top;">
<p style="font-weight:700;margin-bottom:12px;">SIGNED by THE INTRODUCER:</p>
<div style="height:50px;border-bottom:1px solid #999;margin-bottom:6px;">[sig|req|signer2]</div>
<p>Name: ${d.full_name}</p>
<p style="margin-top:6px;">Date: [date_signed|req|signer2]</p>
</td>
</tr>
</table>
</div>
<p style="font-size:9px;color:#999;text-align:center;margin-top:24px;">Posfin Capital Limited · FCA FRN 913022 · Co. 12148846 · 96 Kensington High Street, London W8 4SG</p>
</body></html>`;
}

// ── Send DocuSign ──────────────────────────────────────────────────────────
async function sendDocuSign(d, ref) {
  const accessToken = await getDSToken();
  const apiClient = new docusign.ApiClient({ basePath: DS_BASE_URL, oAuthBasePath: '' });
  apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);
  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  const htmlDoc = buildAgreementHTML({ ...d, ref });

  const document = new docusign.Document({
    documentBase64: Buffer.from(htmlDoc).toString('base64'),
    name: `Posfin_Introducer_Agreement_${ref}.html`,
    fileExtension: 'html',
    documentId: '1',
  });

  // Byron signs first (signer1), Introducer signs second (signer2)
  const byronSigner = docusign.Signer.constructFromObject({
    email: 'byron.hill@posfincapital.com',
    name: 'Byron Hill',
    recipientId: '1',
    routingOrder: '1',
    clientUserId: `byronposfin_${ref}`,
    tabs: docusign.Tabs.constructFromObject({
      signHereTabs: [docusign.SignHere.constructFromObject({ anchorString: '[sig|req|signer1]', anchorXOffset: '0', anchorYOffset: '0', anchorUnits: 'pixels' })],
      dateSignedTabs: [docusign.DateSigned.constructFromObject({ anchorString: '[date_signed|req|signer1]', anchorXOffset: '0', anchorYOffset: '0' })],
    }),
  });

  const introducerSigner = docusign.Signer.constructFromObject({
    email: d.email,
    name: d.full_name,
    recipientId: '2',
    routingOrder: '2',
    tabs: docusign.Tabs.constructFromObject({
      signHereTabs: [docusign.SignHere.constructFromObject({ anchorString: '[sig|req|signer2]', anchorXOffset: '0', anchorYOffset: '0', anchorUnits: 'pixels' })],
      dateSignedTabs: [docusign.DateSigned.constructFromObject({ anchorString: '[date_signed|req|signer2]', anchorXOffset: '0', anchorYOffset: '0' })],
    }),
  });

  const envelope = new docusign.EnvelopeDefinition({
    emailSubject: `Posfin Capital — Introducer Agreement ${ref}`,
    emailBlurb: `Dear ${d.first_name}, please review and sign your Introducer Agreement with Posfin Capital. Once Byron countersigns, you'll receive your fully-executed copy automatically.`,
    documents: [document],
    recipients: new docusign.Recipients({ signers: [byronSigner, introducerSigner] }),
    status: 'sent',
  });

  const result = await envelopesApi.createEnvelope(DS_ACCOUNT_ID, { envelopeDefinition: envelope });
  return result.envelopeId;
}

// ── Save to Google Sheets ──────────────────────────────────────────────────
async function saveToSheets(d, ref, envelopeId) {
  const saB64 = process.env.GOOGLE_SA_B64;
  if (!saB64) return null;
  const credentials = JSON.parse(Buffer.from(saB64, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const row = [ts, ref, 'PENDING SIGNATURE', d.full_name, d.company || '', d.email, d.mobile, d.fca_status || '', d.case_type || '', d.has_live_case || '', d.network || '', envelopeId, '', ts];
  const colA = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: "'Introducers'!A:A" });
  const nextRow = Math.max((colA.data.values || []).length + 1, 2);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'Introducers'!A${nextRow}:N${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
  return nextRow;
}

// ── Telegram Alert ─────────────────────────────────────────────────────────
async function alertBryon(d, ref, envelopeId) {
  if (!TELE_TOKEN) return;
  const msg = [
    `🤝 *New Introducer Registration*`,
    ``,
    `*Ref:* ${ref}`,
    `*Name:* ${d.full_name}`,
    `*Company:* ${d.company || 'Individual'}`,
    `*Email:* ${d.email}`,
    `*Mobile:* ${d.mobile}`,
    `*FCA Status:* ${d.fca_status || 'Not specified'}`,
    `*Case Type:* ${d.case_type || 'Not specified'}`,
    `*Live Case Now:* ${d.has_live_case || 'No'}`,
    ``,
    `📄 DocuSign sent to ${d.email} for signature`,
    `*Envelope ID:* ${envelopeId}`,
    ``,
    `You need to countersign in DocuSign to activate this introducer.`,
  ].join('\n');
  await fetch(`https://api.telegram.org/bot${TELE_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: BYRON_CHAT_ID, text: msg, parse_mode: 'Markdown' }),
  }).catch(() => {});
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const b = req.body;
    const ref = genRef();
    const data = {
      first_name:   b.first_name || '',
      last_name:    b.last_name || '',
      full_name:    `${b.first_name || ''} ${b.last_name || ''}`.trim(),
      company:      b.company || '',
      email:        b.email || '',
      mobile:       b.mobile || '',
      fca_status:   b.fca_status || '',
      case_type:    b.case_type || '',
      has_live_case:b.has_live_case || '',
      network:      b.network || '',
    };

    if (!data.email || !data.full_name || !data.mobile) {
      return res.status(400).json({ error: 'Name, email and mobile are required' });
    }

    // 1. Send DocuSign
    const envelopeId = await sendDocuSign(data, ref);

    // 2. Save to Sheets
    await saveToSheets(data, ref, envelopeId);

    // 3. Alert Byron
    await alertBryon(data, ref, envelopeId);

    res.status(200).json({ ok: true, ref, envelopeId, message: `Agreement sent to ${data.email} for signature.` });

  } catch (err) {
    console.error('[Introducer API]', err);
    res.status(500).json({ error: err.message });
  }
}
