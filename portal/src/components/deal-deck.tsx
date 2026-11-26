import { LtvGauge } from "@/components/ltv-gauge";
import { formatLondonStamp } from "@/lib/format";
import type { BorrowerPortal } from "@/lib/portal-data";

export function DealDeck({ portal, greeting }: { portal: BorrowerPortal; greeting: string }) {
  const first = portal.borrowerName.split(/\s+/)[0] || "there";
  const facts = [portal.property.type, portal.property.beds ? `${portal.property.beds} bed` : "", portal.property.tenure].filter(Boolean);
  return (
    <article className="card deck">
      <p className="kicker">{portal.mode === "live" ? "Live deal" : "Deal deck"}</p>
      <p className="hello">{greeting}, {first}</p>
      <p className="display">{portal.loan.amountLabel}</p>
      <p className="purpose">{portal.loan.purpose || "Loan request"} · {portal.loan.termLabel}</p>
      <h2 className="address">{portal.property.address}</h2>
      <p className="meta">{[portal.property.postcode, portal.reference].filter(Boolean).join(" · ")}</p>
      <div className="chips">
        {facts.map((fact) => <span className="chip" key={fact}>{fact}</span>)}
        <span className="chip">{portal.loan.regulated === true ? "Regulated" : portal.loan.regulated === false ? "Unregulated" : "Regulation to confirm"}</span>
      </div>
      <div className="stats">
        <div className="stat">
          <span>AVM / estimated value</span>
          <strong>{portal.valuation.avmLabel !== "—" ? portal.valuation.avmLabel : portal.valuation.estimateLabel}</strong>
        </div>
        <LtvGauge ltv={portal.ltv} />
      </div>
      {portal.property.summary ? <p className="summary">{portal.property.summary}</p> : null}
      {portal.redemption ? (
        <p className="meta">To clear the existing mortgage: {portal.redemption.amountLabel}{portal.redemption.asOf ? ` · ${portal.redemption.asOf}` : ""}</p>
      ) : null}
      <div className="lamp" data-ready={portal.deckReady ? "yes" : "no"}>
        <div className="lamp-bulb" aria-hidden="true" />
        <p className="when">
          <span className="lamp-kicker">{portal.deckReady ? "Green light" : "In progress"}</span>
          <span className="lamp-text">{portal.deckReady ? "Deck ready for lender placement" : "Your broker is still completing the deck"}</span>
        </p>
      </div>
      <ol className="timeline">
        {portal.timeline.map((item) => (
          <li key={item.id} data-state={item.state}>
            <span className="rail"><span className="dot" /><span className="stem" /></span>
            <p className="when">{item.label}{item.detail ? <small>{item.detail}</small> : null}</p>
          </li>
        ))}
      </ol>
      <p className="meta">{portal.mode === "live" ? "Updates when your broker saves the case." : "Example timeline."} {formatLondonStamp(portal.updatedAt)}</p>
    </article>
  );
}
