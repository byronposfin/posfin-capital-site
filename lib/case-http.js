export function setPrivate(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}

export function sendHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader('Location', location);
  res.end();
}

export function readCookie(req, name) {
  const raw = String(req.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return '';
}

export function writeStaffCookie(res, req, value, maxAge = 43200) {
  const secure = req.headers?.['x-forwarded-proto'] === 'https' || !!process.env.VERCEL;
  const bits = [`pf_staff=${encodeURIComponent(value)}`, 'HttpOnly', 'Path=/staff', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (secure) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}

export async function readRaw(req, limit = 4500000) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  if (req.body && typeof req.body === 'object') return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limit) {
      const error = new Error('too_large');
      error.code = 'too_large';
      throw error;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export function parseMultipart(buf, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!match) {
    const error = new Error('bad_type');
    error.code = 'bad_type';
    throw error;
  }
  const boundary = Buffer.from('--' + (match[1] || match[2]).trim());
  const fields = {};
  const files = [];
  let start = buf.indexOf(boundary);
  if (start < 0) {
    const error = new Error('bad_type');
    error.code = 'bad_type';
    throw error;
  }
  start += boundary.length;
  while (start < buf.length) {
    if (buf.slice(start, start + 2).toString() === '--') break;
    if (buf.slice(start, start + 2).toString() === '\r\n') start += 2;
    const next = buf.indexOf(boundary, start);
    if (next < 0) break;
    let part = buf.slice(start, next);
    if (part.length >= 2 && part.slice(-2).toString() === '\r\n') part = part.slice(0, -2);
    const sep = part.indexOf(Buffer.from('\r\n\r\n'));
    if (sep >= 0) {
      const headers = part.slice(0, sep).toString('utf8');
      const body = part.slice(sep + 4);
      const name = /name="([^"]*)"/.exec(headers);
      const filename = /filename="([^"]*)"/.exec(headers);
      const mime = /content-type:\s*([^\r\n]+)/i.exec(headers);
      if (name && filename && filename[1]) files.push({ field: name[1], filename: filename[1], mime: mime ? mime[1].trim() : '', bytes: body });
      else if (name && !filename) fields[name[1]] = body.toString('utf8');
    }
    start = next + boundary.length;
  }
  return { fields, files };
}

export async function readSubmission(req) {
  const type = String(req.headers?.['content-type'] || '');
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && !type.includes('multipart/form-data')) {
    return normalise(req.body.gap_id, req.body.kind, req.body.text, req.body.choice, req.body.client_ref, null);
  }
  const raw = await readRaw(req);
  if (type.includes('application/json')) {
    const body = JSON.parse(raw.toString('utf8') || '{}');
    return normalise(body.gap_id, body.kind, body.text, body.choice, body.client_ref, null);
  }
  if (type.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(raw.toString('utf8'));
    return normalise(params.get('gap_id'), params.get('kind'), params.get('text'), params.get('choice'), params.get('client_ref'), null);
  }
  const parsed = parseMultipart(raw, type);
  const photo = parsed.files.find((file) => file.field === 'photo' && file.bytes.length);
  const file = parsed.files.find((item) => item.field === 'file' && item.bytes.length) || parsed.files.find((item) => item.bytes.length);
  const chosen = photo || file || null;
  return normalise(parsed.fields.gap_id, parsed.fields.kind, parsed.fields.text, parsed.fields.choice, parsed.fields.client_ref, chosen);
}

function normalise(gapId, kind, text, choice, clientRef, file) {
  return {
    gapId: gapId == null ? '' : String(gapId),
    kind: kind == null ? '' : String(kind),
    text: text == null ? '' : String(text),
    choice: choice == null ? '' : String(choice),
    clientRef: clientRef == null ? '' : String(clientRef),
    file: file ? { filename: file.filename, mime: file.mime, bytes: file.bytes } : null,
  };
}

export async function readFields(req) {
  const type = String(req.headers?.['content-type'] || '');
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRaw(req);
  if (type.includes('application/json')) return JSON.parse(raw.toString('utf8') || '{}');
  if (type.includes('multipart/form-data')) return parseMultipart(raw, type).fields;
  return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
}
