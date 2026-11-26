export const TASK_STEPS = [
  { id: "fact_find", label: "Fact Find" },
  { id: "kyc", label: "KYC" },
  { id: "solicitor", label: "Solicitor" },
  { id: "valuation", label: "Valuation / AVM" },
  { id: "terms", label: "Lender Terms & Engagement" },
  { id: "legals", label: "Legals" },
  { id: "completion", label: "Completion" },
] as const;

export type TaskId = (typeof TASK_STEPS)[number]["id"];
export type TaskStatus = "done" | "current" | "todo";

export type BorrowerTask = {
  id: TaskId;
  label: string;
  status: TaskStatus;
};

const STAGE_DONE: Record<string, number> = {
  packaging: 1,
  application: 3,
  placement: 4,
  terms_received: 5,
  terms: 5,
  engagement: 5,
  legals: 6,
  completion_pending: 6,
  completed: 7,
  completion: 7,
};

export function tasksFromStage(stage: string | null): BorrowerTask[] {
  const done = stage ? STAGE_DONE[stage] ?? 0 : 0;
  return TASK_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status: index < done ? "done" : index === done && done < TASK_STEPS.length ? "current" : "todo",
  }));
}

export function progressPct(tasks: readonly { status: TaskStatus }[]): number {
  if (!tasks.length) return 0;
  const done = tasks.filter((task) => task.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}

export function normaliseTasks(value: unknown, stage: string | null): BorrowerTask[] {
  const base = tasksFromStage(stage);
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const source = value as Record<string, unknown>;
  let seenCurrent = false;
  return base.map((step) => {
    const raw = source[step.id];
    const status: TaskStatus = raw === "done" || raw === "current" || raw === "todo" ? raw : step.status;
    if (status === "current") {
      if (seenCurrent) return { ...step, status: "todo" };
      seenCurrent = true;
    }
    return { ...step, status };
  });
}
