import {isLand,belowMinimum} from '../lib/ff-land.js';
// POST/GET /api/factfind: UK landing fact find (save / load / submit, plus GET health check).
// ES module (the posfin-capital-site repo uses "type": "module").
// Credentials come from environment variables ONLY. Request bodies and personal values are never logged.
//
// Env vars (names only; values are set in Vercel, never in files):
//   FF_BACKEND       "leads" (default)   -> web_lead_* RPCs -> pipeline.web_leads on the configured Supabase project
//                                           (this branch is pinned operationally to landing-preview; supplied migration is reference only)
//                    "preview"           -> ff_test_* RPCs in the posfin-landing-preview Supabase project (test database)
//                    "pipeline"          -> ff_web_* RPCs (old proposal sql/pipeline_web_factfind_PROPOSED.sql, superseded, NOT applied)
//   FF_SUPABASE_URL  https://<project-ref>.supabase.co
//   FF_SUPABASE_KEY  publishable (anon) key. The RPCs are SECURITY DEFINER and executable by anon only; no service-role key needed.
//   FF_HASH_SALT     random string used to hash client IPs for rate limiting
//   FF_ALLOW_TEST_IN_PRODUCTION  optional "true"; without it the preview/test backend refuses to run on a production deployment
//   FF_TEST_RUN      optional "true" (leads backend only): rows get reference TEST-WEB-xxxxxx and is_test=true.
//                    Refused on a production deployment (VERCEL_ENV=production).
// Leads backend also sends p_meta: salted SHA-256 of IP and user agent (never raw), utm_*, broker tag (?b=bh|chris),
// landing path, referrer host, consent text version and form version.
import crypto from "node:crypto";
import { drainAlerts } from "../lib/ff-alert-outbox.js";
import { validate } from "../lib/ff-schema.js";

export const VERSION = "uk-v005-land-v12";
export const CONSENT_VERSION = "uk-consent-v1-2026-11-03"; // bump whenever the consent wording on /fact-find changes
const BACKENDS = {
  leads:    { prefix: "web_lead_", ref: "POSFIN-WEB-",  test: false, meta: true, testRef: "TEST-WEB-" },
  preview:  { prefix: "ff_test_",  ref: "POSFIN-TEST-", test: true },
  pipeline: { prefix: "ff_web_",   ref: "POSFIN-WEB-",  test: false },
};
const FALLBACK = {
  phone: "+44 7446 950 389",
  calendly: "https://calendly.com/byron-hill/posfin-bridging-finance-consultation-30-min-byron",
};
const DB_TIMEOUT_MS = 8000;

export function readConfig(env = process.env) {
  const name = String(env.FF_BACKEND || "leads").trim().toLowerCase();
  const backend = BACKENDS[name];
  const missing = [];
  if (!backend) missing.push("FF_BACKEND(invalid)");
  for (const k of ["FF_SUPABASE_URL", "FF_SUPABASE_KEY", "FF_HASH_SALT"]) if (!String(env[k] || "").trim()) missing.push(k);
  const url = String(env.FF_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  // Local tests only: a mock Supabase on http://127.0.0.1 is accepted when not running on Vercel.
  const localMock = !env.VERCEL && /^http:\/\/127\.0\.0\.1:\d+$/.test(url);
  if (url && !localMock && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) missing.push("FF_SUPABASE_URL(format)");
  let reason = missing.length ? "missing_env" : null;
  if (!reason && backend.test && env.VERCEL_ENV === "production" && env.FF_ALLOW_TEST_IN_PRODUCTION !== "true") reason = "test_backend_on_production";
  const testRun = !!(backend && backend.testRef && env.FF_TEST_RUN === "true");
  if (!reason && testRun && env.VERCEL_ENV === "production") reason = "test_run_on_production";
  if (!reason && env.VERCEL_ENV === 'production' && (name !== 'leads' || url !== 'https://vgflcrfaudrvrdmxjdtl.supabase.co')) reason = 'production_database_mismatch';
  return { ok: !reason, reason, missing, backendName: backend ? name : "invalid", backend, testRun, url, key: String(env.FF_SUPABASE_KEY || "").trim(), salt: String(env.FF_HASH_SALT || "") };
}

const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rand = n => Array.from(crypto.randomBytes(n), b => ALPH[b % 32]).join("");
const normCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const codeOk = c => /^[A-HJ-NP-Z2-9]{12}$/.test(c);
// Never hand out anything but a publishable/anon key (guards against a secret key being set by mistake).
export function isPublishableKey(k) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(k)) return true;
  const p = String(k).split(".");
  if (p.length !== 3) return false;
  try { return JSON.parse(Buffer.from(p[1], "base64url").toString("utf8")).role === "anon"; } catch { return false; }
}
const refPrefix = cfg => (cfg.testRun ? cfg.backend.testRef : cfg.backend.ref);
const clip = (v, n) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, n) : "") || undefined;

// Attribution + privacy-safe fingerprints for the leads backend. Never includes raw IP / UA.
export function buildMeta(cfg, req, body) {
  const a = body && typeof body.attribution === "object" && body.attribution ? body.attribution : {};
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ua = String(req.headers["user-agent"] || "");
  const b = String(a.b || "").toLowerCase();
  let referrer_host;
  try { referrer_host = a.referrer ? new URL(String(a.referrer)).hostname.slice(0, 120) : undefined; } catch { referrer_host = undefined; }
  const landing = clip(a.landing_path, 200);
  return {
    ip_hash: ip ? sha(cfg.salt + "|ip|" + ip) : undefined,
    ua_hash: ua ? sha(cfg.salt + "|ua|" + ua) : undefined,
    broker_tag: b === "bh" || b === "chris" ? b : undefined,
    utm_source: clip(a.utm_source, 100), utm_medium: clip(a.utm_medium, 100), utm_campaign: clip(a.utm_campaign, 150),
    utm_term: clip(a.utm_term, 150), utm_content: clip(a.utm_content, 150),
    landing_path: landing && landing.startsWith("/") ? landing : undefined,
    referrer_host,
    consent_version: CONSENT_VERSION, form_version: VERSION, source: "web_landing_uk",
  };
}

class BackendError extends Error { constructor(code, status, detail) { super(code); this.code = code; this.status = status; this.detail = detail; } }

async function timedFetch(url, opts, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

async function rpc(cfg, fn, body, { retry = true } = {}) {
  const url = `${cfg.url}/rest/v1/rpc/${cfg.backend.prefix}${fn}`;
  const opts = { method: "POST", headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" }, body: JSON.stringify(body) };
  let r;
  try { r = await timedFetch(url, opts, DB_TIMEOUT_MS); }
  catch (e) {
    if (retry) return rpc(cfg, fn, body, { retry: false });
    throw new BackendError("backend_unavailable", 503, e && e.name === "AbortError" ? "timeout" : "network");
  }
  if (r.status >= 500 && retry) return rpc(cfg, fn, body, { retry: false });
  if (!r.ok) {
    // 401/403 = wrong key; 404 = RPC missing (migration not applied); 5xx = Supabase side
    const code = r.status === 401 || r.status === 403 ? "backend_auth_failed" : r.status === 404 ? "backend_rpc_missing" : "backend_error";
    throw new BackendError(code, r.status >= 500 ? 503 : 502, `db_${r.status}_${fn}`);
  }
  return r.json();
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(JSON.stringify(obj));
}
function unavailable(res, code, extra = {}) {
  return send(res, 503, { ok: false, error: code, retryable: true,
    message: "Our secure online save is temporarily unavailable. Your answers have not been sent to us. Please call us or book a 15-minute call.",
    fallback: FALLBACK, ...extra });
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body || "{}"); } catch { throw new BackendError("bad_json", 400); } }
  let raw = "";
  for await (const c of req) { raw += c; if (raw.length > 30000) throw new BackendError("too_large", 413); }
  try { return JSON.parse(raw || "{}"); } catch { throw new BackendError("bad_json", 400); }
}

async function health(cfg) {
  const out = { ok: true, service: "factfind", version: VERSION, backend: cfg.backendName, testMode: !!(cfg.backend && cfg.backend.test), testRun: !!cfg.testRun,
    configured: cfg.ok, reason: cfg.reason, missing: cfg.missing, db: "skipped", fallback: FALLBACK };
  if (cfg.ok) {
    try {
      // Read-only reachability check (Supabase auth health). Writes nothing.
      const r = await timedFetch(`${cfg.url}/auth/v1/health`, { headers: { apikey: cfg.key } }, 3000);
      out.db = r.ok ? "ok" : `http_${r.status}`;
    } catch { out.db = "unreachable"; }
  }
  out.ready = cfg.ok && out.db === "ok";
  return out;
}

export default async function handler(req, res) {
  const cfg = readConfig();
  try {
    if (req.method === "GET") {
      // Staff dashboard (/admin/leads) bootstrap: Supabase URL + PUBLISHABLE key only (public by design; RLS protects data).
      if (/[?&]client=admin(&|$)/.test(String(req.url || ""))) {
        if (!cfg.ok || cfg.backendName !== "leads") return send(res, 200, { ok: false, error: "admin_not_configured" });
        if (!isPublishableKey(cfg.key)) { console.error("factfind_admin_key_not_publishable"); return send(res, 200, { ok: false, error: "admin_key_not_publishable" }); }
        return send(res, 200, { ok: true, supabaseUrl: cfg.url, publishableKey: cfg.key });
      }
      const h = await health(cfg);
      if (!h.ready) console.error("factfind_health_not_ready", JSON.stringify({ reason: h.reason, missing: h.missing, db: h.db, backend: h.backend }));
      return send(res, 200, h);
    }
    if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "method_not_allowed" });
    if (!cfg.ok) {
      // Loud server-side signal (names only, never values) so a misconfiguration cannot fail silently.
      console.error("factfind_not_configured", JSON.stringify({ reason: cfg.reason, missing: cfg.missing, backend: cfg.backendName }));
      return unavailable(res, "backend_not_configured", { reason: cfg.reason });
    }
    const body = await readBody(req);
    const action = String(body.action || "");
    if (!["save", "load", "submit"].includes(action)) return send(res, 400, { ok: false, error: "unknown_action" });
    const testMode = cfg.backend.test;
    const meta = cfg.backend.meta ? { p_meta: buildMeta(cfg, req, body) } : {};

    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
    const allowed = await rpc(cfg, "rate_hit", { p_bucket: sha(cfg.salt + "|" + ip).slice(0, 40) + ":" + action, p_limit: action === "load" ? 20 : 30, p_window_secs: 600 });
    if (allowed !== true) return send(res, 429, { ok: false, error: "rate_limited", message: "Too many attempts. Please wait a few minutes and try again." });

    if (action === "save") {
      const { clean, errors } = validate(body.answers, false, testMode);
      if (errors._) return send(res, 400, { ok: false, error: "bad_input" });
      let code = normCode(body.code), isNew = false;
      if (!code) { code = normCode(`${rand(4)}${rand(4)}${rand(4)}`); isNew = true; }
      else if (!codeOk(code)) return send(res, 400, { ok: false, error: "bad_code", message: "That resume code is not valid." });
      const step = Math.max(1, Math.min(5, parseInt(body.step, 10) || 1));
      const rows = await rpc(cfg, "save", { p_resume_hash: sha(code), p_reference: refPrefix(cfg) + rand(6), p_step: step, p_answers: clean, ...meta });
      const row = rows && rows[0];
      if (!row) throw new BackendError("save_failed", 502);
      if (row.status !== "draft") return send(res, 409, { ok: false, error: "already_submitted", reference: row.reference, message: "This fact find has already been submitted." });
      return send(res, 200, { ok: true, code: code.match(/.{4}/g).join("-"), isNew, reference: row.reference, step: row.step, savedAt: row.updated_at, testMode, fieldErrors: errors });
    }
    if (action === "load") {
      const code = normCode(body.code);
      if (!codeOk(code)) return send(res, 400, { ok: false, error: "bad_code", message: "That resume code is not valid." });
      const rows = await rpc(cfg, "load", { p_resume_hash: sha(code) });
      const r = rows && rows[0];
      if (!r) return send(res, 404, { ok: false, error: "not_found", message: "We could not find a fact find with that code." });
      return send(res, 200, { ok: true, reference: r.reference, status: r.status, step: r.step, answers: r.status === "draft" ? r.answers : {}, savedAt: r.updated_at, testMode });
    }
    // submit
    const code = normCode(body.code);
    if (!codeOk(code)) return send(res, 400, { ok: false, error: "bad_code" });
    const { clean, errors } = validate(body.answers, true, testMode);
    if(isLand(clean)&&belowMinimum(clean))return send(res,422,{ok:false,error:"below_minimum",message:"Below minimum value",no_chase:true});
    if (Object.keys(errors).length) return send(res, 422, { ok: false, error: "validation", fieldErrors: errors, message: "Please check the highlighted answers." });
    await rpc(cfg, "save", { p_resume_hash: sha(code), p_reference: refPrefix(cfg) + rand(6), p_step: 5, p_answers: clean, ...meta });
    const rows = await rpc(cfg, "submit", { p_resume_hash: sha(code), p_answers: clean, ...meta });
    const r = rows && rows[0];
    if (!r || r.status !== "submitted") throw new BackendError("submit_failed", 502);
    // Enqueue is a DB trigger in the same transaction as submit. Worker failure
    // must not misrepresent the already-saved application as unsent.
    let alert;
    if (process.env.FF_ALERT_DURABLE === "true") {
      try { const result = await drainAlerts(); alert = {status: result.ok ? "queued" : "recovery_required"}; }
      catch { alert = {status: "recovery_required"}; }
    } else alert = await previewSubmitAlert(cfg, r.reference);
    return send(res, 200, { ok: true, reference: r.reference, submittedAt: r.submitted_at, testMode, alert, ...(isLand(clean)?{answers:clean,scorecard:clean.land_scorecard}:{}) });
  } catch (e) {
    const code = e instanceof BackendError ? e.code : "server_error";
    const status = e instanceof BackendError ? e.status : 500;
    console.error("factfind_error", JSON.stringify({ code, status, detail: e && e.detail ? String(e.detail).slice(0, 60) : undefined, backend: cfg.backendName }));
    if (status >= 500) return unavailable(res, code);
    return send(res, status, { ok: false, error: code });
  }
}

// Preview trace only. Never send applicant data or resume credentials to Telegram.
// This synchronous transport is not a durable outbox; delivery failure is exposed for review.
export async function previewSubmitAlert(cfg, reference, env = process.env) {
  if (env.FF_SUBMIT_ALERT !== "true") return { status: "disabled" };
  if (env.VERCEL_ENV !== "preview" || !cfg.testRun || cfg.url !== "https://imcqwhccwsuglkzaxazg.supabase.co" || !/^TEST-WEB-[A-Z2-9]{6}$/.test(reference)) return { status: "blocked" };
  const token = env.FF_ALERT_BOT_TOKEN, chat = env.FF_ALERT_CHAT_ID;
  if (!token || !chat) return { status: "unconfigured" };
  try {
    const response = await timedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: `PREVIEW TEST — fact find submitted\nReference: ${reference}\nIntake: landing-preview / pipeline.web_leads\nSynthetic test only. Ads remain on hold.` })
    }, 5000);
    const result = await response.json();
    return response.ok && result.ok ? { status: "sent", messageId: result.result.message_id } : { status: "failed" };
  } catch { return { status: "unknown" }; }
}
