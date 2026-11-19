// Local fixture server for the staff cockpit.
// It forces preview mode. It cannot read or write the smartlink project.
// The password below only unlocks the labelled fixture board.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { handleCockpit } from '../api/staff-cockpit.js';

process.env.COCKPIT_SOURCE = 'preview';
process.env.COCKPIT_AUTH = 'preview';
process.env.COCKPIT_PREVIEW_PASSWORD = process.env.COCKPIT_PREVIEW_PASSWORD || 'preview-desk';
process.env.COCKPIT_STORE_PATH = process.env.COCKPIT_STORE_PATH || '/tmp/posfin-cockpit-preview.json';

const port = Number(process.env.PORT || 4173);
const logo = readFileSync(new URL('../logo.png', import.meta.url));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/logo.png') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.end(logo);
    return;
  }
  if (url.pathname !== '/staff/cockpit') {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('This preview server only serves /staff/cockpit.');
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = String(req.headers['content-type'] || '');
  if (raw && type.includes('application/x-www-form-urlencoded')) req.body = Object.fromEntries(new URLSearchParams(raw));
  else if (raw && type.includes('application/json')) req.body = JSON.parse(raw);
  req.query = Object.fromEntries(url.searchParams);
  req.url = url.pathname + url.search;
  try {
    await handleCockpit(req, res, { env: process.env });
  } catch (error) {
    console.error('[cockpit-preview]', error.code || 'failed');
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Preview server error');
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Cockpit preview at http://127.0.0.1:${port}/staff/cockpit`);
});
