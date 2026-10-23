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
  // First: mark any exhausted entries (attempts >= max_attempts, still 'failed')
  // so they stop occupying query slots. This is idempotent.
  const { data: exhaustedRows } = await client
    .from('case_notifications')
    .select('id, attempts, max_attempts')
    .eq('status', 'failed');
  if (exhaustedRows) {
    for (const row of exhaustedRows) {
      if (row.attempts >= row.max_attempts) {
        await client.from('case_notifications').update({ status: 'exhausted' }).eq('id', row.id);
      }
    }
  }

  // Reclaim stale 'processing' entries (worker crashed before completing)
  const staleThreshold = new Date(Date.now() - 5 * 60_000).toISOString();
  await client.from('case_notifications')
    .update({ status: 'failed', last_error: 'Stale processing claim reclaimed' })
    .eq('status', 'processing')
    .lt('last_attempt_at', staleThreshold);

  // Now read only actionable entries: pending or retryable failed
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
    const now = new Date().toISOString();

    // Atomic claim: set status='processing' only if still pending/failed.
    // Uses CAS on status to prevent two workers from claiming the same row.
    const { data: claimed, error: claimErr } = await client
      .from('case_notifications')
      .update({ status: 'processing', last_attempt_at: now })
      .eq('id', entry.id)
      .in('status', ['pending', 'failed'])
      .select('id');
    if (claimErr || !claimed || claimed.length === 0) {
      // Another worker claimed it, or it was already processing — skip
      continue;
    }

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

    // Fenced completion: match both id AND the claim timestamp so a stale
    // worker that outlived its lease cannot overwrite a newer claim's status.
    const { data: completed, error: statusErr } = await client
      .from('case_notifications')
      .update(updates)
      .eq('id', entry.id)
      .eq('last_attempt_at', now)  // fence: only our claim timestamp
      .select('id');
    if (statusErr) {
      console.error(`[Notify] Status write failed for id=${entry.id}: ${statusErr.message}`);
    } else if (!completed || completed.length === 0) {
      console.error(`[Notify] Fenced completion rejected for id=${entry.id}: claim was superseded`);
    }
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
