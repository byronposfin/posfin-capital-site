/**
 * Case lookup. In Tom's SmartLink app this is replaced by the existing case-token lookup
 * (Supabase `cases` / smart_links). Here: demo tokens with clearly FICTIONAL data only.
 */
import type { FormId } from "./brands";

export interface CaseInfo {
  token: string;
  ref: string;
  demo: boolean;
  applicant: { name: string; email: string; mobile?: string; company?: string; referred_by?: string };
  brand?: Partial<Record<FormId, string>>;
  flags: { titleInsurance: boolean };
  /** CRM prefill keyed by the spec's prefill.source strings. */
  prefill: Record<string, unknown>;
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{3,64}$/;

const DEMO: CaseInfo = {
  token: "demo",
  ref: "PC-DEMO-001",
  demo: true,
  applicant: { name: "Jordan Example", email: "jordan.example@example.com", mobile: "07700 900123", company: "Example Holdings Ltd (fictional)", referred_by: "Demo introducer" },
  flags: { titleInsurance: true },
  prefill: {
    "crm.borrower.legal_forenames": "Jordan Alex",
    "crm.borrower.legal_surname": "Example",
    "crm.borrower.mobile": "07700 900123",
    "crm.borrower.email": "jordan.example@example.com",
    "crm.property.address / title": "14 Sample Terrace\nDemo Town",
    "crm.property.postcode / title": "ZZ1 1ZZ",
    "title.tenure": "Freehold",
    "crm.case.transaction_type": "no",
    "crm.borrower.entity_type": "no",
    "title.first_charge.proprietor / crm": "Example Building Society (fictional)",
    "crm.existing_borrowing.balance": "312,500",
    "crm.offer.gross_or_net_amount": "425,000",
    "crm.borrower.legal_name": "Jordan Alex Example",
  },
};

export function getDemoCase(token: string): CaseInfo | null {
  if (token === "demo") return DEMO;
  if (token === "demo-blank") return { ...DEMO, token, ref: "PC-DEMO-002", prefill: { "crm.borrower.email": DEMO.applicant.email } };
  if (token === "demo-noti") return { ...DEMO, token, ref: "PC-DEMO-003", flags: { titleInsurance: false } };
  return null;
}

/** Local adapter: demo tokens only. Supabase adapter: looks up the cases table. */
export function flagsFor(c: CaseInfo, searchParams: Record<string, string | string[] | undefined>) {
  const p = searchParams.titleInsurance ?? searchParams.ti;
  const v = Array.isArray(p) ? p[0] : p;
  if (v === undefined) return { titleInsurance: c.flags.titleInsurance };
  return { titleInsurance: ["1", "true", "yes", "on"].includes(v.toLowerCase()) };
}
