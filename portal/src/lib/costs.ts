/**
 * Borrower-facing processing costs. These lines are product disclosures.
 * They are not internal broker remuneration, proc fees, or commission splits.
 */

export type CostLine = {
  id: string;
  title: string;
  body: string;
  emphasis?: "hero" | "callout";
};

export const COST_LINES: readonly CostLine[] = [
  {
    id: "no-upfront",
    title: "No upfront broker fees",
    body: "There is no upfront Posfin fee. The old £500 upfront fee has been discontinued. Posfin is your broker, and you are not asked to pay Posfin before the case moves.",
    emphasis: "hero",
  },
  {
    id: "front-runner",
    title: "Front Runner",
    body: "No upfront costs. Once the main terms are processing, a Front Runner advance of £26k–£100k can be released and is repaid automatically from the main loan.",
    emphasis: "callout",
  },
  {
    id: "solicitors",
    title: "Solicitors, paid from the loan",
    body: "Fast, low-cost solicitors can act for you. Their fees are paid from the loan proceeds. A small amount on account opens the file.",
  },
  {
    id: "valuation",
    title: "Valuation only when it is needed",
    body: "If an automated valuation is enough, that is what we use. A full valuation is instructed only when the loan-to-value or the works require one.",
  },
  {
    id: "undertaking",
    title: "Lender legal undertaking",
    body: "The standard lender legal undertaking is £1,560. Where SOMO applies, a £700 roll-up option can be available.",
  },
  {
    id: "gateway",
    title: "Gateway",
    body: "Optional. On some cases a private investor can cover costs through Gateway. It is agreed case by case, and it is not a Posfin fee.",
  },
] as const;

export const COST_INTRO =
  "A calm look at the genuine costs of getting the case moving. Nothing here is an internal fee, and nothing here is payable to Posfin up front.";
