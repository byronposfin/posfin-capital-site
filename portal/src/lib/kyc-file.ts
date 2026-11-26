export const KYC_MAX_BYTES = 8 * 1024 * 1024;

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
