import type { CSSProperties } from "react";
import { BrandMark } from "@/components/brand-mark";
import { FCA_FOOTER, listVerticals } from "@/lib/verticals";

export default function HomePage() {
  const brands = listVerticals();
  return (
    <div className="page" data-vertical="posfin-capital" style={brands[0].vars as CSSProperties}>
      <main className="frame">
        <header className="topbar">
          <BrandMark name="Posfin Capital" />
        </header>
        <p className="example">
          <span>
            <strong>Preview</strong>
            Open an example deal home. Live links use an unguessable token and are not listed here.
          </span>
        </p>
        <div className="home-grid">
          {brands.map((brand) => (
            <a key={brand.id} className="card home-card" href={`/${brand.id}/portal/demo`}>
              <p className="kicker">{brand.name}</p>
              <h2 className="address">{brand.tagline}</h2>
              <small>Example data · /{brand.id}/portal/demo</small>
            </a>
          ))}
        </div>
        <p className="footer">{FCA_FOOTER}</p>
      </main>
    </div>
  );
}
