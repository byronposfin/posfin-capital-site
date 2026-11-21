import type { FormId } from "./brands";

export function parseRoute(pathname: string): { form: FormId; token: string; view: "form" | "statement" | "summary" } | null {
  const m = pathname.match(/^\/(works|al|remortgage|lender)\/([A-Za-z0-9_-]{3,64})(?:\/(statement|summary))?\/?$/);
  if (!m) return null;
  const form = m[1] as FormId;
  const token = m[2];
  const tail = m[3] ?? "";
  if (!tail) return { form, token, view: "form" };
  if ((form === "works" || form === "al") && tail === "statement") return { form, token, view: "statement" };
  if ((form === "remortgage" || form === "lender") && tail === "summary") return { form, token, view: "summary" };
  return null;
}
