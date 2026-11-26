import type { Metadata } from "next";
import { InvalidLink } from "@/components/invalid-link";
import { PortalApp } from "@/components/portal-app";
import { londonGreeting } from "@/lib/format";
import { loadBorrowerPortal } from "@/lib/portal-data";
import { realtimePublicConfig } from "@/lib/supabase-admin";
import { isDemoToken, isPortalToken, portalTopic } from "@/lib/token";
import { FALLBACK_VERTICAL, resolveVertical } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ vertical: string; token: string }> }): Promise<Metadata> {
  const { vertical, token } = await params;
  const brand = resolveVertical(vertical);
  const example = token === "demo";
  return {
    title: brand ? `${example ? "Example · " : ""}${brand.name}` : "Link not active",
    robots: { index: false, follow: false },
  };
}

export default async function BorrowerPortalPage({ params }: { params: Promise<{ vertical: string; token: string }> }) {
  const { vertical, token } = await params;
  const brand = resolveVertical(vertical);
  if (!brand || !isPortalToken(token)) return <InvalidLink brand={brand ?? FALLBACK_VERTICAL} reason="invalid" />;
  const result = await loadBorrowerPortal({ vertical: brand.id, token });
  if (!result.ok) return <InvalidLink brand={brand} reason={result.reason} />;
  const realtime = !isDemoToken(token) ? realtimePublicConfig() : null;
  return (
    <PortalApp
      brand={brand}
      portal={result.portal}
      token={token}
      greeting={londonGreeting()}
      realtime={realtime ? { ...realtime, topic: portalTopic(token) } : null}
    />
  );
}
