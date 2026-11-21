import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StorageAdapter } from "./types";
import type { Draft } from "@/lib/engine/types";
import type { FormId } from "@/lib/brands";
import { supabaseConfig } from "./env";

/**
 * Supabase adapter. Uses the service-role key SERVER-SIDE only (route handlers), never in the browser.
 * Tables: see supabase/migrations/20261118_smartlink_forms.sql
 *
 * A missing key or a table that has not been migrated must not take the page down.
 * Reads come back empty. Writes throw StorageUnavailable, which the routes turn into a JSON 503.
 */
const TABLE: Record<FormId, string> = {
  al: "case_assets_liabilities",
  remortgage: "case_remortgage_questionnaire",
  works: "case_schedule_of_works",
  lender: "lender_criteria",
};
/** lender_criteria is keyed by its own link token, not a case token. */
const KEY: Record<FormId, string> = { al: "case_token", remortgage: "case_token", works: "case_token", lender: "link_token" };

export class StorageUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "StorageUnavailable";
  }
}

export function isStorageUnavailable(e: unknown): e is StorageUnavailable {
  return e instanceof StorageUnavailable || (e instanceof Error && e.name === "StorageUnavailable");
}

/** PostgREST / Postgres signals that the SmartLink table is not there yet. */
export function unavailableReason(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error) return null;
  const code = String(error.code || "");
  const message = String(error.message || "");
  if (code === "42P01" || code === "PGRST205" || code === "PGRST106") return message || code;
  if (/could not find the table/i.test(message)) return message;
  if (/relation ["'].*["'] does not exist/i.test(message)) return message;
  if (/schema cache/i.test(message) && /table|relation|lender_criteria|case_/i.test(message)) return message;
  return null;
}

let client: SupabaseClient | null = null;
/** Tests only. The live handler keeps one client for the isolate. */
export function resetSupabaseClient() {
  client = null;
}

function db() {
  if (!client) {
    const { url, key } = supabaseConfig();
    if (!url || !key) throw new StorageUnavailable("supabase_not_configured");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

type Row = { case_token?: string; link_token?: string; status: Draft["status"]; version: number; step: number; payload: Draft["answers"]; updated_at: string; submitted_at: string | null };

const toDraft = (form: FormId, r: Row): Draft => ({
  token: (r.case_token ?? r.link_token)!, form, status: r.status, version: r.version, step: r.step, answers: r.payload, updated_at: r.updated_at, submitted_at: r.submitted_at ?? undefined,
});

const COLS = "status,version,step,payload,updated_at,submitted_at";

export const supabaseAdapter: StorageAdapter = {
  name: "supabase",
  async getDraft(form, token) {
    try {
      const key = KEY[form];
      const { data, error } = await db().from(TABLE[form]).select(`${key},${COLS}`).eq(key, token).maybeSingle();
      const missing = unavailableReason(error);
      if (missing) {
        console.error(`[smartlink] storage unavailable form=${form}: ${missing}`);
        return null;
      }
      if (error) throw new Error(`supabase read failed (${error.code})`);
      return data ? toDraft(form, data as unknown as Row) : null;
    } catch (e) {
      if (isStorageUnavailable(e)) {
        console.error(`[smartlink] storage unavailable form=${form}: ${e.message}`);
        return null;
      }
      throw e;
    }
  },
  async saveDraft(form, token, d) {
    const prev = await this.getDraft(form, token);
    const now = new Date().toISOString();
    const key = KEY[form];
    const row = {
      [key]: token,
      status: d.status ?? prev?.status ?? "draft",
      version: (prev?.version ?? 0) + 1,
      step: d.step,
      payload: d.answers,
      derived: d.derived ?? null,
      crm_export: d.export ?? null,
      updated_at: now,
      submitted_at: d.status === "submitted" ? now : prev?.submitted_at ?? null,
    };
    const res = await db().from(TABLE[form]).upsert(row, { onConflict: key }).select(`${key},${COLS}`).single();
    const missing = unavailableReason(res.error);
    if (missing) throw new StorageUnavailable(missing);
    if (res.error || !res.data) throw new Error(`supabase write failed (${res.error?.code ?? "empty"})`);
    return toDraft(form, res.data as unknown as Row);
  },
};
