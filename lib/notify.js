/**
 * Notification outbox — Telegram alerts for broker team.
 *
 * Byron: 1750758657
 * Chris:  8634157536
 *
 * No live Telegram calls in tests — all delivery is through the outbox
 * pattern. The outbox can be flushed by a background function or cron.
 */

const RECIPIENTS = {
  byron: '1750758657',
  chris: '8634157536',
};

/**
 * Queue a Telegram alert for the broker team.
 * Returns the outbox entry (not yet delivered).
 */
export function queueAlert({ caseId, type, message, recipients = ['byron', 'chris'] }) {
  const entry = {
    caseId,
    type,
    message,
    recipients: recipients.map(r => ({
      name: r,
      chatId: RECIPIENTS[r] || r,
    })),
    queuedAt: new Date().toISOString(),
    deliveredAt: null,
    error: null,
  };
  return entry;
}

/**
 * Deliver a single outbox entry via Telegram Bot API.
 * Returns the entry with deliveredAt set, or error.
 */
export async function deliverTelegram(entry) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    entry.error = 'TELEGRAM_BOT_TOKEN not set';
    return entry;
  }

  const results = [];
  for (const r of entry.recipients) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: r.chatId,
          text: entry.message,
          disable_web_page_preview: true,
        }),
      });
      const body = await resp.json();
      results.push({ chatId: r.chatId, ok: resp.ok && body.ok === true, messageId: body.result?.message_id || null });
    } catch (e) {
      results.push({ chatId: r.chatId, ok: false, error: e.message });
    }
  }

  entry.deliveredAt = new Date().toISOString();
  entry.results = results;
  return entry;
}

/**
 * Format a SmartLink case update alert.
 */
export function formatCaseAlert(caseId, action, details = {}) {
  const lines = [
    `SmartLink update: ${caseId}`,
    `Action: ${action}`,
  ];
  if (details.borrowerName) lines.push(`Borrower: ${details.borrowerName}`);
  if (details.fieldsUpdated) lines.push(`Fields updated: ${details.fieldsUpdated}`);
  if (details.version) lines.push(`Version: ${details.version}`);
  if (details.scorecardUrl) lines.push(`Scorecard: ${details.scorecardUrl}`);
  return lines.join('\n');
}
