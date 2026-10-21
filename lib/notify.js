/**
 * Durable notification outbox — Telegram alerts for broker team.
 *
 * Byron: 1750758657
 * Chris:  8634157536
 *
 * Notifications are persisted to case_notifications table, not in-memory.
 * processOutbox reads pending/failed entries and delivers via Telegram,
 * with retry on failure (up to max_attempts). Called by a cron worker.
 */

const RECIPIENTS = {
  byron: '1750758657',
  chris: '8634157536',
};

/**
 * Persist a notification to the durable outbox.
 * Creates one row per recipient in case_notifications.
 * Returns the inserted rows.
 */
export async function enqueueAlert(client, { caseId, message, recipients = ['byron', 'chris'] }) {
  const rows = recipients.map(r => ({
    case_id: caseId,
    channel: 'telegram',
    recipient: RECIPIENTS[r] || r,
    message,
    status: 'pending',
    attempts: 0,
    max_attempts: 3,
  }));
  const { data, error } = await client.from('case_notifications').insert(rows).select('*');
  if (error) throw new Error(`Failed to enqueue notification: ${error.message}`);
  return data || rows;
}

/**
 * Process pending and failed notifications from the outbox.
 * Attempts delivery via Telegram. On failure, increments attempts and
 * marks as 'failed' (retryable until max_attempts). On success, marks
 * as 'delivered'. Returns a summary of results.
 */
export async function processOutbox(client) {
  // Read pending and retryable failed entries
  const { data: pending, error } = await client
    .from('case_notifications')
    .select('*')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw error;
  if (!pending || pending.length === 0) return { processed: 0 };

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const results = [];

  for (const entry of pending) {
    if (entry.attempts >= entry.max_attempts) {
      // Exhausted retries — leave as failed, skip
      results.push({ id: entry.id, status: 'exhausted' });
      continue;
    }

    const now = new Date().toISOString();
    let delivered = false;
    let lastError = null;

    if (token && entry.channel === 'telegram') {
      try {
        const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: entry.recipient,
            text: entry.message,
            disable_web_page_preview: true,
          }),
        });
        const body = await resp.json();
        delivered = resp.ok && body.ok === true;
        if (!delivered) lastError = `Telegram API: ${body.description || resp.status}`;
      } catch (e) {
        lastError = e.message;
      }
    } else if (!token) {
      lastError = 'TELEGRAM_BOT_TOKEN not set';
    }

    const updates = {
      attempts: entry.attempts + 1,
      last_attempt_at: now,
      last_error: lastError,
    };
    if (delivered) {
      updates.status = 'delivered';
      updates.delivered_at = now;
    } else {
      updates.status = 'failed';
    }

    await client.from('case_notifications').update(updates).eq('id', entry.id);
    results.push({ id: entry.id, status: updates.status, attempts: updates.attempts });
  }

  return { processed: results.length, results };
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

export { RECIPIENTS };
