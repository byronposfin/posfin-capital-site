import { describe, expect, it } from "vitest";
import { KYC_MAX_BYTES, kycAcceptsSubmission } from "@/lib/kyc-file";

describe("KYC uploads", () => {
  it("refuses a live completion that has no file and stays under the Vercel body limit", () => {
    expect(kycAcceptsSubmission(false, false)).toBe(false);
    expect(kycAcceptsSubmission(false, true)).toBe(true);
    expect(kycAcceptsSubmission(true, false)).toBe(true);
    expect(KYC_MAX_BYTES).toBe(4 * 1024 * 1024);
    expect(KYC_MAX_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });
});