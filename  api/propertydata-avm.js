/**
 * GET /api/propertydata-avm?postcode=SW1A1AA
 * Posfin Capital — PropertyData AVM lookup
 *
 * Returns AVM valuation range, midpoint, confidence score, and top 5 comparables.
 * API key stored server-side as PROPERTYDATA_API_KEY env var — never exposed to client.
 *
 * Response shape (mirrors Tom's Python tools):
 *   avm_low    ← data.70pc_range[0]
 *   avm_mid    ← data.average
 *   avm_high   ← data.70pc_range[1]
 *   comparables ← data.raw_data (top 5)
 *   confidence  ← HIGH / MEDIUM / LOW based on spread
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed', allowed: ['GET'] });
  }

  // ── Extract & validate postcode ──────────────────────────────────────────────
  let { postcode } = req.query;
  if (!postcode) {
    return res.status(400).json({ error: 'Missing required query param: postcode' });
  }

  // Normalise: strip spaces, uppercase
  postcode = postcode.replace(/\s+/g, '').toUpperCase();

  // Basic UK postcode regex check
  const postcodeRegex = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/;
  if (!postcodeRegex.test(postcode)) {
    return res.status(400).json({ error: 'Invalid UK postcode format', postcode });
  }

  // ── API key ──────────────────────────────────────────────────────────────────
  const apiKey = process.env.PROPERTYDATA_API_KEY;
  if (!apiKey) {
    console.error('[propertydata-avm] PROPERTYDATA_API_KEY env var not set');
    return res.status(500).json({ error: 'AVM service not configured' });
  }

  // ── Call PropertyData ────────────────────────────────────────────────────────
  let pdData;
  try {
    const url = `https://api.propertydata.co.uk/valuation-sale?key=${apiKey}&postcode=${encodeURIComponent(postcode)}`;
    const pdRes = await fetch(url);

    if (!pdRes.ok) {
      const errText = await pdRes.text();
      console.error('[propertydata-avm] PropertyData API error:', pdRes.status, errText);
      return res.status(502).json({
        error: 'AVM lookup failed',
        detail: `PropertyData returned ${pdRes.status}`,
      });
    }

    pdData = await pdRes.json();
  } catch (err) {
    console.error('[propertydata-avm] Network error calling PropertyData:', err.message);
    return res.status(502).json({ error: 'AVM service unreachable', detail: err.message });
  }

  // ── Validate response shape ──────────────────────────────────────────────────
  if (!pdData || pdData.status === 'error') {
    return res.status(404).json({
      avm_status: 'no_data',
      message: pdData?.message || 'No AVM data available for this postcode',
      postcode,
    });
  }

  // ── Parse response (mirrors Tom's Python tools) ──────────────────────────────
  const avm_mid  = pdData.average        ?? null;
  const avm_low  = pdData['70pc_range']?.[0] ?? null;
  const avm_high = pdData['70pc_range']?.[1] ?? null;
  const comparables = Array.isArray(pdData.raw_data)
    ? pdData.raw_data.slice(0, 5)
    : [];

  if (!avm_mid || !avm_low || !avm_high) {
    return res.status(200).json({
      avm_status: 'no_data',
      message: 'AVM data incomplete for this postcode',
      postcode,
    });
  }

  // ── Confidence scoring (mirrors Tom's logic) ─────────────────────────────────
  // HIGH  if spread (high-low)/mid < 0.12
  // MEDIUM if 0.12–0.20
  // LOW   if > 0.20
  const spread = (avm_high - avm_low) / avm_mid;
  const confidence = spread < 0.12 ? 'HIGH' : spread <= 0.20 ? 'MEDIUM' : 'LOW';

  return res.status(200).json({
    avm_status:   'ok',
    postcode,
    avm_low:      Math.round(avm_low),
    avm_mid:      Math.round(avm_mid),
    avm_high:     Math.round(avm_high),
    confidence,
    spread_pct:   `${(spread * 100).toFixed(1)}%`,
    comparables,
    source:       'PropertyData',
    generated_at: new Date().toISOString(),
  });
}
