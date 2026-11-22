import type { Answers } from "./engine/types";

export interface BootDraft {
  answers: Answers;
  step: number;
  status: "draft" | "submitted";
  version?: number;
  updated_at?: string;
  submitted_at?: string | null;
}

export interface Boot {
  case: { ref: string; demo: boolean; flags: { titleInsurance: boolean } };
  draft: BootDraft | null;
  brandId: string;
  flags: { titleInsurance: boolean };
  prefillSources: string[];
  initial: Pick<BootDraft, "answers" | "step" | "status">;
  resultHref: string;
  resultLabel: string;
}
