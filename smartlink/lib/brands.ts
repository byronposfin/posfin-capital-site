/**
 * Brand registry. Add a solicitor firm (or any white-label skin) by adding one entry here
 * and dropping its logo into /public/brands/<id>/. No component changes needed.
 */
export type FormId = "al" | "remortgage" | "works" | "lender";

export interface BrandLogo { src: string; alt: string; height: number }

export interface Brand {
  id: string;
  name: string;
  /** "posfin" = Posfin only; "cobrand" = solicitor x Posfin; "neutral" = no-name master, no Posfin at all. */
  kind: "posfin" | "cobrand" | "neutral";
  logos: BrandLogo[];
  /** Show the POSFIN CAPITAL text wordmark in the header. */
  posfinWordmark: boolean;
  colours: { ink: string; primary: string; accent: string; accentInk: string; surface: string; rule: string };
  /** Heading font: serif (Playfair) for Posfin, neutral sans for unbranded. */
  headingStyle: "serif" | "sans";
  kicker: string;
  intro: Partial<Record<FormId, { title: string; body: string; minutes: number }>>;
  howHeard: { label: string; options: string[]; default?: string };
  disclaimers: string[];
  /** Footer lines, in order. */
  footer: string[];
  /** Which forms this brand may be used on. */
  forms: FormId[];
}

export const POSFIN_FOOTER = "Posfin Capital is a credit broker, not a lender. Authorised and regulated by the Financial Conduct Authority, FRN 913022. NACFB member.";

const POSFIN_COLOURS = { ink: "#0A1A33", primary: "#0A1A33", accent: "#01BAB5", accentInk: "#007C78", surface: "#F4F6F9", rule: "#DDE3EB" };

const posfin: Brand = {
  id: "posfin",
  name: "Posfin Capital",
  kind: "posfin",
  logos: [],
  posfinWordmark: true,
  colours: POSFIN_COLOURS,
  headingStyle: "serif",
  kicker: "Posfin Capital · SmartLink",
  intro: {
    al: { title: "Your assets & liabilities, in a few minutes", body: "A short, guided version of the lender’s A&L form. We’ll turn your answers into a lender-ready statement — no spreadsheets, nothing to print.", minutes: 6 },
    remortgage: { title: "Let’s get the legal work moving", body: "A few questions about you, the property and your current mortgage. We’ll use your answers to prepare the solicitor’s forms and send them for e-signature. You will not need to print or fill anything in by hand.", minutes: 10 },
    works: { title: "Your schedule of works", body: "A high-level summary of the works planned — trades, costs and timing. Lenders and valuers use it to understand the project. It takes about five minutes.", minutes: 5 },
    lender: { title: "Your lending criteria, in one place", body: "Tell us what you lend on and where your appetite really sits, so we only send you deals you’ll want to see. Upload your product guide and we’ll pre-fill most of it — you just plug the gaps.", minutes: 20 },
  },
  howHeard: { label: "How did you hear about Posfin Capital?", options: ["Recommendation", "Existing client", "Introducer or broker", "Search / website", "LinkedIn or social media", "Other"] },
  disclaimers: [
    "Your property may be repossessed if you do not keep up repayments on a mortgage or any other debt secured on it.",
    "Some commercial and buy-to-let lending is not regulated by the Financial Conduct Authority.",
  ],
  footer: [POSFIN_FOOTER],
  forms: ["al", "remortgage", "works", "lender"],
};

const ackroyds: Brand = {
  id: "ackroyds",
  name: "Ackroyd Legal",
  kind: "cobrand",
  logos: [{ src: "/brands/ackroyds/logo.svg", alt: "Ackroyd Legal", height: 30 }],
  posfinWordmark: true,
  colours: { ink: "#151E46", primary: "#151E46", accent: "#E30613", accentInk: "#B0050F", surface: "#F3F4F8", rule: "#D8DCE6" },
  headingStyle: "serif",
  kicker: "Ackroyds × Posfin 2.0",
  intro: {
    remortgage: { title: "Let’s get the legal work moving", body: "Ackroyd Legal will act as your solicitor on this remortgage. Posfin is collecting the answers they need, so we can complete their forms and send them to you for e-signature. You will not need to print or fill in a PDF.", minutes: 10 },
  },
  howHeard: { label: "How did you hear about Ackroyd Legal?", options: ["Introduced by Posfin Capital", "Recommendation", "Existing client", "Search / website", "Other"], default: "Introduced by Posfin Capital" },
  disclaimers: [],
  footer: ["Prepared by Posfin Capital, a broker not a lender, for Ackroyd Legal.", POSFIN_FOOTER],
  forms: ["remortgage"],
};

const unbranded: Brand = {
  id: "unbranded",
  name: "Schedule of works",
  kind: "neutral",
  logos: [],
  posfinWordmark: false,
  colours: { ink: "#1F2937", primary: "#1F2937", accent: "#4B5563", accentInk: "#374151", surface: "#F5F5F4", rule: "#E5E7EB" },
  headingStyle: "sans",
  kicker: "Schedule of works",
  intro: {
    works: { title: "Schedule of works", body: "A high-level summary of the works planned on the property — trades, costs and timing — for the lender and valuer.", minutes: 5 },
    al: { title: "Assets & liabilities", body: "A short, guided assets and liabilities statement.", minutes: 6 },
    lender: { title: "Lending criteria", body: "Tell us what you lend on and where your appetite sits, so we only send you suitable deals. Upload your product guide to pre-fill most of it.", minutes: 20 },
  },
  howHeard: { label: "How did you hear about us?", options: ["Recommendation", "Existing client", "Search / website", "Other"] },
  disclaimers: [],
  footer: [],
  forms: ["works", "al", "lender"],
};

export const BRANDS: Record<string, Brand> = { posfin, ackroyds, unbranded };
/** Aliases accepted on ?brand= */
const ALIASES: Record<string, string> = { general: "posfin", "ackroyds_posfin_2_0": "ackroyds", ackroyd: "ackroyds", none: "unbranded", master: "unbranded", noname: "unbranded" };

export function resolveBrand(param: string | string[] | undefined | null, form: FormId, caseDefault?: string): Brand {
  const raw = (Array.isArray(param) ? param[0] : param) || caseDefault || "posfin";
  const id = ALIASES[raw.toLowerCase()] ?? raw.toLowerCase();
  const b = BRANDS[id];
  if (b && b.forms.includes(form)) return b;
  return posfin;
}

export function brandStyle(b: Brand): Record<string, string> {
  return {
    "--ink": b.colours.ink, "--primary": b.colours.primary, "--accent": b.colours.accent,
    "--accent-ink": b.colours.accentInk, "--surface": b.colours.surface, "--rule": b.colours.rule,
    "--heading": b.headingStyle === "serif" ? "var(--font-serif)" : "var(--font-sans)",
  };
}
