import { evalCond } from "./conditions";
import { parseMoney } from "./money";
import type { Answers, Ctx, FormSchema, Item } from "./types";

/**
 * CRM-friendly flat export: one key per answer, repeaters as <repeater>_<n>_<field> (1-based).
 * Hidden (conditional-off) answers are dropped so stale branches never reach the CRM.
 */
export function flattenAnswers(schema: FormSchema, answers: Answers, ctx: Ctx): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  const put = (k: string, type: string, v: unknown) => {
    if (v === undefined || v === "") return;
    if (type === "money") out[k] = parseMoney(v);
    else if (type === "money_freq") {
      const o = v as { amount?: unknown; frequency?: string };
      const a = parseMoney(o.amount);
      if (a === null) return;
      out[`${k}_amount`] = a;
      out[`${k}_frequency`] = o.frequency ?? null;
      out[`${k}_monthly`] = o.frequency === "annual" ? Math.round((a / 12) * 100) / 100 : a;
      out[`${k}_annual`] = o.frequency === "annual" ? a : Math.round(a * 12 * 100) / 100;
    } else if (type === "grid") {
      const slug = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      for (const [r, cells] of Object.entries((v as Record<string, Record<string, unknown>>) ?? {}))
        for (const [c, x] of Object.entries(cells ?? {})) {
          if (x === "" || x === undefined || x === null) continue;
          const n = Number(String(x).replace(/[%,£\s]/g, ""));
          out[`${k}__${slug(r)}__${slug(c)}`] = Number.isFinite(n) ? n : String(x);
        }
    } else if (type === "file") {
      const f = v as { name?: string };
      out[k] = f?.name ?? null;
    } else if (Array.isArray(v)) out[k] = v.join("; ");
    else if (typeof v === "object" && v !== null) out[k] = JSON.stringify(v);
    else out[k] = v as string | number | boolean;
  };
  for (const step of schema.steps) {
    if (!evalCond(step.when, answers, ctx)) continue;
    for (const n of step.nodes) {
      if (n.kind === "notice") continue;
      if (n.kind === "repeater") {
        if (!evalCond(n.when, answers, ctx)) continue;
        const items = (answers[n.id] as Item[]) ?? [];
        out[`${n.id}_count`] = items.length;
        items.forEach((it, i) => {
          for (const f of n.fields) if (evalCond(f.when, answers, ctx, it)) put(`${n.id}_${i + 1}_${f.id}`, f.type, it[f.id]);
        });
        continue;
      }
      if (evalCond(n.when, answers, ctx)) {
        put(n.id, n.type, answers[n.id]);
        if (n.type === "tolerance") put(`${n.id}_note`, "text", answers[`${n.id}_note`]);
      }
    }
  }
  for (const k of ["declaration_accepted", "declaration_name", "declaration_at"]) if (answers[k] !== undefined) out[k] = answers[k] as string;
  return out;
}
