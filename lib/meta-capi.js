// Server-side Meta Conversions API Lead for a successful /fact-find submit.
// The browser pixel uses the same event_id (see meta-pixel.js and fact-find.js).
// META_CAPI_ACCESS_TOKEN is required. META_CAPI_TEST_EVENT_CODE is optional.
// Personal values are hashed before they leave this process and are never logged.
import crypto from "node:crypto";

export const PIXEL_ID = "24348621581470909";
export const CAPI_URL = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;
export const DEFAULT_TIMEOUT_MS = 1200;
const EVENT_SOURCE = "https://posfincapital.com/fact-find";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FBP = /^fb\.\d\.\d{10,13}\.\d{5,20}$/;
const FBC = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_-]{1,200}$/;
const TEST_CODE = /^[A-Za-z0-9_-]{1,64}$/;

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function normaliseEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

// Meta: digits only, no leading zeros, country code included.
// UK mobiles collected as 07… or +44… become 447…
export function normalisePhone(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("44")) {
    if (digits.startsWith("440")) digits = "44" + digits.slice(3).replace(/^0+/, "");
  } else if (digits.startsWith("0")) {
    digits = "44" + digits.slice(1).replace(/^0+/, "");
  } else if (/^7\d{9}$/.test(digits)) {
    digits = "44" + digits;
  }
  digits = digits.replace(/^0+/, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
}

// Meta: lowercase a-z only. Punctuation and accents are removed before hashing.
export function normaliseName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

export function splitName(fullName) {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { fn: "", ln: "" };
  return {
    fn: normaliseName(parts[0]),
    ln: normaliseName(parts.slice(1).join(" ")),
  };
}

function hashOrUndefined(normalised) {
  return normalised ? sha256(normalised) : undefined;
}

export function hashEmail(value) {
  return hashOrUndefined(normaliseEmail(value));
}

export function hashPhone(value) {
  return hashOrUndefined(normalisePhone(value));
}

export function eventId(raw) {
  const id = String(raw ?? "").trim();
  return UUID.test(id) ? id : crypto.randomUUID();
}

function header(req, name) {
  const headers = (req && req.headers) || {};
  if (typeof headers.get === "function") return String(headers.get(name) || "");
  return String(headers[name.toLowerCase()] || headers[name] || "");
}

export function readCookie(cookieHeader, name) {
  for (const part of String(cookieHeader || "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(eq + 1).trim()); }
    catch { return ""; }
  }
  return "";
}

function browserId(cookieHeader, cookieName, fromBody, pattern) {
  const fromCookie = readCookie(cookieHeader, cookieName);
  const value = fromCookie || String(fromBody || "").trim();
  return pattern.test(value) ? value : undefined;
}

export function clientIp(xff) {
  const first = String(xff || "").split(",")[0].trim();
  if (!first || first.length > 45) return undefined;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(first)) {
    const ok = first.split(".").every((octet) => Number(octet) <= 255);
    return ok ? first : undefined;
  }
  if (first.includes(":") && /^[0-9a-f:]+$/i.test(first)) return first;
  return undefined;
}

export function eventSourceUrl(raw) {
  try {
    const url = new URL(String(raw || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    const host = url.hostname.toLowerCase();
    const allowed = host === "posfincapital.com"
      || host === "www.posfincapital.com"
      || host === "localhost"
      || host === "127.0.0.1"
      || host.endsWith(".vercel.app");
    if (!allowed) return "";
    const path = url.pathname || "/";
    return url.origin + (path.length > 1 ? path.replace(/\/+$/, "") : path);
  } catch {
    return "";
  }
}

function clipAgent(value) {
  const agent = String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return agent ? agent.slice(0, 512) : undefined;
}

export function buildLeadEvent({ req, answers, metaLead, now = Date.now() }) {
  const lead = metaLead && typeof metaLead === "object" && !Array.isArray(metaLead) ? metaLead : {};
  const person = answers && typeof answers === "object" ? answers : {};
  const names = splitName(person.full_name);
  const cookies = header(req, "cookie");
  const source = eventSourceUrl(lead.event_source_url)
    || eventSourceUrl(header(req, "referer"))
    || EVENT_SOURCE;
  const user_data = {};
  const em = hashEmail(person.email);
  const ph = hashPhone(person.phone);
  const fn = hashOrUndefined(names.fn);
  const ln = hashOrUndefined(names.ln);
  const ip = clientIp(header(req, "x-forwarded-for"));
  const ua = clipAgent(header(req, "user-agent"));
  const fbp = browserId(cookies, "_fbp", lead.fbp, FBP);
  const fbc = browserId(cookies, "_fbc", lead.fbc, FBC);
  if (em) user_data.em = em;
  if (ph) user_data.ph = ph;
  if (fn) user_data.fn = fn;
  if (ln) user_data.ln = ln;
  if (ip) user_data.client_ip_address = ip;
  if (ua) user_data.client_user_agent = ua;
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;
  return {
    event_name: "Lead",
    event_time: Math.floor(now / 1000),
    event_id: eventId(lead.event_id),
    action_source: "website",
    event_source_url: source,
    custom_data: { content_name: "Fact find", content_category: "fact-find" },
    user_data,
  };
}

export async function sendMetaLead({ env = process.env, fetchImpl = fetch, event, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const token = String(env.META_CAPI_ACCESS_TOKEN || "").trim();
  if (!token || !event) return { skipped: "no_token" };
  const body = { data: [event] };
  const testCode = String(env.META_CAPI_TEST_EVENT_CODE || "").trim();
  if (TEST_CODE.test(testCode)) body.test_event_code = testCode;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${CAPI_URL}?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (response && typeof response.text === "function") {
      try { await response.text(); } catch { /* ignore the body */ }
    }
    if (!response || !response.ok) {
      console.error("meta_capi_lead", JSON.stringify({ status: response ? response.status : 0 }));
      return { ok: false, status: response ? response.status : 0 };
    }
    return { ok: true };
  } catch (error) {
    const timedOut = !!(error && (error.name === "AbortError" || error.name === "TimeoutError"));
    console.error("meta_capi_lead", JSON.stringify({ error: timedOut ? "timeout" : "network" }));
    return { ok: false, error: timedOut ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

// Never throws. Missing token and the overnight synthetic check are silent skips.
// The call is capped by timeoutMs so a slow Meta response cannot hold the form open.
export async function safeMetaLeadFromRequest({ env = process.env, fetchImpl = fetch, req, answers, metaLead, skip = false, timeoutMs = DEFAULT_TIMEOUT_MS, now } = {}) {
  try {
    if (skip) return { skipped: "verify" };
    if (!String(env && env.META_CAPI_ACCESS_TOKEN || "").trim()) return { skipped: "no_token" };
    const event = buildLeadEvent({ req, answers, metaLead, now });
    return await sendMetaLead({ env, fetchImpl, event, timeoutMs });
  } catch {
    console.error("meta_capi_lead", JSON.stringify({ error: "unexpected" }));
    return { ok: false, error: "unexpected" };
  }
}
