export function readCookie(req, name) {
  const raw = String(req.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try { return decodeURIComponent(part.slice(idx + 1).trim()); }
      catch { return ''; }
    }
  }
  return '';
}

export async function readForm(req) {
  const type = String(req.headers?.['content-type'] || '');
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 100_000) {
      const error = new Error('too_large');
      error.code = 'too_large';
      throw error;
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  if (type.includes('application/json')) return JSON.parse(raw);
  return Object.fromEntries(new URLSearchParams(raw));
}

export function requestQuery(req) {
  const fromUrl = {};
  try {
    const host = req.headers?.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    for (const [key, value] of url.searchParams) fromUrl[key] = value;
  } catch { /* a malformed URL falls back to the platform query */ }
  return { ...fromUrl, ...(req.query || {}) };
}

export function requestSecure(req) {
  return req.headers?.['x-forwarded-proto'] === 'https' || !!process.env.VERCEL;
}

export function sendHtml(res, status, html, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end(html);
}

export function redirect(res, location, extraHeaders = {}) {
  res.statusCode = 303;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end();
}

export function sameOriginPost(req) {
  const site = String(req.headers?.['sec-fetch-site'] || '');
  if (site === 'cross-site') return false;
  if (site === 'same-origin' || site === 'same-site' || site === 'none') return true;
  const origin = String(req.headers?.origin || '');
  if (!origin || origin === 'null') return true;
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '');
  try { return new URL(origin).host === host; }
  catch { return false; }
}
