import type { Answers, Draft } from "@/lib/engine/types";
import type { FormId } from "@/lib/brands";

export interface StorageAdapter {
  name: string;
  getDraft(form: FormId, token: string): Promise<Draft | null>;
  saveDraft(form: FormId, token: string, data: { answers: Answers; step: number; status?: Draft["status"]; derived?: Record<string, unknown>; export?: Record<string, unknown> }): Promise<Draft>;
}
