import { createHash } from "node:crypto";

const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

export function isDemoToken(token: string): boolean {
  return token === "demo";
}

export function isPortalToken(token: string): boolean {
  return isDemoToken(token) || TOKEN.test(token);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function portalTopic(token: string): string {
  return `borrower-portal:${hashToken(token)}`;
}
