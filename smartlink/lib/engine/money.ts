/** Money helpers: accept "£1,250.50", "1250", " 1 250 "; store plain numbers (pounds, max 2dp). */
export const MONEY_MAX = 999_000_000;

export function parseMoney(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? round2(input) : null;
  const s = String(input).replace(/[£,\s]/g, "").replace(/^gbp/i, "");
  if (s === "" || s === "." ) return null;
  if (!/^-?\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Live input formatting: keeps user decimals while typing ("1,234.5"). */
export function formatMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [int, ...rest] = cleaned.split(".");
  const dec = rest.length ? "." + rest.join("").slice(0, 2) : "";
  const intFmt = int.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return intFmt + dec;
}

export function gbp(n: number | null | undefined, opts: { dp?: 0 | 2; blank?: string } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return opts.blank ?? "—";
  const dp = opts.dp ?? (Number.isInteger(n) ? 0 : 2);
  const s = Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return (n < 0 ? "−£" : "£") + s;
}

export function pct(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return (n * 100).toFixed(dp) + "%";
}

export function num(v: unknown): number {
  const n = parseMoney(v);
  return n ?? 0;
}
