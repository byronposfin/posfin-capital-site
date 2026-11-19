// French fact find API. Writes raw_answers on the main CRM with market FR.
// Never calls WhatsApp, lenders, or the statement-analysis webhook.
import crypto from "node:crypto";
import { buildStaffView, CONSENT_VERSION, DOC_TYPES, isTestLead, MAX_UPLOAD_BYTES, safeFileName, sniffUpload, validateStage } from "../lib/fr-factfind.js";

export const MAIN_URL = "https://vgflcrfaudrvrdmxjdtl.supabase.co";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readConfig(env = process.env) {
  const url = String(env.FR_SUPABASE_URL || env.FF_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(env.FR_SUPABASE_KEY || env.FF_SUPABASE_KEY || "").trim();
  const adminToken = String(env.FR_FACTFIND_ADMIN_TOKEN || env.PREFILL_ADMIN_TOKEN || "").trim();
  const localMock = !env.VERCEL && /^http:\/\/127\.0\.0\.1:\d+$/.test(url);
  let reason = null;
  if (!url || !key) reason = "missing_env";
  else if (!localMock && url !== MAIN_URL) reason = "fr_database_mismatch";
  return { ok: !reason, reason, url, key, adminToken };
}

export function requestOrigin(req) {
  const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "").split(",")[0].trim();
  const proto = String(req.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  if (!/^https?$/.test(proto) || !/^[A-Za-z0-9.-]+(?::\d+)?$/.test(host)) return null;
  if (proto !== "https" && host !== "127.0.0.1" && !host.startsWith("127.0.0.1:") && host !== "localhost" && !host.startsWith("localhost:")) return null;
  return `${proto}://${host}`;
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { const err = new Error("bad_json"); err.status = 400; throw err; }
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 6000000) { const err = new Error("too_large"); err.status = 413; throw err; }
  }
  try { return JSON.parse(raw || "{}"); } catch { const err = new Error("bad_json"); err.status = 400; throw err; }
}

async function rpc(cfg, fn, body) {
  const response = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) {
    const err = new Error("backend_error");
    err.status = response.status >= 500 ? 503 : 502;
    err.detail = `${fn}_${response.status}`;
    throw err;
  }
  return payload;
}

function adminSecret(req, cfg) {
  const header = String(req.headers?.["x-fr-admin-token"] || req.headers?.["x-prefill-admin-token"] || "").trim();
  const bearer = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim();
  return header || bearer || cfg.adminToken;
}

function staffPayload(row, origin) {
  const view = buildStaffView({
    firstName: row.first_name,
    phone: row.phone,
    token: row.token,
    origin,
  });
  if (!view.ok) return { ok: false, error: view.error };
  return {
    ok: true,
    lead_id: row.lead_id,
    full_name: row.full_name,
    company_name: row.company_name || "",
    is_test: !!row.is_test,
    phone: view.phone,
    smart_url: view.smart_url,
    whatsapp_url: view.whatsapp_url,
    whatsapp_text: view.whatsapp_text,
    sends_message: false,
  };
}

export default async function handler(req, res) {
  const cfg = readConfig();
  try {
    if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
    if (req.method === "GET") {
      return send(res, 200, { ok: cfg.ok, service: "fr-factfind", market: "FR", consent: CONSENT_VERSION, reason: cfg.reason || undefined });
    }
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "method_not_allowed" });
    if (!cfg.ok) return send(res, 503, { ok: false, error: cfg.reason });
    const body = await readBody(req);
    const action = String(body.action || "");

    if (action === "load") {
      const row = await rpc(cfg, "fr_factfind_load", { p_token: String(body.token || "") });
      if (!row?.ok) return send(res, row?.error === "not_found" ? 404 : 400, { ok: false, error: row?.error || "not_found" });
      return send(res, 200, row);
    }

    if (action === "save") {
      const stage = Number(body.stage);
      if (stage !== 2 && stage !== 3) return send(res, 400, { ok: false, error: "bad_stage" });
      const loaded = await rpc(cfg, "fr_factfind_load", { p_token: String(body.token || "") });
      if (!loaded?.ok) return send(res, loaded?.error === "not_found" ? 404 : 400, { ok: false, error: loaded?.error || "not_found" });
      const strict = body.strict === true;
      const { clean, errors } = validateStage(stage, body.answers, {
        strict,
        locked: loaded.locked,
        hasStatements: Array.isArray(loaded.files) && loaded.files.some((file) => file.doc_type === "bank_statements"),
      });
      if (Object.keys(errors).length) return send(res, 422, { ok: false, error: "validation", fieldErrors: errors });
      const saved = await rpc(cfg, "fr_factfind_save", {
        p_token: String(body.token || ""),
        p_stage: stage,
        p_answers: clean,
        p_strict: strict,
        p_consent_version: CONSENT_VERSION,
        p_consent_text: strict && stage === 3 ? String(body.consent_text || "").slice(0, 800) : null,
        p_consent_lang: body.lang === "en" ? "en" : "fr",
      });
      if (!saved?.ok) return send(res, saved?.error === "not_found" ? 404 : 422, { ok: false, error: saved?.error || "save_failed", fieldErrors: saved?.fieldErrors });
      return send(res, 200, saved);
    }

    if (action === "upload") {
      const docType = DOC_TYPES.includes(body.doc_type) ? body.doc_type : "bank_statements";
      const claimed = String(body.content_type || "");
      let bytes;
      try { bytes = Buffer.from(String(body.data_base64 || ""), "base64"); } catch { return send(res, 400, { ok: false, error: "bad_file" }); }
      const mime = sniffUpload(bytes, claimed);
      if (!mime) return send(res, 400, { ok: false, error: bytes.length > MAX_UPLOAD_BYTES ? "too_large" : "bad_type" });
      const prepared = await rpc(cfg, "fr_factfind_prepare_upload", {
        p_token: String(body.token || ""),
        p_file_name: safeFileName(body.file_name),
        p_mime: mime,
        p_size: bytes.length,
        p_doc_type: docType,
      });
      if (!prepared?.ok) return send(res, prepared?.error === "not_found" ? 404 : 400, { ok: false, error: prepared?.error || "upload_rejected" });
      const path = `fr/${prepared.token_hash}/${prepared.lead_id}/${Date.now()}-${prepared.file_name}`;
      const stored = await fetch(`${cfg.url}/storage/v1/object/statements/${path}`, {
        method: "POST",
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          "Content-Type": mime,
          "x-upsert": "false",
          "cache-control": "no-store",
        },
        body: bytes,
      });
      if (!stored.ok) return send(res, 502, { ok: false, error: "storage_failed" });
      const recorded = await rpc(cfg, "fr_factfind_record_upload", {
        p_token: String(body.token || ""),
        p_path: path,
        p_file_name: prepared.file_name,
        p_mime: mime,
        p_size: bytes.length,
        p_doc_type: docType,
      });
      if (!recorded?.ok) return send(res, 502, { ok: false, error: recorded?.error || "record_failed" });
      return send(res, 200, { ok: true, files: recorded.files, step: recorded.step });
    }

    if (action === "staff") {
      if (!UUID.test(String(body.lead_id || ""))) return send(res, 400, { ok: false, error: "bad_lead" });
      const origin = requestOrigin(req);
      if (!origin) return send(res, 400, { ok: false, error: "bad_origin" });
      const row = await rpc(cfg, "fr_factfind_staff", {
        p_lead_id: body.lead_id,
        p_admin_secret: adminSecret(req, cfg),
      });
      if (!row?.ok) return send(res, row?.error === "unauthorized" ? 401 : 404, { ok: false, error: row?.error || "not_found" });
      const view = staffPayload(row, origin);
      if (!view.ok) return send(res, 422, view);
      return send(res, 200, view);
    }

    if (action === "mint") {
      if (!UUID.test(String(body.lead_id || ""))) return send(res, 400, { ok: false, error: "bad_lead" });
      const secret = String(req.headers?.["x-fr-admin-token"] || req.headers?.["x-prefill-admin-token"] || "").trim()
        || String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim();
      if (!cfg.adminToken || secret !== cfg.adminToken) return send(res, 401, { ok: false, error: "unauthorized" });
      const origin = requestOrigin(req);
      if (!origin) return send(res, 400, { ok: false, error: "bad_origin" });
      const token = crypto.randomBytes(24).toString("base64url");
      const minted = await rpc(cfg, "fr_factfind_mint", {
        p_lead_id: body.lead_id,
        p_token: token,
        p_admin_secret: secret,
      });
      if (!minted?.ok) return send(res, minted?.error === "unauthorized" ? 401 : 404, { ok: false, error: minted?.error || "not_found" });
      const view = staffPayload({ ...minted, token, is_test: isTestLead(minted) || minted.is_test === true }, origin);
      if (!view.ok) return send(res, 422, view);
      await rpc(cfg, "fr_factfind_store_links", {
        p_token: token,
        p_smart_url: view.smart_url,
        p_whatsapp_url: view.whatsapp_url,
        p_admin_secret: secret,
      }).catch(() => {});
      return send(res, 200, { ...view, token, sends_message: false });
    }

    return send(res, 400, { ok: false, error: "unknown_action" });
  } catch (error) {
    const status = error.status || 500;
    console.error("fr_factfind_error", JSON.stringify({ status, detail: error.detail || error.message }));
    return send(res, status >= 500 ? 503 : status, { ok: false, error: status >= 500 ? "backend_unavailable" : error.message || "bad_request" });
  }
}
