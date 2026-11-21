import { fmtDate } from "@/lib/engine/format";
import { num } from "@/lib/engine/money";
import type { Answers, Item } from "@/lib/engine/types";
import { computeWorksTotals } from "@/lib/forms/works-calc";

export const WORKS_COLS = ["#", "Trade", "Description of works", "Weeks", "Cost (inc. VAT)", "% of works"] as const;

export function buildWorks(a: Answers) {
  const t = computeWorksTotals(a);
  const lines = ((a.lines as Item[]) ?? []).map((l, i) => ({
    n: i + 1, category: String(l.category ?? ""), description: String(l.description ?? ""),
    weeks: l.weeks === undefined || l.weeks === "" ? null : num(l.weeks), cost: num(l.cost),
    share: t.subtotal > 0 ? num(l.cost) / t.subtotal : 0,
  }));
  const contractor = a.contractor_type === "Main contractor" ? String(a.contractor_name || "Main contractor") : String(a.contractor_type ?? "");
  const facts: [string, string][] = [
    ["Borrower", String(a.borrower_name ?? "")],
    ["Property", [String(a.property_address ?? "").replace(/\n/g, ", "), String(a.property_postcode ?? "").toUpperCase()].filter(Boolean).join(", ")],
    ["Property type", String(a.property_type ?? "")],
    ["Project type", String(a.project_type ?? "")],
    ["Units", a.units_before || a.units_after ? `${a.units_before ?? "?"} → ${a.units_after ?? "?"}` : ""],
    ["Planning", [a.planning_status, a.planning_reference].filter(Boolean).join(" · ")],
    ["Building regulations", String(a.building_regs_status ?? "")],
    ["Start date", a.start_date ? fmtDate(String(a.start_date)) : ""],
    ["Duration", a.duration_weeks ? `${a.duration_weeks} weeks` : ""],
    ["Contractor", [contractor, a.contract_type].filter(Boolean).join(" · ")],
    ["GDV basis", String(a.gdv_basis ?? "")],
  ];
  return { t, lines, facts: facts.filter(([, v]) => v), summary: String(a.project_summary ?? ""), experience: String(a.experience ?? "") };
}
export type WorksStatement = ReturnType<typeof buildWorks>;
