import { describe, expect, it } from "vitest";
import { FCA_FOOTER, listVerticals, resolveVertical } from "@/lib/verticals";

describe("vertical registry", () => {
  it("resolves the live brands and ignores unknown ids", () => {
    const posfin = resolveVertical("posfin-capital");
    const placed = resolveVertical("Placed");
    expect(posfin?.name).toBe("Posfin Capital");
    expect(placed?.id).toBe("placed");
    expect(placed?.name).toBe("Placed");
    expect(resolveVertical("unknown-brand")).toBeNull();
    expect(resolveVertical("")).toBeNull();
    expect(listVerticals().map((brand) => brand.id)).toEqual(["posfin-capital", "placed"]);
  });

  it("positions every brand as Posfin the broker", () => {
    for (const brand of listVerticals()) {
      expect(brand.footer).toContain("FRN 913022");
      expect(brand.footer).toContain("credit broker, not a lender");
      expect(brand.footer).not.toMatch(/\bBROKA\b/);
      expect(brand.footer).not.toMatch(/\b(?:1st|2nd)\s+charge\b/i);
    }
    expect(FCA_FOOTER).toContain("not a lender");
  });
});
