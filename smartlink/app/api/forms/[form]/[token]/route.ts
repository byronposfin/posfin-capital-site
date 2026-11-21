import { NextResponse } from "next/server";
import { crmExport, ctxFrom, derivedFor, readJson, resolve, resolveBrand, type RouteParams } from "@/lib/api";
import { storage } from "@/lib/storage";
import { isStorageUnavailable } from "@/lib/storage/supabase";
import type { Answers } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

/** GET draft (or null) for a case token. */
export async function GET(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  try {
    const draft = await storage().getDraft(r.form, r.token);
    return NextResponse.json({ case: { ref: r.c.ref, demo: r.c.demo, flags: r.c.flags }, draft }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (!isStorageUnavailable(e)) throw e;
    console.error(`[smartlink] storage unavailable form=${r.form}: ${e.message}`);
    return NextResponse.json({ case: { ref: r.c.ref, demo: r.c.demo, flags: r.c.flags }, draft: null, storage: "unavailable" }, { headers: { "cache-control": "no-store" } });
  }
}

/** PUT autosave. Body: { answers, step, brand? }. Never logs payloads. */
export async function PUT(req: Request, ctx: RouteParams) {
  const r = await resolve(req, ctx);
  if ("error" in r) return r.error;
  const body = await readJson(req);
  if (!body || typeof body.answers !== "object" || body.answers === null) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const prev = await storage().getDraft(r.form, r.token);
  if (prev?.status === "submitted") return NextResponse.json({ error: "already submitted" }, { status: 409 });
  const brand = resolveBrand(String(body.brand ?? ""), r.form, r.c.brand?.[r.form]);
  const answers = body.answers as Answers;
  const step = Number.isFinite(Number(body.step)) ? Number(body.step) : 0;
  const c2 = ctxFrom(r.c, r.sp, body.flags);
  try {
    const saved = await storage().saveDraft(r.form, r.token, { answers, step, derived: derivedFor(r.form, answers), export: crmExport(r.form, r.c, brand, c2, { answers, status: "draft" }) });
    return NextResponse.json({ ok: true, version: saved.version, updated_at: saved.updated_at }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(`[smartlink] save failed form=${r.form}: ${(e as Error).message}`);
    if (isStorageUnavailable(e)) return NextResponse.json({ error: "storage unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
