import type { CSSProperties } from "react";
import { BrandMark } from "@/components/brand-mark";
import type { Vertical } from "@/lib/verticals";
import { POSFIN_PHONE_DISPLAY, POSFIN_PHONE_TEL, whatsappHref } from "@/lib/verticals";

const COPY = {
  invalid: {
    title: "This link is not active",
    body: "The link in your WhatsApp group may have been replaced. Message or call your broker and we will send a fresh one.",
  },
  expired: {
    title: "This link has expired",
    body: "Ask your broker for a new link and we will pin it back in the group.",
  },
  unavailable: {
    title: "We can't open this link right now",
    body: "Nothing is wrong with your case. Message or call us and we will open it with you.",
  },
} as const;

export function InvalidLink({ brand, reason }: { brand: Vertical; reason: keyof typeof COPY }) {
  const copy = COPY[reason];
  const message = `Hi ${brand.name}, I need help opening my deal link.`;
  return (
    <div className="page" data-vertical={brand.id} style={brand.vars as CSSProperties}>
      <main className="frame">
        <header className="topbar">
          <BrandMark name={brand.wordmark} />
        </header>
        <article className="card fallback">
          <p className="kicker">{brand.name}</p>
          <h1>{copy.title}</h1>
          <p className="lede">{copy.body}</p>
          <div className="contact-row">
            <a className="btn" href={whatsappHref(message)}>WhatsApp</a>
            <a className="btn ghost" href={`tel:${POSFIN_PHONE_TEL}`}>Call {POSFIN_PHONE_DISPLAY}</a>
          </div>
        </article>
        <p className="footer">{brand.footer}</p>
      </main>
    </div>
  );
}
