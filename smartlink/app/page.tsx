import { PosfinWordmark } from "@/components/BrandChrome";
import { POSFIN_FOOTER } from "@/lib/brands";

const LINKS: [string, string, string][] = [
  ["Assets & Liabilities", "/al/demo", "Conversational A&L form (fictional demo case)"],
  ["A&L statement", "/al/demo/statement", "Lender-ready landscape A4 · PDF · Excel"],
  ["A&L (blank)", "/al/demo-blank", "Start empty, prefilled from the case only"],
  ["Remortgage — general", "/remortgage/demo?brand=general", "Posfin-only skin"],
  ["Remortgage — Ackroyds", "/remortgage/demo?brand=ackroyds", "Ackroyds × Posfin 2.0 co-brand"],
  ["Remortgage — no title insurance", "/remortgage/demo?brand=general&titleInsurance=0", "Title insurance section hidden"],
  ["Remortgage summary", "/remortgage/demo/summary?brand=ackroyds", "Printable answers summary"],
  ["Schedule of Works — Posfin", "/works/demo?brand=posfin", "Up to 20 trade lines"],
  ["Schedule of Works — unbranded", "/works/demo?brand=unbranded", "No-name master"],
  ["SoW statement — Posfin", "/works/demo/statement?brand=posfin", "PDF · Excel"],
  ["SoW statement — unbranded", "/works/demo/statement?brand=unbranded", "Neutral, no Posfin branding"],
  ["Lender criteria — demo", "/lender/demo", "Lender intake link, fictional lender filled in"],
  ["Lender criteria — blank", "/lender/demo-blank", "What a new lender sees"],
  ["Lender criteria — white-label", "/lender/demo-blank?brand=unbranded", "No Posfin branding"],
  ["Lender criteria summary", "/lender/demo/summary", "Lender-ready landscape summary · PDF · Excel · PLACED JSON"],
];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <PosfinWordmark size="lg" />
      <h1 className="font-heading mt-6 text-[34px] font-semibold text-ink">SmartLink forms — v002</h1>
      <p className="mt-2 text-slate-600">Internal index of demo links. Every name, address and figure in the demo case is fictional.</p>
      <ul className="mt-8 divide-y divide-[var(--rule)] rounded-2xl border border-rule bg-white">
        {LINKS.map(([t, h, d]) => (
          <li key={h}><a href={h} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface"><span><b className="text-ink">{t}</b><span className="block text-[13px] text-slate-500">{d}</span></span><span className="text-accent">→</span></a></li>
        ))}
      </ul>
      <p className="mt-8 text-[12px] text-slate-500">{POSFIN_FOOTER}</p>
    </main>
  );
}
