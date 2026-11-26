"use client";

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { BrandMark } from "@/components/brand-mark";
import { DealDeck } from "@/components/deal-deck";
import { TaskList } from "@/components/task-list";
import { COST_INTRO, COST_LINES } from "@/lib/costs";
import { formatLondonDay } from "@/lib/format";
import type { BorrowerPortal } from "@/lib/portal-data";
import { PANEL_FIRMS, SOLICITOR_DISCLOSURE } from "@/lib/solicitors";
import type { Vertical } from "@/lib/verticals";
import { POSFIN_PHONE_DISPLAY, POSFIN_PHONE_TEL, whatsappHref } from "@/lib/verticals";

const STEP_LABELS = ["KYC", "Solicitor", "Race card", "Costs"] as const;

type RealtimeConfig = { url: string; anonKey: string; topic: string } | null;

export function PortalApp({
  brand,
  portal: initial,
  token,
  greeting,
  realtime,
}: {
  brand: Vertical;
  portal: BorrowerPortal;
  token: string;
  greeting: string;
  realtime: RealtimeConfig;
}) {
  const [portal, setPortal] = useState(initial);
  const [step, setStep] = useState(() => openingStep(initial));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [pending, setPending] = useState(false);
  const [firmId, setFirmId] = useState(initial.solicitor?.route === "panel" ? initial.solicitor.firmId ?? "" : "");
  const [own, setOwn] = useState(initial.solicitor?.route === "own");
  const [ownFirm, setOwnFirm] = useState(initial.solicitor?.route === "own" ? initial.solicitor.firmName : "");
  const [ownContact, setOwnContact] = useState(initial.solicitor?.route === "own" ? initial.solicitor.contactName : "");
  const [ownEmail, setOwnEmail] = useState(initial.solicitor?.route === "own" ? initial.solicitor.email : "");
  const [ownPhone, setOwnPhone] = useState(initial.solicitor?.route === "own" ? initial.solicitor.phone : "");

  const refresh = useCallback(async () => {
    if (initial.mode !== "live") return;
    const response = await fetch(`/api/portal/${encodeURIComponent(token)}?vertical=${encodeURIComponent(brand.id)}`, { cache: "no-store" });
    if (!response.ok) return;
    const body = (await response.json()) as { portal?: BorrowerPortal };
    if (body.portal) setPortal(body.portal);
  }, [brand.id, initial.mode, token]);

  useEffect(() => {
    if (initial.mode !== "live") return;
    let alive = true;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refresh().then(() => {
        if (!alive) return;
      });
    }, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [initial.mode, refresh]);

  useEffect(() => {
    if (!realtime || initial.mode !== "live") return;
    let alive = true;
    let unsubscribe: (() => Promise<unknown>) | null = null;
    void (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      if (!alive) return;
      const client = createClient(realtime.url, realtime.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const channel = client.channel(realtime.topic, {
        config: { broadcast: { self: false }, private: false },
      });
      channel.on("broadcast", { event: "deck" }, () => {
        if (alive) void refresh();
      });
      channel.subscribe();
      unsubscribe = () => client.removeChannel(channel);
    })();
    return () => {
      alive = false;
      if (unsubscribe) void unsubscribe();
    };
  }, [initial.mode, realtime, refresh]);

  async function postJson(path: string, payload: object) {
    setPending(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch(`${path}?vertical=${encodeURIComponent(brand.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { portal?: BorrowerPortal; error?: string };
      if (!response.ok || !body.portal) {
        setError("We couldn't save that. Please try again, or WhatsApp your broker.");
        return;
      }
      setPortal(body.portal);
      return body.portal;
    } catch {
      setError("We couldn't save that. Please try again, or WhatsApp your broker.");
    } finally {
      setPending(false);
    }
  }

  async function onFile(kind: "photo_id" | "proof_of_address", file: File | null) {
    if (!file) return;
    setPending(true);
    setError("");
    setSaved("");
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      body.set("echo", JSON.stringify(echoState(portal)));
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}/kyc?vertical=${encodeURIComponent(brand.id)}`, {
        method: "POST",
        body,
      });
      const json = (await response.json()) as { portal?: BorrowerPortal };
      if (!response.ok || !json.portal) {
        setError("We couldn't take that file. Use a photo or PDF under 8MB, or WhatsApp it to your broker.");
        return;
      }
      setPortal(json.portal);
      setSaved("Received. Your broker can see it on the case.");
    } catch {
      setError("We couldn't take that file. You can also send it on WhatsApp.");
    } finally {
      setPending(false);
    }
  }

  async function onSolicitor(event: FormEvent) {
    event.preventDefault();
    const payload = own
      ? { route: "own", firm: ownFirm, contact: ownContact, email: ownEmail, phone: ownPhone, kyc: echoState(portal).kyc }
      : { route: "panel", firmId, kyc: echoState(portal).kyc };
    const next = await postJson(`/api/portal/${encodeURIComponent(token)}/solicitor`, payload);
    if (!next?.solicitor) return;
    if (next.solicitor.posfin_introduced && next.solicitor.introduced_at) {
      setSaved(`${next.solicitor.firmName} selected. Posfin introduced you on ${formatLondonDay(next.solicitor.introduced_at)}.`);
    } else {
      setSaved("Your own solicitor's details are with your broker.");
    }
  }

  const help = `Hi ${brand.name}, I'm on my deal link and I'd like to talk it through.`;

  return (
    <div className="page" data-vertical={brand.id} style={brand.vars as CSSProperties}>
      <main className="frame">
        <header className="topbar">
          <div>
            <BrandMark name={brand.wordmark} />
            <p className="tagline">{brand.tagline}</p>
          </div>
          {portal.mode === "live" ? <span className="live-dot">Live</span> : null}
        </header>
        {portal.example ? (
          <p className="example">
            <span>
              <strong>Example data</strong>
              This is a fictional case so you can preview the deal home. It is not a live borrower.
            </span>
          </p>
        ) : null}
        <div className="layout">
          <div className="deck-wrap">
            <DealDeck portal={portal} greeting={greeting} />
          </div>
          <div>
            <TaskList portal={portal} />
            <section className="card wizard" aria-labelledby="flow-heading" style={{ marginTop: 16 }}>
              <h2 id="flow-heading" className="sr-only">Your next steps</h2>
              <div className="steps" role="tablist" aria-label="Guided steps">
                {STEP_LABELS.map((label, index) => (
                  <button key={label} type="button" role="tab" aria-selected={step === index} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}>
                    <b>Step {index + 1}</b>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="panel" role="tabpanel">
                {step === 0 ? <KycStep portal={portal} pending={pending} onFile={onFile} /> : null}
                {step === 1 ? (
                  <SolicitorStep
                    pending={pending}
                    firmId={firmId}
                    own={own}
                    ownFirm={ownFirm}
                    ownContact={ownContact}
                    ownEmail={ownEmail}
                    ownPhone={ownPhone}
                    onFirm={(id) => { setOwn(false); setFirmId(id); }}
                    onOwn={() => setOwn(true)}
                    onOwnFirm={setOwnFirm}
                    onOwnContact={setOwnContact}
                    onOwnEmail={setOwnEmail}
                    onOwnPhone={setOwnPhone}
                    onSubmit={onSolicitor}
                  />
                ) : null}
                {step === 2 ? <RaceStep portal={portal} /> : null}
                {step === 3 ? <CostStep regulated={portal.loan.regulated} /> : null}
                {error ? <p className="alert" role="alert">{error}</p> : null}
                {saved ? <p className="saved" role="status">{saved}</p> : null}
                <div className="actions">
                  <button className="btn ghost" type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>Back</button>
                  <button className="btn" type="button" onClick={() => setStep((value) => Math.min(3, value + 1))} disabled={step === 3}>Continue</button>
                </div>
              </div>
            </section>
            <div className="contact-row">
              <a className="btn" href={whatsappHref(help)}>WhatsApp your broker</a>
              <a className="btn ghost" href={`tel:${POSFIN_PHONE_TEL}`}>Call {POSFIN_PHONE_DISPLAY}</a>
            </div>
          </div>
        </div>
        <p className="footer">{brand.footer}</p>
      </main>
    </div>
  );
}

function openingStep(portal: BorrowerPortal): number {
  const kycDone = portal.kyc.photoId.done && portal.kyc.proofOfAddress.done;
  if (!kycDone) return 0;
  if (!portal.solicitor) return 1;
  return 2;
}

function echoState(portal: BorrowerPortal) {
  return {
    kyc: {
      photoId: portal.kyc.photoId.done,
      proofOfAddress: portal.kyc.proofOfAddress.done,
      photoName: portal.kyc.photoId.filename,
      addressName: portal.kyc.proofOfAddress.filename,
    },
    solicitor: portal.solicitor,
  };
}

function KycStep({
  portal,
  pending,
  onFile,
}: {
  portal: BorrowerPortal;
  pending: boolean;
  onFile: (kind: "photo_id" | "proof_of_address", file: File | null) => void;
}) {
  return (
    <>
      <h2>Identity check</h2>
      <p className="lede">Two documents open the rest of the case. A clear photo or PDF is enough. We only use them to know who you are and where you live.</p>
      <div className="check">
        <p><b>Photo ID</b><small>Passport, or the front and back of a UK driving licence.</small></p>
        <span className="file">
          {portal.kyc.photoId.done ? <span className="done-flag">Received{portal.kyc.photoId.filename ? ` · ${portal.kyc.photoId.filename}` : ""}</span> : null}
          <input aria-label="Upload photo ID" type="file" accept="image/*,application/pdf" disabled={pending} onChange={(event) => onFile("photo_id", event.target.files?.[0] ?? null)} />
        </span>
      </div>
      <div className="check">
        <p><b>Proof of address</b><small>A utility bill, council tax bill, or bank statement from the last 3 months.</small></p>
        <span className="file">
          {portal.kyc.proofOfAddress.done ? <span className="done-flag">Received{portal.kyc.proofOfAddress.filename ? ` · ${portal.kyc.proofOfAddress.filename}` : ""}</span> : null}
          <input aria-label="Upload proof of address" type="file" accept="image/*,application/pdf" disabled={pending} onChange={(event) => onFile("proof_of_address", event.target.files?.[0] ?? null)} />
        </span>
      </div>
    </>
  );
}

function SolicitorStep(props: {
  pending: boolean;
  firmId: string;
  own: boolean;
  ownFirm: string;
  ownContact: string;
  ownEmail: string;
  ownPhone: string;
  onFirm: (id: string) => void;
  onOwn: () => void;
  onOwnFirm: (value: string) => void;
  onOwnContact: (value: string) => void;
  onOwnEmail: (value: string) => void;
  onOwnPhone: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <h2>Solicitor</h2>
      <p className="lede">You can use a firm you already know, or pick from the optional panel. Either is fine.</p>
      <p className="disclosure">{SOLICITOR_DISCLOSURE}</p>
      <div className="firms">
        {PANEL_FIRMS.map((firm) => (
          <label className="firm" key={firm.id}>
            <input type="radio" name="solicitor" checked={!props.own && props.firmId === firm.id} onChange={() => props.onFirm(firm.id)} />
            <span>
              <b>{firm.knownAs}</b>
              <small>{firm.contact} · {firm.area} · {firm.onAccount} · {firm.pace}</small>
            </span>
          </label>
        ))}
        <label className="firm">
          <input type="radio" name="solicitor" checked={props.own} onChange={props.onOwn} />
          <span>
            <b>Use my own solicitor</b>
            <small>Tell us the firm and who to speak to.</small>
          </span>
        </label>
      </div>
      {props.own ? (
        <div className="own">
          <label>Firm<input value={props.ownFirm} onChange={(event) => props.onOwnFirm(event.target.value)} required autoComplete="organization" /></label>
          <label>Contact name<input value={props.ownContact} onChange={(event) => props.onOwnContact(event.target.value)} required autoComplete="name" /></label>
          <label>Email<input type="email" value={props.ownEmail} onChange={(event) => props.onOwnEmail(event.target.value)} required autoComplete="email" /></label>
          <label>Phone<input type="tel" value={props.ownPhone} onChange={(event) => props.onOwnPhone(event.target.value)} required autoComplete="tel" /></label>
        </div>
      ) : null}
      <div className="actions">
        <button className="btn" type="submit" disabled={props.pending || (!props.own && !props.firmId)}>Save solicitor</button>
      </div>
    </form>
  );
}

function RaceStep({ portal }: { portal: BorrowerPortal }) {
  const avm = portal.valuation.route === "avm";
  return (
    <>
      <h2>Race card</h2>
      <p className="lede">How the valuation route and the headline options sit for this case. These are illustrations for the conversation with your broker. They are not offers.</p>
      <div className="race">
        <article className="choice" data-on={avm ? "yes" : "no"}>
          <h3>Automated valuation</h3>
          <p>{portal.valuation.avmLabel} AVM · {portal.valuation.worksLabel}. {avm ? portal.valuation.routeReason : "Not the route for this case."}</p>
        </article>
        <article className="choice" data-on={avm ? "no" : "yes"}>
          <h3>Full valuation</h3>
          <p>{avm ? "Held in reserve, if a lender asks for an inspection." : portal.valuation.routeReason}</p>
        </article>
      </div>
      <div>
        {portal.lenders.map((lender) => (
          <article className="lender" key={lender.name}>
            <b>{lender.name}</b>
            <span>{lender.headline}{lender.term ? ` · ${lender.term}` : ""}</span>
            {lender.note ? <p className="note">{lender.note}</p> : null}
          </article>
        ))}
      </div>
    </>
  );
}

function CostStep({ regulated }: { regulated: boolean | null }) {
  const framing = regulated === true
    ? "This looks like a regulated mortgage contract, because the property is a home. That brings extra protections. The costs below are the same shape either way."
    : regulated === false
      ? "This looks like an unregulated bridging or investment loan. Posfin still arranges it as your broker. The costs below are genuine processing costs."
      : "Your broker will confirm whether the contract is regulated. The costs below are the same shape either way.";
  return (
    <>
      <h2>Costs</h2>
      <p className="lede">{framing} {COST_INTRO}</p>
      {COST_LINES.map((line) => (
        <article key={line.id} className={line.emphasis === "hero" ? "hero-cost" : line.emphasis === "callout" ? "callout" : "cost"}>
          <h3>{line.title}</h3>
          <p>{line.body}</p>
        </article>
      ))}
    </>
  );
}
