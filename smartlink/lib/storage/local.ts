import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageAdapter } from "./types";
import type { Draft } from "@/lib/engine/types";
import { TOKEN_RE } from "@/lib/cases";

/** Local JSON adapter (default). Files under ./data/<form>/<token>.json. Never logs payloads. */
function root() {
  return process.env.SMARTLINK_DATA_DIR || path.join(process.cwd(), "data");
}

function file(form: string, token: string) {
  if (!TOKEN_RE.test(token) || !/^[a-z]+$/.test(form)) throw new Error("bad token");
  return path.join(root(), form, `${token}.json`);
}

export const localAdapter: StorageAdapter = {
  name: "local",
  async getDraft(form, token) {
    try {
      return JSON.parse(await fs.readFile(file(form, token), "utf8")) as Draft;
    } catch {
      return null;
    }
  },
  async saveDraft(form, token, data) {
    const prev = await this.getDraft(form, token);
    const now = new Date().toISOString();
    const draft: Draft & Record<string, unknown> = {
      token, form, status: data.status ?? prev?.status ?? "draft",
      version: (prev?.version ?? 0) + 1, step: data.step, answers: data.answers, updated_at: now,
      ...(data.status === "submitted" ? { submitted_at: now } : prev?.submitted_at ? { submitted_at: prev.submitted_at } : {}),
      ...(data.derived ? { derived: data.derived } : {}),
      ...(data.export ? { crm_export: data.export } : {}),
    };
    const f = file(form, token);
    await fs.mkdir(path.dirname(f), { recursive: true });
    const tmp = f + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(draft, null, 2), { mode: 0o600 });
    await fs.rename(tmp, f);
    return draft;
  },
};
