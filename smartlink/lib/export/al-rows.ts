/** Lender-facing A&L rows in Albatross column order (shared by the statement page, PDF and XLSX). */
import { fmtDate } from "@/lib/engine/format";
import { num } from "@/lib/engine/money";
import type { Answers, Item } from "@/lib/engine/types";
import { computeALTotals, propertyDerived, registeredOwner } from "@/lib/forms/al-calc";

export const AL_PROPERTY_COLS = ["Registered owner", "Property address", "Property type", "Purchase date", "Property value", "Monthly rental income", "Monthly mortgage payment", "Lender name", "Charge", "Current mortgage balance", "LTV"] as const;
export const AL_OTHER_COLS = ["Registered name", "Description", "Purchase date", "Lender (if applicable)", "Current value", "Outstanding / money owed"] as const;
export const AL_LIAB_COLS = ["Registered name", "Description", "Lender", "Rate", "Outstanding / money owed", "Monthly payment"] as const;

export interface ALPropertyRow { owner: string; address: string; postcode: string; type: string; purchase_date: string; value: number; rent_monthly: number | null; mortgage_payment: number | null; lender: string; charge: string; balance: number | null; ltv: number | null; equity: number }
export interface ALOtherRow { owner: string; description: string; purchase_date: string; lender: string; value: number; owed: number | null }
export interface ALLiabRow { owner: string; description: string; lender: string; rate: string; balance: number; monthly: number | null }

export function buildAL(a: Answers) {
  const me = String(a.applicant_name ?? "").trim() || "Applicant";
  const props = a.no_property === true ? [] : ((a.properties as Item[]) ?? []);
  const property: ALPropertyRow[] = props.map((p) => {
    const d = propertyDerived(p);
    const mort = p.has_mortgage === "yes";
    return {
      owner: registeredOwner(p, a),
      address: String(p.address_line1 ?? ""),
      postcode: String(p.postcode ?? "").toUpperCase(),
      type: String(p.property_type ?? ""),
      purchase_date: p.purchase_date ? fmtDate(String(p.purchase_date)) : "",
      value: d.value,
      rent_monthly: d.rent_monthly || null,
      mortgage_payment: mort && p.monthly_payment !== undefined && p.monthly_payment !== "" ? d.monthly_payment : null,
      lender: mort ? String(p.lender ?? "") : "Unencumbered",
      charge: mort ? String(p.charge || "1st") : "—",
      balance: mort ? d.balance : null,
      ltv: mort ? d.ltv : null,
      equity: d.equity,
    };
  });
  const other: ALOtherRow[] = [];
  for (const c of ((a.cash as Item[]) ?? [])) other.push({ owner: me, description: `Cash — ${c.where ?? "account"}`, purchase_date: "", lender: "", value: num(c.amount), owed: null });
  if (num(a.investments)) other.push({ owner: me, description: "Investments (shares, ISAs, funds)", purchase_date: "", lender: "", value: num(a.investments), owed: null });
  if (num(a.pensions)) other.push({ owner: me, description: "Pensions", purchase_date: "", lender: "", value: num(a.pensions), owed: null });
  if (num(a.insurances)) other.push({ owner: me, description: "Life policies (surrender value)", purchase_date: "", lender: "", value: num(a.insurances), owed: null });
  for (const o of ((a.other_assets as Item[]) ?? [])) other.push({ owner: me, description: [o.type, o.description].filter(Boolean).join(" — "), purchase_date: o.purchase_date ? fmtDate(String(o.purchase_date)) : "", lender: String(o.lender ?? ""), value: num(o.value), owed: num(o.finance_owed) || null });

  const liab: ALLiabRow[] = [];
  for (const l of ((a.liabilities as Item[]) ?? [])) {
    const sec = l.secured_on && l.secured_on !== "Unsecured" ? ` (secured on ${l.secured_on})` : "";
    liab.push({ owner: me, description: `${l.type ?? "Debt"}${sec}`, lender: String(l.creditor ?? ""), rate: String(l.rate ?? ""), balance: num(l.balance), monthly: l.monthly_payment === undefined || l.monthly_payment === "" ? null : num(l.monthly_payment) });
  }
  const grouped: [string, string][] = [["grouped_credit_cards", "Credit cards (combined, each under £10k)"], ["grouped_overdrafts", "Overdrafts (combined, each under £10k)"], ["grouped_other_small", "Other small debts (combined, each under £10k)"]];
  const groupedRows = grouped.filter(([k]) => num(a[k]) > 0);
  groupedRows.forEach(([k, label], i) => liab.push({ owner: me, description: label, lender: "Various", rate: "", balance: num(a[k]), monthly: i === 0 && num(a.grouped_monthly_payments) ? num(a.grouped_monthly_payments) : null }));
  if (!groupedRows.length && num(a.grouped_monthly_payments)) liab.push({ owner: me, description: "Small debts — monthly payments", lender: "Various", rate: "", balance: 0, monthly: num(a.grouped_monthly_payments) });

  const t = computeALTotals(a);
  const sum = (xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);
  const totals = {
    ...t,
    property_rent: sum(property.map((r) => r.rent_monthly)),
    property_payments: sum(property.map((r) => r.mortgage_payment)),
    other_value: sum(other.map((r) => r.value)),
    other_owed: sum(other.map((r) => r.owed)),
    liab_balance: sum(liab.map((r) => r.balance)),
    liab_monthly: sum(liab.map((r) => r.monthly)),
  };
  const summary = {
    property_net: totals.property_value - totals.mortgages,
    other_net: totals.other_value - totals.other_owed,
    liabilities: totals.liab_balance,
    net: totals.property_value - totals.mortgages + (totals.other_value - totals.other_owed) - totals.liab_balance,
  };
  return { applicant: me, joint: String(a.joint_applicant_name ?? ""), company: String(a.company_name ?? ""), property, other, liab, totals, summary };
}
export type ALStatement = ReturnType<typeof buildAL>;
