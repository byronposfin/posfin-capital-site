import { loadBorrowerPortal } from "@/lib/portal-data";
import { isPortalToken } from "@/lib/token";
import { resolveVertical } from "@/lib/verticals";

const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const vertical = new URL(request.url).searchParams.get("vertical") ?? "";
  const brand = resolveVertical(vertical);
  if (!brand || !isPortalToken(token)) {
    return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const result = await loadBorrowerPortal({ vertical: brand.id, token });
  if (!result.ok) {
    const status = result.reason === "unavailable" ? 503 : 404;
    return Response.json({ error: result.reason }, { status, headers: NO_STORE });
  }
  return Response.json({ portal: result.portal }, { headers: NO_STORE });
}
