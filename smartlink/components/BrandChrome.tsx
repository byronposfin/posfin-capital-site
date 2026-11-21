import type { Brand } from "@/lib/brands";

export function PosfinWordmark({ size = "md", onDark = false }: { size?: "sm" | "md" | "lg"; onDark?: boolean }) {
  const cls = size === "lg" ? "text-[22px]" : size === "sm" ? "text-[13px]" : "text-[16px]";
  return (
    <span className={`${cls} font-semibold tracking-[0.22em] whitespace-nowrap select-none`} aria-label="Posfin Capital">
      <span style={{ color: onDark ? "#fff" : "#0A1A33" }}>POSFIN</span>{" "}
      <span style={{ color: "#01BAB5" }}>CAPITAL</span>
    </span>
  );
}

export function BrandHeader({ brand, sub }: { brand: Brand; sub?: string }) {
  return (
    <div className="flex items-center gap-3 min-h-8">
      {brand.logos.map((l) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={l.src} src={l.src} alt={l.alt} style={{ height: l.height }} className="w-auto" />
      ))}
      {brand.logos.length > 0 && brand.posfinWordmark && <span className="text-slate-400 text-sm">×</span>}
      {brand.posfinWordmark && <PosfinWordmark size={brand.logos.length ? "sm" : "md"} />}
      {brand.kind === "neutral" && (
        <span className="text-[13px] font-semibold tracking-[0.18em] uppercase text-gray-500">{sub ?? brand.kicker}</span>
      )}
    </div>
  );
}

export function BrandFooter({ brand, className = "" }: { brand: Brand; className?: string }) {
  if (!brand.footer.length && !brand.disclaimers.length) return null;
  return (
    <footer className={`text-[11.5px] leading-relaxed text-slate-500 space-y-1 ${className}`}>
      {brand.footer.map((f) => (
        <p key={f}>{f}</p>
      ))}
      {brand.disclaimers.map((d) => (
        <p key={d} className="text-slate-400">{d}</p>
      ))}
    </footer>
  );
}
