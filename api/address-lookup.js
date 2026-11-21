// UK address lookup for the fact find. Provider credentials stay server-side.
import { propertyDataKey } from "../lib/propertydata-env.js";

const attempts = new Map();
const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;
const AUTH_CODES = new Set(["X03", "X05"]);
const QUOTA_CODES = new Set(["X04", "X13"]);
const DOWN_CODES = new Set(["X08", "X14"]);

const MANUAL = "Address search unavailable. Please enter your address manually.";

function formatPostcode(value) {
  const compact = String(value || "").replace(/\s/g, "").toUpperCase();
  return POSTCODE_RE.test(compact) ? compact.slice(0, -3) + " " + compact.slice(-3) : compact;
}

function safeCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{2,8}$/.test(code) ? code : null;
}

function logProviderFailure(provider, httpStatus, code, reason) {
  // Structured diagnostics only. Never include keys, postcodes, or address lines.
  console.error(JSON.stringify({
    event: "address_lookup_provider_failure",
    provider,
    httpStatus: Number.isInteger(httpStatus) ? httpStatus : null,
    code: safeCode(code),
    reason,
  }));
}

function classifyPropertyData(httpStatus, code) {
  if (AUTH_CODES.has(code)) return "provider_auth";
  if (QUOTA_CODES.has(code)) return "provider_quota";
  if (DOWN_CODES.has(code)) return "provider_unavailable";
  if (httpStatus === 401 || httpStatus === 403) return "provider_auth";
  if (httpStatus === 402 || httpStatus === 429) return "provider_quota";
  return "provider_unavailable";
}

function classifyByHttp(httpStatus) {
  if (httpStatus === 401 || httpStatus === 403) return "provider_auth";
  if (httpStatus === 402 || httpStatus === 429) return "provider_quota";
  return "provider_unavailable";
}

function uniqueAddresses(values) {
  const seen = new Set();
  const addresses = [];
  for (const value of values) {
    const address = String(value || "").replace(/\s+/g, " ").trim();
    const key = address.toUpperCase();
    if (!address || seen.has(key)) continue;
    seen.add(key);
    addresses.push({ address });
    if (addresses.length >= 200) break;
  }
  return addresses;
}

async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}

async function lookupPropertyData(postcode, key) {
  const url = new URL("https://api.propertydata.co.uk/uprns");
  url.search = new URLSearchParams({ key, postcode, strict: "true", results: "200" }).toString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    const data = await readJson(response);
    const code = safeCode(data?.code ?? data?.error_code ?? data?.errorCode);
    const rows = Array.isArray(data?.data) ? data.data : null;
    if (!response.ok || data?.status === "error" || !rows) {
      const reason = classifyPropertyData(response.status, code);
      logProviderFailure("propertydata", response.status, code, reason);
      return { addresses: [], failure: { reason, code, httpStatus: response.status } };
    }
    const addresses = uniqueAddresses(rows.filter((row) => {
      if (!row?.address) return false;
      const part = String(row.addressParts?.postcode || "").replace(/\s/g, "").toUpperCase();
      return !part || part === postcode;
    }).map((row) => row.address));
    return { addresses, failure: null };
  } catch {
    logProviderFailure("propertydata", null, null, "provider_unavailable");
    return { addresses: [], failure: { reason: "provider_unavailable", code: null, httpStatus: null } };
  }
}

function formatIdeal(row) {
  const parts = [row?.organisation_name, row?.line_1, row?.line_2, row?.line_3, row?.post_town, row?.postcode];
  return parts.map((part) => String(part || "").trim()).filter((part, index, all) => part && part !== all[index - 1]).join(", ");
}

async function lookupIdeal(postcode, key) {
  const url = `https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${encodeURIComponent(key)}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    const data = await readJson(response);
    const code = safeCode(data?.code);
    const rows = Array.isArray(data?.result) ? data.result : null;
    const numeric = Number(data?.code);
    const notFound = response.status === 404 || numeric === 4040;
    if (response.ok && rows && (data?.code == null || numeric === 2000)) {
      return { addresses: uniqueAddresses(rows.map(formatIdeal)), failure: null };
    }
    if (notFound) return { addresses: [], failure: null };
    const reason = numeric === 4010 || numeric === 4011 ? "provider_auth" : (numeric === 4020 || numeric === 4021 ? "provider_quota" : classifyByHttp(response.status));
    logProviderFailure("ideal_postcodes", response.status, code, reason);
    return { addresses: [], failure: { reason, code, httpStatus: response.status } };
  } catch {
    logProviderFailure("ideal_postcodes", null, null, "provider_unavailable");
    return { addresses: [], failure: { reason: "provider_unavailable", code: null, httpStatus: null } };
  }
}

function formatGetAddress(row, postcode) {
  if (typeof row === "string") {
    const parts = row.split(",").map((part) => part.trim()).filter(Boolean);
    const formatted = parts.join(", ");
    const pretty = formatPostcode(postcode);
    return formatted.replace(/\s/g, "").toUpperCase().includes(postcode) ? formatted : `${formatted}, ${pretty}`;
  }
  const lines = Array.isArray(row?.formatted_address)
    ? row.formatted_address
    : [row?.line_1, row?.line_2, row?.line_3, row?.line_4, row?.town_or_city || row?.locality];
  const parts = lines.map((part) => String(part || "").trim()).filter(Boolean);
  const pretty = formatPostcode(row?.postcode || postcode);
  if (pretty && !parts.some((part) => part.replace(/\s/g, "").toUpperCase() === pretty.replace(/\s/g, ""))) parts.push(pretty);
  return parts.join(", ");
}

async function lookupGetAddress(postcode, key) {
  const url = `https://api.getaddress.io/find/${encodeURIComponent(postcode)}?api-key=${encodeURIComponent(key)}&expand=true`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    const data = await readJson(response);
    if (response.ok && Array.isArray(data?.addresses)) {
      return { addresses: uniqueAddresses(data.addresses.map((row) => formatGetAddress(row, postcode))), failure: null };
    }
    if (response.status === 404 || response.status === 400) return { addresses: [], failure: null };
    const reason = classifyByHttp(response.status);
    logProviderFailure("getaddress", response.status, null, reason);
    return { addresses: [], failure: { reason, code: null, httpStatus: response.status } };
  } catch {
    logProviderFailure("getaddress", null, null, "provider_unavailable");
    return { addresses: [], failure: { reason: "provider_unavailable", code: null, httpStatus: null } };
  }
}

async function lookupLocality(postcode) {
  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return { valid: false };
    if (!response.ok) return { valid: null };
    const data = await readJson(response);
    const result = data?.result;
    if (!result || typeof result !== "object") return { valid: false };
    const district = String(result.admin_district || "").trim();
    const region = String(result.region || "").trim();
    const locality = district && region && district !== region ? `${district}, ${region}` : (district || region || String(result.country || "").trim());
    return { valid: true, postcode: formatPostcode(result.postcode || postcode), locality };
  } catch {
    return { valid: null };
  }
}

function userMessage(reason, locality, postcode) {
  if (reason === "invalid_postcode") return "Enter a full UK postcode.";
  if (reason === "no_addresses") {
    return locality
      ? `No addresses were found for ${postcode} (${locality}). Please enter the building number and street manually.`
      : "No addresses were found for this postcode. Please enter your address manually.";
  }
  if (locality) return `${postcode} is in ${locality}. Address search is unavailable just now. Please enter the building number and street manually.`;
  return MANUAL;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const postcode = String(req.query?.postcode || "").toUpperCase().replace(/\s/g, "");
  if (!POSTCODE_RE.test(postcode)) return res.status(400).json({ error: "Enter a full UK postcode.", reason: "invalid_postcode" });

  const propertyKey = propertyDataKey();
  const idealKey = String(process.env.IDEAL_POSTCODES_API_KEY || "").trim();
  const getAddressKey = String(process.env.GETADDRESS_API_KEY || "").trim();
  if (!propertyKey && !idealKey && !getAddressKey) return res.status(503).json({ error: MANUAL, reason: "not_configured" });

  const ip = String(req.headers?.["x-forwarded-for"] || "unknown").split(",")[0];
  const now = Date.now();
  for (const [key, value] of attempts) if (now - value.start > 60000) attempts.delete(key);
  const bucket = attempts.get(ip) || { start: now, count: 0 };
  bucket.count += 1;
  attempts.set(ip, bucket);
  if (bucket.count > 12) return res.status(429).json({ error: "Please wait a minute before searching again, or enter your address manually." });

  const providers = [];
  if (propertyKey) providers.push(() => lookupPropertyData(postcode, propertyKey));
  if (idealKey) providers.push(() => lookupIdeal(postcode, idealKey));
  if (getAddressKey) providers.push(() => lookupGetAddress(postcode, getAddressKey));

  let firstFailure = null;
  for (const lookup of providers) {
    const result = await lookup();
    if (result.addresses.length) return res.status(200).json({ addresses: result.addresses });
    if (result.failure && !firstFailure) firstFailure = result.failure;
  }

  const locality = await lookupLocality(postcode);
  if (locality.valid === false) {
    return res.status(400).json({
      error: "That is not a recognised UK postcode. Check it, or enter your address manually.",
      reason: "invalid_postcode",
      addresses: [],
    });
  }

  const reason = firstFailure ? firstFailure.reason : "no_addresses";
  const pretty = locality.postcode || formatPostcode(postcode);
  const place = locality.valid ? locality.locality : "";
  const body = {
    addresses: [],
    reason,
    error: userMessage(reason, place, pretty),
  };
  if (place) {
    body.locality = place;
    body.postcode = pretty;
  }
  if (firstFailure?.code) body.code = firstFailure.code;
  return res.status(reason === "no_addresses" ? 200 : 502).json(body);
}
