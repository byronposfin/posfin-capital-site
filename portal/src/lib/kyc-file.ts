/**
 * Vercel’s default request body limit is 4.5 MB. Multipart overhead sits on top of the file,
 * so anything larger than 4 MB never reaches this handler.
 */
export const KYC_MAX_BYTES = 4 * 1024 * 1024;
export const KYC_MAX_LABEL = "4MB";

/** A live link cannot be marked received from a filename alone. */
export function kycAcceptsSubmission(demo: boolean, hasFile: boolean): boolean {
  return demo || hasFile;
}

const MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || "document";
  const clean = base.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+/, "").slice(0, 80);
  return clean || "document";
}

export function allowedKycMime(mime: string): boolean {
  return MIME.has(mime.split(";")[0].trim().toLowerCase());
}
