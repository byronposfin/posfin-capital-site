import { num, round2 } from "@/lib/engine/money";
import type { Answers, Item } from "@/lib/engine/types";

export const ITEMISE_THRESHOLD = 10_000;

export interface ALTotals {
  property_value: number;
  mortgages: number;
  equity: number;
  portfolio_ltv: number | null;
  rent_monthly: number;
  rent_annual: number;
  mortgage_payments_monthly: number;
  other_assets: number;
  other_asset_finance: number;
  grouped_small_debts: number;
  itemised_liabilities: number;
  other_liabilities: number;
  monthly_commitments: number;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  property_count: number;
  mortgaged_count: number;
}

export function rentMonthly(rent: unknown): number {
  const r = rent as { amount?: unknown; frequency?: string } | undefined;
  if (!r) return 0;
  const a = num(r.amount);
  return r.frequency === "annual" ? round2(a / 12) : a;
}

export function propertyDerived(p: Item) {
  const value = num(p.value);
  const balance = p.has_mortgage === "yes" ? num(p.mortgage_balance) : 0;
  const equity = value - balance;
  const ltv = value > 0 ? balance / value : null;
  const rm = rentMonthly(p.rent);
  return { value, balance, equity, ltv, rent_monthly: rm, rent_annual: round2(rm * 12), monthly_payment: p.has_mortgage === "yes" ? num(p.monthly_payment) : 0 };
}

const list = (a: Answers, k: string) => ((a[k] as Item[] | undefined) ?? []);

export function computeALTotals(a: Answers): ALTotals {
  const props = a.no_property === true ? [] : list(a, "properties");
  const d = props.map(propertyDerived);
  const sum = (xs: number[]) => round2(xs.reduce((x, y) => x + y, 0));
  const property_value = sum(d.map((x) => x.value));
  const mortgages = sum(d.map((x) => x.balance));
  const rent_monthly = sum(d.map((x) => x.rent_monthly));
  const mortgage_payments_monthly = sum(d.map((x) => x.monthly_payment));

  const cash = sum(list(a, "cash").map((c) => num(c.amount)));
  const others = list(a, "other_assets");
  const other_assets = round2(cash + num(a.investments) + num(a.pensions) + num(a.insurances) + sum(others.map((o) => num(o.value))));
  const other_asset_finance = sum(others.map((o) => num(o.finance_owed)));

  const grouped_small_debts = round2(num(a.grouped_credit_cards) + num(a.grouped_overdrafts) + num(a.grouped_other_small));
  const items = list(a, "liabilities");
  const itemised_liabilities = sum(items.map((l) => num(l.balance)));
  const other_liabilities = round2(grouped_small_debts + itemised_liabilities + other_asset_finance);
  const monthly_commitments = round2(mortgage_payments_monthly + sum(items.map((l) => num(l.monthly_payment))) + num(a.grouped_monthly_payments));

  const total_assets = round2(property_value + other_assets);
  const total_liabilities = round2(mortgages + other_liabilities);
  return {
    property_value, mortgages, equity: round2(property_value - mortgages),
    portfolio_ltv: property_value > 0 ? mortgages / property_value : null,
    rent_monthly, rent_annual: round2(rent_monthly * 12), mortgage_payments_monthly,
    other_assets, other_asset_finance, grouped_small_debts, itemised_liabilities, other_liabilities,
    monthly_commitments, total_assets, total_liabilities, net_worth: round2(total_assets - total_liabilities),
    property_count: props.length, mortgaged_count: props.filter((p) => p.has_mortgage === "yes").length,
  };
}

export function registeredOwner(p: Item, a: Answers): string {
  const me = String(a.applicant_name ?? "").trim() || "Applicant";
  switch (p.owned_by) {
    case "Joint": return [me, String(a.joint_applicant_name ?? "").trim()].filter(Boolean).join(" & ") || "Joint";
    case "Company": return String(p.owner_name ?? a.company_name ?? "Company").trim() || "Company";
    default: return me;
  }
}

/** Lender soft-warn values that are "not really a lender". */
export const VAGUE_LENDER = /^(tbc|tba|family|don'?t know|dont know|unknown|n\/?a|\?+|the mortgage lender|bank|mortgage)$/i;
