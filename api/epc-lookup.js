// One England & Wales domestic EPC lookup per postcode and address. The key stays server-side.
import { lookupEpc } from '../lib/ff-epc.js';

const cache = new Map();
const attempts = new Map();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const ip = String(req.headers?.['x-forwarded-for'] || 'unknown').split(',')[0];
  const now = Date.now();
  for (const [key, value] of attempts) if (now - value.start > 60000) attempts.delete(key);
  const bucket = attempts.get(ip) || { start: now, count: 0 };
  bucket.count += 1;
  attempts.set(ip, bucket);
  if (bucket.count > 8) return res.status(429).json({ status: 'unavailable', error: 'Please wait a minute, then try the address again.' });
  const result = await lookupEpc({
    postcode: req.query?.postcode,
    address: req.query?.address,
    apiKey: process.env.EPC_API_KEY,
    cache,
    now,
  });
  const status = result.status === 'invalid' ? 400 : 200;
  return res.status(status).json({ status: result.status, cached: result.cached === true, epc: result.epc || null });
}
