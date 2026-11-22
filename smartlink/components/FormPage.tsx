import FormRunner from "./FormRunner";
import type { FormId } from "@/lib/brands";
import { loadForm, type SP } from "@/lib/server";

export async function FormPage({ form, token, sp }: { form: FormId; token: string; sp: SP }) {
  const loaded = await loadForm(form, token, sp);
  if (!loaded) return <p className="p-8 text-[15px]">This link is not valid.</p>;
  const { c, brand, flags, prefillSources, draft, schema } = loaded;
  // Demo-only deep link for previews/screenshots: ?step=<step id>|review
  const stepParam = Array.isArray(sp.step) ? sp.step[0] : sp.step;
  const initial = { ...draft };
  if (c.demo && stepParam) {
    const idx = stepParam === "review" ? schema.steps.length : schema.steps.findIndex((s) => s.id === stepParam);
    if (idx >= 0) initial.step = idx;
  }
  const q = new URLSearchParams({ brand: brand.id });
  if (sp.titleInsurance !== undefined) q.set("titleInsurance", String(sp.titleInsurance));
  const result =
    form === "al" ? { href: `/al/${token}/statement?${q}`, label: "View your A&L statement" }
    : form === "works" ? { href: `/works/${token}/statement?${q}`, label: "View the schedule" }
    : form === "lender" ? { href: `/lender/${token}/summary?${q}`, label: "View your criteria summary" }
    : { href: `/remortgage/${token}/summary?${q}`, label: "View a summary of your answers" };
  return (
    <FormRunner form={form} token={token} brandId={brand.id} caseRef={form === "lender" ? c.ref.replace(/^PC-/, "LC-") : c.ref} demo={c.demo} flags={flags}
      prefillSources={prefillSources} initial={initial} resultHref={result.href} resultLabel={result.label} />
  );
}
