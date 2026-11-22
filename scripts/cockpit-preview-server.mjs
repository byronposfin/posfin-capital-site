// Local fixture server for the staff cockpit.
// It forces preview mode. It cannot read or write the smartlink project.
// The password below only unlocks the labelled fixture board.
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { handleCockpit } from '../api/staff-cockpit.js';
import pipeline from '../api/staff-pipeline.js';
import brokaDesk from '../api/broka-desk.js';
import brokaJobs from '../api/broka/jobs.js';
import elLorDesk from '../api/el-lor-desk.js';

process.env.COCKPIT_SOURCE = 'preview';
process.env.COCKPIT_AUTH = 'preview';
process.env.COCKPIT_PREVIEW_PASSWORD = process.env.COCKPIT_PREVIEW_PASSWORD || 'preview-desk';
process.env.COCKPIT_STORE_PATH = process.env.COCKPIT_STORE_PATH || '/tmp/posfin-cockpit-preview.json';

function formFields(raw) {
  const params = new URLSearchParams(raw);
  const body = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    body[key] = values.length > 1 ? values : values[0];
  }
  return body;
}

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
  const spinePath = url.pathname.match(/^\/staff\/cockpit\/spine\/([^/]+)$/);
  const brokaPath = url.pathname.match(/^\/staff\/cockpit\/broka\/([^/]+)$/);
  const elPath = url.pathname.match(/^\/staff\/cockpit\/el\/([^/]+)$/);
  const livePath = url.pathname === '/staff/cockpit/live';
  const pipelinePath = url.pathname === '/staff/cockpit/pipeline';
  const brokaJob = url.pathname === '/api/broka/jobs' || url.pathname === '/staff/cockpit/broka-jobs';
  if (url.pathname !== '/staff/cockpit' && !spinePath && !pipelinePath && !brokaPath && !brokaJob && !livePath && !elPath) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('This preview server only serves /staff/cockpit.');
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = String(req.headers['content-type'] || '');
  if (raw && type.includes('application/x-www-form-urlencoded')) req.body = formFields(raw);
  else if (raw && type.includes('application/json')) req.body = JSON.parse(raw);
  req.query = Object.fromEntries(url.searchParams);
  if (spinePath) req.query.spine = decodeURIComponent(spinePath[1]);
  if (brokaPath) req.query.case = decodeURIComponent(brokaPath[1]);
  if (elPath) req.query.case = decodeURIComponent(elPath[1]);
  req.url = url.pathname + url.search;
  try {
    if (brokaJob) await brokaJobs(req, res);
    else if (livePath || elPath) await elLorDesk(req, res);
    else if (pipelinePath) await pipeline(req, res);
    else if (brokaPath) await brokaDesk(req, res);
    else await handleCockpit(req, res, { env: process.env });
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
