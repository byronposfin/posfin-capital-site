import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { StorageAdapter } from "./types";
import type { Draft } from "@/lib/engine/types";
import type { FormId } from "@/lib/brands";
import { supabaseConfig } from "./env";

/**
 * Supabase adapter. Uses the service-role key SERVER-SIDE only (route handlers), never in the browser.
 * Tables: see supabase/migrations/20261118_smartlink_forms.sql
 */
const TABLE: Record<FormId, string> = {
  al: "case_assets_liabilities",
  remortgage: "case_remortgage_questionnaire",
  works: "case_schedule_of_works",
  lender: "lender_criteria",
};
/** lender_criteria is keyed by its own link token, not a case token. */
const KEY: Record<FormId, string> = { al: "case_token", remortgage: "case_token", works: "case_token", lender: "link_token" };

let client: SupabaseClient | null = null;
function db() {
  if (!client) {
    const { url, key } = supabaseConfig();
    if (!url || !key) throw new Error("supabase_not_configured");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

type Row = { case_token?: string; link_token?: string; status: Draft["status"]; version: number; step: number; payload: Draft["answers"]; updated_at: string; submitted_at: string | null };

const toDraft = (form: FormId, r: Row): Draft => ({
  token: (r.case_token ?? r.link_token)!, form, status: r.status, version: r.version, step: r.step, answers: r.payload, updated_at: r.updated_at, submitted_at: r.submitted_at ?? undefined,
});

export const supabaseAdapter: StorageAdapter = {
  name: "supabase",
  async getDraft(form, token) {
    const { data, error } = await db().from(TABLE[form]).select(`${KEY[form]},status,version,step,payload,updated_at,submitted_at`).eq(KEY[form], token).maybeSingle();
    if (error) throw new Error(`supabase read failed (${error.code})`);
    return data ? toDraft(form, data as unknown as Row) : null;
  },
  async saveDraft(form, token, d) {
    const prev = await this.getDraft(form, token);
    const now = new Date().toISOString();
    const row = {
      [KEY[form]]: token,
      status: d.status ?? prev?.status ?? "draft",
      version: (prev?.version ?? 0) + 1,
      step: d.step,
      payload: d.answers,
      derived: d.derived ?? null,
      crm_export: d.export ?? null,
      updated_at: now,
      submitted_at: d.status === "submitted" ? now : prev?.submitted_at ?? null,
    };
    const { data, error } = await db().from(TABLE[form]).upsert(row, { onConflict: KEY[form] }).select(`${KEY[form]},status,version,step,payload,updated_at,submitted_at`).single();
    if (error) throw new Error(`supabase write failed (${error.code})`);
    return toDraft(form, data as unknown as Row);
  },
};
