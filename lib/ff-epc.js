// England & Wales domestic EPC lookup. One upstream search, then one certificate read, then cache.
const BASE = 'https://api.get-energy-performance-data.communities.gov.uk';
const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;

export function normalisePostcode(value) {
  return String(value || '').toUpperCase().replace(/\s/g, '');
}
export function normaliseAddress(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
export function addressKey(postcode, address) {
  const code = normalisePostcode(postcode);
  const line = normaliseAddress(address);
  if (!POSTCODE.test(code) || line.length < 3) return '';
  return code + '|' + line;
}
function numberOrNull(value) {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n : null;
}
function integerOrNull(value) {
  const n = numberOrNull(value);
  return n == null ? null : Math.round(n);
}
export function certificateDetails(payload) {
  const root = payload && payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : (payload || {});
  const pick = (...keys) => {
    for (const key of keys) if (root[key] != null && String(root[key]).trim() !== '') return root[key];
    return null;
  };
  return {
    floorAreaM2: numberOrNull(pick('total-floor-area', 'totalFloorArea')),
    habitableRooms: integerOrNull(pick('number-habitable-rooms', 'numberHabitableRooms')),
    bedrooms: integerOrNull(pick('number-of-bedrooms', 'numberOfBedrooms', 'bedrooms')),
  };
}
function buildingNumber(value) {
  const match = normaliseAddress(value).match(/\b\d+[A-Z]?\b/);
  return match ? match[0] : '';
}
function rowLine(row) {
  return [row.addressLine1, row.addressLine2, row.addressLine3, row.addressLine4, row.postTown, row.postcode].filter(Boolean).join(' ');
}
export function matchCertificate(address, rows) {
  const want = normaliseAddress(address);
  const wantNo = buildingNumber(want);
  if (!want || !Array.isArray(rows) || !rows.length) return null;
  const ranked = [];
  for (const row of rows) {
    if (!row || !row.certificateNumber) continue;
    const got = normaliseAddress(rowLine(row));
    const gotNo = buildingNumber(got);
    let score = 0;
    if (got === want || got.startsWith(want) || want.startsWith(got)) score = 3;
    else if (wantNo && gotNo === wantNo && got.includes(wantNo)) score = 2;
    if (score) ranked.push({ row, score });
  }
  if (!ranked.length) return null;
  const best = Math.max(...ranked.map((item) => item.score));
  const winners = ranked.filter((item) => item.score === best);
  const numbers = new Set(winners.map((item) => item.row.certificateNumber));
  return numbers.size === 1 ? winners[0].row : null;
}
function band(value) {
  const letter = String(value || '').trim().toUpperCase();
  return /^[A-G]$/.test(letter) ? letter : null;
}
function day(value) {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
function remember(cache, key, value, now) {
  if (!cache || (value.status !== 'matched' && value.status !== 'no_match')) return;
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(key, { at: now, value });
}
async function readJson(response) {
  try { return await response.json(); } catch { return null; }
}
export async function lookupEpc({ postcode, address, apiKey, fetcher = fetch, cache, now = Date.now() } = {}) {
  const key = addressKey(postcode, address);
  if (!key) return { status: 'invalid', cached: false, epc: null };
  const hit = cache && cache.get(key);
  if (hit && now - hit.at < 24 * 60 * 60 * 1000) return { ...hit.value, cached: true };
  if (!String(apiKey || '').trim()) return { status: 'not_configured', cached: false, epc: null };
  const headers = { Accept: 'application/json', Authorization: `Bearer ${String(apiKey).trim()}` };
  try {
    const searchUrl = new URL(BASE + '/api/domestic/search');
    searchUrl.searchParams.set('postcode', normalisePostcode(postcode));
    searchUrl.searchParams.set('address', String(address).slice(0, 120));
    searchUrl.searchParams.set('page_size', '25');
    const search = await fetcher(searchUrl, { headers, signal: AbortSignal.timeout(8000) });
    if (search.status === 401 || search.status === 403) return { status: 'unavailable', cached: false, epc: null };
    if (!search.ok) return { status: 'unavailable', cached: false, epc: null };
    const body = await readJson(search);
    const rows = Array.isArray(body?.data) ? body.data : [];
    const match = matchCertificate(address, rows);
    if (!match) {
      const value = { status: 'no_match', cached: false, epc: null };
      remember(cache, key, value, now);
      return value;
    }
    let extra = { floorAreaM2: null, habitableRooms: null, bedrooms: null };
    try {
      const certUrl = new URL(BASE + '/api/certificate');
      certUrl.searchParams.set('certificate_number', match.certificateNumber);
      const cert = await fetcher(certUrl, { headers, signal: AbortSignal.timeout(8000) });
      if (cert.ok) extra = certificateDetails(await readJson(cert));
    } catch { /* The search row is enough. Do not retry. */ }
    const value = {
      status: 'matched',
      cached: false,
      epc: {
        rating: band(match.currentEnergyEfficiencyBand),
        certificateNumber: String(match.certificateNumber).slice(0, 40),
        registrationDate: day(match.registrationDate),
        floorAreaM2: extra.floorAreaM2,
        habitableRooms: extra.habitableRooms,
        bedrooms: extra.bedrooms,
      },
    };
    remember(cache, key, value, now);
    return value;
  } catch {
    return { status: 'unavailable', cached: false, epc: null };
  }
}
