import { describe, expect, test } from "vitest";
import { parseRoute } from "../lib/route";
import { MAIN_SUPABASE_URL, storageMode, supabaseConfig } from "../lib/storage/env";

const MAIN = MAIN_SUPABASE_URL;
const PREVIEW = "https://imcqwhccwsuglkzaxazg.supabase.co";

describe("smartlink supabase env", () => {
  test("uses the main project and the main service key, not the preview fact-find key", () => {
    const cfg = supabaseConfig({
      FF_SUPABASE_URL: PREVIEW,
      FF_ALERT_SERVICE_KEY: "preview-service-key",
      SUPABASE_MAIN_SERVICE_ROLE_KEY: "main-service-key",
    } as NodeJS.ProcessEnv);
    expect(cfg.url).toBe(MAIN);
    expect(cfg.key).toBe("main-service-key");
    expect(cfg.ffIsMain).toBe(false);
  });

  test("accepts FF_ALERT_SERVICE_KEY when the fact-find URL is already the main project", () => {
    const cfg = supabaseConfig({ FF_SUPABASE_URL: MAIN, FF_ALERT_SERVICE_KEY: "main-via-ff" } as NodeJS.ProcessEnv);
    expect(cfg.url).toBe(MAIN);
    expect(cfg.key).toBe("main-via-ff");
  });

  test("prefers an explicit service role over the fact-find key", () => {
    const cfg = supabaseConfig({
      FF_SUPABASE_URL: MAIN,
      FF_ALERT_SERVICE_KEY: "ff",
      SUPABASE_SERVICE_ROLE_KEY: "explicit",
    } as NodeJS.ProcessEnv);
    expect(cfg.key).toBe("explicit");
  });

  test("works and statement paths keep the token", () => {
    expect(parseRoute("/works/test-lizzy-sow")).toEqual({ form: "works", token: "test-lizzy-sow", view: "form" });
    expect(parseRoute("/works/test-lizzy-sow/statement")).toEqual({ form: "works", token: "test-lizzy-sow", view: "statement" });
    expect(parseRoute("/works/ab")).toBeNull();
    expect(parseRoute("/works/demo/summary")).toBeNull();
    expect(parseRoute("/al/demo/statement")?.view).toBe("statement");
    expect(parseRoute("/remortgage/demo/summary")?.view).toBe("summary");
  });

  test("vercel always selects supabase, even with no key, so a preview cannot pretend a local file was durable", () => {
    expect(storageMode({ VERCEL: "1" } as NodeJS.ProcessEnv)).toBe("supabase");
    expect(storageMode({ SMARTLINK_STORAGE: "local", VERCEL: "1" } as NodeJS.ProcessEnv)).toBe("local");
    expect(storageMode({} as NodeJS.ProcessEnv)).toBe("local");
  });
});
