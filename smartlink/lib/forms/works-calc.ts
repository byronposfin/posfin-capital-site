import { num, round2 } from "@/lib/engine/money";
import type { Answers, Item } from "@/lib/engine/types";

export const WORKS_MAX_LINES = 20;
export const DEFAULT_CONTINGENCY = 10;

export const WORKS_CATEGORIES = [
  "Strip-out & demolition", "Structural", "Roofing", "Windows & doors", "Electrics", "Plumbing & heating",
  "Kitchen", "Bathrooms", "Plastering & drylining", "Flooring", "Joinery", "Decoration",
  "Damp & timber", "Fire safety & compliance", "External & landscaping", "Professional fees", "Other",
];

export interface WorksTotals {
  lines: number;
  subtotal: number;
  contingency_pct: number;
  contingency: number;
  total: number;
  by_category: { category: string; cost: number; share: number }[];
  programme_weeks: number | null;
  gdv: number | null;
  current_value: number | null;
  uplift: number | null;
  cost_to_gdv: number | null;
}

export function contingencyPct(a: Answers): number {
  const raw = a.contingency_pct;
  if (raw === undefined || raw === null || raw === "") return DEFAULT_CONTINGENCY;
  const n = Number(String(raw).replace(/[%\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CONTINGENCY;
}

export function computeWorksTotals(a: Answers): WorksTotals {
  const items = ((a.lines as Item[]) ?? []);
  const subtotal = round2(items.reduce((s, l) => s + num(l.cost), 0));
  const cp = contingencyPct(a);
  const contingency = round2((subtotal * cp) / 100);
  const total = round2(subtotal + contingency);
  const map = new Map<string, number>();
  for (const l of items) {
    const c = String(l.category || "Other");
    map.set(c, round2((map.get(c) ?? 0) + num(l.cost)));
  }
  const by_category = [...map.entries()].map(([category, cost]) => ({ category, cost, share: subtotal > 0 ? cost / subtotal : 0 })).sort((x, y) => y.cost - x.cost);
  const dur = num(a.duration_weeks);
  const gdv = a.gdv ? num(a.gdv) : null;
  const cv = a.current_value ? num(a.current_value) : null;
  return {
    lines: items.length, subtotal, contingency_pct: cp, contingency, total, by_category,
    programme_weeks: dur > 0 ? dur : null, gdv, current_value: cv,
    uplift: gdv !== null && cv !== null ? round2(gdv - cv) : null,
    cost_to_gdv: gdv ? total / gdv : null,
  };
}
