/**
 * PropertyData AVM proxy — /api/propertydata?postcode=SW1A1AA
 * Proxies to PropertyData API to avoid CORS issues from browser.
 */
const PROPERTYDATA_KEY = '9UB2ZJQ1BD';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { postcode } = req.query;
  if (!postcode) return res.status(400).json({ error: 'postcode required' });

  const clean = postcode.replace(/\s+/g, '').toUpperCase();

  try {
    // Try sold-prices for AVM estimate
    const r = await fetch(
      `https://api.propertydata.co.uk/sold-prices?key=${PROPERTYDATA_KEY}&postcode=${clean}`,
      { headers: { 'Accept': 'application/json' } }
    );
    const data = await r.json();

    if (data.status === 'success' && data.data) {
      const d = data.data;
      const avg = d.average || 0;
      const range = d['70pc_range'] || [0, 0];
      const raw = d.raw_data || [];
      const spread = avg && range[0] && range[1] ? (range[1] - range[0]) / avg : 1;
      const confidence = spread < 0.15 ? 'HIGH' : spread < 0.30 ? 'MEDIUM' : 'LOW';

      return res.status(200).json({
        status: 'ok',
        postcode: clean,
        avm_mid: avg,
        avm_low: range[0],
        avm_high: range[1],
        confidence,
        comp_count: raw.length,
        comps: raw.slice(0, 5).map(c => ({
          address: c.address || '',
          price: c.price || 0,
          date: c.date || '',
          type: c.property_type || ''
        }))
      });
    }

    return res.status(200).json({ status: 'no_data', postcode: clean, avm_mid: 0, confidence: 'LOW', comps: [] });
  } catch (e) {
    return res.status(200).json({ status: 'error', error: e.message, avm_mid: 0, confidence: 'LOW', comps: [] });
  }
}
