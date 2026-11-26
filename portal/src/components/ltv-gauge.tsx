export function LtvGauge({ ltv }: { ltv: number | null }) {
  const pct = ltv == null ? 0 : Math.max(0, Math.min(ltv, 100));
  const length = Math.PI * 42;
  const dash = (pct / 100) * length;
  return (
    <div className="stat gauge">
      <svg viewBox="0 0 120 72" role="img" aria-label={ltv == null ? "Loan to value not set" : `Loan to value ${ltv}%`}>
        <path d="M12 62 A48 48 0 0 1 108 62" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M12 62 A48 48 0 0 1 108 62"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${length}`}
        />
        <text x="60" y="58" textAnchor="middle" fontSize="18" fontWeight="700">
          {ltv == null ? "—" : `${ltv}%`}
        </text>
      </svg>
      <span>Loan to value</span>
    </div>
  );
}
