import { storageMode } from "./env";
import { localAdapter } from "./local";
import { supabaseAdapter } from "./supabase";
import type { StorageAdapter } from "./types";

/** SMARTLINK_STORAGE=local | supabase. On Vercel the default is supabase. */
export function storage(): StorageAdapter {
  return storageMode() === "supabase" ? supabaseAdapter : localAdapter;
}
