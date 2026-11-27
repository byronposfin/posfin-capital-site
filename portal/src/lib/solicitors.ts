/** Optional Posfin solicitor panel. Selection is never compulsory. */

export const SOLICITOR_DISCLOSURE =
  "Choosing a panel firm is optional. Legal fees usually start from £1,500 and are paid from the loan proceeds. Posfin has no commercial relationship with these solicitors and earns nothing from them.";

export type PanelFirm = {
  id: string;
  firm: string;
  knownAs: string;
  contact: string;
  area: string;
  onAccount: string;
  pace: string;
};

export const PANEL_FIRMS: readonly PanelFirm[] = [
  {
    id: "lark",
    firm: "Lark",
    knownAs: "Lark",
    contact: "Joanne Isherwood",
    area: "North London",
    onAccount: "£100 on account",
    pace: "Fast",
  },
  {
    id: "taylor-rose",
    firm: "Taylor Rose",
    knownAs: "Taylor Rose",
    contact: "Hassan Butt",
    area: "Reading",
    onAccount: "£250 on account",
    pace: "Panel firm",
  },
  {
    id: "ackroyd",
    firm: "Ackroyd Legal",
    knownAs: "Ackroyd Legal (Ackroyds)",
    contact: "Ashkan Nejad",
    area: "Panel",
    onAccount: "Small on-account opener, confirmed by the firm",
    pace: "Panel firm",
  },
  {
    id: "bexley-beaumont",
    firm: "Bexley Beaumont",
    knownAs: "Bexley Beaumont",
    contact: "Bethan Watt",
    area: "Manchester",
    onAccount: "Small on-account opener, confirmed by the firm",
    pace: "Panel firm",
  },
] as const;

export type SolicitorSelection = {
  route: "panel" | "own";
  firmId: string | null;
  firmName: string;
  contactName: string;
  email: string;
  phone: string;
  posfin_introduced: boolean;
  introduced_at: string | null;
};

export type SolicitorError = { error: "unknown_firm" | "incomplete" | "invalid_contact" };

/** Today's date in Europe/London as YYYY-MM-DD. */
export function londonISODate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function findPanelFirm(id: string): PanelFirm | null {
  return PANEL_FIRMS.find((firm) => firm.id === id) ?? null;
}

export function selectPanelSolicitor(firmId: string, now: Date = new Date()): SolicitorSelection | SolicitorError {
  const firm = findPanelFirm(firmId);
  if (!firm) return { error: "unknown_firm" };
  return {
    route: "panel",
    firmId: firm.id,
    firmName: firm.knownAs,
    contactName: firm.contact,
    email: "",
    phone: "",
    posfin_introduced: true,
    introduced_at: londonISODate(now),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function submitOwnSolicitor(
  input: { firm?: unknown; contact?: unknown; email?: unknown; phone?: unknown },
  now: Date = new Date(),
): SolicitorSelection | SolicitorError {
  void now;
  const firmName = clip(input.firm, 120);
  const contactName = clip(input.contact, 120);
  const email = clip(input.email, 160);
  const phone = clip(input.phone, 40);
  if (!firmName || !contactName || !email || !phone) return { error: "incomplete" };
  if (!EMAIL.test(email) || phone.replace(/\D/g, "").length < 10) return { error: "invalid_contact" };
  return {
    route: "own",
    firmId: null,
    firmName,
    contactName,
    email,
    phone,
    posfin_introduced: false,
    introduced_at: null,
  };
}

function clip(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
