import { demoEnvelope } from "@/lib/demo";
import { formatGbp, parseMoney } from "@/lib/format";
import {
  findPanelFirm,
  selectPanelSolicitor,
  submitOwnSolicitor,
  type SolicitorSelection,
} from "@/lib/solicitors";
import { adminClient, supabaseConfigured } from "@/lib/supabase-admin";
import { normaliseTasks, progressPct, type BorrowerTask, type TaskStatus } from "@/lib/tasks";
import { hashToken, isDemoToken, isPortalToken } from "@/lib/token";
import { resolveVertical } from "@/lib/verticals";

const BANNED_TEXT: readonly RegExp[] = [
  /\bBROKA\b/i,
  /\b1st\s+charge\b/i,
  /\b2nd\s+charge\b/i,
  /\b3rd\s+charge\b/i,
  /\b1st\s*\/\s*2nd\s+charges?\b/i,
  /\bfirst\s+charge\b/i,
  /\bsecond\s+charge\b/i,
  /\bthird\s+charge\b/i,
  /\bproc(?:uration)?(?:[\s_-]*fees?)?\b/i,
  /\bbroker[\s_-]*fees?\b/i,
  /\bcommissions?\b/i,
  /\bsuccess[\s_-]*fees?\b/i,
  /\bintroducers?\b/i,
];

const BANNED_KEY = /broka|broker.?fee|proc(?:uration|_fee|[\s_-]*fee)|commission|success.?fee|introducer|charge_rank|staff.?note|internal.?note|fee_owed|broker_only|\b1st\b|\b2nd\b/i;

const SCRUBBERS: readonly [RegExp, string][] = [
  [/\bBROKA\b/gi, ""],
  [/\b1st\s*\/\s*2nd\s+charges?\b/gi, "existing mortgage"],
  [/\b(?:1st|2nd|3rd|first|second|third)\s+charges?\b/gi, "existing mortgage"],
  [/\bbroker[\s_-]*fees?\b/gi, ""],
  [/\bproc(?:uration)?[\s_-]*fees?\b/gi, ""],
  [/\bprocuration\b/gi, ""],
  [/\bsuccess[\s_-]*fees?\b/gi, ""],
  [/\bintroducers?\b/gi, ""],
  [/\bcommissions?\b/gi, ""],
];

export class UnsafeBorrowerPayload extends Error {
  constructor() {
    super("borrower_payload_unsafe");
  }
}

export type WorksKind = "none" | "light" | "heavy" | "build";

export type BorrowerPortal = {
  mode: "demo" | "live";
  example: boolean;
  vertical: string;
  reference: string;
  borrowerName: string;
  updatedAt: string;
  deckReady: boolean;
  property: {
    address: string;
    postcode: string;
    type: string;
    beds: string;
    tenure: string;
    summary: string;
  };
  loan: {
    amount: number | null;
    amountLabel: string;
    purpose: string;
    termMonths: number | null;
    termLabel: string;
    regulated: boolean | null;
    regulationLabel: string;
  };
  valuation: {
    avm: number | null;
    avmLabel: string;
    estimate: number | null;
    estimateLabel: string;
    works: WorksKind;
    worksLabel: string;
    route: "avm" | "full";
    routeLabel: string;
    routeReason: string;
  };
  ltv: number | null;
  redemption: { amountLabel: string; asOf: string } | null;
  timeline: { id: string; label: string; detail: string; state: TaskStatus }[];
  tasks: BorrowerTask[];
  progressPct: number;
  lenders: { name: string; headline: string; term: string; note: string }[];
  kyc: {
    photoId: { done: boolean; filename: string };
    proofOfAddress: { done: boolean; filename: string };
  };
  solicitor: SolicitorSelection | null;
};

export type BuildOptions = {
  vertical: string;
  mode: "demo" | "live";
  example: boolean;
  now?: Date;
};

export type PortalResult =
  | { ok: true; portal: BorrowerPortal }
  | { ok: false; reason: "invalid" | "expired" | "unavailable" };

type LinkRow = {
  id: string;
  vertical: string;
  case_ref: string | null;
  borrower_name: string | null;
  source: unknown;
  borrower_state: unknown;
  deck_ready: boolean | null;
  expires_at: string | null;
  revoked_at: string | null;
  updated_at: string | null;
};

const REGISTER_COLUMNS =
  "case_ref, security_summary, security_postcode_district, gross_facility, valuation_figure, ltv_pct, term_months, target_completion_date, stage, is_regulated";

export function serializeBorrowerPayload(input: unknown, options: BuildOptions): string {
  return JSON.stringify(buildBorrowerPortal(input, options));
}

export function buildBorrowerPortal(input: unknown, options: BuildOptions): BorrowerPortal {
  const now = options.now ?? new Date();
  const envelope = asRecord(input) ?? {};
  const wrapped = "source" in envelope || "borrower_state" in envelope || "register" in envelope || "deck_ready" in envelope;
  const source = wrapped ? asRecord(envelope.source) ?? {} : envelope;
  const register = asRecord(envelope.register);
  const state = asRecord(envelope.borrower_state) ?? {};
  const property = asRecord(source.property) ?? {};
  const loan = asRecord(source.loan) ?? {};
  const valuation = asRecord(source.valuation) ?? {};

  const address = text(first(property.address, source.property_address, source.address), 180) || "Address to be confirmed";
  const postcode = text(first(property.postcode, source.postcode, register?.security_postcode_district), 16);
  const summary = text(first(property.summary, source.summary, register?.security_summary), 360);
  const loanAmount = parseMoney(first(loan.amount, source.loan_amount, source.gross_facility, register?.gross_facility));
  const avm = parseMoney(first(valuation.avm, source.avm, valuation.estimate, source.estimated_value));
  const estimate = parseMoney(first(valuation.estimate, source.estimated_value, register?.valuation_figure, avm));
  let ltv = finite(first(source.ltv_pct, source.ltv, loan.ltv_pct, register?.ltv_pct));
  const valueForLtv = avm ?? estimate;
  if (ltv == null && loanAmount && valueForLtv) ltv = Math.round((loanAmount / valueForLtv) * 1000) / 10;
  if (ltv != null) ltv = Math.round(ltv * 10) / 10;

  const works = worksOf(first(valuation.works, source.works));
  const route = valuationRoute(ltv, works);
  const regulated = boolish(first(loan.regulated, source.is_regulated, source.regulated, register?.is_regulated));
  const termMonths = whole(first(loan.term_months, source.term_months, register?.term_months));
  const stage = typeof register?.stage === "string" ? register.stage : typeof source.stage === "string" ? source.stage : null;
  const kyc = kycOf(state);
  const solicitor = cleanSelection(solicitorOf(state));
  const tasks = tidyTasks(applyProgress(normaliseTasks(source.tasks, stage), kyc, solicitor));
  const redemption = redemptionOf(asRecord(source.redemption) ?? asRecord(source.redemption_figure));

  const portal: BorrowerPortal = {
    mode: options.mode,
    example: options.example,
    vertical: options.vertical,
    reference: text(first(envelope.case_ref, source.reference, source.case_ref, register?.case_ref), 40) || "Case",
    borrowerName: text(first(envelope.borrower_name, source.borrower_name, source.client_name), 80) || "there",
    updatedAt: typeof envelope.updated_at === "string" ? envelope.updated_at : now.toISOString(),
    deckReady: envelope.deck_ready == null ? flag(source.deck_ready) : flag(envelope.deck_ready),
    property: {
      address,
      postcode,
      type: text(first(property.type, source.property_type), 60),
      beds: text(first(property.beds, source.beds), 12),
      tenure: text(first(property.tenure, source.tenure), 40),
      summary,
    },
    loan: {
      amount: loanAmount,
      amountLabel: formatGbp(loanAmount),
      purpose: text(first(loan.purpose, source.purpose), 180),
      termMonths,
      termLabel: termMonths ? `${termMonths} months` : "Term to be agreed",
      regulated,
      regulationLabel:
        regulated === true
          ? "Regulated — you live, or will live, in the property"
          : regulated === false
            ? "Unregulated — an investment or bridging case"
            : "Your broker will confirm whether this is regulated",
    },
    valuation: {
      avm,
      avmLabel: formatGbp(avm),
      estimate,
      estimateLabel: formatGbp(estimate),
      works,
      worksLabel: WORKS_LABEL[works],
      route,
      routeLabel: route === "avm" ? "Automated valuation" : "Full valuation",
      routeReason: routeReason(route, ltv, works),
    },
    ltv,
    redemption,
    timeline: timelineOf(source, tasks),
    tasks,
    progressPct: progressPct(tasks),
    lenders: lendersOf(source),
    kyc,
    solicitor,
  };

  assertBorrowerSafe(portal);
  return portal;
}

export function valuationRoute(ltv: number | null, works: WorksKind): "avm" | "full" {
  if (works === "heavy" || works === "build") return "full";
  if (ltv != null && ltv > 65) return "full";
  return "avm";
}

export function assertBorrowerSafe(value: unknown): void {
  walk(value, (key) => {
    if (BANNED_KEY.test(key)) throw new UnsafeBorrowerPayload();
  }, (textValue) => {
    if (BANNED_TEXT.some((pattern) => pattern.test(textValue))) throw new UnsafeBorrowerPayload();
  });
}

export async function loadBorrowerPortal(args: { vertical: string; token: string }): Promise<PortalResult> {
  if (!resolveVertical(args.vertical) || !isPortalToken(args.token)) return { ok: false, reason: "invalid" };
  if (isDemoToken(args.token)) {
    try {
      return {
        ok: true,
        portal: buildBorrowerPortal(demoEnvelope(args.vertical), {
          vertical: args.vertical,
          mode: "demo",
          example: true,
        }),
      };
    } catch (error) {
      console.error(error instanceof UnsafeBorrowerPayload ? error.message : "borrower_portal_demo_failed");
      return { ok: false, reason: "unavailable" };
    }
  }
  if (!supabaseConfigured()) return { ok: false, reason: "unavailable" };
  try {
    const loaded = await readLink(args.vertical, args.token);
    if (!loaded.ok) return loaded;
    return { ok: true, portal: loaded.portal };
  } catch (error) {
    console.error(error instanceof UnsafeBorrowerPayload ? error.message : "borrower_portal_load_failed");
    return { ok: false, reason: "unavailable" };
  }
}

export async function saveSolicitorChoice(args: {
  vertical: string;
  token: string;
  selection: SolicitorSelection;
  demoKyc?: KycFlags | null;
}): Promise<PortalResult> {
  if (!resolveVertical(args.vertical) || !isPortalToken(args.token)) return { ok: false, reason: "invalid" };
  if (isDemoToken(args.token)) {
    const envelope = demoEnvelope(args.vertical);
    const state = asRecord(envelope.borrower_state) ?? {};
    if (args.demoKyc) state.kyc = kycRecord(args.demoKyc);
    state.solicitor = args.selection;
    envelope.borrower_state = state;
    return {
      ok: true,
      portal: buildBorrowerPortal(envelope, { vertical: args.vertical, mode: "demo", example: true }),
    };
  }
  return patchLink(args.vertical, args.token, ["solicitor"], args.selection);
}

export async function saveKycItem(args: {
  vertical: string;
  token: string;
  kind: "photo_id" | "proof_of_address";
  filename: string;
  demoSolicitor?: SolicitorSelection | null;
  demoKyc?: KycFlags | null;
}): Promise<PortalResult> {
  if (!resolveVertical(args.vertical) || !isPortalToken(args.token)) return { ok: false, reason: "invalid" };
  const filename = text(args.filename, 80) || "document";
  if (isDemoToken(args.token)) {
    const envelope = demoEnvelope(args.vertical);
    const flags = args.demoKyc ?? { photoId: false, proofOfAddress: false };
    if (args.kind === "photo_id") flags.photoId = true;
    else flags.proofOfAddress = true;
    if (args.kind === "photo_id") flags.photoName = filename;
    else flags.addressName = filename;
    const state = asRecord(envelope.borrower_state) ?? {};
    state.kyc = kycRecord(flags);
    if (args.demoSolicitor) state.solicitor = args.demoSolicitor;
    envelope.borrower_state = state;
    return {
      ok: true,
      portal: buildBorrowerPortal(envelope, { vertical: args.vertical, mode: "demo", example: true }),
    };
  }
  return patchLink(args.vertical, args.token, ["kyc", args.kind], {
    done: true,
    filename,
    at: new Date().toISOString(),
  });
}

export type KycFlags = {
  photoId: boolean;
  proofOfAddress: boolean;
  photoName?: string;
  addressName?: string;
};

export function kycFlagsFrom(value: unknown): KycFlags {
  const row = asRecord(value) ?? {};
  return {
    photoId: row.photoId === true || row.photo_id === true,
    proofOfAddress: row.proofOfAddress === true || row.proof_of_address === true,
    photoName: typeof row.photoName === "string" ? row.photoName : "",
    addressName: typeof row.addressName === "string" ? row.addressName : "",
  };
}

export async function uploadKycFile(args: {
  vertical: string;
  token: string;
  kind: "photo_id" | "proof_of_address";
  filename: string;
  bytes: Uint8Array;
  mime: string;
}): Promise<PortalResult> {
  if (isDemoToken(args.token)) {
    return saveKycItem({ vertical: args.vertical, token: args.token, kind: args.kind, filename: args.filename });
  }
  if (!supabaseConfigured()) return { ok: false, reason: "unavailable" };
  try {
    const client = adminClient();
    const row = await fetchLink(client, args.vertical, args.token);
    if (!row.ok) return row;
    const path = `${row.link.id}/${args.kind}/${crypto.randomUUID()}`;
    const uploaded = await client.storage.from("borrower-portal").upload(path, args.bytes, {
      contentType: args.mime,
      upsert: false,
    });
    if (uploaded.error) {
      console.error("borrower_portal_upload_failed");
      return { ok: false, reason: "unavailable" };
    }
    return patchLink(args.vertical, args.token, ["kyc", args.kind], {
      done: true,
      filename: text(args.filename, 80) || "document",
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error instanceof UnsafeBorrowerPayload ? error.message : "borrower_portal_upload_failed");
    return { ok: false, reason: "unavailable" };
  }
}

const WORKS_LABEL: Record<WorksKind, string> = {
  none: "No building works",
  light: "Light refurbishment",
  heavy: "Heavy refurbishment",
  build: "Building works",
};

function routeReason(route: "avm" | "full", ltv: number | null, works: WorksKind): string {
  if (route === "avm") {
    return "The loan-to-value is within the usual range for an automated valuation, and the works do not need an inspection. An AVM is the route unless a lender asks for more.";
  }
  const reasons: string[] = [];
  if (ltv != null && ltv > 65) reasons.push("the loan-to-value is above 65%");
  if (works === "heavy" || works === "build") reasons.push("there are works a desktop model cannot see");
  if (!reasons.length) reasons.push("the case needs an inspection");
  return `A full valuation is the right route because ${reasons.join(" and ")}.`;
}

function kycRecord(flags: KycFlags): Record<string, unknown> {
  return {
    photo_id: { done: flags.photoId, filename: text(flags.photoName, 80) },
    proof_of_address: { done: flags.proofOfAddress, filename: text(flags.addressName, 80) },
  };
}

async function readLink(vertical: string, token: string): Promise<PortalResult> {
  const client = adminClient();
  const row = await fetchLink(client, vertical, token);
  if (!row.ok) return row;
  const register = row.link.case_ref ? await fetchRegister(client, row.link.case_ref) : null;
  const portal = buildBorrowerPortal(
    { ...row.link, register },
    { vertical, mode: "live", example: false },
  );
  return { ok: true, portal };
}

type PatchPath = ["solicitor"] | ["kyc", "photo_id"] | ["kyc", "proof_of_address"];

/**
 * One jsonb key is written in a single UPDATE. A KYC save cannot replace a solicitor
 * choice that landed between the read and the write, or the other way round.
 */
async function patchLink(vertical: string, token: string, path: PatchPath, value: unknown): Promise<PortalResult> {
  if (!supabaseConfigured()) return { ok: false, reason: "unavailable" };
  try {
    const client = adminClient();
    const row = await fetchLink(client, vertical, token);
    if (!row.ok) return row;
    let nextValue = value;
    if (path[0] === "solicitor") {
      const existing = solicitorOf(asRecord(row.link.borrower_state) ?? {});
      const selection = value as SolicitorSelection;
      const keep =
        existing?.route === "panel" &&
        selection.route === "panel" &&
        existing.firmId === selection.firmId;
      nextValue = keep ? existing : selection;
    }
    const patched = await client.rpc("borrower_portal_patch", {
      p_id: row.link.id,
      p_token_hash: hashToken(token),
      p_path: path,
      p_value: nextValue,
    });
    if (patched.error || patched.data == null) {
      console.error("borrower_portal_save_failed");
      return { ok: false, reason: "unavailable" };
    }
    const refreshed = await fetchLink(client, vertical, token);
    if (!refreshed.ok) return refreshed;
    const register = refreshed.link.case_ref ? await fetchRegister(client, refreshed.link.case_ref) : null;
    return {
      ok: true,
      portal: buildBorrowerPortal(
        { ...refreshed.link, register },
        { vertical, mode: "live", example: false },
      ),
    };
  } catch (error) {
    console.error(error instanceof UnsafeBorrowerPayload ? error.message : "borrower_portal_save_failed");
    return { ok: false, reason: "unavailable" };
  }
}

async function fetchLink(
  client: ReturnType<typeof adminClient>,
  vertical: string,
  token: string,
): Promise<{ ok: true; link: LinkRow } | { ok: false; reason: "invalid" | "expired" | "unavailable" }> {
  const { data, error } = await client
    .from("borrower_portal_links")
    .select("id, vertical, case_ref, borrower_name, source, borrower_state, deck_ready, expires_at, revoked_at, updated_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error || !data) return { ok: false, reason: "invalid" };
  const link = data as LinkRow;
  if (link.vertical !== vertical) return { ok: false, reason: "invalid" };
  if (link.revoked_at) return { ok: false, reason: "expired" };
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, link };
}

async function fetchRegister(client: ReturnType<typeof adminClient>, caseRef: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .schema("pipeline")
    .from("case_register")
    .select(REGISTER_COLUMNS)
    .eq("case_ref", caseRef)
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

function cleanSelection(selection: SolicitorSelection | null): SolicitorSelection | null {
  if (!selection) return null;
  const firmName = text(selection.firmName, 120);
  const contactName = text(selection.contactName, 120);
  if (!firmName || !contactName) return null;
  return {
    ...selection,
    firmName,
    contactName,
    email: text(selection.email, 160),
    phone: text(selection.phone, 40),
  };
}

function solicitorOf(state: Record<string, unknown>): SolicitorSelection | null {
  const raw = asRecord(state.solicitor);
  if (!raw) return null;
  if (raw.route === "panel" && typeof raw.firmId === "string") {
    const firm = findPanelFirm(raw.firmId);
    const introducedAt = typeof raw.introduced_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.introduced_at)
      ? raw.introduced_at
      : null;
    if (!firm || raw.posfin_introduced !== true || !introducedAt) return null;
    const selected = selectPanelSolicitor(firm.id, new Date());
    if ("error" in selected) return null;
    return { ...selected, introduced_at: introducedAt };
  }
  if (raw.route === "own") {
    const selected = submitOwnSolicitor({
      firm: raw.firmName,
      contact: raw.contactName,
      email: raw.email,
      phone: raw.phone,
    });
    return "error" in selected ? null : selected;
  }
  return null;
}

function kycOf(state: Record<string, unknown>): BorrowerPortal["kyc"] {
  const kyc = asRecord(state.kyc) ?? {};
  return {
    photoId: kycItem(kyc.photo_id ?? kyc.photoId),
    proofOfAddress: kycItem(kyc.proof_of_address ?? kyc.proofOfAddress),
  };
}

function kycItem(value: unknown): { done: boolean; filename: string } {
  const row = asRecord(value);
  if (!row) return { done: false, filename: "" };
  return { done: row.done === true, filename: text(row.filename, 80) };
}

function applyProgress(tasks: BorrowerTask[], kyc: BorrowerPortal["kyc"], solicitor: SolicitorSelection | null): BorrowerTask[] {
  return tasks.map((task) => {
    if (task.id === "kyc" && kyc.photoId.done && kyc.proofOfAddress.done) return { ...task, status: "done" };
    if (task.id === "solicitor" && solicitor) return { ...task, status: "done" };
    return task;
  });
}

function tidyTasks(tasks: BorrowerTask[]): BorrowerTask[] {
  if (tasks.some((task) => task.status === "current") || tasks.every((task) => task.status === "done")) return tasks;
  const next = tasks.findIndex((task) => task.status === "todo");
  if (next < 0) return tasks;
  return tasks.map((task, index) => (index === next ? { ...task, status: "current" } : task));
}

function timelineOf(source: Record<string, unknown>, tasks: BorrowerTask[]): BorrowerPortal["timeline"] {
  const rows = Array.isArray(source.timeline) ? source.timeline : [];
  const parsed: BorrowerPortal["timeline"] = [];
  for (const row of rows.slice(0, 8)) {
    const rec = asRecord(row);
    if (!rec) continue;
    const label = text(first(rec.label, rec.title), 80);
    if (!label) continue;
    const state: TaskStatus = rec.state === "done" || rec.state === "current" || rec.state === "todo" ? rec.state : "todo";
    parsed.push({
      id: text(rec.id, 40) || `step-${parsed.length + 1}`,
      label,
      detail: text(first(rec.detail, rec.date), 80),
      state,
    });
  }
  if (parsed.length) return parsed;
  return tasks.map((task) => ({ id: task.id, label: task.label, detail: "", state: task.status }));
}

function lendersOf(source: Record<string, unknown>): BorrowerPortal["lenders"] {
  const rows = Array.isArray(source.lenders) ? source.lenders : Array.isArray(source.lender_options) ? source.lender_options : [];
  const lenders: BorrowerPortal["lenders"] = [];
  for (const row of rows.slice(0, 6)) {
    const rec = asRecord(row);
    if (!rec) continue;
    const name = text(first(rec.name, rec.lender, rec.label), 80);
    if (!name) continue;
    lenders.push({
      name,
      headline: text(first(rec.headline, rec.rate, rec.rate_label), 80),
      term: text(first(rec.term, rec.term_label), 40),
      note: text(first(rec.note, rec.summary), 180),
    });
  }
  return lenders;
}

function redemptionOf(row: Record<string, unknown> | null): BorrowerPortal["redemption"] {
  if (!row) return null;
  const amount = parseMoney(first(row.amount, row.figure));
  if (amount == null) return null;
  return { amountLabel: formatGbp(amount), asOf: text(first(row.as_of, row.asOf, row.date), 40) };
}

function worksOf(value: unknown): WorksKind {
  const token = String(value ?? "").toLowerCase().trim();
  if (token === "none" || token === "light" || token === "heavy" || token === "build") return token;
  if (/ground-up|ground up|new build|development/.test(token)) return "build";
  if (/heavy|structural|conversion|extension/.test(token)) return "heavy";
  if (/light|cosmetic|refurb/.test(token)) return "light";
  return "none";
}

function text(value: unknown, max: number): string {
  const clean = scrub(String(value ?? "").replace(/\s+/g, " ").trim()).slice(0, max);
  return BANNED_TEXT.some((pattern) => pattern.test(clean)) ? "" : clean;
}

const FEE_TAINT =
  /\bBROKA\b|\b(?:1st|2nd|3rd|first|second|third)\s+charges?\b|\b1st\s*\/\s*2nd\s+charges?\b|\bbroker[\s_-]*fees?\b|\bproc(?:uration)?(?:[\s_-]*fees?)?\b|\bcommissions?\b|\bsuccess[\s_-]*fees?\b|\bintroducers?\b/i;
const TAINTED_MONEY =
  /£\s?\d[\d,]*(?:\.\d+)?\s*[kKmM]?|\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\s*percent\b|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\s*[kKmM]\b|\b\d{3,}\b/gi;

function scrub(value: string): string {
  const tainted = FEE_TAINT.test(value);
  let next = value;
  for (const [pattern, replacement] of SCRUBBERS) next = next.replace(pattern, replacement);
  if (tainted) next = next.replace(TAINTED_MONEY, "").replace(/\(\s*\)/g, "");
  return next.replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
}

function first(...values: unknown[]): unknown {
  for (const value of values) {
    if (value != null && value !== "") return value;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function finite(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function whole(value: unknown): number | null {
  const n = finite(value);
  if (n == null || n <= 0) return null;
  return Math.round(n);
}

function flag(value: unknown): boolean {
  return value === true || value === "true" || value === "yes";
}

function boolish(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "yes") return true;
  if (value === false || value === "false" || value === "no") return false;
  return null;
}

function walk(value: unknown, onKey: (key: string) => void, onText: (value: string) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, onKey, onText);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      onKey(key);
      walk(item, onKey, onText);
    }
    return;
  }
  if (typeof value === "string") onText(value);
}
