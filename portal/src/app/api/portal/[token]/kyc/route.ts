import { allowedKycMime, KYC_MAX_BYTES, safeFilename } from "@/lib/kyc-file";
import { kycFlagsFrom, saveKycItem, uploadKycFile, type KycFlags } from "@/lib/portal-data";
import { selectPanelSolicitor, submitOwnSolicitor, type SolicitorSelection } from "@/lib/solicitors";
import { isDemoToken, isPortalToken } from "@/lib/token";
import { resolveVertical } from "@/lib/verticals";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const vertical = new URL(request.url).searchParams.get("vertical") ?? "";
  const brand = resolveVertical(vertical);
  if (!brand || !isPortalToken(token)) {
    return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  const contentType = request.headers.get("content-type") ?? "";
  const parsed = contentType.includes("multipart/form-data") ? await fromForm(request) : await fromJson(request);
  if (!parsed) return Response.json({ error: "invalid" }, { status: 400, headers: NO_STORE });

  if (parsed.file && !isDemoToken(token)) {
    const result = await uploadKycFile({
      vertical: brand.id,
      token,
      kind: parsed.kind,
      filename: parsed.filename,
      bytes: parsed.file.bytes,
      mime: parsed.file.mime,
    });
    return jsonResult(result);
  }

  const result = await saveKycItem({
    vertical: brand.id,
    token,
    kind: parsed.kind,
    filename: parsed.filename,
    demoKyc: isDemoToken(token) ? parsed.kyc : null,
    demoSolicitor: isDemoToken(token) ? parsed.solicitor : null,
  });
  return jsonResult(result);
}

function jsonResult(result: Awaited<ReturnType<typeof saveKycItem>>) {
  if (!result.ok) {
    const status = result.reason === "unavailable" ? 503 : 404;
    return Response.json({ error: result.reason }, { status, headers: NO_STORE });
  }
  return Response.json({ portal: result.portal }, { headers: NO_STORE });
}

async function fromJson(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return null;
  const kind = kindOf(body.kind);
  if (!kind) return null;
  return {
    kind,
    filename: safeFilename(String(body.filename ?? "document")),
    kyc: kycFlagsFrom(body.kyc),
    solicitor: solicitorEcho(body.solicitor),
    file: null as null | { bytes: Uint8Array; mime: string },
  };
}

async function fromForm(request: Request) {
  const form = await request.formData();
  const kind = kindOf(form.get("kind"));
  if (!kind) return null;
  const echo = parseEcho(form.get("echo"));
  const file = form.get("file");
  if (!(file instanceof File)) {
    return { kind, filename: "document", kyc: echo.kyc, solicitor: echo.solicitor, file: null as null | { bytes: Uint8Array; mime: string } };
  }
  if (file.size <= 0 || file.size > KYC_MAX_BYTES || !allowedKycMime(file.type || "application/octet-stream")) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    kind,
    filename: safeFilename(file.name),
    kyc: echo.kyc,
    solicitor: echo.solicitor,
    file: { bytes, mime: (file.type || "application/octet-stream").split(";")[0].trim().toLowerCase() },
  };
}

function kindOf(value: unknown): "photo_id" | "proof_of_address" | null {
  return value === "photo_id" || value === "proof_of_address" ? value : null;
}

function parseEcho(value: FormDataEntryValue | null): { kyc: KycFlags; solicitor: SolicitorSelection | null } {
  if (typeof value !== "string") return { kyc: kycFlagsFrom(null), solicitor: null };
  try {
    const parsed = JSON.parse(value) as { kyc?: unknown; solicitor?: unknown };
    return { kyc: kycFlagsFrom(parsed.kyc), solicitor: solicitorEcho(parsed.solicitor) };
  } catch {
    return { kyc: kycFlagsFrom(null), solicitor: null };
  }
}

function solicitorEcho(value: unknown): SolicitorSelection | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.route === "panel") {
    const selected = selectPanelSolicitor(String(row.firmId ?? ""));
    if ("error" in selected) return null;
    if (typeof row.introduced_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.introduced_at)) {
      return { ...selected, introduced_at: row.introduced_at };
    }
    return selected;
  }
  if (row.route === "own") {
    const selected = submitOwnSolicitor({
      firm: row.firmName,
      contact: row.contactName,
      email: row.email,
      phone: row.phone,
    });
    return "error" in selected ? null : selected;
  }
  return null;
}
