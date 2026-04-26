export default function handler(req, res) {
  try {
    // Minimal Somo calc inline
    const net = 150000;
    const term = 12;
    const rate = 0.0093;
    const arrFee = 0.025;
    const adminFee = 650;
    const denom = 1 - arrFee - (rate * term);
    const gross = net / denom;
    const interest = gross * rate * term;
    const arrangement = gross * arrFee;
    const netRelease = gross - interest - arrangement - adminFee;
    
    res.status(200).json({
      ok: true,
      gross: Math.round(gross),
      netRelease: Math.round(netRelease),
      rate: '0.93%'
    });
  } catch(e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}
