/**
 * Credential resolution for the SmartLink tables.
 *
 * The fact-find API uses FF_SUPABASE_URL. On production that is the main project
 * (lib/ff-alert-outbox.js MAIN_DB). On preview it is a different, isolated project.
 * Schedule of Works submissions belong on the main project, so a preview fact-find
 * URL or its service key is never sent there.
 *
 * Key order: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_MAIN_SERVICE_ROLE_KEY (ops scripts),
 * then FF_ALERT_SERVICE_KEY only when FF_SUPABASE_URL is already the main project.
 * All of these are server-only. None are NEXT_PUBLIC_.
 */
export const MAIN_SUPABASE_URL = "https://vgflcrfaudrvrdmxjdtl.supabase.co";

function trim(v: string | undefined) {
  return String(v || "").trim().replace(/\/+$/, "");
}

export function supabaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const ffUrl = trim(env.FF_SUPABASE_URL);
  const ffIsMain = ffUrl === MAIN_SUPABASE_URL;
  const explicitUrl = trim(env.SUPABASE_URL);
  const key = trim(env.SUPABASE_SERVICE_ROLE_KEY) || trim(env.SUPABASE_MAIN_SERVICE_ROLE_KEY) || (ffIsMain ? trim(env.FF_ALERT_SERVICE_KEY) : "");
  const url = explicitUrl || MAIN_SUPABASE_URL;
  return { url, key, ffIsMain };
}

/** local JSON files, or the Supabase adapter. Vercel never falls through to local disk. */
export function storageMode(env: NodeJS.ProcessEnv = process.env): "local" | "supabase" {
  if (env.SMARTLINK_STORAGE === "local") return "local";
  if (env.SMARTLINK_STORAGE === "supabase" || env.VERCEL) return "supabase";
  const { key } = supabaseConfig(env);
  return key ? "supabase" : "local";
}
