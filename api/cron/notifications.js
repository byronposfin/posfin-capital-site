/**
 * Cron worker: process the notification outbox.
 *
 * Scheduled via vercel.json crons. Reads pending/failed notifications
 * from case_notifications, delivers via Telegram, retries on failure.
 *
 * Protected by CRON_SECRET header verification.
 */

import { processOutbox } from '../../lib/notify.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Verify cron secret — required, not optional. Vercel sets the
  // Authorization header on scheduled invocations. Without CRON_SECRET
  // configured, the endpoint refuses all requests (fail closed).
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({ error: 'CRON_SECRET not configured' });
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const client = await (await import('../../lib/supabase.js')).supabase();
    const result = await processOutbox(client);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[Cron Notifications]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
