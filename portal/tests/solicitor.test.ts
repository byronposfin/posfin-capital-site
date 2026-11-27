import { describe, expect, it } from "vitest";
import { buildBorrowerPortal } from "@/lib/portal-data";
import { demoEnvelope } from "@/lib/demo";
import {
  PANEL_FIRMS,
  SOLICITOR_DISCLOSURE,
  selectPanelSolicitor,
  submitOwnSolicitor,
} from "@/lib/solicitors";

describe("solicitor introduction", () => {
  it("stamps a panel choice with today's London date and posfin_introduced", () => {
    const summer = selectPanelSolicitor("lark", new Date("2026-07-01T23:30:00.000Z"));
    expect(summer).toMatchObject({
      route: "panel",
      firmId: "lark",
      firmName: "Lark",
      contactName: "Joanne Isherwood",
      posfin_introduced: true,
      introduced_at: "2026-07-02",
    });

    const winter = selectPanelSolicitor("taylor-rose", new Date("2026-11-26T23:30:00.000Z"));
    expect(winter).toMatchObject({
      posfin_introduced: true,
      introduced_at: "2026-11-26",
      contactName: "Hassan Butt",
    });
  });

  it("lists the four panel firms and the required disclosure", () => {
    expect(PANEL_FIRMS.map((firm) => firm.contact)).toEqual([
      "Joanne Isherwood",
      "Hassan Butt",
      "Ashkan Nejad",
      "Bethan Watt",
    ]);
    expect(PANEL_FIRMS[2].knownAs).toContain("Ackroyd");
    expect(SOLICITOR_DISCLOSURE).toMatch(/optional/i);
    expect(SOLICITOR_DISCLOSURE).toMatch(/£1,500/);
    expect(SOLICITOR_DISCLOSURE).toMatch(/earns nothing/);
  });

  it("does not stamp an introduction when the borrower uses their own firm", () => {
    const own = submitOwnSolicitor({
      firm: "Example & Co",
      contact: "Pat Example",
      email: "pat@example.com",
      phone: "07365 587773",
    });
    expect(own).toMatchObject({
      route: "own",
      posfin_introduced: false,
      introduced_at: null,
      firmName: "Example & Co",
    });
    expect(selectPanelSolicitor("not-a-firm")).toEqual({ error: "unknown_firm" });
    expect(submitOwnSolicitor({ firm: "Example & Co" })).toEqual({ error: "incomplete" });
  });

  it("carries the introduction onto the borrower payload and nowhere internal", () => {
    const selection = selectPanelSolicitor("bexley-beaumont", new Date("2026-11-26T09:00:00.000Z"));
    if ("error" in selection) throw new Error("expected panel firm");
    const envelope = demoEnvelope("posfin-capital");
    envelope.borrower_state = { solicitor: selection };
    const source = envelope.source as Record<string, unknown>;
    source.broker_fee = 424242;
    source.broka = "BROKA";
    const portal = buildBorrowerPortal(envelope, {
      vertical: "posfin-capital",
      mode: "demo",
      example: true,
      now: new Date("2026-11-26T09:00:00.000Z"),
    });
    expect(portal.solicitor).toMatchObject({
      firmName: "Bexley Beaumont",
      contactName: "Bethan Watt",
      posfin_introduced: true,
      introduced_at: "2026-11-26",
    });
    expect(JSON.stringify(portal)).not.toContain("424242");
    expect(portal.tasks.find((task) => task.id === "solicitor")?.status).toBe("done");
  });
});
