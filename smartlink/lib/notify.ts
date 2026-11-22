/**
 * Staff notification after a successful submit.
 *
 * TODO: there is no generic CRM webhook for SmartLink forms.
 * The existing hooks are fact-find specific and must not receive these payloads:
 * - lib/ff-alert-outbox.js and api/factfind.js (pipeline.web_leads; the preview
 *   Telegram alert only sends references matching TEST-WEB-######)
 * - api/lead.js Telegram, gated by FACTFIND_INTERNAL_ALERTS (Google Sheet leads)
 * Wire a dedicated webhook here when one is chosen. Do not log the payload or the token.
 */
export async function notifySubmission(info: { form: string }) {
  console.info(`[smartlink] submitted form=${info.form}`);
  return { status: "todo" as const };
}
