import { kycFlagsFrom, saveSolicitorChoice } from "@/lib/portal-data";
import { selectPanelSolicitor, submitOwnSolicitor } from "@/lib/solicitors";
import { isPortalToken } from "@/lib/token";
import { resolveVertical } from "@/lib/verticals";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const vertical = new URL(request.url).searchParams.get("vertical") ?? "";
  const brand = resolveVertical(vertical);
  if (!brand || !isPortalToken(token)) {
    return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "invalid" }, { status: 400, headers: NO_STORE });
  const selection = body.route === "own"
    ? submitOwnSolicitor(body)
    : selectPanelSolicitor(String(body.firmId ?? ""));
  if ("error" in selection) return Response.json({ error: selection.error }, { status: 400, headers: NO_STORE });
  const result = await saveSolicitorChoice({
    vertical: brand.id,
    token,
    selection,
    demoKyc: token === "demo" ? kycFlagsFrom(body.kyc) : null,
  });
  if (!result.ok) {
    const status = result.reason === "unavailable" ? 503 : 404;
    return Response.json({ error: result.reason }, { status, headers: NO_STORE });
  }
  return Response.json({ portal: result.portal }, { headers: NO_STORE });
}
