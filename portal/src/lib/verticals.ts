/**
 * Vertical registry. Add a brand by appending one entry.
 * Every vertical is arranged by Posfin Capital as broker (FCA FRN 913022).
 */

export const POSFIN_PHONE_DISPLAY = "07365 587773";
export const POSFIN_PHONE_TEL = "+447365587773";
export const POSFIN_WHATSAPP = "447365587773";

export const FCA_FOOTER =
  "Posfin Capital is a credit broker, not a lender. Authorised and regulated by the Financial Conduct Authority, FRN 913022. This page is not an offer of credit. A lender decides after a full assessment.";

export type Vertical = {
  id: string;
  name: string;
  wordmark: string;
  tagline: string;
  footer: string;
  vars: Record<string, string>;
};

const POSFIN: Vertical = {
  id: "posfin-capital",
  name: "Posfin Capital",
  wordmark: "Posfin Capital",
  tagline: "Your live deal home",
  footer: FCA_FOOTER,
  vars: {
    "--page": "#07111f",
    "--page-ink": "#f6f1e7",
    "--card": "#fbf7f0",
    "--ink": "#162033",
    "--muted": "#5c6a7c",
    "--accent": "#c6a15b",
    "--accent-ink": "#7a6230",
    "--accent-soft": "rgba(198, 161, 91, 0.16)",
    "--line": "rgba(198, 161, 91, 0.38)",
    "--glow": "#3dd68c",
    "--glow-dim": "#8aa094",
    "--shadow": "0 24px 60px rgba(0, 0, 0, 0.28)",
    "--display": "var(--font-serif), Georgia, serif",
    "--radius": "22px",
  },
};

const PLACED: Vertical = {
  id: "placed",
  name: "Placed",
  wordmark: "Placed",
  tagline: "Your deal, kept in one place",
  footer: `${FCA_FOOTER} Placed is a Posfin brand.`,
  vars: {
    "--page": "#f3f5f8",
    "--page-ink": "#12151c",
    "--card": "#ffffff",
    "--ink": "#12151c",
    "--muted": "#5c6573",
    "--accent": "#1d4ed8",
    "--accent-ink": "#1e3a8a",
    "--accent-soft": "#e8efff",
    "--line": "#e4e7ee",
    "--glow": "#16a34a",
    "--glow-dim": "#94a3b8",
    "--shadow": "0 16px 40px rgba(18, 21, 28, 0.06)",
    "--display": "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
    "--radius": "18px",
  },
};

const REGISTRY: Record<string, Vertical> = {
  [POSFIN.id]: POSFIN,
  [PLACED.id]: PLACED,
};

export function listVerticals(): Vertical[] {
  return Object.values(REGISTRY);
}

export function resolveVertical(id: string | null | undefined): Vertical | null {
  if (!id) return null;
  return REGISTRY[id.trim().toLowerCase()] ?? null;
}

export function whatsappHref(message: string): string {
  return `https://wa.me/${POSFIN_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export const FALLBACK_VERTICAL: Vertical = POSFIN;
