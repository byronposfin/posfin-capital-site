/**
 * Field-schema-driven form engine — shared by the A&L, Remortgage and Schedule of Works sections.
 * Schemas are plain data; the engine renders, validates, autosaves and summarises them.
 */
export type Primitive = string | number | boolean | null | undefined;
export type Answers = Record<string, unknown>;
export type Item = Record<string, unknown>;

export type FieldType =
  | "text" | "textarea" | "email" | "tel" | "date" | "month" | "postcode"
  | "money" | "money_freq" | "number" | "percent"
  | "yes_no" | "yes_no_unsure" | "yes_no_na"
  | "choice" | "choice_other" | "multi" | "checkbox"
  | "sort_code" | "account_number" | "file" | "suggest"
  /** Compact 3-way appetite row (Accept / Case by case / Decline, or Yes / Maybe / No) with optional note at `<id>_note`. */
  | "tolerance"
  /** Matrix of numeric cells, e.g. LTV % by asset type (rows) x charge (cols). Stored as { [row]: { [col]: "75" } }. */
  | "grid";

export type Cond =
  | { field: string; equals: Primitive }
  | { field: string; in: Primitive[] }
  | { field: string; notEmpty: true }
  /** Multi-select answer contains a value. */
  | { field: string; includes: string }
  | { flag: string; equals?: Primitive }
  | { all_of: Cond[] }
  | { any_of: Cond[] };

export interface Field {
  kind?: "field";
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: string[];
  /** For choice fields: option values that differ from labels. */
  optionValues?: string[];
  when?: Cond;
  /** Collapsed under "More detail (optional)". */
  advanced?: boolean;
  half?: boolean;
  suggestions?: string[];
  /** Options computed from other answers (e.g. "secured on" -> the borrower's properties). */
  dynamicOptions?: (answers: Answers) => string[];
  min?: number;
  max?: number;
  /** Badge shown on the field, e.g. "From your file — please check". */
  prefilled?: boolean;
  /** Source tag for CRM / PDF mapping, never shown to the borrower. */
  meta?: Record<string, unknown>;
  /** grid: row and column labels; unit shown in each cell. */
  rows?: string[];
  cols?: string[];
  unit?: "%" | "£" | "";
  /** tolerance: colour per option index (good / mid / bad). Defaults to green / amber / red. */
  tones?: ("good" | "mid" | "bad")[];
}

export interface Repeater {
  kind: "repeater";
  id: string;
  label: string;
  itemLabel: string;
  addLabel: string;
  fields: Field[];
  min?: number;
  max?: number;
  when?: Cond;
  help?: string;
  /** Short one-line summary for a collapsed card header. */
  summary?: (item: Item, answers: Answers) => string;
  /** Optional checkbox that satisfies min=0 explicitly e.g. "I own no property". */
  noneLabel?: string;
  noneField?: string;
  emptyItem?: () => Item;
}

export interface Notice {
  kind: "notice";
  id: string;
  tone: "info" | "warn" | "success" | "case" | "heading";
  title?: string;
  body: string;
  /** case cards: key facts shown as chips. */
  facts?: [string, string][];
  when?: Cond;
}

export type Node = Field | Repeater | Notice;

export interface Step {
  id: string;
  title: string;
  kicker?: string;
  description?: string;
  nodes: Node[];
  when?: Cond;
  /** Badge e.g. "Title insurance". */
  badge?: string;
  /** Render a live-totals panel under the fields. */
  panel?: "al_totals" | "works_totals" | "lender_gapcheck" | "lender_snapshot" | null;
}

export interface Issue {
  path: string; // "field" or "repeater.index.field"
  message: string;
  level: "error" | "warn";
  action?: { label: string; id: string };
}

export interface FormSchema {
  id: "al" | "remortgage" | "works" | "lender";
  title: string;
  steps: Step[];
  /** Extra cross-field validation (e.g. £10k itemisation rule). */
  validate?: (answers: Answers, ctx: Ctx) => Issue[];
  /** Fixes offered by Issue.action. Pure: answers -> answers. */
  actions?: Record<string, (answers: Answers) => Answers>;
  declaration: { text: string; nameLabel: string };
}

export interface Ctx {
  flags: Record<string, Primitive>;
}

export interface Draft {
  token: string;
  form: FormSchema["id"];
  status: "draft" | "submitted";
  version: number;
  step: number;
  answers: Answers;
  updated_at: string;
  submitted_at?: string;
}
