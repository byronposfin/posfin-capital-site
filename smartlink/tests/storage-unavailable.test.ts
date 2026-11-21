import { afterEach, describe, expect, test, vi } from "vitest";
import { unavailableReason, resetSupabaseClient, supabaseAdapter, StorageUnavailable } from "../lib/storage/supabase";

vi.mock("@supabase/supabase-js", () => {
  const missing = { code: "PGRST205", message: "Could not find the table 'public.lender_criteria' in the schema cache" };
  const chain = {
    select() { return this; },
    eq() { return this; },
    upsert() { return this; },
    async maybeSingle() { return { data: null, error: missing }; },
    async single() { return { data: null, error: missing }; },
  };
  return { createClient: () => ({ from: () => chain }) };
});

const KEYS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_MAIN_SERVICE_ROLE_KEY", "FF_SUPABASE_URL", "FF_ALERT_SERVICE_KEY", "SMARTLINK_STORAGE", "VERCEL"] as const;
const saved: Record<string, string | undefined> = {};
let touched = false;

afterEach(() => {
  if (!touched) return;
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetSupabaseClient();
});

function blankEnv() {
  if (!touched) {
    for (const key of KEYS) saved[key] = process.env[key];
    touched = true;
  }
  for (const key of KEYS) delete process.env[key];
  resetSupabaseClient();
}

describe("missing smartlink storage", () => {
  test("classifies a table that has not been migrated", () => {
    expect(unavailableReason({ code: "PGRST205", message: "Could not find the table 'public.lender_criteria' in the schema cache" })).toMatch(/lender_criteria/);
    expect(unavailableReason({ code: "42P01", message: 'relation "public.lender_criteria" does not exist' })).toMatch(/does not exist/);
    expect(unavailableReason({ code: "42501", message: "permission denied" })).toBeNull();
    expect(unavailableReason(null)).toBeNull();
  });

  test("a missing service key reads as an empty draft", async () => {
    blankEnv();
    await expect(supabaseAdapter.getDraft("lender", "TEST")).resolves.toBeNull();
  });

  test("a missing service key refuses the write instead of throwing an unhandled error", async () => {
    blankEnv();
    await expect(supabaseAdapter.saveDraft("works", "TEST", { answers: { job: "TEST" }, step: 0 })).rejects.toBeInstanceOf(StorageUnavailable);
  });

  test("a missing table reads as an empty draft and the write is StorageUnavailable", async () => {
    blankEnv();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    await expect(supabaseAdapter.getDraft("lender", "TEST")).resolves.toBeNull();
    await expect(supabaseAdapter.saveDraft("lender", "TEST", { answers: {}, step: 1 })).rejects.toMatchObject({ name: "StorageUnavailable" });
  });
});
