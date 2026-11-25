import type { FormId } from "@/lib/brands";
import type { Answers, Item } from "@/lib/engine/types";
import { calendarDate } from "@/lib/engine/contact";

function text(value: unknown, max = 40): string | null {
  const s = String(value ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
  return s || null;
}

function iso(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return calendarDate(s) ? s : null;
}

/** Columns copied out of the form payload. Names stay in the payload. */
export function contactColumns(form: FormId, answers: Answers): Record<string, unknown> {
  if (form === "al") {
    return {
      applicant_mobile: text(answers.mobile),
      applicant_dob: iso(answers.date_of_birth),
      joint_applicant_dob: iso(answers.joint_applicant_dob),
    };
  }
  if (form === "works") {
    return {
      borrower_mobile: text(answers.borrower_mobile),
      borrower_dob: iso(answers.borrower_date_of_birth),
    };
  }
  if (form === "remortgage") {
    const people = Array.isArray(answers.borrowers) ? (answers.borrowers as Item[]) : [];
    const applicants = people
      .map((person) => ({ mobile: text(person.borrower_phone_mobile), date_of_birth: iso(person.borrower_date_of_birth) }))
      .filter((person) => person.mobile || person.date_of_birth);
    return {
      applicant_mobile: applicants[0]?.mobile ?? null,
      applicant_dob: applicants[0]?.date_of_birth ?? null,
      applicants: applicants.length ? applicants : null,
    };
  }
  return {};
}
