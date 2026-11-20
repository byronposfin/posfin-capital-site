import { gbp, parseMoney } from "./money";
import type { Answers, Field } from "./types";

const YN: Record<string, string> = { yes: "Yes", no: "No", unsure: "Not sure", na: "N/A" };

export function fmtDate(v: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  if (/^\d{4}-\d{2}$/.test(v)) {
    const [y, m] = v.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return v;
}

export function formatValue(f: Field, v: unknown, answers?: Answers): string {
  if (v === undefined || v === null || v === "") return "";
  switch (f.type) {
    case "money": { const n = parseMoney(v); return n === null ? String(v) : gbp(n); }
    case "money_freq": {
      const o = v as { amount?: unknown; frequency?: string };
      const n = parseMoney(o.amount);
      return n === null ? "" : `${gbp(n)} ${o.frequency === "annual" ? "a year" : "a month"}`;
    }
    case "yes_no": case "yes_no_unsure": case "yes_no_na": return YN[String(v)] ?? String(v);
    case "checkbox": return v === true ? "Confirmed" : "Not confirmed";
    case "date": case "month": return fmtDate(String(v));
    case "multi": return Array.isArray(v) ? v.join(", ") : String(v);
    case "file": return (v as { name?: string })?.name ? `Attached: ${(v as { name: string }).name}` : "";
    case "percent": return `${v}%`;
    case "tolerance": {
      const note = answers?.[`${f.id}_note`];
      return note ? `${v} — ${note}` : String(v);
    }
    case "grid": {
      const o = v as Record<string, Record<string, unknown>>;
      const u = f.unit ?? "";
      return Object.entries(o ?? {})
        .map(([r, cells]) => {
          const parts = Object.entries(cells ?? {}).filter(([, c]) => c !== "" && c !== undefined && c !== null).map(([c, x]) => `${c} ${u === "£" ? "£" + x : x + u}`);
          return parts.length ? `${r}: ${parts.join(" · ")}` : "";
        })
        .filter(Boolean)
        .join("\n");
    }
    case "account_number": return "••••" + String(v).slice(-4);
    case "choice_other": return v === "Other" && answers?.[`${f.id}_other`] ? `Other — ${answers[`${f.id}_other`]}` : String(v);
    default: return String(v);
  }
}
